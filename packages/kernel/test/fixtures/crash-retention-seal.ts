import { readFileSync } from "node:fs";
import { openBoundStore } from "./retention-bound-fixture.ts";
import { sealGeneration } from "../../src/adapters/retention-seal-fs.ts";
import { JournalIndexV1 } from "../../src/core/storage-records.ts";
import { sha256, stableStringify } from "../../src/core/ids.ts";

const [root, rowPath, indexPath, cut] = process.argv.slice(2);
if (!root || !rowPath || !indexPath || !cut) throw new Error("seal crash fixture requires root, row, index and boundary");
const { files, store } = openBoundStore(root), row = store.validate(JSON.parse(readFileSync(rowPath, "utf8")));
const index = JournalIndexV1.parse(JSON.parse(readFileSync(indexPath, "utf8")));
sealGeneration(files, store, {
  root: row.rotation.next.mount.root, exclusiveNameToken: row.batchId, indexExclusiveNameToken: "b".repeat(24),
  captureMount: () => row.rotation.next.mount, verifyReservation: () => true, verifyIndexTemp: () => true,
}, next => {
  const afterIndex = Buffer.from(stableStringify({ ...index, active: { path: "log", identity: next.identity } }) + "\n");
  return {
    record: { ...row, rotation: { ...row.rotation, next, indexAfterHash: sha256(afterIndex) },
      retainedIndex: { ...row.retainedIndex, beforeHash: sha256(afterIndex) } },
    afterIndex,
  };
}, phase => { if (phase === cut) process.kill(process.pid, "SIGKILL"); });
