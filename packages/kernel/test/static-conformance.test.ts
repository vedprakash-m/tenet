import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { createStack, normalizeStatic } from "../src/adapters/node-ts.ts";
import { cleanup, tmp } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, finishFixture, project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const root = "/project";
const lintFile = (filePath = "/project/src/a.ts", over: Record<string, unknown> = {}) => ({ filePath, messages: [], errorCount: 0, warningCount: 0, fatalErrorCount: 0, ...over });
const norm = (tool: "tsc" | "eslint", exit: number, raw: string) => normalizeStatic(tool, { exit, raw }, root);

describe("static report population and bounds", () => {
  it("does not accept a silent compiler as proof of a nonempty analyzed population [EVD-02, EVD-05]", () => {
    assert.equal(norm("tsc", 0, "").status, "invalid");
    assert.equal(norm("tsc", 0, "/deps/node_modules/typescript/lib/lib.es2023.d.ts\n").status, "invalid");
    assert.deepEqual(norm("tsc", 0, "/deps/node_modules/typescript/lib/lib.es2023.d.ts\n/project/src/a.ts\n").files, ["src/a.ts"]);
  });
  for (const raw of [
    "/project/src/a.ts\n/project/src/../src/a.ts\n", "/project/src/a.ts\n/outside/private.ts\n",
    "src/a.ts(1,1): error TS1: broken\nunrecognized truncated output\n",
    Array.from({ length: 2001 }, () => "src/a.ts(1,1): error TS1: broken\n").join(""),
    `src/a.ts(1,1): error TS1: ${"x".repeat(2001)}\n`,
    `src/a.ts(1,1): error TS1: broken\n ${"x".repeat(1000)}\n ${"x".repeat(1000)}\n`,
  ]) it(`rejects ambiguous, outside or unbounded TypeScript output ${raw.slice(0, 55)} [EVD-05]`, () => {
    assert.equal(norm("tsc", raw.includes("error TS") ? 2 : 0, raw).status, "invalid");
  });
  for (const files of [
    [lintFile(), lintFile("/project/src/../src/a.ts")], [lintFile("/outside/private.ts")],
    [lintFile("/project/node_modules/pkg/a.ts")],
    [lintFile(undefined, { warningCount: 1 })], [lintFile(undefined, { fatalErrorCount: 1 })],
    [lintFile(undefined, { messages: [{ severity: 1, message: "x", line: "wrong" }], warningCount: 1 })],
    [lintFile(undefined, { messages: [{ severity: 1, message: "x".repeat(2001) }], warningCount: 1 })],
    Array.from({ length: 2001 }, (_, i) => lintFile(`/project/src/${i}.ts`)),
  ]) it(`rejects malformed ESLint population ${JSON.stringify(files).slice(0, 95)} [EVD-05]`, () => {
    assert.equal(norm("eslint", 0, JSON.stringify(files)).status, "invalid");
  });
  it("records the unique relative analyzed files independently of bounded diagnostics [EVD-05]", () => {
    const r = norm("eslint", 0, JSON.stringify([lintFile(), lintFile("/project/src/b.ts")]));
    assert.equal(r.status, "pass"); assert.deepEqual(r.files, ["src/a.ts", "src/b.ts"]);
  });
});

describe("static adapter execution profile", () => {
  for (const config of [
    '{"extends":"./base.json"}', '{"compilerOptions":{"composite":true}}',
    '{"compilerOptions":{"tsBuildInfoFile":"human-cache"}}', '{/* opaque JSONC */"compilerOptions":{}}',
  ]) it(`refuses unimplemented TypeScript configuration before execution ${config} [EVD-05]`, () => {
    const p = project({ "tsconfig.json": config }); roots.push(p.root);
    assert.equal(createStack().staticArgv(p.root, "tsc", "/run/report"), null);
  });
  for (const tool of ["tsc", "eslint"] as const) it(`does not launch an unsupported ${tool} version [EVD-05]`, () => {
    const p = project(); roots.push(p.root); rmSync(join(p.root, "node_modules"));
    const pkg = tool === "tsc" ? "typescript" : "eslint";
    p.write(`node_modules/${pkg}/package.json`, '{"version":"99.0.0"}');
    p.write(`node_modules/${pkg}/${tool === "tsc" ? "bin/tsc" : "bin/eslint.js"}`, "process.exit(0)");
    assert.equal(createStack().staticArgv(p.root, tool, "/run/report"), null);
  });
  it("uses an explicit project, lists inputs and disables incremental writes on the real compiler [EVD-05, CON-09]", async () => {
    const p = project({ "tsconfig.json": '{"compilerOptions":{"incremental":true,"types":[],"skipLibCheck":true}}' }); roots.push(p.root);
    const runDir = tmp(); roots.push(runDir);
    p.write("tsconfig.tsbuildinfo", "human build info");
    const stack = createStack(), argv = stack.staticArgv(p.root, "tsc", join(runDir, "report"))!;
    assert.ok(argv.includes("--project")); assert.ok(argv.includes("--listFiles"));
    assert.deepEqual(argv.slice(argv.indexOf("--incremental"), argv.indexOf("--incremental") + 2), ["--incremental", "false"]);
    const out = await p.ports().runner.run({ argv, cwd: p.root, runDir, timeoutMs: 10000 });
    assert.equal(out.exit, 0, out.stdout + out.stderr);
    const result = stack.normalizeStatic("tsc", { exit: out.exit, raw: out.stdout }, p.root);
    assert.equal(result.status, "pass", JSON.stringify(result)); assert.ok(result.files!.includes("src/greet.ts"));
    assert.equal(readFileSync(join(p.root, "tsconfig.tsbuildinfo"), "utf8"), "human build info");
  });
  it("cannot turn an empty root with unchecked project references into a passing static receipt [EVD-01, EVD-05]", async () => {
    const p = project({ "tsconfig.json": '{"files":[],"references":[{"path":"./server"}]}', "server/tsconfig.json": '{"compilerOptions":{"composite":true}}', "server/bad.ts": 'export const n: number = "bad";' }); roots.push(p.root);
    p.write("tenet.policy.json", JSON.stringify({ required_checks: [{ id: "types", tool: "tsc", property: "project compiles" }] }));
    const h = (await p.call("open", { profile: "feature", request: "reference population", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST); await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    const r = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    const receipt = Object.values(p.ports().store.read()!.state.work)[0]!.receipts.find(x => x.obligation === "OB-types")!;
    assert.equal(receipt.status, "inconclusive", JSON.stringify(r));
    assert.ok(receipt.reasons.includes("not-executed"));
    const f = await finishFixture(p, { h, noCommit: true });
    assert.notEqual((f.data as any).endpoint, "checked-local");
  });
});
