# Proposals — CP-0042 round 11

Questions from building the independent conformance suite (`pkg/conformance/replay-trust/`):

1. **`replay(history, snapshot, asOf)` exact return fields (`plan/alpha.2.md:10`, `K §1`):** `plan/alpha.2.md:10` specifies `{ transitions, state, findings }`. What exact fields identify each item in `transitions[]` (`{ event_id, type, status: "justified"|"pending-evidence"|"unjustified", reason? }`) and is close endpoint metadata stored on `state.endpoint` vs top-level replay result?
2. **`observeTrust(input, asOf)` return shape & `doctor` trust output (`plan/alpha.2.md:9–11`, `evidence.md §4`):** How are T1–T4 observations (`enforced|declared|spot-checked|unavailable|unknown`) and `merge_requires_status` (`enforced|not-enforced|unavailable`) combined with the 7-day staleness threshold (`evidence.md §4 line 82`) into the trust object read by `tenet doctor`?
3. **`requiredOutcome` signature and `degraded`/`reasons` fields (`plan/alpha.2.md:10`, `CI §10`):** What exact arguments does `requiredOutcome` take and how does it format `reasons[]` for store loss (`results not kept`), explicit overrides (`accepted-without-verification`), and missing T4 separation on shared-account approvals?
4. **Release-boundary close endpoint (`plan/alpha.2.md:13`, `K §5`):** Which close endpoints (`checked`, `integrated`, `implemented-unverified`, `cancelled`, `superseded`) are computed automatically by `replay` in `alpha.2` versus deferred to the GA `close` command (`0.1.0`/`0.1.x`)?
