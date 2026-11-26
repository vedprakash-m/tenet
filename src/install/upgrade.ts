import { readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { confine, writeAtomic } from "../core/fs.js";
import { git } from "../core/git.js";
import { message } from "../core/messages.js";
import { fail, version } from "../core/output.js";
import { loadPolicy } from "../policy/index.js";
import { anchorBlock, citationParts, type AnchorRecord } from "../specs/anchors.js";
import { parseDoc } from "../specs/parse.js";
import { preflight } from "./preflight.js";
import { decodeJson, pointerValue, sha256Bytes } from "./manifest.js";
import { applyPlan, planWriteSet, readPendingPlan, resumePendingPlan } from "./writes.js";
import type {
  InstallManifest,
  LocalManifest,
  ManifestCreated,
  ManifestKey,
  PendingWrite,
  UpgradeChanged,
  UpgradeOptions,
  UpgradeResult,
  WriteSet,
} from "./types.js";
import { localProfileRoots } from "./environment.js";

type ChangeIndex = Map<string, UpgradeChanged["action"]>;

async function sourceAt(
  cwd: string,
  revision: string | null,
  filename: string,
): Promise<string | null> {
  if (revision !== null) {
    try {
      return await git(["show", `${revision}:${filename}`], { cwd });
    } catch {
      // Shallow clones can lack the blessing commit; current source is the fallback.
    }
  }
  try {
    const resolved = await confine(filename, cwd);
    return await readFile(resolved, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function migratedAnchor(
  cwd: string,
  citation: string,
  hash: string,
  revision: string | null,
): Promise<AnchorRecord> {
  const parsed = citationParts(citation);
  let start: number | null = parsed?.kind === "path" ? parsed.start : null;
  let end: number | null = parsed?.kind === "path" ? parsed.end : null;
  if (parsed) {
    const source = await sourceAt(cwd, revision, parsed.path);
    if (source !== null) {
      const block = anchorBlock(citation, (filename) => filename === parsed.path ? source : null);
      if (block) {
        start = block.start;
        end = block.end;
        hash = block.hash;
      }
    }
  }
  return { hash, start, end, blessed_at_rev: revision };
}

async function migrateLegacyAnchors(cwd: string): Promise<string[]> {
  const policy = await loadPolicy({ cwd });
  const changed: string[] = [];
  const documentPaths = [...new Set([
    ...policy.specs.documents.map((document) =>
      `${policy.paths.records}/${document.path.replaceAll("\\", "/")}`),
    `${policy.paths.records}/intent.md`,
  ])];
  for (const documentPath of documentPaths) {
    const filename = await confine(documentPath, cwd);
    const text = await readFile(filename, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (text === null) continue;
    const parsed = parseDoc(documentPath, text, { prefix: policy.specs.id_prefix });
    for (const section of parsed.sections) {
      if (!section.blessed_copy) continue;
      const sidecarPath = `${section.blessed_copy}.anchors.json`;
      const sidecarFile = await confine(sidecarPath, cwd);
      const raw = await readFile(sidecarFile, "utf8").catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      if (raw === null) continue;
      const old = JSON.parse(raw) as Record<string, unknown>;
      const needsMigration = Object.values(old).some((value) => typeof value === "string");
      if (!needsMigration) continue;
      const records: Record<string, AnchorRecord> = {};
      const citations = new Set([...Object.keys(section.anchors), ...Object.keys(old)]);
      for (const citation of citations) {
        records[citation] = await migratedAnchor(
          cwd,
          citation,
          section.anchors[citation] ?? "",
          section.blessed_at_rev,
        );
      }
      await writeAtomic(sidecarFile, `${JSON.stringify(records, null, 2)}\n`);
      changed.push(sidecarPath);
    }
  }
  return changed.sort();
}

async function currentManifest(cwd: string): Promise<InstallManifest | null> {
  try {
    const filename = await confine(".tenet/manifest.json", cwd);
    return JSON.parse(await readFile(filename, "utf8")) as InstallManifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    if ((error as NodeJS.ErrnoException).code === "TN-PATH-ESCAPE") {
      throw Object.assign(error as Error, {
        finding: { code: "TN-PATH-ESCAPE", file: ".tenet/manifest.json" },
      });
    }
    throw error;
  }
}

async function currentLocalManifest(cwd: string): Promise<LocalManifest | null> {
  try {
    const filename = await confine(".tenet/manifest.local.json", cwd);
    return JSON.parse(await readFile(filename, "utf8")) as LocalManifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    if ((error as NodeJS.ErrnoException).code === "TN-PATH-ESCAPE") {
      throw Object.assign(error as Error, {
        finding: { code: "TN-PATH-ESCAPE", file: ".tenet/manifest.local.json" },
      });
    }
    throw error;
  }
}

function replaceCreated(
  manifest: InstallManifest,
  itemPath: string,
  replacement: ManifestCreated | undefined,
): void {
  manifest.created = manifest.created.filter((item) => item.path !== itemPath);
  if (replacement) manifest.created.push(replacement);
}

function replaceKey(
  manifest: InstallManifest,
  itemPath: string,
  pointer: string,
  replacement: ManifestKey | undefined,
): void {
  manifest.keys = manifest.keys.filter((item) => item.path !== itemPath || item.pointer !== pointer);
  if (replacement) manifest.keys.push(replacement);
}

function actionFor(before: string | null, after: string): UpgradeChanged["action"] {
  if (before === null) return "created";
  return before === after ? "kept" : "replaced";
}

async function shouldApplyCreated(
  cwd: string,
  prior: InstallManifest | null,
  write: PendingWrite,
): Promise<{ apply: boolean; action: UpgradeChanged["action"] }> {
  const filename = await confine(write.path, cwd);
  let bytes: Buffer;
  try {
    bytes = await readFile(filename);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { apply: true, action: "created" };
    }
    throw error;
  }
  const after = write.after_sha256;
  const current = sha256Bytes(bytes);
  if (current === after) return { apply: false, action: "kept" };
  if (write.path === "tenet.lock") return { apply: true, action: "replaced" };
  const old = prior?.created.find((item) => item.path === write.path);
  return old?.sha256 === current
    ? { apply: true, action: "replaced" }
    : { apply: false, action: "kept" };
}

async function shouldApplyKey(
  cwd: string,
  prior: InstallManifest | null,
  write: PendingWrite,
): Promise<{ apply: boolean; action: UpgradeChanged["action"] }> {
  const filename = await confine(write.path, cwd);
  let source: string;
  try {
    source = await readFile(filename, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { apply: true, action: "created" };
    }
    throw error;
  }
  let value: unknown;
  try {
    value = pointerValue(decodeJson(source), write.pointer ?? "");
  } catch {
    return { apply: false, action: "kept" };
  }
  const targetRoot = decodeJson(write.content ?? "{}");
  const installed = pointerValue(targetRoot, write.pointer ?? "");
  if (isDeepStrictEqual(value, installed)) return { apply: false, action: "kept" };
  const old = prior?.keys.find((item) => item.path === write.path && item.pointer === write.pointer);
  if (!old) return value === undefined
    ? { apply: true, action: "replaced" }
    : { apply: false, action: "kept" };
  return isDeepStrictEqual(value, old.installed)
    ? { apply: true, action: "replaced" }
    : { apply: false, action: "kept" };
}

async function shouldApplyLocalKey(
  profileRoots: Partial<Record<string, string>> | undefined,
  packageName: string,
  previousVersion: string,
  write: PendingWrite,
): Promise<{ apply: boolean; action: UpgradeChanged["action"] }> {
  if (!write.pointer || !write.content) return { apply: false, action: "kept" };
  const host = write.id.split(":")[2];
  const rootValue = write.profile_root ?? (host ? profileRoots?.[host] : undefined);
  if (!rootValue) return { apply: false, action: "kept" };
  const root = path.resolve(rootValue);
  const relative = path.relative(root, path.resolve(write.path));
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return { apply: false, action: "kept" };
  }
  const filename = await confine(relative.replaceAll("\\", "/"), root);
  let source: string;
  try {
    source = await readFile(filename, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { apply: false, action: "kept" };
    throw error;
  }
  let current: unknown;
  try {
    current = pointerValue(decodeJson(source), write.pointer);
  } catch {
    return { apply: false, action: "kept" };
  }
  const target = pointerValue(decodeJson(write.content), write.pointer);
  if (isDeepStrictEqual(current, target)) return { apply: false, action: "kept" };
  const expected = {
    command: "cmd",
    args: ["/c", "npx", "-y", `${packageName}@${previousVersion}`, "mcp"],
  };
  return isDeepStrictEqual(current, expected)
    ? { apply: true, action: "replaced" }
    : { apply: false, action: "kept" };
}

function sortChanged(index: ChangeIndex): UpgradeChanged[] {
  return [...index.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([itemPath, action]) => ({ path: itemPath, action }));
}

export async function upgrade(options: UpgradeOptions = {}): Promise<UpgradeResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const prior = await currentManifest(cwd);
  const pending = await readPendingPlan(cwd, options.environment?.localProfileRoot);
  const installedVersion = options.environment?.installedVersion ?? version;
  if (prior && prior.version === installedVersion && pending === null) {
    const changed = (await migrateLegacyAnchors(cwd))
      .map((path) => ({ path, action: "replaced" as const }));
    const check = options.check ?? (await import("../specs/check.js")).check;
    await check({ cwd, installedVersion });
    return { from: prior.version, to: installedVersion, changed };
  }
  const preflightOptions = { ...options };
  const result = await preflight(preflightOptions);
  if (!result.plan || result.diagnostics.length > 0) {
    throw Object.assign(
      new Error(result.diagnostics[0]?.message ?? "Upgrade preflight failed."),
      { finding: result.diagnostics[0] },
    );
  }
  const local = await currentLocalManifest(cwd);
  const profileRoots = {
    ...localProfileRoots(options.environment),
    ...local?.profile_roots,
  };
  result.plan.local_keys = local?.keys.map(({ host, path: itemPath, pointer }) => ({
    host,
    path: itemPath,
    pointer,
  })) ?? [];
  if (local) {
    result.plan.created = [...new Set([...result.plan.created, ".tenet/manifest.local.json"])];
    result.plan.created.sort();
  }
  if (pending) {
    const original = pending.upgrade;
    if (!original) {
      throw Object.assign(new Error("Pending install plan has no upgrade classification."), {
        code: "TN-INIT-EXISTS",
        finding: { code: "TN-INIT-EXISTS", file: ".tenet/manifest.pending.json" },
      });
    }
    await resumePendingPlan(cwd, result, {
      ...(options.fault ? { fault: options.fault } : {}),
      ...(options.environment?.localProfileRoot
        ? { localProfileRoot: options.environment.localProfileRoot }
        : {}),
    });
    const check = options.check ?? (await import("../specs/check.js")).check;
    await check({ cwd, installedVersion: pending.version });
    return {
      from: original.from,
      to: original.to,
      changed: original.changed,
    };
  }
  if (!prior) {
    const itemPath = ".tenet/manifest.json";
    const words = message("TN-INIT-EXISTS", { path: itemPath });
    throw Object.assign(new Error(words.message), {
      code: "TN-INIT-EXISTS",
      finding: { ...fail("TN-INIT-EXISTS", words.message, words.fix), file: itemPath },
    });
  }
  await resumePendingPlan(cwd, result, {
    ...(options.fault ? { fault: options.fault } : {}),
    ...(options.environment?.localProfileRoot
      ? { localProfileRoot: options.environment.localProfileRoot }
      : {}),
  });
  const planned = await planWriteSet(result, { ...options, force: true, command: "upgrade" });
  const targetVersion = planned.version;
  const packageName = options.environment?.registry?.package ?? "@vedprakash-m/tenet";
  const previousVersion = prior?.version ?? targetVersion;
  const changes: ChangeIndex = new Map();
  changes.set("tenet.yaml", "kept");

  const writes: PendingWrite[] = [];
  const manifest = structuredClone(planned.manifest);
  for (const write of planned.writes) {
    if (write.path === "tenet.yaml" && write.kind === "file") {
      replaceCreated(manifest, write.path, prior?.created.find((item) => item.path === write.path));
      continue;
    }
    let decision: { apply: boolean; action: UpgradeChanged["action"] };
    if (write.kind === "file") {
      decision = await shouldApplyCreated(cwd, prior, write);
      if (!decision.apply) {
        const old = prior?.created.find((item) => item.path === write.path);
        replaceCreated(manifest, write.path, old);
      }
    } else if (write.kind === "key") {
      decision = await shouldApplyKey(cwd, prior, write);
      if (!decision.apply) {
        const old = prior?.keys.find((item) =>
          item.path === write.path && item.pointer === write.pointer);
        replaceKey(manifest, write.path, write.pointer ?? "", old);
      }
    } else if (write.kind === "local_key") {
      decision = await shouldApplyLocalKey(
        profileRoots,
        packageName,
        previousVersion,
        write,
      );
    } else {
      decision = { apply: true, action: actionFor(write.before_sha256, write.after_sha256) };
    }
    changes.set(write.path, decision.action);
    if (decision.apply) writes.push(write);
  }
  for (const block of prior?.blocks ?? []) {
    const target = manifest.blocks.find((item) => item.path === block.path);
    if (target) {
      if (block.previous_block !== undefined) target.previous_block = block.previous_block;
      else delete target.previous_block;
      if (block.prefix_sep !== undefined) target.prefix_sep = block.prefix_sep;
      else delete target.prefix_sep;
    }
  }
  for (const key of prior?.keys ?? []) {
    const target = manifest.keys.find((item) => item.path === key.path && item.pointer === key.pointer);
    if (target && writes.some((write) =>
      write.kind === "key" && write.path === key.path && write.pointer === key.pointer)) {
      target.previous = key.previous;
      if (key.previous_raw !== undefined) target.previous_raw = key.previous_raw;
      else delete target.previous_raw;
    }
  }
  manifest.created.sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  manifest.blocks.sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  manifest.keys.sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 :
      left.pointer < right.pointer ? -1 : left.pointer > right.pointer ? 1 : 0);

  const changed = sortChanged(changes);
  const plan: WriteSet = {
    ...planned,
    writes,
    manifest,
    upgrade: {
      from: previousVersion,
      to: targetVersion,
      changed,
    },
  };
  await applyPlan(plan, {
    ...(options.fault ? { fault: options.fault } : {}),
    ...(options.environment?.localProfileRoot
      ? { localProfileRoot: options.environment.localProfileRoot }
      : {}),
  });
  const check = options.check ?? (await import("../specs/check.js")).check;
  await check({ cwd, installedVersion: targetVersion });
  return {
    from: previousVersion,
    to: targetVersion,
    changed,
  };
}
