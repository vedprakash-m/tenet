// Validating the state document is a large part of a call on a long history (NFR-01). A transaction reads the state at
// its start and again when it publishes; an unchanged file is validated once there, and every read still returns a
// document the caller may change freely.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { State } from "../src/core/schemas.ts";
import { cleanup, initState, NO_POSIX_PROCESSES, tmp } from "./helpers.ts";

const dirs: string[] = [];
after(() => dirs.forEach(cleanup));

/** Counts State.safeParse calls made while `fn` runs. */
function counted<T>(fn: () => T): { value: T; parses: number } {
  const original = State.safeParse;
  let parses = 0;
  State.safeParse = ((...args: Parameters<typeof original>) => { parses++; return original.apply(State, args); }) as typeof original;
  try { return { value: fn(), parses }; } finally { State.safeParse = original; }
}

describe("store: validated state reuse", { skip: NO_POSIX_PROCESSES }, () => {
  it("validates an unchanged state file once per transaction and hands out independent copies", async () => {
    const root = tmp();
    dirs.push(root);
    const store = await initState(root);
    await store.transaction("test", async (tx) => {
      const again = counted(() => store.read()!.state);
      assert.equal(again.parses, 0, "the file the transaction read at its start is not validated again");
      assert.deepEqual(again.value, tx.state);
      again.value.workSeq = 12_345;
      assert.notEqual(tx.state!.workSeq, 12_345);
      assert.deepEqual(store.read()!.state, tx.state, "a caller's change never reaches the next read");
    });
  });

  it("validates again after a publish or an outside edit, and on every read outside a transaction", async () => {
    const root = tmp();
    dirs.push(root);
    const store = await initState(root);
    const path = join(root, ".tenet/state");
    await store.transaction("test", async (tx) => {
      tx.publish({ ...tx.state! });
      assert.equal(counted(() => store.read()).parses, 1, "a published revision is a new file");
      const doc = JSON.parse(readFileSync(path, "utf8"));
      writeFileSync(path, JSON.stringify({ ...doc, workSeq: doc.workSeq + 100 }));
      const outside = counted(() => store.read()!.state);
      assert.deepEqual([outside.parses, outside.value.workSeq], [1, doc.workSeq + 100]);
    });
    assert.equal(counted(() => { store.read(); store.read(); }).parses, 2);
  });
});

/** JSON.parse calls on journal lines that mention `marker`, made while `fn` runs. */
async function lineParses(marker: string, fn: () => Promise<unknown>): Promise<number> {
  const original = JSON.parse;
  let n = 0;
  JSON.parse = ((text: string, reviver?: never) => { if (typeof text === "string" && text.includes(marker)) n++; return original(text, reviver); }) as typeof JSON.parse;
  try { await fn(); } finally { JSON.parse = original; }
  return n;
}

describe("store: journal parse reuse", { skip: NO_POSIX_PROCESSES }, () => {
  it("parses each journal record once in a transaction that only reads it, and still sees records appended since", async () => {
    const root = tmp();
    dirs.push(root);
    const store = await initState(root);
    await store.transaction("test", async (tx) => { for (let i = 0; i < 3; i++) tx.call({ verb: "journal-probe", exit: 0, revision: i }); });
    let recent: unknown[] = [];
    const parses = await lineParses('"journal-probe"', () => store.transaction("test", async (tx) => {
      assert.deepEqual(tx.unresolved(), []);
      tx.call({ verb: "journal-probe", exit: 0, revision: 3 });
      recent = tx.recent();
    }));
    // Three records read once at the transaction's start; the appended one checked before it is written, then read once.
    assert.equal(parses, 5);
    assert.deepEqual(recent.filter((e) => (e as { verb?: string }).verb === "journal-probe").map((e) => (e as { revision: number }).revision), [0, 1, 2, 3]);
  });

  it("never lets a caller's change to the records it was given reach another read", async () => {
    const root = tmp();
    dirs.push(root);
    const store = await initState(root);
    await store.transaction("test", async (tx) => {
      tx.call({ verb: "journal-probe", exit: 0, revision: 0 });
      const first = tx.recent() as Array<{ verb?: string; exit?: number }>;
      first.find((e) => e.verb === "journal-probe")!.exit = 4;
      first.length = 0;
      const again = tx.recent() as Array<{ verb?: string; exit?: number }>;
      assert.equal(again.find((e) => e.verb === "journal-probe")?.exit, 0);
      assert.equal(store.readLog().find((e) => e.verb === "journal-probe")?.exit, 0);
    });
  });
});
