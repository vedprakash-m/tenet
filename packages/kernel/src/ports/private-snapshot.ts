import type { PrivateSnapshotRefV3, PrivateSnapshotRequestV1 } from "../core/schemas-migrate.ts";

/** Store's provider boundary: no source bytes, inventory, private path or source digest is returned. */
export interface PrivateSnapshots {
  reserve(request: PrivateSnapshotRequestV1): PrivateSnapshotRefV3;
  capture(request: PrivateSnapshotRequestV1, snapshot: PrivateSnapshotRefV3): PrivateSnapshotRefV3;
  compare(request: PrivateSnapshotRequestV1, snapshot: PrivateSnapshotRefV3): "exact" | "mismatch" | "unknown";
  orphan(request: Omit<PrivateSnapshotRequestV1, "operationId">):
    | { kind: "none" | "conflict" | "unavailable" }
    | { kind: "matching"; operationId: string; snapshot: PrivateSnapshotRefV3 };
}
