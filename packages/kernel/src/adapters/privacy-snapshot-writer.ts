import { lstatSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  PrivateSnapshotRequestV1, PrivateSnapshotRefV3, PrivacyForwardTransitionV3, ProviderSnapshotAttestationV3,
} from "../core/schemas-migrate.ts";
import type { PrivateSnapshots } from "../ports/private-snapshot.ts";
import { migrationSnapshotIdentity } from "../core/migration-identity.ts";
import { withCandidateLocks } from "./marker-lock.ts";
import {
  admitSnapshotBefore, attestationDirectory, publishAttestation, publishSnapshotTransition, readSnapshotRecord, snapshotRefusal,
} from "./privacy-snapshot-records.ts";

export type PrivacySnapshotDraft = Omit<PrivacyForwardTransitionV3, "snapshot">;
export interface PrivacySnapshotGate {
  authorize(draft: PrivacySnapshotDraft): void;
  admitTargets(draft: PrivacySnapshotDraft): void;
  syncDirectory(path: string): void;
}

function admitDraft(request: PrivateSnapshotRequestV1, value: unknown): PrivacySnapshotDraft {
  const parsed = PrivacyForwardTransitionV3.omit({ snapshot: true }).safeParse(value);
  if (!parsed.success) return snapshotRefusal();
  const draft = parsed.data, p = draft.privacy;
  if (draft.phase !== "prepared" || draft.operationId !== request.operationId ||
      !isDeepStrictEqual(draft.root, request.storeRoot) ||
      !isDeepStrictEqual(request.p91Completion.marker, {
        workspaceId: draft.marker.workspaceId, tag: draft.marker.tag, nonce: draft.marker.nonce,
      })) return snapshotRefusal();
  if (p.targets.some(target => target.tempPath !== `${target.path}.tmp-${request.operationId}`) ||
      p.keyRecord.tempPath !== `digest.key.tmp-${request.operationId}` ||
      p.digestKeyId !== p.keyRecord.after.digestKeyId ||
      !isDeepStrictEqual(p.journal.before, p.journal.final) || p.journal.before.path !== "log") return snapshotRefusal();
  for (const [index, source] of [[0, request.p91Completion.state.previous], [1, request.p91Completion.state.primary]] as const) {
    const before = p.targets[index].before;
    if (before.presence !== "present" || before.schema !== 2 ||
        !isDeepStrictEqual(before.identity, source.identity)) return snapshotRefusal();
  }
  for (const name of ["target", "evidence"] as const)
    if (draft.evidence[name].path !== `migration-evidence-v2/${request.operationId}/${name}.json` ||
        draft.evidence[name].proof !== null) return snapshotRefusal();
  if (draft.evidence.recovery.tempPath !== `migration-recovery-v3.json.tmp-${request.operationId}` ||
      draft.evidence.recovery.proof !== null || draft.evidence.previousBridgeDigest !== request.p91Completion.bridgeDigest)
    return snapshotRefusal();
  const hashes = migrationSnapshotIdentity({
    operation: p.operation, populationVersion: p.populationVersion,
    key: { path: p.keyRecord.path, after: p.keyRecord.after },
    targets: p.targets.map(target => { const { path, ...after } = target.after; return { path, after }; }),
  });
  if (hashes.afterSnapshotHash !== p.afterSnapshotHash || hashes.populationHash !== p.populationHash) return snapshotRefusal();
  return draft;
}

function sameSnapshot(left: PrivateSnapshotRefV3, right: PrivateSnapshotRefV3): boolean {
  return left.provider === right.provider && left.handle === right.handle && left.copySetVersion === right.copySetVersion;
}

function prepareLocked(
  dir: string, request: PrivateSnapshotRequestV1, snapshots: PrivateSnapshots, draft: PrivacySnapshotDraft, gate: PrivacySnapshotGate,
): PrivacyForwardTransitionV3 {
  gate.authorize(draft); gate.admitTargets(draft);
  admitSnapshotBefore(dir, draft);
  const existing = readSnapshotRecord(join(dir, "migration-transition.json"));
  let transition: PrivacyForwardTransitionV3;
  if (existing !== null) {
    const parsed = PrivacyForwardTransitionV3.safeParse(existing);
    if (!parsed.success) return snapshotRefusal();
    transition = parsed.data;
    const { snapshot: _snapshot, ...storedDraft } = transition;
    if (!["prepared", "snapshot"].includes(transition.phase) ||
        !isDeepStrictEqual({ ...storedDraft, phase: "prepared" }, draft)) return snapshotRefusal();
    if (transition.phase === "prepared" && transition.snapshot.privateSource.capture !== "reserved" ||
        transition.snapshot.sourceAttestationPath !== `migration-evidence-v2/${request.operationId}/source.json` ||
        readSnapshotRecord(join(dir, transition.snapshot.sourceAttestationPath)) === null) return snapshotRefusal();
    attestationDirectory(dir, request.operationId, gate.syncDirectory, false);
    const expected = ProviderSnapshotAttestationV3.parse({
      format: 3, operationId: request.operationId, sourceSchema: 2, p91Completion: request.p91Completion,
      snapshot: { ...transition.snapshot.privateSource, capture: "reserved" },
    });
    const proof = publishAttestation(join(dir, transition.snapshot.sourceAttestationPath), expected, gate.syncDirectory);
    if (!isDeepStrictEqual(proof, transition.snapshot.sourceAttestationProof) ||
        proof.sha256 !== transition.snapshot.sourceAttestationSha256) return snapshotRefusal();
  } else {
    const orphan = snapshots.orphan({
      storeRoot: request.storeRoot, p91Completion: request.p91Completion, copySetVersion: 1,
    });
    if (orphan.kind !== "none" && (orphan.kind !== "matching" || orphan.operationId !== request.operationId))
      return snapshotRefusal();
    const snapshot = PrivateSnapshotRefV3.parse(orphan.kind === "matching" ? orphan.snapshot : snapshots.reserve(request));
    if (snapshot.capture !== "reserved") return snapshotRefusal();
    const evidenceDir = attestationDirectory(dir, request.operationId, gate.syncDirectory);
    const proof = publishAttestation(join(evidenceDir, "source.json"), {
      format: 3, operationId: request.operationId, sourceSchema: 2, p91Completion: request.p91Completion, snapshot,
    }, gate.syncDirectory);
    transition = publishSnapshotTransition(dir, {
      ...draft, snapshot: {
        sourceAttestationPath: proof.path, sourceAttestationSha256: proof.sha256,
        sourceAttestationProof: proof, privateSource: snapshot,
      },
    }, gate.syncDirectory);
  }
  if (transition.phase === "snapshot") {
    if (transition.snapshot.privateSource.capture !== "complete" ||
        snapshots.compare(request, transition.snapshot.privateSource) !== "exact") return snapshotRefusal();
    return transition;
  }
  const complete = PrivateSnapshotRefV3.parse(snapshots.capture(request, transition.snapshot.privateSource));
  if (!sameSnapshot(complete, transition.snapshot.privateSource) || complete.capture !== "complete" ||
      snapshots.compare(request, complete) !== "exact") return snapshotRefusal();
  return publishSnapshotTransition(dir, {
    ...transition, phase: "snapshot", snapshot: { ...transition.snapshot, privateSource: complete },
  }, gate.syncDirectory);
}

export function preparePrivacySnapshot(
  workspace: string, input: PrivateSnapshotRequestV1, snapshots: PrivateSnapshots,
  value: unknown, gate: PrivacySnapshotGate,
): PrivacyForwardTransitionV3 {
  const request = PrivateSnapshotRequestV1.safeParse(input);
  if (!request.success) return snapshotRefusal();
  const draft = admitDraft(request.data, value), dir = join(workspace, ".tenet");
  const stat = lstatSync(dir, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink() || String(stat.dev) !== draft.root.dev ||
      String(stat.ino) !== draft.root.ino || String(stat.birthtimeNs) !== draft.root.birthNs) return snapshotRefusal();
  return withCandidateLocks(workspace, request.data.operationId,
    () => prepareLocked(dir, request.data, snapshots, draft, gate));
}
