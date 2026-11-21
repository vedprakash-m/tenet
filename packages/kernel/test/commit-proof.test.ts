import { after, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, NO_POSIX_PROCESSES } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, finishFixture, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";
const roots: string[] = [];
after(() => roots.forEach(cleanup));
async function finished() {
  const p = project(); roots.push(p.root);
  const h = (await p.call("open", { profile: "feature", request: "proven greeting", lane: "quick" })).handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", GREET_TEST); await p.call("check", { h, stage: "baseline" });
  p.write("src/greet.ts", GREET_IMPL); await p.call("check", { h, touched: ["src/greet.ts"] });
  const done = await finishFixture(p, { h, subject: "Proven greeting" });
  assert.equal(done.exit, 0, JSON.stringify(done));
  return { p, h };
}
function snapshot(p: Project) {
  return {
    head: p.git("rev-parse", "HEAD"), ref: p.git("symbolic-ref", "HEAD"),
    index: readFileSync(join(p.root, ".git", "index")),
    source: readFileSync(join(p.root, "src", "greet.ts")),
    pending: p.ports().store.read()!.state.pending,
  };
}
it("normal finalization persists a paired proof before publishing ownership [GIT-03, CON-12]",
  { skip: NO_POSIX_PROCESSES }, async () => {
    const { p, h } = await finished();
    const proof = p.ports().store.commitProofs();
    assert.equal(proof.length, 1);
    assert.equal(proof[0]!.commit, p.git("rev-parse", "HEAD"));
    assert.deepEqual(proof[0]!.parents, [p.git("rev-parse", "HEAD^")]);
    assert.deepEqual(proof[0]!.foreign, []);
    assert.equal(proof[0]!.observedTree, p.git("rev-parse", "HEAD^{tree}"));
    const log = p.ports().store.readLog();
    const result = log.find(r => r.effect === "commit" && r.kind === "result")!;
    assert.deepEqual((result.outcome as { proof: unknown }).proof, proof[0]);
    assert.equal((await p.call("undo", { h })).questions?.[0]?.id, "undo-confirm");
  });
for (const damage of ["missing", "corrupt", "duplicate", "mismatched-generation", "mismatched-work", "orphan"]) {
  it(`refuses ${damage} proof before inverse planning without changing Git [GIT-04, CON-12]`,
    { skip: NO_POSIX_PROCESSES }, async () => {
      const { p, h } = await finished();
      const directory = join(p.root, ".tenet", "git", "commit-proofs-v1");
      const file = join(directory, readdirSync(directory)[0]!);
      if (damage === "missing") rmSync(file);
      if (damage === "corrupt") writeFileSync(file, "{broken");
      if (damage === "duplicate") copyFileSync(file, join(directory, "0".repeat(64)));
      if (damage === "mismatched-generation") {
        const proof = JSON.parse(readFileSync(file, "utf8")); proof.generation++; writeFileSync(file, JSON.stringify(proof));
      }
      if (damage === "mismatched-work") {
        const proof = JSON.parse(readFileSync(file, "utf8")); proof.work += "-different"; writeFileSync(file, JSON.stringify(proof));
      }
      if (damage === "orphan") {
        const journal = join(p.root, ".tenet", "log");
        writeFileSync(journal, readFileSync(journal, "utf8").split("\n").filter(line =>
          !line || JSON.parse(line).effect !== "commit").join("\n"));
      }
      const before = snapshot(p);
      const response = await p.call("undo", { h });
      assert.equal(response.reasons[0]?.code, "undo-conflict", JSON.stringify(response));
      assert.deepEqual(snapshot(p), before);
    });
}

for (const merge of [false, true]) {
  it(`retains ownership on ${merge ? "merged" : "fast-forward"} base after deleting the origin ref [GIT-04]`,
    { skip: NO_POSIX_PROCESSES }, async () => {
      const { p, h } = await finished();
      const origin = p.git("symbolic-ref", "HEAD");
      if (merge) {
        p.git("checkout", "-q", "main"); p.write("later.txt", "human base work\n");
        p.git("add", "later.txt"); p.git("commit", "-qm", "Human base work");
        p.git("checkout", "-q", origin.slice("refs/heads/".length));
      }
      const integrated = await p.call("integrate", { h });
      assert.equal(integrated.exit, 0, JSON.stringify(integrated));
      p.git("update-ref", "-d", origin);
      const before = snapshot(p);
      const preview = await p.call("undo", { h });
      assert.equal(preview.questions?.[0]?.id, "undo-confirm", JSON.stringify(preview));
      assert.deepEqual({ ...snapshot(p), pending: before.pending }, before);
      const state = p.ports().store.read()!.state;
      const work = Object.values(state.work).find(w => w.git.integrated)!;
      const base = p.git("rev-parse", `${work.git.integrated!.commit}^`);
      p.git("update-ref", "refs/heads/main", base);
      const afterReset = snapshot(p);
      const refused = await p.call("decide", { h, kind: "undo-confirm", answers: { "undo-confirm": "apply" } });
      assert.equal(refused.reasons[0]?.code, "undo-conflict", JSON.stringify(refused));
      assert.deepEqual(snapshot(p), afterReset);
    });
}
it("refuses a rewritten commit even when its tree, patch and label match [GIT-04]",
  { skip: NO_POSIX_PROCESSES }, async () => {
    const { p, h } = await finished();
    const ref = p.git("symbolic-ref", "HEAD");
    const replacement = p.git("commit-tree", "HEAD^{tree}", "-p", "HEAD^", "-m", "Rewritten\n\nTenet-Work: W-0001");
    p.git("update-ref", ref, replacement);
    const before = snapshot(p);
    const refused = await p.call("undo", { h });
    assert.equal(refused.reasons[0]?.code, "undo-conflict", JSON.stringify(refused));
    assert.deepEqual(snapshot(p), before);
  });
