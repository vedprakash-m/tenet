// Fault-injection driver for built-CLI UAT. Loads the unchanged bundle after instrumenting filesystem boundaries.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [bundle, point, ...args] = process.argv.slice(2);
const link = fs.linkSync, rename = fs.renameSync, sync = fs.fsyncSync, lock = join(process.cwd(), '.git/index.lock');
let renamed = false;
const die = () => process.kill(process.pid, 'SIGKILL');
let commitResultFd;
if (['after-commit-result', 'after-long-history-commit-result', 'after-legacy-commit-result', 'after-malformed-commit-result'].includes(point)) {
 const write = fs.writeFileSync;
 fs.writeFileSync = (file, data, ...options) => {
  let record;
  if (typeof data === 'string') try { record = JSON.parse(data); } catch { /* not a journal record */ }
  if (record?.kind === 'result' && record.effect === 'commit' && record.outcome?.completed) {
   if (point === 'after-legacy-commit-result') delete record.outcome.foreign;
   if (point === 'after-malformed-commit-result') record.outcome.foreign = 'human.txt';
   write(file, `${JSON.stringify(record)}\n`, ...options);
   commitResultFd = file;
  } else write(file, data, ...options);
 };
}
fs.linkSync = (from, to) => {
 if (String(to) === lock && point === 'before-lock') die();
 link(from, to);
 if (String(to) === lock && point === 'after-lock') die();
};
fs.renameSync = (from, to) => {
 if (String(from) === lock && point === 'before-rename') die();
 rename(from, to);
 if (String(from) === lock) renamed = true;
 if (String(from) === lock && point === 'after-rename') die();
};
fs.fsyncSync = fd => {
 if (point === 'failed-directory-sync' && renamed && fs.fstatSync(fd).isDirectory()) { renamed = false; throw new Error('injected directory sync failure'); }
 sync(fd);
 if (fd === commitResultFd) {
  if (point === 'after-long-history-commit-result') {
   const record = JSON.stringify({ t: new Date().toISOString(), kind: 'call', verb: 'inspect', exit: 0, revision: 0 });
   fs.writeFileSync(fd, `${record}\n`.repeat(450));
   sync(fd);
  }
  die();
 }
};
syncBuiltinESMExports();
process.argv = [process.execPath, bundle, ...args];
await import(pathToFileURL(bundle).href);
