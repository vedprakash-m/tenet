import assert from "node:assert/strict";
import test from "node:test";
import { releaseIntegrity } from "../../dist/install/integrity.js";

import { packageVersion } from "../helpers/packageVersion.ts";

const prereleaseVersion = `${packageVersion}-rc.1`;

test("published prereleases query the registry", async () => {
  const integrity = `sha512-${"A".repeat(86)}==`;
  const calls: Array<[string, string]> = [];
  const result = await releaseIntegrity({
    environment: {
      installedVersion: prereleaseVersion,
      registry: { package: "@vedprakash-m/tenet" },
    },
  }, {
    registry: async (packageName, version) => {
      calls.push([packageName, version]);
      return integrity;
    },
  });
  assert.deepEqual(calls, [["@vedprakash-m/tenet", prereleaseVersion]]);
  assert.equal(result.integrity, integrity);
  assert.equal(result.warning, undefined);
});
