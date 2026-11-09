import { z } from "zod";

const milliseconds = z.number().finite().nonnegative();
const observation = z.strictObject({ ms: milliseconds, observedAt: z.iso.datetime() });
export const HostTimings = z.strictObject({
  provider: observation.optional(), network: observation.optional(), userWait: observation.optional(),
});
export type HostTimings = z.infer<typeof HostTimings>;

const kernelMeasurement = z.strictObject({ ms: milliseconds, source: z.literal("kernel") });
const hostMeasurement = z.discriminatedUnion("source", [
  z.strictObject({ ...observation.shape, source: z.literal("host") }),
  z.strictObject({ ms: z.null(), source: z.literal("unknown"), reason: z.enum(["host-not-reported", "host-invalid"]) }),
]);
export const Timing = z.strictObject({
  scope: z.literal("kernel-call"),
  active: kernelMeasurement, tool: kernelMeasurement,
  provider: hostMeasurement, network: hostMeasurement, userWait: hostMeasurement,
});
export type Timing = z.infer<typeof Timing>;

export function timingReport(elapsed: number, tool: number, host: HostTimings, invalid = false): Timing {
  const external = (value: HostTimings["provider"]): Timing["provider"] => value
    ? { ...value, source: "host" } : { ms: null, source: "unknown", reason: invalid ? "host-invalid" : "host-not-reported" };
  return {
    scope: "kernel-call", active: { ms: Math.max(0, elapsed - tool), source: "kernel" },
    tool: { ms: tool, source: "kernel" },
    provider: external(host.provider), network: external(host.network), userWait: external(host.userWait),
  };
}
