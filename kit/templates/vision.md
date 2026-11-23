---
tenet: {spec: 1, doc: vision, level: L0, version: "0.1", owner: "<owner>"}
sections:
  purpose: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, anchors: {}, flags: []}
  north-star: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, anchors: {}, flags: []}
  value: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, anchors: {}, flags: []}
  principles: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, anchors: {}, flags: []}
  horizons: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, anchors: {}, flags: []}
  outcome-metrics: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, anchors: {}, flags: []}
  boundaries: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, anchors: {}, flags: []}
  not-yet-in-scope: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, anchors: {}, flags: []}
  completeness-checklist: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
---
# <Project> vision

> Level L0 · Version 0.1 · Owner: `<owner>` · Changes only by L0 decision, ratified by the Owner · Budget: 4,000 tokens
>
> Rule: no sentence here names a tool, file, table, command or vendor.

## Purpose

<!-- Worked example (replace with your project's purpose): -->
Returning shoppers abandon checkout when transient payment timeouts either drop orders silently or charge cards twice. `<Project>` ensures checkout behavior matches explicit reliability and safety commitments owned by the product team.

## North star

**Every checkout attempt produces one predictable outcome and zero duplicate charges.**

## Value

| ID | Who | Gets |
|---|---|---|
| V-V1 | Shoppers | One clear payment outcome without double charges |

## Principles

| ID | Principle |
|---|---|
| V-P1 | Prefer failing clearly over risking a duplicate payment |

## Horizons

| ID | Horizon | Achieved when |
|---|---|---|
| V-H1 | Reliable checkout baseline | Over 30 consecutive days, timeout recovery rate is ≥99% with 0 duplicate charges |

## Outcome metrics

| ID | Metric | Definition | Baseline | Target (horizon) |
|---|---|---|---|---|
| V-M1 | Duplicate charge rate | Confirmed duplicate settlements per 10,000 checkouts | Recorded at launch | 0 (V-H1) |

## Boundaries

| ID | `<Project>` never |
|---|---|
| V-B1 | Retries a payment after an explicit decline or stores raw card numbers |

## Not yet in scope

<!-- List active vision items deferred beyond current requirements, if any. -->

## Completeness checklist

- [ ] Every value (`V-V*`) maps to at least one metric (`V-M*`)
- [ ] Every metric has a definition, baseline source and target
- [ ] Every horizon (`V-H*`) has a numeric "achieved when" criterion
- [ ] No sentence names a specific tool, file, command or vendor
- [ ] Every blessed `V-` item is served by a blessed requirement or listed under `## Not yet in scope`
