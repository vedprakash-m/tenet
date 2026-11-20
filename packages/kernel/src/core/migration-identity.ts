import { KernelError } from "./errors.ts";
import { sha256, stableStringify } from "./ids.ts";
import { MigrationAfterSnapshotProjectionV1 } from "./schemas-migrate.ts";

export function migrationSnapshotIdentity(value: unknown): {
  afterSnapshotCanonical: string; afterSnapshotHash: string;
  populationCanonical: string; populationHash: string;
} {
  const parsed = MigrationAfterSnapshotProjectionV1.safeParse(value);
  if (!parsed.success)
    throw new KernelError("unsupported-record", "The migration after-snapshot projection is outside the closed domain.");
  // Every admitted object key and scalar string is ASCII, so sorted-key JSON is CanonicalMigrationJsonV1 here.
  const afterSnapshotCanonical = stableStringify(parsed.data);
  const afterSnapshotHash = sha256(`tenet:migration-transition-v3:after-snapshot:v1\0${afterSnapshotCanonical}`);
  const populationCanonical = stableStringify({
    canonicalVersion: 1, populationVersion: 2,
    members: [parsed.data.key.path, ...parsed.data.targets.map(target => target.path)], afterSnapshotHash,
  });
  return {
    afterSnapshotCanonical, afterSnapshotHash, populationCanonical,
    populationHash: sha256(`tenet:migration-transition-v3:population:v2\0${populationCanonical}`),
  };
}
