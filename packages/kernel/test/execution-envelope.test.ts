import assert from "node:assert/strict";
import { after, it } from "node:test";
import { chmodSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { ProcessRunner } from "../src/adapters/runner.ts";
import { systemClock } from "../src/adapters/system.ts";
import type { Obligation, WorkContract } from "../src/core/schemas.ts";
import { executionDisclosures, recoverStoppedCall } from "../src/core/execution-envelope.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { createPorts } from "../src/wire.ts";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, SLOW_TEST, cli, isAlive, preconsentEnvelope, project, runCli, runningCheck, waitFor } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

for (const override of [false, true]) it(`resolves child node from the kernel runtime before a conflicting ${override ? "command" : "inherited"} PATH [SEC-04]`, async () => {
  const p = project(); roots.push(p.root);
  p.write("foreign-bin/node", "#!/bin/sh\necho FOREIGN_NODE_RUNTIME\n");
  chmodSync(join(p.root, "foreign-bin/node"), 0o755);
  const runner = new ProcessRunner(systemClock, {
    PATH: `${join(p.root, "foreign-bin")}${delimiter}${process.env.PATH ?? ""}`, HOME: process.env.HOME,
    NODE_OPTIONS: "--conditions=TENET_PATH_CANARY",
  });
  const runDir = p.ports().store.tempDir("run-runtime-path");
  const result = await runner.run({
    argv: [process.execPath, "-e", 'process.stdout.write(JSON.stringify({runtime:require("node:child_process").execFileSync("node",["-p","process.version"],{encoding:"utf8"}).trim(),path:process.env.PATH,options:process.env.NODE_OPTIONS}))'],
    cwd: p.root, runDir, timeoutMs: 10000,
    ...(override ? { env: { PATH: join(p.root, "foreign-bin") } } : {}),
  });
  assert.equal(result.exit, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.runtime, process.version, "install scripts and tools must inherit the kernel's Node runtime");
  const directories = observed.path.split(delimiter);
  assert.deepEqual(directories.slice(0, 2), [dirname(process.execPath), join(p.root, "node_modules", ".bin")]);
  assert.ok(directories.includes(join(p.root, "foreign-bin")));
  assert.equal(directories.length, new Set(directories).size);
  assert.equal(observed.options, undefined);
});

it("plans tests, static checks, and e2e in one value-only exposure envelope", () => {
  const p = project();
  roots.push(p.root);
  const ports = p.ports();
  const obligations: Obligation[] = [
    { id: "OB-1", kind: "test", category: "acceptance", testFile: "src/greet.test.ts" },
    { id: "OB-2", kind: "static", category: "affected", tool: "tsc" },
    { id: "OB-3", kind: "workload", category: "manual-affected", tool: "playwright" },
  ];
  const stack = {
    ...ports.stack,
    argv: () => ["node", "vitest", "--reporter=json", "<runDir>/vitest.json"],
    staticArgv: () => ["node", "tsc", "--noEmit"],
    e2eArgv: () => ["node", "playwright", "<runDir>/playwright.json"],
  };

  const envelope = ports.runner.planEnvelope({
    projectId: "workspace-id", root: p.root, obligations, toExecute: ["src/greet.test.ts"], stack,
  });

  assert.deepEqual(envelope.commands.map((command) => command.kind), ["tests", "static", "e2e"]);
  assert.ok(envelope.commands.find((command) => command.kind === "e2e")!.environment.passed.includes("PORT"));
  assert.equal(JSON.stringify(envelope).includes(p.root), false);
});

it("blocks unknown exposure before consent and discloses the unknowns and authorization in check and finish results [SEC-15]", async () => {
  const p = project({}, { autoConsentEnvelope: false });
  roots.push(p.root);
  const ports = p.ports();
  const call = (verb: string, input: Record<string, unknown>) => runVerb(ports, VERBS, verb, input);
  let launches = 0;
  const execute = ports.runner.run.bind(ports.runner);
  ports.runner.run = async spec => { launches++; return execute(spec); };
  const h = (await call("open", { profile: "feature", request: "unknown exposure disclosure", lane: "quick" })).handle!;
  await call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", GREET_TEST);

  const asked = await call("check", { h, stage: "baseline" });
  assert.equal(asked.exit, 3, JSON.stringify(asked));
  assert.equal(launches, 0, "no project process starts before authorization");
  const question = asked.questions?.find(item => item.id === "envelope-consent");
  assert.equal(question?.channel, "chat");
  const pending = Object.values(ports.store.read()!.state.work)[0]!;
  assert.equal(pending.receipts.length, 0);
  assert.equal(pending.session.inCall, undefined);
  assert.match(question?.question ?? "", /network.*unknown/i);
  assert.match(question?.question ?? "", /data.*credential.*unknown/i);
  assert.match(question?.question ?? "", /credential files.*HOME/i);

  const approved = await call("decide", {
    h, kind: "envelope-consent", answers: { "envelope-consent": "allow-envelope" },
  });
  assert.equal(approved.exit, 0, JSON.stringify(approved));
  assert.equal(launches, 0, "consent alone does not execute the check");
  const consent = ports.store.read()!.state.consents.find(item => item.kind === "envelope");
  assert.equal(consent?.configHash, question?.bind.factsHash);

  const checked = await call("check", { h, stage: "baseline" });
  assert.equal(checked.exit, 0, JSON.stringify(checked));
  assert.ok(launches > 0, "the consented check really executed");
  const work = Object.values(ports.store.read()!.state.work)[0]!;
  assert.equal(work.receipts[0]?.executionEnvelope?.hash, consent?.configHash);
  ports.runner.run = async () => { throw new Error("synthetic runner failure"); };
  const failed = await call("check", { h, stage: "baseline", touched: ["src/greet.test.ts"] });
  assert.equal(failed.exit, 5, JSON.stringify(failed));
  assert.equal(failed.reasons[0]?.code, "internal-error");
  assert.deepEqual(Object.values(ports.store.read()!.state.work)[0]!.receipts, work.receipts);
  const finished = await call("finish", { h, noCommit: true });
  assert.equal(finished.exit, 0, JSON.stringify(finished));
  const repeated = await call("finish", { h, noCommit: true });
  for (const response of [checked, failed, finished, repeated]) {
    const disclosure = (response.data as Record<string, any>).executionEnvelopes?.[0];
    assert.equal(disclosure?.hash, consent?.configHash);
    assert.equal(disclosure?.expectedNetwork, "unknown");
    assert.equal(disclosure?.containment, "none-observed");
    assert.deepEqual(disclosure?.authorization, consent);
    assert.match(disclosure?.limitations ?? "", /network.*data.*credential.*unknown/i);
    assert.match(disclosure?.limitations ?? "", /credential files.*HOME/i);
    assert.ok(disclosure?.commands[0].environment.passed.includes("PATH"));
    assert.equal(JSON.stringify(disclosure).includes(p.root), false);
  }
});

it("deduplicates disclosure without changing schema-1 envelopes or inventing missing authorization", () => {
  const p = project();
  roots.push(p.root);
  const ports = p.ports();
  const envelope = ports.runner.planEnvelope({
    projectId: "workspace-id", root: p.root,
    obligations: [{ id: "OB-1", kind: "test", category: "acceptance", testFile: "src/greet.test.ts" }],
    toExecute: ["src/greet.test.ts"], stack: ports.stack,
  });
  const original = JSON.stringify(envelope);
  const consents = [{ kind: "hooks" as const, configHash: envelope.hash, at: "t" }];
  const disclosures = executionDisclosures([envelope, envelope], consents);
  assert.equal(disclosures.length, 1);
  assert.equal(disclosures[0]?.authorization, null, "a hook consent is not envelope authorization");
  assert.equal(JSON.stringify(envelope), original);
  assert.deepEqual(consents, [{ kind: "hooks", configHash: envelope.hash, at: "t" }]);
  assert.deepEqual(executionDisclosures([], consents), [], "legacy receipts without an envelope confer no exposure facts");
});

it("asks for unknown exposure before spawn and reuses consent for the same envelope", async () => {
  const p = project({}, { autoConsentEnvelope: false });
  roots.push(p.root);
  const opened = await p.call("open", { profile: "feature", request: "check envelope", lane: "quick" });
  const h = opened.handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", GREET_TEST);

  const asked = await p.call("check", { h, stage: "baseline" });

  assert.equal(asked.exit, 3, JSON.stringify(asked));
  assert.equal(asked.questions?.[0]?.id, "envelope-consent");
  const pending = Object.values(p.ports().store.read()!.state.work)[0]!;
  assert.equal(pending.receipts.length, 0);
  assert.equal(pending.session.inCall, undefined);

  const approved = await p.call("decide", {
    h, kind: "envelope-consent", answers: { "envelope-consent": "allow-envelope" },
  });
  assert.equal(approved.exit, 0, JSON.stringify(approved));
  const consent = p.ports().store.read()!.state.consents.find((item) => item.kind === "envelope");
  assert.ok(consent?.configHash);

  const checked = await p.call("check", { h, stage: "baseline" });

  assert.equal(checked.exit, 0, JSON.stringify(checked));
  assert.notEqual(checked.questions?.[0]?.id, "envelope-consent");
  const receipt = Object.values(p.ports().store.read()!.state.work)[0]!.receipts[0] as unknown as Record<string, any>;
  assert.equal(receipt.executionEnvelope.hash, consent.configHash);
  assert.equal(receipt.executionEnvelope.commands[0].environment.passed.includes("PATH"), true);
  assert.equal(receipt.executionEnvelope.commands[0].environment.dropped.includes("PATH"), false);
  assert.equal(receipt.executionEnvelope.containment, "none-observed");
  assert.equal(JSON.stringify(receipt.executionEnvelope).includes(p.root), false);

  p.write("src/greet.ts", "export const greet = (name: string): string => `Hello, ${name}!`;\n");
  const changed = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
  assert.equal(changed.exit, 3, JSON.stringify(changed));
  assert.equal(changed.questions?.[0]?.id, "envelope-consent");
  const changedWork = Object.values(p.ports().store.read()!.state.work)[0]!;
  assert.notEqual(changedWork.pendingEnvelope?.hash, consent.configHash);
  assert.equal(changedWork.receipts.length, 1, "the changed envelope was stopped before another run");

  const declined = await p.call("decide", {
    h, kind: "envelope-consent", answers: { "envelope-consent": "decline-envelope" },
  });
  assert.equal(declined.exit, 0, JSON.stringify(declined));
  assert.equal(p.ports().store.read()!.state.consents.some((item) => item.kind === "envelope" && item.configHash === changedWork.pendingEnvelope?.hash), false);
});

it("reuses an envelope consent in a separate CLI process", async () => {
  const p = project({}, { autoConsentEnvelope: false });
  roots.push(p.root);
  const opened = await p.call("open", { profile: "feature", request: "CLI envelope", scopePaths: ["src/greet.ts"], lane: "quick" });
  const h = opened.handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", GREET_TEST);
  await preconsentEnvelope(p, h, { stage: "baseline" });
  await p.call("check", { h, stage: "baseline" });
  p.write("src/greet.ts", GREET_IMPL);

  await preconsentEnvelope(p, h, { stage: "candidate", targeted: true, touched: ["src/greet.ts"] });
  const result = await runCli(p.root, ["check", "--h", h, "--stage", "candidate", "--targeted", "--touched", "src/greet.ts"]);

  const state = p.ports().store.read()!.state;
  const work = Object.values(state.work)[0]!;
  const receiptEnvelope = work.receipts.at(-1)?.executionEnvelope;
  assert.ok(receiptEnvelope && state.consents.some((item) => item.kind === "envelope" && item.configHash === receiptEnvelope.hash), JSON.stringify({ receiptEnvelope, consents: state.consents, result: result.json }));
  assert.equal(result.code, 0, result.stdout);
  assert.equal(result.json?.exit, 0, result.stdout);
  assert.ok(!result.json?.questions?.some((question) => question.id === "envelope-consent"), result.stdout);
});

for (const cancellation of [false, true]) it(`requires fresh consent after an unknown-envelope check ${cancellation ? "is cancelled" : "crashes"} even when the envelope is unchanged [CON-03, SEC-04]`, async () => {
  const p = project({}, { autoConsentEnvelope: false });
  roots.push(p.root);
  const h = (await p.call("open", { profile: "feature", request: "unknown check crash", lane: "quick" })).handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", SLOW_TEST);
  await preconsentEnvelope(p, h, { stage: "baseline" });
  const running = cli(p.root, ["check", "--h", h, "--stage", "baseline"]);
  let orphan: ReturnType<typeof runningCheck>;
  try {
    orphan = await waitFor(() => runningCheck(p), 30000, "unknown-envelope runner");
    const launched = p.ports().store.read()!.state;
    const consented = launched.consents.map(item => item.configHash);
    assert.ok(consented.includes(Object.values(launched.work)[0]!.session.inCall!.executionEnvelope!.hash));
    if (cancellation) {
      const stopped = await p.call("stop", { h, mode: "cancel" });
      assert.equal(stopped.exit, 0, JSON.stringify(stopped));
      assert.ok(stopped.effects?.completed.some(effect => /external side effects remain unknown/.test(effect)));
      await running.done;
    } else {
      running.child.kill("SIGKILL");
      await running.done;
      assert.ok(isAlive(orphan.pid));
    }
    const ports = createPorts(p.root, {
      PATH: process.env.PATH, HOME: process.env.HOME, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1",
      ...(process.platform === "darwin" ? { __CF_USER_TEXT_ENCODING: "test" } : {}),
    });
    const plan = ports.runner.planEnvelope.bind(ports.runner);
    ports.runner.planEnvelope = input => {
      const envelope = plan(input);
      assert.ok(consented.includes(envelope.hash), "the interrupted and retried envelopes must match");
      return envelope;
    };
    let launches = 0;
    const execute = ports.runner.run.bind(ports.runner);
    ports.runner.run = async spec => {
      launches++;
      return execute({ ...spec, argv: [process.execPath, "-e", "process.exit(1)"] });
    };
    const response = await runVerb(ports, VERBS, "check", { h, stage: "baseline" });
    assert.equal(response.exit, 3, JSON.stringify(response));
    assert.equal(response.questions?.[0]?.id, "envelope-consent");
    assert.match(response.questions?.[0]?.question ?? "", /interrupt|crash|side effects/i);
    assert.equal(launches, 0);
    await waitFor(() => !isAlive(orphan!.pid), 5000, "orphan termination before consent");
    const work = Object.values(ports.store.read()!.state.work)[0]!;
    assert.equal(work.receipts.length, 0);
    assert.equal(work.budget.attempts, 0);
    assert.equal(work.session.inCall, undefined);
    const declined = await p.call("decide", { h, kind: "envelope-consent", answers: { "envelope-consent": "decline-envelope" } });
    assert.equal(declined.exit, 0, JSON.stringify(declined));
    assert.equal((await runVerb(ports, VERBS, "check", { h, stage: "baseline" })).questions?.[0]?.id, "envelope-consent");
  } finally {
    running.child.kill("SIGKILL");
    if (orphan) try { process.kill(-orphan.pid, "SIGKILL"); } catch { /* already stopped */ }
  }
});

it("preserves unrelated consents and treats missing replay bindings conservatively [CON-03, SEC-04]", async () => {
  const p = project(); roots.push(p.root);
  await p.call("open", { profile: "feature", request: "recovery consent populations", lane: "quick" });
  const ports = p.ports(), state = ports.store.read()!.state, work = Object.values(state.work)[0]!;
  const envelope = ports.runner.planEnvelope({ projectId: state.workspaceId, root: p.root,
    obligations: [], toExecute: [], stack: ports.stack });
  const consents = [
    { kind: "envelope" as const, configHash: envelope.hash, at: "t" },
    { kind: "envelope" as const, configHash: "unrelated", at: "t" },
    { kind: "hooks" as const, configHash: "hooks", at: "t" },
    { kind: "filters" as const, configHash: "filters", at: "t" },
  ];
  for (const mode of ["unknown", "legacy", "replayable", "commit"] as const) {
    const inCall = { runId: "interrupted", verb: mode === "commit" ? "commit" : "check", since: "t",
      ...(mode === "legacy" ? {} : { executionEnvelope: { ...envelope,
        replayClass: mode === "replayable" ? "replayable" as const : "live-process" as const } }) };
    const checking: WorkContract = { ...work, state: "checking", lastValidPhase: "executing",
      session: { ...work.session, inCall } };
    const before = { ...state, consents, work: { [work.id]: checking } };
    const recovered = recoverStoppedCall(before, checking);
    const expected = mode === "legacy" ? ["hooks", "filters"]
      : mode === "unknown" ? ["unrelated", "hooks", "filters"] : [envelope.hash, "unrelated", "hooks", "filters"];
    assert.deepEqual(recovered.consents.map(consent => consent.configHash), expected, mode);
    assert.equal(recovered.work[work.id]!.session.inCall, undefined);
    assert.equal(recovered.work[work.id]!.session.last, undefined);
    assert.deepEqual(recovered.work[work.id]!.budget, work.budget);
    assert.deepEqual(recovered.work[work.id]!.grants, work.grants);
    assert.equal(before.work[work.id]!.session.inCall, inCall);
    assert.deepEqual(before.consents, consents);
  }
});