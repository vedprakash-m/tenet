import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { context, contextSummary, contextWithFindings } from "../../dist/context/index.js";
import { sectionDigest } from "../../dist/specs/sections.js";

async function repo(): Promise<{ cwd: string; write(filename: string, text: string): Promise<void> }> {
  const cwd = await mkdtemp(path.join(process.cwd(), ".cp45-context-"));
  return {
    cwd,
    async write(filename, text) {
      const target = path.join(cwd, ...filename.split("/"));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, text);
    },
  };
}

async function policy(target: Awaited<ReturnType<typeof repo>>, level = "observe"): Promise<void> {
  await target.write("tenet.yaml", JSON.stringify({
    standard: "0.1.0-alpha.0",
    kit_path: "kit",
    paths: { records: "tenet" },
    level,
    specs: { id_prefix: "R", documents: [{ path: "intent.md", level: "L1" }] },
  }));
}

async function blessed(
  target: Awaited<ReturnType<typeof repo>>,
  body: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const digest = sectionDigest(body);
  const copy = "tenet/blessed/tenet__intent.md/requirements.md";
  await target.write("tenet/intent.md", [
    "---",
    `tenet: ${JSON.stringify({ spec: 1, doc: "intent", level: "L1", owner: "payments" })}`,
    `sections: ${JSON.stringify({
      requirements: {
        state: "blessed",
        digest,
        blessed_digest: digest,
        blessed_copy: copy,
        anchors: {},
        flags: [],
        ...extra,
      },
    })}`,
    "---",
    "## Requirements",
    body,
  ].join("\n"));
  await target.write(copy, body);
}

test("returns all six keys and keeps a matching draft excluded by default", async () => {
  const target = await repo();
  try {
    await policy(target);
    await target.write("tenet/intent.md", [
      "---",
      "tenet: {spec: 1, doc: intent, level: L1, owner: payments}",
      "sections: {experience: {state: draft, flags: [], applies_to: ['src/**']}}",
      "---",
      "## Experience",
      "Show a wait indicator.",
    ].join("\n"));
    const result = await context({ cwd: target.cwd, paths: ["src/retry.ts"] });
    assert.deepEqual(Object.keys(result), ["blessed", "drafts", "index", "omitted", "truncated", "rules"]);
    assert.deepEqual(result.drafts, []);
    assert.deepEqual(result.blessed, []);
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("reads the blessed copy and computes source-change flags", async () => {
  const target = await repo();
  try {
    await policy(target);
    await blessed(
      target,
      "- R-1 Retry once. {origin: asked; cites: src/retry.ts:1}\n",
      { anchors: { "src/retry.ts:1": "sha256:1f6e3f" }, owner: "checkout" },
    );
    await target.write("src/retry.ts", "const retry = 2;\n");
    const result = await context({ cwd: target.cwd, paths: ["src"] });
    assert.equal(result.blessed[0]?.id, "R-1");
    assert.equal(result.blessed[0]?.text, "Retry once.");
    assert.equal(result.blessed[0]?.owner, "checkout");
    assert.deepEqual(result.blessed[0]?.flags, ["sources-changed"]);
    assert.equal(result.blessed[0]?.reason, "path");
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("uses exact group precedence and deduplicates an ID selected by multiple groups", async () => {
  const target = await repo();
  try {
    await policy(target);
    await blessed(
      target,
      "- R-1 Retry once. {origin: asked; cites: src/retry.ts:1}\n",
    );
    await target.write("src/retry.ts", "run();\n");
    const result = await context({
      cwd: target.cwd,
      ids: ["R-1"],
      paths: ["src/retry.ts"],
      query: "retry",
    });
    assert.equal(result.blessed.length, 1);
    assert.equal(result.blessed[0]?.id, "R-1");
    assert.equal(result.blessed[0]?.reason, "id");
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("admits globals first, omits a whole local item, and can index remaining requirements", async () => {
  const target = await repo();
  try {
    await policy(target);
    const local = "Follow the bounded retry policy before returning. ".repeat(20).trim();
    await blessed(target, [
      "- R-9 Keep keys off disk. {origin: asked; scope: global}",
      `- R-1 ${local} {origin: asked; cites: src/retry.ts:1}`,
      "- R-2 Show retry count. {origin: asked}",
      "",
    ].join("\n"));
    await target.write("src/retry.ts", "run();\n");
    const result = await context({ cwd: target.cwd, paths: ["src/retry.ts"], budget_tokens: 50 });
    assert.deepEqual(result.blessed.map((item) => item.id), ["R-9"]);
    assert.deepEqual(result.omitted, ["R-1"]);
    assert.equal(result.truncated, true);
    assert.deepEqual(result.index, [{ id: "R-2", title: "Show retry count." }]);
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("continues scanning after an omitted item and admits a later smaller path item", async () => {
  const target = await repo();
  try {
    await policy(target);
    const long = "This local promise is intentionally too long. ".repeat(20).trim();
    await blessed(target, [
      `- R-1 ${long} {origin: asked; cites: src/retry.ts:1}`,
      "- R-2 Retry once. {origin: asked; cites: src/retry.ts:1}",
      "",
    ].join("\n"));
    await target.write("src/retry.ts", "run();\n");
    const result = await context({
      cwd: target.cwd,
      paths: ["src/retry.ts"],
      budget_tokens: 10,
    });
    assert.deepEqual(result.blessed.map((item) => item.id), ["R-2"]);
    assert.deepEqual(result.omitted, ["R-1"]);
    assert.equal(result.truncated, true);
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("returns an explicitly named item whole when it exceeds the budget", async () => {
  const target = await repo();
  try {
    await policy(target);
    const text = "Keep the complete promise. ".repeat(30).trim();
    await blessed(target, `- R-1 ${text} {origin: asked}\n`);
    const result = await context({ cwd: target.cwd, ids: ["R-1"], budget_tokens: 10 });
    assert.equal(result.blessed[0]?.text, text);
    assert.equal(result.blessed[0]?.over_budget, true);
    assert.deepEqual(result.omitted, []);
    assert.equal(result.truncated, false);
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("serves a broken blessed copy as a draft using working-tree text", async () => {
  const target = await repo();
  try {
    await policy(target);
    await blessed(target, "- R-1 Retry once. {origin: asked; cites: src/retry.ts:1}\n");
    await target.write(
      "tenet/blessed/tenet__intent.md/requirements.md",
      "- R-1 Retry forever. {origin: asked; cites: src/retry.ts:1}\n",
    );
    const details = await contextWithFindings({
      cwd: target.cwd,
      paths: ["src/retry.ts"],
    });
    const result = details.result;
    assert.deepEqual(result.blessed, []);
    assert.equal(result.drafts.length, 1);
    assert.equal(result.drafts[0]?.integrity_failed, true);
    assert.equal(result.drafts[0]?.state, "draft");
    assert.match(result.drafts[0]?.text ?? "", /Retry once/);
    assert.equal(details.findings[0]?.code, "TN-SPEC-BLESSED-COPY");
    assert.equal(details.findings[0]?.severity, "warning");
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("selects prose by applies_to and matches query headings case-insensitively", async () => {
  const target = await repo();
  try {
    await policy(target);
    const prose = "Show the checkout total.\n";
    const digest = sectionDigest(prose);
    await target.write("tenet/intent.md", [
      "---",
      "tenet: {spec: 1, doc: intent, level: L1, owner: payments}",
      `sections: {experience: ${JSON.stringify({
        state: "blessed",
        digest,
        blessed_digest: digest,
        blessed_copy: "tenet/blessed/intent/experience.md",
        applies_to: ["src/ui/**"],
        flags: [],
        anchors: {},
      })}}`,
      "---",
      "## Experience",
      prose,
    ].join("\n"));
    await target.write("tenet/blessed/intent/experience.md", prose);
    const pathResult = await context({ cwd: target.cwd, paths: ["src/ui/cart.ts"] });
    assert.equal(pathResult.blessed[0]?.id, "intent#experience");
    assert.equal(pathResult.blessed[0]?.reason, "applies_to");

    const queryResult = await context({ cwd: target.cwd, query: "EXPERI" });
    assert.equal(queryResult.blessed[0]?.id, "intent#experience");
    assert.equal(queryResult.blessed[0]?.reason, "query");
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("keeps mixed-section prose independently selectable by path and heading", async () => {
  const target = await repo();
  try {
    await policy(target);
    const body = [
      "The checkout flow always shows the current total.",
      "| ID | Requirement | Origin | Cites |",
      "|---|---|---|---|",
      "| R-1 | Retry the display once. | asked | src/ui/cart.ts:1 |",
      "",
    ].join("\n");
    await blessed(target, body, { applies_to: ["src/ui/**"] });
    await target.write("src/ui/cart.ts", "renderTotal();\n");

    const pathResult = await context({ cwd: target.cwd, paths: ["src/ui/cart.ts"] });
    assert.ok(pathResult.blessed.some((item) =>
      item.id === "intent#requirements" &&
      item.text.includes("The checkout flow always shows the current total.") &&
      item.reason === "applies_to"
    ));

    const headingResult = await context({ cwd: target.cwd, query: "REQUIREMENTS" });
    assert.ok(headingResult.blessed.some((item) =>
      item.id === "intent#requirements" && item.reason === "query"
    ));
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("[AB-B1] [F-53] ranks specific applies_to prose before a broad fallback", async () => {
  const target = await repo();
  try {
    await policy(target);
    const global = "- R-9 Keep secrets out of specifications. {origin: asked; scope: global}\n";
    const broad = `${"General project guidance. ".repeat(18).trim()}\n`;
    const specific = `${"Resolve configuration from the application settings. ".repeat(4).trim()}\n`;
    const records = {
      broad: {
        state: "blessed",
        digest: sectionDigest(broad),
        blessed_digest: sectionDigest(broad),
        blessed_copy: "tenet/blessed/intent/broad.md",
        applies_to: ["**"],
        flags: [],
        anchors: {},
      },
      specific: {
        state: "blessed",
        digest: sectionDigest(specific),
        blessed_digest: sectionDigest(specific),
        blessed_copy: "tenet/blessed/intent/specific.md",
        applies_to: ["app/**"],
        flags: [],
        anchors: {},
      },
      global: {
        state: "blessed",
        digest: sectionDigest(global),
        blessed_digest: sectionDigest(global),
        blessed_copy: "tenet/blessed/intent/global.md",
        flags: [],
        anchors: {},
      },
    };
    await target.write("tenet/intent.md", [
      "---",
      "tenet: {spec: 1, doc: intent, level: L1, owner: payments}",
      `sections: ${JSON.stringify(records)}`,
      "---",
      "## Broad",
      broad,
      "## Specific",
      specific,
      "## Global",
      global,
    ].join("\n"));
    await target.write("tenet/blessed/intent/broad.md", broad);
    await target.write("tenet/blessed/intent/specific.md", specific);
    await target.write("tenet/blessed/intent/global.md", global);

    const result = await context({
      cwd: target.cwd,
      paths: ["app/config/resolve.py"],
      budget_tokens: 70,
    });
    assert.deepEqual(result.blessed.map(({ id }) => id), ["R-9", "intent#specific"]);
    assert.deepEqual(result.omitted, ["intent#broad"]);
    assert.equal(result.index.some(({ id }) => id === "intent#broad"), true);
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("[AB-B2] [F-38] selects and budgets draft statements by paths, IDs and query", async () => {
  const target = await repo();
  try {
    await policy(target);
    await target.write("tenet/intent.md", [
      "---",
      "tenet: {spec: 1, doc: intent, level: L1, owner: payments}",
      `sections: ${JSON.stringify({
        drafts: {
          state: "draft",
          flags: [],
          applies_to: ["app/**"],
        },
        unrelated: {
          state: "draft",
          flags: [],
          applies_to: ["docs/**"],
        },
      })}`,
      "---",
      "## Drafts",
      "- R-10 Resolve configuration from the app settings. {origin: asked; cites: app/config.py:1}",
      "- R-11 Retry the external service once. {origin: asked}",
      "## Unrelated",
      "Keep the documentation index current.",
    ].join("\n"));

    const byPath = await context({
      cwd: target.cwd,
      paths: ["app/config.py"],
      include_drafts: true,
      budget_tokens: 100,
    });
    assert.deepEqual(byPath.drafts.map(({ id }) => id), ["R-10", "intent#drafts"]);
    const section = byPath.drafts.find(({ id }) => id === "intent#drafts");
    assert.match(section?.text ?? "", /R-10/);
    assert.match(section?.text ?? "", /R-11/);

    const byId = await context({
      cwd: target.cwd,
      ids: ["R-11"],
      include_drafts: true,
      budget_tokens: 1,
    });
    assert.deepEqual(byId.drafts.map(({ id }) => id), ["R-11"]);
    assert.equal(byId.drafts[0]?.text, "Retry the external service once.");

    const byQuery = await context({
      cwd: target.cwd,
      query: "CONFIGURATION",
      include_drafts: true,
      budget_tokens: 20,
    });
    assert.equal(byQuery.drafts.some(({ id, text }) =>
      id === "R-10" && text === "Resolve configuration from the app settings."
    ), true);
    assert.equal(byQuery.drafts.some(({ section }) => section === "unrelated"), false);

    assert.match(contextSummary(byPath), /tenet\/intent\.md#drafts/);
    assert.match(contextSummary(byPath), /Resolve configuration from the app settings/);
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("[AB-B3] [F-52] context accepts comma, repeated and variadic --paths values", async () => {
  const target = await repo();
  try {
    await policy(target);
    const cli = path.join(process.cwd(), "dist", "cli.js");
    for (const values of [
      ["--paths", "src/a.ts,src/b.ts"],
      ["--paths", "src/a.ts", "--paths", "src/b.ts"],
      ["--paths", "src/a.ts", "src/b.ts"],
    ]) {
      const child = spawnSync(
        process.execPath,
        [cli, "--json", "--cwd", target.cwd, "context", ...values],
        { encoding: "utf8" },
      );
      assert.equal(child.status, 0, child.stderr);
    }
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("uses canonical usage text for invalid context budgets and selectors", async () => {
  await assert.rejects(
    context({ budget_tokens: 0 }),
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "TN-USAGE-BUDGET" &&
      "message" in error &&
      error.message === "Context token budget 0 must be a positive integer." &&
      "fix" in error &&
      error.fix === "Pass a positive integer to `--budget-tokens` or `budget_tokens`.",
  );
  await assert.rejects(
    context({ paths: [1] as unknown as string[] }),
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "TN-USAGE-CONTEXT" &&
      "message" in error &&
      error.message === "Invalid usage for `tenet context`: paths must be strings.",
  );
});

test("honors quiet and rejects context positional arguments", async () => {
  const target = await repo();
  try {
    await policy(target);
    const cli = path.join(process.cwd(), "dist", "cli.js");
    const quiet = spawnSync(
      process.execPath,
      [cli, "--quiet", "--cwd", target.cwd, "context"],
      { encoding: "utf8" },
    );
    assert.equal(quiet.status, 0, quiet.stderr);
    assert.equal(quiet.stdout, "");

    const positional = spawnSync(
      process.execPath,
      [cli, "--cwd", target.cwd, "context", "stray"],
      { encoding: "utf8" },
    );
    assert.equal(positional.status, 2);
    assert.equal(positional.stdout, "");
    assert.match(positional.stderr, /TN-USAGE-CONTEXT/);
    assert.match(positional.stderr, /unexpected positional arguments: stray/);
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("reports the five active alpha.0 rules in pack order", async () => {
  const target = await repo();
  try {
    await policy(target, "protect");
    const result = await context({ cwd: target.cwd });
    assert.deepEqual(result.rules.map((item) => item.rule), [
      "tests-not-weakened",
      "protected-surfaces",
      "acceptance-passed",
      "citations-valid",
      "budget",
    ]);
    assert.equal(result.rules[0]?.mode, "advise");
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("joins CODEOWNERS principals and excludes rejected drafts", async () => {
  const target = await repo();
  try {
    await policy(target);
    await blessed(target, "- R-1 Retry once. {origin: asked}\n", { owner: undefined });
    await target.write(".github/CODEOWNERS", "tenet/ @payments @reviewers\n");
    await target.write("tenet/intent.md", (await (await import("node:fs/promises")).readFile(
      path.join(target.cwd, "tenet/intent.md"),
      "utf8",
    )).replace(',"owner":"payments"', ""));
    const result = await context({ cwd: target.cwd, ids: ["R-1"], include_drafts: true });
    assert.equal(result.blessed[0]?.owner, "@payments, @reviewers");

    const digest = sectionDigest("Rejected text.\n");
    await target.write("tenet/intent.md", [
      "---",
      "tenet: {spec: 1, doc: intent, level: L1}",
      `sections: {rejected: {state: rejected, digest: '${digest}', flags: []}}`,
      "---",
      "## Rejected",
      "Rejected text.",
    ].join("\n"));
    const rejected = await context({ cwd: target.cwd, include_drafts: true });
    assert.deepEqual(rejected.drafts, []);
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});
