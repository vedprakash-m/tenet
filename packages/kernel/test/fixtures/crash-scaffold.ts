// Child process for the scaffold crash tests: runs `decide scaffold` and dies at a chosen point of the file-write effect.
//   after-intent   the intent is logged, nothing is written
//   mid-write      the first file is written, the rest are not
//   after-write    every file is written, no result record
//   after-result   the result is logged, the revision is not published
import { runVerb } from "../../src/pipeline.ts";
import { VERBS } from "../../src/verbs/index.ts";
import { fakeRecipes } from "../support/fixture.ts";
import { portsWith } from "../support/fixture.ts";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

const [root, json, point] = [process.argv[2]!, process.argv[3]!, process.argv[4]!];
const ports = portsWith(root, fakeRecipes());
const die = () => process.kill(process.pid, "SIGKILL");
const open = fs.openSync, sync = fs.fsyncSync, link = fs.linkSync;
let temporary = -1, published = false;
fs.openSync = ((path, ...args) => { const fd = open(path, ...args); if (String(path).includes(".tenet-write-")) temporary = fd; return fd; }) as typeof fs.openSync;
fs.fsyncSync = fd => {
  sync(fd);
  if (point === "after-temp-fsync" && fd === temporary) die();
  if (point === "after-file-dir-fsync" && published && fs.fstatSync(fd).isDirectory()) die();
};
fs.linkSync = (from, to) => {
  link(from, to);
  if (String(from).includes(".tenet-write-")) { published = true; if (point === "after-link") die(); }
};
syncBuiltinESMExports();

const real = ports.project.writeNew.bind(ports.project);
ports.project.writeNew = (files) => {
  if (point === "after-intent") die();
  if (point === "mid-write") { real(files.slice(0, 1)); die(); }
  real(files);
  if (point === "after-write") die();
};
const realTx = ports.store.transaction.bind(ports.store);
ports.store.transaction = (v, fn) => realTx(v, (tx) => fn({ ...tx, result: (e, i, o) => { tx.result(e, i, o); if (point === "after-result" && e === "scaffold") die(); } }));

console.log(JSON.stringify(await runVerb(ports, VERBS, "decide", JSON.parse(json))));
