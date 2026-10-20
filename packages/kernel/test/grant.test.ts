// `decide grant` and the protected-path gate (WRK-03, TS §8.1): an edit in a protected path needs the user's own words,
// listed path by path, for this contract only.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, project, reviewResult, finishFixture } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => { for (const r of roots) cleanup(r); });
const fresh = (): Project => { const p = project({ "db/001.sql": "create table a (id int);\n" }); roots.push(p.root); return p; };
const state = (p: Project) => p.ports().store.read()!.state;
const d = (r: { data?: unknown }) => r.data as Record<string, any>;

async function toGreen(p: Project) {
  const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], protectedPaths: ["db/**"], lane: "standard" })).handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", GREET_TEST);
  await p.call("check", { h, stage: "baseline" });
  p.write("src/greet.ts", GREET_IMPL);
  return h;
}

describe("the protected-path gate [WRK-03]", () => {
  it("asks before checking when an edit lands in a protected path, and runs nothing", async () => {
    const p = fresh();
    const h = await toGreen(p);
    p.write("db/001.sql", "create table a (id int, name text);\n");
    const r = await p.call("check", { h, stage: "candidate", touched: ["db/001.sql"] });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.equal(r.questions![0]!.id, "grant-confirm");
    assert.match(r.questions![0]!.question, /db\/001\.sql/);
    assert.equal(Object.values(state(p).work)[0]!.receipts.filter((x) => x.stage === "candidate").length, 0, "no check ran");
  });

  it("a grant needs the user's own words and lists the paths; then the check runs", async () => {
    const p = fresh();
    const h = await toGreen(p);
    p.write("db/001.sql", "create table a (id int, name text);\n");
    await p.call("check", { h, stage: "candidate", touched: ["db/001.sql"] });
    const noQuote = await p.call("decide", { h, kind: "grant", target: "protected-path" });
    assert.equal(noQuote.exit, 2, JSON.stringify(noQuote));
    assert.equal(noQuote.reasons[0]!.code, "authority-needed");
    const ok = await p.call("decide", { h, kind: "grant", target: "protected-path", quote: "yes, change the migration for this" });
    assert.equal(ok.exit, 0, JSON.stringify(ok));
    const g = Object.values(state(p).work)[0]!.grants.find((x) => x.actions.includes("protected-path"))!;
    assert.deepEqual(g.paths, ["db/001.sql"]);
    assert.equal(g.quote, "yes, change the migration for this");
    assert.equal(state(p).pending.length, 0);
    assert.equal((await p.call("check", { h, stage: "candidate", touched: ["db/001.sql"] })).exit, 0);
  });

  it("covers only the listed paths: a second protected file asks again", async () => {
    const p = fresh();
    const h = await toGreen(p);
    p.write("db/001.sql", "x\n");
    await p.call("check", { h, stage: "candidate", touched: ["db/001.sql"] });
    await p.call("decide", { h, kind: "grant", target: "protected-path", quote: "ok" });
    p.write("db/002.sql", "y\n");
    const r = await p.call("check", { h, stage: "candidate", touched: ["db/001.sql", "db/002.sql"] });
    assert.equal(r.exit, 3);
    assert.match(r.questions![0]!.question, /db\/002\.sql/);
    assert.doesNotMatch(r.questions![0]!.question, /db\/001\.sql/);
  });

  it("refuses to grant a path that is not protected", async () => {
    const p = fresh();
    const h = await toGreen(p);
    const r = await p.call("decide", { h, kind: "grant", target: "protected-path", quote: "ok", propose: { paths: ["src/greet.ts"] } });
    assert.equal(r.exit, 2, JSON.stringify(r));
  });

  it("only protected-path grants are built", async () => {
    const p = fresh();
    const h = await toGreen(p);
    assert.equal((await p.call("decide", { h, kind: "grant", target: "remote", quote: "ok" })).exit, 1);
  });

  it("declining the question clears it without a grant, and the next check asks again while the edit stands", async () => {
    const p = fresh();
    const h = await toGreen(p);
    p.write("db/001.sql", "x\n");
    await p.call("check", { h, stage: "candidate", touched: ["db/001.sql"] });
    const no = await p.call("decide", { h, kind: "grant", target: "protected-path", answers: { "grant-confirm": "decline" } });
    assert.equal(no.exit, 0, JSON.stringify(no));
    assert.equal(state(p).pending.length, 0);
    assert.equal((await p.call("check", { h, stage: "candidate", touched: ["db/001.sql"] })).exit, 3);
  });

  it("no result is checked-local while a protected edit is uncovered", async () => {
    const p = fresh();
    const h = await toGreen(p);
    const green = await p.call("check", { h, stage: "candidate" });
    await p.call("findings", { h, result: reviewResult(d(green)) });
    p.write("db/001.sql", "edited after the check\n");
    await p.call("check", { h, stage: "candidate", touched: ["db/001.sql"] }); // asks; the user declines the grant
    await p.call("decide", { h, kind: "grant", target: "protected-path", answers: { "grant-confirm": "decline" } });
    const f = await finishFixture(p, { h, noCommit: true });
    assert.notEqual(d(f).endpoint, "checked-local");
    assert.ok(f.reasons.some((x) => x.code === "authority-needed"), JSON.stringify(f.reasons));
  });

  it("belongs to one contract: the next contract on the same file asks again", async () => {
    const p = fresh();
    const h = await toGreen(p);
    p.write("db/001.sql", "x\n");
    await p.call("check", { h, stage: "candidate", touched: ["db/001.sql"] });
    await p.call("decide", { h, kind: "grant", target: "protected-path", quote: "ok" });
    await p.call("stop", { h, mode: "abandon" });
    await p.call("decide", { h, kind: "abandon-confirm", answers: { "abandon-confirm": "abandon" } });
    const h2 = (await p.call("open", { profile: "feature", request: "again", scopePaths: ["src/greet.ts"], protectedPaths: ["db/**"] })).handle!;
    await p.call("decide", { h: h2, kind: "basis", propose: { ...BASIS, outcome: "again" } });
    const r = await p.call("check", { h: h2, stage: "baseline", touched: ["db/001.sql"] });
    assert.equal(r.exit, 3, JSON.stringify(r));
  });
});
