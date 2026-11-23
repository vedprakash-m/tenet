import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { tmpRepo } from "../helpers/tmpRepo.ts";

const roots = [
  "src/specs/parse.ts",
  "src/specs/sections.ts",
  "src/specs/citations.ts",
  "src/specs/anchors.ts",
  "src/specs/flags.ts",
  "src/specs/ladder.ts",
  "src/specs/deltas.ts",
  "src/specs/touched.ts",
  "src/policy/index.ts",
];
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
    ...roots,
  ],
  { cwd: process.cwd(), encoding: "utf8" },
);
if (build.status !== 0) throw new Error(build.stderr || build.stdout);

const [
  { parseDoc, parseRequirement },
  { sectionDigest },
  { anchorsFor, relocate },
  { flags, matchRenamed },
  { resolveCitations },
  { ladder },
  { deltas },
  { touched },
  { loadPolicy, ownersFor },
] =
  await Promise.all([
    import("../../dist/specs/parse.js"),
    import("../../dist/specs/sections.js"),
    import("../../dist/specs/anchors.js"),
    import("../../dist/specs/flags.js"),
    import("../../dist/specs/citations.js"),
    import("../../dist/specs/ladder.js"),
    import("../../dist/specs/deltas.js"),
    import("../../dist/specs/touched.js"),
    import("../../dist/policy/index.js"),
  ]);

type Json = Record<string, unknown>;

function reader(files: Record<string, string>) {
  return (filename: string) => files[filename] ?? null;
}

async function cases(algorithm: string): Promise<Array<{ name: string; input: Json; expected: Json; expectedText: string }>> {
  const root = path.join("pkg", "conformance", algorithm);
  const result = [];
  for (const name of (await readdir(root)).sort()) {
    const directory = path.join(root, name);
    if (!(await stat(directory)).isDirectory()) continue;
    const expectedText = await readFile(path.join(directory, "expected.json"), "utf8");
    result.push({
      name,
      input: JSON.parse(await readFile(path.join(directory, "input.json"), "utf8")) as Json,
      expected: JSON.parse(expectedText) as Json,
      expectedText,
    });
  }
  return result;
}

function projectRecord(value: Record<string, unknown>, shape: Record<string, unknown>): Record<string, unknown> {
  const projected: Record<string, unknown> = {};
  for (const key of Object.keys(shape)) {
    if (key === "problem_codes") continue;
    const expected = shape[key];
    const actual = value[key];
    if (Array.isArray(expected)) {
      assert.ok(Array.isArray(actual), `${key} must be an array`);
      assert.equal(actual.length, expected.length, `${key} length`);
      projected[key] = expected.map((item, index) =>
        item !== null && typeof item === "object" && actual[index] !== null && typeof actual[index] === "object"
          ? projectRecord(actual[index] as Record<string, unknown>, item as Record<string, unknown>)
          : actual[index]
      );
    } else {
      projected[key] = actual;
    }
  }
  return projected;
}

function actualForAlg02(input: Json, expected: Json): Json {
  switch (input.operation) {
    case "parseDoc": {
      const doc = parseDoc(String(input.path), String(input.text), input.opts as { prefix?: string } | undefined);
      const projected = projectRecord(doc as unknown as Record<string, unknown>, expected);
      return {
        ...projected,
        ...("problem_codes" in expected ? { problem_codes: doc.problems.map((problem: { code: string }) => problem.code) } : {}),
      };
    }
    case "parseRequirement": {
      const result = parseRequirement(input.line as string | Record<string, string>, input.opts as {
        prefix?: string; line?: number; file?: string;
      });
      return projectRecord(result as unknown as Record<string, unknown>, expected);
    }
    case "sectionDigestMany":
      return { digests: (input.bodies as string[]).map(sectionDigest) };
    case "matchRenamed":
      return matchRenamed(input.front as Json, input.sections as Array<{ slug: string; digest: string }>);
    default:
      throw new Error(`unknown ALG-02 operation: ${String(input.operation)}`);
  }
}

async function actualForAlg03(input: Json): Promise<unknown> {
  if (input.operation === "anchorsFor") {
    return anchorsFor(input.section as never, reader(input.files as Record<string, string>));
  }
  if (input.operation === "relocate") return relocate(input.anchor as { hash: string; line_count: number }, String(input.file));
  if (input.operation === "flags") {
    return { flags: flags(input.section as never, reader(input.files as Record<string, string>)) };
  }
  if (input.operation === "owner") {
    const parent = path.join(process.cwd(), "test", "specs");
    const root = await mkdtemp(path.join(parent, ".owner-"));
    try {
      const document = String(input.document);
      const frontOwner = typeof input.front_matter_owner === "string" ? input.front_matter_owner : undefined;
      const front = [
        "---",
        `tenet: {spec: 1, doc: checkout${frontOwner ? `, owner: ${frontOwner}` : ""}}`,
        "sections: {}",
        "---",
        "## Requirements",
        "Text.",
      ].join("\n");
      const parsed = parseDoc(document, front);
      if (frontOwner) assert.equal(parsed.sections[0]?.owner, frontOwner);
      await mkdir(path.join(root, ".github"), { recursive: true });
      await mkdir(path.join(root, "tenet", path.dirname(document)), { recursive: true });
      await writeFile(path.join(root, "tenet.yaml"), [
        "specs:",
        "  documents:",
        `    - {path: ${document}, level: L1}`,
        "",
      ].join("\n"));
      await writeFile(path.join(root, ".github", "CODEOWNERS"), String(input.codeowners));
      await writeFile(path.join(root, "tenet", ...document.split("/")), front);
      await loadPolicy({ cwd: root });
      return {
        owners: frontOwner
          ? parsed.sections.map((section: { owner: string | null }) => section.owner).filter(Boolean)
          : ownersFor(document),
      };
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
  throw new Error(`unknown ALG-03 operation: ${String(input.operation)}`);
}

function actualForAlg04(input: Json): Json {
  const doc = parseDoc(String(input.path), String(input.text));
  const findings = resolveCitations(doc, reader(input.files as Record<string, string>));
  return {
    findings: findings.map((item: { code: string; severity: string; rule: string | null; line: number | null }) => ({
      code: item.code,
      severity: item.severity,
      rule: item.rule,
      line: item.line,
    })),
  };
}

async function clearDirectory(root: string): Promise<void> {
  for (const name of await readdir(root)) {
    if (name === ".git") continue;
    await rm(path.join(root, name), { recursive: true, force: true });
  }
}

async function materialize(root: string, files: Record<string, string>): Promise<void> {
  await clearDirectory(root);
  for (const [filename, contents] of Object.entries(files)) {
    const target = path.join(root, ...filename.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents);
  }
}

async function actualForAlg14(input: Json): Promise<Json> {
  const repository = await tmpRepo("alg-14");
  const root = repository.path;
  try {
    await materialize(root, input.base as Record<string, string>);
    repository.git(["add", "."]);
    repository.git(["commit", "--quiet", "-m", "base"]);
    const base = repository.git(["rev-parse", "HEAD"]).trim();
    await materialize(root, input.head as Record<string, string>);
    repository.git(["add", "-A"]);
    repository.git(["commit", "--quiet", "--allow-empty", "-m", "head"]);
    const head = repository.git(["rev-parse", "HEAD"]).trim();
    return { touched: await touched(base, head, input.implementsIds as string[], { cwd: root }) };
  } finally {
    await repository.cleanup();
  }
}

for (const algorithm of ["alg-02", "alg-03", "alg-04", "alg-14"]) {
  test(`${algorithm} independent fixtures`, async (context) => {
    for (const fixture of await cases(algorithm)) {
      await context.test(fixture.name, async () => {
        let actual: unknown;
        if (algorithm === "alg-02") actual = actualForAlg02(fixture.input, fixture.expected);
        else if (algorithm === "alg-03") actual = await actualForAlg03(fixture.input);
        else if (algorithm === "alg-04") actual = actualForAlg04(fixture.input);
        else actual = await actualForAlg14(fixture.input);
        assert.equal(`${JSON.stringify(actual, null, 2)}\n`, fixture.expectedText);
      });
    }
  });
}

test("parses tables, nullable metadata, conflicts, questions and shared duplicate IDs", () => {
      const text = [
        "---",
        "tenet: {spec: 1, doc: intent, level: L1}",
        "sections:",
        "  requirements: {state: draft}",
        "---",
        "## Requirements",
        "| ID | Requirement | Rule | Origin | Cites | Scope | Adopted by | Release |",
        "|---|---|---|---|---|---|---|---|",
        "| R-2 | Keep {origin: inferred; serves: V-1} | ignored | observed | src/a.ts:2 | global | ved | 1 |",
        "| R-10 | Bound it. | ignored | — | — | — | — | extra |",
        "| R-3 | Keep markers. {origin: documented; cites: src/inline.ts:1; serves: V-3; scope: local; adopted_by: sam} | ignored | — | — | — | - | |",
        "| R-2 | repeated | ignored | — | — | — | — | extra |",
        "## Conflicts",
        "- [ ] CF-1 (section: requirements) A contradiction. | 1: one | 2: two",
        "## Open questions",
        "- [x] Q-2 (section: requirements) Which? | answer: the second",
      ].join("\r\n");
      const parsed = parseDoc("tenet\\intent.md", text);
      assert.equal(parsed.path, "tenet/intent.md");
      assert.deepEqual(Object.keys(parsed.sections[0] ?? {}), [
        "slug",
        "heading",
        "level",
        "text",
        "digest",
        "requirements",
        "vision_items",
        "conflicts",
        "questions",
        "applies_to",
        "state",
        "blessed_digest",
        "blessed_at_rev",
        "anchors",
        "blessed_copy",
        "flags",
        "owner",
      ]);
      assert.deepEqual(parsed.sections[0]?.requirements.map((item: Record<string, unknown>) => item), [
        {
          id: "R-2",
          text: "Keep",
          origin: "observed",
          cites: ["src/a.ts:2"],
          serves: ["V-1"],
          scope: "global",
          adopted_by: "ved",
        },
        {
          id: "R-10",
          text: "Bound it.",
          origin: null,
          cites: [],
          serves: [],
          scope: null,
          adopted_by: null,
        },
        {
          id: "R-3",
          text: "Keep markers.",
          origin: "documented",
          cites: ["src/inline.ts:1"],
          serves: ["V-3"],
          scope: "local",
          adopted_by: "sam",
        },
      ]);
      assert.deepEqual(parsed.sections[1]?.conflicts, [{
        id: "CF-1",
        checked: false,
        section: "requirements",
        text: "A contradiction.",
      }]);
      assert.deepEqual(parsed.sections[2]?.questions, [{
        id: "Q-2",
        checked: true,
        section: "requirements",
        text: "Which?",
        answer: "the second",
      }]);
      assert.deepEqual(parsed.problems.map((problem: { code: string; line: number | null }) => [
        problem.code,
        problem.line,
      ]), [["TN-SPEC-DUP-ID", 12]]);
});

test("reports malformed requirements and missing IDs at physical lines", () => {
      const text = [
        "---",
        "tenet: {spec: 1, doc: intent}",
        "sections: {}",
        "---",
        "## Requirements",
        "- prose needs an ID.",
        "- R-1 Valid. {origin: asked",
        "- R-2 Valid. {unknown: x}",
      ].join("\n");
      const parsed = parseDoc("intent.md", text);
      assert.deepEqual(parsed.problems.map((problem: { code: string; line: number | null }) => [
        problem.code,
        problem.line,
      ]), [
        ["TN-SPEC-MISSING-ID", 6],
        ["TN-SPEC-REQ-META", 7],
        ["TN-SPEC-REQ-META", 8],
      ]);
      assert.equal(parsed.problems[0]?.message, "Specification line needs an ID.");
      assert.equal(
        parsed.problems[1]?.fix,
        "Fix the `{…}` metadata block with allowed keys and valid origin.",
      );
});

test("keeps one seen-ID set across statement kinds and parses grouped vision IDs", () => {
      const parsed = parseDoc("vision.md", [
        "---",
        "tenet: {spec: 1, doc: vision, level: L0}",
        "sections: {}",
        "---",
        "## Vision",
        "- V-P18 A grouped outcome.",
        "## Requirements",
        "- R-2 A requirement.",
        "## Conflicts",
        "- [ ] Q-2 A question asked early.",
        "## Open questions",
        "- [ ] Q-2 Repeated question.",
      ].join("\n"));
      assert.deepEqual(parsed.sections[0]?.vision_items.map((item: { id: string }) => item.id), ["V-P18"]);
      assert.equal(parsed.problems.some((item: { code: string; line: number | null }) =>
        item.code === "TN-SPEC-DUP-ID" && item.line === 12
      ), true);
});

test("emits exact citation finding wording", () => {
      const doc = parseDoc("intent.md", [
        "---",
        "tenet: {spec: 1, doc: intent}",
        "sections: {}",
        "---",
        "## Requirements",
        "- R-1 Text. {origin: observed; cites: src/gone.ts:4}",
      ].join("\n"));
      const findings = resolveCitations(doc, () => null);
      assert.deepEqual(findings[0], {
        code: "TN-CITE-FILE",
        severity: "error",
        rule: "citations-valid",
        file: "intent.md",
        line: 6,
        message: "Cited file src/gone.ts was not found.",
        fix: "Update the citation path or restore src/gone.ts.",
      });
});

test("does not normalize URLs, supports empty headings, and omits rename merges", () => {
      const body = "\nUse https://example.test/src/a.ts:4 and sha256:abcd.\n";
      assert.notEqual(
        sectionDigest(body),
        sectionDigest("\nUse https://example.test/src/a.ts:9 and sha256:abcd.\n"),
      );
      assert.notEqual(
        sectionDigest("\nSee https://example.test:8443/src/a.ts:4?copy=src/b.ts:8#L1.\n"),
        sectionDigest("\nSee https://example.test:8443/src/a.ts:9?copy=src/b.ts:7#L1.\n"),
      );
      assert.notEqual(
        sectionDigest("\nSee `sha256:abc/src/a.ts:4`.\n"),
        sectionDigest("\nSee `sha256:abc/src/a.ts:9`.\n"),
      );
      const parsed = parseDoc("intent.md", "---\ntenet: {spec: 1}\n---\n## \nBody\n");
      assert.equal(parsed.sections[0]?.slug, "section-1");
      assert.equal(
        matchRenamed(
          {
            sections: {
              old: { digest: "sha256:a" },
              other: { digest: "sha256:a" },
            },
          },
          [{ slug: "new", digest: "sha256:a" }],
        ).renamed.length,
        0,
      );
});

test("recognizes test citation prefixes before path-like suffixes", () => {
      const doc = parseDoc("intent.md", [
        "---",
        "tenet: {spec: 1}",
        "sections: {}",
        "---",
        "## Requirements",
        "- R-1 A test citation. {origin: observed; cites: test: retry.test.ts > case:1}",
      ].join("\n"));
      const files = {
        "retry.test.ts": "test('case:1', () => {});\n",
      };
      assert.deepEqual(resolveCitations(doc, reader(files)), []);
      assert.deepEqual(
        anchorsFor(doc.sections[0] as never, reader(files)).texts,
        { "test: retry.test.ts > case:1": "test('case:1', () => {});" },
      );
});

test("recognizes doc citation prefixes before path-like suffixes", () => {
      const doc = parseDoc("intent.md", [
        "---",
        "tenet: {spec: 1}",
        "sections: {}",
        "---",
        "## Requirements",
        "- R-1 A doc citation. {origin: documented; cites: doc: guide.md#case:1}",
      ].join("\n"));
      assert.equal(
        resolveCitations(doc, reader({ "guide.md": "## Case 1\nText\n" }))[0]?.code,
        "TN-CITE-HEADING",
      );
});

test("uses complete parsed heading positions for duplicate empty headings and doc citations", () => {
  const source = [
    "## Title",
    "Preamble",
    "## ",
    "First",
    "## ",
    "Second",
  ].join("\n");
  const parsed = parseDoc("guide.md", source);
  assert.deepEqual(parsed.sections.map((section: { slug: string }) => section.slug), [
    "title",
    "section-2",
    "section-3",
  ]);
  const anchors = anchorsFor({
    requirements: [{ cites: ["doc: guide.md#section-3"] }],
  } as never, reader({ "guide.md": source }));
  assert.deepEqual(anchors.texts, { "doc: guide.md#section-3": "Second" });
});

test("invalid backtick fence info does not hide a heading", () => {
  const parsed = parseDoc("intent.md", [
    "## First",
    "```lang`bad",
    "## Visible",
    "Body",
  ].join("\n"));
  assert.deepEqual(parsed.sections.map((section: { slug: string }) => section.slug), [
    "first",
    "visible",
  ]);
  const anchors = anchorsFor({
    requirements: [{ cites: ["doc: intent.md#visible"] }],
  } as never, reader({
    "intent.md": "## First\n```lang`bad\n## Visible\nBody\n",
  }));
  assert.deepEqual(anchors.texts, { "doc: intent.md#visible": "Body" });
});

test("does not relocate anchors in more than 50,000 unterminated lines", () => {
  const hash = `sha256:${createHash("sha256").update("target").digest("hex")}`;
  const file = ["changed", "target", ...Array.from({ length: 49_999 }, (_, index) => `line ${index}`)].join("\n");
  assert.equal(file.endsWith("\n"), false);
  assert.deepEqual(flags({
    state: "blessed",
    digest: "sha256:same",
    blessed_digest: "sha256:same",
    anchors: { "src/a.ts:1": hash },
  }, reader({ "src/a.ts": file })), ["sources-changed"]);
});

test("walks and sorts the specification ladder without git", async () => {
      const parent = path.join(process.cwd(), "test", "specs");
      const root = await mkdtemp(path.join(parent, ".ladder-"));
      try {
        await mkdir(path.join(root, "tenet", "specs"), { recursive: true });
        await mkdir(path.join(root, "node_modules"), { recursive: true });
        await writeFile(path.join(root, "tenet", "specs", "b.md"), [
          "---",
          "tenet: {spec: 1, doc: b, level: L2}",
          "sections: {}",
          "---",
          "## Design",
          "B",
        ].join("\n"));
        await writeFile(path.join(root, "a.md"), [
          "---",
          "tenet: {spec: 1, doc: a, level: L0}",
          "sections: {}",
          "---",
          "## Vision",
          "A",
        ].join("\n"));
        await writeFile(path.join(root, "null.md"), "---\ntenet: {spec: 1, doc: null}\nsections: {}\n---\n");
        await writeFile(path.join(root, "not-spec.md"), "---\ntenet: {owner: ved}\n---\n");
        await writeFile(path.join(root, "node_modules", "ignored.md"), "---\ntenet: {spec: 1, level: L0}\n---\n");
        const entries = await ladder({ cwd: root });
        assert.deepEqual(entries.map((entry: { path: string; level: string | null }) => [
          entry.path,
          entry.level,
        ]), [
          ["a.md", "L0"],
          ["tenet/specs/b.md", "L2"],
          ["null.md", null],
        ]);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
});

test("computes renamed-document deltas and numeric ID ordering", async () => {
      const repository = await tmpRepo("deltas");
      const root = repository.path;
      try {
        const header = "---\ntenet: {spec: 1, doc: intent, level: L1}\nsections: {}\n---\n## Requirements\n";
        await materialize(root, {
          "tenet/old.md": `${header}- R-10 Ten. {origin: asked}\n- R-2 Two. {origin: asked}\n`,
        });
        repository.git(["add", "."]);
        repository.git(["commit", "--quiet", "-m", "base"]);
        const base = repository.git(["rev-parse", "HEAD"]).trim();
        await materialize(root, {
          "tenet/new.md": `${header}- R-10 Changed. {origin: asked}\n- R-1 One. {origin: asked}\n`,
        });
        repository.git(["add", "-A"]);
        repository.git(["commit", "--quiet", "-m", "head"]);
        const head = repository.git(["rev-parse", "HEAD"]).trim();
        assert.deepEqual(await deltas(base, head, { cwd: root }), [{
          doc: "intent",
          added: ["R-1"],
          modified: ["R-10"],
          removed: ["R-2"],
        }]);
      } finally {
        await repository.cleanup();
      }
});

test("touched ignores blessed-looking documents without tenet.spec", async () => {
      const repository = await tmpRepo("touched-spec");
      const root = repository.path;
      try {
        const ordinary = [
          "---",
          "tenet: {doc: ordinary}",
          "sections: {requirements: {state: blessed}}",
          "---",
          "## Requirements",
          "- R-9 Not a specification. {origin: asked}",
          "",
        ].join("\n");
        await materialize(root, { "docs/ordinary.md": ordinary, "src/a.ts": "old\n" });
        repository.git(["add", "."]);
        repository.git(["commit", "--quiet", "-m", "base"]);
        const base = repository.git(["rev-parse", "HEAD"]).trim();
        await materialize(root, { "docs/ordinary.md": ordinary, "src/a.ts": "new\n" });
        repository.git(["add", "-A"]);
        repository.git(["commit", "--quiet", "-m", "head"]);
        const head = repository.git(["rev-parse", "HEAD"]).trim();
        assert.deepEqual(await touched(base, head, ["R-9"], { cwd: root }), []);
      } finally {
        await repository.cleanup();
      }
});
