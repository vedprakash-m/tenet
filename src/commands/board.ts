import type { CommandContext } from "../core/commands.js";
import { fail } from "../core/output.js";
import { board, renderSpecsBoard } from "../views/specs-board.js";

const command = {
	name: "board",
	description: "Show specification state and spec debt",
	usage: "tenet board [--all]",
	options: [{ flags: "--all" }],
	async run(context: CommandContext) {
		if (context.args.length > 0) {
			throw fail(
				"TN-USAGE-BOARD",
				"Invalid usage for tenet board.",
				"Run tenet board --help for valid arguments and flags.",
			);
		}
		const value = await board({
			cwd: context.cwd,
			all: context.options["--all"] === true,
			now: context.now(),
		});
		if (context.json) return { result: value };
		if (!context.quiet) context.stdout.write(renderSpecsBoard(value));
		return { value: null };
	},
};

export const boardCommand = command;
export default command;
