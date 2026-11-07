import { createPorts } from "../../src/wire.ts";
import { runVerb } from "../../src/pipeline.ts";
import { VERBS } from "../../src/verbs/index.ts";

const ports = createPorts(process.cwd());
const write = ports.project.writeNew.bind(ports.project);
const wait = () => { process.kill(process.pid, "SIGKILL"); };
ports.project.writeNew = files => {
  if (process.argv[2] === "intent") wait();
  write(files);
  wait();
};
const preview = await runVerb(ports, VERBS, "diagnostics", {});
const { hash } = preview.data as { hash: string };
await runVerb(ports, VERBS, "diagnostics", { save: "crash.json", previewHash: hash });
