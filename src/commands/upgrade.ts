import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CommandSpec } from "../core/commands.js";
import { message } from "../core/messages.js";
import { errorFinding, fail, type Finding } from "../core/output.js";
import { upgrade as runUpgrade } from "../install/upgrade.js";
import { localIntegrityWarning } from "../install/integrity.js";

type UpgradeDependencies = { upgrade?: typeof runUpgrade };

function commandFinding(error: unknown): Finding {
  const found = errorFinding(error);
  if (found) return found;
  if (error && typeof error === "object" && "finding" in error) {
    const partial = (error as { finding?: { code?: string; file?: string | null } }).finding;
    if (partial?.code) {
      const itemPath = partial.file ?? ".";
      try {
        const words = message(partial.code, { path: itemPath });
        return { ...fail(partial.code, words.message, words.fix), file: partial.file ?? null };
      } catch {
        if (error instanceof Error) return fail(partial.code, error.message, `Review ${itemPath} and retry.`);
      }
    }
  }
  const detail = error instanceof Error ? error.message : String(error);
  const words = message("TN-INTERNAL", { detail });
  return fail("TN-INTERNAL", words.message, words.fix);
}

export function makeUpgradeCommand(dependencies: UpgradeDependencies = {}): CommandSpec {
  const upgrade = dependencies.upgrade ?? runUpgrade;
  return {
    name: "upgrade",
    description: "Upgrade Tenet-owned files to the installed version",
    usage: "tenet upgrade",
    async run(context) {
      if (context.args.length > 0) {
        const words = message("TN-USAGE-UPGRADE", {
          command: "upgrade",
          detail: `unexpected positional arguments: ${context.args.join(", ")}`,
        });
        return { findings: [fail("TN-USAGE-UPGRADE", words.message, words.fix)] };
      }
      try {
        const value = await upgrade({ cwd: context.cwd, offline: context.offline });
        try {
          const lock = JSON.parse(await readFile(path.join(context.cwd, "tenet.lock"), "utf8")) as {
            package?: unknown;
            version?: unknown;
            "x-integrity-source"?: unknown;
          };
          if (
            lock["x-integrity-source"] === "local" &&
            typeof lock.package === "string" &&
            typeof lock.version === "string"
          ) {
            context.stderr.write(`Warning: ${localIntegrityWarning(lock.package, lock.version)}\n`);
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        if (!context.json) {
          context.stdout.write(`Tenet ${value.from} → ${value.to} · ${value.changed.length} managed path(s).\n`);
        }
        return { result: context.json ? value : null, findings: [] };
      } catch (error) {
        return { findings: [commandFinding(error)] };
      }
    },
  };
}

export const upgradeCommand = makeUpgradeCommand();
