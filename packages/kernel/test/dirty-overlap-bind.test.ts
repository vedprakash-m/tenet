import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dirtyOverlap } from "../src/decisions/simple.ts";
import { dirtyFacts, dirtyQuestion, leftOutChanged, settleCleaned } from "../src/verbs/dirty.ts";
import type { DecisionCtx } from "../src/decisions/types.ts";
import type { Inventory } from "../src/ports/types.ts";

const inventory = (paths: readonly string[], blob = "human"): Inventory => ({
  head: "a".repeat(40),
  branch: "main",
  entries: new Map(paths.map((path) => [path, { path, mode: "100644", blob }])),
  status: paths.map((path) => ({
    path, xy: ".M", staged: false, untracked: false, mode: "100644", blob,
    indexBlob: "base", indexMode: "100644",
  })),
  digest: `digest:${paths.join(",")}:${blob}`,
});

const work = (dirty: string[]) => ({
  id: "W1",
  includeDirty: [],
  keepOut: [],
  leaveOut: [] as string[],
  dirtyFileDecisions: [] as Array<{ path: string; choice: string }>,
  touched: dirty.map((path) => ({ path })),
  scope: { paths: dirty, protected: [] },
  session: { generation: 7 },
  git: {
    start: {
      head: "a".repeat(40),
      branch: "main",
      staged: [],
      dirty: dirty.map((path) => ({
        path, status: ".M", mode: "100644", blob: "human",
        indexMode: "100644", indexBlob: "base",
      })),
    },
    noCommit: false,
  },
  basis: null,
});

const answer = async (
  shown: string[],
  now: string[],
  choices: Record<string, string>,
  options: { instance?: string; blob?: string; raw?: unknown } = {},
) => {
  const w = work(now);
  const before = inventory(shown);
  const question = dirtyQuestion(w as never, before, options.instance ?? "instance-1", shown);
  const state = { pending: [question], work: { W1: w } };
  return dirtyOverlap.run({
    state,
    work: w,
    input: {
      answers: {
        "dirty-overlap": options.raw ?? {
          instanceId: question.bind.instanceId,
          items: choices,
        },
      },
    },
    ports: {
      git: { inventory: async () => inventory(now, options.blob ?? "human") },
      clock: { now: () => "2026-11-18T00:00:00.000Z" },
    },
  } as unknown as DecisionCtx);
};

describe("dirty-overlap question binding", () => {
  it("[GIT-10] discloses a unique item token and relevant facts for every file", () => {
    const q = dirtyQuestion(["src/b.ts", "src/a.ts"]);
    const bind = q.bind as typeof q.bind & {
      instanceId?: string;
      items?: Array<{ token: string; path: string }>;
    };
    assert.equal(q.channel, "chat");
    assert.ok(bind.instanceId);
    assert.deepEqual(bind.items?.map((item) => [item.token, item.path]), [
      ["1", "src/a.ts"],
      ["2", "src/b.ts"],
    ]);
  });

  it("[GIT-10] refuses an answer when a dirty file was added after the question", async () => {
    await assert.rejects(
      answer(["src/a.ts"], ["src/a.ts", "src/b.ts"], { "1": "include" }),
      /file, index or scope changed/,
    );
  });

  it("[GIT-10] applies a distinct answer to each displayed item", async () => {
    const plan = await answer(
      ["src/b.ts", "src/a.ts"],
      ["src/a.ts", "src/b.ts"],
      { "1": "include", "2": "leave-out" },
    ) as unknown as { state: { work: Record<string, { dirtyFileDecisions: Array<{ path: string; choice: string }> }> } };
    assert.deepEqual(
      plan.state.work.W1!.dirtyFileDecisions.map((decision) => [decision.path, decision.choice]),
      [
        ["src/a.ts", "include"],
        ["src/b.ts", "leave-out"],
      ],
    );
  });

  it("[GIT-10] rejects missing, duplicate, undisclosed and wrong-instance answers", async () => {
    await assert.rejects(answer(["src/a.ts", "src/b.ts"], ["src/a.ts", "src/b.ts"], { "1": "include" }), /missing item 2/);
    await assert.rejects(
      answer(["src/a.ts"], ["src/a.ts"], {}, {
        raw: {
          instanceId: "instance-1",
          items: [{ token: "1", choice: "include" }, { token: "1", choice: "wait" }],
        },
      }),
      /answered more than once/,
    );
    await assert.rejects(answer(["src/a.ts"], ["src/a.ts"], { "1": "include", "2": "wait" }), /undisclosed/);
    await assert.rejects(
      answer(["src/a.ts"], ["src/a.ts"], { "1": "include" }, {
        raw: { instanceId: "old-instance", items: { "1": "include" } },
      }),
      /replaced/,
    );
  });

  it("[GIT-10] refuses changed working and index facts without applying authority", async () => {
    await assert.rejects(
      answer(["src/a.ts"], ["src/a.ts"], { "1": "include" }, { blob: "changed" }),
      /file, index or scope changed/,
    );
  });
});

describe("dirty-overlap choices (UX J-03b)", () => {
  it("[GIT-10] offers wait (recommended), include and leave-out, naming every file", () => {
    const q = dirtyQuestion(["d.ts", "c.ts", "b.ts", "a.ts"]);
    assert.match(q.question, /1\. "a\.ts"/);
    assert.match(q.question, /4\. "d\.ts"/);
    assert.deepEqual(q.options!.map((o) => o.description.match(/^Answer: ([a-z-]+)/)![1]), ["wait", "include", "leave-out"]);
    assert.equal(q.options![0]!.recommended, true);
    assert.match(q.options![0]!.description, /won't stage or commit/);
  });

  it("[GIT-10] wait records a durable waiting decision and closes only that issuance", async () => {
    const plan = await answer(["src/a.ts"], ["src/a.ts"], { "1": "wait" }) as unknown as {
      state: {
        pending: unknown[];
        work: Record<string, {
          includeDirty: string[]; keepOut: string[]; leaveOut?: string[];
          dirtyFileDecisions: Array<{ choice: string }>;
        }>;
      };
    };
    assert.deepEqual(plan.state.pending, []);
    assert.deepEqual(
      [plan.state.work.W1!.includeDirty, plan.state.work.W1!.keepOut, plan.state.work.W1!.leaveOut],
      [[], [], []],
    );
    assert.equal(plan.state.work.W1!.dirtyFileDecisions[0]!.choice, "waiting");
  });

  it("[GIT-10] leave-out keeps later human edits outside the task", async () => {
    const plan = await answer(["src/a.ts"], ["src/a.ts"], { "1": "leave-out" }) as unknown as {
      state: { work: Record<string, ReturnType<typeof work>> };
    };
    const left = plan.state.work.W1!;
    assert.deepEqual([left.keepOut, left.leaveOut], [["src/a.ts"], ["src/a.ts"]]);
    assert.deepEqual(leftOutChanged(left as never, () => "a later human blob"), []);
    assert.deepEqual(leftOutChanged({ ...left, touched: [{ path: "src/a.ts" }] } as never), ["src/a.ts"]);
  });

  it("[GIT-10] don't commit grants edit-uncommitted authority only to every named item", async () => {
    const plan = await answer(["src/a.ts"], ["src/a.ts"], {}, {
      raw: { instanceId: "instance-1", all: "dont-commit" },
    }) as unknown as {
      state: { work: Record<string, ReturnType<typeof work> & { git: { noCommit?: boolean } }> };
    };
    const left = plan.state.work.W1!;
    assert.equal(left.git.noCommit, true);
    assert.equal(left.dirtyFileDecisions[0]!.choice, "edit-uncommitted");
  });

  it("[GIT-10] a person committing while Tenet waits settles that file; restored dirty facts ask again", async () => {
    const plan = await answer(["src/a.ts"], ["src/a.ts"], { "1": "wait" }) as unknown as {
      state: { work: Record<string, ReturnType<typeof work>> };
    };
    const w = plan.state.work.W1!;
    const settled = settleCleaned(w as never, new Set());
    assert.deepEqual(settled.git.start.dirty, []);
    assert.equal(settled.dirtyFileDecisions.length, 0);
    assert.ok(dirtyFacts(w as never, inventory(["src/a.ts"]), "src/a.ts").workBlob);
  });
});
