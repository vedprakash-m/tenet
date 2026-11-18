import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const directory = process.argv[2];
const bundle = process.argv[3];
if (!directory || !bundle) throw new Error("usage: node tools/uat/verify-groups.mjs <report-directory> <bundle>");
const inventory = JSON.parse(readFileSync(resolve("tools/uat-inventory.json"), "utf8"));
const root = resolve(directory);
const bundleDigest = createHash("sha256").update(readFileSync(resolve(bundle))).digest("hex");
const actualFiles = readdirSync(root).filter((name) => name.endsWith(".json")).sort();
const expectedFiles = ["ubuntu-latest", "macos-latest"].flatMap((os) =>
  inventory.groups.map((group) => `uat-${os}-${group.id}.json`));
assert.deepEqual(actualFiles, expectedFiles.slice().sort(), "UAT report set is not exact");

for (const os of ["ubuntu-latest", "macos-latest"]) {
  const bundleDigests = new Set();
  const ids = [];
  for (const group of inventory.groups) {
    const report = JSON.parse(readFileSync(join(root, `uat-${os}-${group.id}.json`), "utf8"));
    assert.equal(report.group, group.id, `UAT group differs for ${os}`);
    assert.equal(report.observations.length, group.observations, `UAT count differs for ${os}/${group.id}`);
    assert.match(report.bundle?.sha256 ?? "", /^[a-f0-9]{64}$/);
    assert.equal(report.bundle.sha256, bundleDigest, `${os}/${group.id} did not run the admitted shared bundle`);
    bundleDigests.add(report.bundle.sha256);
    const expected = inventory.cases.slice(group.start - 1, group.end);
    assert.deepEqual(report.observations.map((item) => item.id), expected.map((item) => item.id));
    ids.push(...report.observations.map((item) => item.id));
  }
  assert.equal(bundleDigests.size, 1, `${os} UAT groups did not consume one bundle digest`);
  assert.deepEqual(ids, inventory.cases.map((item) => item.id), `${os} UAT union differs`);
}

console.log(`UAT groups: ${inventory.observations} cases on 2 operating systems`);
