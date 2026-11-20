import { KernelError } from "../core/errors.ts";
import type { DirtyFileDecision, WorkContract } from "../core/schemas.ts";
import { factsHash, nx, withWork } from "../verbs/common.ts";
import { dirtyFacts, dirtyScopeHash, undecidedDirty } from "../verbs/dirty.ts";
import type { Decision } from "./types.ts";

type DirtyAnswer = {
  instanceId?: unknown;
  items?: unknown;
  all?: unknown;
  noCommit?: unknown;
};

const dirtyChoices = new Set(["wait", "include", "leave-out", "dont-commit", "edit-uncommitted"]);

function dirtyAnswers(input: unknown, tokens: readonly string[]): {
  instanceId: string; choices: Record<string, string>; noCommit: boolean;
} {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new KernelError(
      "revision-conflict",
      "the dirty-file answer must name its question instance and every displayed item",
      { exit: 1 },
    );
  }
  const raw = input as DirtyAnswer;
  if (typeof raw.instanceId !== "string" || !raw.instanceId)
    throw new KernelError("revision-conflict", "the dirty-file answer is missing its question instance", { exit: 1 });
  const noCommit = raw.noCommit === true || raw.all === "dont-commit";
  let entries: Array<[string, string]>;
  if (raw.all !== undefined) {
    if (!dirtyChoices.has(String(raw.all)))
      throw new KernelError("revision-conflict", 'answer "wait", "include", "leave-out" or "dont-commit"', { exit: 1 });
    const choice = raw.all === "dont-commit" ? "edit-uncommitted" : String(raw.all);
    entries = tokens.map((token) => [token, choice]);
  } else if (Array.isArray(raw.items)) {
    entries = raw.items.map((item) => {
      if (!item || typeof item !== "object") return ["", ""];
      const pair = item as { token?: unknown; choice?: unknown };
      return [String(pair.token ?? ""), String(pair.choice ?? "")];
    });
  } else if (raw.items && typeof raw.items === "object") {
    entries = Object.entries(raw.items as Record<string, unknown>).map(([token, value]) => [token, String(value)]);
  } else if (noCommit) {
    entries = tokens.map((token) => [token, "edit-uncommitted"]);
  } else {
    entries = [];
  }
  const choices: Record<string, string> = Object.create(null);
  for (const [token, choice] of entries) {
    if (Object.hasOwn(choices, token))
      throw new KernelError("revision-conflict", `item ${token} was answered more than once`, { exit: 1 });
    choices[token] = choice;
  }
  if (Object.keys(choices).some((token) => !tokens.includes(token)))
    throw new KernelError("revision-conflict", "the answer contains an undisclosed file item", { exit: 1 });
  const missing = tokens.filter((token) => !Object.hasOwn(choices, token));
  if (missing.length) {
    const names = `item${missing.length === 1 ? "" : "s"} ${missing.join(", ")}`;
    throw new KernelError("revision-conflict", `the answer is missing ${names}`, { exit: 1 });
  }
  if (Object.values(choices).some((choice) => !dirtyChoices.has(choice)))
    throw new KernelError("revision-conflict", 'each item must say "wait", "include" or "leave-out"', { exit: 1 });
  return { instanceId: raw.instanceId, choices, noCommit };
}

/** Answers the dirty-overlap question: the instance, scope and each file fact must still be current. */
export const dirtyOverlap: Decision = {
  kind: "dirty-overlap",
  async run({ ports, state, work, input }) {
    const q = state.pending.find((p) => p.id === "dirty-overlap");
    if (!q) throw new KernelError("revision-conflict", "there is no open question about your edits", { exit: 2 });
    if (!q.bind.instanceId || !q.bind.workId || q.bind.sessionGeneration === undefined || !q.bind.scopeHash || !q.bind.items) {
      throw new KernelError("revision-conflict", "the open dirty-file question uses stale authority; check again", { exit: 2 });
    }
    const inv = await ports.git.inventory([]);
    const paths = undecidedDirty(work, inv);
    const shown = q.bind.items;
    const answer = dirtyAnswers(input.answers?.["dirty-overlap"], shown.map((item) => item.token));
    if (answer.instanceId !== q.bind.instanceId)
      throw new KernelError("revision-conflict", "the answer belongs to a replaced dirty-file question", { exit: 2 });
    if (q.bind.workId !== work.id || q.bind.sessionGeneration !== work.session.generation || q.bind.scopeHash !== dirtyScopeHash(work))
      throw new KernelError("revision-conflict", "the dirty-file question belongs to another work generation or scope", { exit: 2 });
    if (!paths.length) {
      const rest = state.pending.filter((p) => p.id !== "dirty-overlap");
      return { state: { ...state, pending: rest }, resp: { work: work.id, next: [nx("check", "Continue.", true)], data: { decided: [] } } };
    }
    const current = new Set(paths);
    if (
      shown.length !== current.size ||
      shown.some((item) => !current.has(item.path)) ||
      shown.some((item) => factsHash(item.relevantFacts) !== factsHash(dirtyFacts(work, inv, item.path))) ||
      q.bind.factsHash !== factsHash({
        workId: q.bind.workId,
        sessionGeneration: q.bind.sessionGeneration,
        scopeHash: q.bind.scopeHash,
        instanceId: q.bind.instanceId,
        items: q.bind.items,
      })
    ) {
      throw new KernelError(
        "revision-conflict",
        "the file, index or scope changed since the question was asked; nothing in that answer was applied",
        { exit: 2 },
      );
    }
    const rest = state.pending.filter((p) => p.id !== "dirty-overlap");
    const decisions: DirtyFileDecision[] = shown.map((item) => {
      const selected = answer.choices[item.token]!;
      const choice = selected === "wait" ? "waiting" : selected === "dont-commit" ? "edit-uncommitted" : selected;
      return {
        workId: work.id,
        sessionGeneration: work.session.generation,
        questionInstance: q.bind.instanceId!,
        itemToken: item.token,
        path: item.path,
        choice: choice as DirtyFileDecision["choice"],
        relevantFacts: item.relevantFacts,
        scopeHash: q.bind.scopeHash!,
        recordedAt: ports.clock.now(),
        captureClass: "elicited",
      };
    });
    const included = decisions.filter((decision) => decision.choice === "include").map((decision) => decision.path);
    const leftOut = decisions.filter((decision) => decision.choice === "leave-out").map((decision) => decision.path);
    const waiting = decisions.filter((decision) => decision.choice === "waiting").map((decision) => decision.path);
    const retained = (work.dirtyFileDecisions ?? []).filter((decision) => !shown.some((item) => item.path === decision.path));
    const w: WorkContract = {
      ...work,
      includeDirty: [...new Set([...work.includeDirty.filter((path) => !leftOut.includes(path)), ...included])],
      keepOut: [...new Set([...work.keepOut, ...leftOut])],
      leaveOut: [...new Set([...(work.leaveOut ?? []), ...leftOut])],
      dirtyFileDecisions: [...retained, ...decisions],
      touched: work.touched.filter((touch) => !leftOut.includes(touch.path)),
      ...(answer.noCommit ? { git: { ...work.git, noCommit: true } } : {}),
    };
    const next = waiting.length
      ? [nx("ask", "Wait for the person to commit or set aside the waiting files outside Tenet, then run check.", true)]
      : [nx(w.basis ? "check" : "basis", "Continue.", true)];
    return {
      state: withWork({ ...state, pending: rest }, w),
      resp: {
        work: w.id,
        next,
        data: { decided: shown.map((item) => item.path), choices: answer.choices, waiting },
      },
    };
  },
};
