// Dependency verification before anything installs (SEC-05, TS §9.11): the lockfile diff and the policy check. Pure.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diffLockfile, judgeDependencies } from "../src/core/dependencies.ts";
import type { Observation } from "../src/core/dependencies.ts";

const pkg = (version: string, over: Record<string, unknown> = {}) => ({ version, resolved: `https://registry.npmjs.org/x/-/x-${version}.tgz`, integrity: "sha512-abc", license: "MIT", ...over });
const lock = (packages: Record<string, unknown>, root: Record<string, unknown> = { dependencies: { a: "^1.0.0" } }) => JSON.stringify({ lockfileVersion: 3, packages: { "": root, ...packages } });
const POLICY = { min_release_age_days: 14, urgent_exception: "require-approval", unknown_age: "require-approval" } as const;

describe("the lockfile diff [SEC-05]", () => {
  it("lists new and changed packages, direct or transitive, and what went away", () => {
    const before = lock({ "node_modules/a": pkg("1.0.0"), "node_modules/old": pkg("1.0.0") });
    const after = lock({ "node_modules/a": pkg("1.1.0"), "node_modules/b": pkg("2.0.0"), "node_modules/a/node_modules/c": pkg("3.0.0") }, { dependencies: { a: "^1.0.0", b: "^2.0.0" } });
    const d = diffLockfile(before, after);
    assert.deepEqual(d.added.map((o) => [o.name, o.version, o.direct]), [["b", "2.0.0", true], ["c", "3.0.0", false]]);
    assert.deepEqual(d.changed.map((o) => [o.name, o.previous, o.version]), [["a", "1.0.0", "1.1.0"]]);
    assert.deepEqual(d.removed, ["old"]);
  });
  it("treats everything as added when there was no lockfile", () => {
    assert.equal(diffLockfile(null, lock({ "node_modules/a": pkg("1.0.0") })).added.length, 1);
  });
  it("reports install-script evidence, a missing license and the source kind of each package", () => {
    const d = diffLockfile(null, lock({
      "node_modules/s": pkg("1.0.0", { hasInstallScript: true }),
      "node_modules/g": { version: "1.0.0", resolved: "git+https://github.com/x/g.git#abc" },
      "node_modules/l": { link: true, resolved: "packages/l" },
      "node_modules/n": pkg("1.0.0", { license: undefined }),
    }));
    const by = Object.fromEntries(d.added.map((o) => [o.name, o]));
    assert.equal(by.s!.hasInstallScript, true);
    assert.deepEqual([by.g!.source, by.l!.source, by.s!.source], ["git", "link", "registry"]);
    assert.equal(by.n!.license, undefined);
  });
  it("rejects a lockfile it cannot read rather than guessing", () => {
    assert.throws(() => diffLockfile(null, "{ not json"), /lockfile/);
    assert.throws(() => diffLockfile(null, JSON.stringify({ lockfileVersion: 1 })), /lockfileVersion/);
  });
});

describe("judging the diff against the policy [SEC-05, dependency_policy]", () => {
  const obs = (name: string, over: Partial<Observation> = {}): Observation => ({ key: `node_modules/${name}`, name, version: "1.0.0", direct: true, source: "registry", resolved: "https://registry.npmjs.org/x", hasInstallScript: false, license: "MIT", ...over });
  const j = (o: Observation[], ages: Record<string, number | undefined>, over: Partial<Parameters<typeof judgeDependencies>[2]> = {}) => judgeDependencies(o, ages, { policy: { ...POLICY }, urgent: false, ...over });

  it("passes a package old enough, with no scripts and a known license", () => {
    const r = j([obs("a")], { "a@1.0.0": 30 });
    assert.deepEqual([r.verdict, r.issues.length], ["ok", 0]);
  });
  it("blocks a package younger than the cooldown and names both numbers", () => {
    const r = j([obs("a")], { "a@1.0.0": 2 });
    assert.equal(r.verdict, "blocked");
    assert.match(r.issues[0]!.message, /2 days.*14/);
  });
  it("lets the urgent exception follow the policy: require-approval asks, deny blocks, allow passes with a note", () => {
    assert.equal(j([obs("a")], { "a@1.0.0": 2 }, { urgent: true }).verdict, "needs-decision");
    assert.equal(j([obs("a")], { "a@1.0.0": 2 }, { urgent: true, policy: { ...POLICY, urgent_exception: "deny" } }).verdict, "blocked");
    const allow = j([obs("a")], { "a@1.0.0": 2 }, { urgent: true, policy: { ...POLICY, urgent_exception: "allow" } });
    assert.deepEqual([allow.verdict, allow.issues.some((i) => i.severity === "note")], ["ok", true]);
  });
  it("an unknown publish age follows unknown_age and is never treated as verified", () => {
    assert.equal(j([obs("a")], {}).verdict, "needs-decision");
    assert.equal(j([obs("a")], {}, { policy: { ...POLICY, unknown_age: "deny" } }).verdict, "blocked");
    assert.equal(j([obs("a")], {}, { policy: { ...POLICY, unknown_age: "allow" } }).verdict, "ok");
  });
  it("a package with an install script needs consent that names the package and version", () => {
    const r = j([obs("s", { hasInstallScript: true })], { "s@1.0.0": 30 });
    assert.equal(r.verdict, "needs-decision");
    assert.deepEqual(r.scripts, ["s@1.0.0"]);
  });
  it("a git, link or unknown source is unverifiable and needs an explicit decision", () => {
    for (const source of ["git", "file", "link", "unknown"] as const) assert.equal(j([obs("g", { source })], {}).verdict, "needs-decision", source);
  });
  it("checks the license against the allowed list when there is one", () => {
    const r = j([obs("a", { license: "GPL-3.0" }), obs("b", { license: undefined })], { "a@1.0.0": 30, "b@1.0.0": 30 }, { allowedLicenses: ["MIT", "ISC"] });
    assert.equal(r.verdict, "blocked");
    assert.ok(r.issues.some((i) => i.kind === "license" && i.severity === "blocked" && /GPL/.test(i.message)));
    assert.ok(r.issues.some((i) => i.kind === "license" && i.severity === "decision" && /b@1.0.0/.test(i.message)));
  });
  it("the worst finding sets the verdict", () => {
    assert.equal(j([obs("a"), obs("s", { hasInstallScript: true })], { "a@1.0.0": 1, "s@1.0.0": 30 }).verdict, "blocked");
  });
});
