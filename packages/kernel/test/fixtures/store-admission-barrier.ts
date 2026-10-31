// Real lock/admission barriers; no production timing hooks.
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { newStore } from "../helpers.ts";
const [root, mode] = process.argv.slice(2) as [string, string];
const dir = join(root, ".tenet"), store = newStore(root);
const admit = store.admit.bind(store);
let calls = 0, callback = false, injected = false;
store.admit = () => {
  const own = fs.existsSync(join(dir, "lock")) && JSON.parse(fs.readFileSync(join(dir, "lock"), "utf8")).pid === process.pid;
  if (mode === "post-claim" && own && !injected) {
    injected = true;
    fs.writeFileSync(join(dir, "migration-transition.json"), "{}");
    fs.chmodSync(dir, 0o755);
    for (const name of ["marker", "state", "state.prev", "log"]) if (fs.existsSync(join(dir, name))) fs.chmodSync(join(dir, name), 0o644);
  }
  admit();
  calls++;
  if (calls === (mode === "initial" ? 1 : mode === "last" ? 2 : -1)) {
    console.log("paused");
    while (!fs.existsSync(join(root, "resume"))) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
  }
};
const chmod = fs.chmodSync, write = fs.writeFileSync, rename = fs.renameSync;
const failure = Object.assign(new Error("injected maintenance failure"), { code: "EIO" });
fs.chmodSync = (path, bits) => {
  if (mode === "chmod-failure" && String(path) === dir && fs.existsSync(join(dir, "lock"))) throw failure;
  if (mode === "bootstrap-failure" && String(path) === dir && fs.readdirSync(dir).some(n => /^quarantine-bootstrap-.*\.lock$/.test(n))) throw failure;
  return chmod(path, bits);
};
fs.writeFileSync = ((path, ...args) => {
  if (mode === "ignore-failure" && String(path) === join(dir, ".gitignore")) throw failure;
  return write(path, ...args);
}) as typeof fs.writeFileSync;
fs.renameSync = (from, to) => {
  if (mode === "bootstrap" && String(to).includes("quarantine-in-progress")) {
    if ((fs.statSync(dir).mode & 0o777) !== 0o700 || !fs.readdirSync(dir).some(n => /^quarantine-bootstrap-.*\.lock$/.test(n))) throw new Error("quarantine moved before locked privacy maintenance");
    injected = true;
  }
  return rename(from, to);
};
syncBuiltinESMExports();
let code: string | undefined;
try { await store.transaction(mode.startsWith("bootstrap") || mode === "unwritable-import" ? "open" : "test", async () => { callback = true; }); }
catch (e) { code = (e as any).reasons?.[0]?.code ?? (e as any).code ?? (e as Error).message; }
console.log(JSON.stringify({ code, callback, injected, uid: process.geteuid!(), owner: fs.statSync(dir).uid }));
