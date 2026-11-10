// Results without managing specialists (AGT-10): the kernel opens and settles the reviewer's reservation itself, and the
// user reads an endpoint with reasons, not a subagent transcript. The host part (no transcript shown) is observed in the pilot.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, project, reviewResult } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

describe("specialist lifecycle is the kernel's [AGT-10]", { skip: process.platform === "win32" && "mutating work is refused on Windows" }, () => {
  it("[AGT-10] a review round is reserved, settled and summarized without the user managing it", async () => {
    const p = project(); roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "add a greeting", lane: "standard" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    const green = await p.call("check", { h, touched: ["src/greet.ts"] });
    const work = () => Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(work().budget.reservations.length, 1, "the kernel reserved the review when it issued the manifest");
    assert.ok(green.next.some((n) => /review/.test(n.action)), JSON.stringify(green.next));

    const r = await p.call("findings", { h, result: reviewResult(green.data as Record<string, any>) });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(work().budget.reservations.length, 0, "the kernel settled the reservation from the result");
    assert.equal(work().budget.delegations, 1);
    assert.ok(r.next.length > 0, "the next step is a verb the coordinator runs, not a transcript to read");

    const f = await p.call("finish", { h, noCommit: true });
    const data = f.data as { endpoint: string };
    assert.equal(data.endpoint, "checked-local", JSON.stringify(f));
    assert.ok(!JSON.stringify(f).includes("transcript"), "the result carries no transcript");
  });
});
