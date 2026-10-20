// `decide`: one verb over a registry of decision kinds (TS §6.5). The registry is the only list of kinds.
import { KernelError } from "../core/errors.ts";
import { DecideInput } from "../core/schemas.ts";
import { DECISIONS } from "../decisions/index.ts";
import type { Verb } from "../pipeline.ts";
import { workOf } from "./common.ts";

export const decide: Verb<DecideInput> = {
  name: "decide",
  schema: DecideInput,
  class: () => "mutating",
  // The only pre-lock step: a dead lock cannot be repaired from inside the transaction it blocks.
  async preLock(ports, input) {
    if (input.kind === "repair-lock") await ports.store.repairLock();
  },
  async run(ports, state, input, tx) {
    const kind = DECISIONS[input.kind];
    if (!kind) {
      throw new KernelError("restriction-key-unknown", `no decision kind "${input.kind}"; known: ${Object.keys(DECISIONS).join(", ")}`, { exit: 1 });
    }
    const work = workOf(state, input.h);
    return kind.run({ ports, tx: tx!, state: state!, work, input });
  },
};
