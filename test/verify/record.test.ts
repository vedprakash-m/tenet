import assert from "node:assert/strict";
import { test } from "node:test";
import { tmpRepo } from "../helpers/tmpRepo.ts";
import { fakeGitHub } from "../helpers/fakeGitHub.ts";
import { buildVerify, emptyDeps } from "./build.ts";

buildVerify();
const { recordAll, evaluationId } = await import("../../dist/verify/record.js");
const { decodeBundle, readArtifact } = await import("../../dist/verify/bundle.js");
const { sha256, jcs } = await import("../../dist/core/hash.js");
const { GitHubForge } = await import("../../dist/verify/forge.js");
const { keepRecord, recordsFiles } = await import("../../dist/verify/records.js");

const repository = "fixture/checkout";
const at = "2026-11-23T10:00:00Z";
const body = "## Acceptance\nImplements: R-1\n- [AB-1] retry once\n";
const policy = { level: "observe", specs: { id_prefix: "R" }, checks: { unit: { report: "junit" } } };

function bundle(head: string, base: string, state = "pass") {
  const report = Buffer.from(state === "malformed" ? "broken" :
    `<testsuite><testcase name="[AB-1] retry once">${state === "skip" ? "<skipped/>" : ""}</testcase></testsuite>`);
  const model = {
    schema_version: 1, "x-repository": repository,
    run: { id: "42", attempt: 1, workflow: "Tenet tests", job: "test", index: 0 },
    tested: { commit: head, head, base, kind: "head" },
    checks: [{ name: "unit", exit_code: state === "exit" ? 3 : 0, outcome: state === "timeout" ? "timeout" : "success",
      duration_ms: 2, report: state === "missing" ? "none" : "report.xml",
      report_sha256: sha256(state === "missing" ? Buffer.alloc(0) : report), inputs: [] }],
  };
  const files = new Map([["bundle.json", Buffer.from(JSON.stringify(model))]]);
  if (state !== "missing") files.set("report.xml", report);
  return decodeBundle(files);
}

function zip(files: Map<string, Buffer>): Buffer {
  const local: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  for (const [name, bytes] of files) {
    const filename = Buffer.from(name);
    const entry = Buffer.alloc(30);
    entry.writeUInt32LE(0x04034b50);
    entry.writeUInt32LE(bytes.length, 18);
    entry.writeUInt32LE(bytes.length, 22);
    entry.writeUInt16LE(filename.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(offset, 42);
    local.push(entry, filename, bytes);
    directory.push(central, filename);
    offset += entry.length + filename.length + bytes.length;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.size, 8);
  end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(Buffer.concat(directory).length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...directory, end]);
}

function memoryStore() {
  const files: Record<string, string> = {};
  let version = 0;
  return {
    files,
    read: async () => ({ tip: String(version), files: { ...files } }),
    write: async (snapshot: { tip: string }, changed: Record<string, string>) => {
      if (snapshot.tip !== String(version)) return false;
      Object.assign(files, changed);
      version += 1;
      return true;
    },
  };
}

test("GitHub adapter uses the fake forge for pagination, shared heads, upsert, run selection and artifact retry", async () => {
  const fake = fakeGitHub();
  const head = "a".repeat(40), base = "b".repeat(40);
  const pr = (number: number, sha = head) => ({ number, head: { sha }, base: { sha: base }, body });
  const model = { id: 42, run_attempt: 1, name: "Tenet tests", head_sha: head, repository: { full_name: repository }, run_started_at: at };
  let downloads = 0;
  let prior = false;
  const archive = zip(bundle(head, base).files);
  const adapter = new GitHubForge(repository, async (method: string, resource: string, data?: unknown) => {
    fake.request(method, resource, data);
    const result = (value: unknown) => ({ status: 200, data: value });
    if (resource.includes("/pulls?") && resource.endsWith("page=1")) return result([pr(1), ...Array.from({ length: 99 }, (_, i) => pr(i + 3, base))]);
    if (resource.includes("/pulls?")) return result([pr(2)]);
    if (resource.endsWith("/pulls/1")) return result(pr(1));
    if (resource.includes("/commits/")) return result({ check_runs: prior ? [{ id: 61, head_sha: head, name: "Tenet" }] : [] });
    if (method === "POST" || method === "PATCH") { prior = true; return result({}); }
    if (resource.includes("/actions/runs?")) return result({ workflow_runs: [model] });
    if (resource.includes("/artifacts?")) return result({ artifacts: [
      { id: 2, name: "tenet-bundle-test-0", size_in_bytes: archive.length },
      { id: 3, name: "tenet-bundle-test-1", expired: true, created_at: at },
      { id: 4, name: "not-a-bundle", expired: true },
    ] });
    if (resource.endsWith("/artifacts/2/zip")) return ++downloads < 3 ? { status: 503, data: null } : result(archive);
    return assert.fail(resource);
  });
  assert.deepEqual((await adapter.findPullRequests(head)).map((item: { number: number }) => item.number), [1, 2]);
  assert.equal((await adapter.getPullRequest(1)).body, body);
  await adapter.upsertCheckRun({ head, summary: "one", conclusion: "success" });
  await adapter.upsertCheckRun({ head, summary: "two", conclusion: "neutral" });
  const checkRequests = fake.requests.filter((entry) => entry.method !== "GET");
  assert.deepEqual(checkRequests.map(({ method, path }) => [method, path]), [
    ["POST", "/repos/fixture/checkout/check-runs"],
    ["PATCH", "/repos/fixture/checkout/check-runs/61"],
  ]);
  const found = await adapter.latestRun(head, "Tenet tests");
  const downloaded = await adapter.downloadBundles(found);
  assert.equal(downloads, 3);
  assert.equal(downloaded.total, 2);
  assert.equal(downloaded.bundles.length, 1);
  assert.equal(downloaded.missing, 1);
  assert.equal(downloaded.expiredAt, "2026-11-23");
  assert.throws(() => readArtifact(zip(new Map([["../outside", Buffer.from("fixture")]]))), /unsafe/);
});

test("records are idempotent, refuse different bytes and keep latest forward-only during races", async () => {
  const store = memoryStore();
  const entry = (id: number) => ({
    work: "pr-1", run: { id: String(id), attempt: 1 },
    startedAt: `2026-11-23T10:0${id}:00Z`, at,
    card: { evaluation_id: "a".repeat(16), rules: [{ rule: "budget", mode: "advise", would_block: true, reason: "budget" }] },
  });
  await Promise.all([5, 2, 4, 1, 3].map((id) => keepRecord(store, entry(id), async () => {})));
  assert.equal(JSON.parse(store.files["proof/pr-1/latest"]).id, "5");
  assert.equal(store.files["rules/2026-11.jsonl"].trim().split("\n").length, 5);
  assert.equal(await keepRecord(store, entry(5)), true);
  const conflict = entry(5);
  conflict.card.rules[0].reason = "different";
  assert.throws(() => recordsFiles(conflict, { tip: "", files: store.files }), /different content/);
});

test("recorder handles CI outcome rows, forks with a shared head, push, edits and records failures", async () => {
  const repo = await tmpRepo("verify-record");
  try {
    await repo.write("README.md", "baseline\n");
    repo.git(["add", "."]); repo.git(["commit", "-qm", "base"]);
    const base = repo.git(["rev-parse", "HEAD"]).trim();
    await repo.write("test/retry.test.ts", 'test("[AB-1] retry once", () => {});\n');
    repo.git(["add", "."]); repo.git(["commit", "-qm", "head"]);
    const head = repo.git(["rev-parse", "HEAD"]).trim();
    const run = { id: "42", attempt: 1, workflow: "Tenet tests", head, repository, startedAt: at };
    const event = { kind: "workflow_run", repository, run, base };
    const deps = {
      ...emptyDeps,
      policy: async () => policy,
      verifyLock: async () => {},
      touched: async () => [{ id: "R-1", why: "implements" }],
      specification: async () => ({ blessed: true, requirements: [
        { id: "R-1", excerpt: "Retry once.", state: "blessed", recorded: "self", flags: [], blessed_digest: "sha256:abc" },
      ], blessings_changed: [] }),
    };
    for (const [state, expected, reason] of [
      ["pass", "passed", undefined], ["missing", "not-run", "not checked: test report missing"],
      ["malformed", "not-run", "not checked: test report malformed"], ["skip", "skipped", undefined],
      ["exit", "passed", "check failed after its tests passed"], ["timeout", "not-run", "not checked: check timed out"],
      ["unavailable", "not-run", "not checked: 1 of 2 bundles unavailable"], ["refused", "not-run", "not checked: bundle refused (TN-RECORD-BUNDLE)"],
      ["lost-record", "passed", "results not kept"], ["fallback", "passed", "policy failed to load at head; using previous policy from base (tenet.yaml)"],
    ]) {
      const calls: string[] = [];
      const pull = (number: number) => ({ number, head, base, body });
      const options = {
        cwd: repo.path, now: () => new Date(at), version: "0.1.0-alpha.0", render: () => "card",
        checkout: async () => ({ cwd: repo.path, stale: false, close: async () => {} }),
        policyBlob: async () => base, previousBase: async () => head, waitForRetry: async () => {},
        forge: {
          findPullRequests: async () => [pull(1), pull(2)], getPullRequest: async (number: number) => pull(number),
          latestRun: async () => run,
          downloadBundles: async () => {
            if (state === "refused") throw new Error("invalid bundle");
            if (state === "unavailable") return { total: 2, missing: 1, bundles: [bundle(head, base)] };
            return { total: 1, missing: 0, bundles: [bundle(head, base, state)] };
          },
          upsertCheckRun: async (request: { head: string }) => { calls.push(request.head); },
        },
        records: state === "lost-record" ? { ...memoryStore(), write: async () => false } : memoryStore(),
      };
      const configured = state === "fallback" ? { ...deps, policy: async (ref: string) => { if (ref === base) throw new Error("policy"); return policy; } } : deps;
      const rows = await recordAll(event, configured, options);
      assert.equal(rows.length, 2, state);
      assert.ok(calls.every((sha) => sha === head));
      assert.notEqual(rows[0].card.evaluation_id, rows[1].card.evaluation_id);
      assert.equal(rows[0].card.items[0].result, expected, state);
      if (reason) assert.ok(rows[0].card.degraded.includes(reason), state);
      if (state === "pass") {
        const card = rows[0].card;
        assert.equal(rows[0].conclusion, "success");
        assert.equal(rows[0].wrote, true);
        const evalInput = { repository, work: "pr-1", tested_commit: head, base,
          acceptance_digest: card.acceptance_digest, implemented: [{ id: "R-1", blessed_digest: "sha256:abc" }],
          policy_blob: base, tenet_version: options.version };
        assert.equal(card.evaluation_id, sha256(jcs(evalInput)).slice(0, 16));
        assert.equal(evaluationId(evalInput), card.evaluation_id);
        const editedOptions = { ...options, forge: { ...options.forge, getPullRequest: async () => ({ ...pull(1), body: "## Acceptance\n- missing an ID\n" }) } };
        const [edited] = await recordAll({ kind: "edited", repository, number: 1 }, deps, editedOptions);
        assert.notEqual(edited.card.evaluation_id, card.evaluation_id);
        assert.match(edited.card.degraded[0], /Acceptance item needs an ID/);
        const pushedOptions = { ...options, forge: { ...options.forge, findPullRequests: async () => [] } };
        const [pushed] = await recordAll(event, deps, pushedOptions);
        assert.deepEqual(pushed.card.items, []);
        assert.ok(pushed.card.rules.some((rule: { reason: string }) => rule.reason === "no acceptance items"));
      }
    }
  } finally { await repo.cleanup(); }
});
