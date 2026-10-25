// Declared outputs are checked before every run (EVD-09); the rules are pure, in core/outputs.ts.
import { glob } from "../core/exclusions.ts";
import { declaredInputs } from "../core/obligations.ts";
import { declaredOutputs, outputsProblem as problem } from "../core/outputs.ts";
import type { WorkContract } from "../core/schemas.ts";
import type { Ports } from "../ports/types.ts";

export async function outputsProblem(ports: Ports, w: WorkContract): Promise<string | null> {
  const patterns = declaredOutputs(w.obligations);
  if (!patterns.length) return null;
  const inputs = declaredInputs(w.obligations);
  const inv = await ports.git.inventory([], inputs); // no omission: the full view
  return problem({
    patterns, paths: inv.entries.keys(), untracked: new Set(inv.status.filter((s) => s.untracked).map((s) => s.path)),
    begun: new Set(w.git.start.dirty.map((d) => d.path)), isSource: (p) => ports.stack.classify(p) === "source",
    fixed: new Set([...inputs, ...w.touched.map((t) => t.path), ...w.keepOut]),
    scope: w.scope.paths.map((g) => { const re = glob(g); return (p: string) => re.test(p); }),
  });
}
