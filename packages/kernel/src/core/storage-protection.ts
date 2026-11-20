import type { State } from "./schemas.ts";

/** Paths whose bytes cannot be evicted from the project temp scope before their records are reconciled. */
export function protectedRunPaths(
  state: State | null,
  unresolved: ReadonlyArray<{ op: unknown }>,
): string[] {
  const legacy = state?.project.retention?.legacyTemp.path;
  const active = Object.values(state?.work ?? {}).flatMap((work) =>
    [
      work.session.inCall?.runDir,
      work.focusedReview?.manifest,
      ...work.budget.reservations.map((reservation) => reservation.manifest),
    ].filter((path): path is string => !!path)
  );
  const recovering = unresolved.flatMap(({ op }) => {
    if (typeof op !== "object" || op === null || !("runDir" in op)) return [];
    const path = op.runDir;
    return typeof path === "string" && path ? [path] : [];
  });
  return [...(legacy ? [legacy] : []), ...active, ...recovering];
}
