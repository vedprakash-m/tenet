import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { GitCli, gitBlob } from "../src/adapters/git-cli.ts";
import { KernelError } from "../src/core/errors.ts";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, focusFixture, finishFixture, project, reviewResult } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const text = "export const a = 1;\n";
function fixture(flag: string) {
  const root = tmp(); roots.push(root); initRepo(root);
  write(root, "src/a.ts", text);
  git(root, "add", "-A"); git(root, "commit", "-qm", "initial source");
  git(root, "update-index", flag, "src/a.ts");
  const index = readFileSync(join(root, ".git/index"));
  return { root, adapter: new GitCli(root), index };
}
describe("hidden tracked inputs refuse uncertain identity [EVD-03, CON-03, GIT-03]", () => {
  for (const flag of ["--assume-unchanged", "--skip-worktree"]) {
    it(`refuses a deleted ${flag} input and preserves flags and exact index, recovering when restored`, async () => {
      const { root, adapter, index } = fixture(flag);
      const before = await adapter.inventory([]);
      rmSync(join(root, "src/a.ts"));
      await assert.rejects(adapter.inventory([]), error => error instanceof KernelError &&
        error.exit === 2 && error.reasons[0]?.code === "stale");
      assert.deepEqual(readFileSync(join(root, ".git/index")), index);
      write(root, "src/a.ts", text);
      const restored = await adapter.inventory([]);
      assert.equal(restored.digest, before.digest);
      assert.equal(restored.entries.get("src/a.ts")?.blob, gitBlob(Buffer.from(text)));
      assert.deepEqual(readFileSync(join(root, ".git/index")), index);
    });

    it(`still measures modified ${flag} content without changing the index`, async () => {
      const { root, adapter, index } = fixture(flag);
      const before = await adapter.inventory([]);
      const changed = "export const a = 2;\n";
      write(root, "src/a.ts", changed);
      const after = await adapter.inventory([]);
      assert.notEqual(after.digest, before.digest);
      assert.equal(after.entries.get("src/a.ts")?.blob, gitBlob(Buffer.from(changed)));
      assert.equal(after.status.find(s => s.path === "src/a.ts")?.xy, ".M");
      assert.deepEqual(readFileSync(join(root, ".git/index")), index);
    });
    it(`keeps explicit caller exclusions for deleted ${flag} input`, async () => {
      const { root, adapter, index } = fixture(flag);
      rmSync(join(root, "src/a.ts"));
      const inventory = await adapter.inventory(["src/a.ts"]);
      assert.equal(inventory.entries.has("src/a.ts"), false);
      assert.equal(inventory.status.some(s => s.path === "src/a.ts"), false);
      assert.deepEqual(readFileSync(join(root, ".git/index")), index);
    });
  }
});

describe("hidden deletion cannot retain a checked-local result [EVD-03, CON-03, GIT-03]", () => {
  for (const flag of ["--assume-unchanged", "--skip-worktree"]) {
    it(`refuses finish after ${flag} source disappears, then accepts the restored checked tree`, async () => {
      const p = project({ "src/extra.ts": text }); roots.push(p.root);
      const opened = await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "quick" });
      assert.equal(opened.exit, 0, JSON.stringify(opened));
      const h = opened.handle!;
      await p.call("decide", { h, kind: "basis", propose: BASIS });
      p.write("src/greet.test.ts", GREET_TEST);
      await p.call("check", { h, stage: "baseline" });
      p.write("src/greet.ts", GREET_IMPL);
      const green = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
      assert.equal(green.exit, 0, JSON.stringify(green));
      const reviewed = await p.call("findings", { h, result: reviewResult(green.data as Record<string, unknown>) });
      assert.equal(reviewed.exit, 0, JSON.stringify(reviewed));
      await focusFixture(p, h);
      p.git("update-index", flag, "src/extra.ts");
      const index = readFileSync(join(p.root, ".git/index")), head = p.git("rev-parse", "HEAD");
      rmSync(join(p.root, "src/extra.ts"));
      const refused = await p.call("finish", { h, noCommit: true });
      assert.equal(refused.exit, 2, JSON.stringify(refused));
      assert.ok(refused.reasons.some(r => r.code === "stale"), JSON.stringify(refused));
      assert.deepEqual(readFileSync(join(p.root, ".git/index")), index);
      assert.equal(p.git("rev-parse", "HEAD"), head);
      p.write("src/extra.ts", text);
      const restored = await finishFixture(p, { h, noCommit: true });
      assert.equal(restored.exit, 0, JSON.stringify(restored));
      assert.equal((restored.data as { endpoint: string }).endpoint, "checked-local", JSON.stringify(restored));
      assert.deepEqual(readFileSync(join(p.root, ".git/index")), index);
      assert.equal(p.git("rev-parse", "HEAD"), head);
    });
  }
});
