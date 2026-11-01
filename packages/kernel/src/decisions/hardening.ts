import { KernelError } from "../core/errors.ts";
import { blockHash, projectBlocks } from "../core/intent-md.ts";
import { sha256 } from "../core/ids.ts";
import type { DecideInput, WorkContract } from "../core/schemas.ts";
import type { Plan } from "../pipeline.ts";
import { withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";

const FILE = "docs/hardening.md";

export interface HardeningOp {
  work: string; file: typeof FILE; before: string | null; after: string;
  block: string; hash: string; updatedAt: string;
}

export const recordedHardening = (work: WorkContract, op: HardeningOp): WorkContract => ({
  ...work, hardening: { block: op.block, hash: op.hash }, updatedAt: op.updatedAt,
});

function gapsOf(input: DecideInput): string[] {
  const gaps = input.gaps;
  if (!gaps || gaps.length < 1 || gaps.length > 12 ||
      gaps.some((gap) => gap.length > 200 || /[\r\n\u2028\u2029]|tenet:(?:begin|end)/i.test(gap))) {
    throw new KernelError(
        "hardening-gaps-invalid",
      "hardening gaps must be 1-12 single-line strings of at most 200 characters without managed-block markers",
      { exit: 2 },
    );
  }
  return gaps;
}

export const hardening: Decision = {
  kind: "hardening",
  run({ ports, tx, state, work, input }): Plan {
    if (work.profile !== "prototype")
      throw new KernelError("capability-missing", "hardening gaps are only recorded for prototype work", { exit: 2 });
    const gaps = gapsOf(input);
    const block = `HARDENING-${work.id}`;
    const now = ports.clock.now();
    const body = [
      `**Prototype ${work.label}: unhardened** (${now.slice(0, 10)})`,
      "- Data: synthetic or public data only",
      ...gaps.map((gap) => `- Gap: ${gap}`),
    ].join("\n") + "\n";
    const existing = ports.project.read(FILE);
    const written = work.hardening?.block === block ? { [block]: work.hardening.hash } : {};
    const projection = projectBlocks(existing, new Map([[block, body]]), written, "# Hardening");
    if (!projection.ok) {
      const where = `line ${projection.line}${projection.id ? ` around ${projection.id}` : ""} (${projection.problem})`;
      throw new KernelError("intent-markers-invalid", `${FILE} ${where}`, { exit: 2 });
    }
    if (projection.external.includes(block)) throw new KernelError("intent-edited-outside", FILE);
    const hash = projection.written[block] ?? blockHash(body);
    const op: HardeningOp = {
      work: work.id, file: FILE, before: existing === null ? null : sha256(existing),
      after: sha256(projection.text), block, hash, updatedAt: now,
    };
    if (projection.text === existing) {
      if (work.hardening?.block === block && work.hardening.hash === hash)
        return { resp: { work: work.id, data: { file: FILE, block, changed: false } } };
      return { state: withWork(state, recordedHardening(work, op)), resp: { work: work.id, data: { file: FILE, block, changed: false } } };
    }
    if (ports.project.hashes([FILE])[FILE] !== op.before) throw new KernelError("intent-edited-outside", FILE);
    const id = `h-${ports.rand.base32(6)}`;
    tx.intent("hardening", id, op);
    ports.project.write(FILE, projection.text);
    tx.result("hardening", id, { completed: true });
    return { state: withWork(state, recordedHardening(work, op)), resp: { work: work.id, data: { file: FILE, block, changed: true } } };
  },
};
