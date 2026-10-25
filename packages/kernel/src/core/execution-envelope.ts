import { z } from "zod";
import { reason } from "./reasons.ts";
import { hashOf } from "./ids.ts";
import type { Question, Reason, State, WorkContract } from "./schemas.ts";

type EnvelopeConsentPlan = {
  state: State;
  resp: {
    work: string; exit: 3; questions: Question[]; reasons: Reason[];
    next: Array<{ action: "ask"; why: string; required: true }>;
  };
};

export const ExecutionEnvelope = z.strictObject({
  version: z.literal(1), projectId: z.string(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  commands: z.array(z.strictObject({
    kind: z.enum(["tests", "static", "e2e"]), argv: z.array(z.string()), cwd: z.string(),
    environment: z.strictObject({ passed: z.array(z.string()), dropped: z.array(z.string()) }),
    outputs: z.array(z.string()),
  })),
  writablePaths: z.array(z.string()), expectedNetwork: z.enum(["none", "localhost", "declared", "unknown"]),
  dataTargets: z.array(z.string()), containment: z.enum(["none-observed", "cooperative", "os-enforced"]),
  replayClass: z.enum(["live-process", "replayable"]),
});
export type ExecutionEnvelope = z.infer<typeof ExecutionEnvelope>;
export type EnvelopeCommand = ExecutionEnvelope["commands"][number];

export const InFlightCall = z.object({
  runId: z.string(), pid: z.number().int().positive().optional(), procStart: z.string().optional(),
  verb: z.string(), since: z.string(), runDir: z.string().optional(), cancelled: z.boolean().optional(),
  executionEnvelope: ExecutionEnvelope.optional(),
});

export const INTERRUPTED_CHECK = "Check processes ended; external side effects remain unknown. " +
  "Fresh envelope consent is required before rerun.";

export function recoverStoppedCall(state: State, work: WorkContract): State {
  const call = work.session.inCall;
  const interrupted = call?.verb === "check" && call.executionEnvelope?.replayClass !== "replayable";
  const hash = call?.executionEnvelope?.hash;
  const consents = interrupted
    ? state.consents.filter(item => item.kind !== "envelope" || (hash && item.configHash !== hash))
    : state.consents;
  const recovered: WorkContract = {
    ...work, state: work.state === "checking" ? (work.lastValidPhase ?? "executing") : work.state,
    session: { generation: work.session.generation },
  };
  return { ...state, consents, work: { ...state.work, [work.id]: recovered } };
}

export function makeExecutionEnvelope(
  projectId: string, commands: EnvelopeCommand[],
): ExecutionEnvelope {
  const body = {
    version: 1 as const, projectId, commands, writablePaths: ["workspace", "<runDir>"], expectedNetwork: "unknown" as const,
    dataTargets: ["workspace files", "files readable from HOME"], containment: "none-observed" as const,
    replayClass: "live-process" as const,
  };
  return { ...body, hash: hashOf(body) };
}

export function envelopeQuestion(envelope: ExecutionEnvelope): Question {
  const passed = [...new Set(envelope.commands.flatMap((command) => command.environment.passed))].sort();
  const dropped = [...new Set(envelope.commands.flatMap((command) => command.environment.dropped))].sort();
  const commands = envelope.commands.map((command) => `${command.kind}: ${command.argv.join(" ")}`).join("; ");
  const list = (items: string[]) => items.length ? items.join(", ") : "none";
  return {
    id: "envelope-consent", header: "Project check execution", channel: "chat", bind: { factsHash: envelope.hash },
    question: [
      `This check runs ${commands} with no OS sandbox. Project code may read or write workspace files and files accessible from HOME;`,
      `network exposure is unknown. Passed environment names: ${list(passed)}. Dropped names: ${list(dropped)}.`,
      "An interrupted check may have left external side effects; this consent does not undo them.",
      "Allow this exact envelope?",
    ].join(" "),
    options: [
      {
        label: "allow-envelope", description: "Run only this project and command envelope; a changed envelope requires new consent.",
        recommended: true,
      },
      { label: "decline-envelope", description: "No project command is started." },
    ],
  };
}

export function requestEnvelopeConsent(state: State, work: WorkContract, envelope: ExecutionEnvelope) {
  if (!envelope.commands.length || state.consents.some((item) => item.kind === "envelope" && item.configHash === envelope.hash)) return;
  return { work: { ...work, pendingEnvelope: envelope }, question: envelopeQuestion(envelope) };
}

export function envelopeConsentPlan(state: State, work: WorkContract, envelope: ExecutionEnvelope): EnvelopeConsentPlan | undefined {
  const request = requestEnvelopeConsent(state, work, envelope);
  if (!request) return;
  return {
    state: {
      ...state,
      pending: [...state.pending.filter((item) => item.id !== request.question.id), request.question],
      work: { ...state.work, [work.id]: request.work },
    },
    resp: {
      work: work.id,
      exit: 3,
      questions: [request.question],
      reasons: [reason("envelope-unknown", "Project-command network and data exposure are unknown.", { refs: [envelope.hash] })],
      next: [{ action: "ask", why: "Review and answer the exact project check envelope; no command has run.", required: true }],
    },
  };
}
