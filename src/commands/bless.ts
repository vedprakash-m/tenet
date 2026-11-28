import { commandHelp } from "../core/cli-help.js";
import type { CommandSpec } from "../core/commands.js";
import { message } from "../core/messages.js";
import { fail } from "../core/output.js";
import { blessText, runBless } from "../onboard/bless.js";

export const blessCommand: CommandSpec = {
  ...commandHelp.bless,
  async run(context) {
    const docFlag = context.options["--doc"];
    const sectionFlag = context.options["--section"];
    if (context.args.length > 2 || (docFlag && context.args[0]) || (sectionFlag && context.args[1])) {
      const code = "TN-USAGE-BLESS";
      const words = message(code, { command: "bless", detail: blessText.invalidOptions });
      return { findings: [fail(code, words.message, words.fix)] };
    }
    const doc = typeof docFlag === "string" ? docFlag : context.args[0];
    const section = typeof sectionFlag === "string" ? sectionFlag : context.args[1];
    const { result, findings } = await runBless({
      cwd: context.cwd,
      ...(doc ? { doc } : {}),
      ...(section ? { section } : {}),
    }, { stdin: context.stdin, stdout: context.stdout, now: context.now });
    return { result: context.json ? result : null, findings };
  },
};
