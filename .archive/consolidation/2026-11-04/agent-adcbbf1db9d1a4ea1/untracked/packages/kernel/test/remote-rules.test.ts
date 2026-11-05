// The pure rules of remote actions (TS §10.6, GIT-05): what a binding is, what counts as changed, how an interrupted
// push is judged from a remote read, and the one place the architecture lint allows remote Git commands. No Git, no I/O.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { bindingHash, changedFrom, settlePush, validBranch, validRemoteName } from "../src/core/remote.ts";
import type { Binding } from "../src/core/remote.ts";
import { parseArgs } from "../src/frontends/cli.ts";
import { lintArch } from "../../../tools/lint-arch.ts";
import { cleanup, tmp } from "./helpers.ts";

const A = "a".repeat(40), B = "b".repeat(40);
const bound: Binding = { name: "origin", url: "/srv/x.git", branch: "tenet/w-0001-greet", commit: A };

describe("a remote binding [GIT-05]", () => {
  it("has the same hash for the same facts and a different hash when any one fact differs [GIT-05]", () => {
    assert.equal(bindingHash(bound), bindingHash({ ...bound }));
    for (const change of [{ name: "up" }, { url: "/srv/y.git" }, { branch: "other" }, { commit: B }]) {
      assert.notEqual(bindingHash(bound), bindingHash({ ...bound, ...change }), JSON.stringify(change));
    }
  });
  it("names exactly the facts that changed, and nothing when none did [GIT-05]", () => {
    assert.deepEqual(changedFrom(bound, { ...bound }), []);
    assert.equal(changedFrom(bound, { ...bound, commit: B }).length, 1);
    assert.match(changedFrom(bound, { ...bound, commit: B })[0]!, /bbbbbbb/);
    assert.match(changedFrom(bound, { ...bound, url: "/srv/y.git" })[0]!, /URL of origin/);
    assert.match(changedFrom(bound, { ...bound, url: "" })[0]!, /no longer a remote/);
    assert.match(changedFrom(bound, { ...bound, branch: "other" })[0]!, /branch other/);
    assert.match(changedFrom(bound, { ...bound, name: "up" })[0]!, /remote up/);
    assert.equal(changedFrom(bound, { name: "up", url: "", branch: "other", commit: B }).length, 4);
  });
  it("accepts ordinary remote and branch names and refuses anything Git or an option parser could misread [GIT-05]", () => {
    for (const ok of ["origin", "upstream", "my-fork.2"]) assert.equal(validRemoteName(ok), true, ok);
    for (const bad of ["", "-origin", "--force", "a b", "a:b", "a/../b", "orig\nin"]) assert.equal(validRemoteName(bad), false, bad);
    for (const ok of ["main", "tenet/w-0007-greet", "feature_1.2"]) assert.equal(validBranch(ok), true, ok);
    for (const bad of ["", "-x", "a b", "x:y", "+main", "a..b", "a//b", "a/", "a.", "x.lock", "a/.hidden", "a\\b", "x".repeat(201), "~x", "a^b", "a*"]) {
      assert.equal(validBranch(bad), false, JSON.stringify(bad));
    }
  });
});

describe("judging a push from what the remote shows [GIT-05]", () => {
  it("trusts a remote that shows the commit, whatever Git reported [GIT-05]", () => {
    for (const pushed of ["ok", "rejected", "interrupted"] as const) assert.equal(settlePush(pushed, { commit: A }, A), "completed", pushed);
  });
  it("calls a push Git rejected not performed, unless the remote shows the commit [GIT-05]", () => {
    assert.equal(settlePush("rejected", { commit: B }, A), "not-performed");
    assert.equal(settlePush("rejected", { commit: null }, A), "not-performed");
    assert.equal(settlePush("rejected", null, A), "not-performed");
  });
  it("keeps a push Git accepted uncertain when the remote cannot confirm it [GIT-05]", () => {
    assert.equal(settlePush("ok", { commit: B }, A), "uncertain");
    assert.equal(settlePush("ok", { commit: null }, A), "uncertain");
    assert.equal(settlePush("ok", null, A), "uncertain");
  });
  it("calls an interrupted push not performed only when the branch is absent, and uncertain otherwise [GIT-05]", () => {
    assert.equal(settlePush("interrupted", { commit: null }, A), "not-performed");
    assert.equal(settlePush("interrupted", { commit: B }, A), "uncertain", "the remote may have moved after the push");
    assert.equal(settlePush("interrupted", null, A), "uncertain", "an unreadable remote proves nothing");
  });
});

describe("the command line and the architecture lint [GIT-05]", () => {
  const roots: string[] = [];
  after(() => roots.forEach(cleanup));
  it("reads the first bare word after publish as the kind of remote action [GIT-05]", () => {
    assert.deepEqual(parseArgs(["publish", "push", "--h", "W1.1.abcd"]), { verb: "publish", input: { kind: "push", h: "W1.1.abcd" } });
  });
  it("allows push and ls-remote in adapters/git-remote.ts only, and still bans every other remote command there [GIT-05]", () => {
    const d = tmp(); roots.push(d);
    mkdirSync(join(d, "adapters"), { recursive: true });
    const lint = (file: string, body: string) => {
      writeFileSync(join(d, "adapters", file), body);
      const problems = lintArch(d).problems.filter((p) => p.includes(file));
      writeFileSync(join(d, "adapters", file), "export {};\n");
      return problems.join("\n");
    };
    assert.equal(lint("git-remote.ts", 'export const a = ["push", "x"], b = ["ls-remote", "x"];'), "");
    for (const cmd of ["fetch", "pull", "clone", "send-pack"]) assert.match(lint("git-remote.ts", `export const a = ["${cmd}"];`), /remote Git operations/, cmd);
    for (const cmd of ["push", "ls-remote", "fetch"]) assert.match(lint("git-cli.ts", `export const a = ["${cmd}"];`), /remote Git operations/, cmd);
    assert.match(lint("git-layout.ts", 'export const a = ["push"];'), /remote Git operations/);
  });
});
