import assert from "node:assert/strict";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { tmpRepo, type TemporaryRepository } from "../helpers/tmpRepo.ts";
import { buildVerify, emptyDeps } from "./build.ts";
import type { ProofCard } from "../../src/types/generated.ts";
import type { BundleData, VerificationBundle } from "../../src/verify/bundle.ts";
import type { WorkflowRun, Conclusion } from "../../src/verify/forge.ts";

buildVerify(["src/specs/touched.ts", "src/specs/deltas.ts", "src/specs/parse.ts"]);
const { record, evaluationId } = await import("../../dist/verify/record.js");
const { renderCard, renderCheckSummary } = await import("../../dist/verify/card.js");
const { touched } = await import("../../dist/specs/touched.js");
const { deltas } = await import("../../dist/specs/deltas.js");
const { parseDoc } = await import("../../dist/specs/parse.js");
const { sectionDigest } = await import("../../dist/specs/sections.js");

type Tree = Record<string, string>;
type Input = {
  operation: string;
  event: {
    kind: "workflow_run";
    repository: string;
    run: WorkflowRun;
    pulls: [number];
    base: string;
    pr_body: string;
    commit_author?: string;
    records_push: "ok" | "failed";
    evaluation_input: Parameters<typeof evaluationId>[0];
  };
  bundles: Array<{ bundle: VerificationBundle; files: Tree; bundle_error?: string }>;
  repo: { baseFiles: Tree; headFiles: Tree; previousBaseFiles?: Tree };
};
type Expected = { ok: boolean; conclusion: Conclusion; wrote: boolean; card: ProofCard };

async function commitTree(repo: TemporaryRepository, before: Tree, after: Tree, label: string, author = "Tenet Test"): Promise<string> {
  for (const file of Object.keys(before)) {
    if (!Object.hasOwn(after, file)) await rm(path.join(repo.path, file));
  }
  for (const [file, text] of Object.entries(after)) await repo.write(file, text);
  repo.git(["add", "-A", "-f"]);
  repo.git(["-c", `user.name=${author}`, "commit", "--allow-empty", "-qm", label]);
  return repo.git(["rev-parse", "HEAD"]).trim();
}

function jsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function difference(actual: Buffer, expected: Buffer): string {
  const actualLines = actual.toString("utf8").split("\n");
  const expectedLines = expected.toString("utf8").split("\n");
  const length = Math.max(actualLines.length, expectedLines.length);
  for (let i = 0; i < length; i++) {
    if (actualLines[i] !== expectedLines[i]) return `line ${i + 1}: got ${actualLines[i]}, expected ${expectedLines[i]}`;
  }
  return "different byte encoding";
}

const suite = new URL("../../pkg/conformance/card/", import.meta.url);
const cases = (await readdir(suite, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map(({ name }) => name).sort();
assert.equal(cases.length, 14);

for (const name of cases) {
  test(`independent recorder JSON and Markdown · ${name}`, async (t) => {
    const dir = new URL(`${name}/`, suite);
    const input: Input = JSON.parse(await readFile(new URL("input.json", dir), "utf8"));
    const expectedJson = await readFile(new URL("expected.json", dir));
    const expected: Expected = JSON.parse(expectedJson.toString("utf8"));
    const expectedMarkdown = await readFile(new URL("expected.md", dir));
    const repo = await tmpRepo("card-replay");
    t.after(repo.cleanup);
    const { event, repo: trees } = input;
    const tuple = event.evaluation_input;
    assert.equal(input.operation, "record");
    const previous = trees.previousBaseFiles ? await commitTree(repo, {}, trees.previousBaseFiles, "previous base") : undefined;
    const base = await commitTree(repo, trees.previousBaseFiles ?? {}, trees.baseFiles, "base");
    const head = await commitTree(repo, trees.baseFiles, trees.headFiles, "tested", event.commit_author);
    const tested = await commitTree(repo, trees.headFiles, trees.headFiles, "merge candidate");
    const run = { ...event.run, head };
    const number = event.pulls[0];
    const pull = { number, head, base, body: event.pr_body };
    const bundles: BundleData[] = input.bundles.map(({ bundle, files }) => {
      assert.equal(bundle.tested.base, event.base);
      assert.equal(bundle.tested.head, event.run.head);
      assert.equal(bundle.tested.commit, tuple.tested_commit);
      const rebound = { ...bundle, tested: { ...bundle.tested, head, base, commit: bundle.tested.kind === "head" ? head : tested } };
      return { bundle: rebound, files: new Map([
        ["bundle.json", Buffer.from(JSON.stringify(rebound))],
        ...Object.entries(files).map(([file, data]): [string, Buffer] => [file, Buffer.from(data)]),
      ]) };
    });
    let writes = 0;
    const result = await record({ kind: event.kind, repository: event.repository, run, pulls: event.pulls, base }, {
      ...emptyDeps, touched, deltas, parseDoc, sectionDigest,
      // No test repository includes tenet.lock. Keep policy parsing and
      // fallback real, and replace just the external installation check.
      verifyLock: async () => {},
    }, {
      cwd: repo.path,
      version: tuple.tenet_version,
      now: () => new Date(run.startedAt),
      render: renderCheckSummary,
      checkout: async () => ({ cwd: repo.path, stale: false, close: async () => {} }),
      waitForRetry: async () => {},
      forge: {
        getPullRequest: async () => pull,
        findPullRequests: async () => [pull],
        latestRun: async () => run,
        downloadBundles: async () => {
          const refusal = input.bundles.find((entry) => entry.bundle_error)?.bundle_error;
          if (refusal) throw new Error(refusal);
          return { bundles, total: bundles.length, missing: 0 };
        },
        upsertCheckRun: async () => {},
      },
      records: {
        read: async () => ({ tip: null, files: {} }),
        write: async () => { writes++; return event.records_push === "ok"; },
      },
    });
    assert.ok(writes > 0);
    assert.equal(result.card.tested.base, base);
    assert.equal(result.card.tested.head, head);
    const labels = new Map([[base, event.base], [head, event.run.head], [tested, tuple.tested_commit]]);
    assert.ok(labels.has(result.card.tested.commit), "record selected a materialized subject");

    // Verify identity in both namespaces. An output ID can be relabeled
    // only if it is the canonical ID of the materialized input tuple.
    const { card, conclusion, wrote } = result;
    if (input.bundles.some(({ bundle_error }) => bundle_error)) {
      assert.equal(card.tested.kind, "head", "a refused bundle falls back to the PR head");
      assert.equal(card.tested.commit, head);
    }
    const realTupleId = evaluationId({
      ...tuple, tested_commit: card.tested.commit, base,
      policy_blob: repo.git(["rev-parse", `${previous ?? base}:tenet.yaml`]).trim(),
    });
    const tupleId = evaluationId(tuple);
    const labeledCard = {
      ...card,
      evaluation_id: card.evaluation_id === realTupleId ? tupleId : card.evaluation_id,
      tested: { ...card.tested, commit: labels.get(card.tested.commit), head: event.run.head, base: event.base },
    };
    const actualJson = jsonBytes({ ok: true, conclusion, wrote, card: labeledCard });
    const actualMarkdown = Buffer.from(renderCard(labeledCard));
    const jsonMismatch = !actualJson.equals(expectedJson);
    const markdownMismatch = !actualMarkdown.equals(expectedMarkdown);
    const failures = [
      ...(card.evaluation_id !== realTupleId ? [`recorded evaluation ID ${card.evaluation_id} differs from materialized input tuple ${realTupleId}`] : []),
      ...(tupleId !== expected.card.evaluation_id ? [`input tuple hashes to ${tupleId}, golden expects ${expected.card.evaluation_id}`] : []),
      ...(jsonMismatch ? [`JSON ${difference(actualJson, expectedJson)}`] : []),
      ...(markdownMismatch ? [`Markdown ${difference(actualMarkdown, expectedMarkdown)}`] : []),
    ];
    assert.deepEqual(failures, []);
  });
}
