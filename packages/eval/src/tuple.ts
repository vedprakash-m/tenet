import { z } from "zod";

const tupleSource = z.strictObject({
  status: z.enum(["observed", "documented", "unknown"]),
  reference: z.string().nullable(),
}).superRefine((source, context) => {
  if (source.status === "unknown" && source.reference !== null) {
    context.addIssue({ code: "custom", message: "unknown tuple source must not have a reference" });
  }
  if (source.status !== "unknown" && (!source.reference || Buffer.byteLength(source.reference, "utf8") > 512)) {
    context.addIssue({ code: "custom", message: "known tuple source needs a bounded reference" });
  }
});

export const QualificationTuple = z.strictObject({
  vscodeVersion: z.string().min(1),
  copilotChatExtensionVersion: z.string().min(1),
  agentHarness: z.string().min(1),
  pluginFormatVersion: z.string().min(1),
  installPath: z.string().min(1),
  featureSettings: z.record(z.string(), z.json()),
  copilotPlan: z.string().min(1),
  organizationPolicyProfile: z.string().min(1),
  osVersion: z.string().min(1),
  architecture: z.string().min(1),
  executionTarget: z.string().min(1),
  workspaceMode: z.string().min(1),
  recipeVersion: z.string().min(1),
  toolchainVersions: z.record(z.string(), z.string()),
});

export const TupleSources = z.strictObject({
  vscodeVersion: tupleSource,
  copilotChatExtensionVersion: tupleSource,
  agentHarness: tupleSource,
  pluginFormatVersion: tupleSource,
  installPath: tupleSource,
  featureSettings: tupleSource,
  copilotPlan: tupleSource,
  organizationPolicyProfile: tupleSource,
  osVersion: tupleSource,
  architecture: tupleSource,
  executionTarget: tupleSource,
  workspaceMode: tupleSource,
  recipeVersion: tupleSource,
  toolchainVersions: tupleSource,
});

export type QualificationTuple = z.infer<typeof QualificationTuple>;