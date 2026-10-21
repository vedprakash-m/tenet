// The model record: the requested model is recorded as reported, and what is not known stays unknown (RSC-02, TS §4.8).
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanup } from "./helpers.ts";
import { project } from "./support/fixture.ts";

const roots: string[] = [];
const fresh = () => { const p = project(); roots.push(p.root); return p; };
after(() => roots.forEach(cleanup));
const d = (r: { data?: unknown }) => r.data as Record<string, any>;
const templateOf = (path: string) => JSON.parse(readFileSync(path, "utf8")).resultTemplate;

describe("model record [RSC-02]", () => {
  it("records the model the coordinator reports on open, and says unknown when none is reported", async () => {
    const p = fresh();
    const reported = await p.call("open", { profile: "investigate", request: "how are greetings tested?", model: "gpt-x" });
    assert.deepEqual(d(reported).model, { requested: "gpt-x", source: "reported", qualification: "unknown" });
    const q = fresh();
    const silent = await q.call("open", { profile: "investigate", request: "how are greetings tested?" });
    assert.deepEqual(d(silent).model, { requested: "inherited", source: "unknown", qualification: "unknown" });
  });

  it("records the model per assignment, and an assignment that reports none is unknown", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "investigate", request: "x", model: "gpt-x" })).handle!;
    const packet = async (question: string) => d(await p.call("packet", { h, role: "analyst", analystRole: "researcher", question })).analyst.manifest as string;
    const result = (manifest: string) => ({ ...templateOf(manifest), status: "completed", artifacts: [], findings: [], openDependencies: [] });
    const first = await packet("one?");
    await p.call("findings", { h, model: "gpt-small", result: result(first) });
    const second = await packet("two?");
    await p.call("findings", { h, result: result(second) });
    const w = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(w.analyses[0]!.model?.requested, "gpt-small");
    assert.equal(w.analyses[0]!.model?.source, "reported");
    assert.deepEqual(w.analyses[1]!.model, { requested: "inherited", source: "unknown", qualification: "unknown" });
    assert.equal(w.model?.requested, "gpt-x", "the contract's own record is not changed by an assignment");
  });

  it("shows the record in status", async () => {
    const p = fresh();
    await p.call("open", { profile: "investigate", request: "x", model: "gpt-x" });
    const s = await p.call("inspect", { view: "status" });
    assert.equal(d(s).work[0].model.requested, "gpt-x");
  });
});
