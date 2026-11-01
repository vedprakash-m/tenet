// A folder with no Git: by the user's choice, a snapshot-backed prototype that is never reported as checked (GIT-01, TS §10.9).
import { existsSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, git, tmp, write } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, callWithEnvelopeConsent, reviewResult } from "./support/fixture.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { createPorts } from "../src/wire.ts";
import { emptyState } from "../src/core/state.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const d = (r: { data?: unknown }) => r.data as Record<string, any>;

function bare() {
  const root = tmp("tenet-proto-"); roots.push(root);
  write(root, "package.json", '{"name":"p","type":"module","private":true}\n');
  write(root, "tsconfig.json", '{"compilerOptions":{"strict":true}}\n');
  write(root, "src/greet.ts", "export const greet = (_n: string): string => '';\n");
  write(root, ".env", "TOKEN=hunter2hunter2\n"); // privacy-ok
  symlinkSync(join(import.meta.dirname, "../../../node_modules"), join(root, "node_modules"));
  const ports = createPorts(root, { PATH: process.env.PATH, HOME: process.env.HOME });
  const rawCall = (v: string, i: Record<string, unknown>) => runVerb(ports, VERBS, v, i);
  const call = (v: string, i: Record<string, unknown>) => callWithEnvelopeConsent(rawCall, v, i);
  const shadow = (...a: string[]) => git(root, "--git-dir", join(root, ".tenet/git"), "--work-tree", root, ...a);
  return { root, call, shadow, ports };
}

describe("snapshot-backed prototype [GIT-01]", () => {
  it("offers the choice first, and only a prototype can be built without Git", async () => {
    const { root, call } = bare();
    const ask = await call("open", { profile: "feature", request: "x", scopePaths: [] });
    assert.equal(ask.exit, 3);
    assert.ok(ask.questions![0]!.options!.some((o) => /prototype/i.test(o.label)));
    const refused = await call("open", { profile: "feature", request: "x", scopePaths: [], noGit: true });
    assert.equal(refused.exit, 1);
    assert.ok(!existsSync(join(root, ".tenet/git")) && !existsSync(join(root, ".git")), "nothing was created");
  });

  it("builds in a shadow repository, snapshots at open and every check, copies no secrets, and ends as a prototype [WRK-06]", async () => {
    const { root, call, shadow } = bare();
    const o = await call("open", { profile: "prototype", request: "sketch a greeting", scopePaths: ["src/greet.ts"], noGit: true, lane: "quick" });
    assert.equal(o.exit, 0, JSON.stringify(o));
    const h = o.handle!;
    assert.ok(!existsSync(join(root, ".git")), "the folder never becomes a Git repository");
    assert.equal(shadow("rev-list", "--count", "HEAD"), "1", "the start is snapshotted");
    const tracked = shadow("ls-files").split("\n");
    assert.ok(tracked.includes("src/greet.ts") && !tracked.includes(".env") && !tracked.some((p) => p.startsWith("node_modules") || p.startsWith(".tenet")));

    await call("decide", { h, kind: "basis", propose: BASIS });
    write(root, "src/greet.test.ts", GREET_TEST);
    await call("check", { h, stage: "baseline" });
    write(root, "src/greet.ts", GREET_IMPL);
    const c = await call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.equal(c.exit, 0, JSON.stringify(c));
    assert.equal(Number(shadow("rev-list", "--count", "HEAD")), 3, "one snapshot per check");
    assert.match(shadow("show", "HEAD:src/greet.ts"), /Hello/);
    await call("findings", { h, result: reviewResult(d(c)) });

    const f = await call("finish", { h });
    assert.equal(d(f).endpoint, "prototype", JSON.stringify(f.reasons));
    assert.match(d(f).label, /^Prototype/);
    assert.ok(f.reasons.some((r) => r.code === "hardening-gaps-missing"));
    assert.ok(f.next.some((n) => n.action === "decision" && /decide hardening/.test(n.why)));
    assert.equal(d(f).offer, undefined, "a prototype is never offered for adoption");
    assert.deepEqual(d(f).commits, []);
    assert.equal(readFileSync(join(root, ".env"), "utf8"), "TOKEN=hunter2hunter2\n"); // privacy-ok
  });

  it("blocks a sensitive-data prototype before initializing its shadow repository [WRK-06]", async () => {
    const { root, call, ports } = bare();
    await ports.store.transaction("test", async (tx) => {
      const ident = tx.ensure();
      const initial = emptyState(ident.workspaceId, ident.tag);
      tx.publish({ ...initial, project: { ...initial.project, traits: ["personal-data"] } });
    });
    const r = await call("open", {
      profile: "prototype", request: "explore sensitive data", scopePaths: [], noGit: true,
    });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.equal(r.reasons[0]?.code, "prototype-data-limit");
    assert.match(r.questions?.[0]?.question ?? "", /does not inspect.*data/i);
    assert.ok(r.questions?.[0]?.options?.some((o) => /checked change/i.test(o.label)));
    assert.ok(r.questions?.[0]?.options?.some((o) => /^stop$/i.test(o.label)));
    assert.equal(existsSync(join(root, ".tenet/git")), false);
  });

  it("creates and snapshots a hardening inventory when absent [WRK-06]", async () => {
    const { root, call, shadow, ports } = bare();
    const o = await call("open", {
      profile: "prototype", request: "sketch a prototype", scopePaths: ["src/greet.ts"], noGit: true, lane: "quick",
    });
    const h = o.handle!;
    const written = await call("decide", { h, kind: "hardening", gaps: ["Check authorization."] });
    assert.equal(written.exit, 0, JSON.stringify(written));
    const path = join(root, "docs/hardening.md");
    const text = readFileSync(path, "utf8");
    assert.match(text, /^# Hardening\n/);
    assert.match(text, /- Gap: Check authorization\./);
    assert.ok(Object.values(ports.store.read()!.state.work)[0]!.scope.paths.includes("docs/hardening.md"));

    await call("decide", { h, kind: "basis", propose: BASIS });
    write(root, "src/greet.test.ts", GREET_TEST);
    const baseline = await call("check", { h, stage: "baseline" });
    assert.equal(Number(shadow("rev-list", "--count", "HEAD")), 2, JSON.stringify(baseline));
    assert.match(shadow("show", "HEAD:docs/hardening.md"), /- Gap: Check authorization\./);
  });

  it("writes, updates and protects the prototype hardening inventory [WRK-06, QLT-17]", async () => {
    const { root, call, ports } = bare();
    const prose = "# Project hardening\r\nKeep this text.\r\n";
    write(root, "docs/hardening.md", prose);
    const o = await call("open", {
      profile: "prototype", request: "sketch a prototype", scopePaths: ["src/greet.ts"], noGit: true, lane: "quick",
    });
    assert.equal(o.exit, 0, JSON.stringify(o));
    const h = o.handle!;
    const work = Object.values(ports.store.read()!.state.work)[0]!;
    assert.ok(work.scope.paths.includes("docs/hardening.md"));
    const opened = await call("decide", { h, kind: "hardening", gaps: ["Add authorization checks."] });
    assert.equal(opened.exit, 0, JSON.stringify(opened));
    const path = join(root, "docs/hardening.md");
    const first = readFileSync(path, "utf8");
    assert.ok(first.startsWith(prose));
    assert.equal(/[^\r]\n/.test(first), false);
    assert.match(first, /<!-- tenet:begin HARDENING-/);
    assert.match(first, /\*\*Prototype .*: unhardened\*\* \(\d{4}-\d{2}-\d{2}\)/);
    assert.match(first, /- Data: synthetic or public data only/);
    assert.match(first, /- Gap: Add authorization checks\./);

    const updated = await call("decide", { h, kind: "hardening", gaps: ["Validate every request."] });
    assert.equal(updated.exit, 0, JSON.stringify(updated));
    const second = readFileSync(path, "utf8");
    assert.ok(second.startsWith(prose));
    assert.match(second, /- Gap: Validate every request\./);
    assert.doesNotMatch(second, /- Gap: Add authorization checks\./);

    const edited = second.replace("- Gap: Validate every request.", "- Gap: Human edit.");
    write(root, "docs/hardening.md", edited);
    const refused = await call("decide", { h, kind: "hardening", gaps: ["Replace edited content."] });
    assert.equal(refused.reasons[0]?.code, "intent-edited-outside");
    assert.equal(readFileSync(path, "utf8"), edited);
    const finished = await call("finish", { h, noCommit: true });
    assert.equal(finished.reasons.some((r) => r.code === "hardening-gaps-missing"), false);
  });

  it("rejects malformed hardening gaps without writing [WRK-06]", async () => {
    const { root, call } = bare();
    const o = await call("open", { profile: "prototype", request: "x", scopePaths: [], noGit: true });
    for (const gaps of [["bad\nline"], [], Array.from({ length: 13 }, () => "gap"), ["x".repeat(201)], ["tenet:end BAD"]]) {
      const r = await call("decide", { h: o.handle, kind: "hardening", gaps });
      assert.equal(r.exit, 2, JSON.stringify(gaps));
      assert.equal(r.reasons[0]?.code, "hardening-gaps-invalid");
    }
    assert.equal(existsSync(join(root, "docs/hardening.md")), false);
  });

  it("rehashes hardening.md immediately before replacing its block [WRK-06]", async () => {
    const { root, call, ports } = bare();
    const o = await call("open", { profile: "prototype", request: "race", scopePaths: [], noGit: true });
    const path = join(root, "docs/hardening.md");
    write(root, "docs/hardening.md", "# User notes\n");
    const read = ports.project.read.bind(ports.project);
    let raced = false;
    ports.project.read = (file) => {
      const value = read(file);
      if (file === "docs/hardening.md" && !raced) {
        raced = true;
        write(root, "docs/hardening.md", "# User edit during projection\n");
      }
      return value;
    };
    const r = await call("decide", { h: o.handle, kind: "hardening", gaps: ["Check authorization."] });
    assert.equal(r.reasons[0]?.code, "intent-edited-outside");
    assert.equal(readFileSync(path, "utf8"), "# User edit during projection\n");
  });

  for (const point of ["after-intent", "after-write", "after-result"]) {
    it(`recovers a hardening write killed ${point} [WRK-06, CON-03]`, async () => {
      const { root, call, ports } = bare();
      const o = await call("open", { profile: "prototype", request: `recover ${point}`, scopePaths: [], noGit: true });
      const child = spawn(process.execPath, [
        join(import.meta.dirname, "fixtures/crash-hardening.ts"), root, o.handle!, point,
      ], { stdio: "ignore" });
      assert.equal(await new Promise((resolve) => child.on("exit", (_code, signal) => resolve(signal))), "SIGKILL");
      const r = await call("decide", { h: o.handle, kind: "hardening", gaps: ["Check authorization."] });
      assert.equal(r.exit, 0, JSON.stringify(r));
      const work = Object.values(ports.store.read()!.state.work)[0]!;
      assert.ok(work.hardening);
      assert.match(readFileSync(join(root, "docs/hardening.md"), "utf8"), /- Gap: Check authorization\./);
    });
  }

  it("refuses to snapshot more than 20 MB and leaves no half-made repository", async () => {
    const { root, call } = bare();
    writeFileSync(join(root, "big.bin"), Buffer.alloc(21 * 1024 * 1024, 1));
    const r = await call("open", { profile: "prototype", request: "x", scopePaths: [], noGit: true });
    assert.equal(r.exit, 2);
    assert.equal(r.reasons[0]!.code, "snapshot-too-large");
    assert.ok(!existsSync(join(root, ".tenet/git")));
  });
});
