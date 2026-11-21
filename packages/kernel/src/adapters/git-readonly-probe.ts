// Read-only open fast path for an ordinary repository; linked/shadow layouts fall back to the bounded Git probe.
import { lstatSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { RepoProbe } from "../ports/types.ts";

const bounded = (path: string): string | null => {
  try {
    const stat = lstatSync(path);
    return stat.isFile() && stat.size <= 1024 * 1024 ? readFileSync(path, "utf8") : null;
  } catch { return null; }
};

export function fastReadOnlyProbe(root: string): RepoProbe | null {
  const dotGit = join(root, ".git");
  const pointer = bounded(dotGit)?.match(/^gitdir:\s*(.+)\s*$/)?.[1];
  const gitDir = pointer ? (isAbsolute(pointer) ? pointer : resolve(root, pointer)) : dotGit;
  const linkedWorktree = gitDir !== dotGit;
  const headText = bounded(join(gitDir, "HEAD"))?.trim();
  if (!headText) return null;
  let head: string | null = null, branch: string | null = null;
  if (headText.startsWith("ref: ")) {
    const ref = headText.slice(5);
    if (!/^refs\/heads\/[^\0\r\n]+$/.test(ref)) return null;
    branch = ref.slice("refs/heads/".length);
    head = bounded(join(gitDir, ref))?.trim() ?? null;
    if (!head) {
      const line = bounded(join(gitDir, "packed-refs"))
        ?.split(/\r?\n/).find((item) => item.endsWith(` ${ref}`));
      head = line ? line.slice(0, line.indexOf(" ")).trim() : null;
    }
  } else if (/^[0-9a-f]{40,64}$/.test(headText)) head = headText;
  else return null;
  if (head && !/^[0-9a-f]{40,64}$/.test(head)) return null;
  const probe: RepoProbe = {
    isRepo: true, shadow: false, version: "not probed for read-only open",
    top: root, head, branch, state: head && !branch ? "readonly" : "ok",
    identity: false, remotes: [], hooks: null, signing: null,
    layout: {
      shallow: bounded(join(gitDir, "shallow")) !== null,
      submodules: (bounded(join(root, ".gitmodules")) ?? "").split(/\r?\n/)
        .flatMap((line) => /^\s*path\s*=\s*(.+?)\s*$/.exec(line)?.[1] ?? []),
      lfs: /filter=lfs/.test(bounded(join(root, ".gitattributes")) ?? ""),
      linkedWorktree,
    },
  };
  if (probe.state === "readonly") probe.why = "HEAD is detached";
  return probe;
}
