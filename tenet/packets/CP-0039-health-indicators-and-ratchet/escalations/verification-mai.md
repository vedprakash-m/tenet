# CP-0039 final verification - MAI

Reviewed `shape/cp-0039` at `6847acd` against `owner-adjudication-r5.md` and definition version 6.

## MAI round-5 finding

**F1 - RESOLVED.** Definition v6 states: "`touched_lines` finding sets & raw `lcov`/`cobertura` coverage stay strictly advisory (`advise`, `0` gate credit)" and "`touched_lines` (`metric_cap = "advise"` — advisory only in core)". It removes paired enforcement from AB-5 and moves "enforceable paired old/new hunk comparison and its base-side occurrence input contract" to `CP-0065`. The CP-0065 stub preserves the missing base/head occurrence-map requirement and the accepted acceptance fixture.

## Notes for the builder

Keep the core path unable to promote `touched_lines` above `advise`; paired old/new occurrence matching belongs entirely to CP-0065.

VERDICT: AGREE
