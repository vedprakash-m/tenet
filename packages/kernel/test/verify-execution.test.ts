import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { cleanup, tmp } from "./helpers.ts";
import { selectedFiles } from "../../../tools/test-runner.ts";
import { verifyReports } from "../../../tools/verify-execution.ts";

const inventory = {
  version: 1, root: "packages", patternSuffix: ".test.ts",
  lanes: {
    source: {
      exclude: ["packages/kernel/test/postbuild.test.ts"],
      requiredLeaves: ["packages/kernel/test/a.test.ts :: a"],
    },
    postbuild: { include: ["packages/kernel/test/postbuild.test.ts"], requiresBundle: true },
  },
};

function fixture() {
  const root = tmp("tenet-execution-");
  mkdirSync(join(root, "tools"), { recursive: true });
  mkdirSync(join(root, "packages/kernel/test"), { recursive: true });
  mkdirSync(join(root, "packages/eval/test"), { recursive: true });
  writeFileSync(join(root, "tools/test-inventory.json"), JSON.stringify(inventory));
  writeFileSync(join(root, "tools/test-baseline.json"), JSON.stringify({ version: 1, lanes: {
    source: [
      { key: "packages/eval/test/b.test.ts :: b", count: 1 },
      { key: "packages/kernel/test/a.test.ts :: a", count: 1 },
    ],
    postbuild: [],
  } }));
  writeFileSync(join(root, "packages/kernel/test/a.test.ts"), "test('a',()=>{});\n");
  writeFileSync(join(root, "packages/kernel/test/postbuild.test.ts"), "test('bundle',()=>{});\n");
  writeFileSync(join(root, "packages/eval/test/b.test.ts"), "test('b',()=>{});\n");
  const digest = createHash("sha256").update(JSON.stringify(inventory)).digest("hex");
  const report = (shard: string, files: string[], leaves: Array<{ key: string; file: string; status?: "pass" | "fail" | "skip" }>) => ({
    terminal: { success: true, counts: {} },
    leaves: leaves.map((leaf, index) => ({ status: "pass", id: `${leaf.file}:${index}`, ...leaf })),
    files: files.map((file) => ({ file })),
    identity: {
      schemaVersion: 1, lane: "source", inventorySha256: digest, shard, node: process.version, sourceFiles: files,
    },
  });
  return { root, digest, report };
}

describe("validation evidence population", () => {
  it("assigns build-dependent tests to a separate exact lane", () => {
    const { root } = fixture();
    try {
      assert.deepEqual(selectedFiles(root, "source"), [
        "packages/eval/test/b.test.ts",
        "packages/kernel/test/a.test.ts",
      ]);
      assert.deepEqual(selectedFiles(root, "postbuild"), ["packages/kernel/test/postbuild.test.ts"]);
    } finally { cleanup(root); }
  });

  it("accepts a complete non-overlapping shard union", () => {
    const f = fixture();
    try {
      writeFileSync(join(f.root, "one.json"), JSON.stringify(f.report("1/2", ["packages/eval/test/b.test.ts"],
        [{ key: "b", file: "packages/eval/test/b.test.ts" }])));
      writeFileSync(join(f.root, "two.json"), JSON.stringify(f.report("2/2", ["packages/kernel/test/a.test.ts"],
        [{ key: "a", file: "packages/kernel/test/a.test.ts" }])));
      assert.equal(verifyReports(f.root, "source", ["one.json", "two.json"]).length, 2);
    } finally { cleanup(f.root); }
  });

  it("admits one shard only when partial verification is explicit", () => {
    const f = fixture();
    try {
      writeFileSync(join(f.root, "one.json"), JSON.stringify(f.report("1/2", ["packages/eval/test/b.test.ts"],
        [{ key: "b", file: "packages/eval/test/b.test.ts" }])));
      assert.equal(verifyReports(f.root, "source", ["one.json"], false).length, 1);
      assert.throws(() => verifyReports(f.root, "source", ["one.json"]), /differs from lane/);
    } finally { cleanup(f.root); }
  });

  it("refuses file overlap, a missing leaf and a skipped required leaf", () => {
    const f = fixture();
    try {
      const files = ["packages/eval/test/b.test.ts", "packages/kernel/test/a.test.ts"];
      writeFileSync(join(f.root, "overlap.json"), JSON.stringify(f.report("1/2", files,
        files.map((file) => ({ key: file, file })))));
      assert.throws(() => verifyReports(f.root, "source", ["overlap.json", "overlap.json"]), /overlap/i);

      writeFileSync(join(f.root, "skip.json"), JSON.stringify(f.report("1/1", files,
        [{ key: "a", file: files[1]!, status: "skip" }, { key: "b", file: files[0]! }])));
      assert.throws(() => verifyReports(f.root, "source", ["skip.json"]), /non-passing/);
    } finally { cleanup(f.root); }
  });

  it("refuses a candidate that removes an ordinary leaf while retaining its file", () => {
    const f = fixture();
    try {
      const current = JSON.parse(readFileSync(join(f.root, "tools/test-inventory.json"), "utf8"));
      const text = JSON.stringify(current);
      assert.ok(text.includes("a.test.ts") === true, "critical leaf identity is retained in the protected inventory");
      const files = ["packages/eval/test/b.test.ts", "packages/kernel/test/a.test.ts"];
      writeFileSync(join(f.root, "missing.json"), JSON.stringify(f.report("1/1", files,
        [{ key: "b", file: files[0]! }])));
      assert.throws(() => verifyReports(f.root, "source", ["missing.json"]), /required leaves missing/);
    } finally { cleanup(f.root); }
  });
});
