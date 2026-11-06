// Supplemental deterministic property checks. This is audit evidence, not qualification or a timing benchmark.
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { diffPnpmLock } from '../../../packages/kernel/src/core/dependencies.ts';
const versions = fc.uniqueArray(fc.integer({ min: 1, max: 5 }), { maxLength: 5 });
const input = fc.record({ beforeA: versions, afterA: versions, beforeB: versions, afterB: versions });
const records = (a, b) => [['fixture', 1], ...a.map(v => ['a', v]), ...b.map(v => ['@scope/b', v])];
const text = entries => "lockfileVersion: '9.0'\npackages:\n" + entries.map(([name, version]) =>
  `  '${name}@${version}.0.0':\n    resolution: {integrity: sha512-fixture}\n`).join('');
const canonical = d => JSON.stringify({
  added: [...d.added].sort((a, b) => a.key.localeCompare(b.key)),
  changed: [...d.changed].sort((a, b) => a.key.localeCompare(b.key)), removed: d.removed,
});
const seed = 20261105, numRuns = 500;
fc.assert(fc.property(input, data => {
  const before = records(data.beforeA, data.beforeB), after = records(data.afterA, data.afterB);
  const d = diffPnpmLock(text(before), text(after));
  assert.equal(canonical(d), canonical(diffPnpmLock(text([...before].reverse()), text([...after].reverse()))));
  const beforeKeys = new Set(before.map(([n, v]) => `${n}@${v}.0.0`));
  const afterKeys = new Set(after.map(([n, v]) => `${n}@${v}.0.0`));
  for (const o of d.changed) {
    assert.ok(beforeKeys.has(`${o.name}@${o.previous}`));
    assert.equal(afterKeys.has(`${o.name}@${o.previous}`), false, 'a retained version is not an upgrade predecessor');
  }
  for (const name of d.removed) assert.equal(after.some(([n]) => n === name), false);
  const novel = [...afterKeys].filter(key => !beforeKeys.has(key)).sort();
  assert.deepEqual([...d.added, ...d.changed].map(o => o.key).sort(), novel, 'every new version is accounted for exactly once');
}), { seed, numRuns });
console.log(JSON.stringify({ seed, numRuns, properties: [
  'order-independent normalized diff', 'no retained predecessor', 'no false package removal', 'complete unique new-version population',
], passed: true }));
