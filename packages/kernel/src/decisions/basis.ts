// `decide {propose: basis}`: record the outcome, examples and design sketch (TS §8.7). The one-stop rule: the basis is
// confirmed from the request when every element is in the user's own words and the sketch commits to nothing;
// otherwise exactly one `basis-confirm` question lists Tenet's additions. Nothing is classified as "already said".
import { z } from "zod";
import { KernelError } from "../core/errors.ts";
import { build } from "../core/basis-build.ts";
import { hashOf } from "../core/ids.ts";
import { deriveObligations, wantedStatic, withStatic } from "../core/obligations.ts";
import { BasisProposal } from "../core/schemas.ts";
import type { DecideInput, State, WorkContract } from "../core/schemas.ts";
import type { Plan } from "../pipeline.ts";
import type { Ports, Tx } from "../ports/types.ts";
import { isEditingProfile } from "../core/risk.ts";
import { factsHash, nx, question, withWork } from "../verbs/common.ts";
import { settingsFor } from "../verbs/reconcile.ts";
import type { Decision } from "./types.ts";

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "work";

type Proposal = z.infer<typeof BasisProposal>;
type Draft = { w: WorkContract; intent: State["project"]["intent"]; hash: string; ids: Record<string, string>; reds: boolean };

/** The one confirmation of Tenet's additions or a design commitment, asked with the exact content bound (INT-04, UX-D1). */
function askToConfirm(state: State, work: WorkContract, proposal: Proposal, facts: string): Plan {
  const adds = proposal.elements.filter((e) => e.origin === "tenet");
  const summary = adds
    .slice(0, 4)
    .map((e) => `${e.kind} "${e.text.slice(0, 80)}"`)
    .join("; ");
  const countText = adds.length
    ? `${adds.length} thing${adds.length === 1 ? "" : "s"} you did not ask for`
    : "a design commitment";
  const designText = proposal.designCommitment ? "; the sketch commits to a specific design" : "";
  const q = question({
    id: "basis-confirm",
    header: "Confirm the plan",
    bind: { factsHash: facts },
    channel: "native",
    question: `I added ${countText}: ${summary}${designText}. Keep them?`,
    options: [
      { label: "Yes, go ahead", description: "Build on this basis.", recommended: true },
      { label: "Change something", description: "Tell me what to adjust; nothing is recorded yet." },
    ],
  });
  return {
    state: { ...state, pending: [...state.pending.filter((p) => p.id !== "basis-confirm"), q] },
    resp: {
      work: work.id,
      exit: 3,
      questions: [q],
      reasons: [{ code: "basis-confirm", message: "Tenet's additions need one confirmation" }],
      next: [nx("ask", "Ask the user to confirm the additions.", true)],
    },
  };
}

/** The elements, the intent revision, the obligations and the contract this basis makes; nothing is written yet. */
function draftBasis(
  ports: Ports,
  state: State,
  work: WorkContract,
  input: DecideInput,
  proposal: Proposal,
  facts: string,
  confirmed: boolean
): Draft {
  const built = build(proposal, state, work, () => ports.rand.base32(3));
  // The user confirmed Tenet's additions at kickoff (INT-07), so those assumptions are no longer open.
  const elements = built.elements.map((e) =>
    confirmed && e.kind === "assumption" && e.origin === "tenet"
      ? { ...e, verifiedBy: [{ method: "manual" as const, ref: "confirmed by the user at kickoff" }] }
      : e
  );
  const own = new Set(work.basis?.elementIds ?? []);
  const old = state.project.intent;
  const intent = { ...old, revision: old.revision + 1, elements: [...old.elements.filter((e) => !own.has(e.id)), ...elements] };
  const hash = hashOf({
    outcome: proposal.outcome,
    design: proposal.design ?? null,
    elements: elements.map(({ verifiedBy: _v, ...rest }) => rest),
  });
  const required = settingsFor(ports, state, work).required_checks as Array<{ id: string; tool?: string }>;
  const obligations = withStatic(
    deriveObligations(elements, ports.stack.detect(ports.root).runner ?? "vitest", work.obligations),
    wantedStatic(state.project.recipe?.checks ?? [], required)
  );
  const grant = {
    id: "GR-basis",
    actions: ["local-routine" as const],
    source: "decide" as const,
    capture: "reported" as const,
    ...(input.quote ? { quote: input.quote } : {}),
    bind: { factsHash: facts },
  };
  const w: WorkContract = {
    ...work,
    outcome: proposal.outcome,
    obligations,
    state: work.state === "proposed" ? "executing" : work.state,
    scope: { ...work.scope, paths: proposal.scopePaths ?? work.scope.paths },
    basis: {
      intentRevision: intent.revision,
      elementIds: elements.map((e) => e.id),
      hash,
      traits: state.project.traits,
      confirmedAssumptions: confirmed
        ? elements.filter((e) => e.kind === "assumption" && e.origin === "tenet").map((e) => e.id)
        : [],
      ...(proposal.design ? { design: proposal.design } : {}),
    },
    grants: confirmed || input.quote ? [...work.grants.filter((g) => g.id !== "GR-basis"), grant] : work.grants,
  };
  return {
    w,
    intent,
    hash,
    ids: built.ids,
    reds: obligations.some((o) => o.category === "acceptance" && o.expectation === "fail" && o.testFile),
  };
}

/** Branch per work (GIT-02): the editor moves to a work branch cut from HEAD; the working tree is carried unchanged. */
async function moveToWorkBranch(
  ports: Ports,
  tx: Tx,
  state: State,
  work: WorkContract,
  w: WorkContract,
  outcome: string
): Promise<WorkContract> {
  if (!isEditingProfile(w.profile) || w.git.mode !== "git" || work.basis || settingsFor(ports, state, w).branching !== "per-work")
    return w;
  const name = `tenet/${w.label.toLowerCase()}-${slug(outcome)}`;
  const id = `b-${ports.rand.base32(6)}`;
  tx.intent("branch", id, { work: w.id, from: w.git.branch, to: name });
  try {
    await ports.git.createBranch(name);
  } catch (e) {
    if ((await ports.git.probe()).branch === w.git.branch) tx.result("branch", id, { completed: false });
    throw e;
  }
  tx.result("branch", id, { completed: true, branch: name });
  return { ...w, git: { ...w.git, branch: name } };
}

export const basis: Decision = {
  kind: "basis",
  async run({ ports, tx, state, work, input }) {
    if (!["proposed", "executing", "authorized"].includes(work.state)) {
      throw new KernelError("stale-session", `a basis cannot change while the work is ${work.state}`, { exit: 2 });
    }
    const proposal = BasisProposal.parse(input.propose);
    const facts = factsHash(proposal);
    const needsConfirm = proposal.elements.some((e) => e.origin === "tenet") || proposal.designCommitment;
    const answer = input.answers?.["basis-confirm"];
    if (needsConfirm && answer === undefined) return askToConfirm(state, work, proposal, facts);
    if (needsConfirm) {
      const pending = state.pending.find((q) => q.id === "basis-confirm");
      state = { ...state, pending: state.pending.filter((p) => p.id !== "basis-confirm") };
      if (answer !== "confirm")
        return { state, resp: { work: work.id, next: [nx("basis", "Revise the proposal as the user asked.", true)] } };
      if (!pending || pending.bind.factsHash !== facts) {
        throw new KernelError("basis-confirm", "the proposal changed since the question was asked; ask again", { exit: 3 });
      }
    }
    const d = draftBasis(ports, state, work, input, proposal, facts, needsConfirm);
    const w = await moveToWorkBranch(ports, tx, state, work, d.w, proposal.outcome);
    const stacked = w.git.start.branch?.startsWith("tenet/") && w.git.branch !== w.git.start.branch;
    return {
      state: withWork({ ...state, project: { ...state.project, intent: d.intent } }, w),
      resp: {
        work: w.id,
        progress: { phase: "authorized", boundary: "milestone" },
        next: [
          d.reds
            ? nx("test", "Write the failing acceptance test(s), then run check --stage baseline.", true)
            : nx("implement", "Make the change, then run check.", true),
        ],
        data: {
          basisHash: d.hash,
          ids: d.ids,
          obligations: w.obligations.map((o) => o.id),
          branch: w.git.branch,
          ...(stacked ? { stackedOn: w.git.start.branch } : {}),
        },
      },
    };
  },
};
