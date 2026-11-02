import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { createStack, normalize, normalizeStatic } from "../src/adapters/node-ts.ts";
import { normalizePlaywright } from "../src/adapters/playwright.ts";

type Tool = "vitest" | "playwright" | "eslint" | "tsc";
const root = resolve("report-workspace");
const tools: Tool[] = ["vitest", "playwright", "eslint", "tsc"];

function admitted(tool: Tool, file: string, workspace = root): { invalid: boolean; files: string[] } {
  if (tool === "tsc" || tool === "eslint") {
    const raw = tool === "tsc" ? `${file}(1,1): error TS2322: incompatible type\n`
      : JSON.stringify([{ filePath: file, messages: [], errorCount: 0, warningCount: 0 }]);
    const result = normalizeStatic(tool, { exit: tool === "tsc" ? 2 : 0, raw }, workspace);
    return { invalid: result.status === "invalid",
      files: tool === "tsc" ? result.failures.map(failure => failure.test) : result.files ?? [] };
  }
  const raw = tool === "vitest"
    ? JSON.stringify({ testResults: [{ name: file, status: "passed", assertionResults: [{ fullName: "one", status: "passed" }] }] })
    : JSON.stringify({
      suites: [{ file, title: "suite", specs: [{ title: "one", ok: true, tests: [{ status: "expected", results: [{ status: "passed" }] }] }] }],
      stats: { expected: 1, skipped: 0, unexpected: 0, flaky: 0 },
    });
  const result = tool === "vitest" ? normalize(raw, workspace) : normalizePlaywright(raw, workspace);
  return { invalid: result.invalid !== undefined, files: [...result.files.keys()] };
}

describe("report file identity admission [EVD-05]", () => {
  for (const tool of tools) {
    it(`${tool} rejects the workspace directory and every outside file identity`, () => {
      const outside = ["", ".", root, join("src", ".."), join("..", "outside.ts"), resolve(root, "..", "outside.ts"), "bad\0.ts"];
      if (process.platform === "win32") outside.push(`${root.startsWith("C:") ? "D:" : "C:"}\\outside.ts`);
      for (const file of outside) {
        assert.deepEqual(admitted(tool, file), { invalid: true, files: [] }, `${tool}: ${JSON.stringify(file)}`);
      }
    });

    it(`${tool} uses canonical relative identities for native in-workspace paths`, () => {
      for (const file of [join("src", "a.ts"), join(root, "src", "a.ts")]) {
        const result = admitted(tool, file);
        assert.equal(result.invalid, false, `${tool}: ${file}`);
        assert.deepEqual(result.files, [tool === "tsc" ? "src/a.ts:1" : "src/a.ts"]);
      }
      assert.deepEqual(admitted(tool, "src/./a.ts", ""), {
        invalid: false, files: [tool === "tsc" ? "src/a.ts:1" : "src/a.ts"],
      });
    });

    it(`${tool} refuses absolute and directory identities without a workspace`, () => {
      for (const file of [".", join("..", "outside.ts"), "src/../../outside.ts", join(root, "src", "a.ts")])
        assert.deepEqual(admitted(tool, file, ""), { invalid: true, files: [] }, `${tool}: ${file}`);
    });
  }

  it("normalizes the same compiler population with LF and CRLF line endings", () => {
    const lf = `${join(root, "src", "a.ts")}\n${join(root, "src", "b.ts")}\n`;
    const expected = { status: "pass", failures: [], files: ["src/a.ts", "src/b.ts"] };
    for (const raw of [lf, lf.replaceAll("\n", "\r\n")])
      assert.deepEqual(normalizeStatic("tsc", { exit: 0, raw }, root), expected);
  });

  it("invalidates earlier normalization identities rather than reusing their receipts [EVD-03]", () => {
    assert.notEqual(createStack().adapterVersion(), "node-ts@19");
  });
});
