// Golden task: the real loop builds the equipment-loan feature (PRD §3.5/5.16) on the real starter, proving
// QLT-01's persistence, validation, server-side object/role authorization and a real local journey end to end.
// This is evidence for the feature, not a shipped part of the recipe: tech-spec §12.2 is explicit that
// `features/<f>/` starts empty in the template, so the fixture files below live here, not in the recipe.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { createPorts } from "../src/wire.ts";
import { callWithEnvelopeConsent, reviewResult } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const d = (r: { data?: unknown }) => r.data as Record<string, any>;
const FIXTURES = join(import.meta.dirname, "fixtures/golden-tasks/loan-desk");

/** Every `<rel>.txt` fixture file, written to `root/<rel>` with the `.txt` stripped (kept inert to this repo's own tsc/test discovery). */
function listTxt(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return listTxt(p);
    return e.name.endsWith(".txt") ? [p] : [];
  });
}
function writeFixture(root: string, onlyUnder?: string[]): string[] {
  const written: string[] = [];
  for (const file of listTxt(FIXTURES)) {
    const rel = relative(FIXTURES, file).replace(/\.txt$/, "");
    if (onlyUnder && !onlyUnder.some((p) => rel === p || rel.startsWith(`${p}/`))) continue;
    write(root, rel, readFileSync(file, "utf8"));
    written.push(rel);
  }
  return written;
}

describe("golden task: the loan desk feature [QLT-01, QLT-12]", { skip: process.env.TENET_OFFLINE === "1" && "offline" }, () => {
  it("scaffolds the starter, then the real open/basis/check/review/finish loop builds the reservation feature with a real baseline red and a real green", { timeout: 300_000 }, async () => {
    const root = tmp("tenet-golden-loan-desk-"); roots.push(root);
    initRepo(root);
    // The same scratch journey can drive the shipped CLI during UAT; CI defaults to the source pipeline.
    const rawCall = async (v: string, i: Record<string, unknown>) => {
      const bundle = process.env.TENET_TEST_BUNDLE;
      if (!bundle) return runVerb(createPorts(root, { PATH: process.env.PATH, HOME: process.env.HOME }), VERBS, v, i);
      const readsBody = ["open", "decide", "findings"].includes(v);
      const args = readsBody ? [] : Object.entries(i).flatMap(([key, value]) => [
        `--${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`, Array.isArray(value) ? value.join(",") : typeof value === "object" ? JSON.stringify(value) : String(value),
      ]);
      const result = spawnSync(process.execPath, [bundle, v, ...args], {
        cwd: root, env: process.env, input: readsBody ? JSON.stringify(i) : "", encoding: "utf8", maxBuffer: 10 * 1024 * 1024,
      });
      assert.equal(result.signal, null, result.stderr);
      const response = JSON.parse(result.stdout);
      assert.equal(result.status, response.exit, result.stderr);
      return response;
    };
    const call = (v: string, i: Record<string, unknown>) => callWithEnvelopeConsent(rawCall, v, i);

    // 1. Scaffold the platform layer (same recipe path `starter.test.ts` exercises).
    const o = await call("open", { profile: "feature", request: "a loan desk", scopePaths: [], lane: "quick", initGit: true });
    const h0 = o.handle!;
    await call("decide", { h: h0, kind: "basis", propose: {
      outcome: "The starter platform is in place and its own tests pass",
      elements: [
        { ref: "r", kind: "requirement", origin: "request", text: "the platform's sign-in, session and migration tests pass" },
        { ref: "e", kind: "example", origin: "request", of: "r", text: "platform.test.ts passes", testFile: "server/test/platform.test.ts", test: "preservation", expect: "pass" },
      ],
    } });
    const s = await call("decide", { h: h0, kind: "scaffold", propose: { name: "loan-desk" } });
    assert.equal(s.exit, 0, JSON.stringify(s));
    const scaffoldCheck = await call("check", { h: h0, stage: "candidate" });
    assert.equal(scaffoldCheck.exit, 0, JSON.stringify(scaffoldCheck));
    assert.ok(d(scaffoldCheck).review, JSON.stringify(scaffoldCheck));
    await call("findings", { h: h0, result: reviewResult(d(scaffoldCheck)) });
    const scaffoldFinish = await call("finish", { h: h0, subject: "Scaffold the starter" });
    assert.equal(d(scaffoldFinish).endpoint, "checked-local", JSON.stringify(scaffoldFinish.reasons));

    // 2. A new Standard-lane task: the first real feature, built as the user's own first increment, per
    // tech-spec §12.2 ("the first plan item's own build step is what populates the first feature").
    const scope = [
      "server/migrations/0002_items_loans.sql", "server/src/features/loans/*", "server/src/app.ts", "server/src/server.ts", "shared/schemas.ts", "package.json", "tsconfig.json", "workload/*",
      "server/test/helpers.ts", "server/test/migrate.test.ts", "server/test/restore.test.ts", "server/test/openapi-loans.test.ts", "server/test/prior-version.test.ts", "server/test/workload.test.ts", "server/test/bounded-browse.test.ts",
      "server/test/concurrent-reservation.test.ts", "server/test/concurrent-return.test.ts", "server/test/fixtures/*",
      "web/src/*", "server/test/e2e/*", "server/test/support/browser-server.ts", "journeys.json", "docs/a11y-checks.md", "docs/workload.md",
    ];
    const open = await call("open", {
      profile: "feature",
      request: "Members can browse equipment availability, reserve an available item, and return their own loan; only an admin sees who currently has an item",
      scopePaths: scope, lane: "standard",
    });
    const h = open.handle!;
    const basis = await call("decide", { h, kind: "basis", propose: {
      outcome: "Members browse availability, reserve and return equipment; only an admin sees who has what",
      scopePaths: scope,
      elements: [
        { ref: "r1", kind: "requirement", origin: "request", text: "a signed-in member can see which items are available or on loan, reserve an available item, and return their own loan; repeated or concurrent returns are refused with a conflict" },
        { ref: "e1", kind: "example", origin: "request", of: "r1", test: "distinguishing", expect: "fail", testFile: "server/src/features/loans/loans.test.ts", text: "browsing shows availability; reserving an available item succeeds and marks it unavailable" },
        { ref: "e2", kind: "example", origin: "request", of: "r1", test: "boundary", expect: "fail", testFile: "server/src/features/loans/loans.test.ts", text: "reserving an item already on loan is refused with a conflict, not a silent failure" },
        { ref: "e3", kind: "example", origin: "request", of: "r1", test: "boundary", expect: "pass", testFile: "server/test/concurrent-reservation.test.ts", text: "of 5 simultaneous reservation attempts on one item from separate processes, exactly one succeeds — a database-schema invariant (the unique partial index), true the moment the migration exists, independent of the feature logic this task adds" },
        { ref: "r2", kind: "requirement", origin: "request", text: "only an admin can see who currently has an item on loan; everyone else sees only availability" },
        { ref: "e4", kind: "example", origin: "request", of: "r2", test: "distinguishing", expect: "fail", testFile: "server/src/features/loans/loans.test.ts", text: "the admin overview names the borrower; a member's own browse view never does, and a member is refused the admin overview" },
        { ref: "e5", kind: "example", origin: "request", of: "r1", test: "distinguishing", expect: "fail", testFile: "server/src/features/loans/loans.test.ts", text: "a fresh actor-scoped read lists only the current member’s persisted loans and returns, with bounded pagination" },
        { ref: "i1", kind: "invariant", origin: "request", of: "r2", text: "no response a non-admin can read ever names another user's identity" },
      ],
    } });
    assert.equal(basis.exit, 0, JSON.stringify(basis));

    // 3. Red first: the tests, plus the infrastructure they need just to run (the migration and the plain CRUD
    // repositories — not "behavior," the requirement text above names none of their shapes). The actual
    // requirement (availability without a name, the conflict, authorization) is still entirely unwritten.
    writeFixture(root, [
      "package.json", "tsconfig.json",
      "server/migrations/0002_items_loans.sql", "server/src/features/loans/items.repository.ts", "server/src/features/loans/loans.repository.ts",
      "server/src/features/loans/loans.test.ts", "server/test/concurrent-reservation.test.ts", "server/test/fixtures/concurrent-reserve-worker.ts",
    ]);
    const baseline = await call("check", { h, stage: "baseline" });
    assert.ok(baseline.reasons.every((r) => r.code !== "no-distinguishing-red"), JSON.stringify(baseline));

    // 4. Green: the full implementation, exactly as it was built and validated standalone before relocating here.
    const written = writeFixture(root);
    assert.ok(written.includes("server/src/features/loans/service.ts"), "the fixture wrote the feature's files");

    const candidate = await call("check", { h, stage: "candidate", touched: written });
    assert.equal(candidate.exit, 0, JSON.stringify(candidate));
    const suite = d(candidate).receipts.find((r: { obligation: string }) => r.obligation === "OB-suite");
    assert.equal(suite.status, "pass", JSON.stringify(suite));
    assert.equal(suite.counts.executed, 116, "platform, feature, process-race and generated-contract cases all ran");
    for (const id of ["OB-types", "OB-lint"]) {
      const receipt = d(candidate).receipts.find((r: { obligation: string }) => r.obligation === id);
      assert.equal(receipt?.status, "pass", `${id}: ${JSON.stringify(receipt)}`);
    }

    const browser = d(candidate).receipts.find((r: { obligation: string }) => r.obligation === "OB-e2e");
    assert.equal(browser?.status, "pass", JSON.stringify(browser));
    assert.equal(browser.counts.executed, 16, "all preserved account/server and domain browser scenarios ran");

    // 5. Synthetic review/architect/security results exercise the Deep-lane gate; no native analyst run
    // is observed here. Migrations raise reversibility/compatibility risk (TS §8.2's signal table).
    await call("findings", { h, result: reviewResult(d(candidate)) });
    for (const analystRole of ["architect", "security"]) {
      const packet = await call("packet", { h, role: "analyst", analystRole, question: `Judge the ${analystRole} of this change.` });
      assert.equal(packet.exit, 0, JSON.stringify(packet));
      const template = JSON.parse(readFileSync(d(packet).analyst.manifest, "utf8")).resultTemplate;
      const recorded = await call("findings", { h, result: { ...template, status: "completed", artifacts: ["server/src/features/loans/service.ts:1"], findings: [], openDependencies: [] } });
      assert.equal(recorded.exit, 0, JSON.stringify(recorded));
    }
    const f = await call("finish", { h, subject: "Build the loan desk feature" });
    assert.equal(f.exit, 0, JSON.stringify(f));
    assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f.reasons));
    assert.equal(d(f).scope, "committed");

    const files = git(root, "ls-files").split("\n");
    assert.ok(files.includes("server/src/features/loans/service.ts") && files.includes("server/migrations/0002_items_loans.sql"));
    assert.equal(git(root, "status", "--porcelain"), "");
  });
});
