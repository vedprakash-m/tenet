import assert from "node:assert/strict";
import fs, { linkSync, mkdirSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { createStack } from "../src/adapters/node-ts.ts";
import {
  admitInstalledMetadata,
  githubActionsPosixMetadata,
  installedMetadataRequest,
  NAPI_METADATA_SCAFFOLD,
  repositoryFixtureMetadataEnv,
} from "../src/adapters/installed-metadata.ts";
import type { InstalledMetadataAdmission } from "../src/adapters/installed-metadata.ts";
import { KernelError } from "../src/core/errors.ts";
import { observeToolchain } from "../src/verbs/check-rerun.ts";
import { createPorts } from "../src/wire.ts";
import { cleanup, tmp, write } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fixture = (read: InstalledMetadataAdmission["read"]): InstalledMetadataAdmission =>
  ({ identity: "repository-fixture-v1", read });

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
    const stack = createStack(fixture((request) => {
      requests.push(request);
      return { status: "unavailable", category: "payload-unavailable" };
    }));
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
      const stack = createStack(fixture(() => ({ status: "unavailable", category: "payload-unavailable" })));
      assert.throws(() => stack.detect(root), (error: unknown) =>
        error instanceof KernelError && error.reasons[0]?.code === "capability-missing",
      shape);
      assert.equal(stack.fingerprint.bind(stack, root) instanceof Function, true);
    });
  }

  it("refuses provider/path substitutions before native admission", () => {
    const root = tmp(); roots.push(root);
    let calls = 0;
    const stack = createStack(fixture(() => {
      calls++;
      return { status: "file", bytes: Buffer.from('{"version":"5.0.5"}'), fileId: "test" };
    }));
    stack.setExclusions([{ pattern: "node_modules/vitest/package.json", kinds: ["no-read"] }]);
    assert.throws(() => stack.detect(root), /excludes stack metadata/i);
    assert.equal(calls, 0);
    rmSync(join(root, "node_modules"), { recursive: true, force: true });
  });

  it("keeps unavailable fingerprints distinct from evidence and agreement [P107, EVD-03]", () => {
    const root = tmp(); roots.push(root);
    const stack = createStack(fixture(() => ({ status: "unavailable", category: "payload-unavailable" })));
    const ports = { root, stack } as Parameters<typeof observeToolchain>[0];
    assert.deepEqual(observeToolchain(ports), { available: false });
    assert.throws(() => stack.fingerprint(root), (error: unknown) =>
      error instanceof KernelError && error.reasons[0]?.code === "capability-missing");
  });

  it("refuses an unsupported provider identity before reading any bytes", () => {
    let calls = 0;
    const foreign = {
      identity: "foreign-provider",
      read: () => { calls++; return { status: "missing" as const }; },
    } as unknown as InstalledMetadataAdmission;
    const root = tmp(); roots.push(root);
    write(root, "package.json", '{"name":"demo"}');
    assert.throws(() => createStack(foreign).detect(root), /metadata.*safely/i);
    assert.equal(calls, 0);
  });

  it("admits one exact qualified CI/POSIX request and refuses a linked package path", () => {
    const root = tmp(); roots.push(root);
    write(root, "node_modules/vitest/package.json", '{"version":"5.0.5"}');
    const provider = githubActionsPosixMetadata(repositoryFixtureMetadataEnv(root), "linux");
    const request = installedMetadataRequest(root, "node_modules/vitest/package.json");
    const result = admitInstalledMetadata(provider, request);
    assert.equal(result.status, "file");
    if (result.status === "file") {
      assert.equal(result.bytes.toString(), '{"version":"5.0.5"}');
    }

    rmSync(join(root, "node_modules/vitest"), { recursive: true });
    write(root, "store/vitest/package.json", '{"version":"5.0.5"}');
    symlinkSync(join(root, "store/vitest"), join(root, "node_modules/vitest"), process.platform === "win32" ? "junction" : "dir");
    assert.deepEqual(admitInstalledMetadata(provider, request), {
      status: "unavailable", category: "qualified-link-unavailable",
    });
  });

  it("allows only an exact workspace node_modules link from an outside fixture root", () => {
    const workspace = tmp(); roots.push(workspace);
    const outside = tmp(); roots.push(outside);
    write(workspace, "node_modules/vitest/package.json", '{"version":"5.0.5"}');
    const provider = githubActionsPosixMetadata(repositoryFixtureMetadataEnv(workspace), "linux");
    const request = (root: string) => installedMetadataRequest(root, "node_modules/vitest/package.json");

    write(outside, "node_modules/vitest/package.json", '{"version":"5.0.5"}');
    assert.deepEqual(admitInstalledMetadata(provider, request(outside)), {
      status: "unavailable", category: "qualified-root-unavailable",
    });

    rmSync(join(outside, "node_modules"), { recursive: true });
    symlinkSync(join(workspace, "node_modules"), join(outside, "node_modules"),
      process.platform === "win32" ? "junction" : "dir");
    assert.equal(admitInstalledMetadata(provider, request(outside)).status, "file");

    const alias = join(tmp(), "workspace"); roots.push(join(alias, ".."));
    symlinkSync(workspace, alias, process.platform === "win32" ? "junction" : "dir");
    assert.equal(admitInstalledMetadata(provider, request(alias)).status, "file");
  });

  it("rejects a fixture link that resolves outside the checked workspace", () => {
    const workspace = tmp(); roots.push(workspace);
    const outside = tmp(); roots.push(outside);
    const untrusted = tmp(); roots.push(untrusted);
    mkdirSync(join(workspace, "node_modules"));
    write(untrusted, "vitest/package.json", '{"version":"5.0.5"}');
    symlinkSync(join(untrusted), join(outside, "node_modules"),
      process.platform === "win32" ? "junction" : "dir");
    const provider = githubActionsPosixMetadata(
      repositoryFixtureMetadataEnv(workspace, {
        GITHUB_ACTIONS: "true", GITHUB_WORKSPACE: workspace,
      }),
      "linux",
    );
    assert.deepEqual(admitInstalledMetadata(
      provider, installedMetadataRequest(outside, "node_modules/vitest/package.json"),
    ), { status: "unavailable", category: "qualified-link-unavailable" });
  });

  for (const dangling of ["node_modules", "package.json"] as const) {
    it(`keeps a dangling ${dangling} resolution unavailable rather than missing`, () => {
      const root = tmp(); roots.push(root);
      mkdirSync(join(root, "node_modules", "vitest"), { recursive: true });
      if (dangling === "node_modules") {
        rmSync(join(root, "node_modules"), { recursive: true });
        symlinkSync(join(root, "missing-modules"), join(root, "node_modules"),
          process.platform === "win32" ? "junction" : "dir");
      } else {
        symlinkSync(join(root, "missing-package.json"), join(root, "node_modules/vitest/package.json"));
      }
      const provider = githubActionsPosixMetadata(repositoryFixtureMetadataEnv(root), "linux");
      assert.deepEqual(admitInstalledMetadata(
        provider, installedMetadataRequest(root, "node_modules/vitest/package.json"),
      ), { status: "unavailable", category: "qualified-link-unavailable" });
    });
  }

  for (const replacement of ["leaf", "parent"] as const) {
    it(`binds the admitted ${replacement} identity to the opened metadata object`, () => {
      const root = tmp(); roots.push(root);
      write(root, "node_modules/vitest/package.json", '{"version":"5.0.5"}');
      const provider = githubActionsPosixMetadata(repositoryFixtureMetadataEnv(root), "linux");
      const packageDir = join(root, "node_modules/vitest");
      const packagePath = join(packageDir, "package.json");
      const originalOpen = fs.openSync;
      let changed = false;
      fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
        if (!changed && String(args[0]) === packagePath) {
          changed = true;
          if (replacement === "leaf") {
            renameSync(packagePath, `${packagePath}.original`);
            write(root, "node_modules/vitest/package.json", '{"version":"6.0.0"}');
          } else {
            const held = join(root, "held-package.json");
            linkSync(packagePath, held);
            renameSync(packageDir, `${packageDir}.original`);
            mkdirSync(packageDir);
            linkSync(held, packagePath);
          }
        }
        return originalOpen(...args);
      }) as typeof fs.openSync;
      syncBuiltinESMExports();
      try {
        assert.deepEqual(admitInstalledMetadata(
          provider, installedMetadataRequest(root, "node_modules/vitest/package.json"),
        ), { status: "unavailable", category: "qualified-object-moved" });
      } finally {
        fs.openSync = originalOpen;
        syncBuiltinESMExports();
      }
    });
  }

  it("keeps the CI provider unavailable without explicit fixture activation", () => {
    const root = tmp(); roots.push(root);
    write(root, "node_modules/vitest/package.json", '{"version":"5.0.5"}');
    const provider = githubActionsPosixMetadata({
      GITHUB_ACTIONS: "true", GITHUB_WORKSPACE: root,
    }, "linux");
    assert.deepEqual(admitInstalledMetadata(
      provider, installedMetadataRequest(root, "node_modules/vitest/package.json"),
    ), { status: "unavailable", category: "payload-unavailable" });
  });

  it("selects the fixture metadata provider from the explicit createPorts environment", () => {
    const root = tmp(); roots.push(root);
    write(root, "package.json", '{"name":"demo"}');
    write(root, "node_modules/vitest/package.json", '{"version":"5.0.5"}');
    const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
    const ambientActions = process.env.GITHUB_ACTIONS;
    const ambientWorkspace = process.env.GITHUB_WORKSPACE;
    Object.defineProperty(process, "platform", { ...platform, value: "linux" });
    process.env.GITHUB_ACTIONS = "true";
    process.env.GITHUB_WORKSPACE = root;
    try {
      const clean = createPorts(root, { PATH: process.env.PATH, HOME: process.env.HOME });
      assert.throws(() => clean.stack.detect(root), (error: unknown) =>
        error instanceof KernelError && error.reasons[0]?.code === "capability-missing");
      const qualified = createPorts(root, repositoryFixtureMetadataEnv(root, {
        PATH: process.env.PATH, HOME: process.env.HOME,
      }));
      assert.equal(qualified.stack.detect(root).runnerVersion, "5.0.5");
    } finally {
      if (ambientActions === undefined) delete process.env.GITHUB_ACTIONS;
      else process.env.GITHUB_ACTIONS = ambientActions;
      if (ambientWorkspace === undefined) delete process.env.GITHUB_WORKSPACE;
      else process.env.GITHUB_WORKSPACE = ambientWorkspace;
      Object.defineProperty(process, "platform", platform);
    }
  });
});
