// Child process: answers a GIT-09 shared-merge proposal with `apply` and dies at one step of the confirmed merge:
// right after `git merge --no-commit` returns ("after-merge"), or just before the merge commit ("before-commit").
import { runVerb } from "../../src/pipeline.ts";
import { VERBS } from "../../src/verbs/index.ts";
import { createPorts } from "../../src/wire.ts";
import type { Runner } from "../../src/ports/types.ts";

const [root, json, point] = [process.argv[2]!, process.argv[3]!, process.argv[4]!];
const ports = createPorts(root, { PATH: process.env.PATH, HOME: process.env.HOME });
const runner = (ports.git as unknown as { runner: Runner }).runner;
const real = runner.run.bind(runner);
runner.run = async (o) => {
  if (point === "before-commit" && o.argv.includes("commit")) process.kill(process.pid, "SIGKILL");
  const r = await real(o);
  if (point === "after-merge" && o.argv.includes("merge") && o.argv.includes("--no-commit")) process.kill(process.pid, "SIGKILL");
  return r;
};
console.log(JSON.stringify(await runVerb(ports, VERBS, "decide", JSON.parse(json))));
