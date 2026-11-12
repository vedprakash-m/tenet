// A sealed copy of a commit's files for the starting-tree run (EVD-04, TS §9.8). Blobs are read from the object store as
// stored: no checkout, no index, no filter, no hook, nothing written to the repository. Only the new directory is written.
import { execFile } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { withoutGitLocalVars } from "./git-env.ts";
import { GitCli } from "./git-cli.ts";
import type { Git, Runner, Sealed, SealOverlay } from "../ports/types.ts";

const MAX_FILES = 50_000;
const MAX_BYTES = 500 * 1024 * 1024;
const FLAGS = ["--no-pager", "--no-replace-objects", "-c", "core.fsmonitor=false"];

function git(root: string, args: string[], input?: string): Promise<{ code: number; out: Buffer }> {
  const env = { ...withoutGitLocalVars(process.env), GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" };
  return new Promise((done) => {
    const c = execFile("git", [...FLAGS, ...args], { cwd: root, env, encoding: "buffer", maxBuffer: MAX_BYTES + 64 * 1024 * 1024 },
      (err, stdout) => done({ code: err ? 1 : 0, out: stdout }));
    c.stdin?.end(input ?? "");
  });
}

interface Row { mode: string; blob: string; size: number; path: string }
const unsafe = (p: string) => p.startsWith("/") || p.split("/").some((x) => x === ".." || x === "." || x === "" || x === ".git");

/** `ls-tree -r -z --long`: "mode type blob size\tpath". Submodules and symbolic links are refused, not followed. */
function rowsOf(out: string): Row[] | string {
  const rows: Row[] = [];
  for (const rec of out.split("\0").filter(Boolean)) {
    const t = rec.indexOf("\t"), [mode, , blob, size] = rec.slice(0, t).split(/\s+/);
    const path = rec.slice(t + 1);
    if (mode === "160000") return "submodule";
    if (mode === "120000") return "symlink";
    if (unsafe(path)) return "materialize";
    rows.push({ mode: mode!, blob: blob!, size: Number(size), path });
  }
  return rows;
}

/** Writes `treeish` minus what `keep` rejects, then the overlay (working files copied, deletions applied), into a new `dest`. */
export async function materialize(
  root: string, treeish: string, dest: string, keep: (p: string) => boolean, overlay: SealOverlay,
): Promise<Sealed> {
  const listed = await git(root, ["ls-tree", "-r", "-z", "--long", "--full-tree", treeish]);
  if (listed.code) return { problem: "no-start" };
  const rows = rowsOf(listed.out.toString("utf8"));
  if (typeof rows === "string") return { problem: rows };
  const kept = rows.filter((r) => keep(r.path));
  if (kept.length > MAX_FILES || kept.reduce((n, r) => n + r.size, 0) > MAX_BYTES) return { problem: "too-large" };
  if ([...overlay.remove, ...overlay.copy.map((o) => o.path)].some(unsafe)) return { problem: "materialize" };
  const dispose = () => rmSync(dest, { recursive: true, force: true });
  try {
    mkdirSync(dest, { mode: 0o700 });
    const blobs = await git(root, ["cat-file", "--batch"], kept.map((r) => r.blob).join("\n") + "\n");
    if (blobs.code) throw new Error("cat-file failed");
    let at = 0;
    for (const r of kept) {
      const nl = blobs.out.indexOf(10, at), header = blobs.out.subarray(at, nl).toString().split(" ");
      if (header[0] !== r.blob || Number(header[2]) !== r.size) throw new Error("unexpected object");
      const file = join(dest, r.path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, blobs.out.subarray(nl + 1, nl + 1 + r.size), { mode: r.mode === "100755" ? 0o755 : 0o644 });
      at = nl + 1 + r.size + 1;
    }
    for (const p of overlay.remove) rmSync(join(dest, p), { force: true });
    for (const o of overlay.copy) {
      mkdirSync(dirname(join(dest, o.path)), { recursive: true });
      copyFileSync(join(root, o.path), join(dest, o.path));
      chmodSync(join(dest, o.path), o.mode === "100755" ? 0o755 : 0o644);
    }
    return { root: realpathSync(dest), dispose };
  } catch {
    dispose();
    return { problem: "materialize" };
  }
}

/** The Git port with the sealed-copy writer; kept apart from `GitCli` so that adapter stays within its size budget. */
export class SealingGit extends GitCli implements Git {
  private readonly top: string;
  constructor(root: string, runner?: Runner) {
    super(root, runner);
    this.top = root;
  }
  materialize(treeish: string, dest: string, keep: (p: string) => boolean, overlay: SealOverlay): Promise<Sealed> {
    return materialize(this.top, treeish, dest, keep, overlay);
  }
}
