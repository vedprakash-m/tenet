import { z } from "zod";

export const PRIVACY_NOTICE =
  "Likely secrets are redacted. Detection is incomplete; a clean preview is not proof that no secret is present.";
export const HISTORICAL_NOTICE =
  "This is the previously rendered response for the same admitted input and world. It is not fresher evidence.";
export const PrivacyDisclosure = z.strictObject({
  redaction: z.literal("structured-likely"), detection: z.literal("incomplete"),
  paths: z.enum(["excluded-marker", "none"]), notice: z.literal(PRIVACY_NOTICE),
});
export type PrivacyDisclosure = z.infer<typeof PrivacyDisclosure>;

export const IdentityDigest = z.templateLiteral(["sha256:", z.string().regex(/^[a-f0-9]{64}$/)]);
export const PrivacyIdentity = z.union([
  z.strictObject({
    status: z.literal("known"),
    domain: z.enum(["failure-slot-v1", "mutating-call-v1", "world-v1", "dependency-pair-v1"]),
    version: z.literal(1), value: IdentityDigest, claim: z.literal("exact-admitted-value"),
  }),
  z.strictObject({
    status: z.literal("known"), domain: z.literal("executable-absent-v1"),
    version: z.literal(1), value: IdentityDigest, claim: z.literal("listed-execution-input-absent"),
  }),
  z.strictObject({
    status: z.literal("unknown"),
    producer: z.enum(["failure", "input", "world", "git", "dependency", "executable"]),
    cause: z.enum([
      "legacy-no-provenance", "outside-closed-domain", "missing", "unreadable", "malformed",
      "stale", "moved", "provider-incomplete", "limit-exceeded",
    ]),
  }),
]);
export type PrivacyIdentity = z.infer<typeof PrivacyIdentity>;

const DECIMAL = "(?:0|[1-9][0-9]*)";
const PRERELEASE = "(?:0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)";
export const SEMVER_PATTERN = `${DECIMAL}\\.${DECIMAL}\\.${DECIMAL}` +
  `(?:-${PRERELEASE}(?:\\.${PRERELEASE})*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?`;
export const SemVer = z.string().max(128).regex(new RegExp(`^${SEMVER_PATTERN}$`));
export const PackageName = z.string().max(214)
  .regex(/^(?:@[a-z0-9][a-z0-9._~-]{0,127}\/)?[a-z0-9][a-z0-9._~-]{0,127}$/);
export const RegistrySpec = z.string().max(129).regex(new RegExp(`^[~^]?${SEMVER_PATTERN}$`))
  .refine(value => SemVer.safeParse(value.replace(/^[~^]/, "")).success);
export const FailureSlot = z.string().regex(/^(?:COV-[a-z0-9-]{1,48}|EX-[A-Za-z0-9._-]{1,64})$/);
export const ClosedFailureKind = z.enum(["assertion", "timeout", "type-error", "configuration", "lint-error", "compile-or-import"]);
export const FailureEvent = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("known"), attempt: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    domain: z.literal("failure-slot-v1"), value: IdentityDigest, slot: FailureSlot,
  }),
  z.strictObject({
    kind: z.literal("unknown"), attempt: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
    cause: z.enum(["legacy-no-provenance", "outside-closed-domain"]),
  }).refine(event => event.attempt !== null || event.cause === "legacy-no-provenance"),
]);
export type FailureEvent = z.infer<typeof FailureEvent>;
export const FailureDiagnosis = z.strictObject({
  domain: z.literal("failure-diagnosis-v1"), version: z.literal(1),
  throughAttempt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  unknownEventIndex: z.number().int().nonnegative().max(7), at: z.iso.datetime(),
});
export type FailureDiagnosis = z.infer<typeof FailureDiagnosis>;
