import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync } from "node:fs";
import { join } from "node:path";
import { cleanup } from "./helpers.ts";
import { BASIS, project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
function fixture(custom = false) {
  const p = project(); roots.push(p.root);
  const dir = custom ? ".githooks" : ".git/hooks";
  if (custom) p.git("config", "core.hooksPath", dir);
  p.write(`${dir}/post-checkout`, "#!/bin/sh\nprintf 'ran' > CHECKOUT_HOOK_RAN\n");
  chmodSync(join(p.root, dir, "post-checkout"), 0o755);
  return p;
}
describe("branch creation admission [GIT-02, GIT-12, SEC-15]", () => {
  for (const custom of [false, true]) it(`refuses ${custom ? "configured" : "default"} checkout hooks before creating the work branch`, async () => {
    const p = fixture(custom), h = (await p.call("open", { profile: "feature", request: "branch hook safety", lane: "quick" })).handle!;
    const r = await p.call("decide", { h, kind: "basis", propose: BASIS });
    assert.equal(r.exit, 2, JSON.stringify(r)); assert.ok(r.reasons.some(r => r.code === "capability-missing"));
    assert.equal(existsSync(join(p.root, "CHECKOUT_HOOK_RAN")), false);
    assert.equal(p.git("branch", "--show-current"), "main");
    assert.equal(Object.values(p.ports().store.read()!.state.work)[0]!.basis, undefined);
  });
  it("does not treat commit-hook consent as a bounded branch execution path", async () => {
    const p = fixture(), h = (await p.call("open", { profile: "feature", request: "consented commit only", lane: "quick" })).handle!;
    const ports = p.ports(), hash = (await ports.git.probe()).hooks!;
    await ports.store.transaction("test", async tx => { tx.publish({ ...tx.state!, consents: [{ kind: "hooks", configHash: hash, at: ports.clock.now() }] }); });
    const r = await p.call("decide", { h, kind: "basis", propose: BASIS });
    assert.equal(r.exit, 2, JSON.stringify(r)); assert.equal(existsSync(join(p.root, "CHECKOUT_HOOK_RAN")), false);
    assert.equal(p.git("branch", "--show-current"), "main");
  });
  it("allows an explicitly selected current branch without launching checkout hooks", async () => {
    const p = fixture(), h = (await p.call("open", { profile: "feature", request: "current branch", lane: "quick" })).handle!;
    assert.equal((await p.call("decide", { h, kind: "config", target: "branching", propose: { value: "current" } })).exit, 0);
    const r = await p.call("decide", { h, kind: "basis", propose: BASIS });
    assert.equal(r.exit, 0, JSON.stringify(r)); assert.equal(existsSync(join(p.root, "CHECKOUT_HOOK_RAN")), false);
    assert.equal(p.git("branch", "--show-current"), "main");
  });
  it("allows branch creation when only a commit hook exists", async () => {
    const p = project(); roots.push(p.root);
    p.write(".git/hooks/pre-commit", "#!/bin/sh\nprintf 'ran' > COMMIT_HOOK_RAN\n"); chmodSync(join(p.root, ".git/hooks/pre-commit"), 0o755);
    const h = (await p.call("open", { profile: "feature", request: "commit hook is separate", lane: "quick" })).handle!;
    const r = await p.call("decide", { h, kind: "basis", propose: BASIS });
    assert.equal(r.exit, 0, JSON.stringify(r)); assert.equal(existsSync(join(p.root, "COMMIT_HOOK_RAN")), false);
    assert.match(p.git("branch", "--show-current"), /^tenet\//);
  });
});
