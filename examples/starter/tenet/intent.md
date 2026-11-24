---
tenet: {spec: 1, doc: intent, level: L1, version: "0.1", owner: "Ved"}
sections:
  vision: {level: L0, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, anchors: {}, flags: []}
  requirements: {level: L1, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, anchors: {}, flags: []}
  design: {level: L2, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["src/**"], flags: []}
  experience: {level: L2, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["src/**"], flags: []}
  plan: {level: L2, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["src/**"], flags: []}
  conflicts: {level: L2, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, anchors: {}, flags: []}
  open-questions: {level: L2, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, anchors: {}, flags: []}
  completeness-checklist: {level: L2, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
---
# tenet-starter intent

> One-file starter specification (split sections later with `tenet split`). Run `tenet fix` to assign IDs and compute digests.

## Vision

<!-- Purpose, primary users, north star, value table, boundaries. Never name tools, files or vendors here. -->

| ID | Purpose or boundary | Serves / Target | Origin |
|---|---|---|---|
| V-1 | Undecided · edit or run tenet onboard | ≤1% checkout timeout failure | asked |

## Requirements

- R-1 A payment request that times out is retried at most once, never twice. {origin: asked; serves: V-1}
- R-2 Card numbers and verification codes are never written to logs or error messages. {origin: asked; serves: V-1; scope: global}

## Design

- Requests enter `src/checkout/gateway.ts`, use `src/checkout/retry.ts` for timeout handling, and emit structured events without card payloads.

## Experience

- Checkout shows a single waiting indicator during a retry and displays one plain message when payment cannot complete.

## Plan

- First slice: implement single-retry timeout handling (`R-1`) and verify no card data is logged (`R-2`).

## Conflicts

<!-- List source disagreements as `- [ ] CF-1 (section: <slug>) ... | 1: ... | 2: ...` -->

## Open questions

<!-- List unresolved questions as `- [ ] Q-1 (section: <slug>) ...` -->

## Completeness checklist

- [ ] Vision states purpose, primary users, measurable targets and never-dos with no tool or file names
- [ ] Every requirement has an ID (`tenet fix`), `serves:`, valid `origin:` (`observed`, `documented`, `asked`, or `inferred`) and citation where `observed`/`documented`
- [ ] Cross-cutting never-dos carry `scope: global`
- [ ] Prose sections declare `applies_to` path globs in front matter
- [ ] All open `CF-` conflicts are settled and no `origin: inferred` statement remains before `tenet bless`
