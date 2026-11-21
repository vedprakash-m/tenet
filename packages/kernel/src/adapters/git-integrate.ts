import {
  closeSync, constants, fstatSync, ftruncateSync, lstatSync, mkdirSync, mkdtempSync, openSync,
  readFileSync, rmSync, writeFileSync, writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { sha256 } from "../core/ids.ts";
import type { Resolved, RunResult } from "../ports/types.ts";

interface GitResult { code?: number; exit?: number; stdout: string; stderr: string; timedOut?: boolean; signal?: unknown }
type Read = (args: string[]) => Promise<string | null>;
type Run = (args: string[]) => Promise<GitResult>;

const failed = (r: GitResult) => (r.exit ?? r.code) !== 0 || !!r.timedOut || !!r.signal;

export async function pinIntegration(
  base: string, work: string, options: { baseTip?: string; workTip?: string } | undefined, read: Read, run: Run,
): Promise<{ base: string; work: string; pinned: boolean }> {
  const baseTip = options?.baseTip, workTip = options?.workTip;
  if (!baseTip) return { base, work, pinned: false };
  if (await read(["rev-parse", "--verify", `refs/heads/${base}`]) !== baseTip)
    throw new Error("the base branch moved after the proposal; nothing was integrated");
  if (workTip && await read(["rev-parse", "--verify", `refs/heads/${work}`]) !== workTip)
    throw new Error("the work branch moved after the proposal; nothing was integrated");
  const detached = await run(["switch", "-q", "--detach", baseTip]);
  if (failed(detached)) {
    throw new Error(detached.stderr || "branch switch did not complete cleanly");
  }
  return { base: baseTip, work: workTip ?? work, pinned: true };
}

export async function publishPinned(
  base: string, commit: string, baseTip: string | undefined, run: Run,
): Promise<void> {
  if (!baseTip) return;
  const moved = await run(["update-ref", `refs/heads/${base}`, commit, baseTip]);
  if (failed(moved)) throw new Error(moved.stderr || "the base branch moved before the integration could be published");
  const back = await run(["switch", "-q", base]);
  if (failed(back)) throw new Error(back.stderr || "the integration landed but the editor did not return to the base branch");
}

export interface IntegrationProof {
  base: string; baseTip: string; work: string; workTip: string; proposal?: string; commit: string; tree: string;
}

export function writeIntegrationProof(runDir: string, proof: IntegrationProof) {
  const fd = openSync(
    join(runDir, "integration.json"),
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  try { writeFileSync(fd, JSON.stringify(proof)); } finally { closeSync(fd); }
}

export function readIntegrationProof(runDir: string | undefined): IntegrationProof | null {
  if (!runDir) return null;
  let fd = -1;
  try {
    fd = openSync(join(runDir, "integration.json"), constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > 8192) throw new Error("integration proof is not a bounded regular file");
    const value = JSON.parse(readFileSync(fd, "utf8"));
    const strings = ["base", "baseTip", "work", "workTip", "commit", "tree"];
    if (!value || strings.some((key) => typeof value[key] !== "string") ||
      (value.proposal !== undefined && typeof value.proposal !== "string")) throw new Error("integration proof is invalid");
    return value as IntegrationProof;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  } finally {
    if (fd >= 0) closeSync(fd);
  }
}

export async function finishIntegration(
  runDir: string, base: string, work: string, options: {
    baseTip?: string; workTip?: string; proposal?: string;
  }, read: Read, run: Run, mode: "fast-forward" | "merge",
): Promise<{ commit: string; mode: "fast-forward" | "merge" }> {
  const commit = await read(["rev-parse", "HEAD"]);
  if (!commit) throw new Error("integration postcondition could not be inspected");
  const tree = await read(["rev-parse", `${commit}^{tree}`]);
  if (!tree) throw new Error("integration tree could not be inspected");
  writeIntegrationProof(runDir, {
    base, baseTip: options.baseTip ?? base, work, workTip: options.workTip ?? work,
    proposal: options.proposal, commit, tree,
  });
  await publishPinned(base, commit, options.baseTip, run);
  return { commit, mode };
}

export interface ResolvedFileImage { dev: number; ino: number; size: number; mtimeMs: number; ctimeMs: number; hash: string }
export function imageOfResolvedFile(fd: number): ResolvedFileImage {
  const stat = fstatSync(fd);
  if (!stat.isFile() || stat.size > 256 * 1024) throw new Error("resolved file is not a bounded regular file");
  const bytes = readFileSync(fd);
  return { dev: stat.dev, ino: stat.ino, size: bytes.length, mtimeMs: stat.mtimeMs,
    ctimeMs: stat.ctimeMs, hash: sha256(bytes) };
}

export function captureResolvedFile(
  path: string, validate?: (bytes: Buffer) => boolean,
): ResolvedFileImage | null {
  let fd = -1;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(fd), bytes = readFileSync(fd);
    if (validate && !validate(bytes)) throw new Error("resolved file validation failed");
    if (!stat.isFile() || bytes.length > 256 * 1024)
      throw new Error("resolved file is not a bounded regular file");
    return { dev: stat.dev, ino: stat.ino, size: bytes.length, mtimeMs: stat.mtimeMs,
      ctimeMs: stat.ctimeMs, hash: sha256(bytes) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  } finally { if (fd >= 0) closeSync(fd); }
}
export function matchesResolvedFile(path: string, expected: ResolvedFileImage | null): boolean {
  try {
    const now = captureResolvedFile(path);
    if (!expected) return now === null;
    if (!now) return false;
    return Object.keys(expected).every((key) => now[key as keyof ResolvedFileImage] === expected[key as keyof ResolvedFileImage]);
  } catch { return false; }
}
const sameImage = (a: ResolvedFileImage, b: ResolvedFileImage) =>
  a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs &&
  a.ctimeMs === b.ctimeMs && a.hash === b.hash;
const normalizedConflict = (text: string) =>
  text.replace(/^(<<<<<<<).*$/gm, "<<<<<<<").replace(/^(\\|\\|\\|\\|\\|\\|\\|).*$/gm, "|||||||")
    .replace(/^(>>>>>>>).*$/gm, ">>>>>>>");

async function expectedMergeText(git: ResolvedGit, path: string): Promise<string> {
  const stage = async (number: number) => {
    const result = await git.run(["show", `:${number}:${path}`]);
    return (result.exit ?? result.code) === 0 ? result.stdout : "";
  };
  const [base, ours, theirs] = await Promise.all([stage(1), stage(2), stage(3)]);
  const dir = mkdtempSync(join(tmpdir(), "tenet-merge-expected-"));
  try {
    const files = [join(dir, "ours"), join(dir, "base"), join(dir, "theirs")];
    [ours, base, theirs].forEach((text, index) => writeFileSync(files[index]!, text));
    const style = await git.tryOut(["config", "--get", "merge.conflictStyle"]);
    const result = await git.run([
      "merge-file", "-p", ...(style === "diff3" ? ["--diff3"] : style === "zdiff3" ? ["--zdiff3"] : []),
      "-L", "HEAD", "-L", "BASE", "-L", "MERGE_HEAD", files[0]!, files[1]!, files[2]!,
    ]);
    if ((result.exit ?? result.code) !== 0 && (result.exit ?? result.code) !== 1)
      throw new Error(result.stderr || `git merge-file failed for ${path}`);
    return normalizedConflict(result.stdout);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

interface ResolvedGit {
  root: string;
  ok(args: string[]): Promise<string>;
  run(args: string[]): Promise<GitResult>;
  tryOut(args: string[]): Promise<string | null>;
}

async function placeResolved(
  git: ResolvedGit, run: (args: string[]) => Promise<RunResult>, path: string, text: string | null,
  image: ResolvedFileImage | null,
): Promise<string | null> {
  const abs = join(git.root, path), lit = `:(literal)${path}`;
  let stat;
  try { stat = lstatSync(abs); } catch { stat = undefined; }
  if (stat && !stat.isFile()) return `${path} is not a regular file`;
  if (!matchesResolvedFile(abs, image))
    return `${path} changed after Git produced the conflict; nothing was overwritten`;
  if (text === null) {
    const gone = !(stat || image) || !failed(await run(["rm", "-q", "--force", "--", lit]));
    return gone ? null : `${path} could not be removed`;
  }
  mkdirSync(dirname(abs), { recursive: true });
  const flags = image
    ? constants.O_RDWR | constants.O_NOFOLLOW
    : constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW;
  let fd = -1;
  try {
    fd = openSync(abs, flags, stat ? stat.mode & 0o777 : 0o644);
    if (image && !sameImage(imageOfResolvedFile(fd), image))
      return `${path} changed between validation and replacement; nothing was overwritten`;
    ftruncateSync(fd, 0);
    const bytes = Buffer.from(text);
    writeSync(fd, bytes, 0, bytes.length, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      return `${path} appeared after Git produced its merged result; nothing was overwritten`;
    throw error;
  } finally { if (fd >= 0) closeSync(fd); }
  if (failed(await run(["add", "--", lit]))) return `${path} could not be staged`;
  const staged = await git.tryOut(["rev-parse", `:${path}`]);
  const wrote = await git.tryOut(["hash-object", "--no-filters", "--", path]);
  return !staged || staged !== wrote
    ? `Git changed ${path} while staging it (line endings or a filter); nothing was committed`
    : null;
}

export async function commitResolved(
  git: ResolvedGit, run: (args: string[]) => Promise<RunResult>, resolved: Resolved, message: string,
): Promise<string | null> {
  const left = (await git.ok(["diff", "--name-only", "--diff-filter=U", "-z"])).split("\0").filter(Boolean).sort();
  const want = [...resolved.conflicted].sort();
  const abort = async (why: string) => { await run(["merge", "--abort"]); return why; };
  if (left.join("\0") !== want.join("\0"))
    return abort(`the merge conflicted on ${left.join(", ") || "nothing"}, not on the confirmed ${want.join(", ") || "nothing"}`);
  const images = new Map<string, ResolvedFileImage | null>();
  for (const path of Object.keys(resolved.files)) {
    const absolute = join(git.root, path);
    const expected = want.includes(path) ? await expectedMergeText(git, path) :
      (await git.run(["cat-file", "blob", `:${path}`]));
    try {
      images.set(path, captureResolvedFile(
        absolute,
        (bytes) => typeof expected === "string"
          ? normalizedConflict(bytes.toString("utf8")) === expected
          : (expected.exit ?? expected.code) === 0 && bytes.equals(Buffer.from(expected.stdout, "utf8")),
      ));
    } catch {
      return abort(`${path} does not match Git's expected merged result; nothing was overwritten`);
    }
  }
  for (const [path, text] of Object.entries(resolved.files)) {
    const why = await placeResolved(git, run, path, text, images.get(path)!);
    if (why) return abort(why);
  }
  const commit = await run(["commit", "-q", "-m", message]);
  return failed(commit) ? `${commit.stdout}${commit.stderr}` || "the resolved merge did not commit" : null;
}
