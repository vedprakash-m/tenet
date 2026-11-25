import assert from "node:assert/strict";
import test from "node:test";
import { releaseIntegrity } from "../../dist/install/integrity.js";

test("published prereleases query the registry", async () => {
  const integrity = `sha512-${"A".repeat(86)}==`;
  const calls: Array<[string, string]> = [];
  const result = await releaseIntegrity({
    environment: {
      installedVersion: "0.1.0-alpha.0",
      registry: { package: "@vedprakash-m/tenet" },
    },
  }, {
    registry: async (packageName, version) => {
      calls.push([packageName, version]);
      return integrity;
    },
  });
  assert.deepEqual(calls, [["@vedprakash-m/tenet", "0.1.0-alpha.0"]]);
  assert.equal(result.integrity, integrity);
  assert.equal(result.warning, undefined);
});
