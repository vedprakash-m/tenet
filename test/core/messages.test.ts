import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { message, messageTemplate, messageTemplates } from "../../src/core/messages.ts";

const spec = new URL("../../tenet/specs/tech-spec/messages.md", import.meta.url);
const src = new URL("../../src/", import.meta.url);

function parseMessageRows(markdown: string): Record<string, { message: string; fix: string }> {
  return Object.fromEntries(
    [...markdown.matchAll(/^\|\s*\x60(TN-[A-Z0-9*-]+)\x60\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|[ \t]*$/gm)]
      .map(([, code, message, fix]) => [code, { message, fix }]),
  );
}

test("every canonical diagnostic template exactly matches messages.md", () => {
  const checkedOut = parseMessageRows(readFileSync(spec, "utf8"));
  assert.ok(Object.keys(checkedOut).length > 0);
  assert.deepEqual(messageTemplates, checkedOut);
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
  const pendingRegistration: string[] = [];
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
