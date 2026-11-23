import { registerCommand } from "../cli.js";
import { fail } from "../core/output.js";
import { fix } from "../specs/fix.js";

registerCommand({
  name: "fix",
  description: "Repair mechanical specification problems",
  usage: "tenet fix [--dry-run]",
  options: [{ flags: "--dry-run" }],
  async run(context) {
    if (context.args.length > 0) {
      throw fail("TN-USAGE-FIX", "Invalid usage for tenet fix.", "Run tenet fix --help.");
    }
    return {
      result: await fix({
        cwd: context.cwd,
        dryRun: context.options["--dry-run"] === true,
      }),
    };
  },
});
