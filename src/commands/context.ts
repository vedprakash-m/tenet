import { commandHelp } from "../core/cli-help.js";

import { message } from "../core/messages.js";
import { fail } from "../core/output.js";
import { contextSummary, contextWithFindings } from "../context/index.js";

type CommandContext = {
  args: string[];
  cwd: string;
  options: Record<string, string | boolean | string[]>;
  json: boolean;
  quiet: boolean;
  stdout: { write(value: string | Uint8Array): unknown };
};

function list(value: string | boolean | string[] | undefined): string[] | undefined {
  if (typeof value === "boolean" || value === undefined) return undefined;
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((item) => item.split(",")).map((part) => part.trim()).filter(Boolean);
}

const command = {
  ...commandHelp.context,
  async run(commandContext: CommandContext) {
    if (commandContext.args.length > 0) {
      const words = message("TN-USAGE-CONTEXT", {
        command: "context",
        detail: `unexpected positional arguments: ${commandContext.args.join(", ")}`,
      });
      throw fail("TN-USAGE-CONTEXT", words.message, words.fix);
    }
    const budget = commandContext.options["--budget-tokens"];
    const paths = list(commandContext.options["--paths"]);
    const ids = list(commandContext.options["--ids"]);
    const query = commandContext.options["--query"];
    const details = await contextWithFindings({
      cwd: commandContext.cwd,
      ...(paths ? { paths } : {}),
      ...(ids ? { ids } : {}),
      ...(typeof query === "string" ? { query } : {}),
      ...(commandContext.options["--include-drafts"] === true ? { include_drafts: true } : {}),
      ...(typeof budget === "string" ? { budget_tokens: Number(budget) } : {}),
    });
    if (!commandContext.json && !commandContext.quiet) {
      commandContext.stdout.write(
        contextSummary(details.result, details.findings, details.validBlessedSections),
      );
      return { value: null, findings: details.findings };
    }
    return { result: details.result, findings: details.findings };
  },
};

export const contextCommand = command;
export default command;
