import type { ProofCard } from "../types/generated.js";

const badgeLabel = {
  advisory: "advisory",
  "verified-on-ci": "verified on CI",
  "intent-not-yet-blessed": "advisory · intent not yet blessed",
} as const;

const authorshipLabel = {
  "written-here": "written in this change",
  "tag-added-here": "tag added here",
  unknown: "existing test",
} as const;

function singleLine(value: string): string { return value.replace(/[\r\n]+/g, " "); }

function requirementTests(tests: ProofCard["requirements"][number]["tests"]): string {
  if (tests.failed) return `${tests.failed} tagged test(s) failed`;
  if (tests.not_run) return `${tests.not_run} tagged test(s) not run`;
  return `${tests.passed} tagged test${tests.passed === 1 ? "" : "s"} passed`;
}

function itemLine(item: ProofCard["items"][number], omitPassingNames: boolean): string {
  const names = item.names.join(", ");
  switch (item.result) {
    case "passed":
      return `  ✓ ${item.id} · test passed on this commit · ${authorshipLabel[item.authorship]}${omitPassingNames ? "" : ` · ${names}`}`;
    case "failed":
      return `  ✗ ${item.id} · test failed on this commit · ${authorshipLabel[item.authorship]} · ${item.first_failure ?? names}`;
    case "no-test": return `  ! ${item.id} · no test · nothing tagged [${item.id}]`;
    case "skipped": return `  ! ${item.id} · skipped · ${names}`;
    case "not-run": return item.tests.passed > 0
      ? `  ! ${item.id} · coverage not confirmed · ${item.tests.passed}/${item.tests.expected} tagged tests ran`
      : `  ! ${item.id} · not run · ${item.tests.expected} tagged test(s) did not run`;
  }
}

function markdown(model: ProofCard, omitPassingNames: boolean): string {
  const localPreview = (model as ProofCard & { "x-local-preview"?: boolean })["x-local-preview"] === true;
  const lines = [
    `### Tenet proof · ${model.tested.commit.slice(0, 6).toLowerCase()} (${model.tested.kind === "merge-candidate" ? "merge candidate" : "head"})${localPreview ? " · local preview" : ""} · ${badgeLabel[model.badge]}`,
  ];
  if (model.requirements.length) {
    lines.push("Your intent this change touches");
    for (const item of model.requirements) {
      if (item.why !== "same-area") lines.push(`  ${item.id} ${item.state} · "${item.excerpt}" · ${item.why} · ${requirementTests(item.tests)}`);
    }
    const same = model.requirements.filter((item) => item.why === "same-area").map((item) => item.id);
    if (same.length) lines.push(`  ${same.join(", ")} blessed · may be affected (same area)`);
  }
  lines.push("Acceptance");
  if (!model.items.length) lines.push("  ! no acceptance items · add the block from the template");
  else lines.push(...model.items.map((item) => itemLine(item, omitPassingNames)));

  const tests = model.tests;
  const testsClause = tests.report !== "ok" ? `not checked (report ${tests.report})` :
    tests.failed || tests.skipped ? `${tests.passed} passed, ${tests.failed} failed, ${tests.skipped} skipped` : `${tests.passed} passed`;
  const weakening = model.weakening;
  const unchecked = weakening.not_checked.length ? ` (not checked: ${weakening.not_checked.join(", ")})` : "";
  const weakened = weakening.found
    ? `! weakening detected: ${weakening.by.map((entry) => `${entry.finding} in ${entry.file} (${entry.names.join(", ")})`).join("; ")}${unchecked}`
    : `✓ no weakening detected by these checks${unchecked}`;
  const protectedFiles = model.protected.length || model.workflow_changed
    ? `! protected files touched: ${model.protected.join(", ")}${model.workflow_changed ? " (test workflow changed)" : ""}`
    : "✓ no protected files touched";
  lines.push(`Tests ${testsClause} · ${weakened} · ${protectedFiles}`);
  if (model.blessings_changed.length) {
    lines.push(`Blessings changed: ${model.blessings_changed.map((item) =>
      `${item.doc}#${item.section} blessed by ${item.blessed_by} (committed by ${item.commit_author})`).join(", ")}`);
  }
  if (model.deltas.length) lines.push(`Spec deltas: ${model.deltas.map((item) => `${item.doc} (+${item.added} ~${item.modified} -${item.removed})`).join(", ")}`);
  const blocked = model.rules.filter((rule) => rule.would_block);
  if (blocked.length) lines.push(`Would have blocked: ${blocked.map((rule) => rule.reason).join(" · ")}`);
  if (model.degraded.length) lines.push(`Degraded: ${model.degraded.join(" · ")}`);
  if (model.why.length) lines.push(`Why: ${model.why.map((reason) => `${reason.text} [${reason.class}]`).join(" · ")}`);
  return `${lines.map(singleLine).join("\n")}\n`;
}

export function renderCard(model: ProofCard): string { return markdown(model, false); }

export class SummaryOverflow extends RangeError {
  constructor(readonly essential: string) {
    super("required proof details exceed the check summary limit");
  }
}

export function renderCheckSummary(model: ProofCard, limit = 60_000): string {
  const full = renderCard(model);
  if (full.length <= limit) return full;
  const prominent = { ...model, requirements: model.requirements.filter(({ why }) => why !== "same-area") };
  const withoutSameArea = markdown(prominent, false);
  if (withoutSameArea.length <= limit) return withoutSameArea;
  const withoutPassingNames = markdown(prominent, true);
  if (withoutPassingNames.length <= limit) return withoutPassingNames;
  const essential = markdown({
    ...prominent, requirements: prominent.requirements.filter(({ tests }) => tests.expected === 0 ||
      tests.failed > 0 || tests.not_run > 0 || tests.passed < tests.expected),
  }, true);
  if (essential.length > limit) throw new SummaryOverflow(essential);
  return essential;
}
