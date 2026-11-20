import { fstatSync } from "node:fs";
import { KernelError } from "../core/errors.ts";
import { DirectoryIdentity } from "../core/marker-identity.ts";
import { sha256, stableStringify } from "../core/ids.ts";
import type { RetentionProjection } from "../core/retention-original-action.ts";
import { ReservationMountBindingV1, rotationIndexAuthorization } from "../core/retention-records.ts";
import type { RetentionProgress } from "../core/retention-records.ts";
import { RetentionProgressStore } from "./retention-progress-fs.ts";
import { admitRotation, type RotationIndexReservation, type RotationReservation } from "./retention-rotation-fs.ts";
import { StorageV3Files } from "./storage-v3-write.ts";

export interface SealAdmission {
  root: DirectoryIdentity;
  exclusiveNameToken: string;
  indexExclusiveNameToken: string;
  captureMount(heldDescriptor: number): unknown;
  verifyReservation(reservation: RotationReservation, heldDescriptor: number): boolean;
  verifyIndexTemp(reservation: RotationIndexReservation, heldDescriptor: number): boolean;
}
const refused = () => new KernelError(
  "storage-accounting-unknown", "the empty rotation reservation cannot be proved in the admitted Store mount", { exit: 2 },
);

/** The provider must prove root/mount and canonical spelling; path equality is never a default admission. */
export function sealGeneration<P extends RetentionProjection>(
  files: StorageV3Files, store: RetentionProgressStore<P>, admission: SealAdmission,
  build: (reservation: RotationReservation) => {
    record: Omit<RetentionProgress<P>, "rotation"> & { rotation: Omit<RetentionProgress<P>["rotation"], "indexTemp"> };
    afterIndex: Buffer;
  },
  boundary: (phase: "reserved" | "index-reserved" | "seal-started" | "sealed") => void = () => {},
) {
  const root = DirectoryIdentity.parse(admission.root), token = admission.exclusiveNameToken;
  const indexToken = admission.indexExclusiveNameToken;
  if (!/^[a-z2-7]{24}$/.test(token) || !/^[a-z2-7]{24}$/.test(indexToken) || token === indexToken ||
    typeof admission.captureMount !== "function" || typeof admission.verifyReservation !== "function" ||
    typeof admission.verifyIndexTemp !== "function") throw refused();
  files.requireAtomicMove();
  files.requireObjectGeneration();
  files.absent("compaction.retention.json");
  files.absent(`compaction.retention.json.tmp-${token}`);
  files.absent("rotation-index.tmp");
  return files.withEmptyReservation((proof, descriptor) => {
    const mount = ReservationMountBindingV1.safeParse(admission.captureMount(descriptor));
    if (!mount.success || stableStringify(mount.data.root) !== stableStringify(root)) throw refused();
    const next: RotationReservation = {
      version: 1, exclusiveNameToken: token, path: "log.next", mount: mount.data, identity: proof.identity, bytes: 0, sha256: sha256(""),
    };
    const verify = () => {
      const stat = fstatSync(descriptor, { bigint: true });
      if (String(stat.dev) !== next.identity.dev || String(stat.ino) !== next.identity.ino ||
        !stat.isFile() || stat.nlink !== 1n || stat.size !== 0n) throw refused();
      files.verify(proof);
      if (admission.verifyReservation(structuredClone(next), descriptor) !== true) throw refused();
    };
    verify(); boundary("reserved");
    const proposed = build(structuredClone(next)), afterIndex = Buffer.from(proposed.afterIndex);
    const before = files.read("journal-index.json");
    if (!before) throw refused();
    return files.withReservation("rotation-index.tmp", afterIndex, (indexProof, indexDescriptor) => {
      const indexTemp: RotationIndexReservation = {
        version: 1, exclusiveNameToken: indexToken, ...indexProof, path: "rotation-index.tmp", mount: mount.data,
        authorization: rotationIndexAuthorization(proposed.record, before.proof),
      };
      let admitted = false, publicationStarted = false;
      const verifyPair = () => {
        verify(); files.verify(indexProof);
        if (admission.verifyIndexTemp(structuredClone(indexTemp), indexDescriptor) !== true) throw refused();
      };
      try {
        verifyPair(); admitted = true; boundary("index-reserved");
        const record = store.validate({
          ...proposed.record, rotation: { ...proposed.record.rotation, indexTemp },
        });
        if (record.phase !== "seal" || record.sealGate.state !== "preparing" ||
          stableStringify(record.rotation.next) !== stableStringify(next)) throw refused();
        admitRotation(files, record, afterIndex, () => { verifyPair(); return true; });
        verifyPair(); publicationStarted = true; boundary("seal-started");
        const progress = store.create(record);
        verifyPair(); boundary("sealed");
        return { progress, afterIndex };
      } catch (error) {
        if (admitted && !publicationStarted) {
          verifyPair();
          files.remove(indexProof);
          files.remove(proof);
        }
        throw error;
      }
    });
  });
}
