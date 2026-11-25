import assert from "node:assert/strict";
import path from "node:path";
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

test("registry transport failures are environment errors", async () => {
  await assert.rejects(
    releaseIntegrity({
      environment: {
        installedVersion: "0.1.0-alpha.0",
        registry: { package: "@vedprakash-m/tenet" },
      },
    }, {
      registry: async () => {
        throw new Error("ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE");
      },
    }),
    (error: unknown) =>
      (error as { code?: string }).code === "TN-ENV-REGISTRY" &&
      (error as { message?: string }).message ===
        "Could not reach the npm registry to verify @vedprakash-m/tenet@0.1.0-alpha.0 " +
          "(ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE)." &&
      (error as { finding?: { fix?: string } }).finding?.fix ===
        "Check your network or proxy, or run `tenet init --offline` to record local package integrity.",
  );
});

test("upgrade registry failures recommend its offline command", async () => {
  await assert.rejects(
    releaseIntegrity({
      environment: {
        installedVersion: "0.1.0-alpha.0",
        registry: { package: "@vedprakash-m/tenet" },
      },
    }, {
      registry: async () => {
        throw new Error("ETIMEDOUT");
      },
    }, "upgrade"),
    (error: unknown) =>
      (error as { code?: string }).code === "TN-ENV-REGISTRY" &&
      (error as { finding?: { fix?: string } }).finding?.fix ===
        "Check your network or proxy, or run `tenet upgrade --offline` to record local package integrity.",
  );
});

test("registry lookup ignores target repository npm settings", async () => {
  const integrity = `sha512-${"A".repeat(86)}==`;
  const target = path.resolve("fixture-target");
  let invocation: { args: string[]; options: { cwd: string } } | null = null;
  const result = await releaseIntegrity({
    cwd: target,
    environment: {
      installedVersion: "0.1.0-alpha.0",
      registry: { package: "@vedprakash-m/tenet" },
    },
  }, {
    npmView: async (args, options) => {
      invocation = { args, options };
      return { status: 0, stdout: JSON.stringify(integrity), stderr: "" };
    },
  });

  assert.equal(result.integrity, integrity);
  assert.ok(invocation);
  assert.ok((invocation as { args: string[] }).args.includes("--registry=https://registry.npmjs.org/"));
  assert.notEqual((invocation as { options: { cwd: string } }).options.cwd, target);
  assert.equal(
    (invocation as { options: { cwd: string } }).options.cwd,
    path.resolve("."),
  );
});
