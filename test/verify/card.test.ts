import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { buildVerify } from "./build.ts";

buildVerify();
const { renderCard, renderCheckSummary } = await import("../../dist/verify/card.js");
const { decodeBundle } = await import("../../dist/verify/bundle.js");
const { validate } = await import("../../dist/core/schema.js");
const fixtures = path.join("pkg", "conformance", "card");
const cases = readdirSync(fixtures, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
assert.equal(cases.length, 14);
for (const name of cases) {
  test(`independent card Markdown · ${name}`, () => {
    const dir = path.join(fixtures, name);
    const input = JSON.parse(readFileSync(path.join(dir, "input.json"), "utf8"));
    const expected = JSON.parse(readFileSync(path.join(dir, "expected.json"), "utf8"));
    assert.ok(validate("proof-card", expected.card).ok);
    const actual = Buffer.from(renderCard(expected.card));
    assert.deepEqual(actual, readFileSync(path.join(dir, "expected.md")));
    // The approved renderer cases carry normalized legacy shards. Exercise
    // the provenance boundary without treating those as valid CI bundles.
    assert.ok(input.bundles.length);
    for (const legacy of input.bundles) {
      assert.throws(() => decodeBundle(new Map([["bundle.json", Buffer.from(JSON.stringify(legacy))]])), /schema/);
    }
  });
}

test("summary trimming drops same-area items, then passing names and requirements while retaining protected findings", () => {
  const model = JSON.parse(readFileSync(path.join(fixtures, "p01-clean-pass-success", "expected.json"), "utf8")).card;
  model.protected = ["tenet.yaml"];
  model.rules = [{ rule: "budget", mode: "advise", would_block: true, reason: "keep this rule" }];
  const passingReq = model.requirements[0];
  const sameAreaReq = model.requirements[1];
  model.items[0].names = ["a".repeat(500)];
  sameAreaReq.id = "same-area".repeat(30);
  const full = renderCard(model);
  const withoutSameArea = renderCard({ ...model, requirements: [passingReq] });
  const summary = renderCheckSummary(model, withoutSameArea.length);
  assert.equal(summary, withoutSameArea);
  assert.ok(full.includes(sameAreaReq.id));
  const less = renderCheckSummary(model, withoutSameArea.length - 400);
  assert.ok(less.includes(passingReq.id));
  assert.ok(!less.includes("a".repeat(50)));
  passingReq.excerpt = "b".repeat(300);
  const smallest = renderCheckSummary(model, 350);
  assert.ok(!smallest.includes("b".repeat(20)));
  assert.match(smallest, /protected files touched: tenet.yaml/);
  assert.match(smallest, /Would have blocked: keep this rule/);
  model.items[0].result = "failed";
  model.items[0].first_failure = "c".repeat(500);
  assert.throws(() => renderCheckSummary(model, 350), /required proof details/);
});
