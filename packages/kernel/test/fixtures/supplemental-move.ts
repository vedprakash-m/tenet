import { fstatSync, lstatSync, renameSync } from "node:fs";
import { KernelError } from "../../src/core/errors.ts";

// Test seam only: no host atomic no-replace primitive is qualified by this implementation.
export function supplementalMove(source: string, target: string): void {
  if (lstatSync(target, { throwIfNoEntry: false })) {
    throw new KernelError("storage-accounting-unknown", "synthetic occupied-target refusal");
  }

  renameSync(source, target);
}

// Synthetic restart fixture only. Inode-derived fixture labels do not qualify non-reusable provider generations.
export function supplementalGeneration(_path: string, descriptor: number) {
  const stat = fstatSync(descriptor, { bigint: true });
  return { version: 1 as const, domain: "store-object-generation-v1" as const, opaque: `synthetic-${stat.dev}-${stat.ino}` };
}

export const syntheticMount = {
  version: 1 as const, tokenNamespace: "store-rotation-reservation-v1" as const,
  root: {
    kind: "directory-v1" as const, platform: "linux" as const, architecture: "x64" as const, filesystem: "ext4",
    dev: "1", ino: "2", birthNs: "3",
  },
  directory: {
    dev: "1", ino: "2", type: "directory" as const, links: 1,
    objectGeneration: { version: 1 as const, domain: "store-object-generation-v1" as const, opaque: "synthetic-directory" },
  },
  discriminator: { version: 1 as const, domain: "store-mount-binding-v1" as const, opaque: "synthetic-mount" },
};
