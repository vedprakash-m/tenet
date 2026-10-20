// `decide adopt`: add the project's shared files to the repository, with a preview that binds the approval to the exact
// content (TS §7.8, CON-01). `intent` writes the managed blocks into INTENT.md; `policy` records a tenet.policy.json the
// project already has, or the changes pulled into it. An explicit request is previewed once, never confirmed twice.
import { KernelError } from "../core/errors.ts";
import { sha256 } from "../core/ids.ts";
import { projectIntent } from "../core/intent-md.ts";
import { comparePolicy, parsePolicy } from "../core/policy.ts";
import type { Policy } from "../core/policy.ts";
import type { Question, State, WorkContract } from "../core/schemas.ts";
import type { Plan } from "../pipeline.ts";
import { factsHash, question, withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";
import { reviewQuarantine } from "./quarantine.ts";

export const INTENT_FILE = "INTENT.md";
export const POLICY_FILE = "tenet.policy.json";

/** What the intent write's intent record holds, so recovery can finish publishing it. */
export interface AdoptOp {
  work: string;
  file: typeof INTENT_FILE;
  before: string | null;
  after: string;
  blocks: Record<string, string>;
  at: string;
}

/** The trust entry and contract bookkeeping a finished INTENT.md write leaves behind. */
export function adopted(state: State, op: AdoptOp): State {
  const entry: State["trust"][number] = { file: op.file, hash: op.after, adoptedAt: op.at, restrictions: { blocks: op.blocks } };
  const w = state.work[op.work];
  const mine: WorkContract | undefined = w && {
    ...w,
    vetted: { ...w.vetted, [op.file]: op.after },
    touched: w.touched.some((t) => t.path === op.file) ? w.touched : [...w.touched, { path: op.file }],
  };
  const s = {
    ...state,
    trust: [...state.trust.filter((t) => t.file !== op.file), entry],
    project: { ...state.project, adoption: { ...state.project.adoption, intent: "adopted" as const } },
  };
  return mine ? withWork(s, mine) : s;
}

const asked = (s: State) => s.pending.filter((q) => q.id !== "adopt-confirm");

function adoptionQuestion(id: string, text: string, bind: string, yes: string): Question {
  return question({
    id,
    header: "Shared files",
    question: text,
    bind: { factsHash: bind },
    options: [
      { label: "Yes, add them", description: yes, recommended: true },
      { label: "No thanks", description: "Nothing changes now; the answer is remembered until you ask." },
    ],
  });
}

const summary = (p: Policy): string =>
  [
    p.protected_paths?.length ? `protected paths ${p.protected_paths.join(", ")}` : "",
    p.exclusions?.length ? `exclusions ${p.exclusions.map((e) => e.pattern).join(", ")}` : "",
    p.required_checks?.length ? `required checks ${p.required_checks.map((c) => c.id).join(", ")}` : "",
    p.dependency_policy ? `dependency policy ${JSON.stringify(p.dependency_policy)}` : "",
    p.commands ? `commands ${Object.keys(p.commands).join(", ")} (each needs your consent before its first run)` : "",
  ]
    .filter(Boolean)
    .join("; ") || "no restrictions";

/** Shared by both targets: ask once with the exact content bound, apply on the matching confirmation, remember a refusal. */
function decideOn(c: Parameters<Decision["run"]>[0], key: "intent" | "policy", facts: string, text: string, yes: string, apply: () => Plan): Plan {
  const { state, work, input } = c;
  const answer = input.answers?.["adopt-confirm"];
  const q = adoptionQuestion("adopt-confirm", text, facts, yes);
  if (answer === "decline") {
    const file = key === "policy" ? POLICY_FILE : INTENT_FILE;
    const project = state.trust.some((t) => t.file === file)
      ? state.project
      : { ...state.project, adoption: { ...state.project.adoption, [key]: "declined" as const } };
    return { state: { ...state, pending: asked(state), project }, resp: { work: work.id, next: [], data: { adopted: false } } };
  }
  if (answer === "confirm" && state.pending.some((p) => p.id === "adopt-confirm" && p.bind.factsHash === facts)) return apply();
  return {
    state: { ...state, pending: [...asked(state), q] },
    resp: {
      work: work.id,
      exit: 3,
      questions: [q],
      next: [{ action: "ask", why: "Ask the user, then answer with --answer adopt-confirm=confirm or decline.", required: true }],
    },
  };
}

export const adopt: Decision = {
  kind: "adopt",
  async run(c) {
    const { ports, tx, state, work, input } = c;
    if (input.target === "quarantine") return reviewQuarantine(c);
    if (input.target === "policy") {
      const text = ports.project.read(POLICY_FILE);
      if (text === null) throw new KernelError("capability-missing", `there is no ${POLICY_FILE} to adopt`, { exit: 2 });
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new KernelError("restriction-key-unknown", `${POLICY_FILE} is not valid JSON`, { exit: 2 });
      }
      const parsed = parsePolicy(json);
      if (!parsed.ok) throw new KernelError("restriction-key-unknown", parsed.message, { exit: 2 });
      const hash = sha256(text);
      const prev = state.trust.find((t) => t.file === POLICY_FILE);
      if (prev?.hash === hash) return { resp: { work: work.id, next: [], data: { file: POLICY_FILE, message: `${POLICY_FILE} is up to date` } } };
      const changes = prev ? comparePolicy(prev.restrictions as Policy, parsed.policy) : [];
      const shown = prev
        ? `${changes.length} change${changes.length === 1 ? "" : "s"}: ${changes.map((x) => `${x.field} ${x.kind} (${x.detail})`).join("; ")}`
        : summary(parsed.policy);
      const prompt = `${prev ? "Accept the changes to" : "Adopt"} ${POLICY_FILE}? ${shown}.`;
      return decideOn(c, "policy", factsHash({ policy: hash }), prompt, "Record this file's rules so every contract follows them.", () => {
        const entry: State["trust"][number] = { file: POLICY_FILE, hash, adoptedAt: ports.clock.now(), restrictions: parsed.policy };
        return {
          state: {
            ...state,
            pending: asked(state),
            trust: [...state.trust.filter((t) => t.file !== POLICY_FILE), entry],
            project: { ...state.project, adoption: { ...state.project.adoption, policy: "adopted" } },
          },
          resp: { work: work.id, next: [], data: { file: POLICY_FILE, adopted: true } },
        };
      });
    }
    if (input.target !== "intent") throw new KernelError("restriction-key-unknown", `adopt what? "intent" or "policy"`, { exit: 1 });

    const text = ports.project.read(INTENT_FILE);
    const prev = state.trust.find((t) => t.file === INTENT_FILE);
    const pr = projectIntent(text, state.project.intent, (prev?.restrictions.blocks ?? {}) as Record<string, string>);
    if (!pr.ok) throw new KernelError("intent-markers-invalid", `line ${pr.line}${pr.id ? ` around ${pr.id}` : ""} (${pr.problem}):\n${pr.region}`, { exit: 2 });
    const after = sha256(pr.text);
    const at = ports.clock.now();
    const op: AdoptOp = { work: work.id, file: INTENT_FILE, before: text === null ? null : sha256(text), after, blocks: pr.written, at };
    if (pr.text === (text ?? null)) {
      return { state: adopted(state, op), resp: { work: work.id, next: [], data: { file: INTENT_FILE, message: `${INTENT_FILE} is up to date`, external: pr.external } } };
    }
    const remote = (await ports.git.probe()).remotes[0];
    const heads = pr.changed.slice(0, 6).join(", ");
    const extNote = pr.external.length ? ` Blocks you edited stay as written: ${pr.external.join(", ")}.` : "";
    const remNote = remote ? ` This repository has a remote (${remote}); the shared intent becomes visible to whoever can read it.` : "";
    const prompt = `${text === null ? "Create" : "Add blocks to"} ${INTENT_FILE} with ${pr.changed.length} block${pr.changed.length === 1 ? "" : "s"} (${heads}${pr.changed.length > 6 ? ", ..." : ""})? Everything outside Tenet's markers stays yours.${extNote}${remNote}`;
    return decideOn(
      c,
      "intent",
      factsHash({ intent: after }),
      prompt,
      "Save the purpose, plan and decisions in the project so the next change starts with them.",
      () => {
        const id = `a-${ports.rand.base32(6)}`;
        tx.intent("adopt", id, op);
        ports.project.write(INTENT_FILE, pr.text);
        tx.result("adopt", id, { completed: true });
        return {
          state: adopted({ ...state, pending: asked(state) }, op),
          resp: { work: work.id, next: [], data: { file: INTENT_FILE, adopted: true, blocks: pr.changed, committed: false } },
        };
      },
    );
  },
};
