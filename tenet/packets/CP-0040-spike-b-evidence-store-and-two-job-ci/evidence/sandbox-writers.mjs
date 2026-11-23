// Spike B: five concurrent writers append to refs/tenet/records with fetch-rebuild-retry; count what survives.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const url = 'https://github.com/vedprakash-m/tenet-sandbox.git';
const base = path.resolve('writers'); fs.rmSync(base, { recursive: true, force: true }); fs.mkdirSync(base);
const worker = `
const { execFileSync } = require('node:child_process');
const g = (a, i) => execFileSync('git', a, { input: i, encoding: 'utf8' }).trim();
const id = process.argv[1]; let tries = 0;
for (let attempt = 1; attempt <= 8; attempt++) {
  tries = attempt;
  g(['fetch', '--no-tags', '--depth=1', 'origin', '+refs/tenet/records:refs/tenet/records']);
  const parent = g(['rev-parse', 'refs/tenet/records']);
  const lines = g(['ls-tree', parent]).split('\\n').filter(Boolean);
  const blob = g(['hash-object', '-w', '--stdin'], JSON.stringify({ writer: id, at: Date.now() }));
  lines.push('100644 blob ' + blob + '\\tconcurrent-' + id + '.json');
  const tree = g(['mktree'], lines.join('\\n') + '\\n');
  const commit = g(['commit-tree', tree, '-p', parent, '-m', 'tenet: concurrent ' + id]);
  try { g(['push', 'origin', commit + ':refs/tenet/records']); console.log(id, 'ok after', tries); process.exit(0); }
  catch { const ms = 500 + Math.random() * 2500; const end = Date.now() + ms; while (Date.now() < end) {} }
}
console.log(id, 'FAILED'); process.exit(1);`;
const procs = [];
for (let i = 1; i <= 5; i++) {
  const dir = path.join(base, 'w' + i); fs.mkdirSync(dir);
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['remote', 'add', 'origin', url], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'tenet-recorder'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'tenet-recorder@users.noreply.github.com'], { cwd: dir });
  procs.push(new Promise(r => { const p = spawn(process.execPath, ['-e', worker, 'w' + i], { cwd: dir, stdio: 'inherit' }); p.on('close', r); }));
}
await Promise.all(procs);
execFileSync('git', ['fetch', '--no-tags', 'origin', '+refs/tenet/records:refs/tenet/records'], { cwd: path.join(base, 'w1') });
const names = execFileSync('git', ['ls-tree', '--name-only', 'refs/tenet/records'], { cwd: path.join(base, 'w1'), encoding: 'utf8' });
console.log('records present:', names.split('\n').filter(n => n.startsWith('concurrent-')).length, 'of 5');
