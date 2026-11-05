// Kill the real process at the named durable step of the 1 -> 2 migration or its rollback (schema-migration 16.8, M4).
// Usage: crash-migration.ts <dir> <upgrade|rollback> <kill-at-step-number, 0 never>
import { acceptRollback, acceptUpgrade, previewRollback, previewUpgrade } from "../../src/adapters/migration-fs.ts";
import { OPERATION, ROLLBACK, builds, ctx } from "../support/migration-ctx.ts";

const [dir, mode, killAt] = process.argv.slice(2) as [string, "upgrade" | "rollback", string];
let step = 0;
const hooks = { at: () => { if (++step === Number(killAt)) process.kill(process.pid, "SIGKILL"); } };
if (mode === "upgrade") {
  const p = previewUpgrade(dir, builds, ctx.registryVersion);
  if (!p.ok) throw new Error(p.detail);
  console.log(JSON.stringify(acceptUpgrade({ dir, id: OPERATION, builds, ctx, answer: { answer: "yes", factsHash: p.factsHash } }, hooks)));
} else {
  const p = previewRollback(dir);
  if (!p.eligible) throw new Error(p.reasons.join("; "));
  console.log(JSON.stringify(acceptRollback({ dir, id: ROLLBACK, ctx, answer: { answer: "yes", factsHash: p.factsHash } }, hooks)));
}
