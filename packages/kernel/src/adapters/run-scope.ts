import { lstatSync } from "node:fs";
import { join } from "node:path";
import { KernelError } from "../core/errors.ts";

export function runScopeSnapshot(base: string | null): Array<{ path: string; identity: string }> {
  if (!base) return [];
  return [base, join(base, "manifests"), join(base, "review")].flatMap((path) => {
    const st = lstatSync(path, { bigint: true, throwIfNoEntry: false });
    if (!st) return [];
    if (st.isSymbolicLink() || !st.isDirectory()) {
      throw new KernelError("storage-accounting-unknown",
        "the project run scope could not be measured safely; no cleanup was started");
    }
    return [{ path, identity: `${st.dev}:${st.ino}:${st.size}:${st.mtimeNs}:${st.ctimeNs}:${st.nlink}` }];
  });
}
