// Built CLI + real npm, using a synthetic loopback registry. No host/model or external registry calls.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const exec = promisify(execFile);
const bundle = resolve('plugin/kernel/tenet.mjs');
const node = process.env.TENET_UAT_NODE ?? process.execPath;
const root = mkdtempSync(join(tmpdir(), 'tenet-dependency-metadata-uat-'));
let publishDate = 'invalid';
const requests = [];
const server = createServer((req, res) => {
  requests.push({ url: req.url, accept: req.headers.accept });
  if (req.url !== '/tenet-audit-fixture') { res.writeHead(404); res.end('{}'); return; }
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify({
    name: 'tenet-audit-fixture', 'dist-tags': { latest: '1.0.0' },
    versions: { '1.0.0': { name: 'tenet-audit-fixture', version: '1.0.0', license: 'MIT',
      dist: { tarball: `http://127.0.0.1:${server.address().port}/fixture.tgz`, integrity: 'sha512-Zml4dHVyZQ==' } } },
    // npm validates resolver dates itself; return a valid packument first, then poison only the age lookup.
    time: { created: '2020-01-01T00:00:00Z', modified: '2020-01-01T00:00:00Z', '1.0.0': requests.length === 1 ? '2020-01-01T00:00:00Z' : publishDate },
  }));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
try {
  const home = join(root, 'home'), project = join(root, 'project');
  mkdirSync(home); mkdirSync(project);
  const registry = `http://127.0.0.1:${server.address().port}/`;
  writeFileSync(join(home, '.npmrc'), `registry=${registry}\naudit=false\nfund=false\nfetch-retries=0\n`);
  const env = { ...process.env, HOME: home, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
    NPM_CONFIG_USERCONFIG: join(home, '.npmrc'), NPM_CONFIG_REGISTRY: registry, NPM_CONFIG_CACHE: join(home, 'cache') };
  delete env.NODE_OPTIONS;
  const git = (...args) => exec('git', args, { cwd: project, env });
  await git('init', '-q', '-b', 'main');
  await git('config', 'user.name', 'Test'); await git('config', 'user.email', 'test@example.com');
  await git('config', 'commit.gpgsign', 'false');
  const manifest = '{"name":"uat","private":true,"type":"module"}\n';
  writeFileSync(join(project, 'package.json'), manifest);
  writeFileSync(join(project, '.gitignore'), '.tenet/\nnode_modules/\n');
  await git('add', '-A'); await git('commit', '-qm', 'initial');
  const cli = (verb, body) => new Promise((accept, reject) => {
    const child = spawn(node, [bundle, verb], { cwd: project, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), 120_000);
    child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
    child.on('error', reject); child.on('close', (code, signal) => {
      clearTimeout(timer);
      try { assert.equal(signal, null, stderr); const result = JSON.parse(stdout); assert.equal(code, result.exit); accept(result); }
      catch (e) { reject(e); }
    });
    child.stdin.end(JSON.stringify(body));
  });
  const opened = await cli('open', { profile: 'feature', request: 'add a dependency', scopePaths: ['package.json'] });
  assert.equal(opened.exit, 0, JSON.stringify(opened));
  const h = opened.handle;
  const configured = await cli('decide', { h, kind: 'config', target: 'dependency_policy', propose: { value: { unknown_age: 'deny' } } });
  assert.equal(configured.exit, 0, JSON.stringify(configured));
  const ask = { h, kind: 'dependency', propose: { specs: ['tenet-audit-fixture@1.0.0'] }, quote: 'add this synthetic fixture' };
  const refused = await cli('decide', ask);
  assert.equal(refused.exit, 2, JSON.stringify(refused));
  assert.equal(refused.reasons[0].code, 'dependency-rejected', JSON.stringify({ refused, requests }));
  assert.match(refused.reasons[0].message, /no publish date/);
  assert.equal(readFileSync(join(project, 'package.json'), 'utf8'), manifest);
  assert.equal(existsSync(join(project, 'package-lock.json')), false);
  assert.equal(existsSync(join(project, 'node_modules')), false);
  publishDate = '2020-01-01T00:00:00Z';
  // The npm cache is private to this fixture; clear it so the second lookup sees the changed synthetic date.
  rmSync(join(home, '.npm'), { recursive: true, force: true });
  rmSync(join(home, 'cache'), { recursive: true, force: true });
  const preview = await cli('decide', { ...ask, quote: 'add the fixture with its valid registry date' });
  assert.equal(preview.exit, 3, JSON.stringify(preview));
  assert.equal(preview.questions[0].id, 'dependency-confirm');
  const declined = await cli('decide', { h, kind: 'dependency', answers: { 'dependency-confirm': 'decline' } });
  assert.equal(declined.exit, 0, JSON.stringify(declined));
  assert.equal(readFileSync(join(project, 'package.json'), 'utf8'), manifest);
  assert.equal(existsSync(join(project, 'package-lock.json')), false);
  assert.equal(requests.some(request => request.url.includes('.tgz')), false, 'nothing installed');
  const invalidIntent = Buffer.concat([Buffer.from('# Intent\n'), Buffer.from([0xc3, 0x28])]);
  writeFileSync(join(project, 'INTENT.md'), invalidIntent);
  const adoption = await cli('decide', { h, kind: 'adopt', target: 'intent' });
  assert.equal(adoption.exit, 2, JSON.stringify(adoption));
  assert.ok(adoption.reasons.some(reason => /UTF-8/.test(reason.message)), JSON.stringify(adoption));
  assert.deepEqual(readFileSync(join(project, 'INTENT.md')), invalidIntent);
  console.log(JSON.stringify({ node: (await exec(node, ['--version'])).stdout.trim(),
    npm: (await exec('npm', ['--version'], { env: { ...env, PATH: dirname(node) + delimiter + env.PATH } })).stdout.trim(),
    bundleSha256: createHash('sha256').update(readFileSync(bundle)).digest('hex'),
    invalidDateDenied: true, noOutputPublishedOnDenial: true, validDatePreviewed: true, declineRestored: true, invalidIntentRefusedWithoutRewrite: true,
    registry: 'synthetic loopback only', requests: requests.length, tarballRequests: 0 }));
} finally {
  await new Promise(r => server.close(r));
  rmSync(root, { recursive: true, force: true });
}
