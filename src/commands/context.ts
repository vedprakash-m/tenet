import { registerCommand } from "../cli.js";
import { contextSummary, contextWithFindings } from "../context/index.js";
import type { CommandSpec } from "../cli.js";

function list(value: string | boolean | string[] | undefined): string[] | undefined {
  if (typeof value !== "string") return undefined;
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

const command: CommandSpec = {
  name: "context",
  description: "Select blessed specification context",
  usage: "tenet context [--paths <paths>] [--ids <ids>] [--query <text>] [--include-drafts] [--budget-tokens <n>]",
  options: [
    { flags: "--paths <paths>" },
    { flags: "--ids <ids>" },
    { flags: "--query <text>" },
    { flags: "--include-drafts" },
    { flags: "--budget-tokens <n>" },
  ],
  async run(commandContext) {
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
    if (!commandContext.json) {
      commandContext.stdout.write(
        contextSummary(details.result, details.findings, details.validBlessedSections),
      );
      return { value: null, findings: details.findings };
    }
    return { result: details.result, findings: details.findings };
  },
};

registerCommand(command);
export default command;
