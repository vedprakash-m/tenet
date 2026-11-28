import { commandHelp } from "../core/cli-help.js";
import type { CommandContext } from "../core/commands.js";
import { message } from "../core/messages.js";
import { fail } from "../core/output.js";
import { board, renderSpecsBoard } from "../views/specs-board.js";

const command = {
	...commandHelp.board,
	async run(context: CommandContext) {
		if (context.args.length > 0) {
			const words = message("TN-USAGE-BOARD", {
				command: "board",
				detail: "unexpected positional arguments",
			});
			throw fail(
				"TN-USAGE-BOARD",
				words.message,
				words.fix,
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
