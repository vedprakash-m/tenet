import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { pathToFileURL } from "node:url";
import { State, WorkContract } from "../src/core/schemas.ts";
import { emptyState, newContract } from "../src/core/state.ts";
import { runVerb } from "../src/pipeline.ts";
import type { Ports, Store, Tx } from "../src/ports/types.ts";
import { decide } from "../src/verbs/decide.ts";
import { enableUndoForTests, undo } from "../src/verbs/undo.ts";
import { createPorts } from "../src/wire.ts";

enableUndoForTests();

type Scenario =
  | "same-label-at-preview" | "same-label" | "same-label-merged" | "relevant-after-preview" | "unchanged"
  | "same-label-empty" | "different-label-empty"
  | "recorded-merge" | "recorded-unreachable" | "shallow"
  | "recorded-unreachable-after-preview"
  | "multiple-owned" | "overlap" | "dirty-owned" | "dirty-after-preview"
  | "staged-after-preview" | "dirty-during-confirm" | "untracked-affected-at-preview"
  | "untracked-affected-after-preview" | "cancel";

const isGitEnv = (key: string) => key.toUpperCase().startsWith("GIT_");

function memoryStore(ports: Ports, scratch: string, initial: State) {
  let state = initial;
  const blobs = new Map<string, string>();
  const intents: Array<{ effect: string; id: string; op: unknown }> = [];
  const results: Array<{ effect: string; id: string; outcome: unknown }> = [];
  const unused = (): never => { throw new Error("unexpected simulated-store operation"); };
  const overrides: Partial<Store> = {
    admit() {}, exists: () => true, read: () => ({ state, recovered: false }),
    alive: async () => false, self: () => ({ pid: 12345, procStart: "synthetic" }),
    tempDir(name) { const dir = join(scratch, name); mkdirSync(dir); return dir; },
    writeArtifact(dir, name, content) { const file = join(dir, name); writeFileSync(file, content); return file; },
    putBlob(content) { const id = `blob-${blobs.size}`; blobs.set(id, content); return id; },
    readBlob: (id) => blobs.get(id) ?? null,
    async transaction<T>(_name: string, run: (tx: Tx) => Promise<T>): Promise<T> {
      let current = structuredClone(state);
      const tx: Tx = {
        get state() { return current; }, recovered: false, ensure: unused, evict: unused,
        recent: () => [], call() {},
        intent(effect, id, op) { intents.push({ effect, id, op: structuredClone(op) }); },
        result(effect, id, outcome) { results.push({ effect, id, outcome }); },
        unresolved: () => intents.filter((intent) =>
          !results.some((result) => result.effect === intent.effect && result.id === intent.id)),
        publish(next) { state = State.parse({ ...next, revision: current.revision + 1 }); current = state; },
      };
      return run(tx);
    },
  };
  const store = new Proxy(ports.store, {
    get(_target, key) {
      if (!Object.hasOwn(overrides, key)) throw new Error(`unexpected simulated-store operation: ${String(key)}`);
      return Reflect.get(overrides, key);
    },
  });
  return { store, state: () => state, intents, results };
}

async function observe(scenario: Scenario, beforeGit?: () => void) {
  const scratch = mkdtempSync(join(tmpdir(), "tenet-undo-confirm-"));
  let root = join(scratch, "project");
  const config = join(scratch, "global.gitconfig");
  mkdirSync(root);
  writeFileSync(config, "");
  const savedGitEnv = Object.entries(process.env).filter(([key]) => isGitEnv(key));
  for (const [key] of savedGitEnv) delete process.env[key];
  process.env.GIT_CONFIG_GLOBAL = config;
  process.env.GIT_CONFIG_NOSYSTEM = "1";
  process.env.GIT_TERMINAL_PROMPT = "0";
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  try {
    beforeGit?.();
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.com");
    git("config", "commit.gpgsign", "false");
    git("config", "core.autocrlf", "false");
    mkdirSync(join(root, "src"));
    const multipleOwned = scenario === "multiple-owned";
    const untrackedBytes = Buffer.from([0x00, 0x01, 0x7f, 0x80, 0xff]);
    const ignoredBytes = Buffer.from([0xff, 0x00, 0x24, 0xfe]);
    const partiallyReachable = scenario === "recorded-unreachable-after-preview";
    const relevantAfterPreview = scenario === "relevant-after-preview";
    const deletedOwned = scenario === "untracked-affected-at-preview" || scenario === "untracked-affected-after-preview";
    const laterContext = "context one\ncontext two\ncontext three\ncontext four\ntrailer\n";
    writeFileSync(join(root, "src", "owned.txt"),
      multipleOwned ? "header\nbefore\nfooter\n" : relevantAfterPreview ? `header\nbefore\n${laterContext}` : "before\n");
    git("add", "src/owned.txt");
    if (multipleOwned) {
      mkdirSync(join(root, "docs"));
      writeFileSync(join(root, "docs", "staged.txt"), "initial staged\n");
      writeFileSync(join(root, "docs", "dirty.txt"), "initial dirty\n");
      git("add", "docs/staged.txt", "docs/dirty.txt");
    }
    git("commit", "-qm", "Initial");
    const base = git("rev-parse", "HEAD");
    if (deletedOwned) rmSync(join(root, "src", "owned.txt"));
    else writeFileSync(join(root, "src", "owned.txt"),
      multipleOwned ? "header\nfirst owned\nfooter\n" : relevantAfterPreview ? `header\nowned change\n${laterContext}` : "owned change\n");
    git("add", "src/owned.txt");
    git("commit", "-qm", "Owned change\n\nTenet-Work: W-0001");
    const owned = [git("rev-parse", "HEAD")];
    if (multipleOwned) {
      writeFileSync(join(root, "src", "owned.txt"), "header\nsecond owned\nfooter\n");
      git("add", "src/owned.txt");
      git("commit", "-qm", "Second owned change\n\nTenet-Work: W-0001");
      owned.push(git("rev-parse", "HEAD"));
    } else if (partiallyReachable) {
      writeFileSync(join(root, "src", "second.txt"), "second owned change\n");
      git("add", "src/second.txt");
      git("commit", "-qm", "Second owned change\n\nTenet-Work: W-0001");
      owned.push(git("rev-parse", "HEAD"));
    } else if (scenario === "recorded-merge") {
      const side = git("commit-tree", `${owned[0]}^{tree}`, "-p", base, "-m", "Side history");
      git("merge", "--quiet", "--no-ff", "-m", "Owned merge\n\nTenet-Work: W-0001", side);
      const merge = git("rev-parse", "HEAD");
      assert.deepEqual(git("rev-list", "--parents", "-n", "1", merge).split(" ").slice(1), [owned[0], side]);
      owned.push(merge);
    } else if (scenario === "recorded-unreachable") {
      const unreachable = git("commit-tree", `${base}^{tree}`, "-p", base,
        "-m", "Recorded work outside current history\n\nTenet-Work: W-0001");
      assert.equal(git("rev-list", "HEAD").split("\n").includes(unreachable), false);
      owned.push(unreachable);
    }
    if (scenario === "shallow") {
      const clone = join(scratch, "shallow");
      execFileSync("git", ["clone", "--quiet", "--depth=1", pathToFileURL(root).href, clone], { cwd: scratch });
      root = clone;
      assert.equal(git("rev-parse", "--is-shallow-repository"), "true");
      assert.equal(git("rev-list", "--count", "HEAD"), "1");
      assert.equal(git("rev-parse", "HEAD"), owned[0]);
    }

    const ports = createPorts(root);
    ports.platform = "linux";
    let applyCount = 0;
    ports.runner.guardRun = () => {};
    ports.runner.run = async (spec) => {
      assert.equal(spec.argv[0], "git");
      applyCount++;
      const stdout = execFileSync(spec.argv[0], spec.argv.slice(1), {
        cwd: spec.cwd, env: { ...process.env, ...spec.env }, encoding: "utf8",
      });
      return { exit: 0, stdout, stderr: "", timedOut: false, durationMs: 0, startedAt: "2026-11-08T03:00:00.000Z", report: null };
    };
    const seed = newContract({
      id: "wk_synthetic", label: "W-0001", profile: "feature", request: "synthetic",
      lane: "quick", floor: "quick", level: "L4", generation: 1,
      now: "2026-11-08T03:00:00.000Z", version: ports.version,
      adapter: ports.stack.adapterVersion(), assessment: {},
      scopePaths: partiallyReachable ? ["src/owned.txt", "src/second.txt"] : ["src/owned.txt"],
      protectedPaths: [], gitMode: "git", base, branch: "main",
      start: { head: base, branch: "main", staged: [], dirty: [] },
    });
    const work = WorkContract.parse({
      ...seed, state: "finished",
      grants: [{ id: "synthetic", actions: ["local-routine"], source: "request",
        capture: "reported", bind: { factsHash: "synthetic" } }],
      git: { ...seed.git, commits: owned, committed: partiallyReachable ? ["src/owned.txt", "src/second.txt"] : ["src/owned.txt"] },
      touched: partiallyReachable ? [{ path: "src/owned.txt" }, { path: "src/second.txt" }] : [{ path: "src/owned.txt" }],
    });
    const state = State.parse({
      ...emptyState("synthetic", "abcd"), generationSeq: 1, workSeq: 1, work: { [work.id]: work },
    });
    const memory = memoryStore(ports, scratch, state);
    ports.store = memory.store;
    const verbs = { undo, decide };
    if (scenario === "same-label" || scenario === "same-label-at-preview" || scenario === "same-label-merged") {
      mkdirSync(join(root, "docs"));
      writeFileSync(join(root, "docs", "human.txt"), "later human work\n");
      git("add", "docs/human.txt");
      const label = scenario === "same-label-at-preview" ? "W-0001" : "W-0002";
      git("commit", "-qm", `Human change\n\nTenet-Work: ${label}`);
    }
    if (multipleOwned) {
      writeFileSync(join(root, "src", "owned.txt"), "header\nsecond owned\nfooter\nlater human\n");
      git("add", "src/owned.txt");
      git("commit", "-qm", "Later human change\n\nTenet-Work: W-0002");
      writeFileSync(join(root, "docs", "staged.txt"), "human staged\n");
      git("add", "docs/staged.txt");
      writeFileSync(join(root, "docs", "staged.txt"), "human staged\nhuman unstaged\n");
      writeFileSync(join(root, "docs", "dirty.txt"), "human dirty\n");
      writeFileSync(join(root, "docs", "untracked.bin"), untrackedBytes);
      writeFileSync(join(root, ".git", "info", "exclude"), "docs/ignored.bin\n");
      writeFileSync(join(root, "docs", "ignored.bin"), ignoredBytes);
      assert.equal(git("status", "--short", "--", "docs/staged.txt"), "MM docs/staged.txt");
      assert.equal(git("show", ":docs/staged.txt"), "human staged");
      assert.equal(git("status", "--short", "--", "docs/untracked.bin"), "?? docs/untracked.bin");
      assert.equal(git("status", "--short", "--", "docs/ignored.bin"), "");
      assert.equal(git("check-ignore", "docs/ignored.bin"), "docs/ignored.bin");
    } else if (scenario === "overlap") {
      writeFileSync(join(root, "src", "owned.txt"), "later human replacement\n");
      git("add", "src/owned.txt");
      git("commit", "-qm", "Overlapping human change\n\nTenet-Work: W-0002");
    } else if (scenario === "dirty-owned") {
      writeFileSync(join(root, "src", "owned.txt"), "uncommitted human change\n");
    } else if (scenario === "untracked-affected-at-preview") {
      writeFileSync(join(root, "src", "owned.txt"), untrackedBytes);
      assert.equal(git("status", "--short", "--", "src/owned.txt"), "?? src/owned.txt");
    }
    const beforePreviewHead = git("rev-parse", "HEAD");
    const beforePreviewIndex = readFileSync(join(root, ".git", "index"));
    const planUndo = ports.git.planUndo.bind(ports.git);
    let plans = 0;
    ports.git.planUndo = async (...args) => {
      plans++;
      if (scenario === "dirty-during-confirm" && plans === 2) {
        writeFileSync(join(root, "src", "owned.txt"), "human change during confirmation\n");
      }
      return planUndo(...args);
    };
    if (scenario === "recorded-merge" || scenario === "recorded-unreachable" || scenario === "shallow") {
      const found = await ports.git.workCommits(work.label);
      assert.equal(found.shallow, scenario === "shallow");
      assert.equal(found.merges, scenario === "recorded-merge");
      assert.deepEqual(new Set(found.commits), new Set(scenario === "recorded-merge" ? owned : [owned[0]]));
    }
    const preview = await runVerb(ports, verbs, "undo", { h: "W1.1.abcd" });
    if (scenario === "same-label-at-preview" || scenario === "recorded-merge" || scenario === "recorded-unreachable" || scenario === "shallow" ||
        scenario === "overlap" || scenario === "dirty-owned" || scenario === "untracked-affected-at-preview") {
      assert.equal(preview.reasons[0]?.code, scenario === "recorded-unreachable" ? "capability-missing" : "undo-conflict",
        JSON.stringify(preview));
      assert.match(preview.reasons[0]!.message, scenario === "same-label-at-preview" ? /ownership cannot be established/ :
        scenario === "recorded-merge" ? /a commit of this work is a merge commit/ :
          scenario === "recorded-unreachable" ? /work's commits are not all on the current branch/ :
            scenario === "shallow" ? /shallow clone/ :
              scenario === "overlap" ? /a later change overlaps/ : /uncommitted changes/);
      assert.equal(preview.questions?.length ?? 0, 0);
      assert.equal(plans, scenario === "overlap" || scenario === "dirty-owned" || scenario === "untracked-affected-at-preview" ? 1 : 0);
      assert.equal(applyCount, 0);
      assert.equal(git("branch", "--show-current"), "main");
      assert.equal(git("rev-parse", "HEAD"), beforePreviewHead);
      assert.deepEqual(readFileSync(join(root, ".git", "index")), beforePreviewIndex);
      if (scenario === "untracked-affected-at-preview") {
        assert.deepEqual(readFileSync(join(root, "src", "owned.txt")), untrackedBytes);
        assert.equal(git("status", "--short", "--", "src/owned.txt"), "?? src/owned.txt");
      } else {
        assert.equal(readFileSync(join(root, "src", "owned.txt"), "utf8"),
          scenario === "overlap" ? "later human replacement\n" :
            scenario === "dirty-owned" ? "uncommitted human change\n" : "owned change\n");
      }
      if (scenario === "same-label-at-preview") {
        assert.equal(readFileSync(join(root, "docs", "human.txt"), "utf8"), "later human work\n");
      }
      assert.equal(existsSync(join(root, ".tenet")), false);
      assert.deepEqual(memory.intents, []);
      assert.deepEqual(memory.results, []);
      assert.equal(memory.state().pending.length, 0);
      assert.equal(memory.state().work[work.id]!.git.undoneBy, undefined);
      assert.equal(Object.keys(memory.state().work).length, 1);
      return;
    }
    assert.equal(preview.exit, 3, JSON.stringify(preview));
    assert.equal(preview.questions?.[0]?.id, "undo-confirm", JSON.stringify(preview));
    assert.equal(git("rev-parse", "HEAD"), beforePreviewHead);
    assert.deepEqual(readFileSync(join(root, ".git", "index")), beforePreviewIndex);
    assert.deepEqual(memory.intents, []);
    assert.equal(applyCount, 0);
    if (multipleOwned) {
      const data = preview.data as { paths: string[]; laterChangesTouching: string[] };
      assert.deepEqual(data.paths, ["src/owned.txt"]);
      assert.deepEqual(data.laterChangesTouching, [git("log", "-1", "--format=%h %s")]);
      assert.equal(readFileSync(join(root, "src", "owned.txt"), "utf8"), "header\nsecond owned\nfooter\nlater human\n");
    }
    const pendingHash = preview.questions![0]!.bind.factsHash;
    const previewHead = git("rev-parse", "HEAD"), previewTree = git("rev-parse", "HEAD^{tree}");
    const previewPlans = plans;

    if (scenario === "same-label") {
      writeFileSync(join(root, "docs", "human.txt"), "temporary human work\n");
      git("add", "docs/human.txt");
      git("commit", "-qm", "Later change\n\nTenet-Work: W-0001");
      writeFileSync(join(root, "docs", "human.txt"), "later human work\n");
      git("add", "docs/human.txt");
      git("commit", "-qm", "Revert later change\n\nTenet-Work: W-0001");
      assert.notEqual(git("rev-parse", "HEAD"), previewHead);
      assert.equal(git("rev-parse", "HEAD^{tree}"), previewTree);
    } else if (scenario === "same-label-merged") {
      const side = git("commit-tree", `${previewHead}^{tree}`, "-p", previewHead,
        "-m", "Foreign side history\n\nTenet-Work: W-0001");
      git("merge", "--quiet", "--no-ff", "-m", "Merge side history", side);
      assert.deepEqual(git("rev-list", "--parents", "-n", "1", "HEAD").split(" ").slice(1), [previewHead, side]);
      assert.equal(git("rev-parse", "HEAD^{tree}"), previewTree);
      assert.equal(git("rev-list", "--first-parent", "HEAD").split("\n").includes(side), false);
    } else if (scenario === "same-label-empty" || scenario === "different-label-empty") {
      const label = scenario === "same-label-empty" ? "W-0001" : "W-0002";
      git("commit", "--allow-empty", "-qm", `Later empty commit\n\nTenet-Work: ${label}`);
      assert.notEqual(git("rev-parse", "HEAD"), previewHead);
      assert.equal(git("rev-parse", "HEAD^{tree}"), previewTree);
      assert.equal(git("rev-parse", "HEAD^"), previewHead);
    } else if (partiallyReachable) {
      assert.deepEqual((preview.data as { paths: string[] }).paths, ["src/owned.txt", "src/second.txt"]);
      const replacement = git("commit-tree", previewTree, "-p", owned[0]!,
        "-m", "Rewritten change\n\nTenet-Work: W-0002");
      git("update-ref", "refs/heads/main", replacement, previewHead);
      assert.equal(git("rev-parse", "HEAD^{tree}"), previewTree);
      assert.notEqual(git("rev-parse", "HEAD"), previewHead);
      assert.deepEqual((await ports.git.workCommits(work.label)).commits, [owned[0]]);
      assert.equal(git("rev-list", "HEAD").split("\n").includes(owned[1]!), false);
    } else if (relevantAfterPreview) {
      writeFileSync(join(root, "src", "owned.txt"), `header\nowned change\n${laterContext}later human work\n`);
      git("add", "src/owned.txt");
      git("commit", "-qm", "Later change\n\nTenet-Work: W-0002");
      const later = await ports.git.laterCommits(owned[0]!, ["src/owned.txt"]);
      assert.notDeepEqual(later, (preview.data as { laterChangesTouching: string[] }).laterChangesTouching);
    } else if (scenario === "dirty-after-preview" || scenario === "staged-after-preview") {
      writeFileSync(join(root, "src", "owned.txt"), "human change after preview\n");
      if (scenario === "staged-after-preview") git("add", "src/owned.txt");
    } else if (scenario === "untracked-affected-after-preview") {
      writeFileSync(join(root, "src", "owned.txt"), untrackedBytes);
      assert.equal(git("status", "--short", "--", "src/owned.txt"), "?? src/owned.txt");
    }
    const beforeHead = git("rev-parse", "HEAD");
    const beforeIndex = readFileSync(join(root, ".git", "index"));
    const beforeWork = structuredClone(memory.state().work[work.id]);
    const confirmation = await runVerb(ports, verbs, "decide", {
      h: "W1.1.abcd", kind: "undo-confirm", answers: { "undo-confirm": scenario === "cancel" ? "cancel" : "apply" },
    });

    assert.equal(git("branch", "--show-current"), "main");
    assert.equal(git("rev-parse", "HEAD"), beforeHead);
    assert.deepEqual(readFileSync(join(root, ".git", "index")), beforeIndex);
    assert.equal(existsSync(join(root, ".tenet")), false);
    if (scenario === "unchanged" || scenario === "different-label-empty" || multipleOwned) {
      assert.equal(confirmation.exit, 0, JSON.stringify(confirmation));
      assert.equal(applyCount, 1);
      assert.equal(plans - previewPlans, 1);
      assert.ok(confirmation.next?.some((next) => next.action === "check"), JSON.stringify(confirmation));
      assert.equal(readFileSync(join(root, "src", "owned.txt"), "utf8"),
        multipleOwned ? "header\nbefore\nfooter\nlater human\n" : "before\n");
      if (multipleOwned) {
        assert.equal(readFileSync(join(root, "docs", "staged.txt"), "utf8"), "human staged\nhuman unstaged\n");
        assert.equal(readFileSync(join(root, "docs", "dirty.txt"), "utf8"), "human dirty\n");
        assert.deepEqual(readFileSync(join(root, "docs", "untracked.bin")), untrackedBytes);
        assert.deepEqual(readFileSync(join(root, "docs", "ignored.bin")), ignoredBytes);
        assert.equal(git("show", ":docs/staged.txt"), "human staged");
        assert.equal(git("show", ":docs/dirty.txt"), "initial dirty");
        assert.equal(git("status", "--short", "--", "docs/untracked.bin"), "?? docs/untracked.bin");
        assert.equal(git("status", "--short", "--", "docs/ignored.bin"), "");
        assert.equal(git("check-ignore", "docs/ignored.bin"), "docs/ignored.bin");
      }
      assert.equal(memory.intents.length, 1);
      assert.deepEqual(memory.results.map((result) => result.outcome), [{ completed: true }]);
      assert.ok(memory.state().work[work.id]!.git.undoneBy);
      assert.equal(Object.keys(memory.state().work).length, 2);
      assert.equal(memory.state().pending.some((question) => question.id === "undo-confirm"), false);
    } else if (scenario === "cancel") {
      assert.equal(confirmation.exit, 0, JSON.stringify(confirmation));
      assert.equal(plans - previewPlans, 0);
      assert.equal(applyCount, 0);
      assert.deepEqual(memory.intents, []);
      assert.deepEqual(memory.results, []);
      assert.equal(readFileSync(join(root, "src", "owned.txt"), "utf8"), "owned change\n");
      assert.equal(memory.state().work[work.id]!.state, beforeWork!.state);
      assert.deepEqual(memory.state().work[work.id]!.git, beforeWork!.git);
      assert.deepEqual(memory.state().work[work.id]!.touched, beforeWork!.touched);
      assert.equal(Object.keys(memory.state().work).length, 1);
      assert.equal(memory.state().pending.some((question) => question.id === "undo-confirm"), false);
    } else {
      assert.equal(applyCount, 0);
      assert.deepEqual(memory.intents, []);
      assert.deepEqual(memory.results, []);
      if (scenario === "untracked-affected-after-preview") {
        assert.deepEqual(readFileSync(join(root, "src", "owned.txt")), untrackedBytes);
        assert.equal(git("status", "--short", "--", "src/owned.txt"), "?? src/owned.txt");
      } else {
        assert.equal(readFileSync(join(root, "src", "owned.txt"), "utf8"),
          scenario === "dirty-during-confirm" ? "human change during confirmation\n" :
            scenario === "dirty-after-preview" || scenario === "staged-after-preview" ? "human change after preview\n" :
            relevantAfterPreview ? `header\nowned change\n${laterContext}later human work\n` : "owned change\n");
      }
      if (scenario === "same-label" || scenario === "same-label-merged") {
        assert.equal(readFileSync(join(root, "docs", "human.txt"), "utf8"), "later human work\n");
      }
      if (scenario === "staged-after-preview") {
        assert.equal(git("show", ":src/owned.txt"), "human change after preview");
      }
      if (partiallyReachable) {
        assert.equal(readFileSync(join(root, "src", "second.txt"), "utf8"), "second owned change\n");
      }
      assert.deepEqual(memory.state().work[work.id], beforeWork);
      assert.equal(Object.keys(memory.state().work).length, 1);
      assert.equal(memory.state().pending.find((question) => question.id === "undo-confirm")?.bind.factsHash, pendingHash);
      assert.equal(confirmation.reasons[0]?.code, partiallyReachable ? "capability-missing" :
        relevantAfterPreview ? "revision-conflict" : "undo-conflict", JSON.stringify(confirmation));
      if (scenario === "same-label" || scenario === "same-label-merged" || scenario === "same-label-empty" || partiallyReachable) {
        assert.match(confirmation.reasons[0]!.message, partiallyReachable ?
          /work's commits are not all on the current branch/ : /ownership cannot be established/);
        assert.equal(plans - previewPlans, 0);
      } else {
        assert.equal(plans - previewPlans, 1);
      }
      if (scenario === "dirty-after-preview" || scenario === "staged-after-preview" || scenario === "dirty-during-confirm" ||
          scenario === "untracked-affected-after-preview") {
        assert.match(confirmation.reasons[0]!.message, /uncommitted changes/);
      }
    }
  } finally {
    for (const key of Object.keys(process.env).filter(isGitEnv)) delete process.env[key];
    for (const [key, value] of savedGitEnv) process.env[key] = value;
    rmSync(scratch, { recursive: true, force: true });
  }
}

it("isolates scratch Git operations from inherited mixed-case Git variables", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "tenet-undo-env-"));
  const sentinel = join(scratch, "sentinel");
  const config = join(scratch, "global.gitconfig");
  const savedGitEnv = Object.entries(process.env).filter(([key]) => isGitEnv(key));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !isGitEnv(key)));
  try {
    mkdirSync(sentinel);
    writeFileSync(config, "");
    Object.assign(env, { GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0" });
    const git = (...args: string[]) => execFileSync("git", args, { cwd: sentinel, env, encoding: "utf8" }).trim();
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.com");
    git("config", "commit.gpgsign", "false");
    writeFileSync(join(sentinel, "sentinel.txt"), "sentinel\n");
    git("add", "sentinel.txt");
    git("commit", "-qm", "Sentinel");
    const head = git("rev-parse", "HEAD");
    const localConfig = readFileSync(join(sentinel, ".git", "config"));
    const index = readFileSync(join(sentinel, ".git", "index"));
    for (const [key] of savedGitEnv) delete process.env[key];
    process.env.Git_Dir = join(sentinel, ".git");
    process.env.Git_Work_Tree = sentinel;
    process.env.Git_Index_File = join(sentinel, ".git", "index");
    process.env.Git_Config_Count = "1";
    process.env.Git_Config_Key_0 = "user.name";
    process.env.Git_Config_Value_0 = "inherited override";
    await observe("unchanged", () => {
      assert.equal(process.env.Git_Dir, undefined);
      assert.equal(process.env.Git_Work_Tree, undefined);
      assert.equal(process.env.Git_Index_File, undefined);
      assert.equal(process.env.Git_Config_Count, undefined);
      assert.equal(process.env.Git_Config_Key_0, undefined);
      assert.equal(process.env.Git_Config_Value_0, undefined);
    });
    assert.equal(process.env.Git_Dir, join(sentinel, ".git"));
    assert.equal(process.env.Git_Work_Tree, sentinel);
    assert.equal(process.env.Git_Index_File, join(sentinel, ".git", "index"));
    assert.equal(process.env.Git_Config_Count, "1");
    assert.equal(process.env.Git_Config_Key_0, "user.name");
    assert.equal(process.env.Git_Config_Value_0, "inherited override");
    assert.equal(git("rev-parse", "HEAD"), head);
    assert.equal(git("status", "--porcelain"), "");
    assert.deepEqual(readFileSync(join(sentinel, ".git", "config")), localConfig);
    assert.deepEqual(readFileSync(join(sentinel, ".git", "index")), index);
    assert.equal(readFileSync(join(sentinel, "sentinel.txt"), "utf8"), "sentinel\n");
  } finally {
    for (const key of Object.keys(process.env).filter(isGitEnv)) delete process.env[key];
    for (const [key, value] of savedGitEnv) process.env[key] = value;
    rmSync(scratch, { recursive: true, force: true });
  }
});

it("restores inherited Git overrides after a simulated undo setup failure", async () => {
  const savedGitEnv = Object.entries(process.env).filter(([key]) => isGitEnv(key));
  const entries = () => Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => isGitEnv(key)).map(([key, value]) => [key.toUpperCase(), value]));
  const failure = new Error("synthetic setup failure");
  try {
    for (const [key] of savedGitEnv) delete process.env[key];
    Object.assign(process.env, {
      Git_Dir: "synthetic-git-dir",
      Git_Index_File: "synthetic-index",
      Git_Config_Count: "1",
      Git_Config_Key_0: "user.name",
      Git_Config_Value_0: "inherited override",
    });
    const before = entries();
    await assert.rejects(observe("unchanged", () => {
      assert.equal(process.env.Git_Dir, undefined);
      assert.equal(process.env.Git_Index_File, undefined);
      assert.equal(process.env.Git_Config_Count, undefined);
      throw failure;
    }), (error) => error === failure);
    assert.deepEqual(entries(), before);
  } finally {
    for (const key of Object.keys(process.env).filter(isGitEnv)) delete process.env[key];
    for (const [key, value] of savedGitEnv) process.env[key] = value;
  }
});

it("refuses a foreign same-label commit before undo preview with a simulated store [GIT-04]", async () => {
  await observe("same-label-at-preview");
});

it("refuses a recorded merge commit before undo preview with a simulated store [GIT-04]", async () => {
  await observe("recorded-merge");
});

it("refuses a recorded commit outside current history before undo preview with a simulated store [GIT-04]", async () => {
  await observe("recorded-unreachable");
});

it("refuses a real shallow clone before undo preview with a simulated store [GIT-04]", async () => {
  await observe("shallow");
});

it("refuses a partially unreachable recorded history after undo preview with a simulated store [GIT-04]", async () => {
  await observe("recorded-unreachable-after-preview");
});

it("refuses foreign same-label commits after a preview even when their net tree is unchanged [GIT-04]", async () => {
  await observe("same-label");
});

it("refuses a foreign same-label commit in merged history after preview with a simulated store [GIT-04]", async () => {
  await observe("same-label-merged");
});

it("refuses a same-label empty commit after preview with a simulated store [GIT-04]", async () => {
  await observe("same-label-empty");
});

it("allows a differently labeled empty commit after preview with a simulated store [GIT-04]", async () => {
  await observe("different-label-empty");
});

it("refuses a stale undo preview after a later same-file commit with a simulated store [GIT-04]", async () => {
  await observe("relevant-after-preview");
});

it("applies an unchanged undo preview with a simulated store [GIT-04]", async () => {
  await observe("unchanged");
});

it("reverts multiple owned commits and preserves later, staged, unstaged, untracked and ignored work with a simulated store [GIT-04]", async () => {
  await observe("multiple-owned");
});

it("refuses a later overlapping human commit before preview with a simulated store [GIT-04]", async () => {
  await observe("overlap");
});

it("refuses uncommitted changes in an affected file before preview with a simulated store [GIT-04]", async () => {
  await observe("dirty-owned");
});

it("refuses an affected file changed after preview with a simulated store [GIT-04]", async () => {
  await observe("dirty-after-preview");
});

it("refuses an affected file staged after preview without changing the index [GIT-04]", async () => {
  await observe("staged-after-preview");
});

it("refuses an affected file changed during confirmation planning with a simulated store [GIT-04]", async () => {
  await observe("dirty-during-confirm");
});

it("refuses a recreated untracked affected file before undo preview with a simulated store [GIT-04]", async () => {
  await observe("untracked-affected-at-preview");
});

it("refuses a recreated untracked affected file after undo preview with a simulated store [GIT-04]", async () => {
  await observe("untracked-affected-after-preview");
});

it("cancels a preview without applying the inverse with a simulated store [GIT-04]", async () => {
  await observe("cancel");
});
