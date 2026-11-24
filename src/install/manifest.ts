import { createHash } from "node:crypto";
import type {
  InitPlan,
  InstallManifest,
  LocalManifest,
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

type JsonSpan = {
  start: number;
  end: number;
  members?: Map<string, { start: number; end: number; value: JsonSpan }>;
};

function jsonSpans(source: string): JsonSpan {
  let offset = 0;
  const skip = (): void => {
    while (/\s/.test(source[offset] ?? "")) offset += 1;
  };
  const string = (): number => {
    const start = offset;
    if (source[offset] !== "\"") throw new SyntaxError("Expected a JSON string.");
    offset += 1;
    while (offset < source.length) {
      const character = source[offset];
      offset += 1;
      if (character === "\\") {
        offset += 1;
      } else if (character === "\"") {
        return start;
      }
    }
    throw new SyntaxError("Unterminated JSON string.");
  };
  const value = (): JsonSpan => {
    skip();
    const start = offset;
    if (source[offset] === "{") {
      const members = new Map<string, { start: number; end: number; value: JsonSpan }>();
      offset += 1;
      skip();
      if (source[offset] !== "}") {
        for (;;) {
          skip();
          const keyStart = string();
          const key = JSON.parse(source.slice(keyStart, offset)) as string;
          skip();
          if (source[offset] !== ":") throw new SyntaxError("Expected a JSON colon.");
          offset += 1;
          const member = value();
          members.set(key, { start: keyStart, end: member.end, value: member });
          skip();
          if (source[offset] !== ",") break;
          offset += 1;
        }
      }
      if (source[offset] !== "}") throw new SyntaxError("Expected a JSON object end.");
      offset += 1;
      return { start, end: offset, members };
    }
    if (source[offset] === "[") {
      offset += 1;
      skip();
      if (source[offset] !== "]") {
        for (;;) {
          value();
          skip();
          if (source[offset] !== ",") break;
          offset += 1;
        }
      }
      if (source[offset] !== "]") throw new SyntaxError("Expected a JSON array end.");
      offset += 1;
      return { start, end: offset };
    }
    if (source[offset] === "\"") {
      string();
      return { start, end: offset };
    }
    while (offset < source.length && !/[\s,\]}]/.test(source[offset] ?? "")) offset += 1;
    if (offset === start) throw new SyntaxError("Expected a JSON value.");
    return { start, end: offset };
  };
  const root = value();
  skip();
  if (offset !== source.length) throw new SyntaxError("Unexpected bytes after JSON value.");
  return root;
}

function updateJsonSpan(
  source: string,
  span: JsonSpan,
  parts: string[],
  value: unknown,
): string {
  if (!span.members) throw new SyntaxError("A JSON pointer parent is not an object.");
  const key = parts[0] ?? "";
  const member = span.members.get(key);
  if (member) {
    if (parts.length === 1) {
      return `${source.slice(0, member.value.start)}${JSON.stringify(value)}${source.slice(member.value.end)}`;
    }
    const updated = updateJsonSpan(source, member.value, parts.slice(1), value);
    return updated;
  }
  let nested = value;
  for (const part of parts.slice(1).reverse()) nested = { [part]: nested };
  const close = span.end - 1;
  const interior = source.slice(span.start + 1, close);
  const trailingLength = interior.match(/\s*$/)?.[0].length ?? 0;
  const insertion = close - trailingLength;
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const closeLine = source.lastIndexOf("\n", close) + 1;
  const closeIndent = source.slice(closeLine, close).match(/^\s*/)?.[0] ?? "";
  const indent = `${closeIndent}  `;
  const separator = span.members.size > 0 ? "," : "";
  const addition = `${separator}${newline}${indent}${JSON.stringify(key)}: ${JSON.stringify(nested)}`;
  return `${source.slice(0, insertion)}${addition}${source.slice(insertion)}`;
}

export function setJsonPointerBytes(source: string, pointer: string, value: unknown): string {
  const parts = pointerParts(pointer);
  return updateJsonSpan(source, jsonSpans(source), parts, value);
}


function removeJsonSpan(
  source: string,
  span: JsonSpan,
  parts: string[],
): string {
  if (!span.members) throw new SyntaxError("A JSON pointer parent is not an object.");
  const key = parts[0] ?? "";
  const member = span.members.get(key);
  if (!member) return source;
  if (parts.length > 1) return removeJsonSpan(source, member.value, parts.slice(1));
  const entries = [...span.members.entries()];
  const index = entries.findIndex(([name]) => name === key);
  const previous = entries[index - 1]?.[1];
  const next = entries[index + 1]?.[1];
  let from = member.start;
  let through = member.end;
  if (previous) {
    const comma = source.lastIndexOf(",", member.start);
    if (comma >= previous.end) from = comma;
  } else if (next) {
    const comma = source.indexOf(",", member.end);
    if (comma >= 0 && comma < next.start) through = comma + 1;
  }
  return `${source.slice(0, from)}${source.slice(through)}`;
}

export function deleteJsonPointerBytes(source: string, pointer: string): string {
  return removeJsonSpan(source, jsonSpans(source), pointerParts(pointer));
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

export function localManifestJson(manifest: LocalManifest): string {
  return jsonFile({
    schema_version: manifest.schema_version,
    profile_roots: Object.fromEntries(
      Object.entries(manifest.profile_roots).sort(([left], [right]) =>
        sortedText(left, right)),
    ),
    keys: manifest.keys
      .map((key) => ({ ...key }))
      .sort((left, right) =>
        sortedText(left.host, right.host) ||
        sortedText(left.path, right.path) ||
        sortedText(left.pointer, right.pointer)),
  });
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
