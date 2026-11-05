// `decide dependency`: resolve without installing, verify, preview, then install (SEC-05, TS §9.11). npm is a fake that
// writes the lockfile the way a resolution would; the policy, the lockfile diff and the file restoration are the real ones.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, tmp, write } from "./helpers.ts";
import { fakeRecipes, portsWith, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import type { Runner, RunResult, RunSpec, Tx } from "../src/ports/types.ts";
import { sha256 } from "../src/core/ids.ts";
import { emptyState } from "../src/core/state.ts";
import { SETTLE, type Recovery } from "../src/verbs/recover-effects.ts";

const roots: string[] = [];
after(() => { for (const r of roots) cleanup(r); });

interface Scenario { packages: Record<string, { version?: string; ageDays?: number; script?: boolean; resolved?: string; license?: string }>; failResolve?: boolean }
const pkg = (name: string, s: Scenario["packages"][string]) => ({ version: s.version ?? "1.0.0", resolved: s.resolved ?? `https://registry.npmjs.org/${name}/-/${name}-1.0.0.tgz`, integrity: "sha512-x", license: s.license ?? "MIT", ...(s.script ? { hasInstallScript: true } : {}) });
const pnpmLock = (sc: Scenario): string => {
  const names = Object.keys(sc.packages);
  const importer = names.map((n) => `      ${n}:\n        specifier: ^1.0.0\n        version: ${sc.packages[n]!.version ?? "1.0.0"}\n`).join("");
  const pkgs = names.map((n) => `  ${n}@${sc.packages[n]!.version ?? "1.0.0"}:\n    resolution: {integrity: sha512-x}\n`).join("\n");
  return `lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    dependencies:\n${importer}\npackages:\n\n${pkgs}`;
};

function setup(sc: Scenario, files: Record<string, string> = {}) {
  const p: Project = project(files);
  roots.push(p.root);
  const calls: string[][] = [];
  const base = portsWith(p.root, fakeRecipes());
  const done = (over: Partial<RunResult> = {}): RunResult => ({ exit: 0, timedOut: false, durationMs: 1, stdout: "", stderr: "", startedAt: "t", report: null, ...over });
  const simulated = {
    async run(spec: RunSpec): Promise<RunResult> {
      calls.push(spec.argv);
      const [tool, sub, flag] = spec.argv;
      if (tool === "npm" && sub === "install" && flag === "--package-lock-only") {
        writeFileSync(join(p.root, "package.json"), JSON.stringify({ name: "fx", type: "module", private: true, dependencies: Object.fromEntries(Object.keys(sc.packages).map((n) => [n, "^1.0.0"])) }));
        writeFileSync(join(p.root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": { dependencies: Object.fromEntries(Object.keys(sc.packages).map((n) => [n, "^1.0.0"])) }, ...Object.fromEntries(Object.entries(sc.packages).map(([n, s]) => [`node_modules/${n}`, pkg(n, s)])) } }));
        if (sc.failResolve) return done({ exit: 1, stderr: "E404 not found" });
        return done();
      }
      if (tool === "pnpm" && sub === "add" && flag === "--lockfile-only") {
        writeFileSync(join(p.root, "package.json"), JSON.stringify({ name: "fx", type: "module", private: true, dependencies: Object.fromEntries(Object.keys(sc.packages).map((n) => [n, "^1.0.0"])) }));
        writeFileSync(join(p.root, "pnpm-lock.yaml"), pnpmLock(sc));
        if (sc.failResolve) return done({ exit: 1, stderr: "ERR_PNPM_FETCH_404" });
        return done();
      }
      if (sub === "view") {
        const [name] = spec.argv[2]!.split(/@(?=\d)/);
        const s = sc.packages[name!];
        return done({ stdout: s?.ageDays === undefined ? "{}" : JSON.stringify({ [s.version ?? "1.0.0"]: new Date(Date.now() - s.ageDays * 864e5).toISOString() }) });
      }
      if (sub === "ci" || (tool === "pnpm" && sub === "install" && flag === "--frozen-lockfile")) writeFileSync(join(p.root, "node_modules-installed"), "1");
      return done();
    },
  };
  const guards = new Map<string, (spawn: () => Promise<RunResult>) => Promise<RunResult>>();
  const runner: Runner = {
    guardRun: (dir, admit) => { guards.set(dir, admit); },
    environmentNames: extra => ({ passed: Object.keys(extra ?? {}), dropped: [] }),
    planEnvelope: input => base.runner.planEnvelope(input),
    stopRun: dir => base.runner.stopRun(dir),
    allocatePort: () => base.runner.allocatePort(),
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

describe("interrupted resolution preserves unknown content [CON-03, SEC-05]", () => {
  const before = { manifest: sha256("original manifest"), lock: null };
  const intent = (manager: "npm" | "pnpm" = "npm", prior = before) =>
    ({ effect: "dependency", id: "interrupted", op: { work: "W1", phase: "resolve", manager, before: prior } });
  const fixture = (files: Record<string, string>, unreadable = false) => {
    const root = tmp("tenet-dependency-recovery-");
    roots.push(root);
    for (const [file, text] of Object.entries(files)) write(root, file, text);
    const base = portsWith(root, fakeRecipes()), outcomes: unknown[] = [], mutations: string[] = [];
    const forbidden = (): never => { throw new Error("recovery must not mutate project files or unrelated state"); };
    const state = emptyState("workspace", "tag");
    const tx: Tx = {
      state, recovered: false, ensure: forbidden, publish: forbidden, call: forbidden, intent: forbidden,
      result: (_effect, _id, outcome) => { outcomes.push(outcome); },
      unresolved: () => [], evict: forbidden, recent: () => [],
    };
    const r: Recovery = {
      ports: { ...base, project: {
        ...base.project,
        write: path => { mutations.push(path); forbidden(); },
        remove: paths => { mutations.push(...paths); forbidden(); },
        hashes: paths => { if (unreadable) throw new Error("unreadable postcondition"); return base.project.hashes(paths); },
      } },
      tx, state, completed: [], uncertain: [],
    };
    return { r, outcomes, mutations, text: (file: string) => existsSync(join(root, file)) ? readFileSync(join(root, file), "utf8") : null };
  };
  for (const manager of ["npm", "pnpm"] as const) {
    const lock = manager === "npm" ? "package-lock.json" : "pnpm-lock.yaml";
    it(`${manager}: preserves changed manifest and a new human lockfile on repeated recovery`, async () => {
      const f = fixture({ "package.json": "human manifest", [lock]: "human lockfile" });
      for (let retry = 0; retry < 2; retry++) await SETTLE.dependency!(f.r, intent(manager));
      assert.deepEqual(f.outcomes, [], "unknown output must not receive a settled result");
      assert.deepEqual(f.mutations, []);
      assert.equal(f.r.uncertain.length, 2);
      assert.deepEqual(f.r.completed, []);
      assert.equal(f.text("package.json"), "human manifest");
      assert.equal(f.text(lock), "human lockfile");
    });
    it(`${manager}: settles unchanged originals without project writes or a restoration claim`, async () => {
      const f = fixture({ "package.json": "original manifest" });
      await SETTLE.dependency!(f.r, intent(manager));
      assert.deepEqual(f.outcomes, [{ completed: false }]);
      assert.deepEqual(f.mutations, []);
      assert.deepEqual(f.r.uncertain, []);
      assert.match(f.r.completed[0]!, /unchanged/);
      assert.doesNotMatch(f.r.completed[0]!, /rolled back|restored/);
      assert.equal(f.text("package.json"), "original manifest");
      assert.equal(f.text(lock), null);
    });
  }
  it("preserves a partial restoration rather than changing the remaining lockfile", async () => {
    const f = fixture({ "package.json": "original manifest", "package-lock.json": "human lock" });
    await SETTLE.dependency!(f.r, intent());
    assert.deepEqual(f.outcomes, []);
    assert.deepEqual(f.mutations, []);
    assert.equal(f.r.uncertain.length, 1);
    assert.equal(f.text("package-lock.json"), "human lock");
  });
  it("leaves unreadable postconditions unresolved without aborting the recovery pass", async () => {
    const f = fixture({ "package.json": "original manifest" }, true);
    await SETTLE.dependency!(f.r, intent());
    assert.deepEqual(f.outcomes, []);
    assert.deepEqual(f.mutations, []);
    assert.equal(f.r.uncertain.length, 1);
    assert.deepEqual(f.r.completed, []);
  });
  it("reports a resolve intent without before-images as uncertain resolution, not an install", async () => {
    const f = fixture({ "package.json": "human manifest" });
    await SETTLE.dependency!(f.r, { effect: "dependency", id: "missing-before", op: { work: "W1", phase: "resolve", manager: "npm" } });
    assert.deepEqual(f.outcomes, []);
    assert.equal(f.r.uncertain.length, 1);
    assert.match(f.r.uncertain[0]!, /resolution/);
    assert.doesNotMatch(f.r.uncertain[0]!, /install scripts/);
  });
});

describe("verifying before installing [SEC-05]", () => {
  it("resolves without installing, previews what changes, and installs only after the answer", async () => {
    const t = setup({ packages: { "left-pad": { ageDays: 90 } } });
    const h = await open(t);
    const pre = await t.call("decide", { h, ...ask(["left-pad@1.0.0"]) });
    assert.equal(pre.exit, 3, JSON.stringify(pre));
    assert.equal(pre.questions![0]!.id, "dependency-confirm");
    assert.match(pre.questions![0]!.question, /left-pad@1\.0\.0/);
    assert.deepEqual(t.calls.find((args) => args[0] === "npm" && args[1] === "install"), ["npm", "install", "--package-lock-only", "--ignore-scripts", "--no-audit", "left-pad@1.0.0"]);
    assert.equal(ran(t, "ci"), false, "nothing installed before the answer");
    assert.match(t.read("package-lock.json")!, /left-pad/);

    const done = await t.call("decide", { h, kind: "dependency", answers: confirm });
    assert.equal(done.exit, 0, JSON.stringify(done));
    assert.deepEqual(t.calls.find((args) => args[0] === "npm" && args[1] === "ci"), ["npm", "ci", "--ignore-scripts", "--no-audit"]);
    const w = Object.values(t.state().work)[0]!;
    assert.deepEqual(w.grants.find((g) => g.actions.includes("dependency"))!.paths, ["package.json", "package-lock.json"]);
    assert.equal(w.grants.find((g) => g.actions.includes("dependency"))!.quote, "please add left-pad");
    assert.equal(w.dependency, undefined);
    assert.ok(["package.json", "package-lock.json"].every((f) => w.touched.some((x) => x.path === f)));
  });

  it("verifies a pnpm project the same way: resolves without installing, previews, and installs only after the answer", async () => {
    const t = setup({ packages: { "left-pad": { ageDays: 90 } } }, { "pnpm-lock.yaml": "lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    dependencies: {}\n\npackages:\n\n  placeholder@1.0.0:\n    resolution: {integrity: sha512-x}\n" });
    const h = await open(t);
    const pre = await t.call("decide", { h, ...ask(["left-pad@1.0.0"]) });
    assert.equal(pre.exit, 3, JSON.stringify(pre));
    assert.match(pre.questions![0]!.question, /left-pad@1\.0\.0/);
    assert.ok(ran(t, "add", "--lockfile-only", "--ignore-scripts"), "resolved with pnpm, scripts off");
    assert.equal(ran(t, "install", "--frozen-lockfile"), false, "nothing installed before the answer");
    assert.match(t.read("pnpm-lock.yaml")!, /left-pad/);

    const done = await t.call("decide", { h, kind: "dependency", answers: confirm });
    assert.equal(done.exit, 0, JSON.stringify(done));
    assert.ok(ran(t, "install", "--frozen-lockfile", "--ignore-scripts"), JSON.stringify(t.calls));
    const w = Object.values(t.state().work)[0]!;
    assert.deepEqual(w.grants.find((g) => g.actions.includes("dependency"))!.paths, ["package.json", "pnpm-lock.yaml"]);
    assert.equal(w.dependency, undefined);
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

  it("refuses what it cannot check: a yarn project, a flag as a spec, and a failed resolution that leaves the files alone", async () => {
    const yn = setup({ packages: { a: {} } }, { "yarn.lock": "# yarn lockfile v1\n" });
    const h = await open(yn);
    const r = await yn.call("decide", { h, ...ask(["a@1.0.0"]) });
    assert.equal(r.reasons[0]!.code, "capability-missing");
    assert.match(r.reasons[0]!.message, /yarn/);
    assert.equal(yn.calls.length, 0);

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

  it("fences an interrupted resolution with unknown content and never overwrites it [CON-03, SEC-05]", async () => {
    const t = setup({ packages: { a: { ageDays: 90 } } });
    const h = await open(t);
    const before = t.read("package.json")!;
    const ports = t.p.ports();
    const w = Object.values(t.state().work)[0]!;
    const blob = ports.store.putBlob(before);
    await ports.store.transaction("dependency", async (tx) => {
      tx.intent("dependency", "d-crash", { work: w.id, phase: "resolve", manager: "npm", before: { manifest: blob, lock: null } });
    });
    writeFileSync(join(t.p.root, "package.json"), '{"name":"corrupted"}\n');
    writeFileSync(join(t.p.root, "package-lock.json"), '{"lockfileVersion":3}\n');
    for (let retry = 0; retry < 2; retry++) {
      const r = await t.call("decide", { h, kind: "config", target: "style", propose: { value: "concise" } });
      assert.equal(r.exit, 2, JSON.stringify(r));
      assert.ok(r.reasons.some(reason => reason.code === "effect-uncertain"), JSON.stringify(r));
      assert.ok(r.effects?.uncertain.some(e => /dependency resolution/.test(e)));
      assert.equal(t.read("package.json"), '{"name":"corrupted"}\n');
      assert.equal(t.read("package-lock.json"), '{"lockfileVersion":3}\n');
      assert.equal(t.state().config.local.style, undefined, "dependent mutation remains fenced");
      assert.ok(ports.store.readLog().some(e => e.kind === "intent" && e.id === "d-crash"));
      assert.equal(ports.store.readLog().some(e => e.kind === "result" && e.id === "d-crash"), false);
    }
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
