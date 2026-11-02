// From the repository root, pass optional additional Node executable paths.
// Public built-CLI input admission; all private state belongs to disposable synthetic repositories.
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
const bundle = resolve('plugin/kernel/tenet.mjs');
const env = {...process.env, GIT_CONFIG_GLOBAL:'/dev/null', GIT_CONFIG_NOSYSTEM:'1'};
delete env.NODE_OPTIONS;
const observations = [];
for (const runtime of [process.execPath, ...process.argv.slice(2)]) {
  const root = mkdtempSync(join(tmpdir(), 'tenet-admission-uat-'));
  const git = (...args) => execFileSync('git', args, {cwd:root, env, encoding:'utf8'}).trim();
  const call = (verb, body) => {
    const result = spawnSync(runtime, [bundle, verb], {cwd:root, env, input:JSON.stringify(body), encoding:'utf8'});
    assert.equal(result.signal, null, result.stderr);
    const response = JSON.parse(result.stdout);
    assert.equal(result.status, response.exit, result.stderr);
    return response;
  };
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.com'); git('config', 'commit.gpgsign', 'false');
    writeFileSync(join(root, 'package.json'), '{"name":"admission-uat","private":true,"type":"module"}\n');
    writeFileSync(join(root, '.gitignore'), '.tenet/\n');
    git('add', '-A'); git('commit', '-qm', 'fixture');
    const opened = call('open', {profile:'plan', request:'Record the local storage decision'});
    assert.equal(opened.exit, 0, JSON.stringify(opened));
    const h = opened.handle;
    const record = context => ({h, kind:'decision-record', quote:'Use the local store', propose:{
      title:'Store locally', context, decision:'Use SQLite', consequences:'One local process',
    }});
    const directory = join(root, '.tenet');
    const snapshot = () => Object.fromEntries(readdirSync(directory).sort().map(name => [name, readFileSync(join(directory, name), 'utf8')]));
    const before = snapshot();
    const canary = ['synthetic', '123456'].join('');
    for (const key of ['password', 'api_key', 'access-key', 'token']) {
      const refused = call('decide', record(JSON.stringify({[key]:canary})));
      assert.equal(refused.exit, 1);
      assert.equal(refused.reasons[0].code, 'invalid-input');
      assert.equal(JSON.stringify(refused).includes(canary), false);
      assert.deepEqual(snapshot(), before);
    }
    const accepted = call('decide', record(JSON.stringify({password:'required'}))); // privacy-ok: literal required is a synthetic non-secret placeholder control.
    assert.equal(accepted.exit, 0, JSON.stringify(accepted));
    assert.notDeepEqual(snapshot(), before, 'ordinary placeholder control must actually record a decision');
    assert.equal(JSON.stringify(snapshot()).includes(canary), false);
    observations.push({runtime:execFileSync(runtime, ['--version'], {encoding:'utf8'}).trim(),
      refusedCredentialContexts:4, privateStateBackupAndJournalUnchanged:true, responseDoesNotEchoCanary:true,
      ordinaryPlaceholderDecisionRecorded:true, limitations:'Existing bounded likely-secret heuristic only; not general secret detection.'});
  } finally { rmSync(root, {recursive:true, force:true}); }
}
const bytes = readFileSync(bundle);
console.log(JSON.stringify({bundle:{bytes:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex')}, observations}, null, 2));
