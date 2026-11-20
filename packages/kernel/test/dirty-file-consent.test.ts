import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanup } from "./helpers.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import {
  BASIS, GREET_IMPL, GREET_TEST, callWithEnvelopeConsent, finishFixture, focusFixture, project,
} from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = (): Project => {
  const p = project();
  const ports = p.ports;
  p.ports = () => ({ ...ports(), platform: "linux" });
  p.rawCall = (verb, input = {}) => runVerb(p.ports(), VERBS, verb, input);
  p.call = (verb, input = {}) => callWithEnvelopeConsent(p.rawCall, verb, input);
  roots.push(p.root);
  return p;
};
const dirtyAnswer = (question: { bind: { instanceId?: string; items?: Array<{ token: string }> } }, choice: string) => ({
  instanceId: question.bind.instanceId,
  items: Object.fromEntries((question.bind.items ?? []).map((item) => [item.token, choice])),
});
const commitIntents = (p: Project) =>
  readFileSync(`${p.root}/.tenet/log`, "utf8").split("\n")
    .filter((line) => line.includes('"effect":"commit"') && line.includes('"kind":"intent"'));

describe("dirty-file consent (P47)", {
  skip: process.platform === "win32" && "public durable-store controls require the supported POSIX mutation host",
}, () => {
  it("[GIT-10] binds one choice to each displayed file through a question instance", async () => {
    const p = fresh();
    p.write("src/human-a.ts", "export const a = 'human';\n");
    p.write("src/human-b.ts", "export const b = 'human';\n");
    const opened = await p.call("open", {
      profile: "feature",
      request: "edit overlapping files",
      scopePaths: ["src/human-a.ts", "src/human-b.ts"],
      lane: "quick",
    });
    assert.equal(opened.exit, 3, JSON.stringify(opened));
    const question = opened.questions!.find((q) => q.id === "dirty-overlap")!;
    const instanceId = (question.bind as { instanceId?: string }).instanceId;
    const items = (question.bind as { items?: Array<{ token: string }> }).items;
    assert.ok(instanceId);
    assert.deepEqual(items?.map((item) => item.token), ["1", "2"]);

    const answered = await p.call("decide", {
      h: opened.handle!,
      kind: "dirty-overlap",
      answers: {
        "dirty-overlap": {
          instanceId,
          items: { "1": "include", "2": "leave-out" },
        },
      },
    });
    assert.equal(answered.exit, 0, JSON.stringify(answered));
    const work = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.deepEqual(
      work.dirtyFileDecisions?.map((d) => [d.path, d.choice]),
      [
        ["src/human-a.ts", "include"],
        ["src/human-b.ts", "leave-out"],
      ],
    );
  });

  it("[GIT-10] wait and explicit commit never stage or commit a human-only file set", async () => {
    const p = fresh();
    const human = "// human work\nexport const greet = (_name: string): string => '';\n";
    p.write("src/greet.ts", human);
    const opened = await p.call("open", {
      profile: "feature", request: "greeting", scopePaths: ["src/greet.ts"], lane: "quick",
    });
    const h = opened.handle!;
    await p.call("decide", {
      h, kind: "dirty-overlap",
      answers: { "dirty-overlap": dirtyAnswer(opened.questions![0]!, "wait") },
    });
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    const head = p.git("rev-parse", "HEAD");
    const index = readFileSync(`${p.root}/.git/index`);
    const commit = await p.call("commit", { h, subject: "not a human-only commit" });

    const commitData = commit.data as { committed?: boolean; guidance?: string };
    assert.equal(commitData.committed, false);
    assert.match(commitData.guidance!, /person.*outside Tenet/i);
    assert.equal(p.git("rev-parse", "HEAD"), head);
    assert.deepEqual(readFileSync(`${p.root}/.git/index`), index);
    assert.equal(readFileSync(`${p.root}/src/greet.ts`, "utf8"), human);
    assert.equal(commitIntents(p).length, 0);
  });

  it("[GIT-10] a different Tenet path does not qualify a human-only overlapping path", async () => {
    const p = fresh();
    const human = `// human work\n${GREET_IMPL}`;
    p.write("src/greet.ts", human);
    const opened = await p.call("open", {
      profile: "feature", request: "greeting", scopePaths: ["src/greet.ts"], lane: "quick",
    });
    const h = opened.handle!;
    await p.call("decide", {
      h, kind: "dirty-overlap",
      answers: { "dirty-overlap": dirtyAnswer(opened.questions![0]!, "include") },
    });
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    const checked = await p.call("check", { h, stage: "candidate" });
    assert.equal(checked.exit, 0, JSON.stringify(checked));
    const committed = await p.call("commit", { h, subject: "commit only the test" });
    assert.equal(committed.exit, 0, JSON.stringify(committed));

    assert.equal(p.git("show", "--format=", "--name-only", "HEAD"), "src/greet.test.ts");
    assert.equal(readFileSync(`${p.root}/src/greet.ts`, "utf8"), human);
    assert.match(p.git("status", "--porcelain", "--", "src/greet.ts"), /src\/greet\.ts/);
  });

  it("[GIT-10] durable noCommit survives an explicit commit, restart and a fresh later finish", async () => {
    const p = fresh();
    const opened = await p.call("open", {
      profile: "feature", request: "greeting", scopePaths: ["src/greet.ts"], lane: "quick",
    });
    const h = opened.handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    const firstCheck = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.equal(firstCheck.exit, 0, JSON.stringify(firstCheck));
    assert.ok(await focusFixture(p, h));
    const uncommitted = await finishFixture(p, { h, noCommit: true });
    assert.equal((uncommitted.data as any).scope, "working-tree-uncommitted");
    const explicit = await p.call("commit", { h, subject: "one explicit commit" });
    assert.equal(explicit.exit, 0, JSON.stringify(explicit));
    const c1 = p.git("rev-parse", "HEAD");
    assert.equal(Object.values(p.ports().store.read()!.state.work)[0]!.git.noCommit, true);

    p.write("src/greet.ts", `${GREET_IMPL}// later candidate\n`);
    const later = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.equal(later.exit, 0, JSON.stringify(later));
    const before = commitIntents(p).length;
    const freshFinish = await finishFixture(p, { h, subject: "must stay uncommitted" });
    assert.equal(freshFinish.historical, undefined);
    assert.equal((freshFinish.data as any).noCommit, true);
    assert.equal(p.git("rev-parse", "HEAD"), c1);
    assert.equal(commitIntents(p).length, before);
    assert.match(readFileSync(`${p.root}/src/greet.ts`, "utf8"), /later candidate/);
    assert.equal(Object.values(p.ports().store.read()!.state.work)[0]!.git.noCommit, true);
  });

  it("[GIT-12] declining signing consent records noCommit and a later explicit commit asks again", async () => {
    const p = fresh();
    p.git("config", "commit.gpgsign", "true");
    p.git("config", "gpg.program", "false");
    const opened = await p.call("open", {
      profile: "feature", request: "greeting", scopePaths: ["src/greet.ts"], lane: "quick",
    });
    const h = opened.handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    const checked = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    const head = p.git("rev-parse", "HEAD");
    await focusFixture(p, h);
    const asked = await p.call("finish", { h });
    assert.equal(asked.questions?.[0]?.id, "signing-consent", JSON.stringify(asked));
    assert.equal((await p.call("decide", {
      h, kind: "signing-consent",
      answers: {
        "signing-consent": {
          instanceId: asked.questions![0]!.bind.instanceId,
          answer: "keep-uncommitted",
        },
      },
    })).exit, 0);
    const declined = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(declined.git.noCommit, true);
    const freshResult = await p.call("finish", { h });
    assert.equal((freshResult.data as any).scope, "working-tree-uncommitted");
    assert.equal(p.git("rev-parse", "HEAD"), head);
    const explicit = await p.call("commit", { h, subject: "ask again" });
    assert.equal(explicit.questions?.[0]?.id, "signing-consent", JSON.stringify({ checked, explicit }));
  });
});
