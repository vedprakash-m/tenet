import { commandHelp } from "../core/cli-help.js";
import { createInterface } from "node:readline";
import type { CommandSpec } from "../core/commands.js";
import { message } from "../core/messages.js";
import { errorFinding, fail, type Finding } from "../core/output.js";
import { previewRemoval, remove as runRemove } from "../install/remove.js";

type RemoveDependencies = { remove?: typeof runRemove; preview?: typeof previewRemoval };

function noTty(): Finding {
  const words = message("TN-REMOVE-NO-TTY");
  return fail("TN-REMOVE-NO-TTY", words.message, words.fix);
}

const removalReasons = {
  file: "delete (Tenet created it)",
  block: "remove the Tenet block",
  key: "remove the Tenet key",
};

const keepReasons = {
  "owner-answers": "Owner interview answers",
  "edited-by-you": "edited by you",
  "spec-or-records": "specifications or records",
};

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
  const preview = dependencies.preview ?? previewRemoval;
  return {
    ...commandHelp.remove,
    async run(context) {
      if (context.args.length > 0) {
        const words = message("TN-USAGE-REMOVE", {
          command: "remove",
          detail: `unexpected positional arguments: ${context.args.join(", ")}`,
        });
        return { findings: [fail("TN-USAGE-REMOVE", words.message, words.fix)] };
      }
      const yes = context.options["--yes"] === true;
      if (!yes && !("isTTY" in context.stdin && context.stdin.isTTY === true)) {
        return { findings: [noTty()] };
      }
      try {
        const plan = await preview({ cwd: context.cwd });
        const rows = [
          "Will delete:",
          ...(plan.removed.length ? plan.removed.map(({ path, kind }) => "- " + path + " — " + removalReasons[kind]) : ["- none"]),
          "Will keep:",
          ...(plan.kept.length ? plan.kept.map(({ path, reason }) => "- " + path + " — " + keepReasons[reason]) : ["- none"]),
        ];
        context.stdout.write(rows.join("\n") + "\n");
        if (!yes) {
          const input = createInterface({ input: context.stdin, crlfDelay: Infinity, terminal: false });
          try {
            context.stdout.write("Continue? [y/N] ");
            const answer = await input[Symbol.asyncIterator]().next();
            if (answer.done) return { findings: [noTty()] };
            if (!["y", "yes"].includes(answer.value.trim().toLowerCase())) {
              context.stdout.write("Cancelled. No files were changed.\n");
              return { result: null, findings: [] };
            }
          } finally {
            input.close();
          }
        }
        const value = await remove({ cwd: context.cwd });
        if (!context.json) {
          context.stdout.write(`Removed ${value.removed.length} Tenet-owned item(s); kept ${value.kept.length}.\n`);
          for (const item of value.removed) {
            context.stdout.write(`Removed: ${item.path} (${item.kind})\n`);
          }
          for (const item of value.kept) {
            const reason = item.reason === "owner-answers"
              ? "Owner interview answers"
              : item.reason;
            context.stdout.write(`Kept: ${item.path} — ${reason}\n`);
          }
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
