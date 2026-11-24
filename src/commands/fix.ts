import type { CommandSpec } from "../core/commands.js";
import { message } from "../core/messages.js";
import { fail } from "../core/output.js";
import { fix } from "../specs/fix.js";

export const fixCommand: CommandSpec = {
  name: "fix",
  description: "Repair mechanical specification problems",
  usage: "tenet fix [--dry-run]",
  options: [{ flags: "--dry-run" }],
  async run(context) {
    if (context.args.length > 0) {
      const words = message("TN-USAGE-FIX", {
        command: "fix",
        detail: `unexpected positional arguments: ${context.args.join(", ")}`,
      });
      throw fail("TN-USAGE-FIX", words.message, words.fix);
    }
    return {
      result: await fix({
        cwd: context.cwd,
        dryRun: context.options["--dry-run"] === true,
      }),
    };
  },
};
