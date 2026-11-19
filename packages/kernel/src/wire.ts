// Production wiring: real adapters behind the ports. Tests build their own Ports from the same pieces.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SealingGit } from "./adapters/git-seal.ts";
import { createStack } from "./adapters/node-ts.ts";
import { ProcessRunner } from "./adapters/runner.ts";
import { FsProject } from "./adapters/project-fs.ts";
import { PluginHost } from "./adapters/host-plugin.ts";
import { FsRecipes } from "./adapters/recipes-fs.ts";
import { FsStore } from "./adapters/store-fs.ts";
import { systemClock, systemRandom } from "./adapters/system.ts";
import type { Ports } from "./ports/types.ts";
import { KERNEL_VERSION } from "./version.ts";
import { sha256 } from "./core/ids.ts";
import { createMigrationGuard } from "./adapters/marker-rollback.ts";

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

export { dropGitLocalVars } from "./adapters/git-env.ts";
export function createPorts(cwd: string, env: Record<string, string | undefined> = process.env): Ports {
  const root = workspaceRoot(cwd);
  const runner = new ProcessRunner(systemClock, env);
  const recipes = new FsRecipes(pluginRoot());
  const rollbackBridgeDigest = env.TENET_ROLLBACK_BRIDGE_DIGEST;
  const rollbackBridgeInvalid = !!rollbackBridgeDigest && (
    !/^[a-f0-9]{64}$/.test(rollbackBridgeDigest) ||
    sha256(readFileSync(fileURLToPath(import.meta.url))) !== rollbackBridgeDigest
  );
  return {
    platform: process.platform,
    root, version: KERNEL_VERSION, clock: systemClock, rand: systemRandom,
    recipes, host: new PluginHost(recipes, env.TENET_HOST_VERSION), project: new FsProject(root),
    store: new FsStore(root, systemClock, systemRandom, {
      migrationGuard: createMigrationGuard(
        root, rollbackBridgeDigest, env.TENET_ROLLBACK_BRIDGE_REQUEST, rollbackBridgeInvalid,
      ),
    }), git: new SealingGit(root, runner),
    runner, stack: createStack(),
  };
}
