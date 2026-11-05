// `decide remote`: the user's agreement to send one commit to one branch of one remote (GIT-05, TS §10.6, §11.4). Approval
// mode is unknown, so the kernel asks in chat first; the answer binds to remote, URL, branch and commit as they were when
// asked. The agreement is a grant that keeps those facts, so `publish` can refuse when any of them changed.
import { z } from "zod";
import { KernelError } from "../core/errors.ts";
import { reason } from "../core/reasons.ts";
import { bindingHash, short, validBranch, validRemoteName } from "../core/remote.ts";
import type { Binding } from "../core/remote.ts";
import type { Grant, Question, WorkContract } from "../core/schemas.ts";
import { bindingNow } from "../verbs/publish.ts";
import { nx, question, withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";

const Body = z.object({ branch: z.string().optional() }).optional();
const GATE = "approval mode is unknown; this remote-action chat gate is advisory, and the push needs your yes";

const confirm = (work: WorkContract, b: Binding): Question =>
  question({
    id: "remote-confirm", header: "Push", channel: "chat", bind: { factsHash: bindingHash(b) },
    question: `Push ${short(b.commit)} of ${work.label} to ${b.name} (${b.url}) as branch ${b.branch}? ` +
      'This sends that commit and its history to the remote. It does not merge or deploy anything. Reply "push" or "cancel".',
    options: [
      { label: "Push", description: "Send exactly this commit to that branch." },
      { label: "Cancel", description: "Send nothing." },
    ],
  });

export const remote: Decision = {
  kind: "remote",
  async run({ ports, state, work, input }) {
    const name = input.target;
    if (!name || !validRemoteName(name)) {
      throw new KernelError("capability-missing", "push to which remote? pass its name as the target", { exit: 1 });
    }
    const answer = input.answers?.["remote-confirm"];
    const open = state.pending.find((p) => p.id === "remote-confirm");
    if (answer !== undefined && !open) throw new KernelError("revision-conflict", "there is no open question about a remote", { exit: 2 });
    if (answer !== undefined && answer !== "push" && answer !== "cancel") {
      throw new KernelError("revision-conflict", 'answer "push" or "cancel"', { exit: 1 });
    }
    const rest = { ...state, pending: state.pending.filter((p) => p.id !== "remote-confirm") };
    if (answer === "cancel") return { state: withWork(rest, work), resp: { work: work.id } };
    const branch = Body.parse(input.propose)?.branch ?? work.git.branch ?? "";
    if (!validBranch(branch)) {
      throw new KernelError("restriction-key-unknown", `"${branch}" is not a branch name Tenet will push to`, { exit: 2 });
    }
    const b = await bindingNow(ports, work, name, branch);
    if (!b.url) throw new KernelError("capability-missing", `this repository has no remote named ${name}`, { exit: 2 });
    if (!b.commit) throw new KernelError("continue-required", "nothing of this work is committed yet", { exit: 2 });
    if (answer === undefined) {
      const ask = confirm(work, b);
      return {
        state: withWork({ ...rest, pending: [...rest.pending, ask] }, work),
        resp: {
          work: work.id, exit: 3, questions: [ask], data: { remote: b }, reasons: [reason("approval-gate", GATE)],
          next: [nx("ask", "Show the remote, branch and commit and ask in chat; end your turn.", true)],
        },
      };
    }
    if (bindingHash(b) !== open!.bind.factsHash) {
      const why = "the remote, branch or commit changed since the question was asked; ask again";
      throw new KernelError("revision-conflict", why, { exit: 2 });
    }
    const grant: Grant = {
      id: "GR-remote", actions: ["remote"], source: "decide", capture: "reported",
      ...(input.quote?.trim() ? { quote: input.quote.slice(0, 200) } : {}), bind: { factsHash: bindingHash(b) }, remote: b,
    };
    const grants = [...work.grants.filter((g) => g.id !== grant.id), grant];
    const next = [nx("publish", "Run publish push when the user wants it sent.", true)];
    return { state: withWork(rest, { ...work, grants }), resp: { work: work.id, data: { grant: grant.id, remote: b }, next } };
  },
};
