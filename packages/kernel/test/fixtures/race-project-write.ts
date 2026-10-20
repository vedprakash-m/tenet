import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { execFileSync } from "node:child_process";
import { FsProject } from "../../src/adapters/project-fs.ts";
const root = process.argv[2]!, open = fs.openSync, sync = fs.fsyncSync;
let path = "", file = -1;
fs.openSync = ((name, ...args) => {
  const fd = open(name, ...args);
  if (String(name).includes(".tenet-write-")) { path = String(name); file = fd; }
  return fd;
}) as typeof fs.openSync;
fs.fsyncSync = fd => {
  sync(fd);
  if (fd === file) {
    file = -1;
    execFileSync(process.execPath, ["-e", "const fs=require('fs'),p=process.argv[1];fs.renameSync(p,p+'.displaced');fs.writeFileSync(p,'foreign temporary file',{flag:'wx'})", path]);
  }
};
syncBuiltinESMExports();
try { new FsProject(root).write("README.md", "new accepted text"); process.stdout.write("published"); }
catch (e) { process.stdout.write(JSON.stringify({ code: (e as { reasons?: Array<{ code: string }> }).reasons?.[0]?.code })); }
