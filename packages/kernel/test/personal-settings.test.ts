// Personal preferences stay out of shared files: the shared policy cannot hold one, and setting one changes no tracked file (CFG-08).
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cleanup } from "./helpers.ts";
import { project } from "./support/fixture.ts";
import { CATALOG } from "../src/core/config.ts";
import { Policy, parsePolicy } from "../src/core/policy.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const preferences = Object.entries(CATALOG).filter(([, e]) => e.kind === "preference").map(([k]) => k);
const values: Record<string, unknown> = {
  style: "concise", checkpoints: "each-phase", lane: "quick", resource_mode: "serial", branching: "current", integration: "never",
};

describe("personal preferences never enter shared files [CFG-08]", () => {
  it("[CFG-08] the shared policy file has no field for any preference, and a preference in it is refused", () => {
    const shared = Object.keys(Policy.shape);
    assert.deepEqual(preferences.filter((k) => shared.includes(k)), []);
    for (const k of preferences) assert.equal(parsePolicy(JSON.stringify({ [k]: values[k] ?? "x" })).ok, false, k);
  });

  it("[CFG-08] setting every preference for the project and the task leaves every tracked and shared file unchanged",
    { skip: process.platform === "win32" && "mutating work is refused on Windows" }, async () => {
      const p = project();
      roots.push(p.root);
      const status = () => execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: p.root, encoding: "utf8" })
        .split("\n").filter((l) => l && !l.slice(3).startsWith(".tenet/")).sort();
      const h = (await p.call("open", { profile: "investigate", request: "how are greetings tested?" })).handle!;
      const before = status();
      for (const [key, value] of Object.entries(values)) {
        for (const scope of CATALOG[key as keyof typeof CATALOG].scopes) {
          const r = await p.call("decide", { h, kind: "config", target: key, propose: { value, scope } });
          assert.equal(r.exit, 0, `${key}/${scope}: ${JSON.stringify(r)}`);
        }
      }
      assert.deepEqual(status(), before, "no file outside .tenet/ changed");
      const tracked = execFileSync("git", ["ls-files", "tenet.policy.json", "INTENT.md"], { cwd: p.root, encoding: "utf8" });
      assert.equal(tracked, "", "no shared file was created");
    });
});
