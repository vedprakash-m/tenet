// A refusal says what happened in the words for that cause and offers a next step (NFR-02). The registry label of one cause is not
// reused for another, and a refusal that happens before any work exists writes nothing into the project.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { createPorts } from "../src/wire.ts";
import { cleanup, tmp } from "./helpers.ts";
import { project } from "./support/fixture.ts";

const dirs: string[] = [];
after(() => dirs.forEach(cleanup));

describe("refusals", () => {
  it("asks about Git in its own words and leaves the folder untouched when there is no repository [GIT-01, CON-09]", async () => {
    const root = tmp("tenet-nogit-");
    dirs.push(root);
    const r = await runVerb(createPorts(root, { PATH: process.env.PATH, HOME: process.env.HOME }), VERBS, "open", { profile: "bug", request: "fix it" });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.equal(r.reasons[0]!.code, "not-a-repository");
    assert.doesNotMatch(r.reasons[0]!.message, /rebase|detached/i);
    assert.equal(r.questions![0]!.id, "git-init");
    assert.equal(existsSync(join(root, ".tenet")), false, "a refused open creates nothing");
  });

  it("tells a call with no handle to pass one, and a handle that names nothing here that it names nothing [CON-05]", async () => {
    const p = project();
    dirs.push(p.root);
    await p.call("open", { profile: "feature", request: "x", lane: "quick" });
    const none = await p.call("check", {});
    assert.equal(none.exit, 1);
    assert.equal(none.reasons[0]!.code, "handle-required");
    assert.match(none.reasons[0]!.message, /--h/);
    const wrong = await p.call("check", { h: "W9.9.zzzz" });
    assert.equal(wrong.exit, 1);
    assert.equal(wrong.reasons[0]!.code, "handle-unknown");
    assert.doesNotMatch(wrong.reasons[0]!.message, /older generation/i);
  });

  it("says how to continue or end the contract that owns the workspace instead of stopping with nothing to do [AGT-08]", async () => {
    const p = project();
    dirs.push(p.root);
    await p.call("open", { profile: "feature", request: "first", lane: "quick" });
    const second = await p.call("open", { profile: "feature", request: "second", lane: "quick" });
    assert.equal(second.exit, 2);
    assert.equal(second.reasons[0]!.code, "owned-by-other-work");
    assert.match(second.reasons[0]!.message, /--resume/);
    assert.match(second.reasons[0]!.message, /stop/);
    assert.equal(second.next[0]?.required, true);
  });

  it("keeps an older generation's refusal for an older generation [AGT-08]", async () => {
    const p = project();
    dirs.push(p.root);
    const first = await p.call("open", { profile: "feature", request: "first", lane: "quick" });
    await p.call("open", { profile: "feature", request: "first", resume: true });
    const old = await p.call("check", { h: first.handle! });
    assert.equal(old.reasons[0]!.code, "stale-session");
    assert.ok(old.next.length > 0);
  });
});
