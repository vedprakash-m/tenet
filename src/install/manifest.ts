import { createHash } from "node:crypto";
import type {
  InitPlan,
  InstallManifest,
  ManifestBlock,
  PendingManifest,
  PendingWrite,
} from "./types.js";

export function sha256Bytes(value: string | NodeJS.ArrayBufferView): string {
  return createHash("sha256")
    .update(typeof value === "string" ? Buffer.from(value, "utf8") : value)
    .digest("hex");
}

export function sortedText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function jsonFile(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function decodeJson(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SyntaxError("Expected a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

export function pointerParts(pointer: string): string[] {
  if (!pointer.startsWith("/")) throw new SyntaxError(`Invalid JSON pointer: ${pointer}`);
  return pointer.slice(1).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}

export function pointerValue(root: Record<string, unknown>, pointer: string): unknown {
  let current: unknown = root;
  for (const part of pointerParts(pointer)) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setPointer(root: Record<string, unknown>, pointer: string, value: unknown): void {
  const parts = pointerParts(pointer);
  if (parts.length === 0) throw new SyntaxError(`Invalid JSON pointer: ${pointer}`);
  let current = root;
  for (const part of parts.slice(0, -1)) {
    const next = current[part];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts.at(-1) ?? ""] = value;
}

export function blockMarker(kind: "markdown" | "yaml", version: string): string {
  return kind === "markdown"
    ? `<!-- tenet:begin v${version} -->`
    : `# tenet:begin v${version}`;
}

export function blockRange(
  source: string,
  kind: "markdown" | "yaml",
): { start: number; end: number; block: string } | null {
  const expression = kind === "markdown"
    ? /<!-- tenet:begin v[^\r\n]* -->[\s\S]*?<!-- tenet:end -->/g
    : /# tenet:begin v[^\r\n]*[\s\S]*?# tenet:end/g;
  const match = expression.exec(source);
  if (!match || match.index < 0) return null;
  return { start: match.index, end: match.index + match[0].length, block: match[0] };
}

export function blockSeparator(source: string, boundary = source.length): "" | "\n" | "\r\n" {
  if (boundary === 0 || source.slice(0, boundary).endsWith("\n")) return "";
  return /(?:\r\n)/.test(source.slice(0, boundary)) ? "\r\n" : "\n";
}

export function replaceBlock(
  source: string,
  kind: "markdown" | "yaml",
  replacement: string,
): { content: string; previous: string | null; prefixSep: "" | "\n" | "\r\n" } {
  const managed = replacement.replace(/\n+$/, "");
  const range = blockRange(source, kind);
  if (range) {
    const suffix = source.slice(range.end);
    return {
      content: `${source.slice(0, range.start)}${managed}${suffix || "\n"}`,
      previous: range.block,
      prefixSep: "",
    };
  }
  const separator = blockSeparator(source);
  return {
    content: `${source}${separator}${managed}\n`,
    previous: null,
    prefixSep: separator,
  };
}

export function manifestJson(manifest: InstallManifest): string {
  return jsonFile({
    schema_version: manifest.schema_version,
    version: manifest.version,
    created: manifest.created
      .map(({ path: itemPath, sha256 }) => ({ path: itemPath, sha256 }))
      .sort((left, right) => sortedText(left.path, right.path)),
    blocks: manifest.blocks
      .map((block: ManifestBlock) => ({ ...block }))
      .sort((left, right) => sortedText(left.path, right.path)),
    keys: manifest.keys.map((key) => ({ ...key }))
      .sort((left, right) => sortedText(left.path, right.path) || sortedText(left.pointer, right.pointer)),
  });
}

export function pendingJson(pending: PendingManifest): string {
  return `${JSON.stringify(pending, null, 2)}\n`;
}

export function planFromManifest(
  manifest: InstallManifest,
  fallback: InitPlan,
): InitPlan {
  return {
    created: manifest.created.map((item) => item.path).concat(".tenet/manifest.json").sort(sortedText),
    blocks: manifest.blocks.map(({ path: itemPath, kind }) => ({ path: itemPath, kind })),
    keys: manifest.keys.map(({ path: itemPath, pointer }) => ({ path: itemPath, pointer })),
    local_keys: fallback.local_keys,
    hosts: fallback.hosts,
    ci_mode: fallback.ci_mode,
    ci_reason: fallback.ci_reason,
  };
}

export function pendingFromWriteSet(
  version: string,
  writes: PendingWrite[],
  manifest: InstallManifest,
): PendingManifest {
  return { schema_version: 1, version, writes, manifest };
}
