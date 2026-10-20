// Production wiring: real adapters behind the ports. Tests build their own Ports from the same pieces.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { GitCli } from "./adapters/git-cli.ts";
import { createStack } from "./adapters/node-ts.ts";
import { ProcessRunner } from "./adapters/runner.ts";
import { FsProject } from "./adapters/project-fs.ts";
import { FsRecipes } from "./adapters/recipes-fs.ts";
import { FsStore } from "./adapters/store-fs.ts";
import { systemClock, systemRandom } from "./adapters/system.ts";
import type { Ports } from "./ports/types.ts";
import { KERNEL_VERSION } from "./version.ts";

/** The workspace is the Git top level when there is one, so every subfolder shares one `.tenet/`. */
function workspaceRoot(cwd: string): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || cwd;
  } catch {
    return cwd;
  }
}

/** The plugin folder: beside the bundled kernel when shipped, or `plugin/` when running from source. */
function pluginRoot(): string {
  const here = import.meta.dirname;
  return [join(here, ".."), join(here, "../../../plugin")].find((d) => existsSync(join(d, "skills"))) ?? join(here, "..");
}

export function createPorts(cwd: string, env: Record<string, string | undefined> = process.env): Ports {
  const root = workspaceRoot(cwd);
  const runner = new ProcessRunner(systemClock, env);
  return {
    root, version: KERNEL_VERSION, clock: systemClock, rand: systemRandom,
    recipes: new FsRecipes(pluginRoot()), project: new FsProject(root), store: new FsStore(root, systemClock, systemRandom), git: new GitCli(root, runner), runner, stack: createStack(),
  };
}
