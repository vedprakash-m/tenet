import { spawn } from "node:child_process";
import { git, catFileBatch } from "../core/git.js";
import { message } from "../core/messages.js";
import { fail, type Finding } from "../core/output.js";

export type TrackedFile = { path: string; oid: string; size: number; regular: boolean };

type BlobInspection = { blobs: Map<string, Buffer>; generatedHeaders: Set<string> };

export type RepositorySnapshot = {
  cwd: string;
  revision: string;
  dirty: boolean;
  files: TrackedFile[];
  read: (files: TrackedFile[], maxBytes: number) => Promise<BlobInspection>;
  dates: (paths: string[]) => Promise<Map<string, string>>;
};

export type Preflight = {
  revision: string;
  read_count: number;
  skipped_count: number;
  dirty_warning: boolean;
};

export function preflight(snapshot: RepositorySnapshot, sources: { files: unknown[]; skipped: unknown[] }): Preflight {
  return {
    revision: snapshot.revision,
    read_count: sources.files.length,
    skipped_count: sources.skipped.length,
    dirty_warning: snapshot.dirty,
  };
}

function environmentError(code: string, vars: Record<string, string> = {}): Finding {
  const words = message(code, vars);
  return fail(code, words.message, words.fix);
}

export function missingRepository(cwd: string): Finding {
  return environmentError("TN-ENV-NOT-GIT", { path: cwd });
}

function readBlob(cwd: string, oid: string, limit: number, inspectHeader: boolean): Promise<{ bytes: Buffer; generated: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["cat-file", "blob", oid], {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    const chunks: Buffer[] = [];
    let length = 0;
    let openingLines = inspectHeader ? 5 : 0;
    let tail = "";
    let generated = false;
    child.stdout.on("data", (chunk: Buffer) => {
      if (length < limit) {
        const kept = chunk.subarray(0, limit - length);
        chunks.push(kept);
        length += kept.length;
      }
      if (openingLines > 0 && !generated) {
        let end = 0;
        while (openingLines > 0) {
          const newline = chunk.indexOf(10, end);
          if (newline === -1) { end = chunk.length; break; }
          openingLines -= 1;
          end = newline + 1;
        }
        const header = tail + chunk.toString("latin1", 0, end);
        generated = /Code generated|@generated/.test(header);
        tail = header.slice(-13);
      }
      if (length === limit && (generated || openingLines === 0)) child.kill();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || (length === limit && (generated || openingLines === 0))) {
        resolve({ bytes: Buffer.concat(chunks, length), generated });
      } else {
        reject(new Error("Git object could not be read"));
      }
    });
  });
}

async function readBlobs(cwd: string, revision: string, files: TrackedFile[], limit: number): Promise<BlobInspection> {
  const blobs = new Map<string, Buffer>();
  const generatedHeaders = new Set<string>();
  let batch: TrackedFile[] = [];
  let total = 0;
  const flush = async () => {
    for (const [file, contents] of await catFileBatch(revision, batch.map((item) => item.path), { cwd })) {
      blobs.set(file, contents);
    }
    batch = [];
    total = 0;
  };
  for (const file of files) {
    const oversize = file.size > limit;
    if (oversize || /[\r\n\\]/.test(file.path)) {
      const inspected = await readBlob(cwd, file.oid, oversize ? 8192 : file.size, oversize);
      blobs.set(file.path, inspected.bytes);
      if (inspected.generated) generatedHeaders.add(file.path);
    } else {
      if (batch.length >= 128 || total + file.size > 8 * 1024 * 1024) await flush();
      batch.push(file);
      total += file.size;
    }
  }
  await flush();
  return { blobs, generatedHeaders };
}

async function docDates(cwd: string, revision: string, paths: string[]): Promise<Map<string, string>> {
  const dates = new Map<string, string>();
  const pending = new Set(paths);
  const log = ["--literal-pathspecs", "log", "--format=%x1e%H%x09%cI", "--name-only", "--no-renames", "-z"];
  const readDates = (output: string) => {
    let date: string | undefined;
    let firstPath = false;
    for (const token of output.split("\0")) {
      const header = token.startsWith("\u001e")
        ? /^[0-9a-f]{40,64}\t(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2}))$/.exec(token.slice(1))
        : null;
      if (header?.[1]) {
        date = new Date(header[1]).toISOString().replace(".000Z", "Z");
        firstPath = true;
        continue;
      }
      // Git inserts one newline before the first filename of each commit.
      const filename = firstPath && token.startsWith("\n") ? token.slice(1) : token;
      firstPath = false;
      if (date && pending.delete(filename)) dates.set(filename, date);
      if (pending.size === 0) break;
    }
  };
  const stdinPaths = paths.filter((file) => !/[\r\n]/.test(file));
  if (stdinPaths.length > 0) {
    const input = [revision, "--", ...stdinPaths, ""].join("\n");
    readDates(await git([...log, "--stdin"], { cwd, input }));
  }
  // The log stdin protocol is line-delimited. Keep unusual paths literal and
  // pass one at a time so the argument vector is bounded for every filename.
  for (const file of paths) {
    if (/[\r\n]/.test(file)) readDates(await git([...log, revision, "--", file], { cwd }));
  }
  return dates;
}

export async function openRepository(directory: string): Promise<RepositorySnapshot> {
  const cwd = await git(["rev-parse", "--show-toplevel"], { cwd: directory })
    .then((value) => value.trimEnd(), () => { throw missingRepository(directory); });
  const revision = await git(["rev-parse", "--verify", "HEAD^{commit}"], { cwd })
    .then((value) => value.trim(), () => { throw environmentError("TN-ENV-NO-COMMIT"); });
  const [tree, status] = await Promise.all([
    git(["ls-tree", "-r", "-l", "-z", revision], { cwd }),
    git(["status", "--porcelain", "-z", "--untracked-files=normal", "--", ".", ":(exclude).tenet/onboard", ":(exclude).tenet/reports"], { cwd }),
  ]);
  const files = tree.split("\0").filter(Boolean).map((entry) => {
    const match = /^(\d+) (?:blob|commit) ([0-9a-f]+) +([\d-]+)\t([\s\S]+)$/.exec(entry);
    if (!match?.[1] || !match[2] || !match[3] || !match[4]) throw new Error("Invalid Git tree entry");
    return { path: match[4], oid: match[2], size: Number(match[3]) || 0, regular: /^100/.test(match[1]) };
  });
  return {
    cwd, revision, files, dirty: status.length > 0,
    read: (selected, maxBytes) => readBlobs(cwd, revision, selected, maxBytes),
    dates: (paths) => docDates(cwd, revision, paths),
  };
}
