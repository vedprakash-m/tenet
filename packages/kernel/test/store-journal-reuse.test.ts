// Validating the journal is a large part of a mutating call on a long history (NFR-01): a parse no caller has seen
// serves the next read, and every read still returns records the caller may change freely.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, initState, NO_POSIX_PROCESSES, tmp } from "./helpers.ts";

const dirs: string[] = [];
after(() => dirs.forEach(cleanup));

/** JSON.parse calls on journal lines that mention `marker`, made while `fn` runs. */
async function lineParses(marker: string, fn: () => Promise<unknown>): Promise<number> {
  const original = JSON.parse;
  let n = 0;
  JSON.parse = ((text: string, reviver?: never) => { if (typeof text === "string" && text.includes(marker)) n++; return original(text, reviver); }) as typeof JSON.parse;
  try { await fn(); } finally { JSON.parse = original; }
  return n;
}

describe("store: journal parse reuse", { skip: NO_POSIX_PROCESSES }, () => {
  it("reuses untouched journal reads and revalidates after records have been handed to a caller", async () => {
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
    // Three initial records, one staged validation, three fresh admission records after recent(), one durable append.
    assert.equal(parses, 8);
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
      assert.equal(store.readLog().find((e) => e.verb === "journal-probe"), undefined, "staged records are not durable yet");
    });
    assert.equal(store.readLog().find((e) => e.verb === "journal-probe")?.exit, 0);
  });
});
