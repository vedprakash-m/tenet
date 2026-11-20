import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { FsProject } from "../../src/adapters/project-fs.ts";

const root = process.argv[2]!;
const project = new FsProject(root);
project.setExclusions([{ pattern: "private/**", kinds: ["no-read", "no-edit"] }]);
const open = fs.openSync;
let opens = 0;
fs.openSync = ((path, ...args) => {
  if (String(path).startsWith(root)) opens++;
  return open(path, ...args);
}) as typeof fs.openSync;
syncBuiltinESMExports();
for (const path of [".ENV", "PRIVATE/file", ".TENET/state"]) {
  for (const action of [() => project.read(path), () => project.hashes([path]),
    () => project.write(path, "replacement"), () => project.remove([path])]) {
    try { action(); throw new Error("forbidden action returned"); }
    catch (error) {
      if (!(error instanceof Error) || !/policy forbids/.test(error.message)) throw error;
    }
  }
}
const refusedOpens = opens;
const allowed = project.read("public");
process.stdout.write(JSON.stringify({ refusedOpens, allowedOpens: opens - refusedOpens, allowed,
  unchanged: fs.readFileSync(join(root, ".env"), "utf8") === "synthetic restricted fixture" }));
