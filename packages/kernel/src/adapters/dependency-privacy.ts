import { z } from "zod";
import { isMap, isScalar, isSeq, parseDocument } from "yaml";
import { ownRecord } from "../core/schemas.ts";
import { PackageName, RegistrySpec, SemVer } from "../core/privacy-identity.ts";
import { sha256, stableStringify } from "../core/ids.ts";

const MAX_FILE_BYTES = 1024 * 1024;
const unavailable = { status: "refused", reason: "capability-missing" } as const;
const INVALID = Symbol("outside-closed-domain");
const named = (value: z.ZodType, maximum = 100_000) => ownRecord(value).refine(entries =>
  Object.keys(entries).length <= maximum && Object.keys(entries).every(name => PackageName.safeParse(name).success));
const dependencies = {
  dependencies: named(RegistrySpec).optional(), devDependencies: named(RegistrySpec).optional(),
  optionalDependencies: named(RegistrySpec).optional(), peerDependencies: named(RegistrySpec).optional(),
};
const PeerMeta = z.strictObject({ optional: z.boolean().optional() });
const PackageRoot = z.strictObject({ name: PackageName.optional(), version: SemVer.optional(), ...dependencies });
const Manifest = PackageRoot.extend({
  private: z.boolean().optional(), type: z.enum(["module", "commonjs"]).optional(),
  packageManager: z.string().refine(value =>
    /^(?:npm|pnpm)@/.test(value) && SemVer.safeParse(value.replace(/^(?:npm|pnpm)@/, "")).success).optional(),
  peerDependenciesMeta: named(PeerMeta, 200).optional(),
}).refine(value => (value.name === undefined) === (value.version === undefined))
  .refine(value => [value.dependencies, value.devDependencies, value.optionalDependencies, value.peerDependencies]
    .every(group => group === undefined || Object.keys(group).length <= 200));
const INTEGRITY_HASH = "(?:sha512-[A-Za-z0-9+/]{86}==|sha384-[A-Za-z0-9+/]{64}|sha256-[A-Za-z0-9+/]{43}=)";
const Integrity = z.string().regex(new RegExp(`^${INTEGRITY_HASH}(?: ${INTEGRITY_HASH}){0,2}$`));
const Engines = z.strictObject({
  node: z.union([RegistrySpec, z.string().regex(/^(?:0|[1-9][0-9]*)$/)]).optional(),
  npm: z.union([RegistrySpec, z.string().regex(/^(?:0|[1-9][0-9]*)$/)]).optional(),
  pnpm: z.union([RegistrySpec, z.string().regex(/^(?:0|[1-9][0-9]*)$/)]).optional(),
});
const platform = {
  os: z.array(z.string().regex(/^!?(?:aix|android|darwin|freebsd|linux|openbsd|sunos|win32)$/)).max(32).optional(),
  cpu: z.array(z.string().regex(/^!?(?:arm|arm64|ia32|mips|mipsel|ppc|ppc64|s390|s390x|x64)$/)).max(32).optional(),
};
const NpmPackage = z.strictObject({
  version: SemVer, resolved: z.string().optional(), integrity: Integrity.optional(),
  license: z.enum(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "MPL-2.0", "CC0-1.0", "Unlicense"]).optional(),
  dev: z.boolean().optional(), optional: z.boolean().optional(), devOptional: z.boolean().optional(),
  inBundle: z.boolean().optional(), hasInstallScript: z.boolean().optional(), link: z.literal(false).optional(),
  dependencies: dependencies.dependencies, optionalDependencies: dependencies.optionalDependencies,
  peerDependencies: dependencies.peerDependencies, peerDependenciesMeta: named(PeerMeta).optional(),
  engines: Engines.optional(), ...platform,
});
const NpmLock = z.strictObject({
  name: PackageName.optional(), version: SemVer.optional(), lockfileVersion: z.literal(3),
  requires: z.boolean().optional(), packages: ownRecord(z.unknown()),
}).refine(value => (value.name === undefined) === (value.version === undefined));

function bounded(value: unknown): boolean {
  const pending: Array<[unknown, number]> = [[value, 0]];
  let count = 0;
  while (pending.length) {
    const [item, depth] = pending.pop()!;
    if (++count > 100_000 || depth > 64) return false;
    if (item !== null && typeof item === "object")
      for (const child of Object.values(item)) pending.push([child, depth + 1]);
  }
  return true;
}

function textOf(bytes: Uint8Array | null): string | null {
  if (bytes === null || bytes.byteLength > MAX_FILE_BYTES) return null;
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    return text.includes("\uFEFF") || text.includes("\0") ? null : text;
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

function jsonValue(text: string): unknown {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch (error) {
    if (error instanceof SyntaxError) return INVALID;
    throw error;
  }
  if (!bounded(value)) return INVALID;
  const document = parseDocument(text, { uniqueKeys: true, strict: true, schema: "json" });
  return document.errors.length ? INVALID : value;
}

function registryURL(value: string, name: string, version: string): boolean {
  const path = name.replace(/^@/, "%40"), leaf = name.slice(name.lastIndexOf("/") + 1);
  const base = `https://registry.npmjs.org/${path}`;
  return value === base || value === `${base}/-/${leaf}-${version}.tgz`;
}

function npmPackage(path: string, value: unknown): boolean {
  if (path === "") return PackageRoot.safeParse(value).success;
  if (!path.startsWith("node_modules/") || Buffer.byteLength(path) > 1024) return false;
  const names = path.slice("node_modules/".length).split("/node_modules/");
  if (!names.every(name => PackageName.safeParse(name).success)) return false;
  const parsed = NpmPackage.safeParse(value);
  return parsed.success && (parsed.data.resolved === undefined ||
    registryURL(parsed.data.resolved, names.at(-1)!, parsed.data.version));
}

function npmLock(text: string): boolean {
  const parsed = NpmLock.safeParse(jsonValue(text));
  if (!parsed.success || !Object.hasOwn(parsed.data.packages, "") || Object.keys(parsed.data.packages).length > 10_000) return false;
  return Object.entries(parsed.data.packages).every(([path, value]) => npmPackage(path, value));
}

const PnpmDependency = z.strictObject({ specifier: RegistrySpec, version: SemVer });
const PnpmImporter = z.strictObject({
  dependencies: named(PnpmDependency).optional(), devDependencies: named(PnpmDependency).optional(),
  optionalDependencies: named(PnpmDependency).optional(),
});
const PnpmPackage = z.strictObject({
  resolution: z.strictObject({ integrity: Integrity.optional(), tarball: z.string().optional() })
    .refine(value => value.integrity !== undefined || value.tarball !== undefined),
  engines: Engines.optional(), ...platform, peerDependencies: dependencies.peerDependencies,
  peerDependenciesMeta: named(PeerMeta).optional(), hasBin: z.boolean().optional(), dev: z.boolean().optional(),
  optional: z.boolean().optional(),
});
const PnpmLock = z.strictObject({
  lockfileVersion: z.literal("9.0"),
  settings: z.strictObject({ autoInstallPeers: z.boolean().optional(), excludeLinksFromLockfile: z.boolean().optional() }).optional(),
  overrides: named(RegistrySpec).optional(), importers: z.strictObject({ ".": PnpmImporter }), packages: ownRecord(z.unknown()),
});

const literalEmptyMap = (node: unknown, text: string): boolean =>
  isMap(node) && node.items.length === 0 && !!node.range && text.slice(node.range[0], node.range[1]) === "{}";

function yamlValue(node: unknown, budget: { count: number; text: string }, depth = 0): unknown {
  if (++budget.count > 100_000 || depth > 64 || !(isMap(node) || isSeq(node) || isScalar(node))) return INVALID;
  if (node.comment != null || node.commentBefore != null || node.anchor || node.tag) return INVALID;
  if (isScalar(node)) {
    if (node.type === "BLOCK_FOLDED" || node.type === "BLOCK_LITERAL") return INVALID;
    return node.value === null || ["string", "boolean", "number"].includes(typeof node.value) ? node.value : INVALID;
  }
  // The closed field schemas below decide whether an empty map is valid at this position.
  if (node.flow && !literalEmptyMap(node, budget.text)) return INVALID;
  if (isSeq(node)) {
    const values = node.items.map(item => yamlValue(item, budget, depth + 1));
    return values.includes(INVALID) ? INVALID : values;
  }
  const value: Record<string, unknown> = {};
  for (const pair of node.items) {
    const key = yamlValue(pair.key, budget, depth + 1), item = yamlValue(pair.value, budget, depth + 1);
    if (typeof key !== "string" || item === INVALID || Object.hasOwn(value, key)) return INVALID;
    Object.defineProperty(value, key, { value: item, enumerable: true, configurable: true, writable: true });
  }
  return value;
}

function pnpmLock(text: string): boolean {
  if (/(?:^|[\r\n])%/.test(text)) return false;
  const document = parseDocument(text, { uniqueKeys: true, strict: true, version: "1.2" });
  if (document.errors.length || document.comment != null || document.commentBefore != null) return false;
  const parsed = PnpmLock.safeParse(yamlValue(document.contents, { count: 0, text }));
  if (!parsed.success) return false;
  return Object.entries(parsed.data.packages).every(([key, value]) => {
    const split = key.lastIndexOf("@"), name = key.slice(0, split), version = key.slice(split + 1);
    const pkg = PnpmPackage.safeParse(value);
    return split > 0 && PackageName.safeParse(name).success && SemVer.safeParse(version).success && pkg.success &&
      (pkg.data.resolution.tarball === undefined || registryURL(pkg.data.resolution.tarball, name, version));
  });
}

/** Shape only; restored bytes still require pair admission before use. */
export const DependencySnapshotV1 = z.strictObject({
  format: z.literal("tenet.dependency-pair"), version: z.literal(1), manager: z.enum(["npm", "pnpm"]),
  manifest: z.strictObject({ present: z.literal(true), bytes: z.string() }),
  lock: z.union([
    z.strictObject({ present: z.literal(false) }),
    z.strictObject({ present: z.literal(true), bytes: z.string() }),
  ]),
});
export type DependencySnapshotV1 = z.infer<typeof DependencySnapshotV1>;
type Admission =
  | { status: "admitted"; snapshot: DependencySnapshotV1; blob: string }
  | { status: "refused"; reason: "capability-missing" };

export function admitDependencyPair(
  manager: unknown, manifestBytes: Uint8Array | null, lockBytes: Uint8Array | null,
): Admission {
  if (manager !== "npm" && manager !== "pnpm") return unavailable;
  const manifest = textOf(manifestBytes), lock = textOf(lockBytes);
  if (manifest === null || !Manifest.safeParse(jsonValue(manifest)).success ||
      lockBytes !== null && (lock === null || !(manager === "npm" ? npmLock(lock) : pnpmLock(lock)))) return unavailable;
  const snapshot: DependencySnapshotV1 = {
    format: "tenet.dependency-pair", version: 1, manager, manifest: { present: true, bytes: manifest },
    lock: lock === null ? { present: false } : { present: true, bytes: lock },
  };
  return { status: "admitted", snapshot, blob: sha256(stableStringify(snapshot)) };
}
