import { isDeepStrictEqual } from "node:util";
import { lstat, readFile, readdir, rm, rmdir } from "node:fs/promises";
import path from "node:path";
import { parseDocument } from "yaml";
import { confine, writeAtomic } from "../core/fs.js";
import { message } from "../core/messages.js";
import { fail } from "../core/output.js";
import {
  blockRange,
  decodeJson,
  deleteJsonPointerBytes,
  pointerParts,
  pointerValue,
  setPointer,
  setJsonPointerBytes,
  sha256Bytes,
} from "./manifest.js";
import type {
  InstallManifest,
  ManifestKey,
  PendingManifest,
  RemoveKept,
  RemoveOptions,
  RemoveRemoved,
  RemoveResult,
} from "./types.js";

const reminder = "If you made the Tenet check required in branch protection or rulesets, remove that rule in your forge settings.";
const removableParents = [".agents", ".claude", ".cursor", ".github", ".tenet", ".vscode"];

function pathError(itemPath: string): Error & { code: string; finding: unknown } {
  const words = message("TN-PATH-ESCAPE", { path: itemPath });
  const finding = { ...fail("TN-PATH-ESCAPE", words.message, words.fix), file: itemPath };
  return Object.assign(new Error(words.message), { code: "TN-PATH-ESCAPE", finding });
}

async function optionalText(filename: string): Promise<string | null> {
  try {
    return await readFile(filename, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function manifestFile(cwd: string): Promise<{
  manifest: InstallManifest | null;
  pending: PendingManifest | null;
}> {
  const activePath = await confine(".tenet/manifest.json", cwd).catch(() => {
    throw pathError(".tenet/manifest.json");
  });
  const pendingPath = await confine(".tenet/manifest.pending.json", cwd).catch(() => {
    throw pathError(".tenet/manifest.pending.json");
  });
  const [activeText, pendingText] = await Promise.all([
    optionalText(activePath),
    optionalText(pendingPath),
  ]);
  const active = activeText === null ? null : JSON.parse(activeText) as InstallManifest;
  const pending = pendingText === null ? null : JSON.parse(pendingText) as PendingManifest;
  return { manifest: active ?? pending?.manifest ?? null, pending };
}

async function validateRecordedPaths(
  cwd: string,
  manifest: InstallManifest,
  pending: PendingManifest | null,
  localProfileRoot: string | undefined,
): Promise<void> {
  const paths = [
    ...manifest.created.map((item) => item.path),
    ...manifest.blocks.map((item) => item.path),
    ...manifest.keys.map((item) => item.path),
    ...(pending?.writes.filter((item) => item.kind !== "local_key").map((item) => item.path) ?? []),
  ];
  for (const itemPath of [...new Set(paths)]) {
    await confine(itemPath, cwd).catch(() => {
      throw pathError(itemPath);
    });
  }
  if (!localProfileRoot) {
    const local = pending?.writes.find((item) => item.kind === "local_key");
    if (local) throw pathError(local.path);
    return;
  }
  const root = path.resolve(localProfileRoot);
  for (const itemPath of pending?.writes.filter((item) => item.kind === "local_key")
    .map((item) => item.path) ?? []) {
    const relative = path.relative(root, path.resolve(itemPath));
    if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw pathError(itemPath);
    }
    await confine(relative.replaceAll("\\", "/"), root).catch(() => {
      throw pathError(itemPath);
    });
  }
}

function deletePointer(root: Record<string, unknown>, pointer: string): void {
  const parts = pointerParts(pointer);
  if (parts.length === 0) return;
  let current: unknown = root;
  const parents: Array<{ value: Record<string, unknown>; key: string }> = [];
  for (const part of parts.slice(0, -1)) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return;
    const record = current as Record<string, unknown>;
    parents.push({ value: record, key: part });
    current = record[part];
  }
  if (!current || typeof current !== "object" || Array.isArray(current)) return;
  delete (current as Record<string, unknown>)[parts.at(-1) ?? ""];
  for (const parent of parents.reverse()) {
    const child = parent.value[parent.key];
    if (child && typeof child === "object" && !Array.isArray(child) &&
      Object.keys(child as Record<string, unknown>).length === 0) {
      delete parent.value[parent.key];
    } else {
      break;
    }
  }
}

function restorePrevious(key: ManifestKey, current: Record<string, unknown>): unknown {
  let previousMissing = key.previous === null && key.previous_raw === undefined;
  if (key.previous_raw !== undefined) {
    try {
      previousMissing = pointerValue(decodeJson(key.previous_raw), key.pointer) === undefined;
    } catch {
      previousMissing = false;
    }
  }
  if (previousMissing) deletePointer(current, key.pointer);
  else setPointer(current, key.pointer, structuredClone(key.previous));
  return current;
}

function canRestoreRaw(key: ManifestKey, current: Record<string, unknown>): string | null {
  if (key.previous_raw === undefined) return null;
  try {
    const previous = decodeJson(key.previous_raw);
    const candidate = structuredClone(current);
    restorePrevious(key, candidate);
    return isDeepStrictEqual(candidate, previous) ? key.previous_raw : null;
  } catch {
    return null;
  }
}

function removeAppendedBlock(
  source: string,
  start: number,
  end: number,
  prefixSep: "" | "\n" | "\r\n" | undefined,
): string {
  let from = start;
  const separator = prefixSep ?? "";
  if (separator && source.slice(Math.max(0, start - separator.length), start) === separator) {
    from -= separator.length;
  }
  let through = end;
  if (source.startsWith("\r\n", through)) through += 2;
  else if (source.startsWith("\n", through)) through += 1;
  return `${source.slice(0, from)}${source.slice(through)}`;
}

async function removeEmptyManagedDirectories(cwd: string, paths: string[]): Promise<void> {
  const candidates = new Set<string>();
  for (const itemPath of paths) {
    let current = path.posix.dirname(itemPath.replaceAll("\\", "/"));
    while (current !== "." && current !== "/") {
      const normalized = current.replaceAll("\\", "/");
      if (removableParents.some((root) => normalized === root || normalized.startsWith(`${root}/`))) {
        candidates.add(normalized);
      }
      current = path.posix.dirname(current);
    }
  }
  for (const candidate of [...candidates].sort((left, right) => right.length - left.length)) {
    const filename = await confine(candidate, cwd);
    try {
      const stat = await lstat(filename);
      if (!stat.isDirectory() || (await readdir(filename)).length > 0) continue;
      await rmdir(filename);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTEMPTY") throw error;
    }
  }
}

export async function remove(options: RemoveOptions = {}): Promise<RemoveResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const retained = await retainedRoots(cwd);
  const { manifest, pending } = await manifestFile(cwd);
  const removed: RemoveRemoved[] = [];
  const kept = new Map<string, RemoveKept["reason"]>();
  if (!manifest) {
    await Promise.all([
      rm(await confine(".tenet/manifest.json", cwd), { force: true }),
      rm(await confine(".tenet/manifest.pending.json", cwd), { force: true }),
    ]);
    await removeEmptyManagedDirectories(cwd, [".tenet/manifest.json"]);
    return { removed, kept: [], reminder };
  }
  await validateRecordedPaths(
    cwd,
    manifest,
    pending,
    options.environment?.localProfileRoot,
  );

  const affected: string[] = [];
  const keptCreated = new Set<string>();
  for (const item of manifest.created) {
    const filename = await confine(item.path, cwd);
    affected.push(item.path);
    try {
      const bytes = await readFile(filename);
      if (sha256Bytes(bytes) !== item.sha256) {
        kept.set(item.path, "edited-by-you");
        keptCreated.add(item.path);
        continue;
      }
      await rm(filename);
      removed.push({ path: item.path, kind: "file" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  for (const block of manifest.blocks) {
    if (keptCreated.has(block.path)) continue;
    const filename = await confine(block.path, cwd);
    const source = await optionalText(filename);
    affected.push(block.path);
    if (source === null) continue;
    const range = blockRange(source, block.kind);
    if (!range) {
      kept.set(block.path, "edited-by-you");
      continue;
    }
    const target = block.previous_block !== undefined && block.previous_block !== null
      ? `${source.slice(0, range.start)}${block.previous_block}${source.slice(range.end)}`
      : removeAppendedBlock(source, range.start, range.end, block.prefix_sep);
    if (target.length === 0) await rm(filename, { force: true });
    else await writeAtomic(filename, target);
    removed.push({ path: block.path, kind: "block" });
  }

  for (const key of manifest.keys) {
    if (keptCreated.has(key.path)) continue;
    const filename = await confine(key.path, cwd);
    const source = await optionalText(filename);
    affected.push(key.path);
    if (source === null) continue;
    let root: Record<string, unknown>;
    try {
      root = decodeJson(source);
    } catch {
      kept.set(key.path, "edited-by-you");
      continue;
    }
    const current = pointerValue(root, key.pointer);
    if (!isDeepStrictEqual(current, key.installed)) {
      kept.set(key.path, "edited-by-you");
      continue;
    }
    const raw = canRestoreRaw(key, root);
    if (raw !== null) {
      await writeAtomic(filename, raw);
    } else {
      const restored = key.previous === null && key.previous_raw === undefined
        ? deleteJsonPointerBytes(source, key.pointer)
        : setJsonPointerBytes(source, key.pointer, key.previous);
      const parsed = decodeJson(restored);
      if (Object.keys(parsed).length === 0) await rm(filename, { force: true });
      else await writeAtomic(filename, restored);
    }
    removed.push({ path: key.path, kind: "key" });
  }

  const activePath = await confine(".tenet/manifest.json", cwd);
  const pendingPath = await confine(".tenet/manifest.pending.json", cwd);
  await rm(activePath, { force: true });
  await rm(pendingPath, { force: true });
  await removeEmptyManagedDirectories(cwd, affected.concat(
    ".tenet/manifest.json",
    ".tenet/manifest.pending.json",
  ));
  for (const root of retained) kept.set(root, "spec-or-records");
  return {
    removed: removed.sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 :
        left.kind < right.kind ? -1 : left.kind > right.kind ? 1 : 0),
    kept: [...kept.entries()]
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([itemPath, reason]) => ({ path: itemPath, reason })),
    reminder,
  };
}

async function retainedRoot(cwd: string, itemPath: string): Promise<boolean> {
  const filename = await confine(itemPath, cwd);
  try {
    return (await lstat(filename)).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function retainedRoots(cwd: string): Promise<string[]> {
  const roots = new Set<string>();
  const policyPath = await confine("tenet.yaml", cwd);
  const source = await optionalText(policyPath);
  if (source === null) return [];
  try {
    const policy = parseDocument(source).toJS() as {
      paths?: { records?: unknown };
      specs?: { documents?: Array<{ path?: unknown }> };
    };
    if (typeof policy.paths?.records === "string") roots.add(policy.paths.records);
    for (const document of policy.specs?.documents ?? []) {
      if (typeof document.path === "string") {
        roots.add(path.posix.dirname(document.path.replaceAll("\\", "/")));
      }
    }
  } catch {
    // The manifest still drives removal when a user-edited policy is no longer parseable.
  }
  roots.add("tenet");
  const existing: string[] = [];
  for (const root of roots) {
    if (await retainedRoot(cwd, root)) existing.push(root.replaceAll("\\", "/"));
  }
  return existing
    .sort()
    .filter((root, index, all) =>
      !all.slice(0, index).some((parent) =>
        root === parent || root.startsWith(`${parent}/`)));
}
