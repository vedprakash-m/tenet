// The Deep lane: a native architect pass and a native security pass stand between a green check and checked-local (WRK-04, TS §5.3).
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, project, reviewResult } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const d = (r: { data?: unknown }) => r.data as Record<string, any>;
const templateOf = (path: string) => JSON.parse(readFileSync(path, "utf8")).resultTemplate;

async function deepGreen(): Promise<{ p: Project; h: string; green: Awaited<ReturnType<Project["call"]>> }> {
  const p = project();
  roots.push(p.root);
  const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "deep" })).handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", GREET_TEST);
  await p.call("check", { h, stage: "baseline" });
  p.write("src/greet.ts", GREET_IMPL);
  const green = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
  return { p, h, green };
}

async function runPass(p: Project, h: string, analystRole: string) {
  const packet = await p.call("packet", { h, role: "analyst", analystRole, question: `Judge the ${analystRole} of this change.` });
  assert.equal(packet.exit, 0, JSON.stringify(packet));
  const t = templateOf(d(packet).analyst.manifest);
  const recorded = await p.call("findings", { h, result: { ...t, status: "completed", artifacts: ["src/greet.ts:1"], findings: [], openDependencies: [] } });
  assert.equal(recorded.exit, 0, JSON.stringify(recorded));
}

describe("Deep lane [WRK-04]", () => {
  it("names the two passes it needs, and finishes checked-local only after both ran on the current candidate", async () => {
    const { p, h, green } = await deepGreen();
    const reviewed = await p.call("findings", { h, result: reviewResult(d(green)) });
    const owed = reviewed.next.filter((n) => n.action === "analyst" && n.required);
    assert.equal(owed.length, 2, "an architect and a security pass are named as required next actions");
    await runPass(p, h, "architect");
    await runPass(p, h, "security");
    const f = await p.call("finish", { h, subject: "Greeting" });
    assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f));
  });

  it("finishes below checked-local when a pass is missing", async () => {
    const { p, h, green } = await deepGreen();
    await p.call("findings", { h, result: reviewResult(d(green)) });
    await runPass(p, h, "architect");
    const f = await p.call("finish", { h, subject: "Greeting" });
    assert.notEqual(d(f).endpoint, "checked-local");
    assert.ok(f.reasons.some((r) => r.code === "review-missing" && /security/.test(r.message)), JSON.stringify(f.reasons));
  });
});
