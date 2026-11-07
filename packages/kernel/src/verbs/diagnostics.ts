import { z } from "zod";
import { diagnosticsText, DIAGNOSTICS_BYTES } from "../core/diagnostics.ts";
import { sha256 } from "../core/ids.ts";
import { KernelError, type Verb } from "../pipeline.ts";
import type { Recovery, Unresolved } from "./recover-effects.ts";

const target = z.string().min(1).max(240).refine(p =>
  !/^(?:[\\/]|[A-Za-z]:)/.test(p) && !p.includes("\\") &&
  p.split("/").every(part => !!part && part !== "." && part !== ".." && !/^\.git$|^\.tenet$/i.test(part)) &&
  /^[A-Za-z0-9._/-]+\.json$/.test(p), "save needs a relative JSON path outside .git/.tenet, without traversal");
const Input = z.object({ save: target.optional(), previewHash: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict()
  .refine(i => !i.save || !!i.previewHash, "save requires --preview-hash from the complete preview");

export const diagnostics: Verb<z.infer<typeof Input>> = {
  name: "diagnostics", schema: Input, class: i => i.save ? "mutating" : "read-only",
  async preLock(ports) {
    if (!ports.store.exists() || !ports.store.read())
      throw new KernelError("capability-missing", "save requires initialized local state; copy the preview instead", { exit: 2 });
  },
  run(ports, state, input, tx) {
    const log = state ? (tx ? tx.recent() : ports.store.readLog()) : [];
    const text = diagnosticsText(state, log, ports.version, ports.platform,
      ["open", "decide", "check", "findings", "finish", "review", "inspect", "stop", "commit", "packet",
        "integrate", "undo", "diagnostics"]);
    const hash = sha256(text);
    const data = { text, hash, bytes: Buffer.byteLength(text) };
    if (!input.save) return { resp: { data } };
    if (!state || !tx)
      throw new KernelError("capability-missing", "save requires initialized local state; copy the preview instead", { exit: 2 });
    if (input.previewHash !== hash)
      throw new KernelError("capability-missing", "diagnostics preview changed; read a new complete preview before saving", { exit: 2 });
    if (ports.project.exists(input.save))
      throw new KernelError("capability-missing", "diagnostics target already exists; choose a new JSON path", { exit: 2 });
    const id = `diagnostics-${ports.rand.base32(10)}`;
    tx.intent("diagnostics", id, { path: input.save, hash });
    ports.project.writeNew([{ path: input.save, content: text, mode: 0o600 }]);
    tx.result("diagnostics", id, { completed: true });
    return { resp: { data: { ...data, saved: input.save } } };
  },
};

/** An interrupted export never grants write authority: observe once, close it, leave current content alone. */
export async function settleDiagnostics(r: Recovery, u: Unresolved): Promise<void> {
  const op = z.object({ path: target, hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict().safeParse(u.op);
  if (!op.success) {
    r.tx.result("diagnostics", u.id, { completed: false, observed: "invalid-intent" });
    r.completed.push("an invalid diagnostics intent was closed without touching a file");
    return;
  }
  const read = r.ports.project.readBounded(op.data.path, DIAGNOSTICS_BYTES);
  const completed = read.status === "available" && read.sha256 === op.data.hash;
  const observed = read.status === "available" ? (completed ? "matching-content" : "different-content") : read.cause;
  r.tx.result("diagnostics", u.id, { completed, observed });
  r.completed.push(`diagnostics save reconciled: ${observed}; no file was changed`);
}
