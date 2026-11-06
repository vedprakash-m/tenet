import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { releaseAge, releaseLookups } from "../src/core/dependency-admission.ts";
import type { Observation } from "../src/core/dependencies.ts";
const observation = (name: string, version = "1.0.0", source: Observation["source"] = "registry"): Observation => ({
  key: `node_modules/${name}`, name, version, direct: true, source, resolved: "https://registry.example/package.tgz", hasInstallScript: false,
});
describe("dependency release lookup population and evidence [SEC-05]", () => {
  it("looks up each registry version once, preserving distinct versions and scoped names", () => {
    const a = observation("a"), b = observation("@scope/a"), newer = observation("a", "2.0.0");
    assert.deepEqual(releaseLookups([a, { ...a, key: "node_modules/parent/node_modules/a" }, b, newer, b]), [a, b, newer]);
    assert.deepEqual(releaseLookups([observation("git", "1.0.0", "git"), observation("unknown", "1.0.0", "unknown")]), []);
  });
  it("applies the existing 50-lookup bound to unique versions rather than repeated install paths", () => {
    const a = observation("a");
    const unique = Array.from({ length: 60 }, (_, i) => observation(`p${i}`));
    assert.deepEqual(releaseLookups([...Array(60).fill(a), ...unique]), [a, ...unique.slice(0, 49)]);
  });
  it("never accepts stdout as age evidence after failed, interrupted or timed-out lookup", () => {
    const stdout = '{"1.0.0":"2020-01-01T00:00:00Z"}', now = Date.parse("2026-11-05T00:00:00Z");
    for (const result of [{ exit: 1, timedOut: false }, { exit: null, timedOut: false }, { timedOut: false }, { exit: 0, timedOut: true },
      { exit: 0, timedOut: false, signal: "SIGTERM" }, { exit: 0, timedOut: false, outputTruncated: true }]) {
      assert.equal(releaseAge({ ...result, stdout }, "1.0.0", now), undefined);
    }
    assert.equal(releaseAge({ exit: 0, timedOut: false, stdout }, "1.0.0", now), 2500);
  });
});
