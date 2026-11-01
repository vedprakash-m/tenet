import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { GREET_IMPL, GREET_TEST, project, reviewResult } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

describe("configuration attention requires a genuine vetted entry", () => {
  for (const mode of ["unvetted", "vetted-unchanged", "vetted-edited"]) {
    it(`reports ${mode} configuration honestly and requires disposition when changed [REV-03]`, async () => {
      const path = "vitest.config.ts", original = "export default {};\n";
      const p = project({ [path]: original, "src/greet.ts": GREET_IMPL, "src/greet.test.ts": GREET_TEST }); roots.push(p.root);
      const h = (await p.call("open", { profile: "refactor", request: "adjust test configuration", scopePaths: [path], lane: "quick" })).handle!;
      await p.call("decide", { h, kind: "basis", propose: {
        outcome: "the configured greeting test still passes", scopePaths: [path], elements: [
          { ref: "r", kind: "requirement", origin: "request", text: "preserve the greeting" },
          { ref: "e", kind: "example", origin: "request", of: "r", text: "Ada receives the greeting", test: "preservation", expect: "pass", testFile: "src/greet.test.ts" },
        ],
      } });
      const originalHash = p.ports().project.hashes([path])[path]!;
      p.write(path, "export default { test: { testTimeout: 4000 } };\n");
      if (mode !== "unvetted") await p.ports().store.transaction("fixture", async tx => {
        const w = Object.values(tx.state!.work)[0]!;
        const hash = mode === "vetted-unchanged" ? p.ports().project.hashes([path])[path]! : originalHash;
        tx.publish({ ...tx.state!, work: { ...tx.state!.work, [w.id]: { ...w, vetted: { [path]: hash } } } });
      });
      await p.call("check", { h, stage: "baseline", touched: [path] });
      const candidate = await p.call("check", { h, touched: [path] });
      assert.equal(candidate.exit, 0, JSON.stringify(candidate));
      const w = Object.values(p.ports().store.read()!.state.work)[0]!;
      const attention = w.attention.filter(item => item.path === path && item.pattern === "test or build configuration");
      assert.equal(attention.length, mode === "vetted-unchanged" ? 0 : 1, JSON.stringify(w.attention));
      if (mode !== "vetted-unchanged") {
        assert.equal(attention[0]!.disposition, undefined);
        const reviewed = await p.call("findings", { h, result: reviewResult(candidate.data as Record<string, any>, { attention: [] }) });
        assert.equal(reviewed.exit, 0, JSON.stringify(reviewed));
        const finished = await p.call("finish", { h, noCommit: true });
        assert.notEqual((finished.data as { endpoint?: string })?.endpoint, "checked-local");
        assert.ok(finished.reasons.some(r => r.code === "major-undisposed" && r.message.includes("test or build configuration")), JSON.stringify(finished));
      }
    });
  }
});
