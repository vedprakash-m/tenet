// Repository layouts that change what Tenet can promise (GIT-13, TS §10.8), read without running any repository program.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { RepoProbe } from "../ports/types.ts";

type TryOut = (args: string[]) => Promise<string | null>;

export async function repoLayout(tryOut: TryOut, top: string, gitDir: string): Promise<RepoProbe["layout"]> {
  const shallow = (await tryOut(["rev-parse", "--is-shallow-repository"])) === "true";
  const listed = existsSync(join(top, ".gitmodules"))
    ? (await tryOut(["config", "-f", ".gitmodules", "--get-regexp", "^submodule\\..*\\.path$"])) ?? ""
    : "";
  const submodules = listed.split("\n").map((l) => l.split(" ")[1]).filter((p): p is string => !!p);
  let lfs = false;
  try { lfs = /filter=lfs/.test(readFileSync(join(top, ".gitattributes"), "utf8")); } catch { /* no attributes file */ }
  const common = await tryOut(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  return { shallow, submodules, lfs, linkedWorktree: !!common && common !== gitDir };
}
