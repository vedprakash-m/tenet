// Spike C: ALG-05 reduction in every arrival order, and 10,000 event files on Windows.
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function reduce(events) {
  const byId = new Map();
  for (const e of events) {
    const prev = byId.get(e.id);
    if (prev && JSON.stringify(prev) !== JSON.stringify(e)) throw new Error('TN-EV-DUP ' + e.id);
    byId.set(e.id, e);
  }
  const orphans = [...byId.values()].filter(e => e.prev.some(p => !byId.has(p)));
  const ok = [...byId.values()].filter(e => !orphans.includes(e));
  // ancestors
  const anc = new Map();
  const ancestors = id => { if (anc.has(id)) return anc.get(id); const s = new Set(); for (const p of byId.get(id).prev) { s.add(p); for (const a of ancestors(p)) s.add(a); } anc.set(id, s); return s; };
  // topological order, ties by id (Kahn with sorted ready set)
  const indeg = new Map(ok.map(e => [e.id, e.prev.length])), kids = new Map();
  for (const e of ok) for (const p of e.prev) (kids.get(p) ?? kids.set(p, []).get(p)).push(e.id);
  const ready = ok.filter(e => e.prev.length === 0).map(e => e.id).sort(), order = [];
  while (ready.length) { const id = ready.shift(); order.push(id); for (const k of kids.get(id) ?? []) { indeg.set(k, indeg.get(k) - 1); if (indeg.get(k) === 0) { ready.push(k); ready.sort(); } } }
  let state = { station: null, status: null }, conflict = null;
  const lastState = {};
  for (const id of order) {
    const e = byId.get(id);
    if (e.type === 'resolve') { state[e.field] = e.keep; conflict = null; lastState[e.field] = id; continue; }
    const f = e.type === 'work.moved' ? 'station' : 'status';
    const other = lastState[f];
    if (other && !ancestors(id).has(other) && byId.get(other).value !== e.value) conflict = { field: f, heads: [other, id].sort() };
    else state[f] = e.value;
    lastState[f] = id;
  }
  return JSON.stringify({ state, conflict, orphans: orphans.map(o => o.id).sort() });
}

// 1. arrival-order independence on a branching history with a conflict and a resolve
const ev = [
  { id: 'A', prev: [], type: 'work.moved', value: 'define' },
  { id: 'B', prev: ['A'], type: 'work.moved', value: 'build' },
  { id: 'C', prev: ['A'], type: 'work.moved', value: 'verify' },
  { id: 'D', prev: ['A'], type: 'work.status', value: 'blocked' },
  { id: 'E', prev: ['Z'], type: 'work.status', value: 'active' },
];
const shuffles = new Set();
for (let i = 0; i < 2000; i++) shuffles.add(reduce([...ev].sort(() => Math.random() - 0.5)));
console.log('conflict case: distinct results over 2000 shuffles =', shuffles.size, [...shuffles][0]);
const ev2 = [...ev, { id: 'F', prev: ['B', 'C'], type: 'resolve', field: 'station', keep: 'build' }];
const s2 = new Set(); for (let i = 0; i < 2000; i++) s2.add(reduce([...ev2, ev2[5]].sort(() => Math.random() - 0.5)));
console.log('resolved case (resolve delivered twice): distinct =', s2.size, [...s2][0]);

// 2. 10,000 event files across 500 work items
const root = path.resolve('events'); await fs.rm(root, { recursive: true, force: true });
let t = Date.now();
for (let w = 0; w < 500; w++) {
  const dir = path.join(root, `w${w}`); fss.mkdirSync(dir, { recursive: true });
  let prev = [];
  for (let i = 0; i < 20; i++) { const id = `${w}-${String(i).padStart(3, '0')}`; fss.writeFileSync(path.join(dir, id + '.json'), JSON.stringify({ id, prev, type: i % 2 ? 'work.status' : 'work.moved', value: 'v' + i, data: crypto.randomBytes(64).toString('hex') })); prev = [id]; }
}
console.log('write 10,000 files ms', Date.now() - t);
async function readAll(limit) {
  const dirs = await fs.readdir(root); const out = [];
  const files = []; for (const d of dirs) for (const f of await fs.readdir(path.join(root, d))) files.push(path.join(root, d, f));
  let i = 0; await Promise.all(Array.from({ length: limit }, async () => { while (i < files.length) { const f = files[i++]; out.push(JSON.parse(await fs.readFile(f, 'utf8'))); } }));
  return out;
}
for (const run of ['first', 'second', 'third']) {
  t = Date.now(); const all = await readAll(32); const tRead = Date.now() - t;
  const byWork = new Map(); for (const e of all) { const w = e.id.split('-')[0]; (byWork.get(w) ?? byWork.set(w, []).get(w)).push(e); }
  t = Date.now(); for (const es of byWork.values()) reduce(es); const tReduce = Date.now() - t;
  console.log(`${run} pass: read ${all.length} files ${tRead} ms, reduce ${byWork.size} work items ${tReduce} ms`);
}
