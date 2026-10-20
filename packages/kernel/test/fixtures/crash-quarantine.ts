// Kill at real filesystem boundaries, without adding fault hooks to production code.
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { basename, dirname, join } from "node:path";
import { runVerb } from "../../src/pipeline.ts";
import { createPorts } from "../../src/wire.ts";
import { VERBS } from "../../src/verbs/index.ts";

const [root, point] = [process.argv[2]!, process.argv[3]!];
const die = () => process.kill(process.pid, "SIGKILL");
const rename = fs.renameSync, link = fs.linkSync, open = fs.openSync, sync = fs.fsyncSync;
const names = new Map<number, string>();
fs.openSync = (path, ...args) => { const fd = open(path, ...args); names.set(fd, String(path)); return fd; };
fs.fsyncSync = fd => {
  sync(fd);
  if (point === "after-marker" && names.get(fd) === join(root, ".tenet/marker")) {
    const marker = JSON.parse(fs.readFileSync(join(root, ".tenet/marker"), "utf8"));
    if (marker.ino === fs.statSync(join(root, ".tenet")).ino) die();
  }
};
fs.linkSync = (from, to) => { link(from, to); if (point === "after-marker" && String(to) === join(root, ".tenet/marker")) die(); };
fs.renameSync = (from, to) => {
  const dest = String(to);
  if (point === "before-state" && dest === join(root, ".tenet/state")) die();
  rename(from, to);
  if (point === "after-entry" && String(from) === join(root, ".tenet/state") && basename(dirname(dest)).startsWith("quarantine-")) die();
  if (basename(dest).startsWith("quarantine-in-progress")) {
    const phase = JSON.parse(fs.readFileSync(dest, "utf8")).phase;
    if (point === "after-journal" && phase === "moving" || point === "after-moves" && phase === "moved") die();
  }
  if (point === "after-state" && dest === join(root, ".tenet/state")) die();
};
syncBuiltinESMExports();
console.log(JSON.stringify(await runVerb(createPorts(root, { PATH: process.env.PATH, HOME: process.env.HOME }), VERBS, "open", { profile: "investigate", request: "fresh" })));
