import { registerCommand } from "../core/commands.js";
import { fail } from "../core/output.js";
import { split } from "../specs/split.js";

registerCommand({
  name: "split",
  description: "Move a specification section into a part",
  usage: "tenet split <document> <section>",
  async run(context) {
    const [document, section] = context.args;
    if (!document || !section || context.args.length !== 2) {
      throw fail(
        "TN-USAGE-SPLIT",
        "Invalid usage for tenet split.",
        "Run tenet split --help for valid arguments and flags.",
      );
    }
    return { result: await split(document, section, context.cwd) };
  },
});
