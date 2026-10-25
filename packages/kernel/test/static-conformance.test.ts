import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, ftruncateSync, mkdirSync, openSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
  for (const operation of ["tool", "dependency"] as const) {
    for (const mode of ["overwrite-json", "short"] as const) {
      it(`${mode === "short" ? "accepts short reads of stable" : "refuses same-size changes to"} installed ${operation} metadata [SEC-06, EVD-03]`, () => {
        const p = project(); roots.push(p.root); rmSync(join(p.root, "node_modules"));
        const path = operation === "tool" ? "node_modules/vitest/package.json" : "node_modules/.package-lock.json";
        const text = operation === "tool" ? '{"version":"5.0.5","note":"a"}' : '{"lockfileVersion":3,"packages":{},"note":"a"}';
        p.write(path, text);
        const result = JSON.parse(execFileSync(process.execPath, [join(import.meta.dirname, "fixtures/race-project-read.ts"), p.root, mode, operation], { encoding: "utf8" }));
        if (mode === "short") assert.equal(result.value, operation === "tool" ? "5.0.5" : createHash("sha256").update(text).digest("hex"), JSON.stringify(result));
        else {
          assert.equal(result.code, "capability-missing", JSON.stringify(result));
          assert.equal(result.value, undefined);
          assert.equal(readFileSync(join(p.root, path), "utf8"), text.replace('"note":"a"', '"note":"b"'));
        }
      });
    }
  }
  for (const kind of ["oversized", "linked", "directory"] as const) {
    it(`does not turn ${kind} project package metadata into absence [SEC-06, SEC-14]`, () => {
      const p = project(); roots.push(p.root);
      const file = join(p.root, "package.json");
      if (kind === "oversized") {
        const descriptor = openSync(file, "w");
        try { ftruncateSync(descriptor, 20 * 1024 * 1024 + 1); }
        finally { closeSync(descriptor); }
      } else {
        rmSync(file);
        if (kind === "directory") mkdirSync(file);
        else {
          p.write("aliased-package.json", '{"type":"module"}');
          symlinkSync(join(p.root, "aliased-package.json"), file);
        }
      }
      assert.throws(() => createStack().detect(p.root), /exceeds|link|regular project file/i);
    });
  }
  for (const kind of ["oversized", "linked", "invalid-utf8", "deep"] as const) {
    it(`refuses ${kind} installed tool metadata before detecting a supported runner [SEC-06, SEC-14]`, () => {
      const p = project(); roots.push(p.root); rmSync(join(p.root, "node_modules"));
      const file = join(p.root, "node_modules/vitest/package.json");
      mkdirSync(join(file, ".."), { recursive: true });
      if (kind === "oversized") {
        const descriptor = openSync(file, "w");
        try { ftruncateSync(descriptor, 20 * 1024 * 1024 + 1); }
        finally { closeSync(descriptor); }
      } else if (kind === "linked") {
        p.write("tool-metadata.json", '{"version":"5.0.5"}');
        symlinkSync(join(p.root, "tool-metadata.json"), file);
      } else if (kind === "invalid-utf8") {
        writeFileSync(file, Buffer.concat([Buffer.from('{"version":"5.0.5","note":"'), Buffer.from([0xff]), Buffer.from('"}')]));
      } else p.write("node_modules/vitest/package.json", `{"version":"5.0.5","nested":${"[".repeat(65)}0${"]".repeat(65)}}`);
      assert.throws(() => createStack().detect(p.root), /metadata.*safely/i);
    });
  }
  it("binds installed dependency metadata even when tool versions do not change [EVD-03]", () => {
    const p = project(); roots.push(p.root); rmSync(join(p.root, "node_modules"));
    for (const [name, version] of [["vitest", "5.0.5"], ["typescript", "5.9.3"], ["eslint", "9.39.1"]]) {
      p.write(`node_modules/${name}/package.json`, JSON.stringify({ name, version }));
    }
    p.write("node_modules/.package-lock.json", JSON.stringify({ lockfileVersion: 3,
      packages: { "node_modules/typescript": { version: "5.9.3", integrity: "original" } } }));
    const stack = createStack(), before = stack.fingerprint(p.root);
    p.write("node_modules/.package-lock.json", JSON.stringify({ lockfileVersion: 3,
      packages: { "node_modules/typescript": { version: "5.9.3", integrity: "changed" } } }));
    const after = stack.fingerprint(p.root);
    assert.equal(after.tool, before.tool);
    assert.deepEqual(after.static, before.static);
    assert.notDeepEqual(after, before, "changed installed dependencies must invalidate evidence despite unchanged tool versions");
  });
  for (const data of ["{ broken", "null", "[]", '{"lockfileVersion":3}',
    '{"lockfileVersion":3,"packages":[]}', '{"lockfileVersion":0,"packages":{}}']) {
    it(`refuses malformed installed dependency metadata ${data} [EVD-03, SEC-06]`, () => {
      const p = project(); roots.push(p.root); rmSync(join(p.root, "node_modules"));
      p.write("node_modules/.package-lock.json", data);
      assert.throws(() => createStack().fingerprint(p.root), /dependency metadata.*safely/i);
    });
  }
  it("refuses linked, excluded and oversized installed dependency records [SEC-06, SEC-14]", () => {
    const p = project(); roots.push(p.root); rmSync(join(p.root, "node_modules"));
    mkdirSync(join(p.root, "node_modules"));
    const file = join(p.root, "node_modules/.package-lock.json"), stack = createStack();
    assert.equal(stack.fingerprint(p.root).dependencies, "absent");
    p.write("outside-lock.json", '{"lockfileVersion":3,"packages":{},"canary":"PRIVATE_DEPENDENCY_METADATA"}');
    symlinkSync(join(p.root, "outside-lock.json"), file);
    assert.throws(() => stack.fingerprint(p.root), /dependency metadata.*safely/i);
    rmSync(file);
    const descriptor = openSync(file, "w");
    try { ftruncateSync(descriptor, 20 * 1024 * 1024 + 1); }
    finally { closeSync(descriptor); }
    assert.throws(() => stack.fingerprint(p.root), /dependency metadata.*safely/i);
    stack.setExclusions([{ pattern: "node_modules/.package-lock.json", kinds: ["no-read"] }]);
    assert.throws(() => stack.fingerprint(p.root), /excludes stack metadata/i);
    stack.setExclusions([]);
    p.write("node_modules/.package-lock.json", '{"lockfileVersion":3,"packages":{},"canary":"PRIVATE_DEPENDENCY_METADATA"}');
    const fingerprint = stack.fingerprint(p.root);
    assert.match(fingerprint.dependencies!, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(fingerprint).includes("PRIVATE_DEPENDENCY_METADATA"), false);
    assert.equal(JSON.stringify(fingerprint).includes(p.root), false);
  });
  it("stales passing evidence after an ignored installed-record edit without changing source or tool versions [EVD-03]", async () => {
    const p = project({ "tsconfig.json": JSON.stringify({ compilerOptions: {
      strict: true, module: "NodeNext", skipLibCheck: true, types: [],
    }, include: ["src/greet.ts"] }) }); roots.push(p.root);
    rmSync(join(p.root, "node_modules")); mkdirSync(join(p.root, "node_modules"));
    for (const name of ["vitest", "typescript"]) {
      symlinkSync(join(import.meta.dirname, "../../../node_modules", name), join(p.root, "node_modules", name));
    }
    p.write("node_modules/.package-lock.json", '{"lockfileVersion":3,"packages":{},"generation":1}');
    p.write("tenet.policy.json", JSON.stringify({ required_checks: [{ id: "types", tool: "tsc", property: "project compiles" }] }));
    const h = (await p.call("open", { profile: "feature", request: "dependency evidence freshness", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST); await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    const work = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(work.receipts.find(receipt => receipt.obligation === "OB-types")?.status, "pass");
    const before = createStack().fingerprint(p.root), status = p.git("status", "--porcelain");
    p.write("node_modules/.package-lock.json", '{"lockfileVersion":3,"packages":{},"generation":2}');
    const after = createStack().fingerprint(p.root);
    assert.equal(after.tool, before.tool); assert.deepEqual(after.static, before.static);
    assert.equal(p.git("status", "--porcelain"), status);
    const why = await p.call("inspect", { h, view: "why" });
    assert.ok(why.reasons.some(reason => reason.code === "stale"), JSON.stringify(why));
    const finished = await finishFixture(p, { h, noCommit: true });
    assert.notEqual((finished.data as Record<string, unknown>)?.endpoint, "checked-local");
  });
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
