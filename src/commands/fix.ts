import { commandHelp } from "../core/cli-help.js";
import type { CommandSpec } from "../core/commands.js";
import { message } from "../core/messages.js";
import { fail } from "../core/output.js";
import { fix, type FixChange } from "../specs/fix.js";

export const fixCommand: CommandSpec = {
  ...commandHelp.fix,
  async run(context) {
    if (context.args.length > 0) {
      const words = message("TN-USAGE-FIX", {
        command: "fix",
        detail: `unexpected positional arguments: ${context.args.join(", ")}`,
      });
      throw fail("TN-USAGE-FIX", words.message, words.fix);
    }
    const diff = context.options["--diff"] === true;
    const dryRun = diff || context.options["--dry-run"] === true;
    if (context.json) return { result: await fix({ cwd: context.cwd, dryRun }) };
    const changes: string[] = [];
    await fix({
      cwd: context.cwd, dryRun,
      onChange: (change) => changes.push(diff ? unifiedDiff(change) : change.path + ": " + change.summary),
    });
    if (diff) return { value: changes.length ? changes.join("").slice(0, -1) : null };
    return { value: changes.length
      ? changes.join("\n")
      : "No specification changes." };
  },
};

function range(offset: number, count: number): string {
  const start = offset + (count === 0 ? 0 : 1);
  return count === 1 ? String(start) : start + "," + count;
}

function unifiedDiff(change: FixChange): string {
  if ("renamedFrom" in change) {
    return "diff --git a/" + change.renamedFrom + " b/" + change.path + "\n" +
      "similarity index 100%\nrename from " + change.renamedFrom + "\nrename to " + change.path + "\n";
  }
  const before = change.before.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const after = change.after.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  let first = 0;
  while (first < before.length && first < after.length && before[first] === after[first]) first += 1;
  let lastBefore = before.length;
  let lastAfter = after.length;
  while (lastBefore > first && lastAfter > first && before[lastBefore - 1] === after[lastAfter - 1]) {
    lastBefore -= 1;
    lastAfter -= 1;
  }
  const start = Math.max(0, first - 3);
  const contextAfter = Math.min(3, before.length - lastBefore);
  const line = (mark: string) => (text: string) => mark + text + (text.endsWith("\n") ? "" : "\n\\ No newline at end of file\n");
  return [
    "--- a/" + change.path + "\n",
    "+++ b/" + change.path + "\n",
    "@@ -" + range(start, lastBefore + contextAfter - start) + " +" + range(start, lastAfter + contextAfter - start) + " @@\n",
    ...before.slice(start, first).map(line(" ")),
    ...before.slice(first, lastBefore).map(line("-")),
    ...after.slice(first, lastAfter).map(line("+")),
    ...before.slice(lastBefore, lastBefore + contextAfter).map(line(" ")),
  ].join("");
}
