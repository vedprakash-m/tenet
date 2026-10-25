// Built-CLI project-file fault injection; the shipped bundle is loaded unchanged.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const [bundle, point, outside, ...args] = process.argv.slice(2);
const open = fs.openSync, close = fs.closeSync, sync = fs.fsyncSync, rename = fs.renameSync, link = fs.linkSync, stat = fs.fstatSync, read = fs.readSync;
let temporary = -1, published = false, reading = -1, changed = false, readingPath = '';
const die = () => process.kill(process.pid, 'SIGKILL');
if (point === 'predictable-temp-link') fs.symlinkSync(outside, join(process.cwd(), `INTENT.md.tenet-${process.pid}.tmp`));
fs.openSync = (path, ...flags) => {
 if (point.startsWith('artifact-') && String(path).endsWith('/run.json') && !changed && typeof flags[0] === 'number' && (flags[0] & fs.constants.O_WRONLY)) {
  changed = true;
  fs.writeFileSync(outside, String(path));
  if (point.startsWith('artifact-fifo')) execFileSync('mkfifo', [String(path)]);
  if (point === 'artifact-directory') { fs.mkdirSync(path); fs.writeFileSync(join(String(path), 'notes.txt'), 'preserve directory content'); }
  if (point === 'artifact-link') { fs.writeFileSync(String(path) + '.original', 'preserve original content'); fs.symlinkSync(String(path) + '.original', path); }
  if (point === 'artifact-regular') fs.writeFileSync(path, 'a longer previous artifact that must be replaced completely');
  if (point === 'artifact-fifo-reader') {
   const reader = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
   process.on('exit', () => {
    const bytes = fs.readSync(reader, Buffer.alloc(64), 0, 64, null);
    fs.closeSync(reader); fs.writeFileSync(outside + '.observed', JSON.stringify({ bytes }));
   });
  }
 }
 if (point.startsWith('replace-') && outside === '<vitest-report>' && String(path).endsWith('/vitest.json') && !changed) {
  changed = true;
  execFileSync(process.execPath, ['-e', `
   const fs = require('fs'), path = process.argv[1], mode = process.argv[2];
   fs.renameSync(path, path + '.original');
   if (mode === 'replace-fifo') require('child_process').execFileSync('mkfifo', [path]);
   if (mode === 'replace-directory') fs.mkdirSync(path);
   if (mode === 'replace-link') fs.symlinkSync(path + '.original', path);
  `, String(path), point]);
 }
 const fd = open(path, ...flags);
 if (String(path).includes('.tenet-write-')) temporary = fd;
 if (point.startsWith('read-') && (outside === '<vitest-report>' ? String(path).endsWith('/vitest.json') :
  fs.realpathSync(path) === fs.realpathSync(resolve(process.cwd(), outside)))) { reading = fd; readingPath = String(path); }
 return fd;
};
fs.closeSync = descriptor => { if (descriptor === reading) reading = -1; return close(descriptor); };
fs.readSync = (descriptor, buffer, offset, length, position) => read(descriptor, buffer, offset,
 point === 'read-short' && descriptor === reading ? Math.min(length, 3) : length, position);
fs.fstatSync = (descriptor, ...options) => {
 const info = stat(descriptor, ...options);
 if (descriptor === reading && !changed && point !== 'read-short') {
  changed = true;
  execFileSync(process.execPath, ['-e', `
   const fs = require('fs'), path = process.argv[1], mode = process.argv[2];
   if (mode === 'read-grow') fs.appendFileSync(path, 'new bytes');
   if (mode === 'read-oversized') fs.truncateSync(path, 21 * 1024 * 1024);
   if (mode === 'read-shrink') fs.truncateSync(path, 1);
  if (mode === 'read-prepared-grow') fs.appendFileSync(path, '\\n');
   if (mode === 'read-overwrite') fs.writeFileSync(path, 'x'.repeat(fs.statSync(path).size));
    if (mode === 'read-overwrite-json') fs.writeFileSync(path, fs.readFileSync(path, 'utf8').replace('"note":"a"', '"note":"b"'));
    if (mode === 'read-store-overwrite') {
     const text = fs.readFileSync(path, 'utf8');
     const changed = path.endsWith('/state') ? text.replace(/("revision":)([0-8])/, (_, prefix, revision) => prefix + (Number(revision) + 1)) :
      path.endsWith('/marker') ? text.replace(/("nonce":")(.)/, (_, prefix, first) => prefix + (first === 'a' ? 'b' : 'a')) :
      text.replace('"verb":"open"', '"verb":"stop"');
     if (text === changed) throw new Error('mutation did not change the target');
     fs.writeFileSync(path, changed);
    }
  `, readingPath, point]);
 }
 return info;
};
fs.fsyncSync = fd => {
 sync(fd);
 if (point === 'after-temp-fsync' && fd === temporary) die();
 if (point === 'after-dir-fsync' && published && fs.fstatSync(fd).isDirectory()) die();
};
fs.renameSync = (from, to) => {
 rename(from, to);
 if (point === 'kill-prepared-call' && String(to) === join(process.cwd(), '.tenet/state')) {
  const state = JSON.parse(fs.readFileSync(to, 'utf8'));
  const call = Object.values(state.work).find(work => work.session.inCall)?.session.inCall;
  if (call && JSON.parse(fs.readFileSync(join(call.runDir, 'run.json'), 'utf8')).prepared === true) die();
 }
 if (String(to) === join(process.cwd(), 'INTENT.md')) { published = true; if (point === 'after-publish') die(); }
};
fs.linkSync = (from, to) => { link(from, to); if (point === 'after-first-link' && String(from).includes('.tenet-write-')) die(); };
syncBuiltinESMExports();
process.argv = [process.execPath, bundle, ...args];
await import(pathToFileURL(bundle).href);
