import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ProcessRunner } from "../src/adapters/runner.ts";
import { systemClock } from "../src/adapters/system.ts";
import { cleanup, tmp } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = () => { const root = tmp(); roots.push(root); return root; };
const runner = () => new ProcessRunner(systemClock, { PATH: process.env.PATH });

describe("run-bound report admission [EVD-05]", () => {
  it("refuses a linked process record before spawn and preserves its target [SEC-06]", async () => {
    const root = fresh(), runDir = join(root, "run"), outside = join(root, "outside");
    mkdirSync(runDir); writeFileSync(outside, "preserve me"); symlinkSync(outside, join(runDir, "run.json"));
    await assert.rejects(runner().run({ argv: [process.execPath, "-e", "require('fs').writeFileSync('unexpected-spawn', 'bad')"], cwd: root, runDir, timeoutMs: 5000 }));
    assert.equal(readFileSync(outside, "utf8"), "preserve me");
    assert.equal(existsSync(join(root, "unexpected-spawn")), false);
  });
  it("stops the child if recording its process identity fails [NFR-04]", async () => {
    const root = fresh(), runDir = join(root, "run"); mkdirSync(join(runDir, "run.json"), { recursive: true });
    const result = runner().run({ argv: [process.execPath, "-e", "setTimeout(() => require('fs').writeFileSync('orphan-wrote', 'bad'), 250)"], cwd: root, runDir, timeoutMs: 5000 });
    await result.catch(() => undefined);
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.equal(existsSync(join(root, "orphan-wrote")), false);
  });
  it("refuses stale, symlinked, outside and oversized reports", async () => {
    for (const kind of ["stale", "link", "outside", "oversized"]) {
      const root = fresh(), runDir = join(root, "run"); mkdirSync(runDir);
      const report = join(kind === "outside" ? root : runDir, "report.json");
      if (kind === "link") { writeFileSync(join(root, "private"), "outside contents"); symlinkSync(join(root, "private"), report); }
      else { writeFileSync(report, kind === "oversized" ? "x".repeat(10 * 1024 * 1024 + 1) : "{}"); if (kind === "stale") utimesSync(report, 1, 1); }
      const result = await runner().run({ argv: [process.execPath, "-e", ""], cwd: root, runDir, report, timeoutMs: 5000 });
      assert.equal(result.exit, 0);
      assert.equal(result.report, null, kind);
    }
  });
  it("reads a fresh regular report written by the run inside its directory", async () => {
    const root = fresh(), runDir = join(root, "run"), report = join(runDir, "report.json");
    const result = await runner().run({ argv: [process.execPath, "-e", "require('fs').writeFileSync(process.argv[1], '{}')", report], cwd: root, runDir, report, timeoutMs: 5000 });
    assert.equal(result.exit, 0);
    assert.equal(result.report, "{}");
  });
});
