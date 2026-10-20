// `decide dependency`: resolve without installing, verify, preview, then install (SEC-05, TS §9.11). npm is a fake that
// writes the lockfile the way a resolution would; the policy, the lockfile diff and the file restoration are the real ones.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { fakeRecipes, portsWith, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import type { Runner, RunResult, RunSpec } from "../src/ports/types.ts";

const roots: string[] = [];
after(() => { for (const r of roots) cleanup(r); });

interface Scenario { packages: Record<string, { version?: string; ageDays?: number; script?: boolean; resolved?: string; license?: string }>; failResolve?: boolean }
const pkg = (name: string, s: Scenario["packages"][string]) => ({ version: s.version ?? "1.0.0", resolved: s.resolved ?? `https://registry.npmjs.org/${name}/-/${name}-1.0.0.tgz`, integrity: "sha512-x", license: s.license ?? "MIT", ...(s.script ? { hasInstallScript: true } : {}) });

function setup(sc: Scenario, files: Record<string, string> = {}) {
  const p: Project = project(files);
  roots.push(p.root);
  const calls: string[][] = [];
  const base = portsWith(p.root, fakeRecipes());
  const done = (over: Partial<RunResult> = {}): RunResult => ({ exit: 0, timedOut: false, durationMs: 1, stdout: "", stderr: "", startedAt: "t", report: null, ...over });
  const simulated = {
    async run(spec: RunSpec): Promise<RunResult> {
      calls.push(spec.argv);
      const [, sub, flag] = spec.argv;
      if (sub === "install" && flag === "--package-lock-only") {
        writeFileSync(join(p.root, "package.json"), JSON.stringify({ name: "fx", type: "module", private: true, dependencies: Object.fromEntries(Object.keys(sc.packages).map((n) => [n, "^1.0.0"])) }));
        writeFileSync(join(p.root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": { dependencies: Object.fromEntries(Object.keys(sc.packages).map((n) => [n, "^1.0.0"])) }, ...Object.fromEntries(Object.entries(sc.packages).map(([n, s]) => [`node_modules/${n}`, pkg(n, s)])) } }));
        if (sc.failResolve) return done({ exit: 1, stderr: "E404 not found" });
        return done();
      }
      if (sub === "view") {
        const [name] = spec.argv[2]!.split(/@(?=\d)/);
        const s = sc.packages[name!];
        return done({ stdout: s?.ageDays === undefined ? "{}" : JSON.stringify({ [s.version ?? "1.0.0"]: new Date(Date.now() - s.ageDays * 864e5).toISOString() }) });
      }
      if (sub === "ci") writeFileSync(join(p.root, "node_modules-installed"), "1");
      return done();
    },
  };
  const guards = new Map<string, (spawn: () => Promise<RunResult>) => Promise<RunResult>>();
  const runner: Runner = {
    guardRun: (dir, admit) => { guards.set(dir, admit); },
    stopRun: dir => base.runner.stopRun(dir),
    run: spec => guards.has(spec.runDir) ? guards.get(spec.runDir)!(() => simulated.run(spec)) : simulated.run(spec),
  };
  const ports = { ...base, runner };
  const call = (verb: string, input: Record<string, unknown> = {}) => runVerb(ports, VERBS, verb, input);
  return { p, call, calls, read: (f: string) => (existsSync(join(p.root, f)) ? readFileSync(join(p.root, f), "utf8") : null), state: () => p.ports().store.read()!.state };
}
const open = async (t: ReturnType<typeof setup>) => (await t.call("open", { profile: "feature", request: "add a library", scopePaths: ["src/greet.ts"] })).handle!;
const ask = (specs: string[], extra: Record<string, unknown> = {}) => ({ kind: "dependency", propose: { specs }, quote: "please add left-pad", ...extra });
const confirm = { "dependency-confirm": "confirm" };
const ran = (t: ReturnType<typeof setup>, ...prefix: string[]) => t.calls.some((c) => prefix.every((x, i) => c[i + 1] === x));

describe("verifying before installing [SEC-05]", () => {
  it("resolves without installing, previews what changes, and installs only after the answer", async () => {
    const t = setup({ packages: { "left-pad": { ageDays: 90 } } });
    const h = await open(t);
    const pre = await t.call("decide", { h, ...ask(["left-pad@1.0.0"]) });
    assert.equal(pre.exit, 3, JSON.stringify(pre));
    assert.equal(pre.questions![0]!.id, "dependency-confirm");
    assert.match(pre.questions![0]!.question, /left-pad@1\.0\.0/);
    assert.ok(ran(t, "install", "--package-lock-only", "--ignore-scripts"), "resolved with scripts off");
    assert.equal(ran(t, "ci"), false, "nothing installed before the answer");
    assert.match(t.read("package-lock.json")!, /left-pad/);

    const done = await t.call("decide", { h, kind: "dependency", answers: confirm });
    assert.equal(done.exit, 0, JSON.stringify(done));
    assert.ok(ran(t, "ci", "--ignore-scripts"), JSON.stringify(t.calls));
    const w = Object.values(t.state().work)[0]!;
    assert.deepEqual(w.grants.find((g) => g.actions.includes("dependency"))!.paths, ["package.json", "package-lock.json"]);
    assert.equal(w.grants.find((g) => g.actions.includes("dependency"))!.quote, "please add left-pad");
    assert.equal(w.dependency, undefined);
    assert.ok(["package.json", "package-lock.json"].every((f) => w.touched.some((x) => x.path === f)));
  });

  it("restores both files and installs nothing when a package is younger than the policy allows", async () => {
    const t = setup({ packages: { fresh: { ageDays: 1 } } });
    const h = await open(t);
    await t.call("decide", { h, kind: "config", target: "dependency_policy", propose: { value: { min_release_age_days: 14 } } });
    const before = t.read("package.json");
    const r = await t.call("decide", { h, ...ask(["fresh@1.0.0"]) });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.equal(r.reasons[0]!.code, "dependency-rejected");
    assert.match(r.reasons[0]!.message, /1 days.*14/);
    assert.equal(t.read("package.json"), before);
    assert.equal(t.read("package-lock.json"), null, "the lockfile that did not exist is removed again");
    assert.equal(ran(t, "ci"), false);
  });

  it("a package with an install script is previewed by name, and its script runs only when named in the answer", async () => {
    const t = setup({ packages: { sharp: { ageDays: 90, script: true } } });
    const h = await open(t);
    const pre = await t.call("decide", { h, ...ask(["sharp@1.0.0"]) });
    assert.match(pre.questions![0]!.question, /sharp@1\.0\.0.*install script/);
    await t.call("decide", { h, kind: "dependency", answers: confirm });
    assert.equal(ran(t, "rebuild"), false, "consent to the install is not consent to the script");

    const t2 = setup({ packages: { sharp: { ageDays: 90, script: true } } });
    const h2 = await open(t2);
    await t2.call("decide", { h: h2, ...ask(["sharp@1.0.0"]) });
    const ok = await t2.call("decide", { h: h2, kind: "dependency", answers: { ...confirm, "dependency-scripts": "sharp@1.0.0" } });
    assert.equal(ok.exit, 0, JSON.stringify(ok));
    assert.ok(t2.calls.some((c) => c[1] === "rebuild" && c[2] === "sharp"));
    const bad = setup({ packages: { sharp: { ageDays: 90, script: true } } });
    const h3 = await open(bad);
    await bad.call("decide", { h: h3, ...ask(["sharp@1.0.0"]) });
    assert.equal((await bad.call("decide", { h: h3, kind: "dependency", answers: { ...confirm, "dependency-scripts": "other@9.9.9" } })).exit, 2, "only a script the preview named can be approved");
  });

  it("declining restores the files", async () => {
    const t = setup({ packages: { a: { ageDays: 90 } } });
    const h = await open(t);
    const before = t.read("package.json");
    await t.call("decide", { h, ...ask(["a@1.0.0"]) });
    const r = await t.call("decide", { h, kind: "dependency", answers: { "dependency-confirm": "decline" } });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(t.read("package.json"), before);
    assert.equal(t.read("package-lock.json"), null);
    assert.equal(ran(t, "ci"), false);
  });

  it("asks again, and installs nothing, when the files changed after the preview", async () => {
    const t = setup({ packages: { a: { ageDays: 90 } } });
    const h = await open(t);
    await t.call("decide", { h, ...ask(["a@1.0.0"]) });
    writeFileSync(join(t.p.root, "package.json"), '{"name":"fx","edited":true}\n');
    const r = await t.call("decide", { h, kind: "dependency", answers: confirm });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.equal(ran(t, "ci"), false);
  });

  it("refuses what it cannot check: a pnpm project, a flag as a spec, and a failed resolution that leaves the files alone", async () => {
    const pn = setup({ packages: { a: {} } }, { "pnpm-lock.yaml": "lockfileVersion: 9\n" });
    const h = await open(pn);
    const r = await pn.call("decide", { h, ...ask(["a@1.0.0"]) });
    assert.equal(r.reasons[0]!.code, "capability-missing");
    assert.match(r.reasons[0]!.message, /pnpm/);
    assert.equal(pn.calls.length, 0);

    const t = setup({ packages: { a: {} } });
    const h2 = await open(t);
    assert.equal((await t.call("decide", { h: h2, ...ask(["--registry=http://evil.example"]) })).exit, 2);
    assert.equal(t.calls.length, 0);

    const f = setup({ packages: { a: {} }, failResolve: true });
    const h3 = await open(f);
    const before = f.read("package.json");
    const fr = await f.call("decide", { h: h3, ...ask(["a@1.0.0"]) });
    assert.equal(fr.exit, 2, JSON.stringify(fr));
    assert.equal(f.read("package.json"), before);
    assert.equal(f.read("package-lock.json"), null);
  });

  it("rolls back an interrupted dependency resolution on recovery [CON-03, SEC-05]", async () => {
    const t = setup({ packages: { a: { ageDays: 90 } } });
    const h = await open(t);
    const before = t.read("package.json")!;
    const ports = t.p.ports();
    const w = Object.values(t.state().work)[0]!;
    const blob = ports.store.putBlob(before);
    await ports.store.transaction("dependency", async (tx) => {
      tx.intent("dependency", "d-crash", { work: w.id, phase: "resolve", before: { manifest: blob, lock: null } });
    });
    writeFileSync(join(t.p.root, "package.json"), '{"name":"corrupted"}\n');
    writeFileSync(join(t.p.root, "package-lock.json"), '{"lockfileVersion":3}\n');
    const r = await t.call("decide", { h, kind: "config", target: "style", propose: { value: "concise" } });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.ok(r.effects?.completed.some((e) => /interrupted dependency resolution was rolled back/.test(e)));
    assert.equal(t.read("package.json"), before);
    assert.equal(t.read("package-lock.json"), null);
  });

  it("needs the user's words, like any grant", async () => {
    const t = setup({ packages: { a: { ageDays: 90 } } });
    const h = await open(t);
    const r = await t.call("decide", { h, kind: "dependency", propose: { specs: ["a@1.0.0"] } });
    assert.equal(r.reasons[0]!.code, "authority-needed");
    assert.equal(t.calls.length, 0);
  });

  it("an unknown publish age follows the project's unknown_age rule", async () => {
    const t = setup({ packages: { a: {} } }); // no publish date comes back
    const h = await open(t);
    const pre = await t.call("decide", { h, ...ask(["a@1.0.0"]) });
    assert.equal(pre.exit, 3);
    assert.match(pre.questions![0]!.question, /no publish date/);
    await t.call("decide", { h, kind: "dependency", answers: { "dependency-confirm": "decline" } });
    await t.call("decide", { h, kind: "config", target: "dependency_policy", propose: { value: { unknown_age: "deny" } } });
    assert.equal((await t.call("decide", { h, ...ask(["a@1.0.0"], { again: true }) })).exit, 2);
  });
});
