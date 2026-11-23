import { XMLParser } from 'fast-xml-parser';
import fs from 'node:fs';
const p = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', processEntities: true, isArray: n => ['testsuite','testcase','property'].includes(n) });
function walk(o, out) { if (!o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) { if (k === 'testcase') for (const c of v) out.push(c); else if (Array.isArray(v)) v.forEach(x => walk(x, out)); else if (typeof v === 'object') walk(v, out); } }
const tagRe = /\[(AB-\d+|R-\d+)\]|(?:^|_)tenet_(AB|R)_(\d+)(?=$|[^A-Za-z0-9])/g;
function tags(s) { const t = []; for (const m of s.matchAll(tagRe)) t.push(m[1] ?? `${m[2]}-${m[3]}`); return t; }
for (const f of ['vitest', 'node', 'pytest']) {
  const cases = []; walk(p.parse(fs.readFileSync(`out/${f}.xml`, 'utf8')), cases);
  console.log(`== ${f}: ${cases.length} cases`);
  for (const c of cases) {
    const st = c.failure ? 'fail' : c.error ? 'error' : c.skipped !== undefined ? 'skip' : 'pass';
    const props = (c.properties?.property || []).filter(x => x.name === 'tenet.case').map(x => x.value);
    const full = `${c.classname} > ${c.name}`;
    console.log(` ${st.padEnd(5)} ${JSON.stringify(full).slice(0,90)} tags=${[...tags(full), ...props].join(',')}${c.error ? ' msg=' + String(c.error.message).slice(0,40) : ''}`);
  }
}
const j = JSON.parse(fs.readFileSync('out/jest.json', 'utf8'));
console.log('== jest'); for (const t of j.testResults) { console.log(' file', t.status); for (const a of t.assertionResults) console.log(` ${a.status} ${a.fullName} tags=${tags(a.fullName)} invocations=${a.invocations}`); }
