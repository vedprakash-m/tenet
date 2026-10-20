// Child process for the adopt crash tests: runs `decide adopt` and dies at a chosen point of the file-write effect.
//   after-intent   the intent is logged, nothing is written
//   after-write    the file is written, no result record
//   after-result   the result is logged, the revision is not published
import { runVerb } from "../../src/pipeline.ts";
import { VERBS } from "../../src/verbs/index.ts";
import { portsWith, fakeRecipes } from "../support/fixture.ts";

const [root, json, point] = [process.argv[2]!, process.argv[3]!, process.argv[4]!];
const ports = portsWith(root, fakeRecipes());
const die = () => process.kill(process.pid, "SIGKILL");

const real = ports.project.write.bind(ports.project);
ports.project.write = (path, content) => {
  if (point === "after-intent") die();
  real(path, content);
  if (point === "after-write") die();
};
const realTx = ports.store.transaction.bind(ports.store);
ports.store.transaction = (v, fn) => realTx(v, (tx) => fn({ ...tx, result: (e, i, o) => { tx.result(e, i, o); if (point === "after-result" && e === "adopt") die(); } }));

console.log(JSON.stringify(await runVerb(ports, VERBS, "decide", JSON.parse(json))));
