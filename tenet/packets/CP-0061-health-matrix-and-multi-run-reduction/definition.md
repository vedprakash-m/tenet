---
packet: CP-0061
version: 1
---
# CP-0061 stub definition · Matrix and multi-run reduction

> Split from `CP-0039` (Owner scope cut, 2026-11-24) · Blocked by: `CP-0039`.

## Preserved design & round 4 review findings

Extends `CP-0039` (which accepts strictly one raw report per `checks.<name>` run with no matrix shard combining) to support multi-shard CI matrices (`matrix-agree`, `matrix-distinct`), secondary `checks.<name>.health_reports[]` slots, and multi-run reports.

**Open critic findings carried from `CP-0039` round 4:**
- **GPT R4 F8 & MAI R4 F2 (expected shard manifest & per-kind reduction):** Target policy must declare an authoritative shard manifest `checks.<name>.matrix: {mode, shards: [{id, job, index?, scope_globs?, required?}]}` bound to `bundle.checks[].shard_id`; reject missing last shard, unknown/extra shard, swapped scopes, overlapping selectors, or conflicting shard payloads; disallow `matrix-*` without declared shards; reduce `matrix-agree` by exact normalized equality (`sampled_runs` concatenates `samples`); reduce `matrix-distinct` scalars strictly via additive `sum(numerator_i)/sum(denominator_i)` (refuse non-additive scalars), compose full `architecture_graph` inputs across ALL shards before running Tarjan SCC (preventing missed cross-shard cycles), and aggregate all SARIF `runs[]` cleanly.
