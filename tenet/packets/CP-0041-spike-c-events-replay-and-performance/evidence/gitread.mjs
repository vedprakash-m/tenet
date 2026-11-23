// Read 10,000 committed event files through one `git cat-file --batch` process.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
const cwd = 'events';
if (!fs.existsSync(cwd + '/.git')) {
  execFileSync('git', ['init', '-q'], { cwd });
  execFileSync('git', ['add', '-A'], { cwd });
  execFileSync('git', ['-c', 'user.name=s', '-c', 'user.email=s@x', 'commit', '-qm', 'events'], { cwd });
}
for (const run of ['first', 'second']) {
  const t = Date.now();
  const list = execFileSync('git', ['ls-tree', '-r', '-z', 'HEAD'], { cwd, maxBuffer: 1 << 28 }).toString().split('\0').filter(Boolean).map(l => l.split('\t')[0].split(' ')[2]);
  const tList = Date.now() - t;
  const p = spawn('git', ['cat-file', '--batch'], { cwd });
  const chunks = []; p.stdout.on('data', c => chunks.push(c));
  p.stdin.end(list.join('\n') + '\n');
  await new Promise(r => p.on('close', r));
  const buf = Buffer.concat(chunks); let i = 0, n = 0;
  while (i < buf.length) { const nl = buf.indexOf(10, i); const size = +buf.toString('utf8', i, nl).split(' ')[2]; JSON.parse(buf.toString('utf8', nl + 1, nl + 1 + size)); n++; i = nl + 1 + size + 1; }
  console.log(`${run}: ls-tree ${tList} ms, total ${Date.now() - t} ms for ${n} events`);
}
