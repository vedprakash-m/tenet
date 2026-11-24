import { mkdtemp, readFile, readdir, rm, writeFile, mkdir, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { sha256 } from "../core/hash.js";
import { message } from "../core/messages.js";
import { validate } from "../core/schema.js";
import { readReport, type TestCase, type TestReport, type TestStatus } from "../reports/index.js";
import type { Policy } from "../policy/index.js";
import type { Bundle, Finding, ProofCard } from "../types/generated.js";

export const bundleLimit = 50 * 1024 * 1024;
export type ReportKind = "junit" | "ctrf" | "go-test-json" | "jest-json" | "none";
export type CheckEntry = Bundle["checks"][number] & {
  "x-report-kind"?: ReportKind;
  "x-proposed"?: boolean;
};
export type VerificationBundle = Omit<Bundle, "checks"> & { checks: CheckEntry[]; "x-repository"?: string };
export type BundleFiles = Map<string, Buffer>;
export type BundleData = { bundle: VerificationBundle; files: BundleFiles };
export type Touched = { id: string; why: ProofCard["requirements"][number]["why"] };
export type SpecDelta = { doc: string; added: string[]; modified: string[]; removed: string[] };
export type Subject = {
  blessed: boolean;
  requirements: Array<Omit<ProofCard["requirements"][number], "why" | "tests"> & { blessed_digest: string }>;
  protected: string[];
  workflow_changed: boolean;
  blessings_changed: ProofCard["blessings_changed"];
};
export type CommandRun = { exitCode: number | null; stdout: Buffer; timedOut: boolean };
export type ParsedSpecification = {
  front: Record<string, unknown> | null;
  sections: Array<{
    slug: string; state: string; flags: string[]; blessed_digest: string | null; blessed_copy: string | null;
    requirements: Array<{ id: string; text: string }>;
  }>;
};
export type VerifyDeps = {
  parseDoc?(path: string, text: string, options?: { prefix?: string }): ParsedSpecification;
  sectionDigest?(body: string): string;
  check(options: { cwd?: string; paths?: string[]; pack?: boolean; ci?: boolean; base?: string }): Promise<{ findings: Finding[]; summary: { errors: number; warnings: number; advises: number } }>;
  touched(base: string, head: string, ids: string[], options?: { cwd?: string; codeowners_path?: string; prefix?: string }): Promise<Touched[]>;
  deltas(base: string, head: string, options?: { cwd?: string; prefix?: string }): Promise<SpecDelta[]>;
  execute?(command: string, options: { cwd: string; timeoutMs: number; ci: boolean }): Promise<CommandRun>;
  policy?(ref: string, cwd: string): Promise<Policy>;
  verifyLock?(ref: string, cwd: string): Promise<void>;
  specification?(base: string, tested: string, policy: Policy, cwd: string): Promise<Pick<Subject, "blessed" | "requirements" | "blessings_changed">>;
};

export function refusedBundle(runId: string, reason: string): Error & { code: string; fix: string } {
  const code = "TN-RECORD-BUNDLE";
  const text = message(code, { run_id: runId, reason });
  return Object.assign(new Error(text.message), { code, fix: text.fix });
}

export function safeEntry(name: string): string {
  if (!name || name.includes("\\") || /^[A-Za-z]:/.test(name) || name.split("/").some((part) => !part || part === "." || part === ".." || part.includes(":") || Array.from(part).some((char) => char.charCodeAt(0) < 32))) {
    throw new Error("unsafe bundle path");
  }
  return name;
}

function limitedFiles(files: BundleFiles): void {
  let size = 0;
  for (const [name, contents] of files) {
    safeEntry(name);
    size += contents.length;
    if (size > bundleLimit) throw new Error("bundle exceeds 50 MB");
  }
}

function jsonDepth(value: unknown): void {
  const visit = (entry: unknown, depth: number) => {
    if (entry === null || typeof entry !== "object") return;
    if (depth > 64) throw new Error("JSON nesting exceeds 64 levels");
    for (const child of Object.values(entry)) visit(child, depth + 1);
  };
  visit(value, 1);
}

export function decodeBundle(files: BundleFiles): BundleData {
  limitedFiles(files);
  const manifest = files.get("bundle.json");
  if (!manifest) throw new Error("bundle.json is missing");
  const body: unknown = JSON.parse(manifest.toString("utf8"));
  jsonDepth(body);
  const result = validate("bundle", body);
  if (!result.ok) throw new Error("bundle.json does not match its schema");
  const bundle = body as VerificationBundle;
  const names = new Set<string>();
  for (const check of bundle.checks) {
    if (names.has(check.name)) throw new Error("duplicate check in bundle");
    names.add(check.name);
    if (check.report === "none") {
      if (check.report_sha256 !== sha256(Buffer.alloc(0))) throw new Error("empty report digest differs");
      continue;
    }
    const report = files.get(safeEntry(check.report));
    if (!report || sha256(report) !== check.report_sha256) throw new Error("report digest differs or file is missing");
  }
  return { bundle, files };
}

export async function writeBundle(directory: string, bundle: VerificationBundle, files: BundleFiles): Promise<BundleData> {
  const all = new Map(files).set("bundle.json", Buffer.from(`${JSON.stringify(bundle, null, 2)}\n`));
  const data = decodeBundle(all);
  await mkdir(directory, { recursive: true });
  for (const [name, value] of all) {
    const target = path.join(directory, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, value, { flag: "wx" });
  }
  return data;
}

export async function readBundle(directory: string): Promise<BundleData> {
  const files: BundleFiles = new Map();
  let bytes = 0;
  if (!(await lstat(directory)).isDirectory()) throw new Error("bundle directory is unavailable");
  async function visit(root: string, depth: number): Promise<void> {
    if (depth > 64) throw new Error("bundle directory nesting exceeds 64 levels");
    for (const entry of await readdir(root, { withFileTypes: true })) {
      const filename = path.join(root, entry.name);
      const name = safeEntry(path.relative(directory, filename).split(path.sep).join("/"));
      if (entry.isDirectory()) await visit(filename, depth + 1);
      else if (entry.isFile()) {
        bytes += (await lstat(filename)).size;
        if (bytes > bundleLimit) throw new Error("bundle exceeds 50 MB");
        files.set(name, await readFile(filename));
      } else throw new Error("bundle contains a link or unsupported file");
    }
  }
  await visit(directory, 0);
  return decodeBundle(files);
}

// GitHub artifacts are ZIP files. Only the central directory describes the
// accepted files. No archive entry is ever extracted to a user-selected path.
export function readArtifact(zip: Buffer): BundleData {
  if (zip.length > bundleLimit || zip.length < 22) throw new Error("invalid artifact size");
  let end = zip.length - 22;
  while (end >= Math.max(0, zip.length - 65_557)) {
    if (zip.readUInt32LE(end) === 0x06054b50 && end + 22 + zip.readUInt16LE(end + 20) === zip.length) break;
    end -= 1;
  }
  if (end < Math.max(0, zip.length - 65_557) || zip.readUInt32LE(end + 4) !== 0) throw new Error("invalid ZIP directory");
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  if (count !== zip.readUInt16LE(end + 8) || offset + zip.readUInt32LE(end + 12) !== end) throw new Error("invalid ZIP bounds");
  const directoryStart = offset;
  const files: BundleFiles = new Map();
  const entries = new Set<string>();
  let size = 0;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > end || zip.readUInt32LE(offset) !== 0x02014b50) throw new Error("invalid ZIP entry");
    const flags = zip.readUInt16LE(offset + 8);
    const method = zip.readUInt16LE(offset + 10);
    const packed = zip.readUInt32LE(offset + 20);
    const unpacked = zip.readUInt32LE(offset + 24);
    const nameLength = zip.readUInt16LE(offset + 28);
    const next = offset + 46 + nameLength + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32);
    const mode = zip.readUInt32LE(offset + 38) >>> 16;
    const local = zip.readUInt32LE(offset + 42);
    if (next > end || (flags & 1) !== 0 || (mode & 0xf000) === 0xa000) throw new Error("unsupported ZIP entry");
    const name = zip.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset = next;
    const dir = name.endsWith("/");
    safeEntry(dir ? name.slice(0, -1) : name);
    if (entries.has(name)) throw new Error("duplicate ZIP entry");
    entries.add(name);
    if (dir && !packed && !unpacked) continue;
    size += unpacked;
    if (dir || size > bundleLimit || local + 30 > directoryStart || zip.readUInt32LE(local) !== 0x04034b50) throw new Error("invalid ZIP entry size");
    const localLength = zip.readUInt16LE(local + 26);
    const start = local + 30 + localLength + zip.readUInt16LE(local + 28);
    if (start + packed > directoryStart || zip.toString("utf8", local + 30, local + 30 + localLength) !== name) throw new Error("invalid ZIP local header");
    const payload = zip.subarray(start, start + packed);
    const value = method === 0 ? payload : method === 8 ? inflateRawSync(payload, { maxOutputLength: Math.max(unpacked, 1) }) : undefined;
    if (!value || value.length !== unpacked) throw new Error("invalid ZIP payload");
    files.set(name, value);
  }
  if (offset !== end) throw new Error("invalid ZIP directory length");
  return decodeBundle(files);
}

export async function parseBundledReport(kind: ReportKind, bytes: Buffer, prefix: string): Promise<TestReport> {
  if (kind === "ctrf" || kind === "jest-json") jsonDepth(JSON.parse(bytes.toString("utf8")));
  if (kind === "go-test-json") {
    for (const line of bytes.toString("utf8").split("\n")) if (line.trim()) jsonDepth(JSON.parse(line));
  }
  const dir = await mkdtemp(path.join(tmpdir(), "tenet-report-"));
  try {
    const file = path.join(dir, "report");
    await writeFile(file, bytes);
    return readReport(kind, file, { prefix });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const rank: Record<TestStatus, number> = { pass: 0, skip: 1, fail: 2, error: 3 };
export function mergeMatrix(reports: TestReport[]): TestReport {
  const cases = new Map<string, TestCase>();
  for (const report of reports) {
    for (const entry of report.cases) {
      const previous = cases.get(entry.full_name);
      if (!previous) {
        cases.set(entry.full_name, { ...entry, tags: [...entry.tags], attempts: [...entry.attempts] });
        if (cases.size > 20_000) throw new Error("matrix exceeds 20,000 cases");
        continue;
      }
      if (rank[entry.status] > rank[previous.status]) previous.status = entry.status;
      previous.attempts.push(...entry.attempts);
      previous.tags = [...new Set([...previous.tags, ...entry.tags])];
      if (!previous.file && entry.file) previous.file = entry.file;
      if (entry.duration_ms !== undefined) previous.duration_ms = (previous.duration_ms ?? 0) + entry.duration_ms;
    }
  }
  return {
    runner: reports[0]?.runner ?? "none",
    cases: [...cases.values()],
    teardown_failed: reports.some((report) => report.teardown_failed),
    inconclusive: cases.size === 0,
  };
}
