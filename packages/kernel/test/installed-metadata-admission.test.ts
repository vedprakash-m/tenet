import assert from "node:assert/strict";
import { linkSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { createStack } from "../src/adapters/node-ts.ts";
import { NAPI_METADATA_SCAFFOLD } from "../src/adapters/installed-metadata.ts";
import { KernelError } from "../src/core/errors.ts";
import { observeToolchain } from "../src/verbs/check-rerun.ts";
import { cleanup, tmp, write } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

describe("installed metadata admission [SEC-06]", () => {
  it("scaffolds the bounded N-API boundary without activating a payload [P107]", () => {
    assert.deepEqual(NAPI_METADATA_SCAFFOLD.win32.allowedAncestorTags,
      ["IO_REPARSE_TAG_SYMLINK", "IO_REPARSE_TAG_MOUNT_POINT"]);
    assert.equal(NAPI_METADATA_SCAFFOLD.win32.childLookup, "root-directory-single-component");
    assert.equal(NAPI_METADATA_SCAFFOLD.win32.leafReparse, "refuse");
    assert.equal(NAPI_METADATA_SCAFFOLD.win32.active, false);
    assert.equal(NAPI_METADATA_SCAFFOLD.posix.active, false);
    assert.equal(NAPI_METADATA_SCAFFOLD.maxBytes, 20 * 1024 * 1024);
  });

  it("pins every tool/record request to a closed provider and named path [P107, AC-16]", () => {
    const root = tmp(); roots.push(root);
    write(root, "package.json", '{"name":"demo"}');
    const requests: unknown[] = [];
    const stack = createStack((request) => {
      requests.push(request);
      return { status: "unavailable", category: "payload-unavailable" };
    });
    assert.throws(() => stack.detect(root), (error: unknown) =>
      error instanceof KernelError && error.reasons[0]?.code === "capability-missing");
    assert.deepEqual(requests, [{
      root, provider: "direct-installed-tool", packageName: "vitest",
      relativePath: "vitest/package.json", maxBytes: 20 * 1024 * 1024,
    }]);
    assert.notEqual(stack.adapterVersion(), "node-ts@28");
  });

  for (const shape of ["regular", "missing", "linked", "dangling", "hard-linked", "package-linked"] as const) {
    it(`fails closed before classifying a ${shape} installed metadata path as absent or supported`, () => {
      const root = tmp(); roots.push(root);
      write(root, "package.json", '{"name":"demo"}');
      if (shape === "regular") write(root, "node_modules/vitest/package.json", '{"version":"5.0.5"}');
      if (shape === "linked") {
        write(root, "outside.json", '{"version":"5.0.5"}');
        mkdirSync(join(root, "node_modules/vitest"), { recursive: true });
        symlinkSync(join(root, "outside.json"), join(root, "node_modules/vitest/package.json"));
      }
      if (shape === "dangling") {
        mkdirSync(join(root, "node_modules/vitest"), { recursive: true });
        symlinkSync(join(root, "missing.json"), join(root, "node_modules/vitest/package.json"));
      }
      if (shape === "hard-linked") {
        write(root, "outside.json", '{"version":"5.0.5"}');
        mkdirSync(join(root, "node_modules/vitest"), { recursive: true });
        linkSync(join(root, "outside.json"), join(root, "node_modules/vitest/package.json"));
      }
      if (shape === "package-linked") {
        write(root, "store/vitest/package.json", '{"version":"5.0.5"}');
        mkdirSync(join(root, "node_modules"), { recursive: true });
        symlinkSync(join(root, "store/vitest"), join(root, "node_modules/vitest"), process.platform === "win32" ? "junction" : "dir");
      }
      const stack = createStack(() => ({ status: "unavailable", category: "payload-unavailable" }));
      assert.throws(() => stack.detect(root), (error: unknown) =>
        error instanceof KernelError && error.reasons[0]?.code === "capability-missing",
      shape);
      assert.equal(stack.fingerprint.bind(stack, root) instanceof Function, true);
    });
  }

  it("refuses provider/path substitutions before native admission", () => {
    const root = tmp(); roots.push(root);
    let calls = 0;
    const stack = createStack(() => { calls++; return { status: "file", bytes: Buffer.from('{"version":"5.0.5"}'), fileId: "test" }; });
    stack.setExclusions([{ pattern: "node_modules/vitest/package.json", kinds: ["no-read"] }]);
    assert.throws(() => stack.detect(root), /excludes stack metadata/i);
    assert.equal(calls, 0);
    rmSync(join(root, "node_modules"), { recursive: true, force: true });
  });

  it("keeps unavailable fingerprints distinct from evidence and agreement [P107, EVD-03]", () => {
    const root = tmp(); roots.push(root);
    const stack = createStack(() => ({ status: "unavailable", category: "payload-unavailable" }));
    const ports = { root, stack } as Parameters<typeof observeToolchain>[0];
    assert.deepEqual(observeToolchain(ports), { available: false });
    assert.throws(() => stack.fingerprint(root), (error: unknown) =>
      error instanceof KernelError && error.reasons[0]?.code === "capability-missing");
  });
});
