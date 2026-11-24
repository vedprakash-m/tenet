---
packet: CP-0065
version: 1
---
# CP-0065 stub definition · Paired-hunk finding ratchet

> Split from `CP-0039` (Owner Round 5 adjudication, 2026-11-24) · Blocked by: `CP-0039`.

## Preserved design & round 5 review findings

`CP-0039` core enforces `finding_set` regressions at `touched_files` and `area` granularity and caps all `touched_lines` finding-set checks strictly at `advise`. Making `touched_lines` finding-set checks `enforce`-eligible requires an admitted base-side occurrence input contract so old-hunk vs out-of-hunk legacy findings can be distinguished deterministically without reading unpinned caller state.

**Open critic findings carried verbatim from `CP-0039` round 5:**

- **GPT R5 F2 (Paired hunk enforcement has no admitted old occurrence input):**
  - *Inputs:* `touched_lines`, configured `enforce`, `max_new: 0`; a committed allowance of one occurrence of fingerprint `K`; one tested-side occurrence of `K` inside the new hunk. Compare two base observations, one with the allowed `K` inside the old hunk and one with it outside. Both give the same persisted allowance and tested report. Core admits one report for the tested subject and names no admitted old observation or way to bind it.
  - *Required behavior:* Define the source, pinned revision/check/scope binding, encoding, and matching of old occurrences (without relying on matrix reduction or protected supervision if built before `CP-0061`/`CP-0064`). Test inside versus outside old hunk, wrong-base evidence, and absent old evidence.

- **MAI R5 F1 (Paired `touched_lines` credit has no base-side input contract):**
  - *Concrete inputs:* A committed baseline permits one `fp_key K` in `src/a.ts`, but that allowed occurrence is at unchanged line 100. A PR edits lines 20-21 and introduces a new occurrence with the same `K` in the new hunk. The current report contains one `K` in the edited hunk. The target policy is `max_new: 0`, and the indicator is configured as paired `touched_lines`. (Conversely, a separate case where the one allowed occurrence was inside the old hunk should pass.)
  - *Required change:* Extend `health-input.json` and the bundle with an explicit canonical base/head occurrence map keyed by diff hunk (`old` and `new` findings, base/tested commits, report digests, and scope), and define one-to-one multiset matching between occurrences in that map. The concrete acceptance fixture must include both inputs above and require different verdicts.
