---
packet: CP-0060
version: 1
---
# CP-0060 stub definition · 30-day durability view (R-178)

> Split from `CP-0039` (Owner scope cut, 2026-11-24) · Implements `R-178` · Blocked by: `CP-0039` (also needs `CP-0037` attribution definitions).

## Preserved design & round 4 review findings

Reuses `CP-0039`'s `ALG-15` diff mapper along default-branch `--first-parent` history (`M^1..M`) to measure lines rewritten or reverted within 30 days by `(agent_definition, work_type)`.

**Open critic findings carried from `CP-0039` round 4:**
- **GPT R4 F7 (rolling cutoffs, lineage precision & oversize gaps):** Must persist per-integration RFC 3339 timestamps (`commits[M].integrated_at`) rather than daily aggregates so exact `[as_of - 60d, as_of - 30d]` cutoffs split same-day merges deterministically; track per-path `open_lines` (`[{line, origin_commit, integrated_at}]`, retaining 45d for late receipts); disclose `uncertain_lines` on oversize (`>20k`-line) touched paths instead of guessing zero rewrites; define whether late `work.integrated` receipts replace fallback Git committer times and make incremental and full reducers agree.
- **MAI R4 F4 (reclassifiable lineage & late backfills):** Must maintain per-commit origin records (`work_id`, `agent_definition`, `work_type`, `attribution_revision`), reverse indices from `open_lines` back to `origin_commit`, and idempotent reclassification when delayed `work.integrated` or `CP-0037` attribution arrives after `processed_head` passed. Add `CP-0037` dependency and replay fixtures (`same-day cutoff`, `delayed integration`, `delayed human->agent backfill`, `conflicting attribution`, `rename+rewrite`, `>250 commits`).
