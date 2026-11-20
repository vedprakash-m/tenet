import { KernelError } from "../core/errors.ts";
import {
  MarkerV3,
  markerBindingCreatePayload,
  markerBindingPayload,
} from "../core/marker-identity.ts";
import type { DirectoryIdentity } from "../core/marker-identity.ts";
import type { MarkerBindingPort, Random } from "../ports/types.ts";

const unavailable = (detail: string): never => {
  throw new KernelError("marker-binding-unavailable", `${detail}; no unbound fallback was used`, { exit: 3 });
};

function admitted<T>(operation: () => T, detail: string): T {
  try { return operation(); }
  catch { return unavailable(detail); }
}

export function createCandidateMarker(
  identity: DirectoryIdentity,
  binding: MarkerBindingPort | undefined,
  rand: Random,
): MarkerV3 {
  const admitted = binding ?? unavailable("the host marker-binding operation is unknown");
  const status = callBinding(() => admitted.status(), "the host marker binding status could not be read");
  if (status.kind === "unknown" || status.kind === "unavailable") unavailable(status.detail);
  const base = {
    workspaceId: `ws_${rand.base32(10)}`,
    tag: rand.base32(4),
    nonce: rand.base32(12),
    identity,
  };
  if (status.kind === "absent") {
    return MarkerV3.parse({
      schema: 3, ...base, dev: Number(identity.dev), ino: Number(identity.ino),
      binding: {
        kind: "none",
        reason: "host-storage-verified-absent",
        capability: status.capabilityHash,
      },
    });
  }
  const signed = callBinding(
    () => admitted.create(markerBindingCreatePayload(base)),
    "the host could not create the marker binding",
  );
  const marker = MarkerV3.parse({
    schema: 3, ...base, dev: Number(identity.dev), ino: Number(identity.ino),
    binding: { kind: "host-key-v1", ...signed },
  });
  const verified = callBinding(
    () => admitted.verify(signed.keyId, markerBindingPayload(marker), signed.authenticator),
    "the host could not verify the marker authenticator",
  );
  if (verified !== "verified") {
    unavailable("the host could not immediately verify the marker authenticator");
  }
  return marker;
}

export function verifyCandidateMarker(marker: MarkerV3, binding: MarkerBindingPort | undefined): void {
  const record = marker.binding;
  if (record.kind === "none") return;
  const admitted = binding ?? unavailable("the host marker-binding operation is unknown");
  const status = callBinding(() => admitted.status(), "the host marker binding status could not be read");
  if (status.kind !== "available") unavailable("the marker's host-held binding is unavailable");
  const result = callBinding(
    () => admitted.verify(record.keyId, markerBindingPayload(marker), record.authenticator),
    "the marker's host-held binding could not be verified",
  );
  if (result !== "verified") unavailable("the marker's host-held binding does not verify");
}

const callBinding = <T>(operation: () => T, detail: string): T => admitted(operation, detail);
