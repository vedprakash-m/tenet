// What the host binding says the host can do (PRD 3.8.2, TS §4.4). Core reads these keys and never a host's name (ENG-02).
import { z } from "zod";
import { hashOf } from "./ids.ts";

const Digest = z.string().regex(/^[a-f0-9]{64}$/);
export const CapabilityProvenance = z.strictObject({
  key: Digest, hostVersion: z.string().max(120).nullable(), pluginVersion: z.string().max(120),
  policyHash: Digest, inputsHash: Digest, probedAt: z.string().max(80), reused: z.boolean(),
});
const Dependencies = z.array(z.string().min(1).max(240).refine(p =>
  !p.startsWith("/") && !p.includes("\\") && !p.includes(":") && !p.includes("\0") &&
  p.split("/").every(part => part !== ".." && part !== "." && part !== ""))).max(20);

/** `static`: declared by the binding; `probe`: found by a check at run time; `observed`: seen on a real host, with evidence. */
const Cap = z.strictObject({
  value: z.string(), source: z.enum(["static", "probe", "observed", "unknown"]), evidence: z.string().optional(),
  dependencies: Dependencies.optional(), provenance: CapabilityProvenance.optional(),
});
export type Capability = z.infer<typeof Cap>;

export const Descriptor = z.strictObject({
  harness: Cap, subagents: Cap, hooks: Cap, approvalMode: Cap, model: Cap, usage: Cap,
  storage: Cap, checkpoints: Cap, questions: Cap, instructionFiles: Cap,
});
export type Descriptor = z.infer<typeof Descriptor>;

const CachedCapability = z.strictObject({
  observation: Cap.omit({ provenance: true }), provenance: CapabilityProvenance.omit({ reused: true }),
});
export const CapabilityCache = z.partialRecord(Descriptor.keyof(), CachedCapability);
export type CapabilityCache = z.infer<typeof CapabilityCache>;

export const capabilityKey = (context: { hostVersion: string | null; pluginVersion: string; policyHash: string }, inputsHash: string) =>
  hashOf({ hostVersion: context.hostVersion, pluginVersion: context.pluginVersion, policyHash: context.policyHash, inputsHash });

const unknown = (): Capability => ({ value: "unknown", source: "unknown" });

/** A host that declared nothing: every capability is unknown, which claims nothing. */
export const UNKNOWN: Descriptor = {
  harness: unknown(), subagents: unknown(), hooks: unknown(), approvalMode: unknown(), model: unknown(), usage: unknown(),
  storage: unknown(), checkpoints: unknown(), questions: unknown(), instructionFiles: unknown(),
};
