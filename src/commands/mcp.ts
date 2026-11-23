import { serveMcp } from "../cli.js";

type CommandContext = {
  cwd: string;
  stdin: NodeJS.ReadableStream;
  stdout: { write(value: string | Uint8Array): unknown };
  stderr: { write(value: string | Uint8Array): unknown };
  now: () => Date;
};

const command = {
  name: "mcp",
  description: "Serve the Tenet MCP tools over stdio",
  usage: "tenet mcp",
  async run(context: CommandContext) {
    await serveMcp({
      cwd: context.cwd,
      stdin: context.stdin,
      stdout: context.stdout,
      stderr: context.stderr,
      now: context.now,
    });
    return { value: null };
  },
};

export default command;
