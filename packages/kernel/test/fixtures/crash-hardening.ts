import { runVerb } from "../../src/pipeline.ts";
import { VERBS } from "../../src/verbs/index.ts";
import { portsWith, fakeRecipes } from "../support/fixture.ts";

const [root, h, point] = [process.argv[2]!, process.argv[3]!, process.argv[4]!];
const ports = portsWith(root, fakeRecipes());
const die = () => process.kill(process.pid, "SIGKILL");
const write = ports.project.write.bind(ports.project);
ports.project.write = (path, content) => {
  if (point === "after-intent") die();
  write(path, content);
  if (point === "after-write") die();
};
const transaction = ports.store.transaction.bind(ports.store);
ports.store.transaction = (verb, fn) => transaction(verb, (tx) => fn({
  ...tx,
  result(effect, id, outcome) {
    tx.result(effect, id, outcome);
    if (point === "after-result" && effect === "hardening") die();
  },
}));
await runVerb(ports, VERBS, "decide", { h, kind: "hardening", gaps: ["Check authorization."] });
