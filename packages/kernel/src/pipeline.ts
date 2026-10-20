// One pipeline for every verb (TS §6.1): parse, class, lock, pure plan, in-lock effects, publish, external jobs,
// then the response is rebuilt from the finalized result. Locking, recovery, the envelope and logging exist once here.
import { ZodError } from "zod";
import type { ZodType } from "zod";
import { inputProblem } from "./core/input.ts";
import { KernelError } from "./core/errors.ts";
import { redact } from "./core/redact.ts";
import { mutate } from "./pipeline-mutate.ts";
import { render } from "./pipeline-render.ts";
import { configurePolicy } from "./verbs/reconcile.ts";
import type { KernelResponse, Question, Reason, State } from "./core/schemas.ts";
import type { Ports, Tx } from "./ports/types.ts";

type Exit = 0 | 1 | 2 | 3 | 4 | 5;
type Next = KernelResponse["next"][number];

/** A verb's contribution to the response; the pipeline adds verb, revision, handle, budget and kernel info. */
export { KernelError };
export { handleOf, workByHandle } from "./pipeline-render.ts";
export interface Resp {
  exit?: Exit;
  reasons?: Reason[];
  next?: Next[];
  questions?: Question[];
  progress?: KernelResponse["progress"];
  effects?: KernelResponse["effects"];
  data?: unknown;
  work?: string;
  kernel?: boolean;
}

/** Work that spawns a process runs between two transactions and never holds the lock (TS §7.3). */
export interface Job {
  id: string;
  execute(): Promise<unknown>;
  finalize(tx: Tx, state: State, result: unknown): Promise<{ state: State; resp: Resp }>;
}

export interface Plan {
  state?: State;
  resp: Resp;
  job?: Job;
}

export type OpClass = "stateless" | "read-only" | "mutating";

export interface Verb<I = any> {
  name: string;
  schema: ZodType<I>;
  class(input: I): OpClass;
  /** Mutating verbs that take source ownership (TS §6.3); others never need it. */
  editing?(input: I, state: State | null): boolean;
  run(ctx: Ports, state: State | null, input: I, tx?: Tx): Promise<Plan> | Plan;
  /** What the call's meaning also depends on besides its text, so an unchanged `check` after edits is a new call. */
  identity?(ctx: Ports, input: I, state: State | null): Promise<unknown>;
  /** The only step before the lock: maintenance that cannot need the lock it repairs (TS §7.3). */
  preLock?(ctx: Ports, input: I): Promise<void>;
}

function fail(ports: Ports, verb: string, e: unknown, state: State | null): KernelResponse {
  if (e instanceof KernelError)
    return render(ports, verb, { exit: e.exit, reasons: e.reasons, ...(e.questions ? { questions: e.questions } : {}) }, state);
  if (e instanceof ZodError)
    return render(
      ports,
      verb,
      {
        exit: 1,
        reasons: [
          {
            code: "invalid-input",
            message: e.issues
              .slice(0, 3)
              .map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
              .join("; "),
          },
        ],
      },
      state
    );
  const message = e instanceof Error ? e.message : String(e);
  // Internal errors never yield a success-shaped response (TS §6.1 principle 5).
  return render(ports, verb, { exit: 5, reasons: [{ code: "internal-error", message }] }, state);
}

export async function runVerb(ports: Ports, verbs: Record<string, Verb>, name: string, raw: unknown): Promise<KernelResponse> {
  const verb = verbs[name];
  if (!verb) return render(ports, name, { exit: 1, reasons: [{ code: "unknown-verb", message: `no verb "${name}"` }] }, null);
  const problem = inputProblem(raw);
  if (problem) return render(ports, name, { exit: 1, reasons: [{ code: "invalid-input", message: problem }] }, null);
  const parsed = verb.schema.safeParse(raw ?? {});
  if (!parsed.success) {
    const msg = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
      .join("; ");
    return render(ports, name, { exit: 1, reasons: [{ code: "invalid-input", message: msg }] }, null);
  }
  // The user's own words and request text are kept as they said them, minus anything that looks like a secret (SEC-11).
  const input = Object.fromEntries(
    Object.entries(parsed.data as Record<string, unknown>).map(([k, v]) => [
      k,
      (k === "quote" || k === "request") && typeof v === "string" ? redact(v) : v,
    ])
  ) as typeof parsed.data;
  const cls = verb.class(input);
  try {
    if (cls === "stateless") {
      if (name === "review") configurePolicy(ports, null);
      return render(ports, name, (await verb.run(ports, null, input)).resp, null);
    }
    if (cls === "read-only") {
      const read = ports.store.exists() ? ports.store.read() : null;
      configurePolicy(ports, read?.state ?? null);
      const plan = await verb.run(ports, read?.state ?? null, input);
      return render(ports, name, plan.resp, read?.state ?? null);
    }
    return await mutate(ports, verb, input);
  } catch (e) {
    return fail(ports, name, e, safeState(ports));
  }
}

/** The state for rendering an error; an unreadable store must not turn a refusal into a crash. */
function safeState(ports: Ports): State | null {
  try {
    return ports.store.exists() ? (ports.store.read()?.state ?? null) : null;
  } catch {
    return null;
  }
}
