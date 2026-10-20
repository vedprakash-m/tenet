import { FsStore } from "../../src/adapters/store-fs.ts";
import { systemClock, systemRandom } from "../../src/adapters/system.ts";
import { KernelError } from "../../src/core/errors.ts";
const store = new FsStore(process.argv[2]!, systemClock, systemRandom);
try { await store.transaction("test", async () => undefined); console.log(JSON.stringify({ refused: false })); }
catch (e) { console.log(JSON.stringify({ refused: true, code: e instanceof KernelError ? e.reasons[0]?.code : String(e) })); }
