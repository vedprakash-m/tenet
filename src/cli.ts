#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { git } from "./core/git.js";
import { exitCodeFor, fail, result, version, type Finding } from "./core/output.js";

export type Writable = {
  write(value: string | Uint8Array): unknown;
};

export type CliIo = {
  cwd?: string;
  stdin?: NodeJS.ReadableStream;
  stdout?: Writable;
  stderr?: Writable;
  now?: () => Date;
  nodeVersion?: string;
  gitVersion?: string;
  checkEnvironment?: boolean;
};

export type CommandOption = {
  flags: string;
  description?: string;
};

export type CommandContext = {
  args: string[];
  options: Record<string, string | boolean | string[]>;
  cwd: string;
  stdin: NodeJS.ReadableStream;
  stdout: Writable;
  stderr: Writable;
  now: () => Date;
  json: boolean;
  quiet: boolean;
  verbose: boolean;
  offline: boolean;
};

export type CommandOutcome<T = unknown> = {
  value?: T;
  result?: T;
  findings?: Finding[];
  exitCode?: number;
};

export type CommandSpec = {
  name: string;
  aliases?: string[];
  description?: string;
  usage?: string;
  options?: CommandOption[] | string[];
  network?: boolean;
  run?: (context: CommandContext) => unknown | Promise<unknown>;
  handler?: (context: CommandContext) => unknown | Promise<unknown>;
};

const registry = new Map<string, CommandSpec>();
let loadedCommands = false;

export function registerCommand(spec: CommandSpec): void {
  if (!spec.name || (!spec.run && !spec.handler)) throw new TypeError("command spec needs a name and run handler");
  for (const name of [spec.name, ...(spec.aliases ?? [])]) {
    if (registry.has(name)) throw new Error(`command is already registered: ${name}`);
    registry.set(name, spec);
  }
}

function write(output: Writable, value: string): void {
  output.write(value);
}

function line(output: Writable, value: string): void {
  write(output, `${value}\n`);
}

function defaultIo(io: CliIo = {}): Required<Pick<CliIo, "cwd" | "stdin" | "stdout" | "stderr">> & CliIo {
  return {
    ...io,
    cwd: path.resolve(io.cwd ?? process.cwd()),
    stdin: io.stdin ?? process.stdin,
    stdout: io.stdout ?? process.stdout,
    stderr: io.stderr ?? process.stderr,
  };
}

function semver(value: string): [number, number, number] | undefined {
  const match = /(?:^|\D)(\d+)\.(\d+)(?:\.(\d+))?/.exec(value);
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
}

function atLeast(value: string, minimum: [number, number, number]): boolean {
  const current = semver(value);
  if (!current) return false;
  for (let index = 0; index < current.length; index += 1) {
    const actual = current[index] ?? 0;
    const required = minimum[index] ?? 0;
    if (actual > required) return true;
    if (actual < required) return false;
  }
  return true;
}

async function environmentFindings(io: ReturnType<typeof defaultIo>): Promise<Finding[]> {
  if (io.checkEnvironment === false) return [];
  const findings: Finding[] = [];
  const node = io.nodeVersion ?? process.versions.node;
  if (!atLeast(node, [22, 0, 0])) {
    findings.push(fail("TN-ENV-NODE", `Node ${node} is too old`, "Install Node 22 or newer."));
  }

  let installedGit = io.gitVersion;
  if (!installedGit) {
    try {
      installedGit = (await git(["--version"], { cwd: io.cwd })).trim();
    } catch {
      findings.push(fail("TN-ENV-GIT", "Git 2.40 or newer is not available", "Install Git 2.40 or newer."));
      return findings;
    }
  }
  if (!atLeast(installedGit, [2, 40, 0])) {
    findings.push(fail("TN-ENV-GIT", `Git ${installedGit} is too old`, "Install Git 2.40 or newer."));
  }
  return findings;
}

async function loadCommands(): Promise<void> {
  if (loadedCommands) return;
  const { verifyCommand } = await import("./commands/index.js");
  if (loadedCommands) return;
  registerCommand(verifyCommand);
  loadedCommands = true;
}

function usage(): string {
  const commands = [...new Set(registry.values())]
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
    "  --offline       Refuse commands that use the network",
    "  --version       Print the installed version",
    "  --help, -h      Print this help",
    "",
    ...(commands.length > 0 ? ["Commands:", ...commands, ""] : []),
  ].join("\n");
}

type ParsedOption = {
  value: "none" | "required" | "optional";
};

function optionDeclarations(spec: CommandSpec): Map<string, ParsedOption> {
  const declarations = new Map<string, ParsedOption>();
  for (const option of spec.options ?? []) {
    const flags = typeof option === "string" ? option : option.flags;
    const value = /<[^>]+>/.test(flags) ? "required" : /\[[^\]]+\]/.test(flags) ? "optional" : "none";
    for (const match of flags.matchAll(/--?[A-Za-z0-9][A-Za-z0-9-]*/g)) {
      declarations.set(match[0], { value });
    }
  }
  return declarations;
}

function parseCommandArgs(spec: CommandSpec, argv: string[]): { args: string[]; options: CommandContext["options"] } {
  const declarations = optionDeclarations(spec);
  const args: string[] = [];
  const options: CommandContext["options"] = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (!token.startsWith("-") || token === "-") {
      args.push(token);
      continue;
    }
    const [flag, inline] = token.split("=", 2);
    const declaration = flag ? declarations.get(flag) : undefined;
    if (!flag || !declaration) throw fail(`TN-USAGE-UNKNOWN-FLAG`, `Unknown flag: ${flag}`, "Run tenet --help.");
    if (declaration.value === "none") {
      if (inline !== undefined) {
        throw fail("TN-USAGE-OPTION-VALUE", `${flag} does not take a value`, "Remove the value.");
      }
      options[flag] = true;
      continue;
    }
    if (inline !== undefined) {
      if (inline === "" && declaration.value === "required") {
        throw fail("TN-USAGE-OPTION-VALUE", `${flag} needs a value`, "Pass a value after the option.");
      }
      options[flag] = inline;
      continue;
    }
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("-")) {
      options[flag] = next;
      index += 1;
    } else if (declaration.value === "required") {
      throw fail("TN-USAGE-OPTION-VALUE", `${flag} needs a value`, "Pass a value after the option.");
    } else {
      options[flag] = true;
    }
  }
  return { args, options };
}

function isFinding(value: unknown): value is Finding {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Finding>;
  return (
    typeof candidate.code === "string" &&
    (candidate.severity === "error" || candidate.severity === "warning" || candidate.severity === "advise") &&
    (candidate.rule === null || typeof candidate.rule === "string") &&
    (candidate.file === null || typeof candidate.file === "string") &&
    (candidate.line === null ||
      (typeof candidate.line === "number" && Number.isInteger(candidate.line) && candidate.line >= 1)) &&
    typeof candidate.message === "string" &&
    typeof candidate.fix === "string"
  );
}

function internalMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  try {
    return String(error);
  } catch {
    return "Unknown internal failure";
  }
}

function asOutcome(value: unknown): Required<Pick<CommandOutcome, "value" | "findings">> & {
  exitCode?: number;
} {
  if (
    value &&
    typeof value === "object" &&
    ("value" in value || "result" in value || "findings" in value || "exitCode" in value)
  ) {
    const outcome = value as CommandOutcome;
    return {
      value: outcome.value ?? outcome.result ?? null,
      findings: outcome.findings ?? [],
      ...(outcome.exitCode === undefined ? {} : { exitCode: outcome.exitCode }),
    };
  }
  return { value: value ?? null, findings: [] };
}

function emitJson(output: Writable, command: string, value: unknown, findings: Finding[]): void {
  line(output, JSON.stringify(result(command, value, findings)));
}

function emitHuman(io: ReturnType<typeof defaultIo>, value: unknown, findings: Finding[], quiet: boolean): void {
  for (const finding of findings) {
    const location =
      finding.file === null
        ? ""
        : ` at ${finding.file}${finding.line === null ? "" : `:${finding.line}`}`;
    line(io.stderr, `${finding.code}${location}: ${finding.message}`);
    line(io.stderr, `rule: ${finding.rule ?? "none"}`);
    line(io.stderr, `why: ${finding.message}`);
    line(io.stderr, `fix: ${finding.fix}`);
  }
  if (quiet || findings.some((finding) => finding.severity === "error")) return;
  if (typeof value === "string") line(io.stdout, value);
  else if (value !== undefined && value !== null) line(io.stdout, JSON.stringify(value, null, 2));
}

function parseGlobal(
  argv: string[],
  initial: { cwd: string },
): { argv: string[]; cwd: string; json: boolean; quiet: boolean; verbose: boolean; offline: boolean; special: "help" | "version" | null } {
  const parsed = {
    argv: [] as string[],
    cwd: initial.cwd,
    json: false,
    quiet: false,
    verbose: false,
    offline: false,
    special: null as "help" | "version" | null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--json") parsed.json = true;
    else if (token === "--quiet") parsed.quiet = true;
    else if (token === "--verbose") parsed.verbose = true;
    else if (token === "--offline") parsed.offline = true;
    else if (token === "--help" || token === "-h" || token === "help") parsed.special = "help";
    else if (token === "--version" || token === "version") parsed.special = "version";
    else if (token === "--cwd") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) throw fail("TN-USAGE-CWD", "--cwd needs a path", "Pass --cwd <path>.");
      parsed.cwd = path.resolve(value);
      index += 1;
    } else if (token.startsWith("--cwd=")) {
      const value = token.slice("--cwd=".length);
      if (!value) throw fail("TN-USAGE-CWD", "--cwd needs a path", "Pass --cwd <path>.");
      parsed.cwd = path.resolve(value);
    } else if (token.startsWith("--")) {
      parsed.argv.push(token);
    } else {
      parsed.argv.push(token);
    }
  }
  return parsed;
}

export async function run(argv: readonly string[], input: CliIo = {}): Promise<0 | 1 | 2 | 3 | 4> {
  const io = defaultIo(input);
  await loadCommands();
  try {
    const parsed = parseGlobal([...argv], { cwd: io.cwd });
    io.cwd = parsed.cwd;
    let command = parsed.special ?? (parsed.argv[0] ?? "");
    let spec: CommandSpec | undefined;
    let commandArgs: { args: string[]; options: CommandContext["options"] } | undefined;
    if (parsed.special === "help" && parsed.argv[1]) command = parsed.argv[1] ?? command;
    if (parsed.special === null && parsed.argv.length > 0) {
      spec = registry.get(command);
      if (!spec) {
        const finding = fail("TN-USAGE-COMMAND", `Unknown command: ${command}`, "Run tenet --help.");
        if (parsed.json) emitJson(io.stdout, command, null, [finding]);
        else emitHuman(io, null, [finding], false);
        return 2;
      }
      commandArgs = parseCommandArgs(spec, parsed.argv.slice(1));
    } else if (parsed.special !== null && parsed.argv.some((argument) => argument.startsWith("-"))) {
      const argument = parsed.argv.find((value) => value.startsWith("-")) ?? "";
      const finding = fail("TN-USAGE-UNKNOWN-FLAG", `Unknown flag: ${argument}`, "Run tenet --help.");
      if (parsed.json) emitJson(io.stdout, parsed.special, null, [finding]);
      else emitHuman(io, null, [finding], false);
      return 2;
    }

    const environment = await environmentFindings(io);
    if (environment.length > 0) {
      if (parsed.json) emitJson(io.stdout, command || "tenet", null, environment);
      else emitHuman(io, null, environment, false);
      return exitCodeFor(environment);
    }

    if (parsed.special === "version") {
      if (parsed.json) emitJson(io.stdout, "version", { version }, []);
      else line(io.stdout, version);
      return 0;
    }
    if (parsed.special === "help" || parsed.argv.length === 0) {
      if (parsed.json) emitJson(io.stdout, "help", { text: usage() }, []);
      else line(io.stdout, usage());
      return 0;
    }

    if (!spec || !commandArgs) throw fail("TN-USAGE-COMMAND", "No command was selected", "Run tenet --help.");
    if (parsed.offline && spec.network) {
      const finding = fail("TN-ENV-OFFLINE", `${command} needs the network`, "Run without --offline.");
      if (parsed.json) emitJson(io.stdout, command, null, [finding]);
      else emitHuman(io, null, [finding], false);
      return 3;
    }

    const humanOutput: Writable = parsed.json ? io.stderr : io.stdout;
    const clock = input.now ?? (() => new Date());
    const outcome = asOutcome(
      await (spec.run ?? spec.handler)?.({
        ...commandArgs,
        cwd: io.cwd,
        stdin: io.stdin,
        stdout: humanOutput,
        stderr: io.stderr,
        now: clock,
        json: parsed.json,
        quiet: parsed.quiet,
        verbose: parsed.verbose,
        offline: parsed.offline,
      }),
    );
    const fromOutcome = Math.trunc(outcome.exitCode ?? 0);
    const findingExit = exitCodeFor(outcome.findings);
    const code = [fromOutcome, findingExit].sort((left, right) => {
      const precedence = (value: number) => [0, 1, 4, 3, 2].indexOf(value);
      return precedence(right) - precedence(left);
    })[0] as 0 | 1 | 2 | 3 | 4;
    if (parsed.json) emitJson(io.stdout, command, outcome.value, outcome.findings);
    else emitHuman(io, outcome.value, outcome.findings, parsed.quiet);
    return code;
  } catch (error) {
    const finding = isFinding(error) && error.severity === "error"
      ? error
      : fail("TN-INTERNAL", "The command could not run", internalMessage(error));
    const parsedJson = argv.includes("--json");
    if (parsedJson) emitJson(io.stdout, "tenet", null, [finding]);
    else emitHuman(io, null, [finding], false);
    return exitCodeFor([finding]);
  }
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entry && entry === fileURLToPath(import.meta.url)) {
  process.exitCode = await run(process.argv.slice(2));
}
