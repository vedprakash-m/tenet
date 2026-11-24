import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../../../../dist/core/schema.js";
import { decodeBundle, parseBundledReport } from "../../../../dist/verify/bundle.js";
import { renderCard } from "../../../../dist/verify/card.js";
import { evaluationId } from "../../../../dist/verify/record.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const cardRoot = path.join(root, "pkg", "conformance", "card");
const cases = readdirSync(cardRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

assert.equal(cases.length, 14, "Expected 14 card conformance cases");

for (const slug of cases) {
  const dir = path.join(cardRoot, slug);
  const input = JSON.parse(readFileSync(path.join(dir, "input.json"), "utf8"));
  const expected = JSON.parse(readFileSync(path.join(dir, "expected.json"), "utf8"));
  const expectedMd = readFileSync(path.join(dir, "expected.md"), "utf8");

  // 1. Validate expected.card against kit/schemas/proof-card.json and renderCard against expected.md
  const cardSchema = validate("proof-card", expected.card);
  assert.equal(cardSchema.ok, true, `${slug}: expected.card failed proof-card schema`);
  assert.equal(renderCard(expected.card), expectedMd, `${slug}: renderCard(expected.card) differs from expected.md`);

  // 2. Validate event.evaluation_input tuple computes a 16-hex evaluationId
  assert.ok(input.event && input.event.evaluation_input, `${slug}: missing event.evaluation_input`);
  const computedId = evaluationId(input.event.evaluation_input);
  assert.match(computedId, /^[0-9a-f]{16}$/, `${slug}: invalid computed evaluationId`);

  // 3. Validate every bundle entry against kit/schemas/bundle.json, decodeBundle, and parseBundledReport
  assert.ok(Array.isArray(input.bundles) && input.bundles.length > 0, `${slug}: missing bundles[]`);
  for (const [idx, entry] of input.bundles.entries()) {
    assert.ok(entry && typeof entry === "object" && entry.bundle && entry.files, `${slug}: bundle[${idx}] missing {bundle, files}`);
    const bundleSchema = validate("bundle", entry.bundle);
    assert.equal(bundleSchema.ok, true, `${slug}: bundle[${idx}] failed bundle.json schema: ${JSON.stringify(bundleSchema.errors)}`);

    const filesMap = new Map([
      ["bundle.json", Buffer.from(JSON.stringify(entry.bundle), "utf8")],
      ...Object.entries(entry.files).map(([name, text]) => [name, Buffer.from(String(text), "utf8")])
    ]);
    const decoded = decodeBundle(filesMap);
    assert.equal(decoded.bundle.run.id, entry.bundle.run.id, `${slug}: decoded bundle run.id mismatch`);

    for (const check of decoded.bundle.checks) {
      if (check.report !== "none") {
        const raw = filesMap.get(check.report);
        assert.ok(raw, `${slug}: missing report bytes for ${check.report}`);
        const parsed = await parseBundledReport(check["x-report-kind"] ?? "junit", raw, "C");
        assert.ok(parsed.cases.length > 0, `${slug}: parsed report for ${check.name} had 0 cases`);
      }
    }
  }

  // 4. Validate target policy in repo.baseFiles (or previousBaseFiles in n06) against kit/schemas/tenet-yaml.json
  const policyText = slug === "n06-policy-load-failure-fallback"
    ? input.repo.previousBaseFiles["tenet.yaml"]
    : input.repo.baseFiles["tenet.yaml"];
  const policySchema = validate("tenet-yaml", JSON.parse(policyText));
  assert.equal(policySchema.ok, true, `${slug}: target tenet.yaml failed tenet-yaml schema`);
  if (slug === "n06-policy-load-failure-fallback") {
    assert.throws(() => JSON.parse(input.repo.baseFiles["tenet.yaml"]), `${slug}: expected baseFiles.tenet.yaml to be invalid`);
  }
}

console.log(`Verified all ${cases.length} pkg/conformance/card cases: bundle.json schema, decodeBundle, parseBundledReport, tenet-yaml schema, proof-card schema, and renderCard.`);
