// What the host binding says the host can do (PRD 3.8.2, TS §4.4). Core reads these keys and never a host's name (ENG-02).
import { z } from "zod";

/** `static`: declared by the binding; `probe`: found by a check at run time; `observed`: seen on a real host, with evidence. */
const Cap = z.strictObject({
  value: z.string(), source: z.enum(["static", "probe", "observed", "unknown"]), evidence: z.string().optional(),
});
export type Capability = z.infer<typeof Cap>;

export const Descriptor = z.strictObject({
  harness: Cap, subagents: Cap, hooks: Cap, approvalMode: Cap, model: Cap, usage: Cap,
  storage: Cap, checkpoints: Cap, questions: Cap, instructionFiles: Cap,
});
export type Descriptor = z.infer<typeof Descriptor>;

const unknown = (): Capability => ({ value: "unknown", source: "unknown" });

/** A host that declared nothing: every capability is unknown, which claims nothing. */
export const UNKNOWN: Descriptor = {
  harness: unknown(), subagents: unknown(), hooks: unknown(), approvalMode: unknown(), model: unknown(), usage: unknown(),
  storage: unknown(), checkpoints: unknown(), questions: unknown(), instructionFiles: unknown(),
};
