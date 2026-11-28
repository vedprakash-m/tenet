import { commandHelp } from "../core/cli-help.js";
import type { CommandSpec } from "../core/commands.js";
import { check } from "../specs/check.js";

function list(value: string | boolean | string[] | undefined): string[] {
  if (typeof value !== "string") return [];
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

export const checkCommand: CommandSpec = {
  ...commandHelp.check,
  async run(context) {
    const rawPack = context.options["--pack"];
    const paths = [...new Set([...context.args, ...list(context.options["--paths"])])];
    const options = {
      cwd: context.cwd,
      ...(paths.length > 0 ? { paths } : {}),
      ...(rawPack === true
        ? { pack: true }
        : typeof rawPack === "string"
          ? { pack: rawPack }
          : {}),
      ci: context.options["--ci"] === true,
      ...(typeof context.options["--base"] === "string" ? { base: context.options["--base"] } : {}),
    };
    const value = await check(options);
    if (context.json) return { result: value, findings: value.findings };
    const summary = `Check: ${value.summary.errors} errors · ${value.summary.warnings} warnings · ${value.summary.advises} advises`;
    return { value: summary, findings: value.findings };
  },
};
