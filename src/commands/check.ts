import { registerCommand } from "../core/commands.js";
import { check } from "../specs/check.js";

registerCommand({
  name: "check",
  description: "Check specification structure and integrity",
  usage: "tenet check [paths...] [--pack [path]] [--ci --base <ref>]",
  options: [
    { flags: "--pack [path]" },
    { flags: "--ci" },
    { flags: "--base <ref>" },
  ],
  async run(context) {
    const rawPack = context.options["--pack"];
    const options = {
      cwd: context.cwd,
      ...(context.args.length > 0 ? { paths: context.args } : {}),
      ...(rawPack === true
        ? { pack: true }
        : typeof rawPack === "string"
          ? { pack: rawPack }
          : {}),
      ci: context.options["--ci"] === true,
      ...(typeof context.options["--base"] === "string" ? { base: context.options["--base"] } : {}),
    };
    const value = await check(options);
    return { result: value, findings: value.findings };
  },
});
