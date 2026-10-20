// Child process: confirms an undo, and dies after the revert contract is published but before the patch is applied.
import { runVerb } from "../../src/pipeline.ts";
import { VERBS } from "../../src/verbs/index.ts";
import { createPorts } from "../../src/wire.ts";

const [root, json] = [process.argv[2]!, process.argv[3]!];
const ports = createPorts(root, { PATH: process.env.PATH, HOME: process.env.HOME });
const apply = ports.git.applyPatch.bind(ports.git);
ports.git.applyPatch = async (...args) => { if (process.argv[4] === "after-apply") await apply(...args); process.kill(process.pid, "SIGKILL"); return { ok: true }; };
console.log(JSON.stringify(await runVerb(ports, VERBS, "decide", JSON.parse(json))));
