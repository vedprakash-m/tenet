import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "node:test";

const template = join(import.meta.dirname, "../../../plugin/skills/tenet-starter-ts-web-api/template");
const officialSource = "8201b20eec2908c3380ac600c91c8ba746346fbb808859366abb232027532311";
const officialLevel1Ids = "be42cd37e2669895b148dff36f5bda223d3486883c9db21ed5ae99f312958eea";

it("publishes every pinned ASVS5 Level1 ID with a method, explicit result and scoped applicability, not a conformance claim [QLT-02]", () => {
  const text = readFileSync(join(template, "docs/asvs.md"), "utf8");
  assert.ok(text.includes("v5.0.0"));
  assert.ok(text.includes(officialSource), "identify the exact official source used to select Level1");
  assert.ok(text.includes("Not ASVS conformance"));
  const rows = text.split("\n").filter(line => /^\| V\d+\./.test(line)).map(line => line.split("|").slice(1, -1).map(cell => cell.trim()));
  assert.equal(rows.length, 70, "all and only the official v5.0.0 L1 requirements are accounted for");
  const ids = rows.map(row => row[0]!);
  assert.equal(new Set(ids).size, ids.length, "each requirement has one disposition");
  assert.equal(createHash("sha256").update(ids.sort().join("\n") + "\n").digest("hex"), officialLevel1Ids);
  for (const row of rows) {
    assert.equal(row.length, 6, row.join(" | "));
    const [id, topic, applicability, method, result, evidence] = row;
    assert.ok(topic && topic.length > 3, id);
    assert.ok(["applicable", "not-applicable"].includes(applicability!), id);
    assert.ok(["behavioral+manual", "manual", "source-review"].includes(method!), id);
    assert.ok(["pending", "gap", "not-applicable"].includes(result!), "no full requirement pass is asserted by this initial inventory");
    assert.ok(evidence && evidence.length > 25, id);
    assert.equal(result === "not-applicable", applicability === "not-applicable", id);
    if (result === "not-applicable") {
      assert.equal(method, "source-review", id);
      assert.ok(evidence!.includes("No ") || evidence!.includes("Only "), "non-applicability names the absent capability or narrow boundary");
    }
  }
  for (const match of text.matchAll(/`((?:server|web|shared|docs)\/[^`]+)`/g)) {
    assert.ok(existsSync(join(template, match[1]!)), `evidence/procedure path exists: ${match[1]}`);
  }
});
