// Repository layouts that change what Tenet can promise (GIT-13, TS §10.8), read without running any repository program.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "../core/ids.ts";
import type { RepoProbe } from "../ports/types.ts";

type TryOut = (args: string[]) => Promise<string | null>;

export async function repoLayout(tryOut: TryOut, top: string, gitDir: string | Promise<string>): Promise<RepoProbe["layout"]> {
  const commonOut = tryOut(["rev-parse", "--path-format=absolute", "--git-common-dir"]); // runs alongside the reads below
  const shallow = (await tryOut(["rev-parse", "--is-shallow-repository"])) === "true";
  const listed = existsSync(join(top, ".gitmodules"))
    ? (await tryOut(["config", "-f", ".gitmodules", "--get-regexp", "^submodule\\..*\\.path$"])) ?? ""
    : "";
  const submodules = listed.split("\n").map((l) => l.split(" ")[1]).filter((p): p is string => !!p);
  let lfs = false;
  try { lfs = /filter=lfs/.test(readFileSync(join(top, ".gitattributes"), "utf8")); } catch { /* no attributes file */ }
  const common = await commonOut;
  return { shallow, submodules, lfs, linkedWorktree: !!common && common !== (await gitDir) };
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
