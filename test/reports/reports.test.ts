import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { tmpRepo } from "../helpers/tmpRepo.ts";

// npm test builds dist once before any test runs; tests never compile into dist themselves,
// because a rebuild during the run races other test files importing from dist.

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
  assert.deepEqual(parsed.implements, ["R-2", "R-10"]);
  assert.deepEqual(parsed.items, [
    { id: "AB-2", text: "two   spaces" },
    { id: "AB-1", text: "first" },
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
  // Run in a clean repository so the result never depends on this project's own test files.
  const repository = await tmpRepo("reports-defaults");
  const previous = process.cwd();
  try {
    await repository.write("README.md", "clean\n");
    repository.git(["add", "."]);
    repository.git(["commit", "-m", "init"]);
    process.chdir(repository.path);
    const tags = await reports.declaredTags("HEAD", "HEAD", "R");
    const weak = await reports.weakening("HEAD", "HEAD");
    assert.deepEqual(tags, { acceptance: {}, requirement: {} });
    assert.deepEqual(weak, {
      found: false,
      by: [],
      notes: [],
      not_checked: [],
    });
  } finally {
    process.chdir(previous);
    await repository.cleanup();
  }
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


test("acceptance keeps first-seen order and text, even around mixed and shorter fences", () => {
  const original = reports.parseAcceptance([
    "~~~~~md", "~~~", "## Acceptance", "- [AB-8] ignored", "~~~~~",
    "## Acceptance", "Implements: R-2, R-10, R-2", "Implements: R-3, R-10",
    "* [x] [AB-2] two   spaces ", "\x60\x60\x60\x60md", "~~~", "\x60\x60\x60",
    "## Heading inside a fence", "- missing ID", "\x60\x60\x60\x60",
    "- [AB-1] first", "- [AB-2] repeated", "- missing ID", "## Done", "- [AB-9] ignored",
  ].join("\r\n"));
  const canonical = reports.parseAcceptance("### Acceptance\nImplements: R-10, R-2, R-3\n- [AB-1] first\n- [AB-2] two spaces");
  assert.deepEqual(original.implements, ["R-2", "R-10", "R-3"]);
  assert.deepEqual(original.items, [{ id: "AB-2", text: "two   spaces" }, { id: "AB-1", text: "first" }]);
  assert.equal(original.digest, canonical.digest);
  assert.deepEqual(original.problems, [
    { code: "TN-ACC-DUP-ID", severity: "error", rule: null, file: null, line: 17,
      message: "Duplicate acceptance item ID AB-2.", fix: "Renumber or remove the repeated AB-2 item." },
    { code: "TN-ACC-MISSING-ID", severity: "error", rule: null, file: null, line: 18,
      message: "Acceptance item needs an ID.", fix: "Prefix the item with [AB-<n>]." },
  ]);
});

test("identifier tags honor punctuation and both boundaries and strip separator artifacts", async () => {
  const { extractTags, stripTags } = await import("../../dist/reports/tags.js");
  assert.deepEqual(extractTags("suite > tenet_AB_1 tenet_P2_3 test_tenet_AB_4_suffix xtenet_AB_5 tenet_AB_6x [P2-7]", "P2"),
    ["P2-7", "AB-1", "P2-3", "AB-4"]);
  assert.deepEqual(extractTags("[R-1] tenet_R_2 tenet_AB_3", ""), ["AB-3"]);
  assert.deepEqual(extractTags("[CF-1] tenet_CF_2 tenet_AB_3", "CF"), ["AB-3"]);
  assert.equal(stripTags("_tenet_AB_1_test_retries__tenet_P2_3_once_", "P2"), "test_retries_once");
  assert.equal(stripTags("suite > tenet_AB_1 retries"), "suite > retries");
  assert.equal(stripTags("suite > tenet_AB_1_tenet_AB_2_retries"), "suite > retries");
  assert.equal(stripTags("abc_tenet_AB_1x"), "abc_tenet_AB_1x");
});

test("runner details follow JUnit, pytest, CTRF, Go and Jest report contracts", async () => {
  const repository = await tmpRepo("report-runner-details");
  const cwd = repository.path;
  try {
    await repository.write("nested.xml", [
      '<testsuite file="root.test.ts"><properties><property name="tenet.case" value="AB-9"/></properties>',
      '<testcase name="" classname="class only"/>',
      '<testcase name="again" time="0.002"><failure>failure</failure></testcase>',
      '<testsuite file="nested.test.ts"><undefined><testcase name="letter&#x41;&#66;" time="0.004">',
      '<wrapper><property name="tenet.case" value="AB-8"/></wrapper>',
      '<properties><property name="tenet.case" value="AB-2, [R-3]"/></properties>',
      '<error message=""><![CDATA[failed on teardown with <work>]]></error></testcase></undefined>',
      '<testcase name="again" time="0.003"/></testsuite>',
      '<testcase name="last"><failure>failed</failure><error>failed on teardown with fixture</error></testcase></testsuite>',
    ].join(""));
    const junit = reports.readReport("junit", "nested.xml", { cwd });
    assert.equal(junit.teardown_failed, true);
    assert.deepEqual(junit.cases, [
      { full_name: "class only", file: "root.test.ts", status: "pass", attempts: ["pass"], tags: [] },
      { full_name: "again", file: "root.test.ts", duration_ms: 5, status: "pass", attempts: ["fail", "pass"], tags: [] },
      { full_name: "letterAB", file: "nested.test.ts", duration_ms: 4, status: "pass", attempts: ["pass"], tags: ["AB-2", "R-3"] },
      { full_name: "last", file: "root.test.ts", status: "fail", attempts: ["fail"], tags: [] },
    ]);
    await repository.write("unnamed.xml", '<testsuites><testsuite><testcase name="" classname=""/></testsuite></testsuites>');
    assert.throws(() => reports.readReport("junit", "unnamed.xml", { cwd }), { code: "TN-REPORT-MALFORMED" });

    await repository.write("ctrf.json", JSON.stringify({ results: { tests: [
      { name: "case", status: "unknown", filePath: "right.ts", file: "wrong.ts", duration: 3.6 },
    ] } }));
    assert.deepEqual(reports.readReport("ctrf", "ctrf.json", { cwd }).cases[0], {
      full_name: "case", status: "skip", attempts: ["skip"], tags: [], file: "right.ts", duration_ms: 4,
    });

    await repository.write("go.ndjson", [
      { Package: "pkg", Test: "TestMain", Action: "pass" },
      { Package: "pkg", Test: "TestMain/child", Action: "fail", Elapsed: 0.002 },
      { Package: "pkg", Test: "TestMain/child", Action: "output", Elapsed: 1 },
      { Package: "pkg", Test: "TestMain/child", Action: "pass", Elapsed: 0.0046 },
      { Test: "TestAlone", Action: "skip" },
    ].map((entry) => JSON.stringify(entry)).join("\n"));
    assert.deepEqual(reports.readReport("go-test-json", "go.ndjson", { cwd }).cases, [
      { full_name: "pkg > TestMain/child", status: "pass", attempts: ["fail", "pass"], tags: [], duration_ms: 5 },
      { full_name: "TestAlone", status: "skip", attempts: ["skip"], tags: [] },
    ]);

    await repository.write("unknown.json", JSON.stringify({ testResults: [{ assertionResults: [{ fullName: "case", status: "unknown" }] }] }));
    assert.throws(() => reports.readReport("jest-json", "unknown.json", { cwd }), {
      code: "TN-REPORT-MALFORMED",
      message: "Test report unknown.json is not valid jest-json input.",
      fix: "Fix the jest-json report format, XML entity rules, or size/case limits for unknown.json.",
    });
    assert.throws(() => reports.readReport("unknown", [path.join(cwd, "a.json"), "folder\\b.json"], { cwd }), {
      message: "Test report a.json, folder/b.json is not valid unknown input.",
    });
    assert.throws(() => reports.readReport("junit", [], { cwd }), { message: "Test report [] was not found." });
    assert.throws(() => reports.readReport("junit", [path.join(cwd, "nested.xml"), path.join(cwd, "missing.xml")], { cwd }), {
      message: "Test report missing.xml was not found.",
    });
  } finally {
    await repository.cleanup();
  }
});

test("describe inherits only new tags and finds expression and comment-safe declaration ends", async () => {
  const before = 'describe("[AB-1] suite", () => {\n  it("[AB-1] already tagged", () => {});\n});\n';
  const after = `${[
    'describe("[AB-1] suite", () => {',
    '  it("[AB-1] already tagged", () => {});',
    '  it("expression", () =>',
    '    ({ brace: "}" })',
    '  );',
    '  it("[AB-2] block", () => {',
    '    // }',
    '    /* closing }',
    '       and opening { */',
    '    const braces = "{}";',
    '  });',
    '});',
    'it("outside", () => {});',
  ].join("\n")}\n`;
  await withDiff({ "value.test.ts": before }, { "value.test.ts": after }, async (base, head, cwd) => {
    const scan = await reports.scanTests(head, { cwd });
    assert.deepEqual(scan.declarations.map((d: { name: string; end_line: number; via_describe: boolean }) =>
      [d.name, d.end_line, d.via_describe]), [
      ["already tagged", 2, false], ["expression", 5, true], ["block", 11, true], ["outside", 13, false],
    ]);
    const tags = await reports.declaredTags(base, head, "R", { cwd });
    assert.deepEqual(tags.acceptance["AB-1"]?.map((d: { name: string; authorship: string }) => [d.name, d.authorship]),
      [["expression", "written-here"], ["block", "written-here"]]);
  });
});

test("skip-added ignores line comments and prefers the innermost declaration then lookahead", async () => {
  const go = (body: string[]) => [
    "package x", "func TestOuter(t *testing.T) {", '  t.Run("inner", func(t *testing.T) {',
    ...body, "  })", "}", "",
  ].join("\n");
  await withDiff({
    "value_test.go": go(["    check()"]),
    "test_value.py": "def test_value():\n    pass\n",
    "value.test.ts": 'it("next", () => {});\n',
  }, {
    "value_test.go": go(['    // t.Skip("not active")', '    t.Skip("real skip")', "    check()"]),
    "test_value.py": 'def test_value():\n    # pytest.skip("comment")\n    pass\n',
    "value.test.ts": 'if (pending) process.todo();\n\nit("next", () => {});\n',
  }, async (base, head, cwd) => {
    const weak = await reports.weakening(base, head, { cwd });
    assert.deepEqual(weak.by.filter((f: { finding: string }) => f.finding === "skip-added"), [
      { finding: "skip-added", file: "value_test.go", names: ["inner"] },
      { finding: "skip-added", file: "value.test.ts", names: ["next"] },
    ]);
    const scan = await reports.scanTests(head, { cwd });
    assert.deepEqual(scan.skips.map((s: { file: string }) => s.file), ["value.test.ts", "value_test.go"]);
  });
});

type Snapshot = Record<string, string>;

async function withDiff<T>(
  before: Snapshot, after: Snapshot, run: (base: string, head: string, cwd: string) => Promise<T>,
): Promise<T> {
  const repository = await tmpRepo("reports-conformance");
  try {
    for (const [file, text] of Object.entries(before)) await repository.write(file, text);
    repository.git(["add", "."]);
    repository.git(["commit", "--quiet", "--allow-empty", "-m", "base"]);
    const base = repository.git(["rev-parse", "HEAD"]).trim();
    for (const file of Object.keys(before)) {
      if (!Object.hasOwn(after, file)) repository.git(["rm", "--quiet", "--", file]);
    }
    for (const [file, text] of Object.entries(after)) await repository.write(file, text);
    repository.git(["add", "."]);
    repository.git(["commit", "--quiet", "--allow-empty", "-m", "head"]);
    const head = repository.git(["rev-parse", "HEAD"]).trim();
    return await run(base, head, repository.path);
  } finally {
    await repository.cleanup();
  }
}

function assertProjection(actual: unknown, expected: unknown): void {
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual));
    assert.equal(actual.length, expected.length);
    for (let index = 0; index < expected.length; index += 1) assertProjection(actual[index], expected[index]);
  } else if (expected && typeof expected === "object" && Object.keys(expected).length) {
    assert.ok(actual && typeof actual === "object");
    for (const [key, value] of Object.entries(expected)) {
      assert.ok(Object.hasOwn(actual, key), `Missing projected field ${key}`);
      assertProjection((actual as Record<string, unknown>)[key], value);
    }
  } else {
    assert.deepEqual(actual, expected);
  }
}

type Alg08Case = { expected: unknown } & (
  { report: { kind: string; inputs: string[] } } |
  { sources: Snapshot } |
  { item: { source: string; names: string[] } } |
  { diff: { operation: "declaredTags"; before: Snapshot; after: Snapshot } }
);
type Alg09Case = { before: Snapshot; after: Snapshot; expected: unknown };

function conformance<T>(algorithm: string): Record<string, T> {
  const file = path.join("pkg", "conformance", algorithm, "cases.json");
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, T>;
}

const { scanText } = await import("../../dist/reports/scan.js");
for (const [name, fixture] of Object.entries(conformance<Alg08Case>("alg-08"))) {
  test(`ALG-08 conformance · ${name}`, async () => {
    if ("report" in fixture) {
      const repository = await tmpRepo("alg-08-report");
      try {
        const paths = [];
        for (const [index, contents] of fixture.report.inputs.entries()) {
          const file = `report-${index}`;
          await repository.write(file, contents);
          paths.push(file);
        }
        const actual = reports.readReport(fixture.report.kind, paths, { cwd: repository.path });
        assertProjection(actual, fixture.expected);
      } finally {
        await repository.cleanup();
      }
    } else if ("sources" in fixture) {
      const actual = Object.fromEntries(Object.entries(fixture.sources).map(
        ([file, text]) => [file, scanText(file, text).declarations],
      ));
      assertProjection(actual, fixture.expected);
    } else if ("item" in fixture) {
      const declarations = scanText("value.test.ts", fixture.item.source).declarations.map(
        (declaration: { file: string; name: string; line: number; raw_name: string; via_describe: boolean }) =>
          ({ ...declaration, tag: "AB-1", authorship: "written-here" }),
      );
      const actual = reports.itemResults([{ id: "AB-1" }], {
        runner: "junit", inconclusive: false, teardown_failed: false,
        cases: fixture.item.names.map((full_name) => ({ full_name, status: "pass", attempts: ["pass"], tags: ["AB-1"] })),
      }, { acceptance: { "AB-1": declarations } });
      assertProjection(actual[0], fixture.expected);
    } else if ("diff" in fixture) {
      const actual = await withDiff(fixture.diff.before, fixture.diff.after, (base, head, cwd) =>
        reports.declaredTags(base, head, "R", { cwd }));
      assertProjection(actual, fixture.expected);
    } else {
      assert.fail("Unrecognized ALG-08 case");
    }
  });
}

for (const [name, fixture] of Object.entries(conformance<Alg09Case>("alg-09"))) {
  test(`ALG-09 conformance · ${name}`, async () => {
    const actual = await withDiff(fixture.before, fixture.after, (base, head, cwd) =>
      reports.weakening(base, head, { cwd }));
    assertProjection(actual, fixture.expected);
  });
}

test("[AC-B2] [R2-18] only test skips count, including configured test paths", async (t) => {
  const repo = await tmpRepo("actual-skips");
  t.after(repo.cleanup);
  await repo.write("README.md", "# Queue\n");
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "base"]);
  const base = repo.git(["rev-parse", "HEAD"]).trim();
  const changes = {
    "scripts/validate.py": "if bad_input:\n    sys.exit(1)\nif no_queue:\n    sys.exit(1)\n",
    "scripts/validate.js": "if (!ready) process.exit(1);\n",
    "scripts/validate.go": 'func Validate() { timer.Skip("tick") }\n',
    "test_queue.py": 'def test_queue():\n    pytest.skip("outside scope")\n',
    "queue.test.js": 'test.skip("queue", () => {});\ntest("error", () => process.exit(1));\n',
    "queue_test.go": 'func TestQueue(t *testing.T) {\n    t.Skip("offline")\n}\n',
    "checks/queue.js": 'xit("configured queue", () => {});\n',
  };
  for (const [file, text] of Object.entries(changes)) await repo.write(file, text);
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "add scripts and tests"]);
  const actual = await reports.weakening(base, "HEAD", { cwd: repo.path, test_files: [
    "**/test_*.py", "**/*.test.js", "**/*_test.go", "checks/*.js",
  ] });
  assert.deepEqual(actual.by.map(({ file }) => file).sort(), [
    "checks/queue.js", "queue.test.js", "queue_test.go", "test_queue.py",
  ]);
});
