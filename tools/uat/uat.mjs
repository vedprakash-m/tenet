import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, readFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
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
const call = (root, verb, body = {}, flags = []) => {
 const readsBody = ['open', 'decide', 'findings'].includes(verb);
 const args = readsBody ? flags : [...Object.entries(body).flatMap(([key, value]) => [`--${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`, typeof value === 'object' ? JSON.stringify(value) : String(value)]), ...flags];
 const result = spawnSync(process.execPath, [bundle, verb, ...args], { cwd: root, env, input: readsBody ? JSON.stringify(body) : '', encoding: 'utf8' });
 assert.equal(result.signal, null, result.stderr);
 const response = JSON.parse(result.stdout); assert.equal(result.status, response.exit); return response;
};
const focused = (root, h, response) => {
 const rv = response.data.review;
 assert.equal(rv.dispatchMode, 'same-session');
 const manifest = JSON.parse(readFileSync(rv.manifest, 'utf8'));
 for (const path of manifest.investigation) readFileSync(join(root, path), 'utf8');
 const r = call(root, 'findings', { h, result: { kind: 'review', manifest: rv.hash, reservation: rv.reservation, attempt: rv.attempt, mode: rv.mode, status: 'completed', dispatchMode: 'same-session', axes: { behavior: 'pass', structure: 'pass' }, coverage: { inspected: rv.files, uncovered: [], crossCutting: 'greeting test imports the implementation; unrelated human file remains outside this work', sampled: [] }, attention: [], findings: [], basisGaps: [], openDependencies: [] } });
 assert.equal(r.exit, 0, JSON.stringify(r)); assert.equal(r.budget.delegations, '0/2');
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
 focused(root, h, green);
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
