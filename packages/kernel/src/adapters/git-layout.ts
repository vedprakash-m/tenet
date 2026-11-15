// Repository layouts that change what Tenet can promise (GIT-13, TS §10.8), read without running any repository program.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "../core/ids.ts";
import type { RepoProbe } from "../ports/types.ts";

type TryOut = (args: string[]) => Promise<string | null>;

/** Where a repository's files are, as `git rev-parse` reports them. */
export interface Located { top: string; gitDir: string; common: string | null; shallow: boolean }

/** One rev-parse for every location the probe needs (NFR-01); null outside a repository. An output that is not one line
 *  per value (an older Git, or a path holding a newline) is read again one value per process, as before. */
export async function locate(tryOut: TryOut): Promise<Located | null> {
  const lines = (await tryOut(["rev-parse", "--show-toplevel", "--absolute-git-dir", "--path-format=absolute", "--git-common-dir",
    "--is-shallow-repository"]))?.split("\n");
  if (lines?.length === 4) return { top: lines[0]!, gitDir: lines[1]!, common: lines[2]!, shallow: lines[3] === "true" };
  const top = await tryOut(["rev-parse", "--show-toplevel"]);
  if (!top) return null;
  const [gitDir, common, shallow] = await Promise.all([tryOut(["rev-parse", "--absolute-git-dir"]),
    tryOut(["rev-parse", "--path-format=absolute", "--git-common-dir"]), tryOut(["rev-parse", "--is-shallow-repository"])]);
  return { top, gitDir: gitDir ?? join(top, ".git"), common, shallow: shallow === "true" };
}

export async function repoLayout(tryOut: TryOut, { top, gitDir, common, shallow }: Located): Promise<RepoProbe["layout"]> {
  const listed = existsSync(join(top, ".gitmodules"))
    ? (await tryOut(["config", "-f", ".gitmodules", "--get-regexp", "^submodule\\..*\\.path$"])) ?? ""
    : "";
  const submodules = listed.split("\n").map((l) => l.split(" ")[1]).filter((p): p is string => !!p);
  let lfs = false;
  try { lfs = /filter=lfs/.test(readFileSync(join(top, ".gitattributes"), "utf8")); } catch { /* no attributes file */ }
  return { shallow, submodules, lfs, linkedWorktree: !!common && common !== gitDir };
}

/** Hash of the hook files present (names and contents), or null when there are none: consent binds to it. */
export function hookInventory(dirs: string[]): string | null {
  const seen: string[] = [];
  for (const d of dirs) {
    let names: string[] = [];
    try {
      names = readdirSync(d)
        .filter((f) => !f.endsWith(".sample") && !f.startsWith("."))
        .sort();
    } catch {
      continue;
    }
    for (const f of names) {
      try {
        seen.push(`${d.split("/").slice(-2).join("/")}/${f}:${sha256(readFileSync(join(d, f)))}`);
      } catch {
        /* a directory */
      }
    }
  }
  return seen.length ? sha256(seen.join("\n")).slice(0, 16) : null;
}
