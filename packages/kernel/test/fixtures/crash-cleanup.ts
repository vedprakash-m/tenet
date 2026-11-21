// Child process: confirms a cleanup and dies after the intent is logged, before removal ("before") or after removing one
// listed file ("after-some"), so the parent can show that recovery never repeats removal (cleanup-confirmation §9, C10).
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { runVerb } from "../../src/pipeline.ts";
import { VERBS } from "../../src/verbs/index.ts";
import { createPorts } from "../../src/wire.ts";

const [root, json, mode] = [process.argv[2]!, process.argv[3]!, process.argv[4]!];
const ports = createPorts(root, { PATH: process.env.PATH, HOME: process.env.HOME });
ports.store.removeTemp = (walk) => {
  const file = walk.entries.find((e) => e.type === "file");
  if (mode === "after-some" && walk.root && file) unlinkSync(join(walk.root, ...file.path.split("/")));
  process.kill(process.pid, "SIGKILL");
  return { removed: [], kept: [] };
};
console.log(JSON.stringify(await runVerb(ports, VERBS, "decide", JSON.parse(json))));
