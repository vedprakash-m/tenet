// Child process for the crash tests: runs one verb and dies (SIGKILL) at a chosen point of the commit effect.
//   before-intent  the tree is built, nothing is logged
//   before-act     the intent is logged and published, the commit has not run
//   after-act      the commit landed, no result record
//   after-result   the result is logged, the revision is not published
import { runVerb } from "../../src/pipeline.ts";
import { VERBS } from "../../src/verbs/index.ts";
import { createPorts } from "../../src/wire.ts";

const [root, verb, json, point] = [process.argv[2]!, process.argv[3]!, process.argv[4]!, process.argv[5] ?? "after-act"];
const ports = createPorts(root, { PATH: process.env.PATH, HOME: process.env.HOME });
const die = () => process.kill(process.pid, "SIGKILL");

const git = ports.git;
const realTree = git.expectedTree.bind(git);
const realCommit = git.commit.bind(git);
git.expectedTree = async (plan) => { const t = await realTree(plan); if (point === "before-intent") die(); return t; };
git.commit = async (plan) => {
  if (point === "before-act") die();
  const out = await realCommit(plan);
  if (point === "after-act") die();
  return out;
};
const realTx = ports.store.transaction.bind(ports.store);
ports.store.transaction = (v, fn) => realTx(v, (tx) => fn({ ...tx, result: (e, i, o) => { tx.result(e, i, o); if (point === "after-result" && e === "commit") die(); } }));

console.log(JSON.stringify(await runVerb(ports, VERBS, verb, JSON.parse(json))));
