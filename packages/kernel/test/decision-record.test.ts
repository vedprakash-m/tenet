// `decide decision-record`: a decision the user made, kept with its context and consequences, with a stable ID (INT-10, TS §7.8).
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup } from "./helpers.ts";
import { project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => { for (const r of roots) cleanup(r); });
const fresh = (): Project => { const p = project(); roots.push(p.root); return p; };
const state = (p: Project) => p.ports().store.read()!.state;
const d = (r: { data?: unknown }) => r.data as Record<string, any>;
const BODY = { title: "Use SQLite", context: "One small server, no ops team.", decision: "Store data in SQLite.", consequences: "No horizontal scaling.", alternatives: [{ option: "Postgres", why: "needs a server to run" }] };
const open = async (p: Project) => (await p.call("open", { profile: "plan", request: "decide the store" })).handle!;

describe("recording a decision [INT-10, INT-02]", () => {
  it("needs the user's own words, then records it with a stable DEC ID, a summary element and the full record", async () => {
    const p = fresh();
    const h = await open(p);
    const none = await p.call("decide", { h, kind: "decision-record", propose: BODY });
    assert.equal(none.exit, 2, JSON.stringify(none));
    assert.equal(none.reasons[0]!.code, "authority-needed");
    const r = await p.call("decide", { h, kind: "decision-record", propose: BODY, quote: "let's go with SQLite" });
    assert.equal(r.exit, 0, JSON.stringify(r));
    const id = d(r).id as string;
    assert.match(id, /^DEC-001-[a-z0-9]{3}$/);
    const intent = state(p).project.intent;
    const el = intent.elements.find((e) => e.id === id)!;
    assert.equal(el.kind, "decision");
    assert.match(el.text, /SQLite/);
    const rec = intent.records.find((x) => x.id === id)!;
    assert.deepEqual([rec.status, rec.context, rec.quote], ["accepted", BODY.context, "let's go with SQLite"]);
    assert.equal(rec.alternatives[0]!.option, "Postgres");
  });

  it("a repeat of the same decision makes no new record and no new revision", async () => {
    const p = fresh();
    const h = await open(p);
    await p.call("decide", { h, kind: "decision-record", propose: BODY, quote: "ok" });
    const rev = state(p).project.intent.revision;
    const again = await p.call("decide", { h, kind: "decision-record", propose: BODY, quote: "ok", again: true });
    assert.equal(d(again).changed, false);
    assert.equal(state(p).project.intent.revision, rev);
    assert.equal(state(p).project.intent.records.length, 1);
  });

  it("a new decision can supersede an earlier one, which stays on record", async () => {
    const p = fresh();
    const h = await open(p);
    const first = d(await p.call("decide", { h, kind: "decision-record", propose: BODY, quote: "ok" })).id as string;
    const second = await p.call("decide", { h, kind: "decision-record", quote: "we outgrew it", propose: { ...BODY, title: "Use Postgres", decision: "Store data in Postgres.", supersedes: first } });
    assert.equal(second.exit, 0, JSON.stringify(second));
    const recs = state(p).project.intent.records;
    assert.equal(recs.find((x) => x.id === first)!.status, "superseded");
    assert.equal(recs.find((x) => x.id === d(second).id)!.supersedes, first);
    assert.equal((await p.call("decide", { h, kind: "decision-record", quote: "x", propose: { ...BODY, title: "Other", supersedes: "DEC-999-zzz" } })).exit, 2);
  });

  it("refuses a record without a decision or a title", async () => {
    const p = fresh();
    const h = await open(p);
    assert.equal((await p.call("decide", { h, kind: "decision-record", quote: "ok", propose: { title: "x" } })).exit, 2);
  });

  it("appears in full in INTENT.md once the intent is adopted", async () => {
    const p = fresh();
    const h = await open(p);
    await p.call("decide", { h, kind: "decision-record", propose: BODY, quote: "ok" });
    await p.call("decide", { h, kind: "adopt", target: "intent" });
    await p.call("decide", { h, kind: "adopt", target: "intent", answers: { "adopt-confirm": "confirm" } });
    const text = readFileSync(join(p.root, "INTENT.md"), "utf8");
    assert.match(text, /Use SQLite/);
    assert.match(text, /No horizontal scaling/);
    assert.match(text, /Postgres/);
  });
});
