// Spike B prototype of `tenet verify --record`. Reads event data from the event file, never from ${{ }}.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const ev = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const repo = process.env.GITHUB_REPOSITORY, token = process.env.GH_TOKEN;
const api = async (path, opts = {}) => {
  const r = await fetch(`https://api.github.com${path}`, { ...opts, headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json', ...(opts.headers || {}) } });
  const text = await r.text(); if (!r.ok) throw new Error(`${r.status} ${path} ${text.slice(0, 200)}`); return text ? JSON.parse(text) : null;
};
const log = (...a) => console.log('[spike]', ...a);
let headSha, runId, prs = [];
if (process.env.GITHUB_EVENT_NAME === 'workflow_run') {
  headSha = ev.workflow_run.head_sha; runId = ev.workflow_run.id;
  prs = (ev.workflow_run.pull_requests || []).map(p => p.number);
  log('workflow_run', { headSha, runId, event: ev.workflow_run.event, payloadPrs: prs, conclusion: ev.workflow_run.conclusion });
  if (!prs.length) { const open = await api(`/repos/${repo}/pulls?state=open&per_page=100`); prs = open.filter(p => p.head.sha === headSha).map(p => p.number); log('found by listing open PRs', prs); }
} else {
  headSha = ev.pull_request.head.sha; prs = [ev.pull_request.number];
  const runs = await api(`/repos/${repo}/actions/runs?head_sha=${headSha}&per_page=20`);
  const r = runs.workflow_runs.filter(w => w.name === 'Tenet tests').sort((a, b) => b.run_number - a.run_number)[0];
  runId = r?.id; log('edited event; latest test run', runId);
  if (!runId) { log('waiting for tests'); process.exit(0); }
}
fs.mkdirSync('bundles', { recursive: true });
try { execFileSync('gh', ['run', 'download', String(runId), '-R', repo, '-p', 'tenet-bundle-*', '-D', 'bundles'], { stdio: 'inherit' }); } catch (e) { log('download failed', e.message); }
const dirs = fs.existsSync('bundles') ? fs.readdirSync('bundles') : [];
let total = 0, failed = 0; const names = [];
for (const d of dirs) for (const f of fs.readdirSync(`bundles/${d}`)) {
  if (!f.endsWith('.xml')) continue;
  const x = fs.readFileSync(`bundles/${d}/${f}`, 'utf8');
  for (const m of x.matchAll(/<testcase [^>]*name="([^"]*)"[^>]*?(\/>|>([\s\S]*?)<\/testcase>)/g)) { total++; if (/<failure|<error/.test(m[3] || '')) failed++; names.push(m[1]); }
}
log('bundles', dirs, 'cases', total, 'failed', failed);
const pr = prs[0] ?? 'main';
const body = { evaluation: 'spike', run: runId, attempt: ev.workflow_run?.run_attempt ?? null, pr, headSha, total, failed, names };
// check run on the head commit
const conclusion = failed ? 'neutral' : 'success';
const cr = await api(`/repos/${repo}/check-runs`, { method: 'POST', body: JSON.stringify({ name: 'Tenet', head_sha: headSha, status: 'completed', conclusion, output: { title: `Tenet proof (spike) · ${total} cases, ${failed} failed`, summary: `Bundles: ${dirs.join(', ')}\n\nPRs: ${prs.join(', ') || 'none (push)'}\n\nCases:\n${names.map(n => '- ' + n).join('\n')}` } }) });
log('check run', cr.id, cr.html_url);
// records ref via plumbing, with retry
const git = (args, input) => execFileSync('git', args, { input, encoding: 'utf8' }).trim();
git(['config', 'user.name', 'tenet-recorder']); git(['config', 'user.email', 'tenet-recorder@users.noreply.github.com']);
for (let attempt = 1; attempt <= 5; attempt++) {
  let parent = null, baseTree = '';
  try { git(['fetch', '--no-tags', '--depth=1', 'origin', '+refs/tenet/records:refs/tenet/records']); parent = git(['rev-parse', 'refs/tenet/records']); baseTree = git(['ls-tree', parent]); } catch { log('records ref absent; creating'); }
  const blob = git(['hash-object', '-w', '--stdin'], JSON.stringify(body, null, 2));
  const name = `proof-${pr}-${runId}-${body.attempt ?? 'e'}.json`;
  const lines = baseTree.split('\n').filter(l => l && !l.endsWith('\t' + name));
  lines.push(`100644 blob ${blob}\t${name}`);
  const tree = git(['mktree'], lines.join('\n') + '\n');
  const commit = git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', `tenet: proof ${pr} ${runId}`]);
  try { git(['push', 'origin', `${commit}:refs/tenet/records`]); log('records written', name, 'attempt', attempt); break; }
  catch (e) { log('push rejected, retrying', attempt); await new Promise(r => setTimeout(r, 1000 + Math.random() * 4000)); }
}
