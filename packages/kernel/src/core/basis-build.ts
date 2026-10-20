// The elements a basis proposal becomes: stable IDs after the highest sequence, examples numbered under their requirement,
// verification links, and test files checked to be editable project paths (TS §7.9, §8.7). Pure.
import type { z } from "zod";
import { KernelError } from "./errors.ts";
import { allowed } from "./exclusions.ts";
import { elementId, highestSeq, KIND_PREFIX } from "./ids.ts";
import { linkElement } from "./obligations.ts";
import type { BasisProposal } from "./schemas.ts";
import type { BasisElement, State, WorkContract } from "./schemas.ts";

const REQ = /^REQ-(\d+)-([a-z0-9]+)$/;
const safePath = (p: string) => !p.startsWith("/") && !p.split("/").includes("..") && allowed("edit", p);

type Proposed = z.infer<typeof BasisProposal>["elements"][number];

/** The highest example number already used under each requirement, not counting this contract's own elements. */
function exampleCounts(all: readonly BasisElement[], own: ReadonlySet<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of all) {
    const m = own.has(e.id) ? null : /^(EX-\d+-[a-z0-9]+)\.(\d+)$/.exec(e.id);
    if (m) counts.set(m[1]!, Math.max(counts.get(m[1]!) ?? 0, Number(m[2])));
  }
  return counts;
}

/** The element a proposed one becomes; only an example carries a test. */
function shaped(e: Proposed, id: string, parent: string | undefined): BasisElement {
  const el: BasisElement = { id, origin: e.origin, kind: e.kind, text: e.text, verifiedBy: [] };
  if (parent) el.of = parent;
  if (e.kind === "example") {
    el.test = e.test ?? "distinguishing";
    if (e.testFile) el.testFile = e.testFile;
    if (e.support?.length) el.support = e.support;
    if (e.expect) el.expect = e.expect;
  }
  return el;
}

export function build(
  proposal: z.infer<typeof BasisProposal>,
  state: State,
  w: WorkContract,
  suffix: () => string
): { elements: BasisElement[]; ids: Record<string, string> } {
  const own = new Set(w.basis?.elementIds ?? []);
  const all = state.project.intent.elements;
  let seq = highestSeq(all);
  const ids: Record<string, string> = {};
  const idOf = (ref: string | undefined) => (ref ? (ids[ref] ?? (all.some((e) => e.id === ref) ? ref : undefined)) : undefined);
  const exampleCount = exampleCounts(all, own);

  const assign = (e: Proposed): string => {
    if (e.ref && own.has(e.ref)) return e.ref; // a refinement keeps stable ids
    if (e.kind === "example") {
      const parent = idOf(e.of);
      const m = parent ? REQ.exec(parent) : null;
      if (m) {
        const stem = `EX-${m[1]}-${m[2]}`;
        const n = (exampleCount.get(stem) ?? 0) + 1;
        exampleCount.set(stem, n);
        return `${stem}.${n}`;
      }
      return `${elementId("EX", ++seq, suffix())}.1`;
    }
    return elementId(KIND_PREFIX[e.kind], ++seq, suffix());
  };

  // Requirements first, so examples can name their parent by ref in any order.
  const order = [...proposal.elements.keys()].sort(
    (a, b) => Number(proposal.elements[a]!.kind === "example") - Number(proposal.elements[b]!.kind === "example")
  );
  const built: BasisElement[] = [];
  for (const i of order) {
    const e = proposal.elements[i]!;
    if (e.testFile && !safePath(e.testFile))
      throw new KernelError("restriction-key-unknown", `test file "${e.testFile}" is outside the project or not editable`);
    const id = assign(e);
    if (e.ref) ids[e.ref] = id;
    built.push(shaped(e, id, idOf(e.of)));
  }
  built.sort(
    (a, b) =>
      proposal.elements.findIndex((x) => ids[x.ref ?? ""] === a.id) -
      proposal.elements.findIndex((x) => ids[x.ref ?? ""] === b.id)
  );
  for (const el of built) el.verifiedBy = linkElement(el, built);
  return { elements: built, ids };
}
