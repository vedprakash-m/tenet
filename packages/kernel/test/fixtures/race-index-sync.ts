// A real second process takes the Git lock immediately after Tenet's rename, before its cleanup runs.
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { GitCli } from "../../src/adapters/git-cli.ts";

const [root, parent] = [process.argv[2]!, process.argv[3]!];
const rename = fs.renameSync;
fs.renameSync = (from, to) => {
  rename(from, to);
  if (String(from) === join(root, ".git/index.lock") && String(to) === join(root, ".git/index")) {
    execFileSync(process.execPath, ["-e", "require('fs').writeFileSync(process.argv[1], 'foreign lock', {flag:'wx'})", join(root, ".git/index.lock")]);
  }
};
syncBuiltinESMExports();
console.log(await new GitCli(root).syncIndex(["src/a.ts"], parent));
