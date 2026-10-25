// Real Git/filter programs at the external-job boundary; consent alone does not provide process ownership.
import assert from "node:assert/strict";
import { chmodSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { GitCli } from "../src/adapters/git-cli.ts";
import { ProcessRunner } from "../src/adapters/runner.ts";
import { systemClock } from "../src/adapters/system.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, cli, focusFixture, isAlive, project, runningCheck, waitFor } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const scratch = () => { const root = tmp(); roots.push(root); return root; };
const passthrough = "process.stdin.pipe(process.stdout);";
const command = (root: string, source: string) => {
  const script = join(scratch(), "filter.cjs");
  write(script, "", source);
  git(root, "config", "filter.audit.clean", `"${process.execPath}" "${script}"`);
  git(root, "config", "filter.audit.required", "true");
};
async function repository(source: string) {
  const root = scratch(), runDir = scratch();
  initRepo(root);
  write(root, "a.txt", "before\n"); write(root, "human.txt", "human bytes\n");
  write(root, ".gitattributes", "a.txt filter=audit\n");
  git(root, "add", "-A"); git(root, "commit", "-qm", "initial");
  write(root, "a.txt", "after\n");
  command(root, source);
  const runner = new ProcessRunner(systemClock, { PATH: process.env.PATH, HOME: process.env.HOME, FILTER_CANARY: "do-not-pass" });
  const g = new GitCli(root, runner);
  g.allowFilters([(await g.filterGate())!.hash]);
  const plan = { paths: ["a.txt"], deleted: [], parent: git(root, "rev-parse", "HEAD"), message: "candidate", timeoutMs: 2000, runDir };
  return { root, runDir, runner, g, plan };
}

async function ready(source: string) {
  const p = project({ ".gitattributes": "src/greet.ts filter=audit\n" }); roots.push(p.root);
  command(p.root, source);
  const h = (await p.call("open", { profile: "feature", request: "greeting", lane: "quick" })).handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", GREET_TEST);
  await p.call("check", { h, stage: "baseline" });
  p.write("src/greet.ts", GREET_IMPL);
  await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
  await focusFixture(p, h);
  assert.equal((await p.call("finish", { h })).questions?.[0]?.id, "filter-consent");
  assert.equal((await p.call("decide", { h, kind: "filter-consent", answers: { "filter-consent": "allow-filters" } })).exit, 0);
  return { p, h, parent: p.git("rev-parse", "HEAD"), index: readFileSync(join(p.root, ".git/index")) };
}

describe("guarded Git filter preparation", () => {
  it("computes the intent tree without running even a consented filter [GIT-12, CON-09]", async () => {
    const marker = join(scratch(), "marker");
    const { g, plan } = await repository(`require('fs').appendFileSync(${JSON.stringify(marker)}, 'run\\n');${passthrough}`);
    assert.match(await g.expectedTree(plan), /^[a-f0-9]{40}$/);
    assert.equal(existsSync(marker), false, "intent preparation must be program-neutral");
  });

  it("also disables filesystem-monitor programs during neutral tree preparation [GIT-12, CON-09]", async () => {
    const { root, g, plan } = await repository(passthrough), dir = scratch();
    const monitor = join(dir, "monitor"), marker = join(dir, "ran");
    write(monitor, "", `#!/bin/sh\nprintf ran > '${marker}'\n`); chmodSync(monitor, 0o755);
    git(root, "config", "core.fsmonitor", monitor);
    await g.expectedTree(plan);
    assert.equal(existsSync(marker), false);
  });

  it("stages once through the runner with a minimal environment [GIT-12, SEC-04]", async () => {
    const marker = join(scratch(), "marker");
    const { g, plan, runDir, runner } = await repository(`require('fs').appendFileSync(${JSON.stringify(marker)}, JSON.stringify({canary:process.env.FILTER_CANARY,CI:process.env.CI})+'\\n');${passthrough}`);
    const launches: string[] = [], original = runner.run.bind(runner);
    runner.run = async spec => { launches.push(spec.argv.includes("add") ? "add" : "commit"); return original(spec); };
    const prior = process.env.FILTER_CANARY;
    process.env.FILTER_CANARY = "do-not-pass";
    let out;
    try { out = await g.commit(plan); }
    finally { if (prior === undefined) delete process.env.FILTER_CANARY; else process.env.FILTER_CANARY = prior; }
    assert.equal(out.ok, true, JSON.stringify(out));
    const observed = readFileSync(marker, "utf8").trim().split("\n").map(s => JSON.parse(s));
    assert.ok(observed.length > 0); assert.ok(observed.every(e => e.CI === "1" && e.canary === undefined));
    assert.deepEqual(launches, ["add", "commit"], "Git may invoke a clean filter more than once within its admitted command");
    assert.ok(JSON.parse(readFileSync(join(runDir, "run.json"), "utf8")).pid);
  });

  it("reports a required filter failure without launching a commit or changing human staging [GIT-03, GIT-15]", async () => {
    const { root, g, plan } = await repository("process.stdin.resume();process.stdin.on('end',()=>process.exit(7));");
    write(root, "human.txt", "human staged\n"); git(root, "add", "human.txt");
    const index = readFileSync(join(root, ".git/index"));
    const out = await g.commit(plan);
    assert.equal(out.ok, false); assert.equal(out.reason, "hook-failed", JSON.stringify(out));
    assert.equal(git(root, "rev-parse", "HEAD"), plan.parent);
    assert.deepEqual(readFileSync(join(root, ".git/index")), index);
    assert.equal(readFileSync(join(root, "human.txt"), "utf8"), "human staged\n");
  });

  it("refuses transformed checked content before committing until committed-tree checks exist [EVD-01, GIT-12]", async () => {
    const { root, g, plan } = await repository("process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('different untested bytes\\n'));");
    const out = await g.commit(plan);
    assert.equal(out.ok, false); assert.equal(out.reason, "capability-missing", JSON.stringify(out));
    assert.equal(git(root, "rev-parse", "HEAD"), plan.parent);
    assert.equal(readFileSync(join(root, "a.txt"), "utf8"), "after\n");
  });

  it("preserves a filter's working-file side effects but refuses to commit them as the checked candidate [EVD-03, GIT-03]", async () => {
    const { root, g, plan } = await repository(`require('fs').writeFileSync('human.txt','changed by filter');${passthrough}`);
    const out = await g.commit(plan);
    assert.equal(out.ok, false); assert.match(out.detail ?? "", /changed|mutat/i);
    assert.equal(git(root, "rev-parse", "HEAD"), plan.parent);
    assert.equal(readFileSync(join(root, "human.txt"), "utf8"), "changed by filter");
  });

  it("publishes ownership and intent before the filter executes, and never dispatches it twice [CON-04, CON-12]", async () => {
    const marker = join(scratch(), "marker");
    const { p, h } = await ready(`require('fs').appendFileSync(${JSON.stringify(marker)}, 'run\\n');${passthrough}`);
    const ports = p.ports(), original = ports.runner.run.bind(ports.runner);
    let staged = false;
    ports.runner.run = async spec => {
      if (spec.argv.includes("add") || spec.argv.includes("commit")) assert.equal(spec.timeoutMs, 120_000);
      if (spec.argv.includes("add")) {
        staged = true;
        const state = ports.store.read()!.state;
        const call = Object.values(state.work)[0]!.session.inCall;
        assert.equal(call?.verb, "commit");
        assert.ok(ports.store.readLog().some(e => e.kind === "intent" && e.effect === "commit" && e.id === call.runId));
      }
      return original(spec);
    };
    const out = await runVerb(ports, VERBS, "finish", { h });
    assert.equal((out.data as any).endpoint, "checked-local", JSON.stringify(out));
    assert.equal(staged, true, "git add must pass through the runner");
    assert.equal(readFileSync(marker, "utf8"), "run\n");
  });

  it("admits stop before filter launch and refuses the superseded spawn [CON-04, CON-12]", async () => {
    const marker = join(scratch(), "marker");
    const { p, h, parent, index } = await ready(`require('fs').writeFileSync(${JSON.stringify(marker)}, 'ran');${passthrough}`);
    const ports = p.ports(), original = ports.runner.run.bind(ports.runner);
    let stopped = false, stopExit: number | undefined;
    ports.runner.run = async spec => {
      if (spec.argv.includes("add")) { stopped = true; stopExit = (await p.call("stop", { h, mode: "cancel" })).exit; }
      return original(spec);
    };
    const out = await runVerb(ports, VERBS, "finish", { h });
    assert.equal(stopped, true, JSON.stringify(out)); assert.ok(out.reasons.some(r => r.code === "run-superseded"), JSON.stringify(out));
    assert.equal(stopExit, 2, "stop preserves the unresolved commit fence until a policy-aware call reconciles it");
    assert.equal(existsSync(marker), false); assert.equal(p.git("rev-parse", "HEAD"), parent);
    assert.deepEqual(readFileSync(join(p.root, ".git/index")), index);
  });

  it("times out a TERM-resistant filter and its child as a process group [CON-12, SEC-04]", async () => {
    const marker = join(scratch(), "pids");
    const source = `const child=require('child_process').spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],{stdio:'ignore'});require('fs').writeFileSync(${JSON.stringify(marker)},JSON.stringify([process.pid,child.pid]));process.on('SIGTERM',()=>{});setInterval(()=>{},1000);`;
    const { root, g, plan } = await repository(source);
    const pending = g.commit({ ...plan, timeoutMs: 1000 });
    const pids = await waitFor(() => existsSync(marker) && JSON.parse(readFileSync(marker, "utf8")) as number[]);
    try {
      const out = await pending;
      assert.equal(out.ok, false); assert.match(out.detail ?? "", /timed out/);
      await waitFor(() => pids.every(pid => !isAlive(pid)), 5000, "filter process group termination");
      assert.equal(git(root, "rev-parse", "HEAD"), plan.parent);
    } finally { for (const pid of pids) try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ } }
  });

  for (const killed of [false, true]) it(`${killed ? "SIGKILL recovery" : "stop during staging"} terminates filters without committing or replaying them [CON-04, CON-12]`, async () => {
    const marker = join(scratch(), "marker");
    const { p, h, parent, index } = await ready(`require('fs').appendFileSync(${JSON.stringify(marker)}, 'run\\n');process.on('SIGTERM',()=>{});setInterval(()=>{},1000);`);
    const running = cli(p.root, ["finish", "--h", h]);
    let group: ReturnType<typeof runningCheck>;
    try {
      await waitFor(() => existsSync(marker), 15000, "filter launch");
      group = await waitFor(() => runningCheck(p));
      if (killed) { running.child.kill("SIGKILL"); assert.equal((await running.done).signal, "SIGKILL"); }
      const stopped = await p.call("stop", { h, mode: "cancel" });
      assert.equal(stopped.exit, 2, JSON.stringify(stopped));
      assert.ok(stopped.reasons.some(r => r.code === "effect-uncertain"));
      assert.ok(p.ports().store.read()!.state.sourceOwner, "stop retains ownership until commit postconditions are reconciled");
      if (!killed) {
        const out = await running.done;
        assert.ok(out.json?.reasons.some(r => r.code === "run-superseded"), out.stdout);
      }
      await waitFor(() => !isAlive(group!.pid), 5000, "staging group stopped");
      const resumed = await p.call("open", { profile: "feature", request: "greeting", resume: true });
      assert.ok(resumed.effects?.completed.some(e => /did not happen/.test(e)), JSON.stringify(resumed));
      assert.equal(p.git("rev-parse", "HEAD"), parent);
      assert.deepEqual(readFileSync(join(p.root, ".git/index")), index);
      assert.equal(readFileSync(join(p.root, "src/greet.ts"), "utf8"), GREET_IMPL);
      assert.equal(readFileSync(marker, "utf8"), "run\n");
    } finally {
      running.child.kill("SIGKILL");
      if (group) try { process.kill(-group.pid, "SIGKILL"); } catch { /* stopped */ }
    }
  });

  it("revalidates a cached filter gate before staging changed commands [GIT-12]", async () => {
    const marker = join(scratch(), "marker");
    const { root, g, plan } = await repository(passthrough);
    command(root, `require('fs').writeFileSync(${JSON.stringify(marker)},'unauthorized');${passthrough}`);
    const out = await g.commit(plan);
    assert.equal(out.ok, false); assert.equal(out.reason, "filter-consent-needed");
    assert.equal(existsSync(marker), false); assert.equal(git(root, "rev-parse", "HEAD"), plan.parent);
  });

  it("binds consent to duplicate command order because Git uses the last assignment [GIT-12]", async () => {
    const marker = join(scratch(), "marker");
    const { root, g, plan } = await repository(`require('fs').writeFileSync(${JSON.stringify(marker)},process.argv.at(-1));${passthrough}`);
    const first = git(root, "config", "filter.audit.clean"), second = `${first} changed`;
    git(root, "config", "--add", "filter.audit.clean", second);
    const consented = (await new GitCli(root).filterGate())!;
    g.allowFilters([consented.hash]);
    git(root, "config", "--unset-all", "filter.audit.clean");
    git(root, "config", "--add", "filter.audit.clean", second); git(root, "config", "--add", "filter.audit.clean", first);
    const out = await g.commit(plan);
    assert.equal(out.ok, false); assert.equal(out.reason, "filter-consent-needed", JSON.stringify(out));
    assert.equal(existsSync(marker), false); assert.equal(git(root, "rev-parse", "HEAD"), plan.parent);
  });

  for (const failed of [false, true]) it(`fences a filter that moves HEAD ${failed ? "then fails" : "before commit"}, without claiming its commit [CON-12, GIT-03]`, async () => {
    const { root, g, plan } = await repository(`const env={...process.env};delete env.GIT_INDEX_FILE;delete env.GIT_CONFIG_PARAMETERS;require('child_process').execFileSync('git',['-c','filter.audit.clean=','-c','filter.audit.required=false','commit','--allow-empty','-qm','foreign filter commit'],{stdio:'ignore',env});${failed ? "process.exit(7);" : passthrough}`);
    const out = await g.commit(plan);
    assert.equal(out.ok, false); assert.equal(out.reason, "effect-uncertain", JSON.stringify(out));
    assert.equal(git(root, "rev-list", "--count", "HEAD"), "2", "Tenet must not commit on top of a filter's moved HEAD");
    const reconciled = await g.reconcileCommit(plan.parent, await g.expectedTree(plan), plan.paths, "W-0001");
    assert.equal(reconciled.completed, false, "a matching parent/path set alone cannot prove this was Tenet's commit");
  });

  it("cannot reconcile an unreadable intent tree as an empty difference [CON-12]", async () => {
    const { g, plan } = await repository(passthrough);
    const out = await g.commit({ ...plan, message: "candidate\n\nTenet-Work: W-0001" });
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal((await g.reconcileCommit(plan.parent, "f".repeat(40), plan.paths, "W-0001")).completed, false);
  });
});
