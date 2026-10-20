// Fault-injection driver for built-CLI UAT. Loads the unchanged bundle after instrumenting filesystem boundaries.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [bundle, point, ...args] = process.argv.slice(2);
const link = fs.linkSync, rename = fs.renameSync, sync = fs.fsyncSync, lock = join(process.cwd(), '.git/index.lock');
let renamed = false;
const die = () => process.kill(process.pid, 'SIGKILL');
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
};
syncBuiltinESMExports();
process.argv = [process.execPath, bundle, ...args];
await import(pathToFileURL(bundle).href);
