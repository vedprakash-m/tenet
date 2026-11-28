import type { CommandSpec } from "./commands.js";

export type CommandHelp = Pick<CommandSpec, "name" | "description" | "usage" | "options" | "checkEnvironment">;

export const commandHelp = {
  bless: {
    name: "bless",
    description: "Read and bless specification sections in your terminal",
    usage: "tenet bless [doc] [section]",
    options: ["--doc <path>", "--section <slug>"],
  },
  board: {
    name: "board",
    description: "Show specification state and spec debt",
    usage: "tenet board [--all]",
    options: [{ flags: "--all" }],
  },
  check: {
    name: "check",
    description: "Check specification structure and integrity",
    usage: "tenet check [paths...] [--paths <paths>] [--pack [path]] [--ci --base <ref>]",
    options: [
      { flags: "--paths <paths>" },
      { flags: "--pack [path]" },
      { flags: "--ci" },
      { flags: "--base <ref>" },
    ],
  },
  context: {
    name: "context",
    description: "Select specification context",
    usage: "tenet context [--paths <paths...>] [--ids <ids>] [--query <text>] [--include-drafts] [--budget-tokens <n>]",
    options: [
      { flags: "--paths <paths...>", description: "Paths, comma-separated or repeat --paths" },
      { flags: "--ids <ids>" },
      { flags: "--query <text>" },
      { flags: "--include-drafts" },
      { flags: "--budget-tokens <n>" },
    ],
  },
  doctor: {
    name: "doctor",
    description: "Check the Tenet installation and required tools",
    usage: "tenet doctor",
    checkEnvironment: false,
  },
  fix: {
    name: "fix",
    description: "Repair mechanical specification problems",
    usage: "tenet fix [--dry-run] [--diff]",
    options: [{ flags: "--dry-run", description: "Preview repairs" }, { flags: "--diff", description: "Preview repairs as a unified diff" }],
  },
  init: {
    name: "init",
    description: "Install Tenet in the current repository",
    usage: "tenet init [--yes] [--host <name>] [--local-hosts] [--vendor] [--force]",
    options: ["--yes", "--host <name>", "--local-hosts", "--vendor", "--force"],
  },
  onboard: {
    name: "onboard",
    description: "Inspect your project and prepare a specification drafting assignment",
    options: ["--inventory-only", "--refresh", "--layout <layout>", "--card", "--pr <number>"],
  },
  remove: {
    name: "remove",
    description: "Remove Tenet-owned installation files",
    usage: "tenet remove [--yes]",
    options: ["--yes"],
  },
  split: {
    name: "split",
    description: "Move a specification section into a part",
    usage: "tenet split <document> <section>",
  },
  upgrade: {
    name: "upgrade",
    description: "Upgrade Tenet-owned files to the installed version",
    usage: "tenet upgrade",
  },
  verify: {
    name: "verify",
    description: "Run checks, collect a bundle, or record CI proof",
    options: ["--run-checks", "--bundle", "--record", "--local"],
  },
  mcp: { name: "mcp", description: "Serve the Tenet MCP tools over stdio", usage: "tenet mcp" },
} satisfies Record<string, CommandHelp>;

export function usage(extensions: Iterable<CommandHelp>): string {
  const commands = [...new Set([...Object.values(commandHelp), ...extensions])]
    .map((spec) => `  ${spec.name.padEnd(18)} ${spec.description ?? ""}`.trimEnd())
    .sort();
  return [
    "Tenet",
    "",
    "Usage: tenet [global options] <command> [options]",
    "",
    "Global options:",
    "  --cwd <path>    Run in another repository",
    "  --json          Write one JSON envelope to stdout",
    "  --quiet         Suppress successful human output",
    "  --verbose       Show additional human output",
    "  --offline       Work without the network: skip registry lookups, or refuse commands that need it",
    "  --version       Print the installed version",
    "  --help, -h      Print this help",
    "",
    ...(commands.length > 0 ? ["Commands:", ...commands, ""] : []),
  ].join("\n");
}

export function commandUsage(spec: CommandHelp): string {
  const options = (spec.options ?? []).map((option) => {
    const flags = typeof option === "string" ? option : option.flags;
    const description = typeof option === "string" ? "" : option.description;
    return `  ${flags.padEnd(20)} ${description ?? ""}`.trimEnd();
  });
  return [
    `Usage: ${spec.usage ?? `tenet ${spec.name}`}`,
    "",
    spec.description ?? "",
    ...(options.length > 0 ? ["", "Options:", ...options] : []),
    "",
    "Global options:",
    "  --cwd <path>    Run in another repository",
    "  --json          Write one JSON envelope to stdout",
    "  --quiet         Suppress successful human output",
    "  --verbose       Show additional human output",
    "  --offline       Work without the network: skip registry lookups, or refuse commands that need it",
  ].join("\n");
}
