import assert from "node:assert/strict";
import test from "node:test";
import { tmpRepo } from "../helpers/tmpRepo.ts";

const [
  { anchorsFor },
  { resolveCitations },
  { deltas },
  { ladder },
  { itemLine, parseDoc, parseRequirement },
  { touched },
] = await Promise.all([
  import("../../dist/specs/anchors.js"),
  import("../../dist/specs/citations.js"),
  import("../../dist/specs/deltas.js"),
  import("../../dist/specs/ladder.js"),
  import("../../dist/specs/parse.js"),
  import("../../dist/specs/touched.js"),
]);

function specification(items: string[], options: { doc?: string; level?: string; state?: string } = {}): string {
  return [
    "---",
    `tenet: {spec: 1, doc: ${options.doc ?? "intent"}, level: ${options.level ?? "L1"}}`,
    `sections: {requirements: {state: ${options.state ?? "blessed"}}}`,
    "---",
    "## Requirements",
    ...items,
    "",
  ].join("\n");
}

test("[CP-0066-R1] standalone HTML comments preserve later table rows and their line numbers", () => {
  const rows = [
    "| ID | Requirement | Origin |",
    "| --- | --- | --- |",
    "| R-1 | Keep a paper receipt. | asked |",
    "<!-- Review the formats below. -->",
    "| R-2 | Offer an email copy. | documented |",
    "<!--",
    "",
    "## Internal note",
    "| R-99 | Commented out. | asked |",
    "-->",
    "| R-3 | Show the receipt date. | asked |",
    "",
    "| R-4 | Outside the table. | asked |",
  ];
  const parsed = parseDoc("tenet/intent.md", specification(rows));
  assert.deepEqual(parsed.sections.flatMap(({ requirements }) =>
    requirements.map((item) => [item.id, item.text, itemLine(item)])), [
    ["R-1", "Keep a paper receipt.", 8],
    ["R-2", "Offer an email copy.", 10],
    ["R-3", "Show the receipt date.", 16],
  ]);
  assert.deepEqual(parsed.problems, []);
  assert.deepEqual(parsed.sections.map(({ heading }) => heading), ["Requirements"]);
  assert.equal(parsed.sections[0]?.text, rows.join("\n") + "\n");
});

async function commitAll(
  repository: Awaited<ReturnType<typeof tmpRepo>>,
  message: string,
): Promise<string> {
  repository.git(["add", "-A"]);
  repository.git(["commit", "--quiet", "--allow-empty", "-m", message]);
  return repository.git(["rev-parse", "HEAD"]).trim();
}

test("r4 B1 Git fixtures disable the caller's CRLF conversion settings", async () => {
  const repository = await tmpRepo("review-r4-crlf");
  try {
    assert.equal(repository.git(["config", "--local", "--get", "core.autocrlf"]).trim(), "false");
    assert.equal(repository.git(["config", "--local", "--get", "core.safecrlf"]).trim(), "false");
    await repository.write("docs/rule.md", "## Rule\r\n\r\n- R-1 Keep LF-safe commits.\r\n");
    repository.git(["add", "."]);
    repository.git(["commit", "--quiet", "-m", "base"]);
    assert.equal(repository.git(["status", "--porcelain"]).trim(), "");
  } finally {
    await repository.cleanup();
  }
});

test("r4 B2 fenced examples remain section text but do not become items", () => {
  const parsed = parseDoc("intent.md", [
    "---",
    "tenet: {spec: 1, doc: intent}",
    "sections: {}",
    "---",
    "## Requirements",
    "- R-1 Real requirement.",
    "````md",
    "- R-9 Example only.",
    "| ID | Requirement |",
    "|---|---|",
    "| R-10 | Also example. |",
    "````",
  ].join("\n"));
  assert.deepEqual(parsed.sections[0]?.requirements.map((item) => item.id), ["R-1"]);
  assert.match(parsed.sections[0]?.text ?? "", /- R-9 Example only\./);
  assert.equal(parsed.problems.length, 0);
});

test("r4 B3 metadata markers outside braces remain malformed", () => {
  const parsed = parseDoc("intent.md", specification([
    "- R-1 Keep it. origin: asked {serves: V-1}",
  ]));
  assert.deepEqual(parsed.problems.map((problem) => [problem.code, problem.line]), [
    ["TN-SPEC-REQ-META", 6],
  ]);
});

test("trailing metadata is parsed outside inline code only", () => {
  const inline = parseRequirement(
    "- R-1 Return `{path, reason}` from the parser.",
  );
  assert.equal("code" in inline, false);
  assert.equal(inline.text, "Return `{path, reason}` from the parser.");
  assert.equal(inline.origin, null);

  const mid = parseRequirement(
    "- R-2 Keep `{path: reason}` in prose before continuing.",
  );
  assert.equal("code" in mid, false);
  assert.equal(mid.text, "Keep `{path: reason}` in prose before continuing.");
  assert.equal(mid.origin, null);

  const trailing = parseRequirement(
    "- R-3 Keep shape stable. {origin: asked; scope: global}",
  );
  assert.equal("code" in trailing, false);
  assert.equal(trailing.text, "Keep shape stable.");
  assert.equal(trailing.origin, "asked");
  assert.equal(trailing.scope, "global");

  const malformed = parseRequirement(
    "- R-4 Keep shape stable. {origin: asked",
  );
  assert.equal("code" in malformed, true);
  assert.equal(malformed.code, "TN-SPEC-REQ-META");
});

test("technical prose braces do not turn non-requirement bullets into missing IDs", () => {
  const parsed = parseDoc("intent.md", [
    "---",
    "tenet: {spec: 1, doc: design}",
    "sections: {design: {state: draft}}",
    "---",
    "## Design",
    "- Return `{path, reason}` without changing the shape.",
    "- Keep {path: reason} in the explanation.",
    "- Describe the returned shape as {path, reason}",
  ].join("\n"));
  assert.deepEqual(parsed.problems, []);
});

test("r4 B4 malformed citations use syntax-first classification and wording", () => {
  const doc = parseDoc("intent.md", specification([
    "- R-1 Bad doc. {origin: asked; cites: doc: guide.md#bad slug:5}",
    "- R-2 Bad range. {origin: asked; cites: src/a.ts:one-two}",
    "- R-3 Out of range. {origin: asked; cites: src/a.ts:9}",
  ]));
  const findings = resolveCitations(doc, (filename) =>
    filename === "src/a.ts" ? "one\n" : null
  );
  assert.deepEqual(findings.map((finding) => [finding.code, finding.message, finding.fix]), [
    [
      "TN-CITE-RANGE",
      "Citation doc: guide.md#bad slug:5 has an invalid line range or format.",
      "Fix doc: guide.md#bad slug:5 to use a valid path:line or path:start-end within file length.",
    ],
    [
      "TN-CITE-RANGE",
      "Citation src/a.ts:one-two has an invalid line range or format.",
      "Fix src/a.ts:one-two to use a valid path:line or path:start-end within file length.",
    ],
    [
      "TN-CITE-RANGE",
      "Citation src/a.ts:9 has an invalid line range or format.",
      "Fix src/a.ts:9 to use a valid path:line or path:start-end within file length.",
    ],
  ]);
});

test("r4 B5 test anchors ignore non-test helper declarations", () => {
  const source = [
    "def test_first():",
    "    assert first()",
    "",
    "def helper():",
    "    return 2",
    "",
    "def test_next():",
    "    assert helper() == 2",
    "",
  ].join("\n");
  const anchors = anchorsFor({
    requirements: [{ cites: ["test: sample.py > test_first"] }],
  } as never, (filename) => filename === "sample.py" ? source : null);
  assert.equal(anchors.texts["test: sample.py > test_first"], [
    "def test_first():",
    "    assert first()",
    "",
    "def helper():",
    "    return 2",
    "",
  ].join("\n"));
});

test("r4 B6 a new blessed requirement is touched by its head-side line", async () => {
  const repository = await tmpRepo("review-r4-b6");
  try {
    await repository.write("tenet/intent.md", specification([
      "- R-1 Existing. {origin: asked}",
    ]));
    const base = await commitAll(repository, "base");
    await repository.write("tenet/intent.md", specification([
      "- R-1 Existing. {origin: asked}",
      "- R-12 Added. {origin: asked}",
    ]));
    const head = await commitAll(repository, "head");
    const result = await touched(base, head, [], { cwd: repository.path });
    assert.ok(result.some((item) => item.id === "R-12" && item.why === "text-changed"));
  } finally {
    await repository.cleanup();
  }
});

test("CP-0044 touched reads the policy ID prefix", async () => {
  const repository = await tmpRepo("cp-0044-touched-prefix");
  try {
    await repository.write("tenet.yaml", "specs: {id_prefix: C}\n");
    await repository.write("tenet/intent.md", specification([
      "- C-1 Existing. {origin: asked}",
    ]));
    const base = await commitAll(repository, "base");
    await repository.write("src/a.ts", "changed\n");
    const head = await commitAll(repository, "head");
    assert.deepEqual(await touched(base, head, ["C-1"], { cwd: repository.path }), [
      { id: "C-1", why: "implements" },
    ]);
  } finally {
    await repository.cleanup();
  }
});

test("r4 B7 touched results preserve reason priority before numeric ID order", async () => {
  const repository = await tmpRepo("review-r4-b7");
  try {
    await repository.write("tenet/intent.md", specification([
      "- R-2 Cited. {origin: asked; cites: src/a.ts:1}",
      "- R-9 Implemented. {origin: asked}",
    ]));
    await repository.write("src/a.ts", "before\n");
    const base = await commitAll(repository, "base");
    await repository.write("src/a.ts", "after\n");
    const head = await commitAll(repository, "head");
    assert.deepEqual(await touched(base, head, ["R-9"], { cwd: repository.path }), [
      { id: "R-9", why: "implements" },
      { id: "R-2", why: "cited-code-changed" },
    ]);
  } finally {
    await repository.cleanup();
  }
});

test("r4 B8 cited paths with spaces overlap Git hunks", async () => {
  const repository = await tmpRepo("review-r4-b8");
  try {
    await repository.write("tenet/intent.md", specification([
      "- R-1 Cited. {origin: asked; cites: src/example with space.ts:1}",
    ]));
    await repository.write("src/example with space.ts", "before\n");
    const base = await commitAll(repository, "base");
    await repository.write("src/example with space.ts", "after\n");
    const head = await commitAll(repository, "head");
    assert.deepEqual(await touched(base, head, [], { cwd: repository.path }), [
      { id: "R-1", why: "cited-code-changed" },
    ]);
  } finally {
    await repository.cleanup();
  }
});

test("r4 B9 ladder reports and touched refuses cross-document duplicate IDs", async () => {
  const repository = await tmpRepo("review-r4-b9");
  try {
    await repository.write("tenet/a.md", specification([
      "- R-2 First. {origin: asked}",
    ], { doc: "a" }));
    await repository.write("tenet/b.md", specification([
      "- R-2 Second. {origin: asked}",
    ], { doc: "b" }));
    await repository.write("src/a.ts", "before\n");
    const base = await commitAll(repository, "base");
    const entries = await ladder({ cwd: repository.path });
    const duplicate = entries.find((entry) => entry.path === "tenet/b.md")
      ?.doc.problems.find((problem) => problem.code === "TN-SPEC-DUP-ID");
    assert.equal(duplicate?.message, "Duplicate specification ID R-2.");
    await repository.write("src/a.ts", "after\n");
    const head = await commitAll(repository, "head");
    await assert.rejects(
      touched(base, head, [], { cwd: repository.path }),
      /duplicate specification ID R-2/,
    );
  } finally {
    await repository.cleanup();
  }
});

test("r4 B10 deltas compare every part of a document and reject ID collisions", async () => {
  const repository = await tmpRepo("review-r4-b10");
  try {
    await repository.write("tenet/a.md", specification([
      "- R-1 First part. {origin: asked}",
    ], { doc: "prd" }));
    await repository.write("tenet/b.md", specification([
      "- R-7 Second part. {origin: asked}",
    ], { doc: "prd" }));
    const base = await commitAll(repository, "base");
    await repository.write("tenet/b.md", specification([
      "- R-7 Edited second part. {origin: asked}",
    ], { doc: "prd" }));
    const head = await commitAll(repository, "head");
    assert.deepEqual(await deltas(base, head, { cwd: repository.path }), [{
      doc: "prd",
      added: [],
      modified: ["R-7"],
      removed: [],
    }]);
    await repository.write("tenet/b.md", specification([
      "- R-1 Collision. {origin: asked}",
    ], { doc: "prd" }));
    const collision = await commitAll(repository, "collision");
    await assert.rejects(
      deltas(base, collision, { cwd: repository.path }),
      /duplicate specification ID R-1 in document prd/,
    );
  } finally {
    await repository.cleanup();
  }
});

test("CP-0044 deltas reads the policy ID prefix", async () => {
  const repository = await tmpRepo("cp-0044-deltas-prefix");
  try {
    await repository.write("tenet.yaml", "specs: {id_prefix: C}\n");
    await repository.write("tenet/intent.md", specification([
      "- C-1 Before. {origin: asked}",
    ]));
    const base = await commitAll(repository, "base");
    await repository.write("tenet/intent.md", specification([
      "- C-1 After. {origin: asked}",
    ]));
    const head = await commitAll(repository, "head");
    assert.deepEqual(await deltas(base, head, { cwd: repository.path }), [{
      doc: "intent",
      added: [],
      modified: ["C-1"],
      removed: [],
    }]);
  } finally {
    await repository.cleanup();
  }
});

test("r4 B11 a never-existing doc citation does not become cited-code-changed", async () => {
  const repository = await tmpRepo("review-r4-b11");
  try {
    await repository.write("tenet/intent.md", specification([
      "- R-1 Missing section. {origin: asked; cites: doc: docs/guide.md#never}",
    ]));
    await repository.write("src/a.ts", "before\n");
    const base = await commitAll(repository, "base");
    await repository.write("src/a.ts", "after\n");
    const head = await commitAll(repository, "head");
    assert.deepEqual(await touched(base, head, [], { cwd: repository.path }), []);
  } finally {
    await repository.cleanup();
  }
});

test("r8 B11 only base-existing doc slugs change when the file is deleted", async () => {
  const repository = await tmpRepo("review-r8-b11");
  try {
    await repository.write("tenet/intent.md", specification([
      "- R-1 Existing section. {origin: asked; cites: doc: docs/guide.md#existing}",
      "- R-2 Missing section. {origin: asked; cites: doc: docs/guide.md#never}",
      "- R-3 Implemented deletion. {origin: asked; cites: doc: docs/guide.md#existing}",
    ]));
    await repository.write("docs/guide.md", "## Existing\n\nBase text.\n");
    const base = await commitAll(repository, "base");
    repository.git(["rm", "docs/guide.md"]);
    const head = await commitAll(repository, "head");
    assert.deepEqual(await touched(base, head, ["R-3"], { cwd: repository.path }), [
      { id: "R-3", why: "implements" },
      { id: "R-1", why: "cited-code-changed" },
      { id: "R-2", why: "same-area" },
    ]);
  } finally {
    await repository.cleanup();
  }
});

test("r4 S1 doc anchor text trims trailing whitespace per line", () => {
  const anchors = anchorsFor({
    requirements: [{ cites: ["doc: guide.md#rules"] }],
  } as never, (filename) => filename === "guide.md"
    ? "## Rules  \nFirst  \t\nSecond\t\n"
    : null
  );
  assert.equal(anchors.texts["doc: guide.md#rules"], "First\nSecond");
});

test("r4 S2 special sections require exact headings and retain resolutions", () => {
  const parsed = parseDoc("intent.md", [
    "---",
    "tenet: {spec: 1, doc: intent}",
    "sections: {}",
    "---",
    "## Conflicts!",
    "- CF-9 Not a conflict section.",
    "## Conflicts",
    "- [x] CF-1 (section: requirements) Choose two. | 1: one | 2: two | resolution: two",
  ].join("\n"));
  assert.equal(parsed.sections[0]?.conflicts.length, 0);
  assert.deepEqual(parsed.sections[1]?.conflicts, [{
    id: "CF-1",
    checked: true,
    section: "requirements",
    text: "Choose two.",
    resolution: "two",
  }]);
});

test("r4 S3 dash placeholders apply only to table cells, not braced scope", () => {
  assert.equal(parseRequirement("- R-1 Keep scope. {origin: asked; scope: -}").scope, "-");
  const parsed = parseDoc("intent.md", [
    "---",
    "tenet: {spec: 1, doc: intent}",
    "sections: {}",
    "---",
    "## Requirements",
    "| ID | Requirement | Origin | Scope |",
    "|---|---|---|---|",
    "| R-2 | Table placeholder. | asked | - |",
  ].join("\n"));
  assert.equal(parsed.sections[0]?.requirements[0]?.scope, null);
});
