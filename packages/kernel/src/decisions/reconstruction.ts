// After `.tenet/` is lost (CON-07): recover only inert intent from bounded repository records.
import { KernelError } from "../core/errors.ts";
import { reason } from "../core/reasons.ts";
import { recoverIntent } from "../core/reconstruct.ts";
import { ADOPTED_FILES } from "../core/residue.ts";
import type { Reason, State } from "../core/schemas.ts";
import type { Ports } from "../ports/types.ts";
import { factsHash, nx, question } from "../verbs/common.ts";
import { INTENT_FILE } from "./adopt.ts";
import type { DecisionCtx } from "./types.ts";

export const NOT_RECOVERED = [
  "grants, consents and approvals", "check receipts and results", "review judgments", "locks on tests",
  "adoption of INTENT.md and tenet.policy.json (adopt them again)", "work contracts, their budgets and states",
  "verification links, test files and support files of requirements and examples", "which requirements a plan item covers",
  "plan item states (each starts as proposed)", "the user's own words behind decisions",
];

type Read = Extract<ReturnType<typeof recoverIntent>, { ok: true }>;
const intentText = (ports: Ports): string | null => {
  const r = ports.project.readBounded(INTENT_FILE, 1024 * 1024);
  return r.status === "available" ? r.text : null;
};
const binding = (r: Read) => factsHash({ reconstruction: r.intent });
const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

function reviewQuestion(r: Read, labels: string[]) {
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
    bind: { factsHash: binding(r) },
    question: `Tenet's local records aren't here (fresh clone or deleted). ${INTENT_FILE} still shows ${what}`
      + `${r.intent.overview.purpose ? " and the project overview" : ""}`
      + `${labels.length ? `; Git history shows work ${labels.join(", ")}` : ""}.`
      + ` For example: ${shown.join("; ")}. Use them as the project's intent? No old approvals, results or locks are assumed.`,
    options: [
      { label: "Use these records", description: "Load them as unadopted intent; nothing is written to the project or Git.",
        recommended: true },
      { label: "Start fresh", description: `Keep an empty intent; ${INTENT_FILE} stays as it is.` },
    ],
  });
}

export async function recoveredContext(ports: Ports) {
  const text = intentText(ports);
  const intent = text === null ? null : recoverIntent(text);
  const probe = await ports.git.probe();
  const history = probe.isRepo && !probe.shadow ? await ports.git.tenetHistory() : null;
  return { intent, history };
}

export async function offerReconstruction(ports: Ports, state: State): Promise<{ state: State; reasons: Reason[] }> {
  const { intent: r, history } = await recoveredContext(ports);
  const labels = Object.keys(history?.labels ?? {}).sort();
  const marks = r && (!r.ok || r.ids.length || r.skipped.length);
  if (!marks && !labels.length && !history?.unmerged.length) return { state, reasons: [] };
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
    `not recoverable: ${NOT_RECOVERED.join("; ")}`,
  ].filter(Boolean).join(". ");
  const reasons = [reason("reconstructed-from-repository", `Tenet's local records were missing. ${facts}.`, { note: true })];
  if (r && !r.ok) reasons.push(reason("intent-markers-invalid", `${INTENT_FILE} ${r.where}; nothing was recovered`, { note: true }));
  const ask = r?.ok && r.ids.length ? [reviewQuestion(r, labels)] : [];
  return { state: { ...state, workSeq: high, pending: [...state.pending, ...ask] }, reasons };
}

export const reconstructionSurface = (state: State) => {
  const q = state.pending.find((candidate) => candidate.id === "reconstruction-review");
  return q ? { exit: 3 as const, questions: [q] } : {};
};

export function reviewReconstruction({ ports, state, work, input }: DecisionCtx) {
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
  if (answer === "fresh") return { state: { ...state, pending: rest }, resp: declined };
  const text = intentText(ports);
  const r = text === null ? null : recoverIntent(text);
  if (!r?.ok || binding(r) !== pending.bind.factsHash) {
    const again = r?.ok && r.ids.length ? [reviewQuestion(r, [])] : [];
    const why = `${INTENT_FILE} changed since the question; nothing was recovered`;
    const ask = again.length ? { exit: 3 as const, questions: again } : {};
    const resp = { ...declined, ...ask, reasons: [reason("revision-conflict", why, { note: true })] };
    return { state: { ...state, pending: [...rest, ...again] }, resp };
  }
  const intent = { ...r.intent, revision: state.project.intent.revision + 1 };
  const reconstructed = { at: ports.clock.now(), elementIds: r.ids, notRecovered: NOT_RECOVERED };
  return {
    state: { ...state, pending: rest, project: { ...state.project, intent, reconstructed } },
    resp: { ...declined, data: { reconstructed: true, elementIds: r.ids, notRecovered: NOT_RECOVERED, adopted: false } },
  };
}
