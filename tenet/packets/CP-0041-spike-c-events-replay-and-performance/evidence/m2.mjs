import fs from 'node:fs';
const strip = s => s.replace(/\[(AB|R)-\d+\]\s*/g, '').replace(/(?:^|_)tenet_(AB|R)_\d+/g, '').trim();
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toRe = t => new RegExp(esc(strip(t)).replace(/%[sdifjop#]/g, '.+').replace(/\\\$\\\{[^}]*\\\}/g, '.+').replace(/\\\$\w+/g, '.+') + '$');
const decl = /(?:^|[^\w$.])(?:it|test)(?:\.each\([^)]*\))?\s*\(\s*(['"`])(.*?)\1/g;
const sets = {
  vitest: { files: ['vt/a.test.js', 'vt/b.test.js', 'vt/c.test.js'], cases: [] },
  node: { files: ['nt/a.test.mjs'], cases: [] },
};
// case names as the readers produce them (classname > name), from parse.mjs output
sets.vitest.cases = ['vt/a.test.js > checkout retry > [AB-1] retries once after a timeout', 'vt/a.test.js > checkout retry > [AB-2] backoff 1', 'vt/a.test.js > checkout retry > [AB-2] backoff 2', 'vt/a.test.js > checkout retry > [AB-2] backoff 3', 'vt/a.test.js > checkout retry > [AB-3] first of two', 'vt/a.test.js > checkout retry > [AB-4] handles <tags> & "quotes"', 'vt/a.test.js > checkout retry > [AB-5] flaky then passes', 'vt/c.test.js > [AB-7] passes before teardown fails'];
sets.node.cases = ['checkout retry > [AB-1] retries once after a timeout', 'checkout retry > [AB-2] backoff 1', 'checkout retry > [AB-2] backoff 2', 'checkout retry > [AB-2] backoff 3', 'checkout retry > [AB-4] handles <tags> & "quotes"', 'checkout retry > [AB-8] skipped'];
for (const [name, set] of Object.entries(sets)) {
  console.log('==', name);
  for (const f of set.files) for (const m of fs.readFileSync(f, 'utf8').matchAll(decl)) {
    if (!/AB-\d/.test(m[2])) continue;
    const n = set.cases.filter(c => toRe(m[2]).test(strip(c))).length;
    console.log(' ', f.padEnd(14), JSON.stringify(m[2]).padEnd(42), 'cases', n);
  }
}
