import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { tmpRepo } from "../helpers/tmpRepo.ts";
import { sectionDigest } from "../../dist/specs/sections.js";
import { check } from "../../dist/specs/check.js";
import { fix } from "../../dist/specs/fix.js";
import { split } from "../../dist/specs/split.js";
import { parseDoc } from "../../dist/specs/parse.js";

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
    assert.deepEqual(result.summary, { errors: 0, warnings: 0, advises: 1 });
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
      spec("tenet/specs/tech-spec.md", "design", `x${".".repeat(300)}`, "L2"),
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

test("citation rule mode controls severity", async () => {
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
    const advice = (await check({ cwd: repo.path })).findings.find((finding) =>
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

test("check processes 500 specification documents with one discovery pass", async () => {
  const repo = await tmpRepo("check-scale");
  try {
    await seed(repo);
    for (let index = 0; index < 500; index += 1) {
      await repo.write(
        `tenet/specs/part-${String(index).padStart(3, "0")}.md`,
        spec(`tenet/specs/part-${index}.md`, "requirements", `- R-${index + 2} Requirement ${index}.`),
      );
    }
    const started = performance.now();
    const result = await check({ cwd: repo.path });
    const elapsed = performance.now() - started;
    assert.deepEqual(Object.keys(result.summary), ["errors", "warnings", "advises"]);
    assert.ok(elapsed < 15_000, `check took ${Math.round(elapsed)}ms`);
  } finally {
    await repo.cleanup();
  }
});

