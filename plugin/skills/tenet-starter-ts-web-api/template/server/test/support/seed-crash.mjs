import { openDb } from "../../src/platform/db.ts";
import { seedDevIdentities } from "../../src/platform/dev-identities.ts";

const [file, envFile, boundary] = process.argv.slice(2);
const db = openDb(file);
const transaction = db.transaction.bind(db);
const pause = () => {
  process.send(boundary);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
};
db.transaction = (fn) => {
  const tx = transaction(() => {
    const result = fn();
    if (boundary === "before-commit") pause();
    return result;
  });
  return {
    immediate() {
      const result = tx.immediate();
      if (boundary === "after-commit") pause();
      return result;
    },
  };
};
await seedDevIdentities(db, envFile, 123);
throw new Error("seed finished without reaching the requested transaction boundary");
