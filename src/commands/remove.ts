import type { CommandSpec } from "../core/commands.js";
import { message } from "../core/messages.js";
import { errorFinding, fail, type Finding } from "../core/output.js";
import { remove as runRemove } from "../install/remove.js";

type RemoveDependencies = { remove?: typeof runRemove };

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

export function makeRemoveCommand(dependencies: RemoveDependencies = {}): CommandSpec {
  const remove = dependencies.remove ?? runRemove;
  return {
    name: "remove",
    description: "Remove Tenet-owned installation files",
    usage: "tenet remove",
    async run(context) {
      if (context.args.length > 0) {
        const words = message("TN-USAGE-REMOVE", {
          command: "remove",
          detail: `unexpected positional arguments: ${context.args.join(", ")}`,
        });
        return { findings: [fail("TN-USAGE-REMOVE", words.message, words.fix)] };
      }
      try {
        const value = await remove({ cwd: context.cwd });
        if (!context.json) {
          context.stdout.write(`Removed ${value.removed.length} Tenet-owned item(s); kept ${value.kept.length}.\n`);
          if (value.reminder) context.stdout.write(`${value.reminder}\n`);
        }
        return { result: context.json ? value : null, findings: [] };
      } catch (error) {
        return { findings: [commandFinding(error)] };
      }
    },
  };
}

export const removeCommand = makeRemoveCommand();
