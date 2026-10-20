// Kill the real adapter at each durable index-sync boundary. No test-only product hooks.
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { createPorts } from "../../src/wire.ts";
const [root, parent, point] = [process.argv[2]!, process.argv[3]!, process.argv[4]!];
const link = fs.linkSync, rename = fs.renameSync, sync = fs.fsyncSync, lock = join(root, ".git/index.lock");
let renamed = false;
const die = () => process.kill(process.pid, "SIGKILL");
fs.linkSync = (from, to) => {
  if (String(to) === lock && point === "before-lock") die();
  link(from, to);
  if (String(to) === lock && point === "after-lock") die();
  if (String(to) === lock && point === "pause-after-lock") { process.stdout.write("locked\n"); process.kill(process.pid, "SIGSTOP"); }
};
fs.renameSync = (from, to) => {
  if (String(from) === lock && point === "before-rename") die();
  rename(from, to);
  if (String(from) === lock) renamed = true;
  if (String(from) === lock && point === "after-rename") die();
};
fs.fsyncSync = fd => {
  if (point === "failed-directory-sync" && renamed && fs.fstatSync(fd).isDirectory()) { renamed = false; throw new Error("injected directory sync failure"); }
  sync(fd);
};
syncBuiltinESMExports();
const ports = createPorts(root), work = Object.keys(ports.store.read()!.state.work)[0]!;
try { await ports.git.syncIndex(["src/a.ts"], parent, {
  owner: ports.store.self(),
  intent: record => ports.store.transaction("sync-test", async tx => { tx.intent("index-sync", "crash-sync", { work, sync: record }); }),
  result: status => ports.store.transaction("sync-test", async tx => { tx.result("index-sync", "crash-sync", { status }); }),
}); } catch (e) { process.stdout.write(JSON.stringify({ error: (e as { reasons?: Array<{ code: string }> }).reasons?.[0]?.code })); process.exitCode = 2; }
