// Kill the real process at each durable boundary of the approved forget effect.
import { runVerb } from "../../src/pipeline.ts";
import { VERBS } from "../../src/verbs/index.ts";
import { createPorts } from "../../src/wire.ts";
import { fixtureEnv } from "../helpers.ts";
const [root, json, point] = process.argv.slice(2) as [string, string, string];
const ports = createPorts(root, fixtureEnv(root, { PATH: process.env.PATH, HOME: process.env.HOME }));
const die = () => process.kill(process.pid, "SIGKILL");
let flush: (() => void) | undefined;
const purge = ports.store.purge.bind(ports.store);
ports.store.purge = texts => { const n = purge(texts); if (point === "after-purge") { flush!(); die(); } return n; };
const transaction = ports.store.transaction.bind(ports.store);
ports.store.transaction = (verb, fn) => transaction(verb, tx => {
  flush = tx.flush;
  const intent = tx.intent, result = tx.result, publish = tx.publish;
  let forgetting = false, publications = 0;
  tx.intent = (effect, id, op) => { intent(effect, id, op); if (effect === "forget") { forgetting = true; if (point === "after-intent") { tx.flush!(); die(); } } };
  tx.result = (effect, id, out) => { result(effect, id, out); if (effect === "forget" && point === "after-result") { tx.flush!(); die(); } };
  tx.publish = next => {
    publish(next);
    if (forgetting && ++publications === (point === "after-first" ? 1 : point === "after-second" ? 2 : -1)) { tx.flush!(); die(); }
  };
  return fn(tx);
});
console.log(JSON.stringify(await runVerb(ports, VERBS, "decide", JSON.parse(json))));
