// The real starter recipe, installed from its pinned lockfile. Needs the network (npm ci); set TENET_OFFLINE=1 to skip.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, git, initRepo, tmp } from "./helpers.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { createPorts } from "../src/wire.ts";
import { procStart } from "../src/adapters/proc.ts";
import { callWithEnvelopeConsent, reviewResult, waitFor } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const d = (r: { data?: unknown }) => r.data as Record<string, any>;
const PLUGIN = join(import.meta.dirname, "../../../plugin/skills/tenet-starter-ts-web-api");

describe("the ts-web-api recipe", () => {
  it("pins the lockfile it ships", () => {
    const recipe = JSON.parse(readFileSync(join(PLUGIN, "recipe.json"), "utf8"));
    assert.equal(createHash("sha256").update(readFileSync(join(PLUGIN, "template/package-lock.json"))).digest("hex"), recipe.lockfileSha256, "re-lock the recipe: update recipe.json with the new hash");
    assert.deepEqual(recipe.protectedPaths, [
      "server/src/platform/auth/*", "server/src/platform/session/*", "server/migrations/*",
      "server/src/platform/admission.ts", "server/src/platform/rate-metadata.ts",
    ]);
    assert.deepEqual(recipe.install[0], ["npm", "ci", "--ignore-scripts", "--no-audit"]);
    const template = JSON.parse(readFileSync(join(PLUGIN, "template/package.json"), "utf8"));
    assert.equal(template.dependencies["better-sqlite3"], "12.11.1");
    assert.equal(template.dependencies["@fastify/swagger"], "9.9.2");
    assert.equal(template.engines.node, ">=22.12.0");
  });

  it("scaffolds, and receipts the starter's tests, types and lint and a real end-to-end run against its own dedicated database [EVD-13], all run by the kernel", { skip: process.env.TENET_OFFLINE === "1" && "offline", timeout: 300_000 }, async () => {
    const root = tmp("tenet-starter-"); roots.push(root);
    initRepo(root);
    const rawCall = (v: string, i: Record<string, unknown>) => runVerb(createPorts(root, { PATH: process.env.PATH, HOME: process.env.HOME }), VERBS, v, i);
    const call = (v: string, i: Record<string, unknown>) => callWithEnvelopeConsent(rawCall, v, i);
    const o = await call("open", { profile: "feature", request: "a loan desk", scopePaths: [], lane: "quick", initGit: true });
    const h = o.handle!;
    await call("decide", { h, kind: "basis", propose: {
      outcome: "The starter platform is in place and its own tests pass",
      elements: [
        { ref: "r", kind: "requirement", origin: "request", text: "the platform's sign-in, session and migration tests pass" },
        { ref: "e", kind: "example", origin: "request", of: "r", text: "platform.test.ts passes", testFile: "server/test/platform.test.ts", test: "preservation", expect: "pass" },
      ],
    } });
    const s = await call("decide", { h, kind: "scaffold", propose: { name: "loan-desk" } });
    assert.equal(s.exit, 0, JSON.stringify(s));
    assert.equal(d(s).version, "0.4.0");

    const c = await call("check", { h, stage: "candidate" });
    assert.equal(c.exit, 0, JSON.stringify(c));
    const suite = d(c).receipts.find((r: { obligation: string }) => r.obligation === "OB-suite");
    assert.equal(suite.status, "pass", JSON.stringify(suite));
    assert.equal(suite.counts.executed, 89, "all platform, client and generated-contract cases ran");

    for (const id of ["OB-types", "OB-lint"]) {
      const receipt = d(c).receipts.find((r: { obligation: string }) => r.obligation === id);
      assert.equal(receipt?.status, "pass", `${id}: ${JSON.stringify(receipt)}`);
    }
    const e2e = d(c).receipts.find((r: { obligation: string }) => r.obligation === "OB-e2e");
    assert.equal(e2e?.status, "pass", `OB-e2e: ${JSON.stringify(e2e)}`);
    assert.equal(e2e.counts.executed, 12, "all source-server and real browser journeys ran");
    assert.ok(!existsSync(join(root, "data", "app.db")), "the e2e obligation never touched the developer's own database (EVD-13)");
    assert.equal(c.next[0]!.action, "focused-review", "the recipe's own vetted auth and session files do not raise the lane to Deep");
    await call("findings", { h, result: reviewResult(d(c)) });

    const f = await call("finish", { h, subject: "Scaffold the starter" });
    assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f.reasons));
    assert.equal(d(f).scope, "committed");
    const files = git(root, "ls-files").split("\n");
    assert.ok(files.includes("server/src/platform/auth/passwords.ts") && files.includes("package-lock.json"));
    assert.ok(files.includes("web/src/App.tsx") && files.includes("vite.config.ts"), "the browser shell is scaffolded and committed");
    assert.ok(files.includes("server/src/openapi.ts") && files.includes("server/src/platform/openapi.ts"), "the source-bound contract exporter is scaffolded and committed");
    assert.ok(!files.some((p) => p.startsWith("node_modules") || p === ".env.local"));
    assert.equal(git(root, "status", "--porcelain"), "");

    // A browser has its own child processes: prove cancellation does not leave Chromium behind.
    writeFileSync(join(root, "server/test/e2e/held-browser.e2e.spec.ts"), `
      import { test } from "@playwright/test";
      import { writeFileSync } from "node:fs";
      import { join } from "node:path";
      test("held browser", async ({ page }) => {
        await page.goto("/");
        const browser = page.context().browser();
        if (!browser) throw new Error("browser missing");
        const cdp = await browser.newBrowserCDPSession();
        const { processInfo } = await cdp.send("SystemInfo.getProcessInfo");
        const owner = processInfo.find(process => process.type === "browser");
        if (!owner) throw new Error("browser identity missing");
        writeFileSync(join(process.env.TMPDIR!, "browser-held.json"), JSON.stringify({ pid: owner.id }));
        await new Promise(resolve => setTimeout(resolve, 90_000));
      }, 120_000);
    `);
    const next = (await call("open", { profile: "refactor", request: "verify browser interruption", lane: "quick" })).handle!;
    assert.equal((await call("decide", { h: next, kind: "basis", propose: {
      outcome: "the browser check can be cancelled",
      elements: [{ ref: "r", kind: "requirement", origin: "request", text: "stop the browser" },
        { ref: "e", kind: "example", origin: "request", of: "r", text: "the platform remains valid", testFile: "server/test/platform.test.ts", test: "preservation", expect: "pass" }],
    } })).exit, 0);
    const pending = call("check", { h: next, stage: "candidate" });
    let runDir: string | undefined;
    try {
      const marker = await waitFor(() => {
        const state = createPorts(root, {}).store.read()!.state;
        runDir = Object.values(state.work).find(w => w.session.inCall)?.session.inCall?.runDir;
        const path = runDir && join(runDir, "tmp/browser-held.json");
        return path && existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as { pid: number } : undefined;
      }, 60_000, "the actual Chromium process identity");
      const started = procStart(marker.pid); assert.ok(started);
      const stopped = await call("stop", { h: next, mode: "cancel" });
      assert.equal(stopped.exit, 0, JSON.stringify(stopped));
      await pending;
      await waitFor(() => procStart(marker.pid) !== started, 10_000, "Chromium exits after cancellation");
    } finally {
      if (runDir) await createPorts(root, {}).runner.stopRun(runDir);
      await pending;
    }

  });
});
