import { z } from "zod";

const DECIMAL = /^(?:0|[1-9][0-9]{0,39})$/;
const POSITIVE_DECIMAL = /^(?:[1-9][0-9]{0,39})$/;
const DIGEST = /^[a-f0-9]{64}$/;

export const DirectoryIdentity = z.strictObject({
  kind: z.literal("directory-v1"),
  platform: z.enum(["darwin", "linux", "win32"]),
  architecture: z.enum(["arm64", "x64"]),
  filesystem: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  dev: z.string().regex(POSITIVE_DECIMAL),
  ino: z.string().regex(POSITIVE_DECIMAL),
  birthNs: z.string().regex(POSITIVE_DECIMAL),
});
export type DirectoryIdentity = z.infer<typeof DirectoryIdentity>;

export const MarkerBinding = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("host-key-v1"),
    keyId: z.string().regex(/^[a-z2-7]{24}$/),
    authenticator: z.string().regex(DIGEST),
  }),
  z.strictObject({
    kind: z.literal("none"),
    reason: z.literal("host-storage-verified-absent"),
    capability: z.string().regex(DIGEST),
  }),
]);
export type MarkerBinding = z.infer<typeof MarkerBinding>;

export const MarkerV3 = z.strictObject({
  schema: z.literal(3),
  workspaceId: z.string().regex(/^ws_[a-z2-7]{10}$/),
  tag: z.string().regex(/^[a-z2-7]{4}$/),
  nonce: z.string().regex(/^[a-z2-7]{12}$/),
  dev: z.number().finite(),
  ino: z.number().finite(),
  identity: DirectoryIdentity,
  binding: MarkerBinding,
});
export type MarkerV3 = z.infer<typeof MarkerV3>;

export const sameDirectoryIdentity = (left: DirectoryIdentity, right: DirectoryIdentity): boolean =>
  left.kind === right.kind &&
  left.platform === right.platform &&
  left.architecture === right.architecture &&
  left.filesystem === right.filesystem &&
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.birthNs === right.birthNs;

export function markerBindingPayload(marker: Pick<MarkerV3, "workspaceId" | "tag" | "nonce" | "identity" | "binding">): unknown[] {
  return [
    "tenet-marker",
    3,
    marker.workspaceId,
    marker.tag,
    marker.nonce,
    marker.identity.kind,
    marker.identity.platform,
    marker.identity.architecture,
    marker.identity.filesystem,
    marker.identity.dev,
    marker.identity.ino,
    marker.identity.birthNs,
    marker.binding.kind === "host-key-v1" ? marker.binding.keyId : null,
  ];
}

export function markerBindingCreatePayload(marker: Pick<MarkerV3, "workspaceId" | "tag" | "nonce" | "identity">): unknown[] {
  return markerBindingPayload({
    ...marker,
    binding: { kind: "none", reason: "host-storage-verified-absent", capability: "0".repeat(64) },
  }).slice(0, -1);
}

export const CanonicalDecimal = z.string().regex(DECIMAL);
