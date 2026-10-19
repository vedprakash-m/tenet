// Structural promises that are cheap to state and expensive to lose: file permissions, the bundle, and no remote effects.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, tmp } from "./helpers.ts";
import { BASIS, project } from "./support/fixture.ts";
import { lintArch } from "../../../tools/lint-arch.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const mode = (p: string) => (statSync(p).mode & 0o777).toString(8);

describe("operational state is private (CON-02)", () => {
  it("keeps .tenet/ with its own .gitignore and user-only permissions, and git does not see it [CON-02]", async () => {
    const p = project(); roots.push(p.root);
    const o = await p.call("open", { profile: "feature", request: "x", scopePaths: ["src/greet.ts"] });
    await p.call("decide", { h: o.handle!, kind: "basis", propose: BASIS });
    const dir = join(p.root, ".tenet");
    assert.equal(mode(dir), "700");
    for (const f of ["state", "marker", "log"]) assert.equal(mode(join(dir, f)), "600", f);
    assert.equal(readFileSync(join(dir, ".gitignore"), "utf8"), "*\n");
    assert.equal(p.git("status", "--porcelain"), "", ".tenet/ never shows up as a change");
  });
});

describe("no remote effects exist before `publish` (GIT-05)", () => {
  it("has no verb, and the Git adapter has no remote command [GIT-05]", () => {
    const src = join(import.meta.dirname, "../src");
    assert.deepEqual(lintArch(src).problems, []);
    const d = tmp(); roots.push(d);
    mkdirSync(join(d, "adapters"), { recursive: true });
    writeFileSync(join(d, "adapters/git-cli.ts"), 'export const x = ["push", "origin"];');
    assert.match(lintArch(d).problems.join("\n"), /remote Git operations/);
  });
  it("answers `publish` as an unknown verb", async () => {
    const p = project(); roots.push(p.root);
    const r = await p.call("publish", {});
    assert.equal(r.exit, 1);
  });
});

describe("the shipped bundle (INS-07: no runtime beyond Node)", () => {
  const bundle = join(import.meta.dirname, "../../../plugin/kernel/tenet.mjs");
  it("is one self-contained file within its size budget, and runs with nothing but Node [INS-07]", { skip: !existsSync(bundle) && "run `npm run build` first" }, () => {
    assert.ok(statSync(bundle).size <= 600 * 1024);
    assert.doesNotMatch(readFileSync(bundle, "utf8"), /from\s*["'](?!node:)[^."'/][^"']*["']/, "no bare package import is left unbundled");
    const out = execFileSync(process.execPath, [bundle, "inspect", "help"], { env: { PATH: process.env.PATH }, encoding: "utf8" });
    assert.ok(JSON.parse(out).data.verbs.open);
  });
});

describe("housekeeping (TS §7.6)", () => {
  it("removes day-old run directories and manifests at the next open, and keeps what a live run or reservation uses", async () => {
    const p = project(); roots.push(p.root);
    const first = await p.call("open", { profile: "investigate", request: "one" });
    const store = p.ports().store;
    const dir = store.tempDir("run-old");
    const keep = store.tempDir("run-live");
    const manifestDir = store.tempDir("manifests");
    writeFileSync(join(manifestDir, "old.json"), "{}");
    const longAgo = new Date(Date.now() - 3 * 24 * 3600_000);
    for (const x of [dir, keep, join(manifestDir, "old.json")]) utimesSync(x, longAgo, longAgo);
    const st = store.read()!.state;
    const w = Object.values(st.work)[0]!;
    await store.transaction("t", async (tx) => tx.publish({ ...st, work: { ...st.work, [w.id]: { ...w, session: { ...w.session, inCall: { runId: "x", ...store.self(), verb: "check", since: "t", runDir: keep } } } } }));
    await p.call("open", { profile: "investigate", request: "two" });
    assert.equal(existsSync(dir), false);
    assert.equal(existsSync(join(manifestDir, "old.json")), false);
    assert.equal(existsSync(keep), true, "a live run's directory is never swept");
    void first;
  });
});
