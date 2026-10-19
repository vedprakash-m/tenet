// Child process for the race test: increments config.revision N times through real transactions.
import { newStore } from "../helpers.ts";
const [root, n] = [process.argv[2]!, Number(process.argv[3])];
const store = newStore(root, { lockWaitMs: 20000 });
for (let i = 0; i < n; i++) {
  await store.transaction("bump", async (tx) => {
    const s = tx.state!;
    tx.publish({ ...s, config: { ...s.config, revision: s.config.revision + 1 } });
  });
}
