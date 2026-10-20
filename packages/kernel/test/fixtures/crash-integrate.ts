// Child process: runs `integrate` and dies right after Git has merged, before the result record is written.
import { runVerb } from "../../src/pipeline.ts";
import { VERBS } from "../../src/verbs/index.ts";
import { createPorts } from "../../src/wire.ts";

const [root, json] = [process.argv[2]!, process.argv[3]!];
const ports = createPorts(root, { PATH: process.env.PATH, HOME: process.env.HOME });
const real = ports.git.integrate.bind(ports.git);
ports.git.integrate = async (base, work) => { await real(base, work); process.kill(process.pid, "SIGKILL"); return { ok: true }; };
console.log(JSON.stringify(await runVerb(ports, VERBS, "integrate", JSON.parse(json))));
