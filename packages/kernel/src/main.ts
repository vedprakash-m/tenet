// Process entry: the one place that touches process.argv, stdin, stdout and the exit code.
import { z } from "zod";
import { main } from "./frontends/cli.ts";
import { createPorts, dropGitLocalVars } from "./wire.ts";
import { VERBS } from "./verbs/index.ts";

// A kernel call is one short process: generating and compiling a parser per object schema costs more than it saves.
z.config({ jitless: true });
dropGitLocalVars(process.env);
const ports = createPorts(process.cwd());
const { response, code } = await main(process.argv.slice(2), ports, VERBS, process.stdin, process.env, process.execArgv);
process.stdout.write(`${JSON.stringify(response)}\n`, () => process.exit(code));
