import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PATH_BYTES = 4_000;

export type InstalledMetadataRequest = {
  root: string;
  provider: "npm" | "pnpm" | "direct-installed-tool";
  packageName: string;
  relativePath: string;
  maxBytes: number;
};

export type InstalledMetadataResult =
  | { status: "file"; bytes: Buffer; fileId: string }
  | { status: "missing" }
  | { status: "unavailable"; category: string };

export type InstalledMetadataProvider =
  | "payload-unavailable-v1"
  | "repository-fixture-v1"
  | "github-actions-posix-v1";

/** The one explicit provider identity allowed to answer P107's fixed request population. */
export type InstalledMetadataAdmission = {
  identity: InstalledMetadataProvider;
  read(request: InstalledMetadataRequest): InstalledMetadataResult;
};

export const TEST_METADATA_PROVIDER_ENV = "TENET_TEST_INSTALLED_METADATA";
export const TEST_METADATA_WORKSPACE_ENV = "TENET_TEST_INSTALLED_METADATA_WORKSPACE";
export const TEST_METADATA_PROVIDER = "github-actions-posix-v1";

/** Explicit, test-only activation. Production callers do not set these values. */
export function repositoryFixtureMetadataEnv(
  workspace: string,
  env: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> {
  return {
    ...env,
    [TEST_METADATA_PROVIDER_ENV]: TEST_METADATA_PROVIDER,
    [TEST_METADATA_WORKSPACE_ENV]: workspace,
  };
}

/** The reviewed payload boundary. No binary is loaded and no platform path is active in this scaffold. */
export const NAPI_METADATA_SCAFFOLD = {
  operation: "readInstalledMetadata",
  nodeApi: true,
  maxBytes: MAX_BYTES,
  maxPathBytes: MAX_PATH_BYTES,
  maxReparseTargetBytes: 16 * 1024,
  win32: {
    active: false,
    childLookup: "root-directory-single-component",
    allowedAncestorTags: ["IO_REPARSE_TAG_SYMLINK", "IO_REPARSE_TAG_MOUNT_POINT"],
    leafReparse: "refuse",
  },
  posix: { active: false, reason: "stable-object-spike-not-authorized" },
} as const;

type PathBinding = Pick<InstalledMetadataRequest, "provider" | "packageName" | "relativePath">;
const PATHS: ReadonlyMap<string, PathBinding> = new Map([
  ["node_modules/vitest/package.json", {
    provider: "direct-installed-tool", packageName: "vitest", relativePath: "vitest/package.json",
  }],
  ["node_modules/typescript/package.json", {
    provider: "direct-installed-tool", packageName: "typescript", relativePath: "typescript/package.json",
  }],
  ["node_modules/eslint/package.json", {
    provider: "direct-installed-tool", packageName: "eslint", relativePath: "eslint/package.json",
  }],
  ["node_modules/@playwright/test/package.json", {
    provider: "direct-installed-tool", packageName: "@playwright/test", relativePath: "@playwright/test/package.json",
  }],
  ["node_modules/.package-lock.json", { provider: "npm", packageName: "installed-record", relativePath: ".package-lock.json" }],
]);

/** Payload absence is deliberate outside an explicitly qualified provider. */
export const unavailableInstalledMetadata: InstalledMetadataAdmission = {
  identity: "payload-unavailable-v1",
  read: () => ({ status: "unavailable", category: "payload-unavailable" }),
};

const unavailable = (category: string) => ({ status: "unavailable", category } as const);
type AdmittedObject = {
  path: string;
  dev: bigint;
  ino: bigint;
  resolved: string;
};

const identity = (stat: { dev: bigint; ino: bigint }) => `${stat.dev}:${stat.ino}`;
const sameIdentity = (stat: { dev: bigint; ino: bigint }, admitted: AdmittedObject) =>
  stat.dev === admitted.dev && stat.ino === admitted.ino;
const within = (root: string, path: string) => {
  const rel = relative(root, path);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

const readBounded = (
  path: string,
  maxBytes: number,
  admittedLeaf: AdmittedObject,
  admittedParent: AdmittedObject,
): InstalledMetadataResult => {
  let descriptor = -1;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = fstatSync(descriptor, { bigint: true });
    const named = lstatSync(path, { bigint: true });
    const parent = lstatSync(dirname(path), { bigint: true });
    if (
      !before.isFile() || before.size > BigInt(maxBytes) ||
      named.isSymbolicLink() || !sameIdentity(before, admittedLeaf) || !sameIdentity(named, admittedLeaf) ||
      !sameIdentity(parent, admittedParent)
    ) return unavailable("qualified-object-moved");
    const size = Number(before.size);
    const bytes = Buffer.alloc(size + 1);
    let count = 0;
    while (count < bytes.length) {
      const size = readSync(descriptor, bytes, count, bytes.length - count, count);
      if (!size) break;
      count += size;
    }
    const after = fstatSync(descriptor, { bigint: true });
    if (
      count !== size || after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs ||
      after.dev !== before.dev || after.ino !== before.ino
    ) return unavailable("qualified-object-moved");
    return { status: "file", bytes: bytes.subarray(0, count), fileId: identity(after) };
  } catch {
    return unavailable("qualified-read-unavailable");
  } finally {
    if (descriptor >= 0) closeSync(descriptor);
  }
};

type AdmissionStep =
  | { admitted: AdmittedObject }
  | { result: InstalledMetadataResult };

const pathStillAdmitted = (previous: AdmittedObject): boolean => {
  try {
    const parent = lstatSync(previous.path, { bigint: true });
    return sameIdentity(parent, previous) && realpathSync(previous.path) === previous.resolved;
  } catch {
    return false;
  }
};

function admitLink(
  path: string, index: number, workspace: string,
  named: { dev: bigint; ino: bigint },
): AdmissionStep {
  if (index !== 0) return { result: unavailable("qualified-link-unavailable") };
  let expected: string, resolved: string;
  try {
    expected = realpathSync(join(workspace, "node_modules"));
    resolved = realpathSync(path);
  } catch {
    return { result: unavailable("qualified-link-unavailable") };
  }
  if (!within(workspace, expected) || resolved !== expected)
    return { result: unavailable("qualified-link-unavailable") };
  return { admitted: { path, dev: named.dev, ino: named.ino, resolved } };
}

function admitObject(
  path: string, index: number, leafIndex: number, workspace: string, rootInsideWorkspace: boolean,
): AdmissionStep {
  let named: ReturnType<typeof lstatSync>;
  try {
    named = lstatSync(path, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      return { result: unavailable("qualified-path-unavailable") };
    try {
      realpathSync(dirname(path));
      return { result: { status: "missing" } };
    } catch {
      return { result: unavailable("qualified-path-unavailable") };
    }
  }
  if (named.isSymbolicLink()) return admitLink(path, index, workspace, named);
  if (
    index < leafIndex && !named.isDirectory() ||
    index === leafIndex && !named.isFile() ||
    index === 0 && !rootInsideWorkspace && !named.isSymbolicLink()
  ) return { result: unavailable(index === 0 && !rootInsideWorkspace
    ? "qualified-root-unavailable"
    : "qualified-path-unavailable") };
  try {
    return { admitted: {
      path, dev: named.dev, ino: named.ino, resolved: realpathSync(path),
    } };
  } catch {
    return { result: unavailable("qualified-path-unavailable") };
  }
}

function readGithubActionsMetadata(
  workspace: string, request: InstalledMetadataRequest,
): InstalledMetadataResult {
  if (!isAbsolute(request.root) || request.root.includes("\0"))
    return unavailable("qualified-root-unavailable");
  let root: string;
  try {
    root = realpathSync(request.root);
  } catch {
    return unavailable("qualified-root-unavailable");
  }
  let namedRoot: ReturnType<typeof lstatSync>;
  try {
    namedRoot = lstatSync(root, { bigint: true });
  } catch {
    return unavailable("qualified-root-unavailable");
  }
  if (!namedRoot.isDirectory()) return unavailable("qualified-root-unavailable");
  const rootInsideWorkspace = within(workspace, root);
  const parts = request.relativePath.split("/");
  const admitted: AdmittedObject[] = [{
    path: root, dev: namedRoot.dev, ino: namedRoot.ino, resolved: root,
  }];
  let current = join(root, "node_modules");
  for (let index = 0; index <= parts.length; index++) {
    const previous = admitted.at(-1);
    if (previous && !pathStillAdmitted(previous))
      return unavailable("qualified-path-moved");
    const step = admitObject(current, index, parts.length, workspace, rootInsideWorkspace);
    if ("result" in step) {
      if (step.result.status === "missing" && previous && !pathStillAdmitted(previous))
        return unavailable("qualified-path-moved");
      return step.result;
    }
    admitted.push(step.admitted);
    if (index < parts.length) current = join(current, parts[index]!);
  }
  return readBounded(current, request.maxBytes, admitted.at(-1)!, admitted.at(-2)!);
}

/** Explicit POSIX test activation. A fixture outside the checked workspace must link to that exact node_modules. */
export function githubActionsPosixMetadata(
  env: Record<string, string | undefined>,
  platform = process.platform,
): InstalledMetadataAdmission {
  if (
    env[TEST_METADATA_PROVIDER_ENV] !== TEST_METADATA_PROVIDER ||
    !["linux", "darwin"].includes(platform) ||
    !env[TEST_METADATA_WORKSPACE_ENV] || env[TEST_METADATA_WORKSPACE_ENV]!.includes("\0") ||
    !isAbsolute(env[TEST_METADATA_WORKSPACE_ENV]!)
  ) {
    return unavailableInstalledMetadata;
  }
  let workspace: string;
  try {
    workspace = realpathSync(env[TEST_METADATA_WORKSPACE_ENV]!);
  } catch {
    return unavailableInstalledMetadata;
  }
  return {
    identity: "github-actions-posix-v1",
    read: (request) => readGithubActionsMetadata(workspace, request),
  };
}

export function installedMetadataRequest(root: string, path: string): InstalledMetadataRequest {
  const binding = PATHS.get(path);
  if (!binding) throw new Error("installed metadata path is not admitted");
  const relative = binding.relativePath;
  if (
    !root || root.includes("\0") || !relative || relative.includes("\0") ||
    relative.includes("\\") || relative.includes(":") || relative.startsWith("/") ||
    Buffer.byteLength(relative) > MAX_PATH_BYTES ||
    relative.split("/").some(part => !part || part === "." || part === "..")
  ) throw new Error("invalid installed metadata path");
  return {
    root,
    provider: binding.provider,
    packageName: binding.packageName,
    relativePath: relative,
    maxBytes: MAX_BYTES,
  };
}

/** Defense in depth at the JavaScript/native boundary. The native binding may still refuse stricter platform facts. */
export function admitInstalledMetadata(admission: InstalledMetadataAdmission, request: InstalledMetadataRequest): InstalledMetadataResult {
  const expected = PATHS.get(`node_modules/${request.relativePath}`);
  if (
    !["payload-unavailable-v1", "repository-fixture-v1", "github-actions-posix-v1"].includes(admission.identity) ||
    !expected || request.provider !== expected.provider || request.packageName !== expected.packageName ||
    request.maxBytes !== MAX_BYTES || request.root.includes("\0")
  ) return { status: "unavailable", category: "request-binding-unavailable" };
  const result = admission.read(request);
  if (result.status === "file" && (
    !(result.bytes instanceof Buffer) || result.bytes.length > MAX_BYTES || !result.fileId || result.fileId.length > 256
  )) return { status: "unavailable", category: "payload-result-unavailable" };
  return result;
}
