// Consent to run a configured program at commit time (GIT-12, TS §10.3): the commit hooks, or the Git filters a commit would run.
// The answer binds to the configuration as it was when the question was asked; a changed configuration asks again.
import { KernelError } from "../core/errors.ts";
import { nx, withWork } from "../verbs/common.ts";
import type { Ports } from "../ports/types.ts";
import type { Decision } from "./types.ts";

interface Consent {
  kind: string;
  recorded: "hooks" | "filters";
  yes: string;
  noun: string;
  /** The hash of the configuration that exists now. */
  current(ports: Ports): Promise<string | null | undefined>;
}

function consentDecision(c: Consent): Decision {
  return {
    kind: c.kind,
    async run({ ports, state, work, input }) {
      const answer = input.answers?.[c.kind];
      const q = state.pending.find((p) => p.id === c.kind);
      if (!q) throw new KernelError("revision-conflict", `there is no open question about ${c.noun}`, { exit: 2 });
      if (answer !== c.yes && answer !== "keep-uncommitted") {
        throw new KernelError("revision-conflict", `answer "${c.yes}" or "keep-uncommitted"`, { exit: 1 });
      }
      if ((await c.current(ports)) !== q.bind.factsHash) {
        throw new KernelError("revision-conflict", `the ${c.noun} changed since the question was asked`, { exit: 2 });
      }
      const pending = state.pending.filter((p) => p.id !== c.kind);
      if (answer === "keep-uncommitted") {
        const declined = { ...work, git: { ...work.git, noCommit: true } };
        const next = [nx("finish", "Finish without committing.")];
        return { state: withWork({ ...state, pending }, declined), resp: { work: work.id, next } };
      }
      const consents = [...state.consents, { kind: c.recorded, configHash: q.bind.factsHash, at: ports.clock.now() }];
      const next = [nx("finish", `The ${c.noun} are consented; finish again to commit.`, true)];
      return { state: withWork({ ...state, pending, consents }, work), resp: { work: work.id, next } };
    },
  };
}

/** Consent to run this project's commit hooks, bound to the hook files as they are now. */
export const hookConsent = consentDecision({
  kind: "hook-consent",
  recorded: "hooks",
  yes: "commit-with-hooks",
  noun: "commit hooks",
  current: async (ports) => (await ports.git.probe()).hooks,
});

/** Consent to run the configured Git filters a commit would run, bound to their commands as they are now. */
export const filterConsent = consentDecision({
  kind: "filter-consent",
  recorded: "filters",
  yes: "allow-filters",
  noun: "Git filters",
  current: async (ports) => (await ports.git.filterGate())?.hash,
});
