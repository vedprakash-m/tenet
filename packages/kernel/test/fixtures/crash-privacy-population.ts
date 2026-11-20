import { PrivacyPopulationWriter } from "../../src/adapters/privacy-population-fs.ts";
import { DigestKeyFiles } from "../../src/adapters/digest-key-fs.ts";
import { StorageV3Files } from "../../src/adapters/storage-v3-write.ts";
import { supplementalGeneration, supplementalMove } from "./supplemental-move.ts";

const [root, cut] = process.argv.slice(2);
if (!root || !cut) throw new Error("population crash fixture requires root and boundary");
const files = new StorageV3Files(root, {
  objectGeneration: supplementalGeneration,
  renameNoReplace: supplementalMove,
  assertOwned: () => {}, ...(process.platform === "win32" ? { syncDirectory: () => {} } : {}),
});
const keys = new DigestKeyFiles(root, {
  objectGeneration: supplementalGeneration,
  assertOwned: () => {}, syncDirectory: () => files.sync(), renameNoReplace: supplementalMove,
});
new PrivacyPopulationWriter(files, keys, () => true).resume(boundary => {
  if (boundary === cut) process.kill(process.pid, "SIGKILL");
});
