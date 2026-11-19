import { after, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, NO_POSIX_PROCESSES } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, focusFixture, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";
import { enableUndoForTests } from "../src/verbs/undo.ts";
import { emptyState, newContract } from "../src/core/state.ts";
import { publishCommit } from "../src/verbs/recover-commit.ts";

enableUndoForTests();
const roots: string[] = [];
after(() => roots.forEach(cleanup));
it("replays the exact old nothing-to-commit result as an idempotent no-op [CON-12]", async () => {
  const p = project(); roots.push(p.root);
  const state = emptyState("legacy-noop", "legacy");
  const parent = p.git("rev-parse", "HEAD");
  const work = newContract({
    id: "legacy", label: "W-0001", generation: 1, now: "2026-11-19T00:00:00Z", version: "0.1.0-m0",
    profile: "feature", request: "legacy no-op", lane: "quick", floor: "quick", level: "L1", assessment: {},
    scopePaths: [], protectedPaths: [], gitMode: "git", base: "main", branch: "main",
    start: { head: parent, branch: "main", staged: [], dirty: [] },
  });
  state.work[work.id] = work;
  const recovery = { state, ports: p.ports(), completed: [] as string[], uncertain: [] as string[] };
  const op = { work: work.id, parent, expectedTree: p.git("rev-parse", "HEAD^{tree}"), paths: [] };
  for (let retry = 0; retry < 2; retry++) {
    await publishCommit(recovery, op, { completed: true, commit: null, tree: null, foreign: [] });
    assert.deepEqual(recovery.uncertain, []);
    assert.equal(recovery.state, state);
    assert.deepEqual(work.git.commits, []);
  }
});
async function ready() {
  const p = project({ "human.txt": "original\n" }); roots.push(p.root);
  p.write("human.txt", "staged\n"); p.git("add", "human.txt"); p.write("human.txt", "staged and dirty\n");
  p.write("untracked.bin", "\0human\n"); p.write(".git/info/exclude", "ignored.bin\n"); p.write("ignored.bin", "\0ignored\n");
  const h = (await p.call("open", { profile: "feature", request: "recover greeting", lane: "quick" })).handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", GREET_TEST); await p.call("check", { h, stage: "baseline" });
  p.write("src/greet.ts", GREET_IMPL); await p.call("check", { h, touched: ["src/greet.ts"] });
  await focusFixture(p, h);
  return { p, h };
}
async function crash(p: Project, h: string, point: string) {
  const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures", "crash-commit.ts"),
    p.root, "commit", JSON.stringify({ h, subject: "Recover greeting" }), point], { stdio: ["ignore", "ignore", "inherit"] });
  assert.equal(await new Promise(resolve => child.on("exit", (_code, signal) => resolve(signal))), "SIGKILL");
}
function gitBytes(p: Project) {
  return {
    head: p.git("rev-parse", "HEAD"), ref: p.git("symbolic-ref", "HEAD"),
    index: readFileSync(join(p.root, ".git", "index")),
    files: ["src/greet.ts", "src/greet.test.ts", "human.txt", "untracked.bin", "ignored.bin"]
      .map(path => readFileSync(join(p.root, path))),
  };
}
for (const point of ["after-act", "after-proof"]) {
  it(`${point}: public recovery never attributes; leave-unrecorded is terminal and byte-preserving [CON-12, GIT-03, GIT-04]`,
    { skip: NO_POSIX_PROCESSES }, async () => {
      const { p, h } = await ready(); await crash(p, h, point);
      const before = gitBytes(p);
      const response = await p.call("commit", { h, subject: "Never repeat" });
      assert.equal(response.exit, 2, JSON.stringify(response));
      const q = response.questions!.find(q => q.id.startsWith("leave-unrecorded-"))!;
      assert.ok(q);
      assert.deepEqual(p.ports().store.commitProofs(), []);
      assert.deepEqual(gitBytes(p), before);
      const first = p.ports().store.read()!.state;
      const work = Object.values(first.work)[0]!;
      assert.deepEqual(work.git.commits, []); assert.deepEqual(work.git.committed, []);
      const again = await p.call("commit", { h, subject: "Still fenced" });
      assert.equal(again.exit, 2);
      assert.deepEqual(p.ports().store.read()!.state.pending, first.pending);
      const target = q.id.slice("leave-unrecorded-".length);
      const input = { h, kind: "leave-unrecorded", target, answers: { [q.id]: "leave-unrecorded" } };
      const cleared = await p.call("decide", input);
      assert.equal(cleared.exit, 0, JSON.stringify(cleared));
      assert.deepEqual((cleared.data as { observedCandidates: string[] }).observedCandidates, [before.head]);
      assert.deepEqual(gitBytes(p), before);
      const next = p.ports().store.read()!.state.work[work.id]!;
      assert.deepEqual(next.git.commits, []); assert.deepEqual(next.git.committed, []);
      assert.deepEqual(next.attention, work.attention);
      assert.deepEqual(p.ports().store.commitProofs(), []);
      const terminal = p.ports().store.readLog().find(e => e.kind === "result" && e.effect === "commit")!.outcome;
      assert.equal((terminal as { disposition: string }).disposition, "leave-unrecorded");
      assert.equal(Object.hasOwn(terminal!, "completed"), false);
      assert.equal((await p.call("decide", input)).historical, true);
      const undo = await p.call("undo", { h });
      assert.equal(undo.reasons[0]?.code, "undo-conflict", JSON.stringify(undo));
      assert.deepEqual(gitBytes(p), before);
    });
}
it("rebinds changed recovery facts instead of accepting an old leave-unrecorded answer [CON-12]",
  { skip: NO_POSIX_PROCESSES }, async () => {
    const { p, h } = await ready(); await crash(p, h, "after-act");
    const fenced = await p.call("commit", { h, subject: "fenced" });
    const q = fenced.questions![0]!, target = q.id.slice("leave-unrecorded-".length);
    p.git("commit", "--allow-empty", "-qm", "later human update");
    const before = gitBytes(p);
    const answer = await p.call("decide", { h, kind: "leave-unrecorded", target, answers: { [q.id]: "leave-unrecorded" } });
    assert.equal(answer.exit, 3, JSON.stringify(answer));
    assert.equal(answer.reasons[0]?.code, "revision-conflict");
    assert.notEqual(answer.questions![0]!.bind.factsHash, q.bind.factsHash);
    assert.deepEqual(gitBytes(p), before);
    assert.equal(p.ports().store.readLog().some(e => e.kind === "result" && e.effect === "commit"), false);
    const accepted = await p.call("decide", {
      h, kind: "leave-unrecorded", target, answers: { [q.id]: "leave-unrecorded" },
    });
    assert.equal(accepted.exit, 0, JSON.stringify(accepted));
    assert.deepEqual(gitBytes(p), before);
  });
for (const point of ["before-act", "after-result"]) {
  it(`${point}: public recovery resolves only an unchanged interval or a durable result [CON-12]`,
    { skip: NO_POSIX_PROCESSES }, async () => {
      const { p, h } = await ready(); await crash(p, h, point);
      const before = gitBytes(p), count = p.git("rev-list", "--count", "HEAD");
      const recovered = await p.call("open", { profile: "investigate", request: "recover once" });
      assert.equal(recovered.effects?.uncertain.length ?? 0, 0, JSON.stringify(recovered));
      const work = Object.values(p.ports().store.read()!.state.work)[0]!;
      assert.equal(work.git.commits.length, point === "after-result" ? 1 : 0);
      assert.equal(p.ports().store.commitProofs().length, point === "after-result" ? 1 : 0);
      await p.call("open", { profile: "investigate", request: "recover twice" });
      assert.deepEqual(p.ports().store.read()!.state.work[work.id]!.attention, work.attention);
      assert.deepEqual(gitBytes(p), before); assert.equal(p.git("rev-list", "--count", "HEAD"), count);
    });
}
for (const damage of ["missing", "corrupt", "duplicate"]) {
  it(`unpublished result with ${damage} private proof stays uncertain [CON-12]`,
    { skip: NO_POSIX_PROCESSES }, async () => {
      const { p, h } = await ready(); await crash(p, h, "after-result");
      const directory = join(p.root, ".tenet", "git", "commit-proofs-v1");
      const file = join(directory, readdirSync(directory)[0]!);
      if (damage === "missing") rmSync(file);
      if (damage === "corrupt") writeFileSync(file, "{broken");
      if (damage === "duplicate") writeFileSync(join(directory, "0".repeat(64)), readFileSync(file));
      const before = gitBytes(p);
      for (let retry = 0; retry < 2; retry++) {
        const recovery = await p.call("open", { profile: "investigate", request: "recover without promoting" });
        assert.ok(recovery.effects?.uncertain.length, JSON.stringify(recovery));
        assert.deepEqual(Object.values(p.ports().store.read()!.state.work)[0]!.git.commits, []);
        assert.deepEqual(gitBytes(p), before);
      }
    });
}

function gitBytesOfLegacy(p: Project) {
  return { head: p.git("rev-parse", "HEAD"), index: readFileSync(join(p.root, ".git", "index")),
    source: readFileSync(join(p.root, "src", "greet.ts")) };
}
for (const foreign of [[], ["human.txt"], undefined, [1]]) {
  it(`legacy publication preserves foreign=${JSON.stringify(foreign)} without deriving proof fields [CON-12]`,
    { skip: NO_POSIX_PROCESSES }, async () => {
      const p = project(); roots.push(p.root);
      await p.call("open", { profile: "investigate", request: "legacy publication" });
      const work = Object.values(p.ports().store.read()!.state.work)[0]!;
      const parent = p.git("rev-parse", "HEAD");
      p.git("commit", "--allow-empty", "-qm", `Older commit\n\nTenet-Work: ${work.label}`);
      const commit = p.git("rev-parse", "HEAD");
      await p.ports().store.transaction("legacy", async tx => {
        tx.intent("commit", "legacy-run", { work: work.id, parent, expectedTree: p.git("rev-parse", "HEAD^{tree}"), paths: [] });
        tx.result("commit", "legacy-run", { completed: true, commit, foreign });
      });
      const before = gitBytesOfLegacy(p);
      const replay = await p.call("open", { profile: "investigate", request: "recover old completion" });
      const valid = Array.isArray(foreign) && foreign.every(path => typeof path === "string");
      assert.equal(!!replay.effects?.uncertain.length, !valid, JSON.stringify(replay));
      const recovered = p.ports().store.read()!.state.work[work.id]!;
      assert.deepEqual(recovered.git.commits, valid ? [commit] : []);
      assert.deepEqual(recovered.attention.map(item => item.path), valid ? foreign : []);
      assert.deepEqual(p.ports().store.commitProofs(), []);
      await p.call("open", { profile: "investigate", request: "repeat legacy replay" });
      assert.deepEqual(p.ports().store.read()!.state.work[work.id]!.attention, recovered.attention);
      assert.deepEqual(gitBytesOfLegacy(p), before);
    });
}

it("replays a durable leave-unrecorded disposition after death before State publication [CON-12]",
  { skip: NO_POSIX_PROCESSES }, async () => {
    const { p, h } = await ready(); await crash(p, h, "after-act");
    const fenced = await p.call("commit", { h, subject: "fenced" });
    const q = fenced.questions![0]!, target = q.id.slice("leave-unrecorded-".length);
    const input = { h, kind: "leave-unrecorded", target, answers: { [q.id]: "leave-unrecorded" } };
    const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures", "crash-commit.ts"),
      p.root, "decide", JSON.stringify(input), "after-unrecorded-result"], { stdio: ["ignore", "ignore", "inherit"] });
    assert.equal(await new Promise(resolve => child.on("exit", (_code, signal) => resolve(signal))), "SIGKILL");
    assert.ok(p.ports().store.read()!.state.pending.some(p => p.id === q.id));
    const before = gitBytes(p);
    await p.call("open", { profile: "investigate", request: "replay terminal decision" });
    assert.equal(p.ports().store.read()!.state.pending.some(p => p.id === q.id), false);
    const retry = await p.call("decide", input);
    assert.equal(retry.exit, 0, JSON.stringify(retry));
    assert.deepEqual(gitBytes(p), before);
    assert.deepEqual(p.ports().store.commitProofs(), []);
  });
