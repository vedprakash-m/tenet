// Model qualification is evidence-bound. Unknown input and an empty or invalid table never upgrade a model (RSC-08).
import { z } from "zod";

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Model = z.string().min(1).max(120);
const CampaignPath = z.string().max(300).regex(/^docs\/audits\/\d{4}-\d{2}-\d{2}\/[A-Za-z0-9._-]+\.json$/);

const Record = z.strictObject({
  model: Model,
  qualification: z.enum(["qualified", "unqualified"]),
  campaignId: z.string().regex(/^[A-Za-z0-9._-]{1,120}$/),
  campaignPath: CampaignPath,
  campaignSha256: Hash,
});

export const ModelQualificationTable = z.strictObject({
  schemaVersion: z.literal(1),
  records: z.array(Record).max(256),
}).superRefine((table, ctx) => {
  const seen = new Set<string>();
  for (const record of table.records) {
    if (seen.has(record.model)) ctx.addIssue({
      code: "custom", message: `duplicate model qualification: ${record.model}`,
    });
    seen.add(record.model);
  }
});
export type ModelQualificationTable = z.infer<typeof ModelQualificationTable>;

export function qualificationForModel(
  table: ModelQualificationTable,
  model: string | undefined,
): "qualified" | "unqualified" | "unknown" {
  if (!model) return "unknown";
  return table.records.find((record) => record.model === model)?.qualification ?? "unknown";
}
