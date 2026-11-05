// Runs a restore in its own process and kills it with SIGKILL right after the named step, as a real crash would.
import { recoverRestore, restore } from "../../src/platform/restore.ts";
import fs, { writeSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";

const [backup, path, killAfter, mode] = process.argv.slice(2) as [string, string, string, string?];
if (mode === "rollback") {
  const rename = fs.renameSync;
  let moved = 0;
  fs.renameSync = (from, to) => {
    rename(from, to);
    if ([path, `${path}-wal`, `${path}-shm`].includes(String(from)) && ++moved === Number(killAfter)) {
      writeSync(1, `rollback-moved:${moved}\n`);
      process.kill(process.pid, "SIGKILL");
    }
  };
  syncBuiltinESMExports();
  recoverRestore(path, "rollback");
} else {
  restore(backup, path, { after: (step) => {
    if (step === killAfter) {
      writeSync(1, `restore-step:${step}\n`);
      process.kill(process.pid, "SIGKILL");
    }
  } });
}
