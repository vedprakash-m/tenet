import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const terminal = JSON.stringify({
 operationId: 'a'.repeat(32), protocolVersion: 1, versions: { from: 2, to: 1 },
 outcome: 'rolled-back', bindingDigest: 'b'.repeat(64),
});
const snapshot = dir => ({
 mode: lstatSync(dir).mode & 0o777,
 records: readdirSync(dir).sort().filter(name => !name.startsWith('lock')).map(name => {
  const path = join(dir, name);
  return [name, lstatSync(path).mode & 0o777, readFileSync(path).toString('hex')];
 }),
});
export function bridgeUat({ create, call, bundle, source, env, observations }) {
 const root = create(), dir = join(root, '.tenet');
 const h = call(root, 'open', { profile: 'plan', request: 'inspect schema-1 bridge' }).handle;
 assert.equal(typeof h, 'string');
 writeFileSync(join(dir, 'migration-terminal.json'), terminal);
 const admitted = call(root, 'inspect', { h, view: 'status' });
 assert.equal(admitted.exit, 0, JSON.stringify(admitted));
 const config = { h, kind: 'config', target: 'style', propose: { value: 'concise' } };
 for (const raw of [
  terminal.replace('"protocolVersion":1', '"protocolVersion":2'),
  terminal.replace('"from":2', '"from":1,"from":2'),
  terminal.replace('"rolled-back"', '"upgraded"'),
  terminal.replace('"bindingDigest"', '"quote"'),
 ]) {
  writeFileSync(join(dir, 'migration-terminal.json'), raw);
  const before = snapshot(dir);
  for (const result of [call(root, 'inspect', { h, view: 'status' }), call(root, 'decide', config)]) {
   assert.ok(result.reasons.some(reason => reason.code === 'unsupported-record'), JSON.stringify(result));
   assert.deepEqual(snapshot(dir), before);
  }
 }
 writeFileSync(join(dir, 'migration-terminal.json'), terminal);
 for (const fence of ['migration-transition.json', 'migration-privacy.json']) {
  writeFileSync(join(dir, fence), '{}');
  const before = snapshot(dir);
  for (let restart = 0; restart < 2; restart++) {
   assert.ok(call(root, 'decide', config).reasons.some(reason => reason.code === 'unsupported-record'));
   assert.deepEqual(snapshot(dir), before);
  }
  rmSync(join(dir, fence));
 }
 const state = readFileSync(join(dir, 'state'), 'utf8');
 writeFileSync(join(dir, 'state'), state.replace('"schema":1', '"schema":2'));
 const before = snapshot(dir);
 assert.ok(call(root, 'decide', config).reasons.some(reason => reason.code === 'unsupported-record'));
 assert.deepEqual(snapshot(dir), before);
 writeFileSync(join(dir, 'state'), state);
 assert.equal(call(root, 'decide', config).exit, 0);
 assert.equal(readFileSync(join(dir, 'migration-terminal.json'), 'utf8'), terminal);
 observations.push({ scenario: 'built schema-1 bridge refuses invalid terminals, active fences and target schema without mutation', rollbackTerminalPreserved: true });
 for (const point of ['before-terminal', 'after-terminal', 'after-fence-removal']) {
  const scratch = create(), owned = join(scratch, '.tenet');
  const handle = call(scratch, 'open', { profile: 'plan', request: 'bridge interruption' }).handle;
  const input = { ...config, h: handle };
  const killed = spawnSync(process.execPath, [join(source, 'tools/uat/crash-bundle-bridge.mjs'), bundle, point, 'decide'],
   { cwd: scratch, env, input: JSON.stringify(input), encoding: 'utf8', timeout: 15_000 });
  assert.equal(killed.signal, 'SIGKILL', killed.stderr + killed.stdout);
  const protectedBefore = snapshot(owned);
  for (let restart = 0; restart < 2; restart++) {
   const result = call(scratch, 'decide', input);
   if (point === 'after-fence-removal') {
    assert.equal(result.exit, 0, JSON.stringify(result));
    assert.equal(existsSync(join(owned, 'lock')), false);
    assert.equal(readFileSync(join(owned, 'migration-terminal.json'), 'utf8'), terminal);
   } else {
    assert.ok(result.reasons.some(reason => reason.code === 'unsupported-record'), JSON.stringify(result));
    assert.deepEqual(snapshot(owned), protectedBefore);
    assert.equal(existsSync(join(owned, 'lock')), true);
   }
  }
  observations.push({ scenario: 'synthetic terminal publisher interrupted under actual bundle lock', point, restarts: 2, migrationObserved: false });
 }
}
