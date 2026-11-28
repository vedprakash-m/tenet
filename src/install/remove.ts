import { isDeepStrictEqual } from "node:util";
import type { Stats } from "node:fs";
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
  LocalManifest,
  ManifestKey,
  PendingManifest,
  RemoveKept,
  RemoveOptions,
  RemoveRemoved,
  RemoveResult,
} from "./types.js";
import { localProfileRoot } from "./environment.js";

const reminder = "If you made the Tenet check required in branch protection or rulesets, remove that rule in your forge settings.";
const standardReportPaths = [
  "test.xml",
  "test.json",
  "junit.xml",
  "ctrf.json",
  "go-test.json",
  "go-test-json.json",
  "jest.json",
  "jest-json.json",
].map((name) => `.tenet/reports/${name}`);
const managedDirectoryPaths = [
  ".tenet/onboard",
  ".tenet/reports",
  ".tenet/cache",
  ".tenet/runs",
  ".tenet",
];

function generatedWorkingPaths(reportPaths: string[]): string[] {
  return [
    ...standardReportPaths,
    ...reportPaths,
  ];
}
function pathError(itemPath: string): Error & { code: string; finding: unknown } {
  const words = message("TN-PATH-ESCAPE", { path: itemPath });
  const finding = { ...fail("TN-PATH-ESCAPE", words.message, words.fix), file: itemPath };
  return Object.assign(new Error(words.message), { code: "TN-PATH-ESCAPE", finding });
}

type SymlinkPath = {
  filename: string;
  relative: string;
};

function samePath(left: string, right: string, caseInsensitive: boolean): boolean {
  const normalizedLeft = left.replaceAll("\\", "/");
  const normalizedRight = right.replaceAll("\\", "/");
  return caseInsensitive
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

async function symlinkPath(cwd: string, relative: string): Promise<SymlinkPath | null> {
  const portable = relative.replaceAll("\\", "/");
  if (
    portable.length === 0 ||
    portable.includes("\0") ||
    path.posix.isAbsolute(portable) ||
    path.win32.isAbsolute(relative) ||
    portable.startsWith("//") ||
    portable.split("/").includes("..")
  ) {
    throw pathError(relative);
  }
  let filename = path.resolve(cwd);
  const visited: string[] = [];
  for (const part of portable.split("/").filter((item) => item !== "" && item !== ".")) {
    filename = path.join(filename, part);
    visited.push(part);
    try {
      const stat = await lstat(filename);
      if (stat.isSymbolicLink()) {
        return { filename, relative: visited.join("/") };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  return null;
}

async function validateRemovalPath(cwd: string, relative: string): Promise<void> {
  if (await symlinkPath(cwd, relative)) return;
  await confine(relative, cwd).catch(() => {
    throw pathError(relative);
  });
}

async function validateRecordedPath(cwd: string, relative: string): Promise<void> {
  const portable = relative.replaceAll("\\", "/").replace(/^\.\/+/, "");
  const link = await symlinkPath(cwd, portable);
  if (link && link.relative !== portable) throw pathError(relative);
  if (link) return;
  await confine(relative, cwd).catch(() => {
    throw pathError(relative);
  });
}

async function unlinkRecordedPath(cwd: string, relative: string, preview: boolean): Promise<boolean> {
  const link = await symlinkPath(cwd, relative);
  if (!link) return false;
  if (link.relative !== relative.replaceAll("\\", "/").replace(/^\.\/+/, "")) {
    throw pathError(relative);
  }
  if (!preview) await rm(link.filename);
  return true;
}

async function optionalText(filename: string): Promise<string | null> {
  try {
    return await readFile(filename, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

type WindowsPathMatch = {
  filename: string;
  link: boolean;
} | null;

async function windowsPathMatch(cwd: string, relative: string): Promise<WindowsPathMatch> {
  let current = path.resolve(cwd);
  const parts = relative.replaceAll("\\", "/").split("/").filter((item) =>
    item !== "" && item !== ".");
  for (const [index, part] of parts.entries()) {
    const entries = await readdir(current);
    const actual = entries.find((entry) => entry.toLowerCase() === part.toLowerCase());
    if (!actual) return null;
    if (index === parts.length - 1 && actual !== part) return null;
    current = path.join(current, actual);
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) return { filename: current, link: true };
    if (index !== parts.length - 1 && !stat.isDirectory()) return null;
  }
  return { filename: current, link: false };
}

async function manifestFile(cwd: string): Promise<{
  manifest: InstallManifest | null;
  pending: PendingManifest | null;
  localManifest: LocalManifest | null;
}> {
  const activeLink = await symlinkPath(cwd, ".tenet/manifest.json");
  const pendingLink = await symlinkPath(cwd, ".tenet/manifest.pending.json");
  const localLink = await symlinkPath(cwd, ".tenet/manifest.local.json");
  if (activeLink || pendingLink || localLink) {
    return { manifest: null, pending: null, localManifest: null };
  }
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
  let localManifest: LocalManifest | null = null;
  const localPath = await confine(".tenet/manifest.local.json", cwd);
  const localText = await optionalText(localPath);
  if (localText !== null) localManifest = JSON.parse(localText) as LocalManifest;
  else {
    const pendingLocal = pending?.writes.find((write) =>
      write.path === ".tenet/manifest.local.json" && write.content !== undefined);
    if (pendingLocal?.content !== undefined) {
      localManifest = JSON.parse(pendingLocal.content) as LocalManifest;
    }
  }
  return { manifest: active ?? pending?.manifest ?? null, pending, localManifest };
}

async function validateRecordedPaths(
  cwd: string,
  manifest: InstallManifest,
  pending: PendingManifest | null,
  localProfileRoot: string | undefined,
  localManifest: LocalManifest | null,
): Promise<void> {
  const repoPaths = [
    ...manifest.created.map((item) => item.path),
    ...manifest.blocks.map((item) => item.path),
    ...manifest.keys.map((item) => item.path),
    ...(manifest["x-created-directories"] ?? []),
    ...(pending?.writes.filter((item) => item.kind !== "local_key").map((item) => item.path) ?? []),
  ];
  for (const itemPath of [...new Set(repoPaths)]) {
    await validateRecordedPath(cwd, itemPath);
  }
  const recordedRoots = Object.values(localManifest?.profile_roots ?? {});
  if (!localProfileRoot && recordedRoots.length === 0) {
    const local = pending?.writes.find((item) => item.kind === "local_key");
    if (local) throw pathError(local.path);
    return;
  }
  const roots = [localProfileRoot, ...recordedRoots]
    .filter((root): root is string => Boolean(root))
    .map((root) => {
      if (!path.isAbsolute(root)) {
        throw pathError(root);
      }
      return path.resolve(root);
    });
  const localPaths = [
    ...(pending?.writes.filter((item) => item.kind === "local_key").map((item) => item.path) ?? []),
    ...(localManifest?.keys.map((item) => item.path) ?? []),
  ];
  for (const itemPath of new Set(localPaths)) {
    let accepted = false;
    for (const root of roots) {
      const relative = path.relative(root, path.resolve(itemPath));
      if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        continue;
      }
      try {
        await confine(relative.replaceAll("\\", "/"), root);
        accepted = true;
        break;
      } catch {
        // Try the other permitted recorded root.
      }
    }
    if (!accepted) throw pathError(itemPath);
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

function restoreKeyBytes(source: string, key: ManifestKey): string | null {
  if (key.previous_raw === undefined) return null;
  const previous = decodeJson(key.previous_raw);
  const previousValue = pointerValue(previous, key.pointer);
  const candidate = previousValue === undefined
    ? deleteJsonPointerBytes(source, key.pointer)
    : setJsonPointerBytes(source, key.pointer, previousValue);
  try {
    return isDeepStrictEqual(decodeJson(candidate), previous) ? key.previous_raw : candidate;
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

async function removeEmptyManagedDirectories(cwd: string, directories: string[]): Promise<void> {
  for (const candidate of [...new Set(directories)].sort((left, right) => right.length - left.length)) {
    const link = await symlinkPath(cwd, candidate);
    if (link) {
      await rm(link.filename, { force: true });
      continue;
    }
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

function configuredReportPaths(source: string | null, caseInsensitive: boolean): string[] {
  if (source === null) return [];
  try {
    const document = parseDocument(source, { merge: false, uniqueKeys: true });
    if (document.errors.length > 0) return [];
    const data = document.toJS({ maxAliasCount: 100 }) as { checks?: unknown } | null;
    if (!data?.checks || typeof data.checks !== "object" || Array.isArray(data.checks)) return [];
    return Object.values(data.checks).flatMap((check) => {
      if (!check || typeof check !== "object" || Array.isArray(check)) return [];
      const reportPath = (check as Record<string, unknown>).report_path;
      if (typeof reportPath !== "string") return [];
      const normalized = reportPath.replaceAll("\\", "/").replace(/^\.\/+/, "");
      const prefix = ".tenet/reports/";
      return (caseInsensitive
        ? normalized.toLowerCase().startsWith(prefix)
        : normalized.startsWith(prefix)) ? [normalized] : [];
    });
  } catch {
    return [];
  }
}

async function removePathTree(
  cwd: string,
  relative: string,
  removed: RemoveRemoved[],
  removeDirectory: boolean,
  preview: boolean,
): Promise<void> {
  const portable = relative.replaceAll("\\", "/");
  const link = await symlinkPath(cwd, portable);
  if (link) {
    if (!preview) await rm(link.filename, { force: true });
    if (!removed.some((item) => item.path === link.relative && item.kind === "file")) {
      removed.push({ path: link.relative, kind: "file" });
    }
    return;
  }
  const parent = path.posix.dirname(portable);
  let parentPath: string;
  try {
    parentPath = await confine(parent === "." ? "." : parent, cwd);
  } catch {
    throw pathError(relative);
  }
  const filename = path.resolve(parentPath, path.posix.basename(portable));
  let stat: Stats;
  try {
    stat = await lstat(filename);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    if (!preview) await rm(filename, { force: true });
    removed.push({ path: relative, kind: "file" });
    return;
  }
  const entries = await readdir(filename, { withFileTypes: true });
  for (const entry of entries) {
    await removePathTree(
      cwd,
      path.posix.join(relative.replaceAll("\\", "/"), entry.name),
      removed,
      true,
      preview,
    );
  }
  if (removeDirectory && !preview) {
    try {
      await rmdir(filename);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTEMPTY") throw error;
    }
  }
}

async function removeRegularFile(
  cwd: string,
  relative: string,
  removed: RemoveRemoved[],
  caseInsensitive: boolean,
  preview: boolean,
): Promise<boolean> {
  if (caseInsensitive) {
    const matched = await windowsPathMatch(cwd, relative);
    if (!matched) return false;
    const stat = await lstat(matched.filename);
    if (!matched.link && !stat.isFile()) return false;
    if (!preview) await rm(matched.filename);
    removed.push({ path: relative, kind: "file" });
    return true;
  }
  const link = await symlinkPath(cwd, relative);
  if (link) {
    if (!preview) await rm(link.filename, { force: true });
    if (!removed.some((item) => item.path === link.relative && item.kind === "file")) {
      removed.push({ path: link.relative, kind: "file" });
    }
    return true;
  }
  let filename: string;
  try {
    filename = await confine(relative, cwd);
  } catch {
    throw pathError(relative);
  }
  try {
    const stat = await lstat(filename);
    if (!stat.isFile()) return false;
    if (!preview) await rm(filename);
    removed.push({ path: relative, kind: "file" });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function removeGeneratedWorkingState(
  cwd: string,
  reportPaths: string[],
  removed: RemoveRemoved[],
  createdDirectories: Set<string> | null,
  caseInsensitive: boolean,
  preview: boolean,
): Promise<void> {
  const removedParents = new Set<string>();
  const onboardPath = path.resolve(cwd, ".tenet", "onboard");
  try {
    const entries = await readdir(onboardPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.toLowerCase() === "interview.json") continue;
      const relative = path.posix.join(".tenet/onboard", entry.name);
      await removePathTree(cwd, relative, removed, true, preview);
      removedParents.add(".tenet/onboard");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  for (const relative of new Set(generatedWorkingPaths(reportPaths))) {
    if (await removeRegularFile(cwd, relative, removed, caseInsensitive, preview)) {
      removedParents.add(path.posix.dirname(relative));
    }
  }
  for (const directory of [".tenet/cache", ".tenet/runs"]) {
    await removePathTree(
      cwd,
      directory,
      removed,
      createdDirectories === null || createdDirectories.has(directory),
      preview,
    );
  }
  const removableParents = createdDirectories === null
    ? [...removedParents, ".tenet"]
    : [...removedParents].filter((directory) =>
      [...createdDirectories].some((created) =>
        samePath(created, directory, caseInsensitive)));
  if (!preview) await removeEmptyManagedDirectories(
    cwd,
    removableParents.filter((directory) => directory.startsWith(".tenet")),
  );
}

async function interviewAnswersExist(
  cwd: string,
  caseInsensitive: boolean,
): Promise<boolean> {
  const relative = ".tenet/onboard/interview.json";
  if (await symlinkPath(cwd, relative)) return true;
  if (caseInsensitive) return (await windowsPathMatch(cwd, relative)) !== null;
  try {
    await lstat(await confine(relative, cwd));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export function remove(options: RemoveOptions = {}): Promise<RemoveResult> {
  return processRemoval(options, false);
}

export function previewRemoval(options: RemoveOptions = {}): Promise<RemoveResult> {
  return processRemoval(options, true);
}

async function processRemoval(options: RemoveOptions, preview: boolean): Promise<RemoveResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const caseInsensitive = (options.environment?.platform ?? process.platform) === "win32";
  const retained = await retainedRoots(cwd);
  const configuredReports = configuredReportPaths(
    await optionalText(await confine("tenet.yaml", cwd)),
    caseInsensitive,
  );
  for (const relative of [
    "tenet.yaml",
    ".tenet/manifest.json",
    ".tenet/manifest.pending.json",
    ".tenet/manifest.local.json",
    ...generatedWorkingPaths(configuredReports),
    ...managedDirectoryPaths,
  ]) {
    await validateRemovalPath(cwd, relative);
  }
  const { manifest, pending, localManifest } = await manifestFile(cwd);
  const removed: RemoveRemoved[] = [];
  const kept = new Map<string, RemoveKept["reason"]>();
  const removeControlFile = async (relative: string) => {
    const link = manifest ? null : await symlinkPath(cwd, relative);
    const filename = link?.filename ?? await confine(relative, cwd);
    if (!preview) await rm(filename, { force: true });
    else {
      try {
        await lstat(filename);
        removed.push({ path: relative, kind: "file" });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  };
  if (!manifest) {
    for (const relative of [".tenet/manifest.json", ".tenet/manifest.pending.json", ".tenet/manifest.local.json"]) {
      await removeControlFile(relative);
    }
    if (preview) for (const root of retained) kept.set(root, "spec-or-records");
    await removeGeneratedWorkingState(
      cwd,
      configuredReports,
      removed,
      null,
      caseInsensitive,
      preview,
    );
    if (await interviewAnswersExist(cwd, caseInsensitive)) {
      kept.set(".tenet/onboard/interview.json", "owner-answers");
    }
    return {
      removed: removed.sort((left, right) =>
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0),
      kept: [...kept.entries()].map(([itemPath, reason]) => ({
        path: itemPath,
        reason,
      })),
      reminder,
    };
  }
  await validateRecordedPaths(
    cwd,
    manifest,
    pending,
    localProfileRoot(options.environment),
    localManifest,
  );

  const keptCreated = new Set<string>();
  const removedCreated = new Set<string>();
  for (const item of manifest.created) {
    if (await unlinkRecordedPath(cwd, item.path, preview)) {
      removed.push({ path: item.path, kind: "file" });
      removedCreated.add(item.path);
      continue;
    }
    const filename = await confine(item.path, cwd);
    try {
      const bytes = await readFile(filename);
      if (sha256Bytes(bytes) !== item.sha256) {
        kept.set(item.path, "edited-by-you");
        keptCreated.add(item.path);
        continue;
      }
      if (!preview) await rm(filename);
      removed.push({ path: item.path, kind: "file" });
      removedCreated.add(item.path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  for (const block of manifest.blocks) {
    if (keptCreated.has(block.path) || removedCreated.has(block.path)) continue;
    if (await unlinkRecordedPath(cwd, block.path, preview)) {
      removed.push({ path: block.path, kind: "block" });
      continue;
    }
    const filename = await confine(block.path, cwd);
    const source = await optionalText(filename);
    if (source === null) continue;
    const range = blockRange(source, block.kind);
    if (!range) {
      kept.set(block.path, "edited-by-you");
      continue;
    }
    let target = block.previous_block !== undefined && block.previous_block !== null
      ? `${source.slice(0, range.start)}${block.previous_block}${source.slice(range.end)}`
      : removeAppendedBlock(source, range.start, range.end, block.prefix_sep);
    if (block.previous_block === "" && (target === "\n" || target === "\r\n")) target = "";
    const previousExisted = block.previous_existed ??
      (block.previous_block !== undefined && block.previous_block !== null);
    if (!preview) {
      if (target.length === 0 && !previousExisted) await rm(filename, { force: true });
      else await writeAtomic(filename, target);
    }
    removed.push({ path: block.path, kind: "block" });
  }

  for (const key of manifest.keys) {
    if (keptCreated.has(key.path) || removedCreated.has(key.path)) continue;
    if (await unlinkRecordedPath(cwd, key.path, preview)) {
      removed.push({ path: key.path, kind: "key" });
      continue;
    }
    const filename = await confine(key.path, cwd);
    const source = await optionalText(filename);
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
    const raw = restoreKeyBytes(source, key);
    if (key.previous_raw === undefined) {
      if (!preview) await rm(filename, { force: true });
    } else if (raw !== null) {
      if (!preview) await writeAtomic(filename, raw);
    } else {
      kept.set(key.path, "edited-by-you");
      continue;
    }
    removed.push({ path: key.path, kind: "key" });
  }

  for (const key of localManifest?.keys ?? []) {
    const source = await optionalText(key.path);
    if (source === null) continue;
    let root: Record<string, unknown>;
    try {
      root = decodeJson(source);
    } catch {
      kept.set(key.path, "edited-by-you");
      continue;
    }
    if (!isDeepStrictEqual(pointerValue(root, key.pointer), key.installed)) {
      kept.set(key.path, "edited-by-you");
      continue;
    }
    const raw = restoreKeyBytes(source, key);
    if (key.previous_raw === undefined) {
      if (!preview) await rm(key.path, { force: true });
    } else if (raw !== null) {
      if (!preview) await writeAtomic(key.path, raw);
    } else {
      const restored = structuredClone(root);
      restorePrevious(key, restored);
      if (!preview && Object.keys(restored).length === 0) await rm(key.path, { force: true });
      else if (!preview) await writeAtomic(key.path, `${JSON.stringify(restored, null, 2)}\n`);
    }
    removed.push({ path: key.path, kind: "key" });
  }

  await removeControlFile(".tenet/manifest.json");
  await removeControlFile(".tenet/manifest.pending.json");
  if (!keptCreated.has(".tenet/manifest.local.json")) {
    if (!removedCreated.has(".tenet/manifest.local.json")) await removeControlFile(".tenet/manifest.local.json");
  }
  const createdDirectories = manifest["x-created-directories"] ?? [];
  await removeGeneratedWorkingState(
    cwd,
    configuredReports,
    removed,
    new Set(createdDirectories),
    caseInsensitive,
    preview,
  );
  if (!preview) await removeEmptyManagedDirectories(cwd, createdDirectories);
  for (const root of retained) {
    if (!createdDirectories.includes(root) || await retainedRoot(cwd, root)) {
      kept.set(root, "spec-or-records");
    }
  }
  if (await interviewAnswersExist(cwd, caseInsensitive)) {
    kept.set(".tenet/onboard/interview.json", "owner-answers");
  }
  return {
    removed: [...new Map(removed.map((item) =>
      [`${item.path}\0${item.kind}`, item])).values()]
      .sort((left, right) =>
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
