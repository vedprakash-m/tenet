// Child process: runs `publish` and dies either just before Git pushes ("before") or right after the push reached the
// remote, before the result record is written ("after").
import { runVerb } from "../../src/pipeline.ts";
import { VERBS } from "../../src/verbs/index.ts";
import { createPorts } from "../../src/wire.ts";

const [root, json, point] = [process.argv[2]!, process.argv[3]!, process.argv[4]!];
const ports = createPorts(root, { PATH: process.env.PATH, HOME: process.env.HOME });
const real = ports.git.push.bind(ports.git);
ports.git.push = async (...args) => {
  if (point === "before") process.kill(process.pid, "SIGKILL");
  await real(...args);
  process.kill(process.pid, "SIGKILL");
  return { result: "ok" };
};
console.log(JSON.stringify(await runVerb(ports, VERBS, "publish", JSON.parse(json))));
