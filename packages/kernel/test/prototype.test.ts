// A folder with no Git: by the user's choice, a snapshot-backed prototype that is never reported as checked (GIT-01, TS §10.9).
import { existsSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, git, tmp, write } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, reviewResult } from "./support/fixture.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { createPorts } from "../src/wire.ts";

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
  const call = (v: string, i: Record<string, unknown>) => runVerb(createPorts(root, { PATH: process.env.PATH, HOME: process.env.HOME }), VERBS, v, i);
  const shadow = (...a: string[]) => git(root, "--git-dir", join(root, ".tenet/git"), "--work-tree", root, ...a);
  return { root, call, shadow };
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

  it("builds in a shadow repository, snapshots at open and every check, copies no secrets, and ends as a prototype", async () => {
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
    assert.deepEqual(d(f).commits, []);
    assert.equal(readFileSync(join(root, ".env"), "utf8"), "TOKEN=hunter2hunter2\n"); // privacy-ok
  });

  it("refuses to snapshot more than 20 MB and leaves no half-made repository", async () => {
    const { root, call } = bare();
    writeFileSync(join(root, "big.bin"), Buffer.alloc(21 * 1024 * 1024, 1));
    const r = await call("open", { profile: "prototype", request: "x", scopePaths: [], noGit: true });
    assert.equal(r.exit, 2);
    assert.equal(r.reasons[0]!.code, "snapshot-too-large");
    assert.ok(!existsSync(join(root, ".tenet/git")));
  });
});
