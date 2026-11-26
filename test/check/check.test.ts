import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { pathToFileURL } from "node:url";
import { tmpRepo } from "../helpers/tmpRepo.ts";

const buildRoot = path.resolve(`.test-check-build-${process.pid}`);
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
    "--outDir", buildRoot,
    "--rootDir", "src",
    "src/specs/check.ts",
    "src/specs/fix.ts",
    "src/specs/split.ts",
    "src/specs/sections.ts",
    "src/commands/check.ts",
    "src/commands/fix.ts",
    "src/commands/split.ts",
  ],
  { cwd: process.cwd(), encoding: "utf8" },
);
if (build.status !== 0) throw new Error(build.stderr || build.stdout);

const module = (filename: string) => pathToFileURL(path.join(buildRoot, filename)).href;
const [
  { sectionDigest },
  { check },
  { fix },
  { split },
  { parseDoc },
  { checkCommand },
  { fixCommand },
  { splitCommand },
] = await Promise.all([
  import(module("specs/sections.js")),
  import(module("specs/check.js")),
  import(module("specs/fix.js")),
  import(module("specs/split.js")),
  import(module("specs/parse.js")),
  import(module("commands/check.js")),
  import(module("commands/fix.js")),
  import(module("commands/split.js")),
]);

after(async () => {
  await rm(buildRoot, { recursive: true, force: true });
});

const policy = {
  standard: "0.1.0-alpha.0",
  kit_path: "kit",
  paths: { records: "tenet" },
  level: "observe",
  specs: {
    id_prefix: "R",
    documents: [
      { path: "vision.md", level: "L0" },
      { path: "specs/prd.md", level: "L1" },
      { path: "specs/tech-spec.md", level: "L2" },
    ],
  },
  owners: [{ id: "owner", name: "Owner", roles: ["owner"] }],
};

function spec(path: string, slug: string, body: string, level = "L1"): string {
  const front = {
    tenet: {
      spec: 1,
      doc: path.includes("vision") ? "vision" : path.includes("prd") ? "prd" : "tech-spec",
      level,
      version: "0.1",
      owner: "owner",
    },
    sections: {
      [slug]: {
        state: "draft",
        digest: sectionDigest(body),
        flags: [],
      },
    },
  };
  return `---\n${JSON.stringify(front, null, 2)}\n---\n## ${slug.replaceAll("-", " ")}\n${body}\n`;
}

function specSections(
  path: string,
  sections: Array<{ slug: string; body: string; state?: "draft" | "blessed" }>,
  level = "L1",
): string {
  const front = {
    tenet: {
      spec: 1,
      doc: path.includes("prd") ? "prd" : "tech-spec",
      level,
      version: "0.1",
      owner: "owner",
    },
    sections: Object.fromEntries(sections.map((section) => [
      section.slug,
      {
        state: section.state ?? "draft",
        digest: sectionDigest(section.body),
        flags: [],
      },
    ])),
  };
  const body = sections.map((section) =>
    `## ${section.slug[0]?.toUpperCase()}${section.slug.slice(1)}\n${section.body}`,
  ).join("\n\n");
  return `---\n${JSON.stringify(front, null, 2)}\n---\n${body}\n`;
}

async function seed(repo: Awaited<ReturnType<typeof tmpRepo>>): Promise<void> {
  await repo.write("tenet.yaml", JSON.stringify(policy, null, 2));
  await repo.write("kit/TENET.md", "# Kit\n");
  await repo.write("tenet/vision.md", spec("tenet/vision.md", "vision", "- V-1 Predictable. {origin: asked}", "L0"));
  await repo.write("tenet/specs/prd.md", spec(
    "tenet/specs/prd.md",
    "requirements",
    "- R-1 Predictable checkout. {origin: asked; serves: V-1}",
  ));
  await repo.write("tenet/specs/tech-spec.md", spec(
    "tenet/specs/tech-spec.md",
    "design",
    "Predictable checkout.",
    "L2",
  ));
  await repo.write("tenet/specs/ux-spec.md", spec(
    "tenet/specs/ux-spec.md",
    "experience",
    "Clear checkout.",
    "L2",
  ));
  await repo.write("tenet/specs/plan.md", spec(
    "tenet/specs/plan.md",
    "plan",
    "Small changes.",
    "L2",
  ));
}

type ConformanceCase = {
  operation: "check";
  options: Record<string, unknown>;
  repo: {
    installedVersion: string;
    files: Record<string, string>;
    baseFiles?: Record<string, string>;
  };
};

function project(value: unknown, expected: unknown, location: string): void {
  if (
    expected &&
    typeof expected === "object" &&
    !Array.isArray(expected) &&
    (expected as Record<string, unknown>).$assert === "present"
  ) {
    assert.notEqual(value, undefined, `${location} is absent`);
    return;
  }
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(value), `${location} is not an array`);
    assert.equal(value.length, expected.length, `${location} length: ${JSON.stringify(value)}`);
    for (let index = 0; index < expected.length; index += 1) {
      project(value[index], expected[index], `${location}[${index}]`);
    }
    return;
  }
  if (expected && typeof expected === "object") {
    assert.ok(value && typeof value === "object" && !Array.isArray(value), `${location} is not an object`);
    for (const [key, wanted] of Object.entries(expected)) {
      project((value as Record<string, unknown>)[key], wanted, `${location}.${key}`);
    }
    return;
  }
  assert.deepEqual(value, expected, location);
}

const conformanceRoot = path.resolve("pkg/conformance/check");
const caseNames = (await readdir(conformanceRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const caseName of caseNames) {
  test(`check conformance case ${caseName}`, async () => {
    const input = JSON.parse(
      await readFile(path.join(conformanceRoot, caseName, "input.json"), "utf8"),
    ) as ConformanceCase;
    const expected = JSON.parse(
      await readFile(path.join(conformanceRoot, caseName, "expected.json"), "utf8"),
    ) as unknown;
    assert.equal(input.operation, "check");
    const repo = await tmpRepo(`check-case-${caseName}`);
    try {
      const baseFiles = input.repo.baseFiles ?? input.repo.files;
      for (const [filename, contents] of Object.entries(baseFiles)) {
        await repo.write(filename, contents);
      }
      repo.git(["add", "."]);
      repo.git(["commit", "--quiet", "--allow-empty", "-m", "fixture base"]);
      if (input.repo.baseFiles) repo.git(["branch", "fixture-base"]);
      for (const [filename, contents] of Object.entries(input.repo.files)) {
        await repo.write(filename, contents);
      }
      const result = await check({
        cwd: repo.path,
        ...input.options,
        ...(input.repo.baseFiles ? { base: "fixture-base" } : {}),
        installedVersion: input.repo.installedVersion,
      });
      project(result, expected, caseName);
    } finally {
      await repo.cleanup();
    }
  });
}

test("check and fix limit discovery to the active specification set", async () => {
  for (const explicit of [false, true]) {
    const repo = await tmpRepo(`bounded-ladder-${explicit ? "explicit" : "one-file"}`);
    try {
      const documents = explicit
        ? [{ path: "vision.md", level: "L0" }]
        : undefined;
      await repo.write("tenet.yaml", JSON.stringify({
        standard: "0.1.0-alpha.0",
        kit_path: "kit",
        paths: { records: "tenet" },
        level: "observe",
        specs: {
          id_prefix: "R",
          ...(documents ? { documents } : {}),
        },
      }, null, 2));
      await repo.write("kit/TENET.md", "# Kit\n");
      const activePath = explicit ? "tenet/vision.md" : "tenet/intent.md";
      const activeBody = explicit
        ? "- V-1 Predictable. {origin: asked}\n"
        : "- R-1 Predictable. {origin: asked}\n";
      await repo.write(activePath, spec(
        activePath,
        explicit ? "vision" : "requirements",
        activeBody,
        explicit ? "L0" : "L1",
      ));
      await repo.write("kit/templates/requirements.md", spec(
        "kit/templates/requirements.md",
        "requirements",
        "- R-999 Fixture. {origin: documented; cites: missing.ts:1}",
      ));
      repo.git(["add", "."]);
      repo.git(["commit", "-qm", "base"]);
      repo.git(["branch", "fixture-only"]);

      const result = await check({ cwd: repo.path });
      assert.equal(
        result.findings.some((finding) =>
          finding.file === "kit/templates/requirements.md" ||
          finding.message.includes("missing.ts")),
        false,
      );
      const repaired = await fix({ cwd: repo.path, dryRun: true });
      assert.equal(
        repaired.changes.some((change) =>
          change.path.startsWith("kit/templates/")),
        false,
      );
      if (!explicit) {
        await repo.write(activePath, spec(
          activePath,
          "requirements",
          "- R-1 Predictable. {origin: asked}\n- Needs an ID. {origin: asked}",
        ));
        repo.git(["add", activePath]);
        repo.git(["commit", "-qm", "add unnumbered item"]);
        await fix({ cwd: repo.path });
        assert.match(
          await readFile(path.join(repo.path, ...activePath.split("/")), "utf8"),
          /- R-2 Needs an ID\./,
        );
      }
    } finally {
      await repo.cleanup();
    }
  }
});

test("check resolves citations with canonical findings", async () => {
  const repo = await tmpRepo("check-citation");
  try {
    await seed(repo);
    await repo.write(
      "tenet/specs/prd.md",
      spec(
        "tenet/specs/prd.md",
        "requirements",
        "- R-1 Checkout. {origin: asked; cites: src/missing.ts:1}",
      ),
    );
    const result = await check({ cwd: repo.path });
    assert.equal(result.findings.length, 1);
    assert.deepEqual(
      result.findings[0] && {
        code: result.findings[0].code,
        message: result.findings[0].message,
        fix: result.findings[0].fix,
      },
      {
        code: "TN-CITE-FILE",
        message: "Cited file src/missing.ts was not found.",
        fix: "Update the citation path or restore src/missing.ts.",
      },
    );
    assert.deepEqual(result.summary, { errors: 1, warnings: 0, advises: 0 });
  } finally {
    await repo.cleanup();
  }
});

test("check canonicalizes malformed inherited citation findings", async () => {
  const repo = await tmpRepo("check-malformed-citation");
  try {
    await seed(repo);
    await repo.write(
      "tenet/specs/prd.md",
      spec(
        "tenet/specs/prd.md",
        "requirements",
        "- R-1 Checkout. {origin: asked; cites: test: test/retry.test.ts}",
      ),
    );
    const finding = (await check({ cwd: repo.path })).findings.find((item) =>
      item.code === "TN-CITE-RANGE");
    assert.equal(
      finding?.message,
      "Citation test: test/retry.test.ts has an invalid line range or format.",
    );
    assert.equal(
      finding?.fix,
      "Fix test: test/retry.test.ts to use a valid path:line or path:start-end within file length.",
    );
  } finally {
    await repo.cleanup();
  }
});

test("check warns at the local budget threshold and only crosses in CI", async () => {
  const repo = await tmpRepo("check-budget");
  try {
    await seed(repo);
    const localPolicy = structuredClone(policy);
    localPolicy.specs.documents[2] = { path: "specs/tech-spec.md", level: "L2", budget: 100 } as never;
    await repo.write("tenet.yaml", JSON.stringify(localPolicy, null, 2));
    await repo.write(
      "tenet/specs/tech-spec.md",
      spec("tenet/specs/tech-spec.md", "design", "small", "L2"),
    );
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "base"]);
    await repo.write(
      "tenet/specs/tech-spec.md",
      spec("tenet/specs/tech-spec.md", "design", `x${".".repeat(400)}`, "L2"),
    );
    const local = await check({ cwd: repo.path });
    const warning = local.findings.find((finding) => finding.code === "TN-BUDGET-WARN");
    assert.equal(warning?.severity, "warning");
    const crossing = await check({ cwd: repo.path, ci: true, base: "HEAD" });
    assert.equal(crossing.findings.filter((finding) => finding.code === "TN-BUDGET").length, 1);
  } finally {
    await repo.cleanup();
  }
});

test("check reports uncovered blessed vision with exact location and text", async () => {
  const repo = await tmpRepo("check-vision");
  try {
    await seed(repo);
    await repo.write(
      "tenet/vision.md",
      spec("tenet/vision.md", "vision", "- V-1 Predictable. {origin: asked}", "L0")
        .replace('"state": "draft"', '"state": "blessed"'),
    );
    await repo.write(
      "tenet/specs/prd.md",
      spec(
        "tenet/specs/prd.md",
        "requirements",
        "- R-1 Predictable checkout. {origin: asked}",
      ),
    );
    const visionText = spec("tenet/vision.md", "vision", "- V-1 Predictable. {origin: asked}", "L0");
    const visionLine = visionText.split("\n").findIndex((line) => line.startsWith("- V-1")) + 1;
    const finding = (await check({ cwd: repo.path })).findings.find((item) =>
      item.code === "TN-SPEC-UNCOVERED-VISION");
    assert.deepEqual(finding, {
      code: "TN-SPEC-UNCOVERED-VISION",
      severity: "error",
      rule: null,
      file: "tenet/vision.md",
      line: visionLine,
      message: "Blessed vision item V-1 is not served by a blessed requirement or listed under ## Not yet in scope.",
      fix: "Add serves: V-1 to a blessed requirement or list V-1 under a blessed ## Not yet in scope section.",
    });
  } finally {
    await repo.cleanup();
  }
});

test("only a blessed not-yet-in-scope section defers vision coverage", async () => {
  const repo = await tmpRepo("check-vision-defer");
  try {
    await seed(repo);
    await repo.write(
      "tenet/vision.md",
      spec("tenet/vision.md", "vision", "- V-1 Predictable. {origin: asked}", "L0")
        .replace('"state": "draft"', '"state": "blessed"'),
    );
    await repo.write("tenet/specs/prd.md", spec(
      "tenet/specs/prd.md",
      "not-yet-in-scope",
      "- V-1 Later.",
    ));
    assert.ok((await check({ cwd: repo.path })).findings.some((item) =>
      item.code === "TN-SPEC-UNCOVERED-VISION"));
    const blessed = spec(
      "tenet/specs/prd.md",
      "not-yet-in-scope",
      "- V-1 Later.",
    ).replace('"state": "draft"', '"state": "blessed"');
    await repo.write("tenet/specs/prd.md", blessed);
    assert.ok(!(await check({ cwd: repo.path })).findings.some((item) =>
      item.code === "TN-SPEC-UNCOVERED-VISION"));
    const onlyExamples = spec(
      "tenet/specs/prd.md",
      "not-yet-in-scope",
      "V-1 is only prose.\n\n```md\n- V-1 Fenced example.\n```",
    ).replace('"state": "draft"', '"state": "blessed"');
    await repo.write("tenet/specs/prd.md", onlyExamples);
    assert.ok((await check({ cwd: repo.path })).findings.some((item) =>
      item.code === "TN-SPEC-UNCOVERED-VISION"));
  } finally {
    await repo.cleanup();
  }
});

test("check owns duplicate IDs once and paths skip cross-document duplicates", async () => {
  const repo = await tmpRepo("check-duplicate-owner");
  try {
    await seed(repo);
    await repo.write("tenet/specs/tech-spec.md", spec(
      "tenet/specs/tech-spec.md",
      "design",
      "- R-1 Duplicate. {origin: asked}",
      "L2",
    ));
    await repo.write(
      "tenet/specs/prd.md",
      spec(
        "tenet/specs/prd.md",
        "requirements",
        "- R-1 First. {origin: asked}\n- R-1 Same-document later. {origin: asked}",
      ),
    );
    const full = await check({ cwd: repo.path });
    assert.equal(full.findings.filter((finding) => finding.code === "TN-SPEC-DUP-ID").length, 2);
    const scoped = await check({ cwd: repo.path, paths: ["tenet/specs/prd.md"] });
    assert.equal(scoped.findings.filter((finding) => finding.code === "TN-SPEC-DUP-ID").length, 1);
  } finally {
    await repo.cleanup();
  }
});

test("fix assigns IDs, front matter and digests idempotently", async () => {
  const repo = await tmpRepo("fix-id");
  try {
    await seed(repo);
    await repo.write("src/retry.ts", "export const retry = 1;\n");
    const body = "- Keep retry stable. {origin: asked; cites: .\\\\src\\\\retry.ts:1}\n- R-1 Duplicate. {origin: asked}";
    await repo.write("tenet/specs/prd.md", spec("tenet/specs/prd.md", "requirements", body));
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "seed"]);
    const first = await fix({ cwd: repo.path });
    assert.ok(first.changes.some((change) => change.path === "tenet/specs/prd.md"));
    const fixed = await readFile(`${repo.path}/tenet/specs/prd.md`, "utf8");
    assert.match(fixed, /- R-\d+ Keep retry stable/);
    assert.match(fixed, /cites: src\/retry.ts:1/);
    const parsed = parseDoc("tenet/specs/prd.md", fixed);
    assert.equal(parsed.problems.length, 0);
    assert.equal(parsed.front?.tenet && typeof parsed.front.tenet === "object", true);
    const second = await fix({ cwd: repo.path });
    assert.deepEqual(second.changes, []);
  } finally {
    await repo.cleanup();
  }
});

test("fix replaces only the duplicate statement at its line", async () => {
  const repo = await tmpRepo("fix-line-target");
  try {
    await seed(repo);
    await repo.write(
      "tenet/specs/prd.md",
      spec(
        "tenet/specs/prd.md",
        "requirements",
        "- R-40 Keep this statement.\n- R-40 Renumber this statement.",
      ),
    );
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "seed"]);
    await fix({ cwd: repo.path });
    const text = await readFile(`${repo.path}/tenet/specs/prd.md`, "utf8");
    assert.match(text, /- R-40 Keep this statement\./);
    assert.match(text, /- R-\d+ Renumber this statement\./);
    assert.doesNotMatch(text, /- R-40 Renumber this statement\./);
  } finally {
    await repo.cleanup();
  }
});

test("fix renumbers an unblessed duplicate and preserves a blessed ID", async () => {
  const repo = await tmpRepo("fix-duplicate");
  try {
    await seed(repo);
    const original = spec(
      "tenet/specs/prd.md",
      "requirements",
      "- R-1 Blessed requirement. {origin: asked}",
    ).replace('"state": "draft"', '"state": "blessed"');
    await repo.write("tenet/specs/prd.md", original);
    await repo.write(
      "tenet/specs/prd/duplicate.md",
      spec("tenet/specs/prd/duplicate.md", "requirements", "- R-1 Draft requirement. {origin: asked}"),
    );
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "seed"]);
    await fix({ cwd: repo.path });
    const blessed = await readFile(`${repo.path}/tenet/specs/prd.md`, "utf8");
    const draft = await readFile(`${repo.path}/tenet/specs/prd/duplicate.md`, "utf8");
    assert.match(blessed, /R-1 Blessed requirement/);
    assert.doesNotMatch(draft, /R-1 Draft requirement/);
  } finally {
    await repo.cleanup();
  }
});

test("fix and check distinguish conflicting IDs across branches", async () => {
  const repo = await tmpRepo("check-branches");
  try {
    await seed(repo);
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "seed"]);
    repo.git(["branch", "conflict"]);
    repo.git(["checkout", "conflict", "--quiet"]);
    await repo.write(
      "tenet/specs/prd.md",
      spec(
        "tenet/specs/prd.md",
        "requirements",
        "- R-1 A conflicting blessed requirement. {origin: asked}",
      ).replace('"state": "draft"', '"state": "blessed"'),
    );
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "blessed conflict"]);
    repo.git(["checkout", "-", "--quiet"]);
    const beforeFix = await check({ cwd: repo.path });
    assert.equal(
      beforeFix.findings.filter((finding) => finding.code === "TN-SPEC-DUP-ID").length,
      0,
    );
    await fix({ cwd: repo.path });
    const current = await readFile(`${repo.path}/tenet/specs/prd.md`, "utf8");
    assert.doesNotMatch(current, /- R-1 Predictable checkout/);
    await repo.write(
      "tenet/specs/prd.md",
      current.replace('"state": "draft"', '"state": "blessed"'),
    );
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "both blessed"]);
    const result = await check({ cwd: repo.path });
    assert.equal(
      result.findings.filter((finding) => finding.code === "TN-SPEC-DUP-ID").length,
      0,
    );
    await repo.write(
      "tenet/specs/prd.md",
      spec(
        "tenet/specs/prd.md",
        "requirements",
        "- R-1 A different current blessing. {origin: asked}",
      ).replace('"state": "draft"', '"state": "blessed"'),
    );
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "conflicting blessing"]);
    const bothBlessed = await check({ cwd: repo.path });
    assert.equal(
      bothBlessed.findings.filter((finding) => finding.code === "TN-SPEC-DUP-ID").length,
      1,
    );
  } finally {
    await repo.cleanup();
  }
});

test("check recomputes stale stored flags without a schema error", async () => {
  const repo = await tmpRepo("check-stale-flags");
  try {
    await seed(repo);
    const filename = "tenet/specs/prd.md";
    const source = await readFile(path.join(repo.path, filename), "utf8");
    await repo.write(filename, source.replace('"flags": []', '"flags": ["edited"]'));
    repo.git(["add", "."]);
    repo.git(["commit", "-qm", "stale stored flags"]);
    const result = await check({ cwd: repo.path });
    assert.equal(result.findings.some((finding) =>
      finding.code === "TN-SCHEMA" && finding.file === filename), false);
  } finally {
    await repo.cleanup();
  }
});

test("split moves a section, leaves a pointer, and rewrites links", async () => {
  const repo = await tmpRepo("split");
  try {
    await seed(repo);
    await repo.write("tenet/specs/prd.md", specSections("tenet/specs/prd.md", [
      { slug: "requirements", body: "- R-1 Predictable. {origin: asked}" },
      { slug: "details", body: "Implementation details." },
    ]));
    await repo.write("README.md", "# README\n\n[Details](tenet/specs/prd.md#details)\n");
    const result = await split("tenet/specs/prd.md", "details", repo.path);
    assert.equal(result.moved, "tenet/specs/prd/details.md");
    const source = await readFile(`${repo.path}/tenet/specs/prd.md`, "utf8");
    const moved = await readFile(`${repo.path}/tenet/specs/prd/details.md`, "utf8");
    const readme = await readFile(`${repo.path}/README.md`, "utf8");
    assert.match(source, /See \[Details\]\(prd\/details\.md#details\)/);
    assert.match(moved, /Implementation details\./);
    assert.match(readme, /tenet\/specs\/prd\/details\.md#details/);
  } finally {
    await repo.cleanup();
  }
});

test("split refuses an existing destination and rebases moved outgoing links", async () => {
  const repo = await tmpRepo("split-integrity");
  try {
    await seed(repo);
    await repo.write("README.md", "## Readme\n");
    await repo.write("tenet/specs/prd.md", specSections("tenet/specs/prd.md", [
      { slug: "requirements", body: "- R-1 Predictable. {origin: asked}" },
      {
        slug: "details",
        body: "[Readme](../../README.md#readme)\n[Requirements](#requirements)",
      },
    ]));
    const source = await readFile(`${repo.path}/tenet/specs/prd.md`, "utf8");
    const destination = "tenet/specs/prd/details.md";
    await repo.write(destination, "keep me\n");
    await assert.rejects(split("tenet/specs/prd.md", "details", repo.path), /already exists/);
    assert.equal(await readFile(`${repo.path}/tenet/specs/prd.md`, "utf8"), source);
    assert.equal(await readFile(`${repo.path}/${destination}`, "utf8"), "keep me\n");
    await (await import("node:fs/promises")).rm(`${repo.path}/${destination}`);
    await split("tenet/specs/prd.md", "details", repo.path);
    const moved = await readFile(`${repo.path}/${destination}`, "utf8");
    assert.match(moved, /\[Readme\]\(\.\.\/\.\.\/\.\.\/README\.md#readme\)/);
    assert.match(moved, /\[Requirements\]\(\.\.\/prd\.md#requirements\)/);
  } finally {
    await repo.cleanup();
  }
});

test("fix preserves metadata and files when a blessed sidecar cannot move", async () => {
  const repo = await tmpRepo("fix-move-failure");
  try {
    await seed(repo);
    const body = "- R-1 Predictable checkout. {origin: asked}";
    const front = spec("tenet/specs/prd.md", "requirements", body)
      .replace("## requirements", "## Renamed")
      .replace(
        '"state": "draft"',
        '"state": "blessed",\n        "blessed_copy": "tenet/blessed/requirements.md"',
      );
    await repo.write("tenet/specs/prd.md", front);
    await repo.write("tenet/blessed/requirements.md", body);
    const original = await readFile(`${repo.path}/tenet/specs/prd.md`, "utf8");
    await assert.rejects(fix({ cwd: repo.path }), /sidecar|anchors\.json/);
    assert.equal(await readFile(`${repo.path}/tenet/specs/prd.md`, "utf8"), original);
    assert.equal(await readFile(`${repo.path}/tenet/blessed/requirements.md`, "utf8"), body);
  } finally {
    await repo.cleanup();
  }
});

test("split confines relative document and output paths", async () => {
  const repo = await tmpRepo("split-confine");
  try {
    await seed(repo);
    await assert.rejects(
      split("../outside.md", "requirements", repo.path),
      /outside the repository/,
    );
    await assert.rejects(
      split(path.resolve(repo.path, "tenet/specs/prd.md"), "requirements", repo.path),
      /must be relative/,
    );
  } finally {
    await repo.cleanup();
  }
});

test("paths scope omits repository-wide and lock checks", async () => {
  const repo = await tmpRepo("check-paths");
  try {
    await seed(repo);
    const vendored = structuredClone(policy);
    vendored.kit_path = ".tenet/kit";
    await repo.write("tenet.yaml", JSON.stringify(vendored, null, 2));
    await repo.write(
      "tenet/specs/prd.md",
      spec(
        "tenet/specs/prd.md",
        "requirements",
        "- R-1 Broken cite. {origin: asked; cites: missing.ts:1}",
      ),
    );
    const result = await check({ cwd: repo.path, paths: ["tenet/specs/prd.md"] });
    assert.ok(result.findings.some((finding) => finding.code === "TN-CITE-FILE"));
    assert.ok(!result.findings.some((finding) =>
      finding.code === "TN-KIT-EDITED" || finding.code === "TN-LOCK-MISMATCH"));
  } finally {
    await repo.cleanup();
  }
});

test("--paths command option scopes check and commands keep canonical usage findings", async () => {
  const repo = await tmpRepo("check-command-paths");
  try {
    await seed(repo);
    const vendored = structuredClone(policy);
    vendored.kit_path = ".tenet/kit";
    await repo.write("tenet.yaml", JSON.stringify(vendored, null, 2));
    const context = {
      args: [],
      options: { "--paths": "tenet/specs/prd.md" },
      cwd: repo.path,
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
      now: () => new Date(),
      json: true,
      quiet: false,
      verbose: false,
      offline: false,
    };
    const outcome = await checkCommand.run?.(context);
    assert.ok(outcome && "findings" in outcome);
    assert.ok(!(outcome.findings ?? []).some((finding) =>
      finding.code === "TN-KIT-EDITED" || finding.code === "TN-LOCK-MISMATCH"));
    await assert.rejects(
      () => fixCommand.run?.({ ...context, args: ["extra"] }),
      (finding: unknown) =>
        (finding as { message?: string; fix?: string }).message ===
          "Invalid usage for `tenet fix`: unexpected positional arguments: extra." &&
        (finding as { fix?: string }).fix ===
          "Run `tenet fix --help` for valid arguments and flags.",
    );
    await assert.rejects(
      () => splitCommand.run?.({ ...context, args: [] }),
      (finding: unknown) =>
        (finding as { message?: string }).message ===
          "Invalid usage for `tenet split`: expected <document> <section>.",
    );
  } finally {
    await repo.cleanup();
  }
});

test("direct check keeps citation diagnostics as errors", async () => {
  const repo = await tmpRepo("check-citation-mode");
  try {
    await seed(repo);
    await repo.write(
      "tenet/specs/prd.md",
      spec(
        "tenet/specs/prd.md",
        "requirements",
        "- R-1 Broken. {origin: asked; cites: missing.ts:1}",
      ),
    );
    const finding = (await check({ cwd: repo.path })).findings.find((item) =>
      item.code === "TN-CITE-FILE");
    assert.equal(finding?.severity, "error");
  } finally {
    await repo.cleanup();
  }
});

test("check applies citation rule modes in CI", async () => {
  const repo = await tmpRepo("check-citation-ci-mode");
  try {
    await seed(repo);
    await repo.write(
      "tenet/specs/prd.md",
      spec(
        "tenet/specs/prd.md",
        "requirements",
        "- R-1 Broken. {origin: asked; cites: missing.ts:1}",
      ),
    );
    const advice = (await check({ cwd: repo.path, ci: true, base: "HEAD" })).findings.find((finding) =>
      finding.code === "TN-CITE-FILE");
    assert.equal(advice?.severity, "advise");
  } finally {
    await repo.cleanup();
  }
});

test("kit and lock failures are independent and use tenet.lock location", async () => {
  const repo = await tmpRepo("check-kit-lock");
  try {
    await seed(repo);
    const vendored = structuredClone(policy);
    vendored.kit_path = ".tenet/kit";
    await repo.write("tenet.yaml", JSON.stringify(vendored, null, 2));
    await repo.write(".tenet/kit/TENET.md", "# Edited\n");
    await repo.write("tenet.lock", JSON.stringify({
      schema_version: 1,
      package: "@vedprakash-m/tenet",
      version: "9.9.9",
      integrity: `sha512-${"A".repeat(86)}==`,
      kit_sha256: "0".repeat(64),
    }, null, 2));
    const findings = (await check({
      cwd: repo.path,
      installedVersion: "8.8.8",
    })).findings.filter((finding) =>
      finding.code === "TN-KIT-EDITED" || finding.code === "TN-LOCK-MISMATCH");
    assert.deepEqual(findings.map((finding) => [
      finding.code,
      finding.severity,
      finding.file,
    ]), [
      ["TN-KIT-EDITED", "error", "tenet.lock"],
      ["TN-LOCK-MISMATCH", "warning", "tenet.lock"],
    ]);
  } finally {
    await repo.cleanup();
  }
});

test("one-file layout requires intent instead of the configured ladder", async () => {
  const repo = await tmpRepo("check-one-file");
  try {
    await seed(repo);
    const oneFilePolicy = {
      standard: policy.standard,
      kit_path: policy.kit_path,
      paths: policy.paths,
      level: policy.level,
      owners: policy.owners,
    };
    await repo.write("tenet.yaml", JSON.stringify(oneFilePolicy, null, 2));
    for (const filename of [
      "vision.md",
      "specs/prd.md",
      "specs/tech-spec.md",
      "specs/ux-spec.md",
      "specs/plan.md",
    ]) {
      await (await import("node:fs/promises")).rm(`${repo.path}/tenet/${filename}`);
    }
    await repo.write(
      "tenet/intent.md",
      spec("tenet/intent.md", "requirements", "- R-1 One file. {origin: asked}"),
    );
    assert.ok(!(await check({ cwd: repo.path })).findings.some((finding) =>
      finding.code === "TN-SCHEMA" && finding.message.includes("spec-ladder")));
  } finally {
    await repo.cleanup();
  }
});

test("required ladder documents are reported and findings are stably ordered", async () => {
  const repo = await tmpRepo("check-required");
  try {
    await seed(repo);
    await repo.write(
      "tenet/specs/prd.md",
      spec(
        "tenet/specs/prd.md",
        "requirements",
        "- R-1 Broken. {origin: asked; cites: z.ts:1}",
      ),
    );
    await repo.write("tenet/specs/tech-spec.md", spec(
      "tenet/specs/tech-spec.md",
      "design",
      "Valid.",
      "L2",
    ));
    await assert.doesNotReject(
      import("node:fs/promises").then(({ rm }) =>
        rm(`${repo.path}/tenet/specs/tech-spec.md`)),
    );
    const result = await check({ cwd: repo.path });
    const missing = result.findings.find((finding) =>
      finding.code === "TN-SCHEMA" && finding.file === "tenet/specs/tech-spec.md");
    assert.deepEqual(missing, {
      code: "TN-SCHEMA",
      severity: "error",
      rule: null,
      file: "tenet/specs/tech-spec.md",
      line: null,
      message: "File tenet/specs/tech-spec.md failed spec-ladder schema validation at /specs/documents.",
      fix: "Update tenet/specs/tech-spec.md at /specs/documents to match the spec-ladder schema.",
    });
    const keys = result.findings.map((finding) =>
      [finding.file ?? "", finding.line ?? 0, finding.code, finding.message]);
    assert.deepEqual(keys, [...keys].sort((left, right) => {
      for (let index = 0; index < 4; index += 1) {
        const a = left[index];
        const b = right[index];
        if (typeof a === "number" && typeof b === "number" && a !== b) return a - b;
        if (typeof a === "string" && typeof b === "string" && a !== b) return a < b ? -1 : 1;
      }
      return 0;
    }));
  } finally {
    await repo.cleanup();
  }
});

test("check preserves the missing-policy diagnostic", async () => {
  const repo = await tmpRepo("check-missing-policy");
  try {
    await seed(repo);
    await rm(`${repo.path}/tenet.yaml`);
    await assert.rejects(check({ cwd: repo.path }), {
      code: "TN-POLICY-MISSING",
      finding: {
        code: "TN-POLICY-MISSING",
        severity: "error",
        rule: null,
        file: "tenet.yaml",
        line: null,
        message: "Policy file tenet.yaml was not found.",
        fix: "Run `tenet init` to create tenet.yaml.",
      },
    });
  } finally {
    await repo.cleanup();
  }
});

test("check meets cold and warm 500-document timing with batched Git calls", async () => {
  const repo = await tmpRepo("check-scale");
  try {
    await seed(repo);
    const expectedFiles: string[] = [];
    let requirementLine = -1;
    for (let index = 0; index < 500; index += 1) {
      const filename = `tenet/specs/part-${String(index).padStart(3, "0")}.md`;
      const contents = spec(
        filename,
        "requirements",
        `- R-${index + 2} Requirement ${index}.`,
      );
      requirementLine = contents.split("\n").findIndex((line) =>
        line.startsWith(`- R-${index + 2} `)) + 1;
      await repo.write(
        filename,
        contents,
      );
      expectedFiles.push(filename);
    }
    await repo.write("tenet.yaml", JSON.stringify({
      ...policy,
      specs: {
        ...policy.specs,
        documents: [
          ...policy.specs.documents,
          ...expectedFiles.map((filename) => ({
            path: filename.slice("tenet/".length),
            level: "L2",
          })),
        ],
      },
    }, null, 2));
    repo.git(["add", "."]);
    repo.git(["commit", "--quiet", "-m", "scale fixture"]);
    const trace = path.join(repo.path, "git-trace.json");
    const previousTrace = process.env.GIT_TRACE2_EVENT;
    process.env.GIT_TRACE2_EVENT = trace;
    try {
      const expectedFindings = expectedFiles.map((file) => ({
        code: "TN-SPEC-REQ-META",
        severity: "error" as const,
        rule: null,
        file,
        line: requirementLine,
        message: "Requirement metadata is malformed: check closing braces, allowed keys, and origin.",
        fix: "Fix the `{…}` metadata block with allowed keys and valid origin.",
      }));
      const assertComplete = (result: Awaited<ReturnType<typeof check>>) => {
        assert.deepEqual(result, {
          findings: expectedFindings,
          summary: { errors: 500, warnings: 0, advises: 0 },
        });
      };
      const run = async () => {
        await rm(trace, { force: true });
        const started = performance.now();
        const result = await check({ cwd: repo.path });
        const elapsed = performance.now() - started;
        const events = (await readFile(trace, "utf8")).trim().split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as { event?: string; argv?: string[] });
        const gitOperations = events.flatMap((event) => {
          if (event.event !== "start" || !event.argv) return [];
          const known = event.argv.find((argument) =>
            ["cat-file", "for-each-ref", "ls-tree", "rev-parse", "symbolic-ref"].includes(argument));
          return [known ?? event.argv.slice(1).join(" ")];
        });
        assertComplete(result);
        assert.ok(gitOperations.length <= 6, `check issued ${gitOperations.length} Git calls`);
        for (const operation of new Set(gitOperations)) {
          assert.equal(
            gitOperations.filter((candidate) => candidate === operation).length,
            1,
            `check repeated Git ${operation}`,
          );
        }
        return { elapsed, gitOperations };
      };
      const cold = await run();
      const warm = await run();
      assert.deepEqual(warm.gitOperations, cold.gitOperations, "cold and warm Git behavior changed");
      assert.ok(cold.elapsed < 30_000, `cold check took ${Math.round(cold.elapsed)}ms`);
      assert.ok(warm.elapsed < 15_000, `warm check took ${Math.round(warm.elapsed)}ms`);
      assert.ok(
        warm.elapsed <= Math.max(3_000, cold.elapsed * 1.5),
        `warm check took ${Math.round(warm.elapsed)}ms after ${Math.round(cold.elapsed)}ms cold`,
      );
    } finally {
      if (previousTrace === undefined) delete process.env.GIT_TRACE2_EVENT;
      else process.env.GIT_TRACE2_EVENT = previousTrace;
    }
  } finally {
    await repo.cleanup();
  }
});


test("[AB-A6] [F-49] blessing metadata does not count toward a document budget", async (t) => {
  const repo = await tmpRepo("body-budget");
  t.after(repo.cleanup);
  await seed(repo);
  const body = "## Requirements\n- R-1 Keep a receipt. {origin: asked}";
  const filename = "tenet/specs/prd.md";
  const text = spec(filename, "requirements", body.split("\n")[1] ?? "")
    .replace('"state": "draft"', '"state": "draft", "anchors": {"src/receipt.js:1": "sha256:' + "a".repeat(64) + '"}');
  await repo.write(filename, text);
  const policyText = await readFile(path.join(repo.path, "tenet.yaml"), "utf8");
  const policy = JSON.parse(policyText);
  policy.specs.documents.find(({ path }: { path: string }) => path === "specs/prd.md").budget = 35;
  await repo.write("tenet.yaml", JSON.stringify(policy));
  const result = await check({ cwd: repo.path });
  assert.equal(result.findings.some(({ code, file }) => code.startsWith("TN-BUDGET") && file === filename), false);
});

test("[AB-A7] [F-50] draft requirements account for a grouped vision warning at observe", async (t) => {
  const repo = await tmpRepo("draft-vision-coverage");
  t.after(repo.cleanup);
  await seed(repo);
  const body = "- V-1 Keep a receipt. {origin: asked}\n- V-2 List the format. {origin: asked}\n";
  const copy = "tenet/blessed/tenet__vision.md/vision.md";
  const document = spec("tenet/vision.md", "vision", body.trimEnd(), "L0");
  const front = JSON.parse(document.split("\n---\n")[0]?.slice(4) ?? "");
  Object.assign(front.sections.vision, {
    state: "blessed",
    blessed_copy: copy,
    blessed_digest: sectionDigest(body),
    blessed_at_rev: "a".repeat(40),
    blessed_by: "owner",
    blessed_at: "2026-11-26T10:00:00Z",
    recorded: "self",
    anchors: {},
  });
  await repo.write("tenet/vision.md", `---\n${JSON.stringify(front)}\n---\n## vision\n${body}`);
  await repo.write(copy, body);
  await repo.write(`${copy}.anchors.json`, "{}");
  await repo.write("tenet/specs/prd.md", spec("tenet/specs/prd.md", "requirements", [
    "- R-1 Keep a printed receipt. {origin: asked; serves: V-1}",
    "- R-2 List the receipt format. {origin: asked; serves: V-2}",
  ].join("\n")));
  const result = await check({ cwd: repo.path });
  const coverage = result.findings.filter(({ code }) => code.includes("VISION"));
  assert.equal(coverage.length, 1);
  assert.equal(coverage[0]?.severity, "warning");
  assert.equal(coverage[0]?.message, "2 vision items wait for a blessed requirement; bless the PRD next");
  assert.equal(result.summary.errors, 0);
});

