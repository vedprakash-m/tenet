import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { createPorts } from "../../src/wire.ts";
import { recordAttempt } from "../../src/core/budget.ts";
const root = process.argv[2]!, rename = fs.renameSync;
fs.renameSync = (from, to) => { if (String(to) === join(root, ".tenet/state")) process.kill(process.pid, "SIGKILL"); rename(from, to); };
syncBuiltinESMExports();
await createPorts(root).store.transaction("test", async tx => {
  const state = tx.state!, w = Object.values(state.work)[0]!;
  tx.publish({ ...state, work: { ...state.work, [w.id]: { ...w, budget: recordAttempt(w.budget) } } });
});
