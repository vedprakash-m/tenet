// A cooperative terminal publisher, not a schema-2 migration implementation.
import { closeSync, fsyncSync, openSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FsStore } from "../../src/adapters/store-fs.ts";
import { systemClock, systemRandom } from "../../src/adapters/system.ts";
import { KernelError } from "../../src/core/errors.ts";
const [root, mode] = process.argv.slice(2) as [string, string], dir = join(root, ".tenet");
const store = new FsStore(root, systemClock, systemRandom);
if (mode === "bridge") {
  let code = "admitted";
  try { await store.transaction("restart", async () => {}); }
  catch (error) { if (!(error instanceof KernelError)) throw error; code = error.reasons[0]!.code; }
  console.log(JSON.stringify({ code }));
} else {
  const sync = () => { const fd = openSync(dir, "r"); try { fsyncSync(fd); } finally { closeSync(fd); } };
  const replace = (name: string, text: string) => {
    const fd = openSync(join(dir, `${name}.tmp`), "wx", 0o600);
    try { writeFileSync(fd, text); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(join(dir, `${name}.tmp`), join(dir, name)); sync();
  };
  await store.transaction("terminal-publisher", async () => {
    replace("migration-transition.json", "{}");
    if (mode !== "before-terminal") {
      replace("migration-terminal.json", JSON.stringify({
        operationId: "a".repeat(32), protocolVersion: 1, versions: { from: 2, to: 1 },
        outcome: "rolled-back", bindingDigest: "b".repeat(64),
      }));
    }
    if (mode === "after-fence-removal") { rmSync(join(dir, "migration-transition.json")); sync(); }
    console.log("paused");
    await new Promise(() => {});
  });
}
