---
tenet: {spec: 1, doc: plan, level: L2, version: "0.1", owner: "<owner>"}
sections:
  milestones: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
  waves: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
  open-work: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
  completeness-checklist: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
---
# <Project> plan

> Level L2 · Version 0.1 · Implements `kit/templates/requirements.md` · Owner: `<owner>` · Budget: 6,000 tokens

## Milestones

| Milestone | Scope | Gate | Status |
|---|---|---|---|
| M1 | Single-retry timeout handling and log redaction | All tagged acceptance tests pass on CI | planned |

## Waves

| Wave | Work items | Needs |
|---|---|---|
| W1 | Retry idempotency key and timeout handler | — |

## Open work

<!-- Worked example statement: -->
- R-6 Implement `retryOnce` idempotency guard and unit tests before adding async webhooks. {origin: documented; cites: doc: docs/roadmap.md#q4; serves: V-V1}

## Completeness checklist

- [ ] Every milestone has an objective release gate separate from future horizons
- [ ] Waves have explicit `Needs` with no dependency cycles
- [ ] Referenced issues or docs resolve (`tenet check` passes)
- [ ] Document stays under 90% of its token budget
