// Git filters are programs the user or project configured (GIT-12, TS §9.4). Reading never runs one; a commit that would run one asks first.
// Git LFS installs exactly such filters into the user's own configuration, so a configured filter alone must not stop the kernel.
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { GitCli } from "../src/adapters/git-cli.ts";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, finishFixture, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const dirs: string[] = [];
after(() => dirs.forEach(cleanup));
const scratch = (): string => { const d = tmp(); dirs.push(d); return d; };
const d = (r: { data?: unknown }) => r.data as Record<string, any>;
/** A clean filter that passes content through and leaves a marker, so a test can tell whether Git ran it. */
const markerFilter = (marker: string) => `node -e "require('fs').writeFileSync('${marker}','ran');process.stdin.pipe(process.stdout)"`;

function repoWithFilter(applies: boolean) {
  const root = scratch(), marker = join(scratch(), "ran");
  initRepo(root);
  write(root, "src/a.ts", "export const a = 1;\n");
  if (applies) write(root, ".gitattributes", "src/a.ts filter=audit\n");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "init");
  git(root, "config", "filter.audit.clean", markerFilter(marker));
  return { root, marker, g: new GitCli(root) };
}

describe("git filters: reading", () => {
  it("never runs a filter that applies to a file, however the file changed [GIT-12, CON-09]", async () => {
    const { root, marker, g } = repoWithFilter(true);
    write(root, "src/a.ts", "export const a = 9;\n");
    const inv = await g.inventory([]);
    assert.ok(inv.status.some((s) => s.path === "src/a.ts"));
    await g.changes("HEAD", ["src/a.ts"], () => "source");
    assert.equal(existsSync(marker), false, "the filter must not run while Tenet only looks");
    assert.deepEqual((await g.filterGate())?.names, ["audit"]);
  });

  it("does not stop on a configured filter that applies to no file, as with Git LFS installed globally [GIT-12]", async () => {
    const { g, marker } = repoWithFilter(false);
    assert.equal(await g.filterGate(), null);
    assert.ok((await g.inventory([])).digest);
    assert.equal(existsSync(marker), false);
  });

  it("opens a contract with a user-level filter that is marked required, as Git LFS configures it [GIT-12]", async () => {
    const config = join(scratch(), "gitconfig");
    write(config, "", "[filter \"lfs\"]\n\tclean = git-lfs clean -- %f\n\tsmudge = git-lfs smudge -- %f\n\tprocess = git-lfs filter-process\n\trequired = true\n");
    const before = process.env.GIT_CONFIG_GLOBAL;
    process.env.GIT_CONFIG_GLOBAL = config;
    try {
      const p = project();
      dirs.push(p.root);
      const open = await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "quick" });
      assert.equal(open.exit, 0, JSON.stringify(open));
      assert.ok(!open.reasons.some((r) => r.code === "filters-not-run"), "nothing applies, so there is nothing to say");
      const review = await p.call("review", {});
      assert.equal(review.exit, 0, JSON.stringify(review));
    } finally {
      process.env.GIT_CONFIG_GLOBAL = before;
    }
  });
});

describe("git filters: committing", () => {
  const filtered = async (): Promise<{ p: Project; h: string; marker: string }> => {
    const marker = join(scratch(), "ran");
    const p = project({ ".gitattributes": "src/greet.ts filter=audit\n" });
    dirs.push(p.root);
    git(p.root, "config", "filter.audit.clean", markerFilter(marker));
    const o = await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "quick" });
    const h = o.handle!;
    assert.ok(o.reasons.some((r) => r.code === "filters-not-run" && r.note), JSON.stringify(o.reasons));
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.equal(existsSync(marker), false, "checking does not run the filter");
    return { p, h, marker };
  };

  it("asks before a commit that would run a filter, and runs it only after consent [GIT-12]", async () => {
    const { p, h, marker } = await filtered();
    const ask = await finishFixture(p, { h });
    assert.equal(ask.exit, 3, JSON.stringify(ask));
    assert.equal(ask.questions![0]!.id, "filter-consent");
    assert.ok(ask.reasons.some((r) => r.code === "filter-consent-needed"));
    assert.match(ask.questions![0]!.question, /audit/);
    assert.equal(existsSync(marker), false, "asking runs nothing");
    const head = p.git("rev-parse", "HEAD");
    assert.equal(p.git("rev-parse", "HEAD"), head);
    await p.call("decide", { h, kind: "filter-consent", answers: { "filter-consent": "allow-filters" } });
    const f = await finishFixture(p, { h, subject: "Add greet" });
    assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f));
    assert.equal(existsSync(marker), true, "after consent the commit runs the filter as Git would");
    assert.notEqual(p.git("rev-parse", "HEAD"), head);
  });

  it("keeps the work uncommitted when the user declines the filter [GIT-15]", async () => {
    const { p, h, marker } = await filtered();
    await finishFixture(p, { h });
    await p.call("decide", { h, kind: "filter-consent", answers: { "filter-consent": "keep-uncommitted" } });
    const f = await finishFixture(p, { h });
    assert.equal(d(f).scope, "working-tree-uncommitted");
    assert.equal(existsSync(marker), false);
  });

  it("asks again when the configured filter command changes after consent [GIT-12]", async () => {
    const { p, h, marker } = await filtered();
    await finishFixture(p, { h });
    await p.call("decide", { h, kind: "filter-consent", answers: { "filter-consent": "allow-filters" } });
    git(p.root, "config", "filter.audit.clean", markerFilter(`${marker}2`));
    const f = await finishFixture(p, { h });
    assert.equal(f.exit, 3, JSON.stringify(f));
    assert.equal(f.questions![0]!.id, "filter-consent");
    rmSync(marker, { force: true });
  });

  it("refuses to undo or integrate under a filter that applies, instead of running it unasked [GIT-12]", async () => {
    const { root, g } = repoWithFilter(true);
    await assert.rejects(g.applyPatch("diff --git a/x b/x\n", [], { runDir: scratch(), timeoutMs: 1000 }), /filter/i);
    await assert.rejects(g.integrate("main", "main", { runDir: scratch(), timeoutMs: 1000 }), /filter/i);
    assert.equal(existsSync(join(root, "FILTER_RAN")), false);
  });
});
