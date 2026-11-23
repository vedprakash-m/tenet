import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { message, messageTemplate, messageTemplates } from "../../src/core/messages.ts";

const spec = new URL("../../tenet/specs/tech-spec/messages.md", import.meta.url);
const src = new URL("../../src/", import.meta.url);

// Approved rows from 07ff12d:tenet/specs/tech-spec/messages.md while the
// specification and implementation branches are being prepared independently.
const approvedRows = [
  "| `TN-BUDGET-WARN` | File {path} is at or over 90% of its token budget ({tokens} / {limit} tokens). | Trim {path} or run `tenet split` to extract a section into a part. |",
  "| `TN-POLICY-ALPHA0-CAP` | The {rule} rule is capped at advise in alpha.0. | The configured mode will take effect when rule modes are available. |",
  "| `TN-POLICY-SCHEMA` | tenet.yaml does not match the alpha.0 schema: {detail}. | Fix tenet.yaml or remove fields that are not available in alpha.0. |",
  "| `TN-SPEC-UNCOVERED-VISION` | Blessed vision item {id} is not served by a blessed requirement or listed under ## Not yet in scope. | Add serves: {id} to a blessed requirement or list {id} under a blessed ## Not yet in scope section. |",
  "| `TN-USAGE-BUDGET` | Context token budget {budget} must be a positive integer. | Pass a positive integer to `--budget-tokens` or `budget_tokens`. |",
  "| `TN-USAGE-REF` | The git ref is invalid. | Pass a repository ref. |"
];

function parseMessageRows(markdown: string): Record<string, { message: string; fix: string }> {
  return Object.fromEntries(
    [...markdown.matchAll(/^\|\s*\x60(TN-[A-Z0-9*-]+)\x60\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|[ \t]*$/gm)]
      .map(([, code, message, fix]) => [code, { message, fix }]),
  );
}

test("every canonical diagnostic template exactly matches messages.md and the approved round 4 rows", () => {
  const checkedOut = parseMessageRows(readFileSync(spec, "utf8"));
  const approved = parseMessageRows(approvedRows.join("\n"));
  assert.ok(Object.keys(checkedOut).length > 0);
  assert.equal(Object.keys(approved).length, approvedRows.length);
  // Once the answer rows reach this branch, the checked-in spec alone is authoritative.
  const answersInSpec = Object.keys(approved).some((code) => Object.hasOwn(checkedOut, code));
  const expected = answersInSpec ? checkedOut : { ...checkedOut, ...approved };
  assert.deepEqual(messageTemplates, expected);
});

function usedCodes(directory: URL): Set<string> {
  const result = new Set<string>();
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const code of usedCodes(new URL(`${encodeURIComponent(entry.name)}/`, directory))) result.add(code);
    } else if (entry.isFile()) {
      const source = readFileSync(new URL(encodeURIComponent(entry.name), directory), "utf8");
      for (const [code] of source.matchAll(/\bTN-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*\b(?!-)/g)) result.add(code);
    }
  }
  return result;
}

test("all source diagnostics resolve except the exact pre-existing unregistered codes", () => {
  // These codes predate the catalog and have no published template on this branch.
  // Exact comparison rejects any new missing code and any stale exception.
  const pendingRegistration = [
    "TN-ENV-OFFLINE",
    "TN-INTERNAL",
    "TN-KIT-INVALID",
    "TN-KIT-MISSING",
    "TN-LOCK-INVALID",
    "TN-LOCK-MISSING",
  ];
  const codes = usedCodes(src);
  assert.deepEqual([...codes].filter((code) => messageTemplate(code) === undefined).sort(), pendingRegistration);
});

test("message uses specific rows before wildcard defaults and substitutes literal values", () => {
  assert.deepEqual(message("TN-GATE-UNKNOWN", { missing: "an owner" }), {
    message: "Policy applicability is unknown because an owner is missing.",
    fix: "Define an owner in tenet.yaml or CODEOWNERS and re-run.",
  });
  assert.deepEqual(message("TN-USAGE-UNKNOWN-FLAG", { command: "check", detail: "unknown flag $&" }), {
    message: "Invalid usage for \x60tenet check\x60: unknown flag $&.",
    fix: "Run \x60tenet check --help\x60 for valid arguments and flags.",
  });
  assert.deepEqual(message("TN-USAGE-REF"), {
    message: "The git ref is invalid.",
    fix: "Pass a repository ref.",
  });
  assert.throws(() => message("TN-CITE-FILE"), /Missing diagnostic variable path/);
  assert.throws(() => message("UNKNOWN"), /Unknown diagnostic code/);
});
