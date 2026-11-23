---
tenet: {spec: 1, doc: escalation, level: L2, version: "0.1", owner: "<owner>"}
sections:
  what-was-attempted: {level: L2, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
  where-it-rubs: {level: L2, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
  resolution: {level: L2, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
  completeness-checklist: {level: L2, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
---
# Escalation: <one-line summary>

> Work item: `<CP-... or pr-...>` · Stop signal: `<3 failing evaluations | conflicting requirements | change needs spec or test change | over appetite>` · Lowest level that can decide: `<env | agent | L4 | L3 | L2 | L1 | L0 | owner>`

## What was attempted

<!-- Worked example (replace with this escalation's facts): -->
- Run on `pr-42` attempted a third retry after gateway 504; CI evaluation failed 3 consecutive times on `R-1`.

## Where it rubs

- `R-1` (blessed, L1): "A payment request that times out is retried at most once, never twice."
- `pr-42` task request: "Retry 504 responses up to three times."

## Resolution

1. Stop: keep `pr-42` paused until decided.
2. Keep `R-1` (max one retry) and narrow `pr-42`.
3. Propose an update to `R-1` for 504 responses for owner approval.

## Completeness checklist

- [ ] Quotes exact conflicting specification lines with their IDs (`R-...`, `V-...`, `AB-...`)
- [ ] Names the stop signal and evidence (evaluation IDs, failing checks or runs)
- [ ] Names the lowest level (`env`, `agent`, `L4`–`L0`, or `owner`) that can resolve it
- [ ] Lists `stop` as the first option
