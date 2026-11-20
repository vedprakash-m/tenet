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

/** The single N-API operation P107 may call once the reviewed payload is present. */
export type InstalledMetadataAdmission = (request: InstalledMetadataRequest) => InstalledMetadataResult;

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

/** Payload absence is deliberate: P107 remains capability-refused until the native binary is shipped. */
export const unavailableInstalledMetadata: InstalledMetadataAdmission = () =>
  ({ status: "unavailable", category: "payload-unavailable" });

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
    !expected || request.provider !== expected.provider || request.packageName !== expected.packageName ||
    request.maxBytes !== MAX_BYTES || request.root.includes("\0")
  ) return { status: "unavailable", category: "request-binding-unavailable" };
  const result = admission(request);
  if (result.status === "file" && (
    !(result.bytes instanceof Buffer) || result.bytes.length > MAX_BYTES || !result.fileId || result.fileId.length > 256
  )) return { status: "unavailable", category: "payload-result-unavailable" };
  return result;
}
