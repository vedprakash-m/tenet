// After `.tenet/` is lost (CON-07): recover only inert intent from bounded repository records.
import { KernelError } from "../core/errors.ts";
import { reason } from "../core/reasons.ts";
import { recoverIntent } from "../core/reconstruct.ts";
import { ADOPTED_FILES } from "../core/residue.ts";
import type { Reason, State } from "../core/schemas.ts";
import type { Ports } from "../ports/types.ts";
import type { Plan } from "../pipeline.ts";
import { factsHash, nx, question } from "../verbs/common.ts";
import { INTENT_FILE } from "./adopt.ts";
import type { DecisionCtx } from "./types.ts";
import { repositoryRecords, unique } from "./reconstruction-repository.ts";
import type { RepositoryRecords } from "./reconstruction-repository.ts";

export const NOT_RECOVERED = [
  "grants, consents and approvals", "check receipts and results", "review judgments",
  "acceptance-test lock support inputs and history",
  "adoption of INTENT.md and tenet.policy.json (adopt them again)", "work contracts, their budgets and states",
  "verification links, test files and support files of requirements and examples", "which requirements a plan item covers",
  "plan item states (each starts as proposed)", "the user's own words behind decisions",
];

type Read = Extract<ReturnType<typeof recoverIntent>, { ok: true }>;
const testHash = (file: string, hash: string) => factsHash({ file, hash });
const intentText = (ports: Ports): string | null => {
  const r = ports.project.readBounded(INTENT_FILE, 1024 * 1024);
  return r.status === "available" ? r.text : null;
};
const binding = (r: Read, repository: RepositoryRecords) =>
  factsHash({ reconstruction: r.intent, repository });
const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

function reviewQuestion(r: Read, labels: string[], repository: RepositoryRecords) {
  const els = r.intent.elements;
  const shown = [...els, ...r.intent.plan]
    .slice(0, 5)
    .map((e) => `${e.id}: ${"text" in e ? e.text : e.outcome}`);
  const what = [
    count(els.filter((e) => e.kind === "requirement").length, "requirement"),
    count(r.intent.plan.length, "plan item"),
    count(els.filter((e) => e.kind === "decision").length, "decision"),
    count(els.length, "intent element"),
  ].join(", ");
  return question({
    id: "reconstruction-review",
    header: "Local records missing",
    channel: "chat",
    bind: { factsHash: binding(r, repository) },
    question: `Tenet's local records aren't here (fresh clone or deleted). ${INTENT_FILE} still shows ${what}`
      + `${r.intent.overview.purpose ? " and the project overview" : ""}`
      + `${labels.length ? `; Git history shows work ${labels.join(", ")}` : ""}`
      + `${repository.ids.length ? `; ${repository.ids.length} recovered repository IDs` : ""}.`
      + ` For example: ${shown.join("; ")}. Use them as the project's intent? No old approvals, results or locks are assumed.`,
    options: [
      { label: "Use these records", description: "Load them as unadopted intent; nothing is written to the project or Git.",
        recommended: true },
      { label: "Start fresh", description: `Keep an empty intent; ${INTENT_FILE} stays as it is.` },
    ],
  });
}

function lockQuestion(repository: RepositoryRecords) {
  return question({
    id: "reconstruction-lock",
    header: "Recovered lock preview",
    channel: "chat",
    bind: { factsHash: lockBinding(repository) },
    question: `Restore ${count(repository.locks.length, "acceptance-test lock")} `
      + `from the @tenet tags in current committed files? ${repository.locks
        .slice(0, 3).map((item) => `${item.id}: ${item.path}`).join("; ")}.`
      + " No support files, prior reviews, grants or test results are restored.",
    options: [
      { label: "Confirm these locks", description: "Bind the current committed test hashes as reconstructed locks.", recommended: true },
      { label: "Keep no restored locks", description: "Keep the recovered IDs only; future checks have no acceptance-test lock." },
    ],
  });
}

export async function recoveredContext(ports: Ports) {
  const text = intentText(ports);
  const intent = text === null ? null : recoverIntent(text);
  const probe = await ports.git.probe();
  const history = probe.isRepo && !probe.shadow ? await ports.git.tenetHistory() : null;
  const repository = await repositoryRecords(ports);
  return { intent, history, repository };
}

export async function offerReconstruction(ports: Ports, state: State): Promise<{ state: State; reasons: Reason[] }> {
  const { intent: r, history, repository } = await recoveredContext(ports);
  const read = r?.ok ? r : (r === null && repository.ids.length ? recoverIntent("") as Read : null);
  const labels = Object.keys(history?.labels ?? {}).sort();
  const marks = r && (!r.ok || r.ids.length || r.skipped.length);
  if (!marks && !labels.length && !history?.unmerged.length && !repository.ids.length) return { state, reasons: [] };
  const files = ADOPTED_FILES.filter((f) => ports.project.exists(f));
  const high = Math.max(state.workSeq, ...labels.map((l) => Number(l.slice(2))));
  const facts = [
    `present: ${files.join(", ") || "no shared files"}`,
    labels.length
      ? `work in Git history: ${labels.map((l) => `${l} (${count(history!.labels[l]!, "commit")})`).join(", ")}`
      : "",
    history?.unmerged.length
      ? `unmerged work branches: ${history.unmerged.join(", ")}; their contracts are lost, open new work on one to continue it`
      : "",
    history?.shallow ? "history is shallow, so older work labels may be missing" : "",
    r?.ok && r.skipped.length
      ? `blocks not recovered because their text does not match what Tenet writes: ${r.skipped.join(", ")}`
      : "",
    repository.ids.length ? `recovered repository IDs: ${repository.ids.join(", ")}` : "",
    `not recoverable: ${NOT_RECOVERED.join("; ")}`,
  ].filter(Boolean).join(". ");
  const reasons = [reason("reconstructed-from-repository", `Tenet's local records were missing. ${facts}.`, { note: true })];
  if (r && !r.ok) reasons.push(reason("intent-markers-invalid", `${INTENT_FILE} ${r.where}; nothing was recovered`, { note: true }));
  const ask = read ? [reviewQuestion(read, labels, repository)] : [];
  return { state: { ...state, workSeq: high, pending: [...state.pending, ...ask] }, reasons };
}

export const reconstructionSurface = (state: State) => {
  const q = state.pending.find((candidate) =>
    candidate.id === "reconstruction-review" || candidate.id === "reconstruction-lock"
  );
  return q ? { exit: 3 as const, questions: [q] } : {};
};

const lockBinding = (repository: RepositoryRecords) => testHash(
  repository.locks.map((item) => `${item.id}:${item.path}`).join("\n"),
  factsHash(repository.locks),
);

async function reviewLock(
  ports: Ports, state: State, work: DecisionCtx["work"], input: DecisionCtx["input"],
): Promise<Plan | undefined> {
  const pendingLock = state.pending.find((q) => q.id === "reconstruction-lock");
  if (!pendingLock) return undefined;
  const proposal = state.project.reconstructed?.lockProposal ?? [];
  const answer = input.answers?.["reconstruction-lock"];
  if (answer !== "confirm" && answer !== "decline") {
    throw new KernelError("revision-conflict", 'answer "confirm" or "decline"', { exit: 1 });
  }
  const rest = state.pending.filter((q) => q.id !== "reconstruction-lock");
  const repository = (await recoveredContext(ports)).repository;
  if (answer === "decline") {
    return {
      state: {
        ...state, pending: rest,
        project: {
          ...state.project,
          reconstructed: state.project.reconstructed
            ? { ...state.project.reconstructed, lockProposal: undefined }
            : undefined,
        },
      },
      resp: {
        work: work.id, data: { reconstructed: true, lockCount: 0 },
        next: [nx(work.profile === "plan" ? "plan" : work.profile === "investigate" ? "research" : "basis", "Continue with the request.")],
      },
    };
  }
  const facts = lockBinding(repository);
  if (!proposal.length || pendingLock.bind.factsHash !== facts || JSON.stringify(repository.locks) !== JSON.stringify(proposal)) {
    const nextQuestion = repository.locks.length ? lockQuestion(repository) : undefined;
    const reconstructed = state.project.reconstructed
      ? {
          ...state.project.reconstructed,
          lockProposal: repository.locks.length ? repository.locks : undefined,
        }
      : undefined;
    return {
      state: {
        ...state, pending: nextQuestion ? [...rest, nextQuestion] : rest,
        project: { ...state.project, reconstructed },
      },
      resp: {
        work: work.id,
        ...(nextQuestion ? { exit: 3 as const, questions: [nextQuestion] } : {}),
        reasons: [reason("revision-conflict", "the reconstructed lock preview changed; no lock was restored", { note: true })],
        next: [nx(nextQuestion ? "ask" : "basis", nextQuestion ? "Review the refreshed lock preview." : "Continue with the request.")],
      },
    };
  }
  const locks = [...state.locks, ...proposal.map((item) => ({
    path: item.path, hash: item.hash, obligation: `OB-${item.id}`,
    anchor: { commit: item.commit }, supportInputs: {},
  }))];
  return {
    state: { ...state, pending: rest, locks },
    resp: {
      work: work.id,
      data: { reconstructed: true, lockCount: proposal.length },
      next: [nx(work.profile === "plan" ? "plan" : work.profile === "investigate" ? "research" : "basis", "Continue with the request.")],
    },
  };
}

export async function reviewReconstruction({ ports, state, work, input }: DecisionCtx) {
  const locks = await reviewLock(ports, state, work, input);
  if (locks) return locks;
  const pending = state.pending.find((q) => q.id === "reconstruction-review");
  if (!pending) throw new KernelError("revision-conflict", "there is no question about recovered records", { exit: 2 });
  const answer = input.answers?.["reconstruction-review"];
  if (answer !== "use" && answer !== "fresh") {
    throw new KernelError("revision-conflict", 'answer "use" or "fresh"', { exit: 1 });
  }
  const rest = state.pending.filter((q) => q.id !== "reconstruction-review");
  const next = nx(
    work.profile === "plan" ? "plan" : work.profile === "investigate" ? "research" : "basis",
    "Continue with the request.",
  );
  const declined = { work: work.id, next: [next], data: { reconstructed: false } };
  const recovered = await recoveredContext(ports);
  if (answer === "fresh") {
    const ids = recovered.repository.ids;
    const reconstructed = ids.length
      ? { at: ports.clock.now(), elementIds: ids, notRecovered: NOT_RECOVERED }
      : state.project.reconstructed;
    return {
      state: { ...state, pending: rest, project: { ...state.project, reconstructed } },
      resp: declined,
    };
  }
  const r = recovered.intent?.ok
    ? recovered.intent
    : (recovered.intent === null && recovered.repository.ids.length ? recoverIntent("") as Read : null);
  if (!r?.ok || binding(r, recovered.repository) !== pending.bind.factsHash) {
    const again = r?.ok && r.ids.length ? [reviewQuestion(r, [], recovered.repository)] : [];
    const why = `${INTENT_FILE} changed since the question; nothing was recovered`;
    const ask = again.length ? { exit: 3 as const, questions: again } : {};
    const resp = { ...declined, ...ask, reasons: [reason("revision-conflict", why, { note: true })] };
    return { state: { ...state, pending: [...rest, ...again] }, resp };
  }
  const intent = { ...r.intent, revision: state.project.intent.revision + 1 };
  const elementIds = unique([...r.ids, ...recovered.repository.ids]);
  const reconstructed = {
    at: ports.clock.now(), elementIds, notRecovered: NOT_RECOVERED,
    ...(recovered.repository.locks.length ? { lockProposal: recovered.repository.locks } : {}),
  };
  const lockQuestions = recovered.repository.locks.length ? [lockQuestion(recovered.repository)] : [];
  const nextState = {
    ...state, pending: [...rest, ...lockQuestions],
    project: { ...state.project, intent, reconstructed },
  };
  if (lockQuestions.length) {
    return {
      state: nextState,
      resp: {
        ...declined, exit: 3, questions: lockQuestions,
        data: { reconstructed: true, elementIds, notRecovered: NOT_RECOVERED, adopted: false },
      },
    };
  }
  return {
    state: nextState,
    resp: { ...declined, data: { reconstructed: true, elementIds, notRecovered: NOT_RECOVERED, adopted: false } },
  };
}
