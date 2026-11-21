// Policy continuity (F4 items 1-4): a restriction Tenet retained or observed stays in force for the whole call, and a
// shared-policy change that needs acceptance is reported with its question on every path (TS §8.5; PRD §5.6).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";
import { runVerb } from "../src/pipeline.ts";
import type { Verb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { settingsFor } from "../src/verbs/reconcile.ts";

const roots: string[] = [];
after(() => { for (const r of roots) cleanup(r); });
const read = (p: Project, rel: string) => readFileSync(join(p.root, rel), "utf8");
const trusted = (p: Project) => p.ports().store.read()!.state.trust.find((t) => t.file === "tenet.policy.json")!;
const confirm = { "adopt-confirm": "confirm" };

/** A contract whose last call adopted `policy`. */
async function adopted(policy: object) {
  const p = project({ "tenet.policy.json": JSON.stringify(policy) });
  roots.push(p.root);
  const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard" })).handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  await p.call("decide", { h, kind: "adopt", target: "policy" });
  const done = await p.call("decide", { h, kind: "adopt", target: "policy", answers: confirm });
  assert.equal(done.exit, 0, JSON.stringify(done));
  return { p, h };
}

describe("policy continuity [SEC-12]", () => {
  it("a stateless review keeps a restriction Tenet retained while a loosening waits, and writes nothing [SEC-12, SEC-14, CON-09]", async () => {
    const { p } = await adopted({ exclusions: [{ pattern: "src/greet.ts", kinds: ["no-model-send"] }] });
    p.write("tenet.policy.json", "{}");
    p.write("src/greet.ts", GREET_IMPL);
    const before = read(p, ".tenet/state");
    const r = await p.call("review", {});
    assert.equal(r.exit, 0, JSON.stringify(r));
    const manifest = JSON.parse(readFileSync((r.data as { manifest: string }).manifest, "utf8"));
    assert.ok(!manifest.investigation.includes("src/greet.ts"), "the retained no-model-send exclusion still applies");
    assert.ok(!manifest.changes.some((c: { path: string }) => c.path === "src/greet.ts"));
    assert.equal(read(p, ".tenet/state"), before);
  });

  it("a tightening observed at the start of a mutating call stays in force when the file loosens mid-call [SEC-12]", async () => {
    const p = project({ "tenet.policy.json": JSON.stringify({ exclusions: [{ pattern: "db/**", kinds: ["no-edit"] }] }) });
    roots.push(p.root);
    const probe: Verb = {
      name: "probe", schema: z.object({}), class: () => "mutating",
      run(ports, state) {
        p.write("tenet.policy.json", "{}");
        return { resp: { data: settingsFor(ports, state).exclusions } };
      },
    };
    const r = await runVerb(p.ports(), { ...VERBS, probe }, "probe", {});
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.ok((r.data as Array<{ pattern: string }>).some((e) => e.pattern === "db/**"), JSON.stringify(r.data));
  });

  // A changed tenet.policy.json changes the call's identity (the capability key binds the policy and the settings), so such
  // a retry is a new call; a shared INTENT.md change does not, and is what a historical answer can miss.
  it("an identical retry answered as historical still records and reports what reconciliation found [SEC-12]", async () => {
    const p = project();
    roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    await p.call("decide", { h, kind: "adopt", target: "intent" });
    assert.equal((await p.call("decide", { h, kind: "adopt", target: "intent", answers: confirm })).exit, 0);
    // Adoption is part of the settings the call identity binds, so the retried call comes after it.
    const retry = { h, kind: "basis", propose: BASIS };
    await p.call("decide", retry);
    const intentHash = () => p.ports().store.read()!.state.trust.find((t) => t.file === "INTENT.md")!.hash;
    const before = intentHash();
    p.write("INTENT.md", `${read(p, "INTENT.md")}\nA note of the user's own.\n`);
    const own = await p.call("decide", retry);
    assert.equal(own.historical, true, JSON.stringify(own));
    assert.notEqual(intentHash(), before, "the user's own text outside the blocks is recorded");
    p.write("INTENT.md", read(p, "INTENT.md").replace("Hello, Ada!", "Hi, Ada!"));
    const edited = await p.call("decide", retry);
    assert.equal(edited.historical, true, JSON.stringify(edited));
    assert.equal(edited.reasons.filter((x) => x.code === "intent-edited-outside").length, 1, JSON.stringify(edited.reasons));
  });

  it("an ordinary call that finds a loosening asks the pending question, and stops asking once it is answered [SEC-12]", async () => {
    const { p, h } = await adopted({ protected_paths: ["db/**", "infra/**"] });
    p.write("tenet.policy.json", JSON.stringify({ protected_paths: ["db/**"] }));
    const r = await p.call("decide", { h, kind: "basis", propose: BASIS });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.ok(r.reasons.some((x) => x.code === "policy-change-needs-acceptance"), JSON.stringify(r.reasons));
    assert.ok(r.questions?.some((q) => q.id === "adopt-confirm"), JSON.stringify(r.questions));
    const ok = await p.call("decide", { h, kind: "adopt", target: "policy", answers: confirm });
    assert.equal(ok.exit, 0, JSON.stringify(ok));
    assert.ok(!ok.questions?.some((q) => q.id === "adopt-confirm"), JSON.stringify(ok.questions));
    assert.deepEqual(trusted(p).restrictions.protected_paths, ["db/**"]);
  });
});
