---
tenet: {spec: 1, doc: intent, level: L1, version: "0.1", owner: owner, drafted_from: "{{revision}}"}
sections:
  vision: {state: draft, digest: null, flags: []}
  requirements: {state: draft, digest: null, flags: []}
  design: {state: draft, digest: null, flags: []}
  experience: {state: draft, digest: null, flags: []}
  plan: {state: draft, digest: null, flags: []}
  conflicts: {state: draft, digest: null, flags: []}
---
## Vision
- V-1 {{purpose}} {origin: asked}

## Requirements
- R-1 Freeze overrides require an approver distinct from the requester. {origin: observed; cites: src/core/freeze.js:1-4; serves: V-1}
- R-2 Audit records are append-only and frozen once written. {origin: observed; cites: src/core/audit.js:1-3, doc: docs/adr/0002-append-only-audit.md#decision; scope: global}
- R-3 Unacknowledged incidents past 15 minutes trigger an SLA breach. {origin: observed; cites: src/core/sla.js:1-4}

## Design
- R-20 Core modules do not import HTTP modules. {origin: documented; cites: doc: docs/adr/0001-module-boundaries.md#decision; scope: global}
- R-21 Rollback freezes changes, reverts the tag, then checks /readyz. {origin: documented; cites: doc: docs/runbooks/rollback.md#steps}

## Experience
Undecided, needs the Owner.

## Plan
Undecided, needs the Owner.

## Conflicts
- [ ] CF-1 (section: requirements) README.md advertises database storage; src/store/jsonStore.js uses an in-memory Map. | 1: Correct the storage documentation | 2: Implement a selected database separately
- [ ] CF-2 (section: requirements) docs/adr/0003-soft-delete.md forbids hard deletion; test/retention.test.js expects purge. | 1: Implement soft deletion | 2: Approve and document a retention exception
- [ ] CF-3 (section: requirements) src/config/flags.js defines disabled automatic rollback. | 1: Keep automatic rollback unsupported | 2: Specify and implement the automation
- [ ] CF-4 (section: requirements) docs/issues/018-pagerduty-sync.md describes proposed PagerDuty sync. | 1: Keep the integration as future work | 2: Scope and approve an implementation
