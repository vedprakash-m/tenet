---
tenet: {spec: 1, doc: prd, level: L1, version: "0.1", owner: "<owner>"}
sections:
  scope: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["src/**"], flags: []}
  requirements: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, anchors: {}, flags: []}
  conflicts: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, anchors: {}, flags: []}
  open-questions: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, anchors: {}, flags: []}
  completeness-checklist: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
---
# <Project> product requirements

> Level L1 · Version 0.1 · Serves `tenet/vision.md` · Owner: `<owner>` · Budget: 9,000 tokens

## Scope

In scope: checkout payment execution and retry policy. Out of scope: ledger reconciliation UI.

## Requirements

<!-- Requirements may be list items OR table rows whose first column is `ID` (onboarding.md §1). -->

- R-1 A payment request that times out is retried once, never twice. {origin: observed; cites: src/checkout/retry.ts:10-22; serves: V-V1, V-P1}
- R-2 Raw card numbers are never written to application logs. {origin: asked; serves: V-B1; scope: global}

| ID | Requirement | Serves | Origin | Cites | Scope |
|---|---|---|---|---|---|
| R-3 | Explicit gateway declines fail immediately without retry. | V-P1 | documented | doc: docs/payments.md#decline-policy | — |

## Conflicts

- [ ] CF-1 (section: requirements) Docs state two retries; `src/checkout/retry.ts:12` retries once. | 1: retry once | 2: retry twice

## Open questions

- [ ] Q-1 (section: requirements) Should idempotency keys expire after 24h or 7d?

## Completeness checklist

- [ ] Every requirement has a unique ID (assigned by `tenet fix`), `serves:` pointing to vision items, and a valid `origin`
- [ ] Every `observed` or `documented` statement cites existing lines, a test (`test: file > name`), or a heading (`doc: path#slug`)
- [ ] Every cross-cutting never-do carries `scope: global`
- [ ] Every `CF-` conflict is settled and no `origin: inferred` statement stays before `tenet bless`
- [ ] Document size stays under 90% of its token budget
