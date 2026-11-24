import type { CommandSpec } from "../core/commands.js";
import { message } from "../core/messages.js";
import { fail } from "../core/output.js";
import { split } from "../specs/split.js";

export const splitCommand: CommandSpec = {
  name: "split",
  description: "Move a specification section into a part",
  usage: "tenet split <document> <section>",
  async run(context) {
    const [document, section] = context.args;
    if (!document || !section || context.args.length !== 2) {
      const words = message("TN-USAGE-SPLIT", {
        command: "split",
        detail: "expected <document> <section>",
      });
      throw fail("TN-USAGE-SPLIT", words.message, words.fix);
    }
    return { result: await split(document, section, context.cwd) };
  },
};
