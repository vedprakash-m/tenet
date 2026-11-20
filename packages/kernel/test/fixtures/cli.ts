import "../../src/zod-jitless.ts";
import { main } from "../../src/frontends/cli.ts";
import { createPorts, dropGitLocalVars } from "../../src/wire.ts";
import { VERBS } from "../../src/verbs/index.ts";
import { createStack } from "../support/metadata-stack.ts";

dropGitLocalVars(process.env);
const ports = createPorts(process.cwd());
ports.stack = createStack();
const { response, code } = await main(process.argv.slice(2), ports, VERBS, process.stdin, process.env, process.execArgv);
process.stdout.write(`${JSON.stringify(response)}\n`, () => process.exit(code));
