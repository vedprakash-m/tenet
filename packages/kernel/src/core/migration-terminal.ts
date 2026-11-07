import { z } from "zod";

/** Privacy-safe historical facts only; neither ownership nor permission to repeat an operation. */
export const Terminal = z.strictObject({
  operationId: z.string().regex(/^[0-9a-f]{32}$/),
  protocolVersion: z.literal(1),
  versions: z.strictObject({ from: z.union([z.literal(1), z.literal(2)]), to: z.union([z.literal(1), z.literal(2)]) }),
  outcome: z.enum(["upgraded", "rolled-back"]),
  bindingDigest: z.string().regex(/^[0-9a-f]{64}$/),
}).refine(t => t.versions.from !== t.versions.to && (t.outcome === "upgraded") === (t.versions.to === 2),
  "versions disagree with the outcome");
export type Terminal = z.infer<typeof Terminal>;

export const matchTerminal = (stored: Terminal, asked: Terminal): boolean =>
  stored.operationId === asked.operationId && stored.protocolVersion === asked.protocolVersion
  && stored.versions.from === asked.versions.from && stored.versions.to === asked.versions.to
  && stored.outcome === asked.outcome && stored.bindingDigest === asked.bindingDigest;
