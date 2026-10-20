// Built-CLI project-write fault injection; the shipped bundle is loaded unchanged.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [bundle, point, outside, ...args] = process.argv.slice(2);
const open = fs.openSync, sync = fs.fsyncSync, rename = fs.renameSync, link = fs.linkSync;
let temporary = -1, published = false;
const die = () => process.kill(process.pid, 'SIGKILL');
if (point === 'predictable-temp-link') fs.symlinkSync(outside, join(process.cwd(), `INTENT.md.tenet-${process.pid}.tmp`));
fs.openSync = (path, ...flags) => { const fd = open(path, ...flags); if (String(path).includes('.tenet-write-')) temporary = fd; return fd; };
fs.fsyncSync = fd => {
 sync(fd);
 if (point === 'after-temp-fsync' && fd === temporary) die();
 if (point === 'after-dir-fsync' && published && fs.fstatSync(fd).isDirectory()) die();
};
fs.renameSync = (from, to) => {
 rename(from, to);
 if (String(to) === join(process.cwd(), 'INTENT.md')) { published = true; if (point === 'after-publish') die(); }
};
fs.linkSync = (from, to) => { link(from, to); if (point === 'after-first-link' && String(from).includes('.tenet-write-')) die(); };
syncBuiltinESMExports();
process.argv = [process.execPath, bundle, ...args];
await import(pathToFileURL(bundle).href);
