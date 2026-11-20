import { z } from "zod";
import { CheckInput, StopInput, PacketInput } from "./schemas.ts";
import { PrivacyIdentity } from "./privacy-identity.ts";
import { sha256, stableStringify } from "./ids.ts";

const Handle = z.string().regex(/^W[1-9][0-9]*\.(?:0|[1-9][0-9]*)\.[a-z0-9]{4}$/).refine(value =>
  value.slice(1).split(".").slice(0, 2).every(part => Number.isSafeInteger(Number(part))));
const common = { h: Handle, again: z.boolean().optional() };
const ClosedInputs = {
  check: z.strictObject({ ...common, stage: CheckInput.shape.stage, targeted: z.boolean().optional() }),
  finish: z.strictObject({ ...common, noCommit: z.boolean().optional() }),
  stop: z.strictObject({ ...common, mode: StopInput.shape.mode }),
  integrate: z.strictObject(common),
  undo: z.strictObject(common),
  packet: z.strictObject({
    ...common, role: PacketInput.shape.role, retry: z.boolean().optional(), analystRole: PacketInput.shape.analystRole,
  }),
};

export function mutatingCallIdentity(verb: string, input: unknown): PrivacyIdentity {
  const schema = Object.entries(ClosedInputs).find(([name]) => name === verb)?.[1];
  const parsed = schema?.safeParse(input);
  if (!parsed?.success) return { status: "unknown", producer: "input", cause: "outside-closed-domain" };
  const { again: _again, ...closed } = parsed.data;
  return {
    status: "known", domain: "mutating-call-v1", version: 1, claim: "exact-admitted-value",
    value: `sha256:${sha256(stableStringify({ domain: "mutating-call-v1", version: 1, verb, input: closed }))}`,
  };
}
