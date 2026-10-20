// `decide dependency`: one governed flow that verifies before anything installs (SEC-05, TS §9.11). Resolve without installing
// (a remote read that writes only package.json and the lockfile), check the diff against the policy, preview, and install only
// after the answer. A rejected or failed check restores both files if they still equal what the resolution wrote.
// Only npm is built: a pnpm or Yarn project is refused, because an npm check is not a stand-in for theirs.
import { z } from "zod";
import { diffLockfile, judgeDependencies } from "../core/dependencies.ts";
import type { Issue, Judgement, Observation } from "../core/dependencies.ts";
import { KernelError } from "../core/errors.ts";
import { sha256 } from "../core/ids.ts";
import { reason } from "../core/reasons.ts";
import { assistanceLevel } from "../core/risk.ts";
import type { Question, State, WorkContract } from "../core/schemas.ts";
import type { Job, Plan } from "../pipeline.ts";
import type { Ports } from "../ports/types.ts";
import { factsHash, nx, question, readinessOf, withWork } from "../verbs/common.ts";
import { settingsFor } from "../verbs/reconcile.ts";
import type { Decision, DecisionCtx } from "./types.ts";

const MANIFEST = "package.json";
const LOCK = "package-lock.json";
const TIMEOUT_MS = 10 * 60_000;
const MAX_LOOKUPS = 50;
const DAY = 864e5;
const SPEC_RE = /^@?[a-z0-9][a-z0-9._~-]*(\/[a-z0-9._~-]+)?(@[A-Za-z0-9.^~<>=*|-]+)?$/i;
const Body = z.object({
  specs: z.array(z.string().regex(SPEC_RE, "not a registry package spec")).min(1).max(10),
  urgent: z.boolean().default(false),
});
const nameOf = (id: string) => id.slice(0, id.lastIndexOf("@"));

export interface DependencyOp {
  work: string;
  phase: "resolve" | "install";
  before?: { manifest: string | null; lock: string | null };
  scripts?: string[];
}

export function restoreFiles(ports: Ports, before: { manifest: string | null; lock: string | null }): void {
  for (const [file, blob] of [[MANIFEST, before.manifest], [LOCK, before.lock]] as const) {
    if (blob === null) ports.project.remove([file]);
    else ports.project.write(file, ports.store.readBlob(blob) ?? "");
  }
}

/** Runs outside the lock, like every job that spawns a process (TS §7.3). */
function jobFor(
  c: DecisionCtx,
  op: Omit<DependencyOp, "work">,
  execute: (runDir: string) => Promise<unknown>,
  finalize: (tx: DecisionCtx["tx"], runId: string, st: State, cw: WorkContract, result: unknown) => Promise<{ state: State; resp: Plan["resp"] }>,
): Plan {
  const { ports, tx, state, work } = c;
  const runId = `${work.label}-d${ports.rand.base32(5)}`;
  const runDir = ports.store.tempDir(`run-${runId}`);
  const now = ports.clock.now();
  tx.intent("dependency", runId, { work: work.id, ...op });
  const inCall = { runId, ...ports.store.self(), verb: "dependency", since: now, runDir };
  const w = { ...work, updatedAt: now, session: { ...work.session, inCall } };
  const job: Job = {
    id: runId,
    execute: () => execute(runDir),
    async finalize(tx2, st, result) {
      const cw = st.work[work.id]!;
      return finalize(tx2, runId, st, { ...cw, session: { generation: cw.session.generation } }, result);
    },
  };
  return { state: withWork(state, w), resp: { work: w.id, next: [] }, job };
}

const restore = (ports: Ports, dep: NonNullable<WorkContract["dependency"]>): boolean => {
  const now = ports.project.hashes([MANIFEST, LOCK]);
  if (now[MANIFEST] !== dep.after.manifest || now[LOCK] !== dep.after.lock) return false;
  restoreFiles(ports, dep.before);
  return true;
};

const previewQuestion = (dep: NonNullable<WorkContract["dependency"]>, obs: Observation[], removed: string[], j: Judgement): Question => {
  const lines = obs.slice(0, 8).map((o) => `${o.name}@${o.version}${o.previous ? ` (was ${o.previous})` : ""}${o.direct ? "" : ", transitive"}`);
  const notes = j.issues.filter((i) => i.severity !== "note").map((i) => i.message);
  const more = obs.length > 8 ? `; and ${obs.length - 8} more` : "";
  const dropped = removed.length ? `. It drops ${removed.slice(0, 4).join(", ")}` : "";
  const issueNotes = notes.length ? ` ${notes.join(". ")}.` : "";
  const scriptsHint = j.scripts.length ? ` To run an install script, name it: --answer dependency-scripts=${j.scripts.join(",")}.` : "";
  return question({
    id: "dependency-confirm",
    header: "Dependencies",
    bind: { factsHash: factsHash({ specs: dep.specs, after: dep.after }) },
    question: `Add ${dep.specs.join(", ")}? The lockfile changes ${obs.length} package${obs.length === 1 ? "" : "s"}: ${lines.join("; ")}${more}${dropped}.${issueNotes} package.json and the lockfile already hold the resolved versions; nothing is installed yet.${scriptsHint}`,
    options: [
      { label: "Yes, install them", description: "Install exactly the lockfile shown, with install scripts off.", recommended: j.verdict === "ok" },
      { label: "No, restore my files", description: "Put package.json and the lockfile back as they were; nothing is installed." },
    ],
  });
};

async function start(c: DecisionCtx): Promise<Plan> {
  const { ports, work, input } = c;
  if (!input.quote?.trim()) throw new KernelError("authority-needed", "a dependency change records the user's own words: pass them as the quote", { exit: 2 });
  const body = Body.safeParse(input.propose);
  if (!body.success) {
    throw new KernelError("restriction-key-unknown", `dependency: ${body.error.issues[0]!.message}; only registry package names with an optional version are accepted`, { exit: 2 });
  }
  const other = ports.project.hashes(["pnpm-lock.yaml", "yarn.lock"]);
  const manager = other["pnpm-lock.yaml"] ? "pnpm" : other["yarn.lock"] ? "yarn" : null;
  if (manager) throw new KernelError("capability-missing", `${manager} projects are not built; an npm check is not a stand-in for ${manager}'s`, { exit: 2 });
  if (work.dependency) throw new KernelError("continue-required", "a dependency change is waiting for your answer", { exit: 2 });
  const { specs, urgent } = body.data;
  const was = { manifest: ports.project.read(MANIFEST), lock: ports.project.read(LOCK) };
  const before = {
    manifest: was.manifest === null ? null : ports.store.putBlob(was.manifest),
    lock: was.lock === null ? null : ports.store.putBlob(was.lock),
  };

  return jobFor(
    c,
    { phase: "resolve", before },
    async (runDir) => {
      const r = await ports.runner.run({ argv: ["npm", "install", "--package-lock-only", "--ignore-scripts", ...specs], cwd: ports.root, runDir, timeoutMs: TIMEOUT_MS });
      if (r.exit !== 0) return { failed: (r.stderr || r.stdout).trim().split("\n").slice(-4).join("\n") };
      const after = { manifest: ports.project.read(MANIFEST) ?? "", lock: ports.project.read(LOCK) ?? "" };
      let diff;
      try {
        diff = diffLockfile(was.lock, after.lock);
      } catch (e) {
        return { failed: (e as Error).message, after };
      }
      const ages: Record<string, number | undefined> = {};
      for (const o of [...diff.added, ...diff.changed].filter((x) => x.source === "registry").slice(0, MAX_LOOKUPS)) {
        const v = await ports.runner.run({ argv: ["npm", "view", `${o.name}@${o.version}`, "time", "--json"], cwd: ports.root, runDir, timeoutMs: 60_000 });
        try {
          const t = (JSON.parse(v.stdout) as Record<string, string>)[o.version];
          if (t) ages[`${o.name}@${o.version}`] = Math.floor((Date.now() - Date.parse(t)) / DAY);
        } catch { /* unknown age stays unknown */ }
      }
      return { diff, ages, after };
    },
    async (tx2, runId, st, cw, result) => {
      const r = result as { failed?: string; error?: string; diff?: ReturnType<typeof diffLockfile>; ages?: Record<string, number | undefined>; after?: { manifest: string; lock: string } };
      const done = withWork(st, cw);
      const dep = r.after
        ? { specs, urgent, quote: input.quote!.slice(0, 200), scripts: [] as string[], before, after: { manifest: sha256(r.after.manifest), lock: sha256(r.after.lock) } }
        : undefined;
      if (r.failed || r.error || !r.diff || !dep) {
        restoreFiles(ports, before);
        tx2.result("dependency", runId, { completed: false });
        const msg = r.failed ?? r.error ?? "no result";
        return {
          state: done,
          resp: { work: cw.id, exit: 2, reasons: [reason("install-failed", `resolving ${specs.join(", ")}: ${msg}; your files are as they were`)], next: [nx("reconcile", "Fix the cause (network, spelling of the package), then ask again.", true)] },
        };
      }
      const obs = [...r.diff.added, ...r.diff.changed];
      const policy = settingsFor(ports, st, cw).dependency_policy as { min_release_age_days: number; urgent_exception: "allow" | "require-approval" | "deny"; unknown_age: "allow" | "require-approval" | "deny" };
      const j = judgeDependencies(obs, r.ages ?? {}, { policy, urgent });
      if (j.verdict === "blocked") {
        const why = j.issues.filter((i: Issue) => i.severity === "blocked").map((i) => i.message).join("; ");
        const restored = restore(ports, dep);
        tx2.result("dependency", runId, { completed: false });
        return {
          state: done,
          resp: { work: cw.id, exit: 2, reasons: [reason("dependency-rejected", `${why}${restored ? "" : "; the files changed meanwhile, so I left them"}`)], next: [nx("reconcile", "Choose another package or version, or change the policy yourself.", true)] },
        };
      }
      tx2.result("dependency", runId, { completed: true });
      const full = { ...dep, scripts: j.scripts };
      const q = previewQuestion(full, obs, r.diff.removed, j);
      return {
        state: withWork({ ...st, pending: [...st.pending.filter((p) => p.id !== q.id), q] }, { ...cw, dependency: full }),
        resp: { work: cw.id, exit: 3, questions: [q], next: [nx("ask", "Ask the user, then answer with --answer dependency-confirm=confirm or decline.", true)] },
      };
    },
  );
}

function settle(c: DecisionCtx): Plan {
  const { ports, state, work, input } = c;
  const dep = work.dependency;
  if (!dep) throw new KernelError("continue-required", "no dependency change is waiting for an answer", { exit: 2 });
  const rest = state.pending.filter((q) => q.id !== "dependency-confirm");
  const answer = input.answers?.["dependency-confirm"];
  const { dependency: _gone, ...cleared } = work;
  if (answer === "decline") {
    const restored = restore(ports, dep);
    const note = restored ? "declined; package.json and the lockfile are as they were" : "declined; the files changed meanwhile, so I left them";
    return { state: withWork({ ...state, pending: rest }, cleared), resp: { work: work.id, reasons: [reason("dependency-rejected", note, { note: true })], next: [] } };
  }
  if (answer !== "confirm") throw new KernelError("revision-conflict", 'answer "confirm" or "decline"', { exit: 1 });
  const here = ports.project.hashes([MANIFEST, LOCK]);
  const waiting = state.pending.find((q) => q.id === "dependency-confirm");
  if (here[MANIFEST] !== dep.after.manifest || here[LOCK] !== dep.after.lock) {
    return {
      resp: {
        work: work.id,
        exit: 3,
        ...(waiting ? { questions: [waiting] } : {}),
        reasons: [reason("revision-conflict", "package.json or the lockfile changed after the preview; decline to restore them, or ask for the change again")],
        next: [nx("ask", "Ask again.", true)],
      },
    };
  }
  const approved = (input.answers?.["dependency-scripts"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const unknown = approved.filter((s) => !dep.scripts.includes(s));
  if (unknown.length) throw new KernelError("restriction-key-unknown", `${unknown.join(", ")} was not named by the preview; its scripts need their own consent`, { exit: 2 });

  return jobFor(
    c,
    { phase: "install", scripts: approved },
    async (runDir) => {
      const run = (argv: string[]) => ports.runner.run({ argv, cwd: ports.root, runDir, timeoutMs: TIMEOUT_MS });
      const ci = await run(["npm", "ci", "--ignore-scripts"]);
      if (ci.exit !== 0) return { failed: `npm ci: ${(ci.stderr || ci.stdout).trim().split("\n").slice(-4).join("\n")}` };
      for (const id of approved) {
        const r = await run(["npm", "rebuild", nameOf(id)]);
        if (r.exit !== 0) return { failed: `npm rebuild ${nameOf(id)}: ${(r.stderr || r.stdout).trim().split("\n").slice(-3).join("\n")}` };
      }
      return { ok: true };
    },
    async (tx2, runId, st, cw, result) => {
      const r = result as { ok?: boolean; failed?: string; error?: string };
      tx2.result("dependency", runId, { completed: !!r.ok });
      if (!r.ok) {
        const msg = r.failed ?? r.error ?? "no result";
        return {
          state: withWork(st, { ...cw, dependency: dep }),
          resp: { work: cw.id, exit: 2, reasons: [reason("install-failed", `${msg}; the files are as resolved, and answering again retries`)], next: [nx("reconcile", "Fix the cause, then answer again.", true)] },
        };
      }
      const g = { id: `GR-${cw.grants.length + 1}`, actions: ["dependency" as const], paths: [MANIFEST, LOCK], source: "decide" as const, capture: "reported" as const, quote: dep.quote, bind: { factsHash: factsHash(dep.after) } };
      const { dependency: _d, ...bare } = cw;
      const touched = [MANIFEST, LOCK].filter((f) => !bare.touched.some((t) => t.path === f)).map((path) => ({ path }));
      const probe = await ports.git.probe();
      const level = assistanceLevel(readinessOf(ports, probe), bare.profile).level;
      return {
        state: withWork({ ...st, pending: st.pending.filter((q) => q.id !== "dependency-confirm") }, { ...bare, grants: [...bare.grants, g], touched: [...bare.touched, ...touched], level }),
        resp: { work: cw.id, next: [nx("check", "Run the checks with the new dependencies.", true)], data: { installed: dep.specs, scripts: approved } },
      };
    },
  );
}

export const dependency: Decision = {
  kind: "dependency",
  run: (c) => (c.input.answers?.["dependency-confirm"] !== undefined ? settle(c) : start(c)),
};
