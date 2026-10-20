// `decide {propose: basis}`: record the outcome, examples and design sketch (TS §8.7). The one-stop rule: the basis is
// confirmed from the request when every element is in the user's own words and the sketch commits to nothing;
// otherwise exactly one `basis-confirm` question lists Tenet's additions. Nothing is classified as "already said".
import { z } from "zod";
import { KernelError } from "../core/errors.ts";
import { allowed } from "../core/exclusions.ts";
import { hashOf, highestSeq, KIND_PREFIX, elementId } from "../core/ids.ts";
import { deriveObligations, linkElement } from "../core/obligations.ts";
import { BasisProposal } from "../core/schemas.ts";
import type { BasisElement, State, WorkContract } from "../core/schemas.ts";
import { isEditingProfile } from "../core/risk.ts";
import { factsHash, nx, question, withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";

const REQ = /^REQ-(\d+)-([a-z0-9]+)$/;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "work";
const safePath = (p: string) => !p.startsWith("/") && !p.split("/").includes("..") && allowed("edit", p);

type Proposed = z.infer<typeof BasisProposal>["elements"][number];

function build(proposal: z.infer<typeof BasisProposal>, state: State, w: WorkContract, suffix: () => string): { elements: BasisElement[]; ids: Record<string, string> } {
  const own = new Set(w.basis?.elementIds ?? []);
  const all = state.project.intent.elements;
  let seq = highestSeq(all);
  const ids: Record<string, string> = {};
  const idOf = (ref: string | undefined) => (ref ? ids[ref] ?? (all.some((e) => e.id === ref) ? ref : undefined) : undefined);
  const exampleCount = new Map<string, number>();
  for (const e of all) if (!own.has(e.id)) { const m = /^(EX-\d+-[a-z0-9]+)\.(\d+)$/.exec(e.id); if (m) exampleCount.set(m[1]!, Math.max(exampleCount.get(m[1]!) ?? 0, Number(m[2]))); }

  const assign = (e: Proposed): string => {
    if (e.ref && own.has(e.ref)) return e.ref; // a refinement keeps stable ids
    if (e.kind === "example") {
      const parent = idOf(e.of);
      const m = parent ? REQ.exec(parent) : null;
      if (m) {
        const stem = `EX-${m[1]}-${m[2]}`;
        const n = (exampleCount.get(stem) ?? 0) + 1;
        exampleCount.set(stem, n);
        return `${stem}.${n}`;
      }
      return `${elementId("EX", ++seq, suffix())}.1`;
    }
    return elementId(KIND_PREFIX[e.kind], ++seq, suffix());
  };

  // Requirements first, so examples can name their parent by ref in any order.
  const order = [...proposal.elements.keys()].sort((a, b) => Number(proposal.elements[a]!.kind === "example") - Number(proposal.elements[b]!.kind === "example"));
  const built: BasisElement[] = [];
  for (const i of order) {
    const e = proposal.elements[i]!;
    if (e.testFile && !safePath(e.testFile)) throw new KernelError("restriction-key-unknown", `test file "${e.testFile}" is outside the project or not editable`);
    const id = assign(e);
    if (e.ref) ids[e.ref] = id;
    const el: BasisElement = { id, origin: e.origin, kind: e.kind, text: e.text, verifiedBy: [] };
    const parent = idOf(e.of);
    if (parent) el.of = parent;
    if (e.kind === "example") {
      el.test = e.test ?? "distinguishing";
      if (e.testFile) el.testFile = e.testFile;
      if (e.support?.length) el.support = e.support;
      if (e.expect) el.expect = e.expect;
    }
    built.push(el);
  }
  built.sort((a, b) => proposal.elements.findIndex((x) => ids[x.ref ?? ""] === a.id) - proposal.elements.findIndex((x) => ids[x.ref ?? ""] === b.id));
  for (const el of built) el.verifiedBy = linkElement(el, built);
  return { elements: built, ids };
}

export const basis: Decision = {
  kind: "basis",
  async run({ ports, state, work, input }) {
    if (!["proposed", "executing", "authorized"].includes(work.state)) throw new KernelError("stale-session", `a basis cannot change while the work is ${work.state}`, { exit: 2 });
    const proposal = BasisProposal.parse(input.propose);
    const facts = factsHash(proposal);
    const adds = proposal.elements.filter((e) => e.origin === "tenet");
    const needsConfirm = adds.length > 0 || proposal.designCommitment;
    const answer = input.answers?.["basis-confirm"];
    const pending = state.pending.find((q) => q.id === "basis-confirm");

    if (needsConfirm && answer === undefined) {
      const q = question({
        id: "basis-confirm", header: "Confirm the plan", bind: { factsHash: facts }, channel: "native",
        question: `I added ${adds.length ? `${adds.length} thing${adds.length === 1 ? "" : "s"} you did not ask for` : "a design commitment"}: ${adds.slice(0, 4).map((e) => `${e.kind} "${e.text.slice(0, 80)}"`).join("; ")}${proposal.designCommitment ? "; the sketch commits to a specific design" : ""}. Keep them?`,
        options: [{ label: "Yes, go ahead", description: "Build on this basis.", recommended: true }, { label: "Change something", description: "Tell me what to adjust; nothing is recorded yet." }],
      });
      return { state: { ...state, pending: [...state.pending.filter((p) => p.id !== "basis-confirm"), q] }, resp: { work: work.id, exit: 3, questions: [q], reasons: [{ code: "basis-confirm", message: "Tenet's additions need one confirmation" }], next: [nx("ask", "Ask the user to confirm the additions.", true)] } };
    }
    if (needsConfirm) {
      const without = { ...state, pending: state.pending.filter((p) => p.id !== "basis-confirm") };
      if (answer !== "confirm") return { state: without, resp: { work: work.id, next: [nx("basis", "Revise the proposal as the user asked.", true)] } };
      if (!pending || pending.bind.factsHash !== facts) throw new KernelError("basis-confirm", "the proposal changed since the question was asked; ask again", { exit: 3 });
      state = without;
    }

    const built = build(proposal, state, work, () => ports.rand.base32(3));
    const ids = built.ids;
    // The user confirmed Tenet's additions at kickoff (INT-07), so those assumptions are no longer open.
    const elements = built.elements.map((e) => (needsConfirm && e.kind === "assumption" && e.origin === "tenet" ? { ...e, verifiedBy: [{ method: "manual" as const, ref: "confirmed by the user at kickoff" }] } : e));
    const own = new Set(work.basis?.elementIds ?? []);
    const intent = state.project.intent;
    const nextIntent = { ...intent, revision: intent.revision + 1, elements: [...intent.elements.filter((e) => !own.has(e.id)), ...elements] };
    const hash = hashOf({ outcome: proposal.outcome, design: proposal.design ?? null, elements: elements.map(({ verifiedBy: _v, ...rest }) => rest) });
    const obligations = deriveObligations(elements, "vitest", work.obligations);

    let w: WorkContract = {
      ...work, outcome: proposal.outcome, obligations, state: work.state === "proposed" ? "executing" : work.state,
      scope: { ...work.scope, paths: proposal.scopePaths ?? work.scope.paths },
      basis: { intentRevision: nextIntent.revision, elementIds: elements.map((e) => e.id), hash, traits: state.project.traits, ...(proposal.design ? { design: proposal.design } : {}) },
      grants: needsConfirm || input.quote
        ? [...work.grants.filter((g) => g.id !== "GR-basis"), { id: "GR-basis", actions: ["local-routine"], source: "decide" as const, capture: needsConfirm ? "elicited" as const : "reported" as const, ...(input.quote ? { quote: input.quote } : {}), bind: { factsHash: facts } }]
        : work.grants,
    };
    // Branch per work (GIT-02): the editor moves to a work branch cut from HEAD; the working tree is carried unchanged.
    if (isEditingProfile(w.profile) && w.git.mode === "git" && !w.git.branch?.startsWith("tenet/")) {
      const name = `tenet/${w.label.toLowerCase()}-${slug(proposal.outcome)}`;
      await ports.git.createBranch(name);
      w = { ...w, git: { ...w.git, branch: name } };
    }
    const reds = obligations.filter((o) => o.category === "acceptance" && o.expectation === "fail" && o.testFile);
    return {
      state: withWork({ ...state, project: { ...state.project, intent: nextIntent } }, w),
      resp: {
        work: w.id, progress: { phase: "authorized", boundary: "milestone" },
        next: reds.length ? [nx("test", "Write the failing acceptance test(s), then run check --stage baseline.", true)] : [nx("implement", "Make the change, then run check.", true)],
        data: { basisHash: hash, ids, obligations: obligations.map((o) => o.id), branch: w.git.branch },
      },
    };
  },
};
