import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { closeSync, fstatSync, lstatSync, openSync, readSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseDocument } from "yaml";
import { z } from "zod";
import { Endpoint, Scope } from "../../../packages/kernel/src/core/schemas.ts";
import { QualificationTuple, TupleSources } from "./tuple.ts";

const HASH = z.string().regex(/^[a-f0-9]{64}$/);
const ID = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const SOURCE = z.enum(["driver-ui", "documented-export", "kernel-response", "filesystem-monitor", "grader", "subject-report"]);
const MAX_PROTOCOL_BYTES = 1024 * 1024;
const MAX_REFERENCE_BYTES = 512;
const MAX_REQUEST_BYTES = 65_536;
const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;

const boundedPath = z.string().min(1).refine((value) => Buffer.byteLength(value, "utf8") <= MAX_REFERENCE_BYTES);
const ArtifactRef = z.strictObject({ path: boundedPath, sha256: HASH });
const RequiredObservation = z.strictObject({ id: ID, source: SOURCE, required: z.boolean() });
const Case = z.strictObject({
  caseId: ID,
  request: z.string().min(1).refine((value) => Buffer.byteLength(value, "utf8") <= MAX_REQUEST_BYTES),
  fixtureRefs: z.array(ArtifactRef).min(1),
  graderRefs: z.array(ArtifactRef).min(1),
  expected: z.strictObject({ endpoint: Endpoint, scope: Scope }),
  protectedPaths: z.array(boundedPath),
  requiredObservations: z.array(RequiredObservation),
}).superRefine((value, context) => {
  const unique = (items: string[], path: string) => {
    if (new Set(items).size !== items.length) context.addIssue({ code: "custom", path: [path], message: "values must be unique" });
  };
  unique(value.fixtureRefs.map((ref) => ref.path), "fixtureRefs");
  unique(value.graderRefs.map((ref) => ref.path), "graderRefs");
  unique(value.protectedPaths, "protectedPaths");
  unique(value.requiredObservations.map((item) => item.id), "requiredObservations");
});

const StaticProtocol = z.strictObject({
  schemaVersion: z.literal(1),
  protocolId: ID,
  revision: z.number().int().positive().safe(),
  purpose: z.enum(["formative", "qualification"]),
  subject: z.strictObject({ artifactSha256: HASH }),
  qualificationTuple: QualificationTuple,
  tupleSources: TupleSources,
  cases: z.array(Case).min(1).max(40),
}).superRefine((value, context) => {
  if (new Set(value.cases.map((item) => item.caseId)).size !== value.cases.length) {
    context.addIssue({ code: "custom", path: ["cases"], message: "case IDs must be unique" });
  }
});

export class ProtocolValidationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = "ProtocolValidationError";
  }
}

export interface StaticProtocolResult {
  protocolId: string;
  protocolSha256: string;
  caseCount: number;
  result: "valid-static-protocol";
}

export function readBoundedRegularFile(path: string, maxBytes: number): Buffer {
  let descriptor: number;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch {
    throw new ProtocolValidationError("unsafe-file");
  }

  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.size > BigInt(maxBytes)) throw new ProtocolValidationError("unsafe-file");
    const buffer = Buffer.allocUnsafe(maxBytes + 1);
    let bytesRead = 0;
    while (bytesRead < buffer.length) {
      const count = readSync(descriptor, buffer, bytesRead, buffer.length - bytesRead, null);
      if (count === 0) break;
      bytesRead += count;
    }
    const after = fstatSync(descriptor, { bigint: true });
    if (bytesRead > maxBytes || BigInt(bytesRead) !== before.size || after.size !== before.size || after.ino !== before.ino || after.dev !== before.dev || after.mtimeNs !== before.mtimeNs) {
      throw new ProtocolValidationError("file-changed-or-oversized");
    }
    return buffer.subarray(0, bytesRead);
  } finally {
    closeSync(descriptor);
  }
}

export function decodeJson(bytes: Uint8Array): unknown {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ProtocolValidationError("invalid-utf8");
  }

  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new ProtocolValidationError("invalid-json");
  }

  try {
    const document = parseDocument(text, { schema: "json", uniqueKeys: true });
    if (document.errors.length > 0) {
      throw new ProtocolValidationError(document.errors.some((error) => error.code === "DUPLICATE_KEY") ? "duplicate-key" : "invalid-json");
    }
  } catch (error) {
    if (error instanceof ProtocolValidationError) throw error;
    throw new ProtocolValidationError("invalid-json");
  }
  return value;
}

function relativeParts(path: string): string[] {
  if (path.includes("\\") || path.includes(":") || path.includes("\0") || isAbsolute(path)) throw new ProtocolValidationError("unsafe-path");
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || /[. ]$/.test(part))) throw new ProtocolValidationError("unsafe-path");
  return parts;
}

function resolveRegularArtifact(root: string, path: string): string {
  const parts = relativeParts(path);
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    let entry;
    try {
      entry = lstatSync(current);
    } catch {
      throw new ProtocolValidationError("missing-artifact");
    }
    if (entry.isSymbolicLink() || (index < parts.length - 1 ? !entry.isDirectory() : !entry.isFile())) {
      throw new ProtocolValidationError("unsafe-artifact");
    }
  }
  const fromRoot = relative(root, resolve(current));
  if (!fromRoot || fromRoot.startsWith(`..${sep}`) || fromRoot === ".." || isAbsolute(fromRoot)) throw new ProtocolValidationError("unsafe-path");
  return current;
}

function validateTuple(value: unknown): StaticProtocol {
  try {
    const parsed = StaticProtocol.safeParse(value);
    if (!parsed.success) throw new ProtocolValidationError("schema-invalid");
    return parsed.data;
  } catch (error) {
    if (error instanceof ProtocolValidationError) throw error;
    throw new ProtocolValidationError("schema-invalid");
  }
}

export function validateProtocolFile(protocolPath: string): StaticProtocolResult {
  const absoluteProtocolPath = resolve(protocolPath);
  const bytes = readBoundedRegularFile(absoluteProtocolPath, MAX_PROTOCOL_BYTES);
  const protocol = validateTuple(decodeJson(bytes));
  const root = realpathSync(dirname(absoluteProtocolPath));
  for (const item of protocol.cases) {
    for (const reference of [...item.fixtureRefs, ...item.graderRefs]) {
      const path = resolveRegularArtifact(root, reference.path);
      const artifact = readBoundedRegularFile(path, MAX_ARTIFACT_BYTES);
      const digest = createHash("sha256").update(artifact).digest("hex");
      if (digest !== reference.sha256) throw new ProtocolValidationError("artifact-hash-mismatch");
    }
    for (const path of item.protectedPaths) relativeParts(path);
  }
  return {
    protocolId: protocol.protocolId,
    protocolSha256: createHash("sha256").update(bytes).digest("hex"),
    caseCount: protocol.cases.length,
    result: "valid-static-protocol",
  };
}

export type StaticProtocol = z.infer<typeof StaticProtocol>;