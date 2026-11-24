---
packet: CP-0063
version: 1
---
# CP-0063 stub definition · Merge-time atomicity and signed recovery

> Split from `CP-0039` (Owner scope cut, 2026-11-24) · Blocked by: `CP-0039` (also needs `CP-0035` merge-queue candidate binding).

## Preserved design & round 4 review findings

Extends `CP-0039` (which waives at evaluation time against committed `.tenet/health-baseline.json` at `<base>`) with atomic pre-merge basis/expiry checks (`evaluateMergeTransition`), post-merge active exception tracking (`R-143` area decline), and immutable integration/recovery replay.

**Open critic findings carried from `CP-0039` round 4:**
- **GPT R4 F1 (atomic merge transitions vs async forge checks):** Asynchronous `workflow_run`/`push`/`schedule` checks cannot prevent a records-only tightening or `Decision.expiry` crossing between check completion and merge; requires either a synchronous pre-merge host admission hook (`enforced*`) or declaring the async forge binding `detected` and withholding unattended auto-merge unless `tenet merge` runs synchronously. Add zero-refresh race fixture.
- **GPT R4 F6 (anchored integration & recovery inventory):** Must specify the signed `work.integrated` event schema (`kernel.md:29`) and commit-anchored inventory (`health/integrations/<commit>.json` listing `prev_integration_commit`, `seq`, `waiver_decision_ids[]`) so replay distinguishes clean no-waiver integrations from missing integration/recovery receipts (`unknown`/`declined` under `R-143`).
