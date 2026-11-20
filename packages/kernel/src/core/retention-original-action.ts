import { z } from "zod";
import { KernelError } from "./errors.ts";
import { hashOf, stableStringify } from "./ids.ts";
import { StorageId } from "./storage-records.ts";

const RetentionVerb = z.enum(["open", "decide", "check", "findings", "finish", "stop", "packet", "integrate", "undo"]);
type RetentionVerb = z.infer<typeof RetentionVerb>;
export interface RetentionProjection { version: 1; verb: RetentionVerb }
export interface RetentionOriginalAction<P extends RetentionProjection> {
  version: 1; verb: RetentionVerb; projection: P;
  intent: { effect: string; token: string };
  runId: string | null;
  progress: { batchId: string; generationId: string };
}
interface AdmittedAction<P extends RetentionProjection> {
  action: RetentionOriginalAction<P>;
  originalActionHash: string;
}

function exactInput<T>(schema: z.ZodType<T>) {
  return z.custom<T>(value => {
    const parsed = schema.safeParse(value);
    return parsed.success && stableStringify(value) === stableStringify(parsed.data);
  });
}

function immutable<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

/** P93 owns these closed domains; storage neither invents nor defaults their admission. */
export function retentionOriginalActionSchema<P extends RetentionProjection>(privacy: {
  projection: z.ZodType<P>; effect: z.ZodType<string>;
  token: z.ZodType<string>; runId: z.ZodType<string>;
}) {
  return z.strictObject({
    version: z.literal(1), verb: RetentionVerb, projection: exactInput(privacy.projection),
    intent: z.strictObject({ effect: exactInput(privacy.effect), token: exactInput(privacy.token) }),
    runId: exactInput(privacy.runId).nullable(),
    progress: z.strictObject({ batchId: StorageId, generationId: StorageId }),
  }).refine(row => row.projection.version === 1 && row.projection.verb === row.verb &&
    row.progress.batchId === row.progress.generationId);
}

/** The verifier must prove P93's work/generation, intent/run and publication-prefix bindings. */
export function admitRetentionOriginalAction<P extends RetentionProjection>(
  schema: z.ZodType<RetentionOriginalAction<P>>,
  raw: unknown,
  binding: { batchId: string; generationId: string; reportOriginalActionHash?: string },
  verify: (action: RetentionOriginalAction<P>) => boolean,
): AdmittedAction<P> {
  const parsed = schema.safeParse(raw);
  const refused = () => new KernelError(
    "storage-accounting-unknown", "retained original action is unavailable or does not match its durable bindings", { exit: 2 },
  );
  if (!parsed.success || parsed.data.progress.batchId !== binding.batchId ||
    parsed.data.progress.generationId !== binding.generationId) throw refused();
  const action = structuredClone(parsed.data), originalActionHash = hashOf(action);
  if ((binding.reportOriginalActionHash !== undefined && binding.reportOriginalActionHash !== originalActionHash) ||
    verify(action) !== true || hashOf(action) !== originalActionHash) throw refused();
  // Neither input aliases nor references retained by the verifier may change the admitted proof.
  return immutable({ action: structuredClone(action), originalActionHash });
}

export function retentionRequiredAction<P extends RetentionProjection>(admitted: AdmittedAction<P>) {
  return { verb: admitted.action.verb, projection: structuredClone(admitted.action.projection) };
}
