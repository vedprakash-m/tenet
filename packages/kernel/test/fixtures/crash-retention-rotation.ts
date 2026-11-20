import { readFileSync } from "node:fs";
import { openBoundStore } from "./retention-bound-fixture.ts";
import { rotateBoundGeneration } from "../../src/adapters/retention-rotation-fs.ts";

const [root, indexPath, cut] = process.argv.slice(2);
if (!root || !indexPath || !cut) throw new Error("rotation crash fixture requires root, index and boundary");
const { files, store } = openBoundStore(root);
rotateBoundGeneration(files, store, readFileSync(indexPath), () => true, phase => {
  if (phase === cut) process.kill(process.pid, "SIGKILL");
});
