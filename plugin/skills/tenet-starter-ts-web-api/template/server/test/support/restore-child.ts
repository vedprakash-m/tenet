// Runs a restore in its own process and kills it with SIGKILL right after the named step, as a real crash would.
import { restore } from "../../src/platform/restore.ts";

const [backup, path, killAfter] = process.argv.slice(2) as [string, string, string];
restore(backup, path, { after: (step) => { if (step === killAfter) process.kill(process.pid, "SIGKILL"); } });
