// Runs a journal reduction in its own process and kills it with SIGKILL right after the summaries are written.
import { FsStore } from "../../src/adapters/store-fs.ts";
import { systemClock, systemRandom } from "../../src/adapters/system.ts";

const [root] = process.argv.slice(2) as [string];
const store = new FsStore(root, systemClock, systemRandom, { compactAtBytes: 2_000, afterSummaries: () => process.kill(process.pid, "SIGKILL") });
await store.transaction("evict", async (tx) => tx.evict([]));
