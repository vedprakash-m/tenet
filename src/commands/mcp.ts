import { registerCommand } from "../cli.js";
import type { CommandSpec } from "../cli.js";
import { serveMcp } from "../mcp/index.js";

const command: CommandSpec = {
  name: "mcp",
  description: "Serve the Tenet MCP tools over stdio",
  usage: "tenet mcp",
  async run(context) {
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

registerCommand(command);
export default command;
