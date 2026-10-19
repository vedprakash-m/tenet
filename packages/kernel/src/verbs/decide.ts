// `decide`: one verb over a registry of decision kinds (TS §6.5). The registry is the only list of kinds.
import { KernelError } from "../core/errors.ts";
import { DecideInput } from "../core/schemas.ts";
import { DECISIONS } from "../decisions/index.ts";
import type { Verb } from "../pipeline.ts";
import { workOf } from "./common.ts";
import { keepRecovered, recover } from "./recover.ts";

export const decide: Verb<DecideInput> = {
  name: "decide",
  schema: DecideInput,
  class: () => "mutating",
  // The only pre-lock step: a dead lock cannot be repaired from inside the transaction it blocks.
  async preLock(ports, input) { if (input.kind === "repair-lock") await ports.store.repairLock(); },
  async run(ports, state, input, tx) {
    const kind = DECISIONS[input.kind];
    if (!kind) throw new KernelError("restriction-key-unknown", `no decision kind "${input.kind}"; known: ${Object.keys(DECISIONS).join(", ")}`, { exit: 1 });
    workOf(state, input.h);
    // Like every mutating verb, a decision first finishes what an earlier call left half done.
    const rec = await recover(ports, tx!, state!);
    const work = rec.state.work[workOf(state, input.h).id]!;
    return keepRecovered(await kind.run({ ports, tx: tx!, state: rec.state, work, input }), rec, state!);
  },
};
