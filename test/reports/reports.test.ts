import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { tmpRepo } from "../helpers/tmpRepo.ts";

const build = spawnSync(
  process.execPath,
  [
    "node_modules/typescript/bin/tsc",
    "--target", "ES2023",
    "--module", "NodeNext",
    "--moduleResolution", "NodeNext",
    "--strict",
    "--noUncheckedIndexedAccess",
    "--exactOptionalPropertyTypes",
    "--verbatimModuleSyntax",
    "--skipLibCheck",
    "--outDir", "dist",
    "--rootDir", "src",
    "src/reports/index.ts",
  ],
  { cwd: process.cwd(), encoding: "utf8" },
);
if (build.status !== 0) throw new Error(build.stderr || build.stdout);

const reports = await import("../../dist/reports/index.js");
const fixtures = path.join(
  "tenet",
  "packets",
  "CP-0041-spike-c-events-replay-and-performance",
  "evidence",
  "reports",
);

test("reads the captured JUnit and Jest reports", () => {
  const node = reports.readReport("junit", path.join(fixtures, "node.xml"));
  assert.equal(node.cases.length, 7);
  assert.equal(node.teardown_failed, true);
  assert.deepEqual(node.cases[0]?.tags, ["AB-1"]);
  assert.match(node.cases[4]?.full_name ?? "", /<tags> & "quotes"/);

  const vitest = reports.readReport("junit", path.join(fixtures, "vitest.xml"));
  assert.equal(vitest.cases.length, 11);
  assert.equal(vitest.teardown_failed, true);

  const pytest = reports.readReport("junit", path.join(fixtures, "pytest.xml"));
  assert.equal(pytest.cases.length, 6);
  assert.equal(pytest.teardown_failed, true);
  assert.equal(pytest.cases.find((item: { tags: string[] }) => item.tags.includes("AB-3"))?.status, "pass");

  const jest = reports.readReport("jest-json", path.join(fixtures, "jest.json"));
  assert.equal(jest.teardown_failed, true);
  assert.deepEqual(jest.cases.find((item: { tags: string[] }) => item.tags.includes("AB-5"))?.attempts, ["fail", "pass"]);
});

test("merges matrix shards, retries, tags and zero cases", async () => {
  const repository = await tmpRepo("report-matrix");
  try {
    await repository.write("a.json", JSON.stringify({
      results: { tests: [{ name: "[AB-1] works", status: "failed", extra: { tenet_cases: ["R-2"] } }] },
    }));
    await repository.write("b.json", JSON.stringify({
      results: { tests: [{ name: "[AB-1] works", status: "passed", duration: 4 }] },
    }));
    await repository.write("empty.xml", "<testsuites/>");
    await repository.write("a.xml", "<testsuites><testsuite><testcase name=\"[AB-2] matrix\"/></testsuite></testsuites>");
    await repository.write("b.xml", "<testsuites><testsuite><testcase name=\"[AB-2] matrix\" time=\"0.004\"/></testsuite></testsuites>");
    const merged = reports.readReport("ctrf", ["a.json", "b.json"], { cwd: repository.path });
    assert.equal(merged.cases.length, 1);
    assert.equal(merged.cases[0]?.status, "fail");
    assert.deepEqual(merged.cases[0]?.attempts, ["fail", "pass"]);
    assert.deepEqual(merged.cases[0]?.tags, ["AB-1", "R-2"]);
    assert.equal(merged.cases[0]?.duration_ms, 4);
    assert.equal(reports.readReport("junit", "a.xml", { cwd: repository.path }).cases[0]?.duration_ms, undefined);
    assert.equal(reports.readReport("junit", ["a.xml", "b.xml"], { cwd: repository.path }).cases[0]?.duration_ms, 4);
    assert.equal(reports.readReport("junit", "empty.xml", { cwd: repository.path }).inconclusive, true);
    assert.throws(
      () => reports.readReport("junit", "missing.xml", { cwd: repository.path }),
      (error: Error & { code?: string; fix?: string }) =>
        error.code === "TN-REPORT-MISSING" && typeof error.fix === "string",
    );
    await repository.write("unsafe.xml", "<!DOCTYPE testsuites><testsuites/>");
    assert.throws(() => reports.readReport("junit", "unsafe.xml", { cwd: repository.path }));
  } finally {
    await repository.cleanup();
  }
});

test("parses acceptance blocks deterministically", () => {
  const parsed = reports.parseAcceptance(
    "## Acceptance\nImplements: R-2, R-10\n- [AB-2]  two   spaces\n- duplicate\n- [AB-1] first\n- [AB-2] repeated\n",
  );
  assert.deepEqual(parsed.implements, ["R-10", "R-2"]);
  assert.deepEqual(parsed.items, [
    { id: "AB-1", text: "first" },
    { id: "AB-2", text: "two spaces" },
  ]);
  assert.deepEqual(parsed.problems.map((problem: { code: string }) => problem.code), [
    "TN-ACC-MISSING-ID",
    "TN-ACC-DUP-ID",
  ]);
  assert.match(parsed.digest, /^[0-9a-f]{64}$/);
});

test("matches declaration titles and computes item evidence", () => {
  const declaration = {
    tag: "AB-1",
    file: "a.test.ts",
    line: 1,
    name: "retries %i",
    raw_name: "[AB-1] retries %i",
    authorship: "written-here",
    via_describe: false,
  };
  const report = {
    runner: "junit",
    cases: [
      { full_name: "suite > [AB-1] retries 1", file: "a.test.ts", status: "pass", attempts: ["pass"], tags: ["AB-1"] },
      { full_name: "prefix retries 2", status: "skip", attempts: ["skip"], tags: [] },
    ],
    teardown_failed: false,
    inconclusive: false,
  };
  const result = reports.itemResults([{ id: "AB-1", text: "ignored" }], report, {
    acceptance: { "AB-1": [declaration] },
  })[0];
  assert.equal(result.result, "passed");
  assert.equal(result.coverage, "confirmed");
  assert.equal(result.tests.passed, 1);
  assert.equal(result.tests.skipped, 1);
  assert.equal("text" in result, false);
  const missing = reports.itemResults([{ id: "AB-2" }], report, {
    acceptance: {
      "AB-2": [
        declaration,
        { ...declaration, name: "not present", raw_name: "[AB-2] not present" },
      ],
    },
  })[0];
  assert.equal(missing.result, "not-run");
  assert.equal(missing.tests.not_run, 1);
});

test("scans tagged declarations, rename authorship and weakening", async () => {
  const repository = await tmpRepo("reports-git");
  try {
    await repository.write("a.test.ts", [
      "describe(\"[AB-9] suite\", () => {",
      "  it(\"[AB-1] old test\", () => {});",
      "  it(\"old untagged\", () => {});",
      "});",
      "it(\"outside old\", () => {});",
      "",
    ].join("\n"));
    await repository.write("go_test.go", "package x\nfunc TestOld(t *testing.T) {}\n");
    repository.git(["add", "."]);
    repository.git(["commit", "--quiet", "-m", "base"]);
    const base = repository.git(["rev-parse", "HEAD"]).trim();

    await repository.write("a.test.ts", [
      "describe(\"[AB-9] suite\", () => {",
      "  it(\"[AB-1] old test\", () => {});",
      "  it(\"[AB-2] old untagged\", () => {});",
      "  it(",
      "    \"[AB-3] multiline\",",
      "    () => {",
      "    });",
      "});",
      "it(\"[AB-4] outside old\", () => {});",
      "",
    ].join("\n"));
    await repository.write("go_test.go", "package x\nfunc TestNew(t *testing.T) {}\nfunc helper() {}\n");
    repository.git(["add", "."]);
    repository.git(["commit", "--quiet", "-m", "head"]);
    const head = repository.git(["rev-parse", "HEAD"]).trim();

    const scan = await reports.scanTests(head, { cwd: repository.path });
    assert.equal(scan.declarations.some((item: { kind: string }) => item.kind === "func"), true);
    assert.equal(scan.declarations.some((item: { raw_name: string }) => item.raw_name === "[AB-3] multiline"), true);
    const tags = await reports.declaredTags(base, head, "R", { cwd: repository.path });
    assert.equal(tags.acceptance["AB-2"]?.[0]?.authorship, "unknown");
    assert.equal(tags.acceptance["AB-1"], undefined);
    assert.equal(tags.acceptance["AB-3"]?.[0]?.name, "multiline");
    assert.equal(tags.acceptance["AB-4"]?.[0]?.authorship, "tag-added-here");
    const weak = await reports.weakening(base, head, { cwd: repository.path });
    assert.equal(weak.by.find((item: { finding: string }) => item.finding === "removed-tests")?.names[0], "TestOld");
  } finally {
    await repository.cleanup();
  }
});

test("recognizes all declaration forms and skip patterns", async () => {
  const { scanText } = await import("../../dist/reports/scan.js");
  const scan = scanText("forms.test.ts", [
    "it(\"[AB-1] one\", () => {});",
    "test.each([1])(\"[AB-2] value %i\", () => {});",
    "@Test",
    "void javaCase() {}",
    "#[test]",
    "fn rust_case() {}",
    "t.Run(\"case\", func(t *T) {})",
    "def test_python():",
    "  record_property(\"tenet.case\", \"AB-3\")",
    "func TestGo(t *testing.T) {}",
    "it.skip(\"skip me\", () => {});",
  ].join("\n"));
  assert.deepEqual(scan.declarations.map((item: { kind: string }) => item.kind), [
    "it", "test.each", "@Test", "#[test]", "t.Run", "def", "func",
  ]);
  assert.equal(scan.declarations.find((item: { kind: string }) => item.kind === "def")?.tags.includes("AB-3"), true);
  assert.equal(scan.skips[0]?.pattern, ".skip(");
});

test("does not infer body tags from comments or strings", async () => {
  const { scanText } = await import("../../dist/reports/scan.js");
  const cases = [
    ["python_test.py", "def test_python():\n  # [AB-10] comment\n  value = \"[AB-11] string\"\n"],
    ["go_test.go", "package x\nfunc TestGo(t *testing.T) {\n  value := \"[AB-12] string\"\n  // [AB-13] comment\n}\n"],
    ["ExampleTest.java", "@Test\nvoid javaCase() {\n  String value = \"[AB-14] string\";\n  // [AB-15] comment\n}\n"],
    ["tests/example.rs", "#[test]\nfn rust_case() {\n  let value = \"[AB-16] string\";\n  // [AB-17] comment\n}\n"],
  ] as const;
  for (const [file, source] of cases) {
    const declaration = scanText(file, source).declarations[0];
    assert.deepEqual(declaration?.tags, [], file);
  }
  assert.deepEqual(
    scanText("test_name.py", "def test_valid_tenet_AB_8():\n  pass\n").declarations[0]?.tags,
    ["AB-8"],
  );

  const recognized = scanText(
    "test_valid.py",
    "def test_valid():\n  record_property(\"tenet.case\", \"AB-3 R-4\")  # [AB-9] comment\n",
  ).declarations[0];
  assert.deepEqual(recognized?.tags, ["AB-3", "R-4"]);
});

test("tag and weakening APIs default options from the current repository", async () => {
  const tags = await reports.declaredTags("HEAD", "HEAD", "R");
  const weak = await reports.weakening("HEAD", "HEAD");
  assert.deepEqual(tags, { acceptance: {}, requirement: {} });
  assert.deepEqual(weak, {
    found: false,
    by: [],
    notes: [],
    not_checked: [],
  });
});

test("weakening ignores init deletion and moves but notes consolidation", async () => {
  const repository = await tmpRepo("reports-weakening");
  try {
    await repository.write("source.ts", "init(\"fixture\");\n");
    await repository.write("move.test.ts", "it(\"moves\", () => {});\n");
    await repository.write("many.test.ts", [
      "it(\"one\", () => {});",
      "it(\"two\", () => {});",
      "it(\"three\", () => {});",
      "",
    ].join("\n"));
    repository.git(["add", "."]);
    repository.git(["commit", "--quiet", "-m", "base"]);
    const base = repository.git(["rev-parse", "HEAD"]).trim();

    await repository.write("source.ts", "export const initialized = true;\n");
    repository.git(["mv", "move.test.ts", "moved.test.ts"]);
    await repository.write("many.test.ts", [
      "it.each([\"one\", \"two\", \"three\"])(\"%s\", () => {});",
      "",
    ].join("\n"));
    repository.git(["add", "."]);
    repository.git(["commit", "--quiet", "-m", "head"]);
    const head = repository.git(["rev-parse", "HEAD"]).trim();
    const weak = await reports.weakening(base, head, { cwd: repository.path });
    assert.equal(weak.found, false);
    assert.deepEqual(weak.notes, [{ note: "tests-consolidated", file: "many.test.ts", names: ["one", "two", "three"] }]);
  } finally {
    await repository.cleanup();
  }
});

test("weakening tracks multiline titles across removals and renames", async () => {
  const repository = await tmpRepo("reports-multiline-removal");
  try {
    await repository.write("move.test.ts", [
      "it(",
      "  \"moves between files\",",
      "  () => {}",
      ");",
      "",
    ].join("\n"));
    await repository.write("change.test.ts", [
      "it(",
      "  \"removed multiline title\",",
      "  () => {}",
      ");",
      "",
    ].join("\n"));
    repository.git(["add", "."]);
    repository.git(["commit", "--quiet", "-m", "base"]);
    const base = repository.git(["rev-parse", "HEAD"]).trim();

    repository.git(["mv", "move.test.ts", "moved.test.ts"]);
    await repository.write("change.test.ts", [
      "it(",
      "  \"replacement title\",",
      "  () => {}",
      ");",
      "",
    ].join("\n"));
    repository.git(["add", "."]);
    repository.git(["commit", "--quiet", "-m", "head"]);
    const head = repository.git(["rev-parse", "HEAD"]).trim();

    const weak = await reports.weakening(base, head, { cwd: repository.path });
    assert.deepEqual(weak.by, [{
      finding: "removed-tests",
      file: "change.test.ts",
      names: ["removed multiline title"],
    }]);
    assert.equal(weak.by.some((item: { names: string[] }) => item.names.includes("moves between files")), false);
  } finally {
    await repository.cleanup();
  }
});
