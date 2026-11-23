import type { Finding } from "../types/generated.js";

export type Writable = {
  write(value: string | Uint8Array): unknown;
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

export function registerCommand(spec: CommandSpec): void {
  if (!spec.name || (!spec.run && !spec.handler)) throw new TypeError("command spec needs a name and run handler");
  for (const name of [spec.name, ...(spec.aliases ?? [])]) {
    if (registry.has(name)) throw new Error(`command is already registered: ${name}`);
    registry.set(name, spec);
  }
}

export function registeredCommands(): CommandSpec[] {
  return [...new Set(registry.values())];
}

export function commandFor(name: string): CommandSpec | undefined {
  return registry.get(name);
}
