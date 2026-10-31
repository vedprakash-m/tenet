import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createStack } from "../src/adapters/node-ts.ts";
import { isSettingKey } from "../src/core/config.ts";
import { supportOf } from "../src/core/obligations.ts";
import { isReasonCode } from "../src/core/reasons.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { cleanup, tmp, write } from "./helpers.ts";
import { project } from "./support/fixture.ts";
import { receiptsOf } from "../src/verbs/check-evidence.ts";
import type { Run } from "../src/verbs/check-evidence.ts";
import { makeExecutionEnvelope } from "../src/core/execution-envelope.ts";
import { checkInputId, gather } from "../src/verbs/facts.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = () => { const root = tmp(); roots.push(root); return root; };
const playwright = (root: string, version = "1.64.1") => {
  write(root, "node_modules/@playwright/test/package.json", JSON.stringify({ version }));
  write(root, "node_modules/@playwright/test/cli.js", "process.exit(0);");
};

describe("installed Playwright evidence boundaries", () => {
  it("binds the installed Playwright version even without an npm installed-lock record [EVD-03, EVD-11]", () => {
    const root = fresh(), stack = createStack();
    playwright(root);
    const before = stack.fingerprint(root);
    playwright(root, "1.64.2");
    assert.notDeepEqual(stack.fingerprint(root), before);
  });

  it("applies metadata exclusions before constructing an e2e command [SEC-14]", () => {
    const root = fresh(), stack = createStack();
    playwright(root);
    stack.setExclusions([{ pattern: "node_modules/@playwright/test/package.json", kinds: ["no-read"] }]);
    assert.throws(() => stack.e2eArgv(root, "/run/report.json"), /excludes stack metadata/);
  });

  for (const kind of ["link", "invalid-utf8", "oversized"] as const) {
    it(`refuses ${kind} Playwright metadata before command construction [SEC-06, EVD-05]`, () => {
      const root = fresh(), path = join(root, "node_modules/@playwright/test");
      mkdirSync(path, { recursive: true });
      write(root, "node_modules/@playwright/test/cli.js", "process.exit(0);");
      if (kind === "link") {
        write(root, "metadata.json", '{"version":"1.64.1"}');
        symlinkSync(join(root, "metadata.json"), join(path, "package.json"));
      } else if (kind === "invalid-utf8") {
        writeFileSync(join(path, "package.json"), Buffer.concat([
          Buffer.from('{"version":"1.64.1","note":"'), Buffer.from([0xff]), Buffer.from('"}'),
        ]));
      } else writeFileSync(join(path, "package.json"), `{"version":"1.64.1","note":"${"x".repeat(21 * 1024 * 1024)}"}`);
      assert.throws(() => createStack().e2eArgv(root, "/run/report.json"), /metadata.*safely/);
    });
  }

  it("stales evidence when ignored Playwright configuration appears after a baseline [EVD-03, EVD-10]", async () => {
    const p = project({ ".gitignore": "node_modules\nplaywright.config.*\n" }); roots.push(p.root);
    await p.call("open", { profile: "plan", request: "check ignored e2e configuration" });
    const ports = p.ports(), w = Object.values(ports.store.read()!.state.work)[0]!;
    const before = await gather(ports, w), status = p.git("status", "--porcelain");
    const identity = checkInputId(ports, w, before.candidate);
    const obligation = { id: "acceptance", kind: "test" as const, category: "acceptance" as const };
    assert.equal(supportOf(obligation, before)["playwright.config.ts"], "");
    p.write("playwright.config.ts", "export default { retries: 2 };\n");
    const after = await gather(ports, w);
    assert.equal(p.git("status", "--porcelain"), status);
    assert.notEqual(checkInputId(ports, w, after.candidate), identity);
    assert.ok(supportOf(obligation, after)["playwright.config.ts"]);
  });

  it("keeps the direct supported invocation and refuses unsupported versions [EVD-05]", () => {
    const root = fresh(), stack = createStack();
    assert.equal(stack.e2eArgv(root, "/run/report.json"), null);
    playwright(root);
    assert.deepEqual(stack.e2eArgv(root, "/run/report.json"), [
      process.execPath, join("node_modules", "@playwright/test/cli.js"), "test", "--reporter=json",
    ]);
    playwright(root, "99.0.0");
    assert.equal(stack.e2eArgv(root, "/run/report.json"), null);
  });

  it("records Playwright's own tool and reporter on its receipt [EVD-12, EVD-13]", async () => {
    const p = project(); roots.push(p.root);
    await p.call("open", { profile: "plan", request: "identify e2e evidence" });
    const w = Object.values(p.ports().store.read()!.state.work)[0]!;
    const ports = p.ports(), stack = createStack(), metadataRoot = fresh();
    playwright(metadataRoot);
    // Preserve the real stack, substituting only the installed metadata fixture location.
    ports.stack = { ...stack, fingerprint: () => stack.fingerprint(metadataRoot),
      e2eArgv: (_root, report) => stack.e2eArgv(metadataRoot, report) };
    const inv = { entries: new Map(), head: null, branch: null, status: [], digest: "candidate" };
    const run: Run = {
      ports, w, runId: "e2e", runDir: "/run", stage: "candidate", baseline: false, scope: "full",
      toRun: [{ id: "OB-e2e", kind: "static", category: "affected", tool: "playwright" }],
      toExecute: "all", missing: [], id: "check", executionEnvelope: makeExecutionEnvelope("project", []),
      facts: { inv, att: { tenet: [], human: [], concurrent: [], mixed: [], unexplained: [], changed: [] },
        candidate: "candidate", tenetPaths: [], reviewPaths: [], lockAnchors: new Set() },
    };
    const raw = JSON.stringify({ suites: [{ file: "e2e/a.spec.ts", title: "journey", specs: [{
      title: "works", ok: true, tests: [{ status: "expected", results: [{ status: "passed" }] }],
    }] }], stats: { expected: 1, skipped: 0, unexpected: 0, flaky: 0 } });
    const facts = { ran: true, exit: 0, timedOut: false, durationMs: 1, startedAt: "2026-10-28T00:00:00Z",
      after: "candidate", raw };
    const [receipt] = receiptsOf(run, w, { ...facts, statics: { "OB-e2e": facts } });
    assert.equal(receipt?.status, "pass");
    assert.equal(receipt?.versions.tool, "playwright@1.64.1");
    assert.equal(receipt?.versions.reporter, "playwright-json");
  });
});

describe("closed registry membership", () => {
  for (const name of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    it(`does not accept inherited ${name} as a setting or reason [CFG-02, CFG-11]`, () => {
      assert.equal(isSettingKey(name), false);
      assert.equal(isReasonCode(name), false);
    });

    it(`returns a transport error for inherited verb ${name} without throwing [NFR-03]`, async () => {
      const root = fresh();
      // An unknown verb must not consult ports or create state.
      const response = await runVerb({ root } as Parameters<typeof runVerb>[0], VERBS, name, {});
      assert.equal(response.exit, 1);
      assert.equal(response.reasons[0]?.code, "unknown-verb");
    });
  }

  it("refuses inherited decision kinds and setting names without changing configuration [CFG-02, CFG-11]", async () => {
    const p = project(); roots.push(p.root);
    const h = (await p.call("open", { profile: "plan", request: "inspect settings" })).handle!;
    for (const name of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      for (const input of [{ kind: name }, { kind: "config", target: name, propose: { value: "x" } }]) {
        const response = await p.call("decide", { h, ...input });
        assert.equal(response.reasons[0]?.code, "restriction-key-unknown", JSON.stringify(response));
      }
    }
    assert.deepEqual(p.ports().store.read()!.state.config.local, {});
  });
});

describe("secret-bearing structured proposals", () => {
  it("refuses a proposal before writing its synthetic secret to state or the journal [SEC-11]", async () => {
    const p = project(); roots.push(p.root);
    const h = (await p.call("open", { profile: "plan", request: "record a storage decision" })).handle!;
    const directory = join(p.root, ".tenet");
    const before = Object.fromEntries(readdirSync(directory).map(name => [name, readFileSync(join(directory, name), "utf8")]));
    const canary = ["ghp_", "a".repeat(36)].join("");
    const response = await p.call("decide", { h, kind: "decision-record", quote: "Use the local store", propose: {
      title: "Store locally", context: `An accidentally pasted credential: ${canary}`,
      decision: "Use SQLite", consequences: "One local process",
    } });
    const after = Object.fromEntries(readdirSync(directory).map(name => [name, readFileSync(join(directory, name), "utf8")]));
    assert.equal(Object.values(after).some(content => content.includes(canary)), false, "the synthetic secret reached a private record");
    assert.equal(response.exit, 1, JSON.stringify(response));
    assert.equal(response.reasons[0]?.code, "invalid-input");
    assert.equal(JSON.stringify(response).includes(canary), false);
    assert.deepEqual(after, before, "refused input must not enter state, backup, journal or lock records");
  });
});
