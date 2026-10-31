// Real built CLI, killed only after a completed filesystem boundary; no source-level hooks.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
const [bundle, point, ...args] = process.argv.slice(2);
const dir = join(process.cwd(), '.tenet');
const open = fs.openSync, close = fs.closeSync, sync = fs.fsyncSync, rename = fs.renameSync, remove = fs.rmSync;
const names = new Map();
let forgetting = false, publications = 0;
const die = () => process.kill(process.pid, 'SIGKILL');
fs.openSync = (path, ...options) => { const fd = open(path, ...options); names.set(fd, String(path)); return fd; };
fs.closeSync = fd => { names.delete(fd); return close(fd); };
fs.fsyncSync = fd => {
 sync(fd);
 const path = names.get(fd);
 if (path === join(dir, 'log')) {
  const last = JSON.parse(fs.readFileSync(path, 'utf8').trim().split('\n').at(-1));
  if (last.effect === 'forget' && last.kind === 'intent') { forgetting = true; if (point === 'after-intent') die(); }
  if (last.effect === 'forget' && last.kind === 'result' && point === 'after-result') die();
 }
 if (forgetting && path === dir && publications === (point === 'after-first' ? 1 : point === 'after-second' ? 2 : -1)) die();
};
fs.renameSync = (from, to) => { rename(from, to); if (forgetting && String(to) === join(dir, 'state')) publications++; };
fs.rmSync = (path, options) => {
 remove(path, options);
 if (forgetting && point === 'after-purge' && String(path).includes(`${sep}manifests${sep}`)) die();
};
syncBuiltinESMExports();
process.argv = [process.execPath, bundle, ...args];
await import(pathToFileURL(bundle).href);
