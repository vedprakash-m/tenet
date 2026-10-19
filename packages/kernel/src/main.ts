// Process entry: the one place that touches process.argv, stdin, stdout and the exit code.
import { main } from "./frontends/cli.ts";
import { createPorts } from "./wire.ts";
import { VERBS } from "./verbs/index.ts";

const ports = createPorts(process.cwd());
const { response, code } = await main(process.argv.slice(2), ports, VERBS, process.stdin, process.env, process.execArgv);
process.stdout.write(`${JSON.stringify(response)}\n`, () => process.exit(code));
