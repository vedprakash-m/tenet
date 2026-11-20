import fs from "node:fs";
import { join } from "node:path";
import {
  createStack as productionStack,
  normalize,
  normalizeStatic,
} from "../../src/adapters/node-ts.ts";
import type {
  InstalledMetadataAdmission,
  InstalledMetadataRequest,
} from "../../src/adapters/installed-metadata.ts";

/** Controlled fixtures use this JavaScript reader; production always receives the unavailable payload admission. */
const fixtureAdmission: InstalledMetadataAdmission = (request: InstalledMetadataRequest) => {
  const path = join(request.root, "node_modules", request.relativePath);
  let descriptor = -1;
  try {
    const named = fs.lstatSync(path);
    if (named.isSymbolicLink() || !named.isFile())
      return { status: "unavailable", category: "fixture-path-unavailable" };
    descriptor = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const before = fs.fstatSync(descriptor);
    if (!before.isFile() || before.size > request.maxBytes)
      return { status: "unavailable", category: "fixture-object-unavailable" };
    const bytes = Buffer.alloc(before.size + 1);
    let count = 0;
    while (count < bytes.length) {
      const read = fs.readSync(descriptor, bytes, count, bytes.length - count, count);
      if (!read) break;
      count += read;
    }
    const after = fs.fstatSync(descriptor);
    if (
      count !== before.size || after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs ||
      after.dev !== before.dev || after.ino !== before.ino
    ) return { status: "unavailable", category: "fixture-object-moved" };
    return { status: "file", bytes: bytes.subarray(0, count), fileId: `${after.dev}:${after.ino}` };
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT"
      ? { status: "missing" }
      : { status: "unavailable", category: "fixture-read-unavailable" };
  } finally {
    if (descriptor >= 0) fs.closeSync(descriptor);
  }
};

export const createStack = () => productionStack(fixtureAdmission);
export { normalize, normalizeStatic };
