import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import picomatch from "picomatch";
import { parseDocument } from "yaml";
import { catFileBatch, git } from "../core/git.js";
import { jcs, sha256 } from "../core/hash.js";
import { loadPolicy, verifyLock, type Policy } from "../policy/index.js";
import { declaredTags, itemResults, parseAcceptance, weakening, type TestReport } from "../reports/index.js";
import type { Finding, ProofCard } from "../types/generated.js";
import { decodeBundle, mergeMatrix, parseBundledReport, refusedBundle, safeEntry,
  type BundleData, type CheckEntry, type ParsedSpecification, type Subject, type VerificationBundle, type VerifyDeps } from "./bundle.js";
import type { Conclusion, ForgeAdapter, PullRequest, WorkflowRun } from "./forge.js";
import { keepRecord, type RecordsStore } from "./records.js";

export type VerifyEvent =
  | { kind: "workflow_run"; repository: string; run: WorkflowRun; pulls?: number[]; base?: string }
  | { kind: "edited"; repository: string; number: number };
export type CardResult = { card: ProofCard; conclusion: Conclusion; wrote: boolean };
type Evaluation = CardResult & { work: string; run: WorkflowRun | null; rules: ProofCard["rules"] };
type Subjects = { cwd: string; stale: boolean; close(): Promise<void> };
export type RecordOptions = {
  cwd: string;
  forge: ForgeAdapter;
  records: RecordsStore;
  now: () => Date;
  render(model: ProofCard, limit?: number): string;
  checkout?: (tested: VerificationBundle["tested"], checkout: { cwd: string; number?: number }) => Promise<Subjects>;
  policyBlob?: (base: string, cwd: string) => Promise<string>;
  version: string;
  previousBase?: (base: string, cwd: string) => Promise<string>;
  waitForRetry?: () => Promise<unknown>;
};

const emptySubject: Subject = { blessed: false, requirements: [], protected: [], workflow_changed: false, blessings_changed: [] };
const noTests = { expected: 0, passed: 0, failed: 0, skipped: 0, not_run: 0 };
const rules = ["tests-not-weakened", "protected-surfaces", "acceptance-passed", "citations-valid", "budget"] as const;
const defaultProtected = [
  "tenet.yaml", "tenet.lock", "CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS",
  ".github/workflows/tenet.yml", ".github/workflows/tenet-tests.yml",
];

export function evaluationId(input: {
  repository: string; work: string; tested_commit: string; base: string; acceptance_digest: string;
  implemented: Array<{ id: string; blessed_digest: string }>; policy_blob: string; tenet_version: string;
}): string {
  return sha256(jcs(input)).slice(0, 16);
}

function commit(value: string): string {
  if (!/^[0-9a-f]{40,64}$/.test(value)) throw new Error("invalid tested revision");
  return value;
}

async function checkoutTested(tested: VerificationBundle["tested"], options: { cwd: string; number?: number }): Promise<Subjects> {
  const cwd = options.cwd;
  const oid = commit(tested.commit);
  const args = ["fetch", "--no-tags", "--filter=blob:none", "origin"];
  let stale = false;
  if (options.number !== undefined) {
    const head = `refs/pull/${options.number}/head`;
    const merge = `refs/pull/${options.number}/merge`;
    try {
      await git([...args, head, merge], { cwd });
      const refs = await git(["ls-remote", "origin", merge], { cwd });
      stale = tested.kind === "merge-candidate" && refs.split(/\s+/)[0] !== oid;
    } catch {
      await git([...args, head], { cwd });
      stale = tested.kind === "merge-candidate";
    }
  }
  for (const ref of [oid, commit(tested.base)]) {
    try { await git(["cat-file", "-e", `${ref}^{commit}`], { cwd }); }
    catch { await git([...args, ref], { cwd }); }
  }
  const root = await mkdtemp(path.join(tmpdir(), "tenet-tested-"));
  const worktree = path.join(root, "tree");
  const noHooks = ["-c", `core.hooksPath=${path.join(root, "no-hooks")}`];
  const close = async () => {
    await git([...noHooks, "worktree", "remove", "--force", worktree], { cwd }).catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  };
  try { await git([...noHooks, "worktree", "add", "--detach", worktree, oid], { cwd }); }
  catch (error) { await close(); throw error; }
  return { cwd: worktree, stale, close };
}

function verifiedBundles(data: BundleData[], run: WorkflowRun, base: string, workflow: string): BundleData[] {
  const shards = new Set<string>();
  return data.map(({ files }) => {
    const parsed = decodeBundle(files);
    const bundle = parsed.bundle;
    const shard = `${bundle.run.job}/${bundle.run.index}`;
    if (bundle["x-repository"] !== run.repository || bundle.run.id !== run.id || bundle.run.attempt !== run.attempt ||
        bundle.run.workflow !== workflow || run.workflow !== workflow || bundle.tested.head !== run.head ||
        bundle.tested.base !== base || shards.has(shard)) {
      throw new Error("bundle provenance or shard differs");
    }
    shards.add(shard);
    commit(bundle.tested.commit);
    if (bundle.tested.kind === "head" && bundle.tested.commit !== bundle.tested.head) throw new Error("tested head differs");
    return parsed;
  }).sort((a, b) => a.bundle.run.job.localeCompare(b.bundle.run.job) || a.bundle.run.index - b.bundle.run.index);
}

async function readEvidence(bundles: BundleData[], policy: Policy, proposed?: Policy["checks"]) {
  const reports: TestReport[] = [];
  let missing = false;
  let malformed = false;
  let checkFailedAfterPass = false;
  let timedOut = false;
  const seen = new Set<string>();
  for (const { bundle, files } of bundles) {
    let count = 0;
    for (const check of bundle.checks) {
      seen.add(check.name);
      const pinned = policy.checks?.[check.name];
      const format = pinned?.report ?? (check["x-proposed"] ? proposed?.[check.name]?.report : undefined);
      if (check["x-proposed"] && pinned || !format ||
          check["x-report-kind"] !== undefined && check["x-report-kind"] !== format) {
        throw new Error("check is not in target policy or the proposed settings");
      }
      if (check.outcome === "timeout") timedOut = true;
      if (format === "none") continue;
      const contents = files.get(check.report);
      if (!contents) { missing = true; continue; }
      try {
        const report = await parseBundledReport(format, contents, policy.specs.id_prefix);
        count += report.cases.length;
        if (count > 20_000) throw new Error("bundle exceeds 20,000 cases");
        reports.push(report);
        const passing = report.cases.some((item) => item.status === "pass") &&
          !report.cases.some((item) => item.status === "fail" || item.status === "error");
        if (passing && (check.exit_code !== null && check.exit_code !== 0 || report.teardown_failed)) checkFailedAfterPass = true;
      } catch (error) {
        if (error instanceof Error && /nesting exceeds|exceeds 20,000/.test(error.message)) throw error;
        malformed = true;
      }
    }
  }
  missing ||= Object.keys(policy.checks ?? {}).some((name) => !seen.has(name));
  return { report: mergeMatrix(missing || malformed || timedOut ? [] : reports), missing, malformed, checkFailedAfterPass, timedOut };
}

type Evidence = Awaited<ReturnType<typeof readEvidence>>;
const noEvidence = (): Evidence => ({
  report: mergeMatrix([]), missing: true, malformed: false, checkFailedAfterPass: false, timedOut: false,
});

function fields(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
}

async function specifications(
  base: string, tested: string, policy: Policy, cwd: string, deps: VerifyDeps,
): Promise<Pick<Subject, "blessed" | "requirements" | "blessings_changed">> {
  const parse = deps.parseDoc;
  const digest = deps.sectionDigest;
  if (!parse || !digest) return { blessed: false, requirements: [], blessings_changed: [] };
  const parseOptions = { prefix: policy.specs.id_prefix };
  type Snapshot = {
    docs: Map<string, ParsedSpecification>;
    copies: Map<string, Buffer>;
  };
  async function read(ref: string): Promise<Snapshot> {
    const names = (await git(["ls-tree", "-r", "--name-only", "-z", ref], { cwd }))
      .split("\0").filter((name) => name.endsWith(".md"));
    const blobs = await catFileBatch(ref, names, { cwd });
    const docs = new Map<string, ParsedSpecification>();
    const copies = new Set<string>();
    for (const [filename, content] of blobs) {
      const doc = parse?.(filename, content.toString("utf8"), parseOptions);
      if (!doc || !fields(doc.front?.tenet).spec) continue;
      docs.set(filename, doc);
      for (const section of doc.sections) {
        if (section.state === "blessed" && section.blessed_copy) {
          try { copies.add(safeEntry(section.blessed_copy)); } catch { /* invalid blessed copy path */ }
        }
      }
    }
    return { docs, copies: await catFileBatch(ref, [...copies], { cwd }) };
  }

  const [before, after] = await Promise.all([read(base), read(tested)]);
  const requirements = new Map<string, Subject["requirements"][number]>();
  const blessings: Subject["blessings_changed"] = [];
  let blessed = false;
  for (const snapshot of [before, after]) {
    for (const [filename, doc] of snapshot.docs) {
      const sectionMetadata = fields(doc.front?.sections);
      for (const section of doc.sections) {
        if (section.state !== "blessed" || !section.blessed_copy || !section.blessed_digest) continue;
        const bytes = snapshot.copies.get(section.blessed_copy);
        if (!bytes || digest(bytes.toString("utf8")) !== section.blessed_digest) continue;
        if (snapshot === after) blessed = true;
        const metadata = fields(sectionMetadata[section.slug]);
        const recorded = metadata.recorded === "forge" || metadata.recorded === "signed" ? metadata.recorded : "self";
        const copy = parse(filename, bytes.toString("utf8"), parseOptions);
        for (const parsed of copy.sections) {
          for (const item of parsed.requirements) {
            requirements.set(item.id, {
              id: item.id, excerpt: item.text, state: "blessed", recorded, flags: section.flags,
              blessed_digest: section.blessed_digest,
            });
          }
        }
        if (snapshot === after && typeof metadata.blessed_by === "string") {
          const previous = fields(fields(before.docs.get(filename)?.front?.sections)[section.slug]);
          if (previous.blessed_digest !== section.blessed_digest || previous.blessed_by !== metadata.blessed_by ||
            previous.blessed_at !== metadata.blessed_at || previous.recorded !== metadata.recorded) {
            const author = await git(["log", "-1", "--format=%an", tested, "--", filename], { cwd });
            blessings.push({ doc: filename, section: section.slug, blessed_by: metadata.blessed_by, commit_author: author.trim() });
          }
        }
      }
    }
  }
  return { blessed, requirements: [...requirements.values()], blessings_changed: blessings };
}

async function changedSurfaces(tested: VerificationBundle["tested"], policy: Policy, cwd: string): Promise<Pick<Subject, "protected" | "workflow_changed">> {
  const workflow = policy.ci?.test_workflow;
  const files = (await git(["diff", "--name-only", "--no-renames", "-z", tested.base, tested.commit], { cwd })).split("\0").filter(Boolean);
  const workflowFiles = [".github/workflows/tenet-tests.yml", ".github/workflows/tenet.yml"];
  if (workflow?.endsWith(".yml") || workflow?.endsWith(".yaml")) workflowFiles.push(workflow.startsWith(".github/") ? workflow : `.github/workflows/${workflow}`);
  if (workflow && !workflow.endsWith(".yml") && !workflow.endsWith(".yaml")) {
    const paths = files.filter((file) => /^\.github\/workflows\/.+\.ya?ml$/.test(file));
    const snapshots = await Promise.all([tested.base, tested.commit].map((ref) => catFileBatch(ref, paths, { cwd })));
    for (const snapshot of snapshots) {
      for (const [filename, bytes] of snapshot) {
        if (bytes.length > 1024 * 1024) continue;
        const yaml = parseDocument(bytes.toString("utf8"));
        if (!yaml.errors.length && yaml.get("name") === workflow) workflowFiles.push(filename);
      }
    }
  }
  const protectedMatchers = [...new Set([...defaultProtected, ...workflowFiles, ...(policy.protect ?? [])])].map((glob) => picomatch(glob, { dot: true }));
  return {
    protected: files.filter((file) => protectedMatchers.some((matches) => matches(file))).sort(),
    workflow_changed: files.some((file) => workflowFiles.includes(file) && file !== ".github/workflows/tenet.yml"),
  };
}

function checkReasons(card: ProofCard, findings: Finding[], acceptanceProblems: string[], unavailable: boolean): ProofCard["rules"] {
  const failed = card.items.find((item) => item.result !== "passed");
  const acceptance = acceptanceProblems[0] ?? (!card.items.length ? "no acceptance items" :
    failed && (failed.result === "not-run" && card.tests.report !== "ok" ? `${failed.id} not run (report ${card.tests.report})` :
      failed.result === "not-run" && failed.tests.passed > 0 ? `${failed.id} coverage not confirmed` : `${failed.id} is ${failed.result}`));
  const reasons = [
    card.weakening.by[0] && `${card.weakening.by[0].finding} in ${card.weakening.by[0].file}`,
    card.protected.length ? `protected files modified: ${card.protected.join(", ")}` : undefined,
    unavailable ? undefined : acceptance,
    findings.find((finding) => finding.rule === "citations-valid")?.message,
    findings.find((finding) => finding.rule === "budget")?.message,
  ];
  return rules.map((rule, index) => ({ rule, mode: "advise", would_block: Boolean(reasons[index]), reason: reasons[index] ?? "" }));
}

function whyFor(card: ProofCard, host: string[]): ProofCard["why"] {
  return [
    ...(card.items.some((item) => item.result === "passed" && item.authorship === "written-here")
      ? [{ text: "tests written in this change require reviewer judgment", class: "judge" as const }] : []),
    ...card.weakening.not_checked.map((language) => ({ text: `${language} files not checked for test weakening`, class: "not-tenet" as const })),
    ...host.map((text) => ({ text, class: "host" as const })),
  ];
}

async function policyFor(base: string, deps: VerifyDeps, options: RecordOptions): Promise<{ policy: Policy; ref: string; warning?: string }> {
  const load = deps.policy ?? (async (ref, cwd) => {
    try { await git(["cat-file", "-e", `${ref}^{commit}`], { cwd }); }
    catch { await git(["fetch", "--no-tags", "--filter=blob:none", "origin", commit(ref)], { cwd }); }
    return loadPolicy({ ref, cwd });
  });
  const lock = deps.verifyLock ?? (async (ref, cwd) => { await verifyLock({ ref, cwd }); });
  const read = async (ref: string) => { const policy = await load(ref, options.cwd); await lock(ref, options.cwd); return policy; };
  try { return { policy: await read(base), ref: base }; }
  catch (error) {
    const previous = await (options.previousBase ?? (async (ref, cwd) => (await git(["rev-parse", `${ref}^`], { cwd })).trim()))(base, options.cwd);
    if (!previous) throw error;
    return { policy: await read(previous), ref: previous, warning: "policy failed to load at head; using previous policy from base (tenet.yaml)" };
  }
}

function proposedCheck(check: CheckEntry): boolean { return check["x-proposed"] === true; }

export async function record(event: VerifyEvent, deps: VerifyDeps, options: RecordOptions): Promise<CardResult> {
  const results = await recordAll(event, deps, options);
  const first = results[0];
  if (!first) throw new Error("no matching change");
  return first;
}

export async function recordAll(event: VerifyEvent, deps: VerifyDeps, options: RecordOptions): Promise<CardResult[]> {
  const { forge } = options;
  const prs = event.kind === "edited" ? [await forge.getPullRequest(event.number)] : event.pulls?.length
    ? await Promise.all([...new Set(event.pulls)].map((number) => forge.getPullRequest(number)))
    : await forge.findPullRequests(event.run.head);
  const candidates: Array<PullRequest | undefined> = event.kind === "edited" ? prs : prs.filter((pr) => pr.head === event.run.head);
  if (candidates.length === 0 && event.kind === "workflow_run" && !prs.length) candidates.push(undefined);
  const results: Evaluation[] = [];
  for (const pr of candidates) results.push(await evaluate(event, pr, deps, options));
  if (!results.length) return [];
  await publish(results, options);
  let lost = false;
  for (const result of results) {
    const { card, run } = result;
    if (!run) continue;
    try {
      result.wrote = await keepRecord(options.records, {
        work: result.work, run: { id: run.id, attempt: run.attempt }, startedAt: run.startedAt,
        at: options.now().toISOString(), card, rules: result.rules,
      }, options.waitForRetry);
    } catch { result.wrote = false; }
    if (!result.wrote) {
      lost = true;
      card.degraded.push("results not kept");
      card.why.push({ text: "results not kept", class: "host" });
      result.conclusion = "neutral";
    }
  }
  if (lost) await publish(results, options);
  return results.map(({ card, conclusion, wrote }) => ({ card, conclusion, wrote }));
}

async function publish(results: Evaluation[], options: RecordOptions): Promise<void> {
  const first = results[0];
  if (!first) return;
  const headings = results.map((result) => results.length > 1 ? `Pull request #${result.work.slice(3)}\n` : "");
  const overhead = headings.reduce((total, heading) => total + heading.length, 0) + results.length - 1;
  const budget = Math.floor((60_000 - overhead) / results.length);
  const summary = results.map((result, index) => (headings[index] ?? "") + options.render(result.card, budget)).join("\n");
  if (summary.length > 60_000) throw new RangeError("required proof details exceed the check summary limit");
  const conclusion = results.some((result) => result.conclusion === "failure") ? "failure" :
    results.some((result) => result.conclusion === "neutral") ? "neutral" : "success";
  await options.forge.upsertCheckRun({ head: first.card.tested.head, conclusion, summary });
}

async function evaluate(event: VerifyEvent, pr: PullRequest | undefined, deps: VerifyDeps, options: RecordOptions): Promise<Evaluation> {
  const { forge, cwd } = options;
  const head = commit(pr?.head ?? (event.kind === "workflow_run" ? event.run.head : ""));
  let run = event.kind === "workflow_run" ? event.run : null;
  let base = pr?.base ?? (event.kind === "workflow_run" ? event.base : undefined);
  let loaded = base ? await policyFor(commit(base), deps, options).catch(() => undefined) : undefined;
  const workflow = loaded?.policy.ci?.test_workflow ?? "Tenet tests";
  if (!run) run = await forge.latestRun(head, workflow);

  const host: string[] = [];
  let unavailable = false;
  let data: BundleData[] = [];
  if (!run) { unavailable = true; host.push("waiting for tests"); }
  else {
    try {
      if (run.repository !== event.repository || run.head !== head || (loaded && run.workflow !== workflow)) throw new Error("workflow does not match target policy");
      const downloaded = await forge.downloadBundles(run);
      if (downloaded.missing || !downloaded.total) {
        unavailable = true;
        host.push(downloaded.expiredAt && event.kind === "edited" ? `tests from ${downloaded.expiredAt} expired · push or re-run` :
          downloaded.total ? `not checked: ${downloaded.missing} of ${downloaded.total} bundles unavailable` : "waiting for tests");
      } else {
        base ??= downloaded.bundles[0]?.bundle.tested.base;
        if (!base) throw new Error("bundle has no target revision");
        loaded ??= await policyFor(commit(base), deps, options).catch(() => undefined);
        data = verifiedBundles(downloaded.bundles, run, base, loaded?.policy.ci?.test_workflow ?? "Tenet tests");
        const tested = data[0]?.bundle.tested;
        if (!tested || data.some((item) => jcs(item.bundle.tested) !== jcs(tested))) throw new Error("matrix tested different revisions");
      }
    } catch (error) {
      unavailable = true;
      data = [];
      const refused = refusedBundle(run.id, error instanceof Error ? error.message : "bundle unavailable");
      host.push(`not checked: bundle refused (${refused.code})`);
    }
  }

  const tested = data[0]?.bundle.tested ?? { commit: head, kind: "head", head, base: base ?? head } as const;
  const body = pr?.body ?? "";
  const acceptance = parseAcceptance(body);
  const problems = acceptance.problems.map((finding) => `${finding.code}: ${finding.message}`);
  let evidence = noEvidence();
  let subject = emptySubject;
  let reportFindings: Finding[] = [];
  let touched: Awaited<ReturnType<VerifyDeps["touched"]>> = [];
  let deltas: Awaited<ReturnType<VerifyDeps["deltas"]>> = [];
  let declared: Awaited<ReturnType<typeof declaredTags>> = { acceptance: {}, requirement: {} };
  let weakened: Awaited<ReturnType<typeof weakening>> = { found: false, by: [], notes: [], not_checked: [] };
  if (loaded?.warning) host.push(loaded.warning);
  if (!loaded) { unavailable = true; host.push("not checked: target policy or kit unavailable"); }
  if (loaded) {
    const { policy } = loaded;
    if (data.length) {
      try {
        const hasProposed = data.some(({ bundle }) => bundle.checks.some(proposedCheck));
        const read = deps.policy ?? ((ref, project) => loadPolicy({ ref, cwd: project }));
        const proposal = hasProposed && (policy.level === "observe" || policy.level === "protect")
          ? await read(tested.commit, cwd).catch(() => undefined) : undefined;
        evidence = await readEvidence(data, policy, proposal?.checks);
      }
      catch (error) {
        unavailable = true;
        const refused = refusedBundle(run?.id ?? "unknown", error instanceof Error ? error.message : "invalid reports");
        host.push(`not checked: bundle refused (${refused.code})`);
      }
    }
    if (evidence.timedOut) { unavailable = true; host.push("not checked: check timed out"); }
    let snapshot: Subjects | undefined;
    try {
      snapshot = await (options.checkout ?? checkoutTested)(tested, { cwd, ...(pr ? { number: pr.number } : {}) });
      if (snapshot.stale) host.push("merge-candidate-stale");
      const checked = await deps.check({ cwd: snapshot.cwd, ci: true, base: tested.base });
      reportFindings = checked.findings;
      [touched, deltas, declared, weakened] = await Promise.all([
        deps.touched(tested.base, tested.commit, acceptance.implements, { cwd: snapshot.cwd }),
        deps.deltas(tested.base, tested.commit, { cwd: snapshot.cwd }),
        declaredTags(tested.base, tested.commit, policy.specs.id_prefix, { cwd: snapshot.cwd }),
        weakening(tested.base, tested.commit, { cwd: snapshot.cwd }),
      ]);
      subject = {
        ...emptySubject,
        ...await (deps.specification ? deps.specification(tested.base, tested.commit, policy, snapshot.cwd)
          : specifications(tested.base, tested.commit, policy, snapshot.cwd, deps)),
        ...await changedSurfaces(tested, policy, snapshot.cwd),
      };
    } finally { await snapshot?.close(); }
  }

  if (!unavailable && evidence.missing) host.push("not checked: test report missing");
  if (!unavailable && evidence.malformed) host.push("not checked: test report malformed");
  if (!unavailable && !evidence.missing && !evidence.malformed && evidence.report.inconclusive) host.push("not checked: 0 test cases discovered");
  if (evidence.checkFailedAfterPass) host.push("check failed after its tests passed");
  if (data.some(({ bundle }) => bundle.checks.some(proposedCheck))) host.push("proposed check · approve tenet.yaml to pin");
  const work = pr ? `pr-${pr.number}` : "main";
  const policyBlob = loaded ? await (options.policyBlob ?? (async (ref, cwd) =>
    (await git(["rev-parse", `${ref}:tenet.yaml`], { cwd })).trim()))(loaded.ref, cwd) : "";
  const implemented = subject.requirements.filter((item) => acceptance.implements.includes(item.id))
    .map(({ id, blessed_digest }) => ({ id, blessed_digest })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const reports = evidence.report;
  const requirements = touched.flatMap(({ id, why }) => {
    const info = subject.requirements.find((item) => item.id === id);
    if (!info) return [];
    const { blessed_digest: _digest, ...description } = info;
    const result = itemResults([{ id }], reports, { acceptance: declared.requirement })[0];
    return [{ ...description, why, tests: result?.tests ?? noTests }];
  });
  const items = itemResults(acceptance.items, reports, declared).map(({ first_failure, ...item }) => ({
    id: item.id, text: acceptance.items.find((candidate) => candidate.id === item.id)?.text ?? "",
    result: unavailable || evidence.missing || evidence.malformed || evidence.report.inconclusive ? "not-run" as const : item.result,
    coverage: item.coverage, tests: item.tests, names: item.names, authorship: item.authorship,
    ...(first_failure ? { first_failure: first_failure.full_name } : {}),
  }));
  const failed = reports.cases.filter((item) => item.status === "fail" || item.status === "error");
  const card: ProofCard = {
    schema_version: 1,
    evaluation_id: evaluationId({
      repository: event.repository, work, tested_commit: tested.commit, base: tested.base,
      acceptance_digest: acceptance.digest, implemented, policy_blob: policyBlob, tenet_version: options.version,
    }),
    tested, acceptance_digest: acceptance.digest, requirements, items,
    tests: {
      report: evidence.malformed ? "malformed" : evidence.missing ? "missing" : "ok",
      total: reports.cases.length, passed: reports.cases.filter((item) => item.status === "pass").length,
      failed: failed.length, skipped: reports.cases.filter((item) => item.status === "skip").length, failing: failed.map((item) => item.full_name),
    },
    weakening: { found: weakened.found, by: weakened.by, not_checked: weakened.not_checked },
    workflow_changed: subject.workflow_changed, protected: subject.protected, blessings_changed: subject.blessings_changed,
    deltas: deltas.map(({ doc, added, modified, removed }) => ({ doc, added: added.length, modified: modified.length, removed: removed.length })),
    rules: [], badge: subject.blessed ? "advisory" : "intent-not-yet-blessed", why: [], degraded: [...problems, ...host],
  };
  const ruleOutcomes = checkReasons(card, reportFindings, problems, unavailable);
  card.rules = ruleOutcomes.filter((item) => item.would_block);
  card.why = whyFor(card, host);
  const conclusion: Conclusion = card.rules.length || card.degraded.length || card.tests.failed ? "neutral" : "success";
  return { card, conclusion, wrote: false, work, run, rules: ruleOutcomes };
}
