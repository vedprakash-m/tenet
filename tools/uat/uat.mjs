import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { chmodSync, closeSync, cpSync, ftruncateSync, lstatSync, mkdtempSync, mkdirSync, openSync, statSync, writeFileSync, symlinkSync, readFileSync, rmSync, readdirSync, existsSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const source = fileURLToPath(new URL('../../', import.meta.url));
const bundle = join(source, 'plugin/kernel/tenet.mjs');
const roots = [];
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
delete env.NODE_OPTIONS;
const git = (root, ...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' }).trim();
const write = (root, path, text) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), text); };
const create = () => {
 const root = mkdtempSync(join(tmpdir(), 'tenet-c0-uat-')); roots.push(root);
 git(root, 'init', '-q', '-b', 'main');
 git(root, 'config', 'user.name', 'Test'); git(root, 'config', 'user.email', 'test@example.com'); git(root, 'config', 'commit.gpgsign', 'false');
 write(root, 'package.json', '{"name":"uat","type":"module","private":true}\n');
 write(root, 'tsconfig.json', '{"compilerOptions":{"strict":true}}\n'); write(root, '.gitignore', 'node_modules\n.tenet/\n');
 write(root, 'src/greet.ts', 'export const greet = (_name: string): string => "";\n');
 symlinkSync(join(source, 'node_modules'), join(root, 'node_modules'));
 git(root, 'add', '-A'); git(root, 'commit', '-qm', 'initial'); return root;
};
const call = (root, verb, body = {}, flags = [], consentEnvelope = true) => {
 const readsBody = ['open', 'decide', 'findings'].includes(verb);
 const args = readsBody ? flags : [...Object.entries(body).flatMap(([key, value]) => [`--${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`, typeof value === 'object' ? JSON.stringify(value) : String(value)]), ...flags];
 const result = spawnSync(process.execPath, [bundle, verb, ...args], { cwd: root, env, input: readsBody ? JSON.stringify(body) : '', encoding: 'utf8' });
 assert.equal(result.signal, null, result.stderr);
    const response = JSON.parse(result.stdout); assert.equal(result.status, response.exit);
    if (consentEnvelope && verb === 'check' && response.questions?.some(question => question.id === 'envelope-consent')) {
        const h = body.h ?? flags.find(flag => flag.startsWith('--h='))?.slice(4);
        assert.equal(typeof h, 'string', 'check consent needs its handle');
        const consent = call(root, 'decide', { h, kind: 'envelope-consent', answers: { 'envelope-consent': 'allow-envelope' } });
        assert.equal(consent.exit, 0, JSON.stringify(consent));
        return call(root, verb, body, flags);
    }
    return response;
};
const focused = (root, h, response) => {
 const rv = response.data.review;
 assert.equal(rv.dispatchMode, 'same-session');
 const manifest = JSON.parse(readFileSync(rv.manifest, 'utf8'));
 assert.ok(Array.isArray(manifest.rubric));
 assert.ok(manifest.rubric.every(part => typeof part === 'string' && JSON.stringify(part).length < 1500));
 assert.match(manifest.rubric.join(''), /Stage A|basis/);
 assert.equal(manifest.exclusions.mechanism, 'cooperative');
 assert.ok(new RegExp(manifest.exclusions.defaults.kernelOnly).test('.tenet/state'));
 assert.ok(manifest.exclusions.defaults.secretPatterns.some(pattern => new RegExp(pattern).test('.env.local')));
 assert.equal(typeof manifest.resultGuidance.sampledItem.semantic, 'boolean');
 assert.equal(typeof manifest.resultGuidance.sampledItem.callers, 'number');
 assert.match(manifest.resultGuidance.sampled, /empty|\[\]/i);
 assert.match(manifest.resultGuidance.openDependencies, /plain strings/);
 assert.equal(typeof manifest.resultGuidance.openDependencyItem, 'string');
 for (const path of manifest.investigation) readFileSync(join(root, path), 'utf8');
 const r = call(root, 'findings', { h, result: { kind: 'review', manifest: rv.hash, reservation: rv.reservation, attempt: rv.attempt, mode: rv.mode, status: 'completed', dispatchMode: 'same-session', axes: { behavior: 'pass', structure: 'pass' }, coverage: { inspected: rv.files, uncovered: [], crossCutting: 'greeting test imports the implementation; unrelated human file remains outside this work', sampled: [] }, attention: [], findings: [], basisGaps: [], openDependencies: [] } });
 assert.equal(r.exit, 0, JSON.stringify(r)); assert.equal(r.budget.delegations, '0/2');
 return manifest;
};
const basis = { outcome: 'Return a greeting', scopePaths: ['src/'], elements: [
 { ref: 'r', kind: 'requirement', origin: 'request', text: 'greet returns Hello, Ada!' },
 { ref: 'e', kind: 'example', origin: 'request', of: 'r', text: 'greet Ada', testFile: 'src/greet.test.ts', test: 'distinguishing', expect: 'fail' }
] };
const observations = [];
const staticCandidate = (root, request) => {
 const h = call(root, 'open', { profile: 'feature', request, lane: 'quick' }).handle;
 assert.equal(call(root, 'decide', { h, kind: 'basis', propose: basis }).exit, 0);
 write(root, 'src/greet.test.ts', 'import { expect, it } from "vitest"; import { greet } from "./greet.ts"; it("greets", () => expect(greet("Ada")).toBe("Hello, Ada!"));\n');
 assert.equal(call(root, 'check', { h, stage: 'baseline' }).data.receipts[0].status, 'fail');
 write(root, 'src/greet.ts', 'export const greet = (name: string): string => `Hello, ${name}!`;\n');
 const checked = call(root, 'check', { h, stage: 'candidate' }, ['--touched=src/greet.ts']);
 const w = Object.values(JSON.parse(readFileSync(join(root, '.tenet/state'), 'utf8')).work)[0];
 return { h, checked, receipt: w.receipts.find(r => r.obligation === 'OB-types') };
};
const waitUntil = async (fn, what) => {
 const end = Date.now() + 15000;
 for (;;) { const found = fn(); if (found) return found; assert.ok(Date.now() < end, `timed out: ${what}`); await new Promise(r => setTimeout(r, 25)); }
};
try {
 for (const point of ['normal', 'after-intent', 'after-purge', 'after-first', 'after-second', 'after-result']) {
  const forgetting = create(), text = 'UAT-ORCHID-lesson-96341', quote = 'UAT-ORCHID-quote-25739';
  const h = call(forgetting, 'open', { profile: 'plan', request: 'forget a project convention safely' }).handle;
  const id = call(forgetting, 'decide', { h, kind: 'lesson', quote, propose: { statement: text } }).data.id;
  const packet = call(forgetting, 'packet', { h, role: 'analyst', analystRole: 'researcher', question: 'inspect project conventions' }).data.analyst.manifest;
  const base = join(packet, '../..'); roots.push(base);
  assert.ok(readFileSync(packet, 'utf8').includes(text));
  const input = { h, kind: 'forget', target: id, answers: { 'forget-confirm': 'yes' } };
  if (point === 'normal') {
   const dir = join(forgetting, '.tenet'); chmodSync(dir, 0o755);
   for (const name of ['marker', 'state', 'state.prev', 'log']) if (existsSync(join(dir, name))) chmodSync(join(dir, name), 0o644);
   rmSync(join(dir, '.gitignore'));
   const result = call(forgetting, 'decide', input);
   assert.equal(result.exit, 0, JSON.stringify(result));
   assert.equal(statSync(dir).mode & 0o777, 0o700);
   assert.equal(readFileSync(join(dir, '.gitignore'), 'utf8'), '*\n');
   for (const name of ['marker', 'state', 'state.prev', 'log']) assert.equal(statSync(join(dir, name)).mode & 0o777, 0o600);
  } else {
   const killed = spawnSync(process.execPath, [join(source, 'tools/uat/crash-bundle-forget.mjs'), bundle, point, 'decide'], { cwd: forgetting, env, input: JSON.stringify(input), encoding: 'utf8' });
   assert.equal(killed.signal, 'SIGKILL', killed.stderr + killed.stdout);
  }
  const result = call(forgetting, 'decide', { h, kind: 'config', target: 'style', propose: { value: 'concise' } });
  assert.equal(result.exit, 0, JSON.stringify(result));
  if (point !== 'normal' && point !== 'after-result') assert.ok(result.effects.completed.includes('an interrupted forget was finished'));
  const state = JSON.parse(readFileSync(join(forgetting, '.tenet/state'), 'utf8'));
  assert.equal(result.revision, state.revision);
  assert.equal(Object.values(state.work)[0].session.last.response.revision, state.revision);
  const records = readFileSync(join(forgetting, '.tenet/log'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.equal(records.filter(e => e.kind === 'call').at(-1).revision, state.revision);
  assert.deepEqual(records.filter(e => e.effect === 'forget').map(e => e.kind), ['intent', 'result']);
  const walk = dir => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]) : [];
  for (const path of [...walk(join(forgetting, '.tenet')), ...walk(base)]) {
   const bytes = readFileSync(path, 'utf8'); assert.equal(bytes.includes(text) || bytes.includes(quote), false, path);
  }
  assert.equal(call(forgetting, 'decide', { ...input, again: true }).exit, 2);
  observations.push({ scenario: `built crash-safe forget ${point}`, killedAtBoundary: point !== 'normal', packetsAndBackupPurged: true, revisionMatchesDisk: true });
 }
 for (const outputs of [['coverage/**'], []]) {
  const definition = create(), initialOutputs = outputs.length ? [] : ['coverage/**'];
  const h = call(definition, 'open', { profile: 'feature', request: 'refine declared check outputs', lane: 'quick' }).handle;
  const proposed = { ...basis, elements: basis.elements.map(e => e.kind === 'example' ? { ...e, outputs: initialOutputs } : e) };
  const first = call(definition, 'decide', { h, kind: 'basis', propose: proposed });
  assert.equal(first.exit, 0, JSON.stringify(first));
  write(definition, 'src/greet.test.ts', 'import {expect,it} from "vitest";import {greet} from "./greet.ts";it("greets",()=>expect(greet("Ada")).toBe("Hello, Ada!"));\n');
  assert.equal(call(definition, 'check', { h, stage: 'baseline' }).data.receipts[0].status, 'fail');
  const refined = { ...proposed, elements: proposed.elements.map(e => ({ ...e, ref: first.data.ids[e.ref], ...(e.of ? { of: first.data.ids[e.of] } : {}), ...(e.kind === 'example' ? { outputs } : {}) })) };
  assert.equal(call(definition, 'decide', { h, kind: 'basis', propose: refined }).exit, 0);
  write(definition, 'src/greet.ts', 'export const greet=(name:string):string=>`Hello, ${name}!`;\n');
  call(definition, 'check', { h, stage: 'candidate' }, ['--touched=src/greet.ts']);
  const why = call(definition, 'inspect', { h, view: 'why' });
  assert.notEqual(why.data.endpoint, 'checked-local');
  assert.ok(why.reasons.some(r => r.code === 'no-distinguishing-red'), JSON.stringify(why));
  let state = JSON.parse(readFileSync(join(definition, '.tenet/state'), 'utf8'));
  assert.equal(state.locks.some(l => l.path === 'src/greet.test.ts'), false);
  write(definition, 'src/greet.ts', 'export const greet = (_name: string): string => "";\n');
  const freshRed = call(definition, 'check', { h, stage: 'baseline' }, ['--again']);
  assert.equal(freshRed.next[0]?.action, 'implement', JSON.stringify(freshRed));
  write(definition, 'src/greet.ts', 'export const greet=(name:string):string=>`Hello, ${name}!`;\n');
  const fresh = call(definition, 'check', { h, stage: 'candidate' }, ['--touched=src/greet.ts', '--again']);
  assert.equal(fresh.data.receipts[0].status, 'pass');
  state = JSON.parse(readFileSync(join(definition, '.tenet/state'), 'utf8'));
  assert.ok(state.locks.some(l => l.path === 'src/greet.test.ts'));
  observations.push({ scenario: `built output declaration ${outputs.length ? 'addition' : 'removal'} invalidates red`, oldRedRejected: true, freshRedRestoresLocks: true });
 }
 for (const failure of ['unreadable-file', 'unreadable-directory', 'unwritable-directory', 'oversized-file', 'invalid-utf8']) {
  const forgetting = create(), text = 'UAT-IRIS-lesson-48261';
  const h = call(forgetting, 'open', { profile: 'plan', request: 'refuse incomplete forgetting' }).handle;
  const id = call(forgetting, 'decide', { h, kind: 'lesson', quote: 'UAT-IRIS-quote-58316', propose: { statement: text } }).data.id;
  const packet = call(forgetting, 'packet', { h, role: 'analyst', analystRole: 'researcher', question: 'inspect project conventions' }).data.analyst.manifest;
  const manifests = join(packet, '..'), base = join(manifests, '..'); roots.push(base);
  const original = readFileSync(packet), before = readFileSync(join(forgetting, '.tenet/state'));
  try {
   if (failure === 'unreadable-file') chmodSync(packet, 0o000);
   else if (failure === 'unreadable-directory') chmodSync(manifests, 0o000);
   else if (failure === 'unwritable-directory') chmodSync(manifests, 0o500);
   else if (failure === 'invalid-utf8') writeFileSync(packet, Buffer.concat([original, Buffer.from([0xff])]));
   else { const fd = openSync(packet, 'r+'); try { ftruncateSync(fd, 50 * 1024 * 1024 + 1); } finally { closeSync(fd); } }
   const refused = call(forgetting, 'decide', { h, kind: 'forget', target: id, answers: { 'forget-confirm': 'yes' } });
   assert.notEqual(refused.exit, 0, JSON.stringify(refused));
   assert.deepEqual(readFileSync(join(forgetting, '.tenet/state')), before);
   const log = readFileSync(join(forgetting, '.tenet/log'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
   assert.deepEqual(log.filter(e => e.effect === 'forget').map(e => e.kind), ['intent']);
  } finally {
   chmodSync(manifests, 0o700); if (existsSync(packet)) { chmodSync(packet, 0o600); writeFileSync(packet, original); }
  }
  assert.equal(call(forgetting, 'decide', { h, kind: 'config', target: 'style', propose: { value: 'concise' } }).exit, 0);
  assert.equal(existsSync(packet), false);
  assert.equal(readFileSync(join(forgetting, '.tenet/state.prev'), 'utf8').includes(text), false);
  observations.push({ scenario: `built forget refuses ${failure}`, lessonRetainedUntilRepair: true, intentRecoversOnce: true });
 }
 {
  const uncertain = create(), h = call(uncertain, 'open', { profile: 'plan', request: 'recover before refusing' }).handle;
  const id = call(uncertain, 'decide', { h, kind: 'lesson', quote: 'UAT-ASTER-quote-19452', propose: { statement: 'UAT-ASTER-lesson-83194' } }).data.id;
  const killed = spawnSync(process.execPath, [join(source, 'tools/uat/crash-bundle-forget.mjs'), bundle, 'after-intent', 'decide'], { cwd: uncertain, env, input: JSON.stringify({ h, kind: 'forget', target: id, answers: { 'forget-confirm': 'yes' } }), encoding: 'utf8' });
  assert.equal(killed.signal, 'SIGKILL', killed.stderr + killed.stdout);
  const state = JSON.parse(readFileSync(join(uncertain, '.tenet/state'), 'utf8'));
  writeFileSync(join(uncertain, '.tenet/log'), JSON.stringify({ t: new Date().toISOString(), kind: 'intent', effect: 'unrecognized-effect', id: 'uncertain-one', op: { work: Object.keys(state.work)[0] } }) + '\n', { flag: 'a' });
  const r = call(uncertain, 'decide', { h, kind: 'config', target: 'style', propose: { value: 'concise' } });
  assert.equal(r.exit, 2); assert.ok(r.effects.completed.includes('an interrupted forget was finished'));
  assert.ok(r.effects.uncertain.some(x => x.includes('unrecognized-effect')));
  assert.equal(r.revision, JSON.parse(readFileSync(join(uncertain, '.tenet/state'), 'utf8')).revision);
  observations.push({ scenario: 'built recovery refusal uses actual published revision', realForgetKill: true, syntheticUnknownIntent: true, uncertaintyPreserved: true });
 }
 const helpRoot = create();
 const helpCommands = [
  ['open', ['investigate', '--help']], ['decide', ['config', '--help']],
  ['finish', ['--help']], ['stop', ['abandon', '--help']],
 ];
 for (const [verb, flags] of helpCommands) {
  const response = call(helpRoot, verb, {}, flags);
  assert.equal(response.exit, 0, JSON.stringify(response));
  assert.equal(response.verb, 'inspect'); assert.equal(response.handle, undefined);
  assert.equal(existsSync(join(helpRoot, '.tenet')), false);
 }
 assert.equal(git(helpRoot, 'status', '--porcelain'), '');
 observations.push({ scenario: 'built mutating-subcommand help is stateless', commands: helpCommands.length, stateCreated: false, gitUnchanged: true });
 for (const verb of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
  const response = call(helpRoot, verb);
  assert.equal(response.exit, 1, JSON.stringify(response));
  assert.equal(response.reasons[0].code, 'unknown-verb');
  assert.equal(existsSync(join(helpRoot, '.tenet')), false);
 }
 observations.push({ scenario: 'built inherited verb names produce structured usage errors without state', commands: 4 });
 const privacyRoot = create();
 const privacyHandle = call(privacyRoot, 'open', { profile: 'plan', request: 'record a local storage choice' }).handle;
 const privateFiles = () => readdirSync(join(privacyRoot, '.tenet')).sort().map(name => [name, readFileSync(join(privacyRoot, '.tenet', name))]);
 const privateBefore = privateFiles();
 const syntheticCredential = ['ghp_', 'a'.repeat(36)].join('');
 const refusedProposal = call(privacyRoot, 'decide', { h: privacyHandle, kind: 'decision-record', quote: 'Use SQLite',
  propose: { title: 'Store locally', context: `Accidentally pasted: ${syntheticCredential}`, decision: 'Use SQLite' } });
 assert.equal(refusedProposal.exit, 1, JSON.stringify(refusedProposal));
 assert.equal(refusedProposal.reasons[0].code, 'invalid-input');
 assert.equal(JSON.stringify(refusedProposal).includes(syntheticCredential), false);
 assert.deepEqual(privateFiles(), privateBefore);
 observations.push({ scenario: 'built secret-bearing proposal refuses before state, backup or journal writes' });
 const playwrightInputs = create();
 rmSync(join(playwrightInputs, 'node_modules')); mkdirSync(join(playwrightInputs, 'node_modules'));
 symlinkSync(join(source, 'node_modules/vitest'), join(playwrightInputs, 'node_modules/vitest'));
 write(playwrightInputs, 'node_modules/@playwright/test/package.json', '{"version":"1.64.1"}');
 write(playwrightInputs, '.gitignore', 'node_modules\n.tenet/\nplaywright.config.*\n');
 const pwCandidate = staticCandidate(playwrightInputs, 'retain exact Playwright evidence inputs');
 focused(playwrightInputs, pwCandidate.h, pwCandidate.checked);
 assert.equal(call(playwrightInputs, 'inspect', { h: pwCandidate.h, view: 'why' }).data.endpoint, 'checked-local');
 const pwStatus = git(playwrightInputs, 'status', '--porcelain');
 write(playwrightInputs, 'node_modules/@playwright/test/package.json', '{"version":"1.64.2"}');
 assert.equal(git(playwrightInputs, 'status', '--porcelain'), pwStatus);
 assert.ok(call(playwrightInputs, 'inspect', { h: pwCandidate.h, view: 'why' }).reasons.some(r => r.code === 'stale'));
 observations.push({ scenario: 'built installed Playwright version change stales passing evidence without a Git change' });
 const pwRefresh = call(playwrightInputs, 'check', { h: pwCandidate.h, stage: 'candidate' });
 assert.equal(pwRefresh.exit, 0, JSON.stringify(pwRefresh));
 assert.equal(call(playwrightInputs, 'inspect', { h: pwCandidate.h, view: 'why' }).data.endpoint, 'checked-local');
 write(playwrightInputs, 'playwright.config.ts', 'export default { retries: 2 };\n');
 assert.equal(git(playwrightInputs, 'status', '--porcelain'), pwStatus);
 const pwStale = call(playwrightInputs, 'inspect', { h: pwCandidate.h, view: 'why' });
 assert.ok(pwStale.reasons.some(r => r.code === 'stale'), JSON.stringify(pwStale));
 assert.ok(pwStale.reasons.some(r => r.code === 'red-invalidated'), JSON.stringify(pwStale));
 observations.push({ scenario: 'built ignored Playwright configuration invalidates receipts and baseline proof' });
 for (const blocker of ['state', 'state.prev', 'marker', 'migration-transition.json', 'migration-privacy.json', 'oversized-state']) {
  const compatibilityRoot = create();
  call(compatibilityRoot, 'open', { profile: 'investigate', request: 'initialize compatibility fixture' });
  call(compatibilityRoot, 'open', { profile: 'plan', request: 'retain a compatible previous state' });
  write(compatibilityRoot, 'human.txt', 'human compatibility canary\n');
  const dead = JSON.stringify({ pid: 2 ** 22 + 5, procStart: 'Thu Jan  1 00:00:00 1970', nonce: 'dead', verb: 'old' });
  write(compatibilityRoot, '.tenet/lock', dead); write(compatibilityRoot, '.tenet/lock.break', dead);
  const log = join(compatibilityRoot, '.tenet/log');
  writeFileSync(log, `${readFileSync(log, 'utf8')}{torn`);
  const target = join(compatibilityRoot, '.tenet', blocker === 'oversized-state' ? 'state' : blocker);
  const content = blocker.endsWith('.json') ? '{' : JSON.stringify({ ...JSON.parse(readFileSync(target, 'utf8')), schema: 2 });
  writeFileSync(target, content + (blocker === 'oversized-state' ? ' '.repeat(50 * 1024 * 1024) : ''));
  chmodSync(join(compatibilityRoot, '.tenet'), 0o750);
  chmodSync(join(compatibilityRoot, '.tenet/state'), 0o640);
  const names = ['marker', 'state', 'state.prev', 'log', 'lock', 'lock.break', ...(blocker.endsWith('.json') ? [blocker] : [])];
  const before = names.map(name => ({ name, bytes: readFileSync(join(compatibilityRoot, '.tenet', name)), mode: statSync(join(compatibilityRoot, '.tenet', name)).mode }));
  const humanStatus = git(compatibilityRoot, 'status', '--porcelain');
  const index = readFileSync(join(compatibilityRoot, '.git/index'));
  for (const [verb, body] of [['open', { profile: 'investigate', request: 'refuse incompatible state before mutation' }], ['decide', { kind: 'repair-lock' }]]) {
   const response = call(compatibilityRoot, verb, body);
   assert.equal(response.exit, 4, JSON.stringify(response));
   assert.ok(response.reasons.some(reason => reason.code === 'unsupported-record'));
   assert.equal(response.handle, undefined);
  }
  for (const entry of before) {
   assert.deepEqual(readFileSync(join(compatibilityRoot, '.tenet', entry.name)), entry.bytes);
   assert.equal(statSync(join(compatibilityRoot, '.tenet', entry.name)).mode, entry.mode);
  }
  assert.equal(statSync(join(compatibilityRoot, '.tenet')).mode & 0o777, 0o750);
  assert.deepEqual(readFileSync(join(compatibilityRoot, '.git/index')), index);
  assert.equal(readFileSync(join(compatibilityRoot, 'human.txt'), 'utf8'), 'human compatibility canary\n');
  assert.equal(git(compatibilityRoot, 'status', '--porcelain'), humanStatus);
  assert.equal(call(compatibilityRoot, 'inspect', { view: 'help' }).exit, 0);
  observations.push({ scenario: `built compatibility admission preserves ${blocker}`, exit: 4,
   stateBytesPreserved: true, modesPreserved: true, locksPreserved: true, humanIndexPreserved: true, fallbackHandleIssued: false });
 }
 const reviewBounds = create();
 write(reviewBounds, 'src/small.ts', 'export const small = true;\n');
 const smallReview = call(reviewBounds, 'review');
 assert.equal(smallReview.exit, 0, JSON.stringify(smallReview));
 assert.ok(smallReview.data.tokens <= 20000);
 for (let index = 0; index < 1000; index++) write(reviewBounds, `src/component-${index}.ts`, `export const component${index} = true;\n`);
 const reviewStatus = git(reviewBounds, 'status', '--porcelain');
 const largeReview = call(reviewBounds, 'review');
 assert.equal(largeReview.exit, 2, JSON.stringify(largeReview));
 assert.ok(largeReview.reasons.some(reason => reason.code === 'narrow-increment'));
 assert.equal(largeReview.data?.manifest, undefined);
 assert.equal(existsSync(join(reviewBounds, '.tenet')), false);
 assert.equal(git(reviewBounds, 'status', '--porcelain'), reviewStatus);
 observations.push({ scenario: 'built stateless review refuses oversized complete packets', smallAccepted: true, oversizedExit: 2, stateCreated: false, sourceUnchanged: true });
 const versionRepeat = create();
 const repeatInput = { profile: 'plan', request: 'repeat the same version-pinned plan' };
 call(versionRepeat, 'open', repeatInput);
 const versionStatePath = join(versionRepeat, '.tenet/state');
 const versionState = JSON.parse(readFileSync(versionStatePath, 'utf8'));
 const pinnedWork = Object.values(versionState.work)[0];
 pinnedWork.pinned.adapter = 'node-ts@0';
 writeFileSync(versionStatePath, JSON.stringify(versionState));
 const versionQuestion = call(versionRepeat, 'open', repeatInput);
 assert.equal(versionQuestion.exit, 3, JSON.stringify(versionQuestion));
 assert.ok(versionQuestion.questions.some(question => question.id === 'version-reconcile'));
 const afterRepeat = JSON.parse(readFileSync(versionStatePath, 'utf8'));
 assert.equal(Object.keys(afterRepeat.work).length, 1);
 assert.equal(afterRepeat.generationSeq, versionState.generationSeq);
 assert.equal(Object.values(afterRepeat.work)[0].pinned.adapter, 'node-ts@0');
 observations.push({ scenario: 'built repeated open surfaces synthetic pinned adapter drift', exit: 3, workDuplicated: false, generationUnchanged: true, automaticallyRepinned: false });
 const corruptJournal = create();
 call(corruptJournal, 'open', { profile: 'investigate', request: 'preserve corrupt journal evidence' });
 const journalPath = join(corruptJournal, '.tenet/log');
 const journalState = readFileSync(join(corruptJournal, '.tenet/state'));
 const corruptBytes = `${readFileSync(journalPath, 'utf8')}null\n`;
 writeFileSync(journalPath, corruptBytes);
 const journalRefusal = call(corruptJournal, 'open', { profile: 'investigate', request: 'do not skip corrupt records' });
 assert.equal(journalRefusal.exit, 4, JSON.stringify(journalRefusal));
 assert.ok(journalRefusal.reasons.some(reason => reason.code === 'unsupported-record'));
 assert.deepEqual(readFileSync(join(corruptJournal, '.tenet/state')), journalState);
 assert.equal(readFileSync(journalPath, 'utf8'), corruptBytes);
 assert.equal(existsSync(join(corruptJournal, '.tenet/lock')), false);
 observations.push({ scenario: 'built corrupt journal refuses without erasing evidence', exit: 4, statePreserved: true, journalPreserved: true });
 const boundedJournal = create();
 call(boundedJournal, 'open', { profile: 'investigate', request: 'bound private journal reads' });
 const boundedState = readFileSync(join(boundedJournal, '.tenet/state'));
 const oversizedPath = join(boundedJournal, '.tenet/log'), descriptor = openSync(oversizedPath, 'w');
 try { ftruncateSync(descriptor, 50 * 1024 * 1024 + 1); }
 finally { closeSync(descriptor); }
 write(boundedJournal, 'human.txt', 'preserve human content\n');
 const boundedRefusal = call(boundedJournal, 'open', { profile: 'investigate', request: 'do not repair an oversized journal' });
 assert.equal(boundedRefusal.exit, 4, JSON.stringify(boundedRefusal));
 assert.ok(boundedRefusal.reasons.some(reason => reason.code === 'unsupported-record'));
 assert.deepEqual(readFileSync(join(boundedJournal, '.tenet/state')), boundedState);
 assert.equal(statSync(oversizedPath).size, 50 * 1024 * 1024 + 1);
 assert.equal(readFileSync(join(boundedJournal, 'human.txt'), 'utf8'), 'preserve human content\n');
 assert.equal(existsSync(join(boundedJournal, '.tenet/lock')), false);
 observations.push({ scenario: 'built oversized journal refuses before repair', exit: 4, statePreserved: true, journalPreserved: true, humanContentPreserved: true });
 for (const group of ['', 'manifests', 'review']) {
  const sweepRoot = create(), outside = create();
  call(sweepRoot, 'open', { profile: 'investigate', request: 'initialize cleanup boundary' });
  const workspaceId = JSON.parse(readFileSync(join(sweepRoot, '.tenet/state'), 'utf8')).workspaceId;
  const base = join(tmpdir(), `tenet-${workspaceId}`), human = join(outside, 'run-human');
  mkdirSync(human); writeFileSync(join(human, 'notes.txt'), 'preserve human work'); utimesSync(human, 1, 1);
  if (group) mkdirSync(base, { recursive: true });
  symlinkSync(outside, group ? join(base, group) : base);
  try {
   const response = call(sweepRoot, 'open', { profile: 'investigate', request: 'preserve work outside cleanup storage' });
   assert.equal(response.exit, 0, JSON.stringify(response));
   assert.equal(readFileSync(join(human, 'notes.txt'), 'utf8'), 'preserve human work');
  } finally { rmSync(base, { recursive: true, force: true }); }
 }
 observations.push({ scenario: 'built open cleanup never follows linked private temp storage', boundaries: ['workspace', 'manifests', 'review'], humanContentPreserved: true });
 for (const replacedHistory of [false, true]) {
 const mergeHook = create();
 write(mergeHook, 'human.txt', 'human staged\n'); git(mergeHook, 'add', 'human.txt');
 write(mergeHook, 'human.txt', 'human staged and unstaged\n');
 const mergeCandidate = staticCandidate(mergeHook, 'greeting with a hook postcondition');
 focused(mergeHook, mergeCandidate.h, mergeCandidate.checked);
 const mergeParent = git(mergeHook, 'rev-parse', 'HEAD');
 const side = git(mergeHook, 'commit-tree', `${mergeParent}^{tree}`, '-p', mergeParent, '-m', 'side history');
 const humanIndex = readFileSync(join(mergeHook, '.git/index'));
 const replaceHistory = replacedHistory ? 'git replace "$replacement" "$current"\n' : '';
 write(mergeHook, '.git/hooks/post-commit', `#!/bin/sh\ncurrent=$(git rev-parse HEAD)\ntree=$(git rev-parse HEAD^{tree})\nmessage=$(git show -s --format=%B "$current")\nreplacement=$(git commit-tree "$tree" -p ${mergeParent} -p ${side} -m "$message")\n${replaceHistory}git update-ref HEAD "$replacement" "$current"\n`);
 chmodSync(join(mergeHook, '.git/hooks/post-commit'), 0o755);
 const hookQuestion = call(mergeHook, 'finish', { h: mergeCandidate.h });
 assert.equal(hookQuestion.questions[0].id, 'hook-consent', JSON.stringify(hookQuestion));
 assert.equal(call(mergeHook, 'decide', { h: mergeCandidate.h, kind: 'hook-consent', answers: { 'hook-consent': 'commit-with-hooks' } }).exit, 0);
 const mergeRefusal = call(mergeHook, 'finish', { h: mergeCandidate.h });
 assert.equal(mergeRefusal.exit, 2, JSON.stringify(mergeRefusal));
 assert.ok(mergeRefusal.reasons.some(reason => reason.code === 'effect-uncertain'));
 const mergeHead = git(mergeHook, 'rev-parse', 'HEAD');
 assert.equal(git(mergeHook, '--no-replace-objects', 'show', '-s', '--format=%P', 'HEAD').split(' ').length, 2);
 const mergeRecovery = call(mergeHook, 'open', { profile: 'investigate', request: 'reconcile the unexpected merge' });
 assert.equal(mergeRecovery.exit, 2, JSON.stringify(mergeRecovery));
 assert.ok(mergeRecovery.reasons.some(reason => reason.code === 'effect-uncertain'));
 assert.equal(git(mergeHook, 'rev-parse', 'HEAD'), mergeHead);
 assert.deepEqual(readFileSync(join(mergeHook, '.git/index')), humanIndex);
 assert.equal(readFileSync(join(mergeHook, 'human.txt'), 'utf8'), 'human staged and unstaged\n');
 const mergeState = JSON.parse(readFileSync(join(mergeHook, '.tenet/state'), 'utf8'));
 assert.ok(mergeState.sourceOwner);
 assert.ok(Object.values(mergeState.work).every(work => work.git.commits.length === 0));
 observations.push({ scenario: `built hook-replaced merge${replacedHistory ? ' with replacement refs' : ''} cannot finalize or reconcile as the planned commit`, exit: 2, recoveryExit: 2, humanIndexPreserved: true, sourceOwnershipFenced: true, unexpectedHeadPreserved: true });
 }
 const foreignHook = create();
 write(foreignHook, 'human.txt', 'human staged\n'); git(foreignHook, 'add', 'human.txt');
 write(foreignHook, 'human.txt', 'human staged and unstaged\n');
 const foreignEntry = git(foreignHook, 'ls-files', '-s', '--', 'human.txt');
 const foreignCandidate = staticCandidate(foreignHook, 'report every foreign hook path');
 focused(foreignHook, foreignCandidate.h, foreignCandidate.checked);
 const foreignParent = git(foreignHook, 'rev-parse', 'HEAD');
 write(foreignHook, '.git/hooks/post-commit', `#!/bin/sh\ncurrent=$(git rev-parse HEAD)\nmessage=$(git show -s --format=%B "$current")\ngit add human.txt\ntree=$(git write-tree)\nreplacement=$(git commit-tree "$tree" -p ${foreignParent} -m "$message")\ngit replace "$replacement" "$current"\ngit update-ref HEAD "$replacement" "$current"\n`);
 chmodSync(join(foreignHook, '.git/hooks/post-commit'), 0o755);
 assert.equal(call(foreignHook, 'finish', { h: foreignCandidate.h }).questions[0].id, 'hook-consent');
 assert.equal(call(foreignHook, 'decide', { h: foreignCandidate.h, kind: 'hook-consent', answers: { 'hook-consent': 'commit-with-hooks' } }).exit, 0);
 const foreignResult = call(foreignHook, 'finish', { h: foreignCandidate.h });
 assert.equal(foreignResult.exit, 3, JSON.stringify(foreignResult));
 assert.ok(foreignResult.reasons.some(reason => reason.code === 'hook-staged-foreign-path'));
 assert.notEqual(foreignResult.data.endpoint, 'checked-local');
 assert.equal(git(foreignHook, '--no-replace-objects', 'show', 'HEAD:human.txt'), 'human staged and unstaged');
 assert.equal(git(foreignHook, 'ls-files', '-s', '--', 'human.txt'), foreignEntry);
 assert.equal(readFileSync(join(foreignHook, 'human.txt'), 'utf8'), 'human staged and unstaged\n');
 assert.notEqual(git(foreignHook, 'for-each-ref', '--format=%(refname)', 'refs/replace/'), '');
 observations.push({ scenario: 'built replacement refs cannot hide foreign hook-committed human content', exit: 3, foreignPathReported: true, humanStagingPreserved: true, humanContentPreserved: true, replacementRefPreserved: true });
 for (const mode of ['fifo', 'short', 'prepared-grow']) {
  const interrupted = create();
  const ih = call(interrupted, 'open', { profile: 'feature', request: 'recover never-launched process', lane: 'quick' }).handle;
  assert.equal(call(interrupted, 'decide', { h: ih, kind: 'basis', propose: basis }).exit, 0);
  write(interrupted, 'src/greet.test.ts', "import {it,expect} from 'vitest'; it('red',()=>expect(false).toBe(true));\n");
  const exposure = call(interrupted, 'check', { h: ih, stage: 'baseline' }, [], false);
  assert.equal(exposure.questions[0].id, 'envelope-consent');
  assert.equal(call(interrupted, 'decide', { h: ih, kind: 'envelope-consent', answers: { 'envelope-consent': 'allow-envelope' } }).exit, 0);
  const killed = spawnSync(process.execPath, [join(source, 'tools/uat/crash-bundle-project.mjs'), bundle, 'kill-prepared-call', '<unused>',
   'check', '--h', ih, '--stage', 'baseline'], { cwd: interrupted, env, encoding: 'utf8', timeout: 10000 });
  assert.equal(killed.error, undefined, killed.error?.message); assert.equal(killed.signal, 'SIGKILL', killed.stderr);
  const before = JSON.parse(readFileSync(join(interrupted, '.tenet/state'), 'utf8'));
  const work = Object.values(before.work)[0], record = join(work.session.inCall.runDir, 'run.json');
  assert.deepEqual(JSON.parse(readFileSync(record, 'utf8')), { prepared: true });
  const implementation = readFileSync(join(interrupted, 'src/greet.ts'), 'utf8'), index = git(interrupted, 'ls-files', '-s');
  const head = git(interrupted, 'rev-parse', 'HEAD'), branch = git(interrupted, 'branch', '--show-current');
  if (mode === 'fifo') { rmSync(record); execFileSync('mkfifo', [record]); }
  const recovered = spawnSync(process.execPath, [join(source, 'tools/uat/crash-bundle-project.mjs'), bundle,
   mode === 'fifo' ? '<none>' : `read-${mode}`, record,
   ...(mode === 'short' ? ['stop', '--h', ih, '--mode', 'pause'] : ['check', '--h', ih, '--stage', 'baseline'])],
   { cwd: interrupted, env, encoding: 'utf8', timeout: 10000 });
  assert.equal(recovered.error, undefined, recovered.error?.message); assert.equal(recovered.signal, null, recovered.stderr);
  const response = JSON.parse(recovered.stdout), after = JSON.parse(readFileSync(join(interrupted, '.tenet/state'), 'utf8'));
  const live = after.work[work.id];
  assert.equal(response.exit, mode === 'short' ? 0 : 2, JSON.stringify(response));
  assert.equal(live.receipts.length, 0);
  for (const counter of ['attempts', 'reviewRounds', 'rechecks', 'delegations', 'checksLaunched', 'tenetTokens']) {
   assert.equal(typeof work.budget[counter], 'number'); assert.equal(live.budget[counter], work.budget[counter], counter);
  }
  assert.ok(live.budget.activeMinutesTotal >= work.budget.activeMinutesTotal);
  assert.deepEqual(live.grants, work.grants);
  if (mode === 'short') { assert.equal(live.session.inCall, undefined); assert.equal(after.sourceOwner, undefined); }
  else { assert.deepEqual(live.session.inCall, { ...work.session.inCall, cancelled: true }); assert.deepEqual(after.sourceOwner, before.sourceOwner); }
  if (mode === 'fifo') assert.equal(lstatSync(record).isFIFO(), true);
  else assert.equal(readFileSync(record, 'utf8'), mode === 'short' ? '{"prepared":true}' : '{"prepared":true}\n');
  assert.equal(readFileSync(join(interrupted, 'src/greet.ts'), 'utf8'), implementation); assert.equal(git(interrupted, 'ls-files', '-s'), index);
  assert.equal(git(interrupted, 'rev-parse', 'HEAD'), head); assert.equal(git(interrupted, 'branch', '--show-current'), branch);
  observations.push({ scenario: `built prepared-call recovery ${mode} admission`, realKilledPreparation: true, childNeverLaunched: true,
   controlledRecordFault: true, noReceipt: true, usagePreserved: true, ownership: mode === 'short' ? 'released-after-admission' : 'retained', humanGitPreserved: true });
 }
 for (const cancelled of [false, true]) {
  const interrupted = create(), effectsRoot = mkdtempSync(join(tmpdir(), 'tenet-check-effects-')); roots.push(effectsRoot);
  const marker = join(effectsRoot, 'effects.txt'), release = join(effectsRoot, 'release');
  const ih = call(interrupted, 'open', { profile: 'feature', request: 'confirm interrupted external effects', lane: 'quick' }).handle;
  assert.equal(call(interrupted, 'decide', { h: ih, kind: 'basis', propose: basis }).exit, 0);
    write(interrupted, 'src/greet.test.ts', `import fs from 'node:fs'; import {it,expect} from 'vitest'; it('external effect',async()=>{fs.appendFileSync(${JSON.stringify(marker)},'run\\n');if(!fs.existsSync(${JSON.stringify(release)}))await new Promise(()=>{});expect(false).toBe(true);},120000);\n`);
  const exposure = call(interrupted, 'check', { h: ih, stage: 'baseline' }, [], false);
  assert.equal(exposure.questions[0].id, 'envelope-consent');
  const envelopeHash = exposure.questions[0].bind.factsHash;
  assert.equal(call(interrupted, 'decide', { h: ih, kind: 'envelope-consent', answers: { 'envelope-consent': 'allow-envelope' } }).exit, 0);
  const child = spawn(process.execPath, [bundle, 'check', '--h', ih, '--stage', 'baseline'], { cwd: interrupted, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.resume(); child.stderr.resume();
  const done = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  let orphan;
  try {
   await waitUntil(() => existsSync(marker), 'external check effect');
   const runningWork = Object.values(JSON.parse(readFileSync(join(interrupted, '.tenet/state'), 'utf8')).work)[0];
   assert.equal(runningWork.session.inCall.executionEnvelope.hash, envelopeHash);
   orphan = JSON.parse(readFileSync(join(runningWork.session.inCall.runDir, 'run.json'), 'utf8'));
   if (cancelled) assert.equal(call(interrupted, 'stop', { h: ih, mode: 'cancel' }).exit, 0);
   else child.kill('SIGKILL');
   await done;
   const retry = call(interrupted, 'check', { h: ih, stage: 'baseline' }, [], false);
   assert.equal(retry.exit, 3, JSON.stringify(retry));
   assert.equal(retry.questions[0].id, 'envelope-consent');
   assert.equal(retry.questions[0].bind.factsHash, envelopeHash);
   assert.match(retry.questions[0].question, /interrupted|side effects/i);
   assert.equal(readFileSync(marker, 'utf8'), 'run\n');
   const recovered = Object.values(JSON.parse(readFileSync(join(interrupted, '.tenet/state'), 'utf8')).work)[0];
   assert.equal(recovered.session.inCall, undefined); assert.equal(recovered.receipts.length, 0);
   assert.equal(call(interrupted, 'decide', { h: ih, kind: 'envelope-consent', answers: { 'envelope-consent': 'decline-envelope' } }).exit, 0);
   assert.equal(call(interrupted, 'check', { h: ih, stage: 'baseline' }, [], false).exit, 3);
   assert.equal(readFileSync(marker, 'utf8'), 'run\n');
   assert.equal(call(interrupted, 'decide', { h: ih, kind: 'envelope-consent', answers: { 'envelope-consent': 'allow-envelope' } }).exit, 0);
   writeFileSync(release, 'approved retry');
   assert.equal(call(interrupted, 'check', { h: ih, stage: 'baseline' }, [], false).exit, 0);
   assert.equal(readFileSync(marker, 'utf8'), 'run\nrun\n');
   observations.push({ scenario: `built ${cancelled ? 'cancelled' : 'crashed'} unknown check requires fresh same-envelope consent`, sameEnvelope: true, externalEffectPreserved: true, declinedReplayBlocked: true, approvedRerunExecutedOnce: true });
  } finally {
   child.kill('SIGKILL');
   if (orphan?.pid) try { process.kill(-orphan.pid, 'SIGKILL'); } catch { /* already stopped */ }
  }
 }
 for (const metadata of ['complete', 'complete-long-history', 'legacy', 'malformed']) {
  const replayed = create();
  write(replayed, 'human.txt', 'human staged\n'); git(replayed, 'add', 'human.txt');
  write(replayed, 'human.txt', 'human staged and unstaged\n');
  const staged = git(replayed, 'ls-files', '-s', '--', 'human.txt');
  const candidate = staticCandidate(replayed, 'retain recorded foreign-path attention');
  focused(replayed, candidate.h, candidate.checked);
  write(replayed, '.git/hooks/pre-commit', '#!/bin/sh\ngit add human.txt\n');
  chmodSync(join(replayed, '.git/hooks/pre-commit'), 0o755);
  assert.equal(call(replayed, 'finish', { h: candidate.h }).questions[0].id, 'hook-consent');
  assert.equal(call(replayed, 'decide', { h: candidate.h, kind: 'hook-consent', answers: { 'hook-consent': 'commit-with-hooks' } }).exit, 0);
  const before = JSON.parse(readFileSync(join(replayed, '.tenet/state'), 'utf8'));
  const workId = Object.keys(before.work)[0], count = Number(git(replayed, 'rev-list', '--count', 'HEAD'));
  const point = metadata === 'complete-long-history' ? 'after-long-history-commit-result'
   : metadata === 'complete' ? 'after-commit-result' : `after-${metadata}-commit-result`;
  const killed = spawnSync(process.execPath, [join(source, 'tools/uat/crash-bundle-index.mjs'), bundle, point,
   'finish', '--h', candidate.h], { cwd: replayed, env, encoding: 'utf8' });
  assert.equal(killed.signal, 'SIGKILL', killed.stderr + killed.stdout);
  const landed = git(replayed, 'rev-parse', 'HEAD');
  assert.equal(Number(git(replayed, 'rev-list', '--count', 'HEAD')), count + 1);
  const recovered = call(replayed, 'open', { profile: 'investigate', request: 'replay the recorded commit safely' });
  const work = JSON.parse(readFileSync(join(replayed, '.tenet/state'), 'utf8')).work[workId];
  if (metadata.startsWith('complete')) {
   assert.equal(recovered.exit, 0, JSON.stringify(recovered));
   assert.deepEqual(work.git.commits, [landed]);
   assert.ok(work.attention.some(item => item.path === 'human.txt' && !item.disposition));
   const retried = call(replayed, 'finish', { h: candidate.h });
   assert.notEqual(retried.data?.endpoint, 'checked-local');
  } else {
   assert.equal(recovered.exit, 2, JSON.stringify(recovered));
   assert.ok(recovered.reasons.some(reason => reason.code === 'effect-uncertain'));
   assert.deepEqual(work.git.commits, []);
   assert.ok(JSON.parse(readFileSync(join(replayed, '.tenet/state'), 'utf8')).sourceOwner);
  }
  assert.equal(git(replayed, 'ls-files', '-s', '--', 'human.txt'), staged);
  assert.equal(readFileSync(join(replayed, 'human.txt'), 'utf8'), 'human staged and unstaged\n');
  assert.equal(git(replayed, 'rev-parse', 'HEAD'), landed);
  assert.equal(Number(git(replayed, 'rev-list', '--count', 'HEAD')), count + 1);
  observations.push({ scenario: `built recorded commit replay ${metadata} foreign metadata`, killedAfterSyncedResult: true,
    laterJournalRecords: metadata === 'complete-long-history' ? 450 : 0,
    recoveryExit: recovered.exit, humanStagingPreserved: true, humanContentPreserved: true, duplicateCommits: false });
 }
 const acceptedAdoption = create();
 const acceptedHandle = call(acceptedAdoption, 'open', { profile: 'feature', request: 'preserve newer adopted intent', lane: 'quick' }).handle;
 assert.equal(call(acceptedAdoption, 'decide', { h: acceptedHandle, kind: 'basis', propose: basis }).exit, 0);
 assert.equal(call(acceptedAdoption, 'decide', { h: acceptedHandle, kind: 'adopt', target: 'intent' }).exit, 3);
 assert.equal(call(acceptedAdoption, 'decide', { h: acceptedHandle, kind: 'adopt', target: 'intent', answers: { 'adopt-confirm': 'confirm' } }).exit, 0);
 const priorTrust = JSON.parse(readFileSync(join(acceptedAdoption, '.tenet/state'), 'utf8')).trust.find(entry => entry.file === 'INTENT.md');
 const acceptedBytes = `${readFileSync(join(acceptedAdoption, 'INTENT.md'), 'utf8')}\nHuman-owned notes accepted explicitly.\n`;
 write(acceptedAdoption, 'INTENT.md', acceptedBytes);
 assert.equal(call(acceptedAdoption, 'decide', { h: acceptedHandle, kind: 'adopt', target: 'intent' }).exit, 0);
 const acceptedState = JSON.parse(readFileSync(join(acceptedAdoption, '.tenet/state'), 'utf8'));
 const acceptedTrust = acceptedState.trust.find(entry => entry.file === 'INTENT.md'), acceptedWorkId = Object.keys(acceptedState.work)[0];
 assert.notEqual(acceptedTrust.hash, priorTrust.hash);
 for (const request of ['preserve adopted provenance', 'repeat adopted provenance recovery']) {
  const response = call(acceptedAdoption, 'open', { profile: 'investigate', request });
  assert.equal(response.exit, 0, JSON.stringify(response));
  const current = JSON.parse(readFileSync(join(acceptedAdoption, '.tenet/state'), 'utf8'));
  assert.deepEqual(current.trust.find(entry => entry.file === 'INTENT.md'), acceptedTrust);
  assert.equal(current.work[acceptedWorkId].vetted['INTENT.md'], acceptedTrust.hash);
  assert.equal(readFileSync(join(acceptedAdoption, 'INTENT.md'), 'utf8'), acceptedBytes);
  assert.equal(response.effects?.completed.some(effect => /not yet adopted/.test(effect)) ?? false, false);
 }
 observations.push({ scenario: 'built historical adoption replay cannot replace newer accepted trust', provenancePreserved: true,
  ownedFileHashPreserved: true, humanProsePreserved: true, repeatedRecoveryIdempotent: true });
 const scaffoldReplay = mkdtempSync(join(tmpdir(), 'tenet-scaffold-replay-')); roots.push(scaffoldReplay);
 git(scaffoldReplay, 'init', '-q', '-b', 'main');
 git(scaffoldReplay, 'config', 'user.name', 'Test'); git(scaffoldReplay, 'config', 'user.email', 'test@example.com');
 git(scaffoldReplay, 'config', 'commit.gpgsign', 'false');
 write(scaffoldReplay, 'NOTES.txt', 'preserve human notes\n'); git(scaffoldReplay, 'add', '-A'); git(scaffoldReplay, 'commit', '-qm', 'initial');
 const scaffoldHandle = call(scaffoldReplay, 'open', { profile: 'feature', request: 'scaffold once and retain its attribution', lane: 'quick' }).handle;
 assert.equal(call(scaffoldReplay, 'decide', { h: scaffoldHandle, kind: 'basis', propose: {
  outcome: 'The starter platform is in place and its own tests pass', elements: [
   { ref: 'r', kind: 'requirement', origin: 'request', text: 'the platform tests pass' },
   { ref: 'e', kind: 'example', origin: 'request', of: 'r', text: 'platform.test.ts passes',
    testFile: 'server/test/platform.test.ts', test: 'preservation', expect: 'pass' },
  ],
 } }).exit, 0);
 assert.equal(call(scaffoldReplay, 'decide', { h: scaffoldHandle, kind: 'scaffold', propose: { name: 'stable-scaffold' } }).exit, 0);
 assert.equal(readFileSync(join(scaffoldReplay, 'LICENSE'), 'utf8'), readFileSync(join(source, 'LICENSE'), 'utf8'));
 observations.push({ scenario: 'built starter carries the selected MIT license', licenseCopied: true });
 const scaffoldCheck = call(scaffoldReplay, 'check', { h: scaffoldHandle, stage: 'candidate' });
 assert.equal(scaffoldCheck.exit, 0, JSON.stringify(scaffoldCheck));
 const browserReceipt = scaffoldCheck.data.receipts.find(r => r.obligation === 'OB-e2e');
 assert.equal(browserReceipt.status, 'pass', JSON.stringify(browserReceipt));
 assert.equal(browserReceipt.counts.executed, 12, 'all source-server, account and admission-exhaustion browser checks ran');
 assert.equal(existsSync(join(scaffoldReplay, 'web/src/App.tsx')), true);
 assert.equal(existsSync(join(scaffoldReplay, 'data/app.db')), false, 'browser checks never touched the development database');
 observations.push({ scenario: 'built starter source-bound browser account journeys', browserAndServerTests: browserReceipt.counts.executed, dedicatedDatabase: true, axeAndKeyboardAssertions: true, screenReaderObserved: false });
 const exportContract = spawnSync(process.execPath, ['--experimental-strip-types', 'server/src/openapi.ts'], {
  cwd: scaffoldReplay, env: { ...env, NODE_ENV: 'production', PORT: 'invalid', DATABASE_URL: join(scaffoldReplay, 'data', 'must-not-open.db'), COOKIE_SECRET: 'short' }, encoding: 'utf8', timeout: 15000,
 });
 assert.equal(exportContract.status, 0, exportContract.stderr);
 const apiContract = JSON.parse(exportContract.stdout);
 assert.equal(apiContract.openapi, '3.1.0');
 assert.equal(Object.keys(apiContract.paths).length, 6);
 assert.deepEqual(apiContract.paths['/api/auth/me'].get.security, [{ session: [] }]);
 assert.equal(existsSync(join(scaffoldReplay, 'data')), false, 'contract export never opens the development database');
 observations.push({ scenario: 'built starter source-bound OpenAPI export', paths: 6, version: apiContract.openapi, ambientConfigurationIgnored: true, listenerStarted: false, compatibilityEnforced: false });


 assert.ok(scaffoldCheck.data.review, JSON.stringify({ reasons: scaffoldCheck.reasons,
  receipts: scaffoldCheck.data.receipts.map(receipt => ({ obligation: receipt.obligation,
   status: receipt.status, counts: receipt.counts, reasons: receipt.reasons })) }));
 focused(scaffoldReplay, scaffoldHandle, scaffoldCheck);
 const scaffoldFinished = call(scaffoldReplay, 'finish', { h: scaffoldHandle, subject: 'Scaffold once' });
 assert.equal(scaffoldFinished.data.endpoint, 'checked-local', JSON.stringify(scaffoldFinished));
 const scaffoldState = JSON.parse(readFileSync(join(scaffoldReplay, '.tenet/state'), 'utf8'));
 const scaffoldWorkId = Object.keys(scaffoldState.work)[0], scaffoldHead = git(scaffoldReplay, 'rev-parse', 'HEAD');
 assert.deepEqual(scaffoldState.work[scaffoldWorkId].touched, []);
 for (const request of ['retain finished scaffold bookkeeping', 'repeat finished scaffold recovery']) {
  const response = call(scaffoldReplay, 'open', { profile: 'investigate', request });
  assert.equal(response.exit, 0, JSON.stringify(response));
  const current = JSON.parse(readFileSync(join(scaffoldReplay, '.tenet/state'), 'utf8'));
  assert.deepEqual(current.work[scaffoldWorkId], scaffoldState.work[scaffoldWorkId]);
  assert.deepEqual(current.project.recipe, scaffoldState.project.recipe);
  assert.equal(git(scaffoldReplay, 'rev-parse', 'HEAD'), scaffoldHead);
  assert.equal(readFileSync(join(scaffoldReplay, 'NOTES.txt'), 'utf8'), 'preserve human notes\n');
  assert.equal(response.effects?.completed.some(effect => /scaffold.*not yet in the contract/.test(effect)) ?? false, false);
 }
 observations.push({ scenario: 'built finished scaffold is not reapplied after transient touched paths clear',
  realStarterInstalled: true, finishedContractUnchanged: true, recipeRecordUnchanged: true, humanNotesPreserved: true, repeatedRecoveryIdempotent: true });
 const dependencyIdentity = create();
 rmSync(join(dependencyIdentity, 'node_modules')); mkdirSync(join(dependencyIdentity, 'node_modules'));
 for (const name of ['vitest', 'typescript']) symlinkSync(join(source, 'node_modules', name), join(dependencyIdentity, 'node_modules', name));
 write(dependencyIdentity, 'node_modules/.package-lock.json', '{"lockfileVersion":3,"packages":{},"generation":1}');
 write(dependencyIdentity, 'tsconfig.json', JSON.stringify({ compilerOptions: {
  strict: true, module: 'NodeNext', skipLibCheck: true, types: [],
 }, include: ['src/greet.ts'] }));
 write(dependencyIdentity, 'tenet.policy.json', JSON.stringify({ required_checks: [{ id: 'types', tool: 'tsc', property: 'project compiles' }] }));
 const dependencyCandidate = staticCandidate(dependencyIdentity, 'bind installed dependency metadata');
 assert.equal(dependencyCandidate.receipt.status, 'pass');
 focused(dependencyIdentity, dependencyCandidate.h, dependencyCandidate.checked);
 const beforeDependencyEdit = call(dependencyIdentity, 'inspect', { h: dependencyCandidate.h, view: 'why' });
 assert.equal(beforeDependencyEdit.data.endpoint, 'checked-local', JSON.stringify(beforeDependencyEdit));
 const dependencyGitStatus = git(dependencyIdentity, 'status', '--porcelain');
 write(dependencyIdentity, 'node_modules/.package-lock.json', '{"lockfileVersion":3,"packages":{},"generation":2,"canary":"PRIVATE_DEPENDENCY_METADATA"}');
 assert.equal(git(dependencyIdentity, 'status', '--porcelain'), dependencyGitStatus);
 const dependencyWhy = call(dependencyIdentity, 'inspect', { h: dependencyCandidate.h, view: 'why' });
 assert.notEqual(dependencyWhy.data.endpoint, 'checked-local');
 assert.ok(dependencyWhy.reasons.some(reason => reason.code === 'stale'));
 assert.equal(JSON.stringify(dependencyWhy).includes('PRIVATE_DEPENDENCY_METADATA'), false);
 observations.push({ scenario: 'built installed dependency record changes invalidate passing evidence', trackedInputsUnchanged: true, compilerReceipt: 'pass', staleAfterIgnoredEdit: true, metadataContentsDisclosed: false });
 const dependencyState = JSON.parse(readFileSync(join(dependencyIdentity, '.tenet/state'), 'utf8'));
 const dependencyWork = Object.values(dependencyState.work)[0];
 write(dependencyIdentity, 'node_modules/.package-lock.json', '{ malformed');
 const dependencyRefusal = call(dependencyIdentity, 'check', { h: dependencyCandidate.h, stage: 'candidate' }, ['--again']);
 assert.equal(dependencyRefusal.exit, 2, JSON.stringify(dependencyRefusal));
 assert.ok(dependencyRefusal.reasons.some(reason => reason.code === 'capability-missing'));
 const refusedDependencyWork = Object.values(JSON.parse(readFileSync(join(dependencyIdentity, '.tenet/state'), 'utf8')).work)[0];
 assert.deepEqual(refusedDependencyWork.receipts, dependencyWork.receipts);
 assert.deepEqual(refusedDependencyWork.budget, dependencyWork.budget);
 assert.equal(refusedDependencyWork.session.inCall, undefined);
 observations.push({ scenario: 'built malformed installed dependency record refuses before a new check', exit: 2, receiptsPreserved: true, budgetPreserved: true, commandLaunched: false });
 for (const kind of ['oversized', 'linked', 'invalid-utf8', 'deep']) {
  const unsafeTool = create();
  rmSync(join(unsafeTool, 'node_modules'));
  write(unsafeTool, 'node_modules/vitest/package.json', '{"version":"5.0.5"}');
  write(unsafeTool, 'node_modules/vitest/vitest.mjs', 'import fs from "node:fs"; fs.writeFileSync("unexpected-tool-spawn", "bad");');
  const toolHandle = call(unsafeTool, 'open', { profile: 'feature', request: 'refuse unsafe tool metadata', lane: 'quick' }).handle;
  assert.equal(call(unsafeTool, 'decide', { h: toolHandle, kind: 'basis', propose: basis }).exit, 0);
  const before = JSON.parse(readFileSync(join(unsafeTool, '.tenet/state'), 'utf8'));
  const metadata = join(unsafeTool, 'node_modules/vitest/package.json');
  if (kind === 'oversized') {
   const descriptor = openSync(metadata, 'w');
   try { ftruncateSync(descriptor, 20 * 1024 * 1024 + 1); } finally { closeSync(descriptor); }
  } else if (kind === 'linked') {
   write(unsafeTool, 'outside-tool.json', '{"version":"5.0.5"}');
   rmSync(metadata); symlinkSync(join(unsafeTool, 'outside-tool.json'), metadata);
  } else if (kind === 'invalid-utf8') {
   writeFileSync(metadata, Buffer.concat([Buffer.from('{"version":"5.0.5","note":"'), Buffer.from([0xff]), Buffer.from('"}')]));
  } else writeFileSync(metadata, `{"version":"5.0.5","nested":${'['.repeat(65)}0${']'.repeat(65)}}`);
  const refused = call(unsafeTool, 'check', { h: toolHandle, stage: 'candidate' });
  assert.equal(refused.exit, 2, JSON.stringify(refused));
  assert.ok(refused.reasons.some(reason => reason.code === 'capability-missing' && /tool metadata/.test(reason.message)));
  assert.equal(existsSync(join(unsafeTool, 'unexpected-tool-spawn')), false);
  assert.deepEqual(JSON.parse(readFileSync(join(unsafeTool, '.tenet/state'), 'utf8')), before);
  observations.push({ scenario: `built ${kind} installed tool metadata refuses before launch`, exit: 2, statePreserved: true, commandLaunched: false });
 }
 for (const record of ['state', 'marker', 'log']) {
  const invalidEncoding = create();
  const encodingHandle = call(invalidEncoding, 'open', { profile: 'investigate', request: 'encoding-canary' }).handle;
  rmSync(join(invalidEncoding, '.tenet/state.prev'), { force: true });
  const path = join(invalidEncoding, '.tenet', record), original = readFileSync(path);
  const needle = record === 'marker' ? '"nonce":"' : record === 'log' ? '"verb":"' : 'encoding-canary';
  const found = original.indexOf(needle);
  assert.ok(found >= 0);
  const offset = found + (record === 'state' ? 0 : needle.length);
  const bytes = Buffer.concat([original.subarray(0, offset), Buffer.from([0xff]), original.subarray(offset + 1)]);
  writeFileSync(path, bytes);
  const state = readFileSync(join(invalidEncoding, '.tenet/state'));
  const response = call(invalidEncoding, 'inspect', { h: encodingHandle });
  assert.notEqual(response.exit, 0, JSON.stringify(response));
  assert.ok(response.reasons.some(reason => reason.code === (record === 'marker' ? 'marker-mismatch' : 'unsupported-record')), JSON.stringify(response));
  assert.deepEqual(readFileSync(path), bytes);
  assert.deepEqual(readFileSync(join(invalidEncoding, '.tenet/state')), state);
  assert.equal(existsSync(join(invalidEncoding, '.tenet/lock')), false);
  observations.push({ scenario: `built invalid UTF-8 in private ${record} refuses admission`, exit: response.exit, storedBytesPreserved: true, noTransaction: true });
 }
 const unicodeJournal = create(), unicodeText = 'encoding \u00e9\u4e2d\ud83d\ude80\ufffd';
 const unicodeHandle = call(unicodeJournal, 'open', { profile: 'investigate', request: unicodeText }).handle;
 assert.ok(readFileSync(join(unicodeJournal, '.tenet/state'), 'utf8').includes(unicodeText));
 const unicodeLog = join(unicodeJournal, '.tenet/log'), unicodePrefix = readFileSync(unicodeLog);
 const tornMultibyte = Buffer.concat([Buffer.from('{"note":"'), Buffer.from([0xe2, 0x82])]);
 const unicodeBytes = Buffer.concat([unicodePrefix, tornMultibyte]);
 writeFileSync(unicodeLog, unicodeBytes);
 assert.equal(call(unicodeJournal, 'inspect', { h: unicodeHandle }).exit, 0);
 assert.deepEqual(readFileSync(unicodeLog), unicodeBytes);
 assert.equal(call(unicodeJournal, 'open', { profile: 'investigate', request: 'repair a torn multibyte journal tail' }).exit, 0);
 const repairedUnicodeLog = readFileSync(unicodeLog);
 assert.deepEqual(repairedUnicodeLog.subarray(0, unicodePrefix.length), unicodePrefix);
 assert.equal(repairedUnicodeLog.includes(tornMultibyte), false);
 assert.ok(readFileSync(join(unicodeJournal, '.tenet/state'), 'utf8').includes(unicodeText));
 observations.push({ scenario: 'built valid Unicode and torn multibyte journal recovery preserve accepted text', readOnlyPreservedTail: true, transactionRepairedTail: true, validUnicodePreserved: true });
 for (const record of ['state', 'marker', 'log']) {
  const privateRace = create();
  const privateHandle = call(privateRace, 'open', { profile: 'investigate', request: 'preserve concurrently changed private records' }).handle;
  rmSync(join(privateRace, '.tenet/state.prev'), { force: true });
  const path = `.tenet/${record}`, original = readFileSync(join(privateRace, path), 'utf8');
  const state = readFileSync(join(privateRace, '.tenet/state'), 'utf8');
  const result = spawnSync(process.execPath, [join(source, 'tools/uat/crash-bundle-project.mjs'), bundle,
   'read-store-overwrite', path, 'inspect', `--h=${privateHandle}`], { cwd: privateRace, env, encoding: 'utf8' });
  assert.equal(result.signal, null, result.stderr);
  const response = JSON.parse(result.stdout);
  assert.notEqual(result.status, 0, JSON.stringify(response));
  assert.equal(result.status, response.exit);
  assert.ok(response.reasons.some(reason => reason.code === (record === 'marker' ? 'marker-mismatch' : 'unsupported-record')), JSON.stringify(response));
  const expected = record === 'state' ? original.replace(/("revision":)([0-8])/, (_match, prefix, revision) => prefix + (Number(revision) + 1)) :
   record === 'marker' ? original.replace(/("nonce":")(.)/, (_match, prefix, first) => prefix + (first === 'a' ? 'b' : 'a')) :
   original.replace('"verb":"open"', '"verb":"stop"');
  assert.equal(readFileSync(join(privateRace, path), 'utf8'), expected);
  if (record !== 'state') assert.equal(readFileSync(join(privateRace, '.tenet/state'), 'utf8'), state);
  assert.equal(existsSync(join(privateRace, '.tenet/lock')), false);
  observations.push({ scenario: `built same-size private ${record} mutation refuses admission`, exit: response.exit, foreignEditPreserved: true, noTransaction: true });
 }
 for (const kind of ['tool', 'dependency']) {
  const metadataRace = create();
  rmSync(join(metadataRace, 'node_modules'));
  write(metadataRace, 'node_modules/vitest/package.json', '{"version":"5.0.5","note":"a"}');
  write(metadataRace, 'node_modules/vitest/vitest.mjs', 'import fs from "node:fs"; fs.writeFileSync("unexpected-tool-spawn", "bad");');
  write(metadataRace, 'node_modules/.package-lock.json', '{"lockfileVersion":3,"packages":{},"note":"a"}');
  const metadataHandle = call(metadataRace, 'open', { profile: 'feature', request: 'refuse concurrently changed installed metadata', lane: 'quick' }).handle;
  assert.equal(call(metadataRace, 'decide', { h: metadataHandle, kind: 'basis', propose: basis }).exit, 0);
  const before = readFileSync(join(metadataRace, '.tenet/state'), 'utf8');
  const path = kind === 'tool' ? 'node_modules/vitest/package.json' : 'node_modules/.package-lock.json';
  const original = readFileSync(join(metadataRace, path), 'utf8');
  const result = spawnSync(process.execPath, [join(source, 'tools/uat/crash-bundle-project.mjs'), bundle,
   'read-overwrite-json', path, 'check', `--h=${metadataHandle}`, '--stage=candidate'], { cwd: metadataRace, env, encoding: 'utf8' });
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 2, result.stdout + result.stderr);
  const response = JSON.parse(result.stdout);
  assert.ok(response.reasons.some(reason => reason.code === 'capability-missing' && /metadata.*safely/.test(reason.message)), JSON.stringify(response));
  assert.equal(readFileSync(join(metadataRace, '.tenet/state'), 'utf8'), before);
  assert.equal(readFileSync(join(metadataRace, path), 'utf8'), original.replace('"note":"a"', '"note":"b"'));
  assert.equal(existsSync(join(metadataRace, 'unexpected-tool-spawn')), false);
  observations.push({ scenario: `built same-size installed ${kind} metadata mutation refuses before launch`, exit: 2, statePreserved: true, foreignEditPreserved: true, commandLaunched: false });
 }
 for (const mode of ['grow', 'oversized', 'shrink', 'overwrite']) {
  const raced = create();
  const readHandle = call(raced, 'open', { profile: 'feature', request: 'preserve state across a changed project input', lane: 'quick' }).handle;
  assert.equal(call(raced, 'decide', { h: readHandle, kind: 'basis', propose: basis }).exit, 0);
  const before = readFileSync(join(raced, '.tenet/state'), 'utf8');
  const result = spawnSync(process.execPath, [join(source, 'tools/uat/crash-bundle-project.mjs'), bundle,
   `read-${mode}`, 'package.json', 'check', `--h=${readHandle}`], { cwd: raced, env, encoding: 'utf8' });
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 2, result.stdout + result.stderr);
  const response = JSON.parse(result.stdout);
  assert.ok(response.reasons.some(reason => reason.code === 'capability-missing' && /changed during.*bounded read/.test(reason.message)), JSON.stringify(response));
  assert.equal(readFileSync(join(raced, '.tenet/state'), 'utf8'), before);
  const input = readFileSync(join(raced, 'package.json'));
  if (mode === 'grow') assert.ok(input.toString().endsWith('new bytes'));
  if (mode === 'oversized') assert.equal(input.length, 21 * 1024 * 1024);
  if (mode === 'shrink') assert.equal(input.length, 1);
  if (mode === 'overwrite') assert.match(input.toString(), /^x+$/);
  observations.push({ scenario: `built ${mode} project read refuses after concurrent mutation`, exit: 2, statePreserved: true, foreignEditPreserved: true });
 }
 for (const kind of ['oversized', 'linked', 'directory']) {
  const unsafePackage = create();
  const packageHandle = call(unsafePackage, 'open', { profile: 'feature', request: 'refuse unsafe project metadata', lane: 'quick' }).handle;
  assert.equal(call(unsafePackage, 'decide', { h: packageHandle, kind: 'basis', propose: basis }).exit, 0);
  const before = readFileSync(join(unsafePackage, '.tenet/state'), 'utf8'), file = join(unsafePackage, 'package.json');
  if (kind === 'oversized') {
   const descriptor = openSync(file, 'w');
   try { ftruncateSync(descriptor, 20 * 1024 * 1024 + 1); } finally { closeSync(descriptor); }
  } else {
   rmSync(file);
   if (kind === 'directory') mkdirSync(file);
   else { write(unsafePackage, 'aliased-package.json', '{"type":"module"}'); symlinkSync(join(unsafePackage, 'aliased-package.json'), file); }
  }
  const response = call(unsafePackage, 'check', { h: packageHandle });
  assert.equal(response.exit, 2, JSON.stringify(response));
  assert.ok(response.reasons.some(reason => reason.code === (kind === 'oversized' ? 'project-file-too-large' : 'capability-missing')), JSON.stringify(response));
  assert.equal(readFileSync(join(unsafePackage, '.tenet/state'), 'utf8'), before);
  observations.push({ scenario: `built ${kind} project package metadata is not treated as absent`, exit: 2, statePreserved: true });
 }
 const root = create();
 const opened = call(root, 'open', { request: 'greeting', scopePaths: ['src/'] }, ['--profile=feature', '--lane=quick']); assert.equal(opened.exit, 0);
 const h = opened.handle;
 assert.equal(call(root, 'decide', { h, propose: basis }, ['--kind=basis']).exit, 0);
 write(root, 'src/greet.test.ts', 'import { expect, it } from "vitest"; import { greet } from "./greet.ts"; it("greets", () => expect(greet("Ada")).toBe("Hello, Ada!"));\n');
 const red = call(root, 'check', {}, [`--h=${h}`, '--stage=baseline']); assert.equal(red.data.receipts[0].status, 'fail');
 write(root, 'src/greet.ts', 'export const greet = (name: string): string => `Hello, ${name}!`;\n');
 const personal = 'export const personal = "leave me alone";\n'; write(root, 'src/personal.ts', personal);
 const green = call(root, 'check', {}, [`--h=${h}`, '--stage=candidate', '--touched=src/greet.ts']); assert.equal(green.data.receipts[0].status, 'pass');
 assert.equal(green.next[0].action, 'focused-review');
 const reviewedPacket = focused(root, h, green);
 observations.push({ scenario: 'built reviewer packet is readable and exclusion-aware', rubricParts: reviewedPacket.rubric.length, cooperativeExclusions: true, typedSampleGuidance: true });
 const blocked = call(root, 'finish', {}, [`--h=${h}`, '--subject=Greeting']); assert.equal(blocked.exit, 3); assert.equal(blocked.questions[0].id, 'unexplained');
 assert.equal(call(root, 'decide', { h, kind: 'unexplained', answers: { unexplained: 'not-mine' } }).exit, 0);
 const final = call(root, 'finish', {}, [`--h=${h}`, '--subject=Greeting']); assert.equal(final.data.endpoint, 'checked-local');
 const files = git(root, 'show', '--name-only', '--format=', 'HEAD').split('\n'); assert.deepEqual(files.sort(), ['src/greet.test.ts', 'src/greet.ts']);
 assert.equal(readFileSync(join(root, 'src/personal.ts'), 'utf8'), personal);
 observations.push({ scenario: 'built CLI red-green-finish with concurrent human file inside predicted scope', endpoint: final.data.endpoint, scope: final.data.scope, committed: files, humanFilePreserved: true, cliEqualsSyntax: true, focusedPassReported: true, nativeDelegations: 0 });
 const committedStage = call(root, 'check', {}, [`--h=${h}`, '--stage=committed']); assert.equal(committedStage.exit, 2); assert.equal(committedStage.reasons[0].code, 'capability-missing');
 observations.push({ scenario: 'unimplemented committed-tree stage', exit: committedStage.exit, reason: committedStage.reasons[0].code });
 const carry = call(root, 'integrate', { h }); assert.equal(carry.exit, 3, JSON.stringify(carry)); assert.equal(carry.questions[0].id, 'branch-switch');
 assert.equal(call(root, 'decide', { h, kind: 'branch-switch', answers: { 'branch-switch': 'continue' } }).exit, 0);
 const integrated = call(root, 'integrate', { h }); assert.equal(integrated.exit, 0, JSON.stringify(integrated));
 assert.equal(git(root, 'branch', '--show-current'), 'main'); assert.equal(readFileSync(join(root, 'src/personal.ts'), 'utf8'), personal);
 observations.push({ scenario: 'built guarded local integration with carried human file', exit: integrated.exit, mode: integrated.data.mode, humanFilePreserved: true });
 write(root, 'docs/foreign-label.md', 'unrelated human work\n');
 git(root, 'add', 'docs/foreign-label.md');
 git(root, 'commit', '-qm', 'Unrelated human commit\n\nTenet-Work: W-0001');
 const foreignCommit = git(root, 'rev-parse', 'HEAD');
 const foreignIndex = readFileSync(join(root, '.git/index'));
 const foreignUndo = call(root, 'undo', { h });
 assert.ok(foreignUndo.reasons.some(reason => reason.code === 'undo-conflict'), JSON.stringify(foreignUndo));
 assert.equal(foreignUndo.questions?.length ?? 0, 0);
 assert.equal(git(root, 'rev-parse', 'HEAD'), foreignCommit);
 assert.deepEqual(readFileSync(join(root, '.git/index')), foreignIndex);
 assert.equal(readFileSync(join(root, 'docs/foreign-label.md'), 'utf8'), 'unrelated human work\n');
 git(root, 'commit', '--amend', '-qm', 'Unrelated human commit without a work trailer');
 observations.push({ scenario: 'built undo rejects foreign commits with a repeated label', headPreserved: true, indexPreserved: true, humanContentPreserved: true, questionIssued: false });
 assert.equal(call(root, 'undo', { h }).questions[0].id, 'undo-confirm');
 const undone = call(root, 'decide', { h, kind: 'undo-confirm', answers: { 'undo-confirm': 'apply' } }); assert.equal(undone.exit, 0, JSON.stringify(undone));
 assert.match(readFileSync(join(root, 'src/greet.ts'), 'utf8'), /_name/); assert.equal(readFileSync(join(root, 'src/personal.ts'), 'utf8'), personal);
 observations.push({ scenario: 'built guarded working-tree undo', exit: undone.exit, humanFilePreserved: true, newContractRequiresChecks: true });
 const changedRunner = create();
 const rh = call(changedRunner, 'open', { profile: 'feature', request: 'runner changes', lane: 'quick' }).handle;
 call(changedRunner, 'decide', { h: rh, kind: 'basis', propose: basis });
 rmSync(join(changedRunner, 'node_modules')); write(changedRunner, 'node_modules/vitest/package.json', '{"version":"99.0.0"}');
 write(changedRunner, 'node_modules/vitest/vitest.mjs', 'import fs from "node:fs"; fs.writeFileSync("unexpected-spawn", "bad");');
 const runnerRefusal = call(changedRunner, 'check', { h: rh, stage: 'baseline' }); assert.equal(runnerRefusal.exit, 2);
 assert.equal(runnerRefusal.reasons[0].code, 'adapter-unsupported-version'); assert.equal(existsSync(join(changedRunner, 'unexpected-spawn')), false);
 observations.push({ scenario: 'built readiness reprobe after runner version change', exit: runnerRefusal.exit, reason: runnerRefusal.reasons[0].code, childLaunched: false });
 const ignored = create(); write(ignored, '.gitignore', 'node_modules\n.tenet/\nsrc/greet.test.ts\nvitest.config.ts\n');
 const ih = call(ignored, 'open', { profile: 'feature', request: 'ignored inputs', lane: 'quick' }).handle;
 call(ignored, 'decide', { h: ih, kind: 'basis', propose: basis });
 write(ignored, 'src/greet.test.ts', 'import { it, expect } from "vitest"; import { greet } from "./greet.ts"; it("greets", () => expect(greet("Ada")).toBe("Hello, Ada!"));');
 const ignoredRed = call(ignored, 'check', { h: ih, stage: 'baseline' }); assert.equal(ignoredRed.data.receipts[0].status, 'fail');
 write(ignored, 'vitest.config.ts', 'export default { test: {} };');
 const staleRed = call(ignored, 'inspect', { h: ih, view: 'why' }); assert.ok(staleRed.reasons.some(r => r.code === 'red-invalidated'));
 observations.push({ scenario: 'built ignored acceptance and new ignored configuration', baseline: 'fail', introducedConfigInvalidatesRed: true });
 const noRed = create();
 const nh = call(noRed, 'open', { profile: 'feature', request: 'greeting', lane: 'quick' }).handle;
 call(noRed, 'decide', { h: nh, kind: 'basis', propose: { outcome: 'greeting', elements: [{ ref: 'r', kind: 'requirement', origin: 'request', text: 'greet is friendly' }] } });
 write(noRed, 'src/unrelated.test.ts', 'import { it, expect } from "vitest"; it("unrelated", () => expect(1).toBe(1));\n');
 write(noRed, 'src/greet.ts', 'export const greet = () => "friendly";\n');
 const unrelated = call(noRed, 'check', {}, [`--h=${nh}`, '--touched=src/greet.ts']); focused(noRed, nh, unrelated);
 const refused = call(noRed, 'finish', {}, [`--h=${nh}`]); assert.equal(refused.exit, 2); assert.ok(refused.reasons.some(r => r.code === 'no-distinguishing-red'));
 observations.push({ scenario: 'passing unrelated suite without baseline proof', exit: refused.exit, reason: 'no-distinguishing-red', checkedLocal: false });
 const stopped = create();
 let sh = call(stopped, 'open', { profile: 'feature', request: 'a bounded task', lane: 'quick' }).handle;
 call(stopped, 'decide', { h: sh, kind: 'basis', propose: basis });
 const earlier = sh;
 const takeover = call(stopped, 'open', { profile: 'feature', resume: true }); assert.equal(takeover.exit, 3); assert.equal(takeover.questions[0].id, 'takeover-check');
 sh = takeover.handle;
 assert.equal(call(stopped, 'check', {}, [`--h=${earlier}`]).reasons[0].code, 'stale-session');
 assert.equal(call(stopped, 'decide', { h: sh, kind: 'takeover-check', answers: { 'takeover-check': 'stopped' } }).exit, 0);
 observations.push({ scenario: 'built active-chat takeover', question: 'takeover-check', oldHandleFenced: true, chatConfirmationRequired: true });
 const preview = call(stopped, 'stop', {}, [`--h=${sh}`, '--mode=abandon']);
 assert.equal(preview.exit, 3); assert.equal(preview.questions[0].channel, 'chat');
 const kept = call(stopped, 'decide', { h: sh, kind: 'abandon-confirm', answers: { 'abandon-confirm': 'cancel' } }); assert.equal(kept.exit, 0);
 call(stopped, 'stop', {}, [`--h=${sh}`, '--mode=abandon', '--again']);
 const abandoned = call(stopped, 'decide', { h: sh, kind: 'abandon-confirm', answers: { 'abandon-confirm': 'abandon' } }); assert.equal(abandoned.exit, 0);
 assert.equal(Object.values(JSON.parse(readFileSync(join(stopped, '.tenet/state'), 'utf8')).work)[0].state, 'cancelled');
 observations.push({ scenario: 'built abandonment preview, cancel and confirm', previewExit: 3, channel: 'chat', cancelExit: kept.exit, confirmExit: abandoned.exit, finalState: 'cancelled' });
 const importedFrom = create(), importedInto = create();
 const original = call(importedFrom, 'open', { profile: 'investigate', request: 'UNTRUSTED_IMPORT_CANARY' });
 call(importedFrom, 'decide', { h: original.handle, kind: 'config', target: 'style', propose: { value: 'concise' } });
 cpSync(join(importedFrom, '.tenet'), join(importedInto, '.tenet'), { recursive: true });
 const importedBytes = readFileSync(join(importedInto, '.tenet/state'), 'utf8');
 const newStart = call(importedInto, 'open', { profile: 'investigate', request: 'fresh request' });
 assert.equal(newStart.exit, 3, JSON.stringify(newStart)); assert.equal(newStart.questions[0].id, 'quarantine-review');
 assert.equal(readFileSync(join(importedInto, newStart.data.quarantine.path, 'state'), 'utf8'), importedBytes);
 const metadata = call(importedInto, 'decide', { h: newStart.handle, kind: 'adopt', target: 'quarantine', answers: { 'quarantine-review': 'review' } });
 assert.equal(metadata.exit, 0, JSON.stringify(metadata)); assert.equal(JSON.stringify(metadata).includes('UNTRUSTED_IMPORT_CANARY'), false);
 const cleanState = JSON.parse(readFileSync(join(importedInto, '.tenet/state'), 'utf8'));
 assert.deepEqual(cleanState.config.local, {}); assert.deepEqual(cleanState.consents, []); assert.equal(Object.values(cleanState.work).length, 1);
 observations.push({ scenario: 'built copied-state quarantine and metadata review', exit: 3, originalBytesPreserved: true, importedSettingsActive: false, importedAuthorityActive: false, canaryDisclosed: false });
 const prepopulated = create(); mkdirSync(join(prepopulated, '.tenet'));
 write(prepopulated, '.tenet/state', '{"commands":{"unsafe":"never execute"}}'); write(prepopulated, '.tenet/lock', '{"pid":1,"procStart":"imported"}');
 const preOpen = call(prepopulated, 'open', { profile: 'investigate', request: 'fresh start' }); assert.equal(preOpen.exit, 3); assert.ok(preOpen.handle);
 const freshChoice = call(prepopulated, 'decide', { h: preOpen.handle, kind: 'adopt', target: 'quarantine', answers: { 'quarantine-review': 'fresh' } }); assert.equal(freshChoice.exit, 0);
 assert.equal(readFileSync(join(prepopulated, preOpen.data.quarantine.path, 'state'), 'utf8'), '{"commands":{"unsafe":"never execute"}}');
 observations.push({ scenario: 'built markerless-state quarantine and fresh-start choice', exit: freshChoice.exit, entriesPreserved: true, importedLockIgnored: true });
 const damaged = create();
 const dh = call(damaged, 'open', { profile: 'feature', request: 'durable budget', lane: 'quick' }).handle;
 assert.equal(call(damaged, 'decide', { h: dh, kind: 'basis', propose: basis }).exit, 0);
 write(damaged, 'src/greet.test.ts', 'import { expect, it } from "vitest"; import { greet } from "./greet.ts"; it("greets", () => expect(greet("Ada")).toBe("Hello, Ada!"));\n');
 assert.equal(call(damaged, 'check', { h: dh, stage: 'baseline' }).data.receipts[0].status, 'fail');
 for (const value of ['one', 'two', 'three']) {
  write(damaged, 'src/greet.ts', `export const greet = (_name: string): string => ${JSON.stringify(value)};\n`);
  const failed = call(damaged, 'check', {}, [`--h=${dh}`, '--touched=src/greet.ts', '--again']);
  assert.equal(failed.data.receipts[0].status, 'fail', JSON.stringify(failed));
 }
 const beforeDamage = Object.values(JSON.parse(readFileSync(join(damaged, '.tenet/state'), 'utf8')).work)[0];
 assert.equal(beforeDamage.budget.attempts, 3);
 write(damaged, '.tenet/state', '{ corrupt');
 const diagnostic = call(damaged, 'inspect', { h: dh, view: 'why' });
 assert.ok(diagnostic.reasons.some(r => r.code === 'state-recovered-from-backup'));
 assert.equal(readFileSync(join(damaged, '.tenet/state'), 'utf8'), '{ corrupt');
 const refusedRun = call(damaged, 'check', {}, [`--h=${dh}`, '--again']); assert.notEqual(refusedRun.exit, 0);
 call(damaged, 'stop', { h: dh, mode: 'pause' });
 const restoredState = JSON.parse(readFileSync(join(damaged, '.tenet/state'), 'utf8')), restoredWork = Object.values(restoredState.work)[0];
 assert.equal(restoredWork.budget.attempts, beforeDamage.budget.attempts);
 assert.equal(restoredWork.budget.checksLaunched, beforeDamage.budget.checksLaunched);
 assert.equal(restoredWork.grants.length, 0); assert.equal(restoredState.recovered.accounting, 'verified');
 observations.push({ scenario: 'built backup recovery conserves real candidate costs', attemptsBefore: beforeDamage.budget.attempts, attemptsAfter: restoredWork.budget.attempts, checksBefore: beforeDamage.budget.checksLaunched, checksAfter: restoredWork.budget.checksLaunched, accounting: restoredState.recovered.accounting, authoritySuspended: true, additionalAttemptLaunched: false });
 const legacy = create();
 call(legacy, 'open', { profile: 'investigate', request: 'prior records' });
 call(legacy, 'open', { profile: 'investigate', request: 'newer records' });
 const legacyLog = readFileSync(join(legacy, '.tenet/log'), 'utf8').split('\n').filter(line => line && JSON.parse(line).kind !== 'accounting').join('\n') + '\n';
 write(legacy, '.tenet/log', legacyLog); write(legacy, '.tenet/state', '{ corrupt');
 const unknown = call(legacy, 'open', { profile: 'feature', request: 'cannot bypass unknown recovery' });
 assert.equal(unknown.exit, 3); assert.equal(unknown.handle, undefined);
 assert.ok(unknown.reasons.some(r => r.code === 'state-recovered-from-backup' && r.message.includes('unknown')));
 assert.equal(git(legacy, 'branch', '--show-current'), 'main'); assert.equal(readFileSync(join(legacy, '.tenet/state'), 'utf8'), '{ corrupt');
 observations.push({ scenario: 'built unknown legacy accounting fences new editing authority', exit: unknown.exit, handleIssued: false, branchUnchanged: true, recordsUnchanged: true });
 for (const completed of ['commit', 'commit:extra', 'both']) {
  const pendingRoot = create();
  const handle = call(pendingRoot, 'open', { profile: 'feature', request: `pending effect pair ${completed}`, lane: 'quick' }).handle;
  assert.equal(typeof handle, 'string');
  const before = JSON.parse(readFileSync(join(pendingRoot, '.tenet/state'), 'utf8')), work = Object.values(before.work)[0];
  assert.equal(before.sourceOwner.work, work.id);
  const pairs = [{ effect: 'commit', id: 'extra:shared' }, { effect: 'commit:extra', id: 'shared' }];
  const pending = completed === 'both' ? undefined : pairs.find(pair => pair.effect !== completed);
  const records = [...pairs.map(pair => ({ t: new Date().toISOString(), kind: 'intent', ...pair, op: { work: work.id } })),
   ...pairs.filter(pair => completed === 'both' || pair.effect === completed).map(pair => ({ t: new Date().toISOString(), kind: 'result', ...pair, outcome: { completed: false } }))];
  const journal = readFileSync(join(pendingRoot, '.tenet/log'), 'utf8') + records.map(record => JSON.stringify(record)).join('\n') + '\n';
  write(pendingRoot, '.tenet/log', journal);
  const index = git(pendingRoot, 'ls-files', '--stage'), head = git(pendingRoot, 'rev-parse', 'HEAD'), branch = git(pendingRoot, 'branch', '--show-current');
  const implementation = readFileSync(join(pendingRoot, 'src/greet.ts'), 'utf8');
  for (let retry = 0; retry < 2; retry++) {
   const response = call(pendingRoot, 'stop', { h: handle, mode: 'pause' });
   assert.equal(response.exit, pending ? 2 : 0, JSON.stringify(response));
   const current = JSON.parse(readFileSync(join(pendingRoot, '.tenet/state'), 'utf8')), stoppedWork = current.work[work.id];
   if (pending) {
    assert.ok(response.reasons.some(reason => reason.code === 'effect-uncertain'));
    assert.ok(response.effects.uncertain.some(message => message.startsWith(`${pending.effect} ${pending.id}:`)));
    assert.deepEqual(current.sourceOwner, before.sourceOwner); assert.equal(stoppedWork.state, 'blocked');
   } else {
    assert.equal(current.sourceOwner, undefined); assert.equal(stoppedWork.state, 'parked');
    assert.equal(response.effects?.uncertain.length ?? 0, 0);
   }
   assert.deepEqual(stoppedWork.grants, work.grants); assert.deepEqual(current.consents, before.consents);
   assert.equal(stoppedWork.budget.attempts, work.budget.attempts); assert.equal(stoppedWork.budget.checksLaunched, work.budget.checksLaunched);
   assert.ok(readFileSync(join(pendingRoot, '.tenet/log'), 'utf8').startsWith(journal));
  }
  assert.equal(readFileSync(join(pendingRoot, 'src/greet.ts'), 'utf8'), implementation);
  assert.equal(git(pendingRoot, 'ls-files', '--stage'), index); assert.equal(git(pendingRoot, 'rev-parse', 'HEAD'), head);
  assert.equal(git(pendingRoot, 'branch', '--show-current'), branch);
  observations.push({ scenario: `built pending effect pair after ${completed} result`, syntheticJournalRecords: true,
   ownershipRetained: !!pending, journalPrefixPreserved: true, sourceAndIndexPreserved: true, retryVerified: true });
 }
 for (const effect of ['toString', 'constructor', '__proto__', 'hasOwnProperty', '__defineGetter__', 'future-effect']) {
  for (const completed of [false, true]) {
   const recoveryRoot = create(), id = `dispatch-${completed ? 'completed' : 'pending'}`;
   const handle = call(recoveryRoot, 'open', { profile: 'feature', request: 'preserve unknown effect ownership', lane: 'quick' }).handle;
   assert.equal(typeof handle, 'string');
   const before = JSON.parse(readFileSync(join(recoveryRoot, '.tenet/state'), 'utf8')), work = Object.values(before.work)[0];
   const records = [{ t: new Date().toISOString(), kind: 'intent', effect, id, op: { work: work.id } },
    ...(completed ? [{ t: new Date().toISOString(), kind: 'result', effect, id, outcome: { completed: true } }] : [])];
   const journal = readFileSync(join(recoveryRoot, '.tenet/log'), 'utf8') + records.map(record => JSON.stringify(record)).join('\n') + '\n';
   write(recoveryRoot, '.tenet/log', journal);
   const index = git(recoveryRoot, 'ls-files', '--stage'), head = git(recoveryRoot, 'rev-parse', 'HEAD'), branch = git(recoveryRoot, 'branch', '--show-current');
   const implementation = readFileSync(join(recoveryRoot, 'src/greet.ts'), 'utf8');
   for (let retry = 0; retry < 2; retry++) {
    const response = call(recoveryRoot, 'open', { profile: 'investigate', request: 'inspect unknown effect recovery', lane: 'quick' });
    assert.equal(response.exit, completed ? 0 : 2, JSON.stringify(response));
    if (!completed) {
     assert.ok(response.reasons.some(reason => reason.code === 'effect-uncertain'));
     assert.ok(response.effects.uncertain.includes(`${effect} ${id}`));
    } else assert.equal(response.effects?.uncertain.length ?? 0, 0);
    const current = JSON.parse(readFileSync(join(recoveryRoot, '.tenet/state'), 'utf8')), currentWork = current.work[work.id];
    assert.deepEqual(current.sourceOwner, before.sourceOwner); assert.deepEqual(currentWork.grants, work.grants);
    assert.deepEqual(current.consents, before.consents);
    assert.equal(currentWork.budget.attempts, work.budget.attempts); assert.equal(currentWork.budget.checksLaunched, work.budget.checksLaunched);
    assert.deepEqual(Object.values(current.work).filter(entry => entry.id !== work.id).map(entry => entry.profile), completed ? ['investigate'] : []);
    const retained = readFileSync(join(recoveryRoot, '.tenet/log'), 'utf8'); assert.ok(retained.startsWith(journal));
    assert.equal(retained.trim().split('\n').map(line => JSON.parse(line)).filter(record => record.kind === 'result' && record.effect === effect && record.id === id).length, completed ? 1 : 0);
   }
   assert.equal(readFileSync(join(recoveryRoot, 'src/greet.ts'), 'utf8'), implementation);
   assert.equal(git(recoveryRoot, 'ls-files', '--stage'), index); assert.equal(git(recoveryRoot, 'rev-parse', 'HEAD'), head);
   assert.equal(git(recoveryRoot, 'branch', '--show-current'), branch);
   observations.push({ scenario: `built unknown effect ${effect} ${completed ? 'completed' : 'pending'} dispatch`, syntheticJournalRecords: true,
    pendingUncertaintyPreserved: !completed, completedRecordReadable: completed, journalPrefixPreserved: true,
    ownershipAndAuthorityPreserved: true, sourceAndIndexPreserved: true, retryVerified: true });
  }
 }
 for (const conflict of ['in-flight', 'completeness', 'budget', 'sequence', 'identical', 'budget-progress', 'sequence-progress']) {
  const checkpointRoot = create();
  const checkpointHandle = call(checkpointRoot, 'open', { profile: 'investigate', request: `checkpoint retry ${conflict}`, lane: 'quick' }).handle;
  const backup = readFileSync(join(checkpointRoot, '.tenet/state'), 'utf8'), state = JSON.parse(backup), work = Object.values(state.work)[0];
  const originalLog = readFileSync(join(checkpointRoot, '.tenet/log'), 'utf8');
  const actual = originalLog.trim().split('\n').map(line => JSON.parse(line)).findLast(entry => entry.kind === 'accounting');
  assert.ok(actual);
  const point = { ...actual, revision: state.revision + 1, entries: [{ work: work.id, generation: work.session.generation,
   budget: { ...work.budget, attempts: 1, checksLaunched: 1 } }] };
  const changed = conflict === 'in-flight' ? { ...point, inFlight: [work.id] } :
   conflict === 'completeness' ? { ...point, complete: false } :
  conflict.startsWith('sequence') ? { ...point, workSeq: point.workSeq + 1, generationSeq: point.generationSeq + 1 } :
  conflict.startsWith('budget') ? { ...point, entries: point.entries.map(entry => ({ ...entry, budget: { ...entry.budget, attempts: 2 } })) } : point;
  const advancing = conflict.endsWith('-progress');
  const journal = originalLog + JSON.stringify(advancing ? point : changed) + '\n' + JSON.stringify({ ...(advancing ? changed : point), t: 'retry' }) + '\n';
  write(checkpointRoot, '.tenet/state.prev', backup); write(checkpointRoot, '.tenet/state', '{ corrupt'); write(checkpointRoot, '.tenet/log', journal);
  const index = git(checkpointRoot, 'ls-files', '--stage'), head = git(checkpointRoot, 'rev-parse', 'HEAD');
  const implementation = readFileSync(join(checkpointRoot, 'src/greet.ts'), 'utf8');
  const diagnostic = call(checkpointRoot, 'inspect', { h: checkpointHandle, view: 'why' });
  assert.equal(diagnostic.exit, 3, JSON.stringify(diagnostic));
  const accounting = conflict === 'identical' || advancing ? 'verified' : 'unknown';
  assert.ok(diagnostic.reasons.some(reason => reason.code === 'state-recovered-from-backup' && reason.message.includes(accounting)));
  assert.match(diagnostic.budget.attempts, new RegExp(`^${conflict.startsWith('budget') ? 2 : 1}/`));
  if (accounting === 'unknown') {
   const denied = call(checkpointRoot, 'open', { profile: 'feature', request: 'cannot bypass conflicting accounting' });
   assert.equal(denied.exit, 3, JSON.stringify(denied)); assert.equal(denied.handle, undefined);
   assert.ok(denied.reasons.some(reason => reason.code === 'state-recovered-from-backup' && reason.message.includes('unknown')));
  }
  assert.equal(readFileSync(join(checkpointRoot, '.tenet/state'), 'utf8'), '{ corrupt');
  assert.equal(readFileSync(join(checkpointRoot, '.tenet/state.prev'), 'utf8'), backup);
  assert.equal(readFileSync(join(checkpointRoot, '.tenet/log'), 'utf8'), journal);
  assert.equal(readFileSync(join(checkpointRoot, 'src/greet.ts'), 'utf8'), implementation);
  assert.equal(git(checkpointRoot, 'ls-files', '--stage'), index); assert.equal(git(checkpointRoot, 'rev-parse', 'HEAD'), head);
  assert.equal(git(checkpointRoot, 'branch', '--show-current'), 'main');
  observations.push({ scenario: `built backup checkpoint ${conflict} retry`, accounting, spentAttempts: conflict.startsWith('budget') ? 2 : 1,
   syntheticCheckpoints: true, recordsUnchanged: true, indexAndContentPreserved: true, handleIssued: false });
 }
 for (const point of ['predictable-temp-link', 'after-temp-fsync', 'after-publish', 'after-dir-fsync', 'unreadable-recovery']) {
  const adoption = create(), outside = mkdtempSync(join(tmpdir(), 'tenet-c0-fact-outside-')); roots.push(outside);
  write(outside, 'private', 'PRIVATE_PROJECT_WRITE_CANARY');
  const ah = call(adoption, 'open', { profile: 'feature', request: 'atomic intent adoption', lane: 'quick' }).handle;
  assert.equal(call(adoption, 'decide', { h: ah, kind: 'basis', propose: basis }).exit, 0);
  assert.equal(call(adoption, 'decide', { h: ah, kind: 'adopt', target: 'intent' }).questions[0].id, 'adopt-confirm');
  const confirm = { h: ah, kind: 'adopt', target: 'intent', answers: { 'adopt-confirm': 'confirm' } };
  const action = spawnSync(process.execPath, [join(source, 'tools/uat/crash-bundle-project.mjs'), bundle, point === 'unreadable-recovery' ? 'after-temp-fsync' : point, join(outside, 'private'), 'decide'], { cwd: adoption, env, input: JSON.stringify(confirm), encoding: 'utf8' });
  if (point === 'predictable-temp-link') { assert.equal(action.signal, null); assert.equal(action.status, 0, action.stderr + action.stdout); }
  else assert.equal(action.signal, 'SIGKILL', action.stderr + action.stdout);
  assert.equal(readFileSync(join(outside, 'private'), 'utf8'), 'PRIVATE_PROJECT_WRITE_CANARY');
  if (point === 'unreadable-recovery') {
   symlinkSync(join(outside, 'private'), join(adoption, 'INTENT.md'));
   const blocked = call(adoption, 'open', { profile: 'investigate', request: 'unreadable recovery' });
   assert.equal(blocked.exit, 2); assert.ok(blocked.reasons.some(r => r.code === 'effect-uncertain'));
   assert.equal(JSON.stringify(blocked).includes('PRIVATE_PROJECT_WRITE_CANARY'), false);
   const stop = call(adoption, 'stop', { h: ah, mode: 'pause' });
   assert.equal(stop.exit, 2); assert.ok(stop.reasons.some(r => r.code === 'effect-uncertain'));
   assert.equal(readFileSync(join(outside, 'private'), 'utf8'), 'PRIVATE_PROJECT_WRITE_CANARY');
   const state = JSON.parse(readFileSync(join(adoption, '.tenet/state'), 'utf8'));
   assert.notEqual(state.project.adoption.intent, 'adopted'); assert.ok(state.sourceOwner);
   observations.push({ scenario: 'built unreadable adoption remains uncertain through stop', exit: stop.exit, authorityRetainedAsFence: true, outsideBytesPreserved: true, canaryDisclosed: false });
  } else {
   if (point !== 'predictable-temp-link') assert.equal(call(adoption, 'decide', confirm).exit, 0);
   const state = JSON.parse(readFileSync(join(adoption, '.tenet/state'), 'utf8'));
   assert.equal(state.project.adoption.intent, 'adopted'); assert.equal(state.trust.filter(t => t.file === 'INTENT.md').length, 1);
   const text = readFileSync(join(adoption, 'INTENT.md'), 'utf8'); assert.equal((text.match(/tenet:begin REQ-/g) || []).length, 1);
   observations.push({ scenario: `built atomic project write ${point}`, killedAtBoundary: point !== 'predictable-temp-link', adoptedOnce: true, outsideBytesPreserved: true });
  }
 }
 const aliased = create(); write(aliased, '.env', 'PRIVATE_ALIAS_CANARY'); symlinkSync('.env', join(aliased, 'INTENT.md'));
 const aliasHandle = call(aliased, 'open', { profile: 'investigate', request: 'safe shared file read' }).handle;
 const aliasRefusal = call(aliased, 'decide', { h: aliasHandle, kind: 'adopt', target: 'intent' });
 assert.equal(aliasRefusal.exit, 2); assert.ok(aliasRefusal.reasons.some(r => r.code === 'capability-missing'));
 assert.equal(JSON.stringify(aliasRefusal).includes('PRIVATE_ALIAS_CANARY'), false);
 observations.push({ scenario: 'built secret alias is refused before adoption preview', exit: aliasRefusal.exit, canaryDisclosed: false });
 for (const adopted of [false, true]) {
 const scaffoldStop = mkdtempSync(join(tmpdir(), 'tenet-c0-partial-scaffold-')); roots.push(scaffoldStop);
 git(scaffoldStop, 'init', '-q', '-b', 'main'); git(scaffoldStop, 'config', 'user.name', 'Test'); git(scaffoldStop, 'config', 'user.email', 'test@example.com'); git(scaffoldStop, 'config', 'commit.gpgsign', 'false');
 write(scaffoldStop, 'NOTES.txt', 'preserve my note\n'); git(scaffoldStop, 'add', '-A'); git(scaffoldStop, 'commit', '-qm', 'initial');
 const ssh = call(scaffoldStop, 'open', { profile: 'feature', request: 'new app', lane: 'quick' }).handle;
 assert.equal(call(scaffoldStop, 'decide', { h: ssh, kind: 'basis', propose: { outcome: 'starter platform', elements: [{ ref: 'r', kind: 'requirement', origin: 'request', text: 'starter platform' }] } }).exit, 0);
 if (adopted) {
  write(scaffoldStop, 'tenet.policy.json', '{}');
  assert.equal(call(scaffoldStop, 'decide', { h: ssh, kind: 'adopt', target: 'policy' }).exit, 3);
  assert.equal(call(scaffoldStop, 'decide', { h: ssh, kind: 'adopt', target: 'policy', answers: { 'adopt-confirm': 'confirm' } }).exit, 0);
 }
 const killedScaffold = spawnSync(process.execPath, [join(source, 'tools/uat/crash-bundle-project.mjs'), bundle, 'after-first-link', '-', 'decide'], { cwd: scaffoldStop, env, input: JSON.stringify({ h: ssh, kind: 'scaffold' }), encoding: 'utf8' });
 assert.equal(killedScaffold.signal, 'SIGKILL', killedScaffold.stderr + killedScaffold.stdout);
 const intent = readFileSync(join(scaffoldStop, '.tenet/log'), 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)).find(e => e.kind === 'intent' && e.effect === 'scaffold');
 const first = Object.keys(intent.op.expected).find(path => existsSync(join(scaffoldStop, path))); assert.ok(first);
 const firstBytes = readFileSync(join(scaffoldStop, first));
 write(scaffoldStop, 'tenet.policy.json', JSON.stringify({ exclusions: [{ pattern: first, kinds: ['no-read', 'no-edit'] }] }));
 const stopScaffold = call(scaffoldStop, 'stop', { h: ssh, mode: 'pause' });
 assert.equal(stopScaffold.exit, 2); assert.ok(stopScaffold.reasons.some(r => r.code === 'effect-uncertain'));
 assert.deepEqual(readFileSync(join(scaffoldStop, first)), firstBytes);
 assert.equal(call(scaffoldStop, 'open', { profile: 'investigate', request: 'policy-aware reconciliation' }).exit, 2);
 assert.deepEqual(readFileSync(join(scaffoldStop, first)), firstBytes);
 observations.push({ scenario: `built stop preserves interrupted scaffold under tighter ${adopted ? 'adopted ' : ''}policy`, exit: stopScaffold.exit, partialFilePreserved: true, pendingEffectRetained: true, installLaunched: false });
 }
 const hostileLint = create();
 rmSync(join(hostileLint, 'node_modules')); mkdirSync(join(hostileLint, 'node_modules'));
 symlinkSync(join(source, 'node_modules/vitest'), join(hostileLint, 'node_modules/vitest'));
 write(hostileLint, 'node_modules/eslint/package.json', '{"type":"module","version":"9.39.1"}');
 write(hostileLint, 'node_modules/eslint/bin/eslint.js', 'import fs from "node:fs"; const report=process.argv[process.argv.indexOf("--output-file")+1]; fs.writeFileSync(report,JSON.stringify([{filePath:"src/greet.ts",errorCount:1,messages:[]}])); process.exitCode=1;\n');
 write(hostileLint, 'tenet.policy.json', JSON.stringify({ required_checks: [{ id: 'lint', tool: 'eslint', property: 'no lint errors' }] }));
 const lh = call(hostileLint, 'open', { profile: 'feature', request: 'lint report integrity', lane: 'quick' }).handle;
 assert.equal(call(hostileLint, 'decide', { h: lh, kind: 'basis', propose: basis }).exit, 0);
 write(hostileLint, 'src/greet.test.ts', 'import { expect, it } from "vitest"; import { greet } from "./greet.ts"; it("greets", () => expect(greet("Ada")).toBe("Hello, Ada!"));\n');
 write(hostileLint, 'src/greet.ts', 'export const greet = (name: string): string => `Hello, ${name}!`;\n');
 const checkedLint = call(hostileLint, 'check', {}, [`--h=${lh}`, '--touched=src/greet.ts']);
 assert.equal(checkedLint.data.receipts.find(r => r.obligation === 'OB-suite').status, 'pass');
 const lintReceipt = checkedLint.data.receipts.find(r => r.obligation === 'OB-lint');
 assert.equal(lintReceipt.status, 'inconclusive'); assert.ok(lintReceipt.reasons.includes('report-invalid'));
 assert.equal(checkedLint.data.review, undefined);
 observations.push({ scenario: 'built contradictory lint child cannot produce a passing receipt', syntheticTool: true, programExit: 1, reportedErrors: 1, diagnosticMessages: 0, receipt: lintReceipt.status, reason: 'report-invalid' });
 const configuredTypes = create();
 const compilerOptions = { strict: true, module: 'NodeNext', target: 'ES2023', noEmit: true, skipLibCheck: true, types: [] };
 write(configuredTypes, 'tsconfig.json', JSON.stringify({ compilerOptions, include: ['src/greet.ts'] }));
 write(configuredTypes, 'tsconfig.required.json', JSON.stringify({ compilerOptions, include: ['server/**/*.ts'] }));
 write(configuredTypes, 'server/broken.ts', 'export const n: number = "not a number";\n');
 write(configuredTypes, 'tenet.policy.json', JSON.stringify({ required_checks: [
  { id: 'types', tool: 'tsc', property: 'server compiles', configuration: 'tsconfig.required.json', population: 'server/**/*.ts' },
 ] }));
 const tsc = join(configuredTypes, 'node_modules/typescript/bin/tsc');
 const defaultConfig = spawnSync(process.execPath, [tsc, '--noEmit', '--pretty', 'false', '-p', 'tsconfig.json'], { cwd: configuredTypes, env });
 const requiredConfig = spawnSync(process.execPath, [tsc, '--noEmit', '--pretty', 'false', '-p', 'tsconfig.required.json'], { cwd: configuredTypes, env });
 assert.equal(defaultConfig.status, 0); assert.equal(requiredConfig.status, 2);
 const th = call(configuredTypes, 'open', { profile: 'feature', request: 'check the required configuration', lane: 'quick' }).handle;
 assert.equal(call(configuredTypes, 'decide', { h: th, kind: 'basis', propose: basis }).exit, 0);
 const refusedTypes = call(configuredTypes, 'check', { h: th, stage: 'candidate' });
 assert.equal(refusedTypes.exit, 2); assert.ok(refusedTypes.reasons.some(r => r.code === 'capability-missing' && /types/.test(r.message)));
 const typesWork = Object.values(JSON.parse(readFileSync(join(configuredTypes, '.tenet/state'), 'utf8')).work)[0];
 assert.equal(typesWork.budget.checksLaunched, 0); assert.equal(typesWork.receipts.length, 0);
 observations.push({ scenario: 'built named static configuration refuses substitution', defaultConfigExit: 0, requiredConfigExit: 2, admissionExit: 2, substituteLaunched: false, receiptIssued: false });
 for (const custom of [false, true]) {
  const hooked = create(), dir = custom ? '.githooks' : '.git/hooks';
  if (custom) git(hooked, 'config', 'core.hooksPath', dir);
  write(hooked, `${dir}/post-checkout`, '#!/bin/sh\nprintf ran > CHECKOUT_HOOK_RAN\n'); chmodSync(join(hooked, dir, 'post-checkout'), 0o755);
  const bh = call(hooked, 'open', { profile: 'feature', request: 'branch hook admission', lane: 'quick' }).handle;
  const blockedBasis = call(hooked, 'decide', { h: bh, kind: 'basis', propose: basis });
  assert.equal(blockedBasis.exit, 2, JSON.stringify(blockedBasis)); assert.ok(blockedBasis.reasons.some(r => r.code === 'capability-missing'));
  assert.equal(git(hooked, 'branch', '--show-current'), 'main'); assert.equal(existsSync(join(hooked, 'CHECKOUT_HOOK_RAN')), false);
  assert.equal(call(hooked, 'decide', { h: bh, kind: 'config', target: 'branching', propose: { value: 'current' } }).exit, 0);
  assert.equal(call(hooked, 'decide', { h: bh, kind: 'basis', propose: basis }).exit, 0);
  assert.equal(git(hooked, 'branch', '--show-current'), 'main'); assert.equal(existsSync(join(hooked, 'CHECKOUT_HOOK_RAN')), false);
  observations.push({ scenario: `built ${custom ? 'configured' : 'default'} checkout-hook admission`, exit: blockedBasis.exit, hookLaunched: false, branchUnchanged: true, explicitCurrentBranchAccepted: true });
 }
 for (const point of ['before-lock', 'after-lock', 'before-rename', 'after-rename', 'manual-after-lock', 'failed-directory-sync']) {
  const interrupted = create();
  write(interrupted, 'human.txt', 'human staging survives\n'); git(interrupted, 'add', 'human.txt');
  const human = git(interrupted, 'diff', '--cached', '--', 'human.txt');
  const ch = call(interrupted, 'open', { profile: 'feature', request: 'index crash recovery', lane: 'quick' }).handle;
  assert.equal(call(interrupted, 'decide', { h: ch, kind: 'basis', propose: basis }).exit, 0);
  write(interrupted, 'src/greet.test.ts', 'import { expect, it } from "vitest"; import { greet } from "./greet.ts"; it("greets", () => expect(greet("Ada")).toBe("Hello, Ada!"));\n');
  assert.equal(call(interrupted, 'check', { h: ch, stage: 'baseline' }).data.receipts[0].status, 'fail');
  write(interrupted, 'src/greet.ts', 'export const greet = (name: string): string => `Hello, ${name}!`;\n');
  const checked = call(interrupted, 'check', {}, [`--h=${ch}`, '--touched=src/greet.ts']);
  assert.equal(checked.data.receipts[0].status, 'pass'); focused(interrupted, ch, checked);
  let args = ['finish', `--h=${ch}`, '--subject=Index recovery'], input = '';
  if (point === 'manual-after-lock') {
   writeFileSync(join(interrupted, '.git/index.lock'), 'another Git client', { flag: 'wx' });
   const finished = call(interrupted, 'finish', {}, [`--h=${ch}`, '--subject=Index recovery']);
   assert.equal(finished.data.endpoint, 'checked-local', JSON.stringify(finished));
   assert.ok(finished.reasons.some(r => r.code === 'index-sync-needed'));
   rmSync(join(interrupted, '.git/index.lock'));
   args = ['decide']; input = JSON.stringify({ h: ch, kind: 'sync-index' });
  }
  const killed = spawnSync(process.execPath, [join(source, 'tools/uat/crash-bundle-index.mjs'), bundle, point === 'manual-after-lock' ? 'after-lock' : point, ...args], { cwd: interrupted, env, input, encoding: 'utf8' });
  if (point === 'failed-directory-sync') {
   assert.equal(killed.signal, null); assert.equal(killed.status, 2, killed.stderr + killed.stdout);
   assert.ok(JSON.parse(killed.stdout).reasons.some(r => r.code === 'effect-uncertain'));
  } else assert.equal(killed.signal, 'SIGKILL', killed.stderr + killed.stdout);
  const head = git(interrupted, 'rev-parse', 'HEAD');
  assert.ok(readFileSync(join(interrupted, '.tenet/log'), 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)).some(e => e.kind === 'intent' && e.effect === 'index-sync'));
  const recovered = call(interrupted, 'open', { profile: 'investigate', request: 'recover interrupted index sync' });
  assert.equal(recovered.exit, 0, JSON.stringify(recovered));
  assert.equal(git(interrupted, 'rev-parse', 'HEAD'), head); assert.equal(git(interrupted, 'rev-list', '--count', 'HEAD'), '2');
  assert.equal(git(interrupted, 'diff', '--cached', '--', 'human.txt'), human);
  assert.equal(git(interrupted, 'diff', '--cached', '--', 'src/'), '');
  assert.equal(existsSync(join(interrupted, '.git/index.lock')), false);
  assert.deepEqual(readdirSync(join(interrupted, '.git')).filter(p => p.startsWith('tenet-index-')), []);
  observations.push({ scenario: `built index recovery ${point}`, killedAtBoundary: point !== 'failed-directory-sync', directorySyncFailure: point === 'failed-directory-sync', commitCount: 2, duplicateCommit: false, humanStagingPreserved: true, indexSyncRecovered: true });
 }
 // Git LFS installs filters into the user's own configuration; they must not stop the kernel from reading or opening.
 const lfsRoot = create(), lfsConfig = join(lfsRoot, '..', `${lfsRoot.split('/').pop()}.gitconfig`);
 writeFileSync(lfsConfig, '[filter "lfs"]\n\tclean = git-lfs clean -- %f\n\tsmudge = git-lfs smudge -- %f\n\tprocess = git-lfs filter-process\n\trequired = true\n');
 const lfsRun = (verb, body) => JSON.parse(spawnSync(process.execPath, [bundle, verb], { cwd: lfsRoot, env: { ...env, GIT_CONFIG_GLOBAL: lfsConfig }, input: JSON.stringify(body), encoding: 'utf8' }).stdout);
 const lfsOpen = lfsRun('open', { profile: 'feature', request: 'greeting', scopePaths: ['src/greet.ts'] });
 assert.equal(lfsOpen.exit, 0, JSON.stringify(lfsOpen)); assert.equal(lfsRun('review', {}).exit, 0);
 rmSync(lfsConfig, { force: true });
 observations.push({ scenario: 'user-level Git LFS filter configuration', openExit: lfsOpen.exit, filterRan: false });
 for (const mode of ['pass', 'transform', 'mutate', 'stop', 'killed']) {
  const filtered = create(), scripts = mkdtempSync(join(tmpdir(), 'tenet-filter-uat-')); roots.push(scripts);
  write(filtered, '.gitattributes', 'src/greet.ts filter=audit\n'); write(filtered, 'human.txt', 'human initial\n');
  git(filtered, 'add', '-A'); git(filtered, 'commit', '-qm', 'attributes');
  write(filtered, 'human.txt', 'human staged\n'); git(filtered, 'add', 'human.txt');
  const marker = join(scripts, 'observed'), script = join(scripts, 'filter.cjs');
  const body = mode === 'transform' ? "process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('untested transformed bytes'));"
   : mode === 'mutate' ? "require('fs').writeFileSync('human.txt','filter changed human bytes');process.stdin.pipe(process.stdout);"
   : ['stop', 'killed'].includes(mode) ? "process.on('SIGTERM',()=>{});setInterval(()=>{},1000);" : 'process.stdin.pipe(process.stdout);';
  writeFileSync(script, `require('fs').appendFileSync(${JSON.stringify(marker)},JSON.stringify({CI:process.env.CI,canary:process.env.TENET_FILTER_CANARY})+'\\n');${body}`);
  git(filtered, 'config', 'filter.audit.clean', `"${process.execPath}" "${script}"`); git(filtered, 'config', 'filter.audit.required', 'true');
  const fh = call(filtered, 'open', { profile: 'feature', request: 'guarded filter', lane: 'quick' }).handle;
  assert.equal(call(filtered, 'decide', { h: fh, kind: 'basis', propose: basis }).exit, 0);
  write(filtered, 'src/greet.test.ts', 'import { expect, it } from "vitest"; import { greet } from "./greet.ts"; it("greets", () => expect(greet("Ada")).toBe("Hello, Ada!"));\n');
  assert.equal(call(filtered, 'check', { h: fh, stage: 'baseline' }).data.receipts[0].status, 'fail');
  write(filtered, 'src/greet.ts', 'export const greet = (name: string): string => `Hello, ${name}!`;\n');
  const candidate = call(filtered, 'check', { h: fh, stage: 'candidate' }, ['--touched=src/greet.ts']);
  assert.equal(candidate.data.receipts[0].status, 'pass'); focused(filtered, fh, candidate);
  assert.equal(call(filtered, 'finish', { h: fh }).questions[0].id, 'filter-consent'); assert.equal(existsSync(marker), false);
  assert.equal(call(filtered, 'decide', { h: fh, kind: 'filter-consent', answers: { 'filter-consent': 'allow-filters' } }).exit, 0);
  const head = git(filtered, 'rev-parse', 'HEAD'), index = readFileSync(join(filtered, '.git/index'));
  if (['stop', 'killed'].includes(mode)) {
   const child = spawn(process.execPath, [bundle, 'finish', `--h=${fh}`], { cwd: filtered, env, stdio: ['ignore', 'pipe', 'pipe'] });
   let stdout = ''; child.stdout.on('data', b => { stdout += b; }); child.stderr.resume();
   const done = new Promise(resolve => child.on('close', (code, signal) => resolve({ code, signal })));
   let record;
   try {
    await waitUntil(() => existsSync(marker), 'filter launch');
    const state = JSON.parse(readFileSync(join(filtered, '.tenet/state'), 'utf8'));
    const inCall = Object.values(state.work).find(w => w.session.inCall)?.session.inCall;
    assert.equal(inCall.verb, 'commit'); record = JSON.parse(readFileSync(join(inCall.runDir, 'run.json'), 'utf8')); assert.ok(record.pid && record.procStart);
    if (mode === 'killed') { child.kill('SIGKILL'); assert.equal((await done).signal, 'SIGKILL'); }
    const stopped = call(filtered, 'stop', { h: fh, mode: 'cancel' });
    assert.equal(stopped.exit, 2); assert.ok(stopped.reasons.some(r => r.code === 'effect-uncertain'));
    if (mode === 'stop') { await done; assert.ok(JSON.parse(stdout).reasons.some(r => r.code === 'run-superseded')); }
    await waitUntil(() => { try { process.kill(record.pid, 0); return false; } catch { return true; } }, 'filter group stopped');
    const recovered = call(filtered, 'open', { profile: 'feature', request: 'guarded filter', resume: true });
    assert.ok(recovered.effects.completed.some(e => /did not happen/.test(e)), JSON.stringify(recovered));
    assert.equal(git(filtered, 'rev-parse', 'HEAD'), head); assert.deepEqual(readFileSync(join(filtered, '.git/index')), index);
    assert.equal(readFileSync(marker, 'utf8').trim().split('\n').length, 1);
    assert.equal(readFileSync(join(filtered, 'human.txt'), 'utf8'), 'human staged\n');
    observations.push({ scenario: `built guarded filter ${mode}`, processRecorded: true, stoppedBeforeCommit: true, recoveryDidNotReplay: true, humanStagingPreserved: true });
   } finally { child.kill('SIGKILL'); if (record) try { process.kill(-record.pid, 'SIGKILL'); } catch { /* already gone */ } }
  } else {
   env.TENET_FILTER_CANARY = 'synthetic-do-not-pass';
   let finished;
   try { finished = call(filtered, 'finish', { h: fh }); } finally { delete env.TENET_FILTER_CANARY; }
   const ran = readFileSync(marker, 'utf8').trim().split('\n').map(s => JSON.parse(s));
   assert.ok(ran.length && ran.every(e => e.CI === '1' && e.canary === undefined));
   if (mode === 'pass') {
    assert.equal(finished.data.endpoint, 'checked-local', JSON.stringify(finished));
    assert.deepEqual(git(filtered, 'show', '--name-only', '--format=', 'HEAD').split('\n').sort(), ['src/greet.test.ts', 'src/greet.ts']);
   } else {
    assert.equal(git(filtered, 'rev-parse', 'HEAD'), head); assert.deepEqual(readFileSync(join(filtered, '.git/index')), index);
    assert.ok(finished.reasons.some(r => r.code === (mode === 'transform' ? 'capability-missing' : 'hook-failed')), JSON.stringify(finished));
    if (mode === 'mutate') assert.notEqual(finished.data.endpoint, 'checked-local');
   }
   assert.equal(readFileSync(join(filtered, 'human.txt'), 'utf8'), mode === 'mutate' ? 'filter changed human bytes' : 'human staged\n');
   observations.push({ scenario: `built guarded filter ${mode}`, endpoint: finished.data.endpoint, scope: finished.data.scope, minimalEnvironment: true, headChanged: git(filtered, 'rev-parse', 'HEAD') !== head, humanBytesPreserved: mode !== 'mutate', filterMutationPreserved: mode === 'mutate' });
  }
 }
 const doctorPolicy = create();
 write(doctorPolicy, 'tenet.policy.json', JSON.stringify({ exclusions: [{ pattern: 'package.json', kinds: ['no-read'] }] }));
 const doctorRefusal = call(doctorPolicy, 'inspect', { view: 'doctor' });
 assert.equal(doctorRefusal.exit, 2); assert.ok(doctorRefusal.reasons.some(r => r.code === 'capability-missing'));
 assert.equal(existsSync(join(doctorPolicy, '.tenet')), false);
 write(doctorPolicy, 'tenet.policy.json', 'invalid'); assert.equal(call(doctorPolicy, 'inspect', { view: 'help' }).exit, 0);
 observations.push({ scenario: 'built stateless doctor honors metadata exclusions', exit: doctorRefusal.exit, metadataRefused: true, noStateWritten: true, helpIndependent: true });
 const conflict = create(), required = { id: 'types', property: 'project compiles', tool: 'tsc' };
 write(conflict, 'tenet.policy.json', JSON.stringify({ required_checks: [required] }));
 const conflictHandle = call(conflict, 'open', { profile: 'feature', request: 'required check conflict', lane: 'quick' }).handle;
 assert.equal(call(conflict, 'decide', { h: conflictHandle, kind: 'basis', propose: basis }).exit, 0);
 assert.equal(call(conflict, 'decide', { h: conflictHandle, kind: 'config', target: 'required_checks', propose: { value: [{ ...required, population: 'server/**/*.ts' }] } }).exit, 0);
 const conflictCheck = call(conflict, 'check', { h: conflictHandle, stage: 'baseline' });
 assert.equal(conflictCheck.exit, 2); assert.ok(conflictCheck.reasons.some(r => /defined differently/.test(r.message)));
 const conflictWork = Object.values(JSON.parse(readFileSync(join(conflict, '.tenet/state'), 'utf8')).work)[0];
 assert.equal(conflictWork.budget.checksLaunched, 0); assert.equal(conflictWork.receipts.length, 0);
 observations.push({ scenario: 'built conflicting required definitions refuse before launch', exit: conflictCheck.exit, launched: 0, receipts: 0 });
 for (const mode of ['default', 'ignored-input', 'references']) {
  const typed = create();
  write(typed, 'tenet.policy.json', JSON.stringify({ required_checks: [required] }));
  const config = { compilerOptions: { strict: true, module: 'NodeNext', target: 'ES2023', allowImportingTsExtensions: true, skipLibCheck: true, types: [], incremental: true }, include: ['src', 'ignored.ts'] };
  write(typed, 'tsconfig.json', JSON.stringify(mode === 'references' ? { files: [], references: [{ path: './server' }] } : config));
  write(typed, 'tsconfig.tsbuildinfo', 'human build info');
  if (mode === 'references') { write(typed, 'server/tsconfig.json', '{"compilerOptions":{"composite":true}}'); write(typed, 'server/bad.ts', 'export const n: number = "bad";'); }
  if (mode === 'ignored-input') { write(typed, '.gitignore', 'node_modules\n.tenet/\nignored.ts\n'); write(typed, 'ignored.ts', 'export const hidden = 1;'); }
  git(typed, 'add', '-A'); git(typed, 'commit', '-qm', 'static profile setup');
  const { h, checked, receipt } = staticCandidate(typed, `static ${mode}`);
  assert.ok(receipt, JSON.stringify(checked));
  if (mode === 'default') {
   assert.equal(receipt.status, 'pass', JSON.stringify(receipt));
   assert.deepEqual(receipt.analyzedFiles.slice().sort(), ['src/greet.test.ts', 'src/greet.ts']);
   assert.ok(receipt.argv.includes('--listFiles')); assert.ok(receipt.argv.includes('--project'));
   focused(typed, h, checked); assert.equal(call(typed, 'finish', { h }, ['--no-commit']).data.endpoint, 'checked-local');
  } else {
   assert.equal(receipt.status, 'inconclusive', JSON.stringify(receipt));
   assert.ok(receipt.reasons.includes(mode === 'references' ? 'not-executed' : 'population-mismatch'));
   assert.notEqual(call(typed, 'finish', { h }, ['--no-commit']).data.endpoint, 'checked-local');
  }
  assert.equal(readFileSync(join(typed, 'tsconfig.tsbuildinfo'), 'utf8'), 'human build info');
  observations.push({ scenario: `built TypeScript ${mode} population`, receipt: receipt.status, analyzedFiles: receipt.analyzedFiles || [], reasons: receipt.reasons, buildInfoPreserved: true });
 }
 for (const version of ['99.0.0', '5.9.3']) {
  const fakeTypes = create(); rmSync(join(fakeTypes, 'node_modules'));
  mkdirSync(join(fakeTypes, 'node_modules')); symlinkSync(join(source, 'node_modules/vitest'), join(fakeTypes, 'node_modules/vitest'));
  write(fakeTypes, 'node_modules/typescript/package.json', JSON.stringify({ version }));
  write(fakeTypes, 'node_modules/typescript/bin/tsc', "require('fs').writeFileSync('node_modules/compiler-invoked','yes');process.stdout.write(process.cwd()+'/src/greet.ts\\n'+' '.repeat(11*1024*1024));");
  write(fakeTypes, 'tenet.policy.json', JSON.stringify({ required_checks: [required] }));
  const { h, receipt } = staticCandidate(fakeTypes, `static version ${version}`);
  assert.equal(receipt.status, 'inconclusive', JSON.stringify(receipt));
  assert.ok(receipt.reasons.includes(version === '99.0.0' ? 'not-executed' : 'report-invalid'));
  assert.equal(existsSync(join(fakeTypes, 'node_modules/compiler-invoked')), version === '5.9.3');
  assert.notEqual(call(fakeTypes, 'finish', { h }, ['--no-commit']).data.endpoint, 'checked-local');
  observations.push({ scenario: `built synthetic compiler ${version === '99.0.0' ? 'unsupported version' : 'truncated valid prefix'}`, receipt: receipt.status, reasons: receipt.reasons, childLaunched: version === '5.9.3', syntheticTool: true });
 }
 for (const mode of ['fifo', 'fifo-reader', 'directory', 'link', 'regular']) {
  const artifactInput = create(), traceRoot = mkdtempSync(join(tmpdir(), 'tenet-artifact-write-')); roots.push(traceRoot);
  rmSync(join(artifactInput, 'node_modules'));
  write(artifactInput, 'node_modules/vitest/package.json', '{"version":"5.0.5"}');
  write(artifactInput, 'node_modules/vitest/vitest.mjs', 'import fs from "node:fs"; fs.writeFileSync("node_modules/artifact-child", "launched"); process.exit(1);');
  const handle = call(artifactInput, 'open', { profile: 'feature', request: `private artifact ${mode} admission`, lane: 'quick' }).handle;
  assert.equal(call(artifactInput, 'decide', { h: handle, kind: 'basis', propose: basis }).exit, 0);
  write(artifactInput, 'src/greet.test.ts', 'export const artifactAdmissionControl = true;\n');
  const asked = call(artifactInput, 'check', { h: handle, stage: 'baseline' }, [], false);
  assert.ok(asked.questions?.some(question => question.id === 'envelope-consent'), JSON.stringify(asked));
  assert.equal(call(artifactInput, 'decide', { h: handle, kind: 'envelope-consent', answers: { 'envelope-consent': 'allow-envelope' } }).exit, 0);
  const state = readFileSync(join(artifactInput, '.tenet/state'), 'utf8'), implementation = readFileSync(join(artifactInput, 'src/greet.ts'), 'utf8');
  const index = git(artifactInput, 'ls-files', '--stage'), head = git(artifactInput, 'rev-parse', 'HEAD'), branch = git(artifactInput, 'branch', '--show-current');
  const trace = join(traceRoot, 'path');
  const result = spawnSync(process.execPath, [join(source, 'tools/uat/crash-bundle-project.mjs'), bundle,
   `artifact-${mode}`, trace, 'check', `--h=${handle}`, '--stage=baseline'], { cwd: artifactInput, env, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.error, undefined, result.error?.message); assert.equal(result.signal, null, result.stderr);
  const response = JSON.parse(result.stdout); assert.equal(result.status, response.exit, result.stderr);
  const artifactPath = readFileSync(trace, 'utf8'); roots.push(join(artifactPath, '..'));
  const current = JSON.parse(readFileSync(join(artifactInput, '.tenet/state'), 'utf8')), work = Object.values(current.work)[0];
  if (mode === 'regular') {
   assert.equal(existsSync(join(artifactInput, 'node_modules/artifact-child')), true);
   assert.equal(work.receipts.length, 1); assert.equal(work.receipts[0].status, 'inconclusive');
   assert.equal(lstatSync(artifactPath).isFile(), true);
   assert.equal(JSON.parse(readFileSync(artifactPath, 'utf8')).prepared, undefined);
  } else {
   assert.notEqual(response.exit, 0); assert.equal(existsSync(join(artifactInput, 'node_modules/artifact-child')), false);
   assert.equal(readFileSync(join(artifactInput, '.tenet/state'), 'utf8'), state); assert.equal(work.receipts.length, 0);
   if (mode.startsWith('fifo')) assert.equal(lstatSync(artifactPath).isFIFO(), true);
   if (mode === 'fifo-reader') assert.equal(JSON.parse(readFileSync(trace + '.observed', 'utf8')).bytes, 0);
   if (mode === 'directory') assert.equal(readFileSync(join(artifactPath, 'notes.txt'), 'utf8'), 'preserve directory content');
   if (mode === 'link') { assert.equal(lstatSync(artifactPath).isSymbolicLink(), true); assert.equal(readFileSync(artifactPath + '.original', 'utf8'), 'preserve original content'); }
  }
  assert.equal(readFileSync(join(artifactInput, 'src/greet.ts'), 'utf8'), implementation);
  assert.equal(git(artifactInput, 'ls-files', '--stage'), index); assert.equal(git(artifactInput, 'rev-parse', 'HEAD'), head);
  assert.equal(git(artifactInput, 'branch', '--show-current'), branch);
  observations.push({ scenario: `built private artifact ${mode} write admission`, syntheticTool: true, controlledLeafInjection: true,
   childLaunched: mode === 'regular', statePreservedOnRefusal: mode !== 'regular', sourceAndIndexPreserved: true, leafPreserved: mode !== 'regular' });
 }
 for (const mode of ['stable', 'invalid-utf8', 'overwrite-json', 'replace-fifo', 'replace-directory', 'replace-link']) {
  const reportInput = create(); rmSync(join(reportInput, 'node_modules'));
  write(reportInput, 'node_modules/vitest/package.json', '{"version":"5.0.5"}');
  write(reportInput, 'node_modules/vitest/vitest.mjs', `import fs from 'node:fs'; import path from 'node:path';
   const output = process.argv.find(arg => arg.startsWith('--outputFile=')).slice('--outputFile='.length);
   const report = { success: true, numTotalTestSuites: 1, numPassedTestSuites: 1, numFailedTestSuites: 0,
    numTotalTests: 1, numPassedTests: 1, numFailedTests: 0, numPendingTests: 0, note: 'a', testResults: [{
     name: path.join(process.cwd(), 'src/greet.test.ts'), status: 'passed', assertionResults: [{ fullName: 'greet Ada', status: 'passed', failureMessages: [] }]
    }] };
   const bytes = Buffer.from(JSON.stringify(report)), offset = bytes.indexOf('"note":"a"') + '"note":"'.length;
   if (${JSON.stringify(mode)} === 'invalid-utf8') bytes[offset] = 0xff;
   fs.writeFileSync(output, bytes); fs.writeFileSync('node_modules/report-path', output);
  if (${JSON.stringify(mode)}.startsWith('replace-')) fs.writeFileSync('node_modules/report-original', bytes);
  `);
  const reportHandle = call(reportInput, 'open', { profile: 'feature', request: `synthetic report admission ${mode}`, lane: 'quick' }).handle;
  assert.equal(call(reportInput, 'decide', { h: reportHandle, kind: 'basis', propose: basis }).exit, 0);
  write(reportInput, 'src/greet.test.ts', 'export const reportAdmissionControl = true;\n');
  let response;
  if (mode === 'overwrite-json' || mode.startsWith('replace-')) {
   const asked = call(reportInput, 'check', { h: reportHandle, stage: 'baseline' }, [], false);
   assert.ok(asked.questions?.some(question => question.id === 'envelope-consent'), JSON.stringify(asked));
   assert.equal(call(reportInput, 'decide', { h: reportHandle, kind: 'envelope-consent', answers: { 'envelope-consent': 'allow-envelope' } }).exit, 0);
   const result = spawnSync(process.execPath, [join(source, 'tools/uat/crash-bundle-project.mjs'), bundle,
    mode === 'overwrite-json' ? 'read-overwrite-json' : mode, '<vitest-report>', 'check', `--h=${reportHandle}`, '--stage=baseline'],
    { cwd: reportInput, env, encoding: 'utf8', timeout: 10000 });
     assert.equal(result.error, undefined, result.error?.message);
   assert.equal(result.signal, null, result.stderr);
   response = JSON.parse(result.stdout);
   assert.equal(result.status, response.exit, result.stderr);
  } else response = call(reportInput, 'check', { h: reportHandle, stage: 'baseline' });
  const state = JSON.parse(readFileSync(join(reportInput, '.tenet/state'), 'utf8'));
  const receipt = Object.values(state.work)[0].receipts.find(item => item.stage === 'baseline');
  assert.ok(receipt, JSON.stringify(response));
  assert.equal(receipt.status, mode === 'stable' ? 'pass' : 'inconclusive', JSON.stringify(receipt));
  const reportPath = readFileSync(join(reportInput, 'node_modules/report-path'), 'utf8');
  const report = readFileSync(mode.startsWith('replace-') ? `${reportPath}.original` : reportPath);
  if (mode.startsWith('replace-')) {
   const info = lstatSync(reportPath);
   assert.equal(mode === 'replace-fifo' ? info.isFIFO() : mode === 'replace-directory' ? info.isDirectory() : info.isSymbolicLink(), true);
   assert.deepEqual(report, readFileSync(join(reportInput, 'node_modules/report-original')));
  }
  if (mode === 'invalid-utf8') assert.ok(report.includes(Buffer.from([0xff])));
  if (mode === 'overwrite-json') assert.equal(JSON.parse(report.toString()).note, 'b');
  if (mode !== 'stable') {
   assert.ok(receipt.reasons.includes('report-missing'), JSON.stringify(receipt));
   assert.notEqual(call(reportInput, 'finish', { h: reportHandle }, ['--no-commit']).data?.endpoint, 'checked-local');
  }
  observations.push({ scenario: `built synthetic Vitest report ${mode} admission`, receipt: receipt.status, childLaunched: true, syntheticTool: true, reportBytesPreserved: true });
 }
 const linked = create(), outside = mkdtempSync(join(tmpdir(), 'tenet-c0-outside-')); roots.push(outside);
 symlinkSync(outside, join(linked, '.tenet'));
 const refusal = call(linked, 'open', { profile: 'feature', request: 'greeting' }); assert.notEqual(refusal.exit, 0); assert.deepEqual(readdirSync(outside), []);
 observations.push({ scenario: 'symlinked state directory', exit: refusal.exit, reason: refusal.reasons[0].code, outsideWrites: false });
 const artifact = readFileSync(bundle);
 process.stdout.write(JSON.stringify({ runtime: process.version, git: git(root, '--version'), bundle: { bytes: artifact.length, sha256: createHash('sha256').update(artifact).digest('hex') }, observations }, null, 2) + '\n');
} finally { roots.forEach(root => {
 try { const id = JSON.parse(readFileSync(join(root, '.tenet/state'), 'utf8')).workspaceId; if (/^ws_[a-z2-7]{10}$/.test(id)) rmSync(join(tmpdir(), `tenet-${id}`), { recursive: true, force: true }); } catch { /* no state in this scratch folder */ }
 rmSync(root, { recursive: true, force: true });
}); }
