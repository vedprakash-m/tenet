---
tenet: {spec: 1, doc: escalation, level: L2, version: "0.1", owner: "Ved"}
sections:
  what-was-attempted: {level: L2, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
  where-it-rubs: {level: L2, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
  resolution: {level: L2, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
  completeness-checklist: {level: L2, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
---
# Escalation · Group A conflicts with independent expectations

> Work item CP-0066 Group A · Track 1 blocked · Stop signal: change needs an independent test update · Lowest level that can decide: owner

## What was attempted

- Built origin/main at f5df2c14fa3c1745f8b572675abf555e761197b1 in the track 1 worktree.
- Ran the independent s11, s12 and s13 walkthroughs and the p07-ux-part-2 board case. All four passed and reproduced the old card wording or board layout they pin. The focused run also passed n08-uncovered-vision, whose projection leaves severity and wording open.
- Stopped before editing implementation or tests, as required by the packet's independent-case rule.

## Where it rubs

- AB-A9 (F-29, F-34) says the last line "gives the next step for the actual state". AB-A10 (F-32) requires "N citations resolve (file and lines exist)". The [scenario harness](../../../../test/onboard/scenarios.test.ts#L456) compares the complete onboarding card. [s11](../../../../pkg/conformance/scenarios/s11-readme-walkthrough/expected/06-card.md), [s12](../../../../pkg/conformance/scenarios/s12-ux-walkthrough-existing/expected/06-card.md) and [s13](../../../../pkg/conformance/scenarios/s13-ux-walkthrough-new/expected/05-card.md) require "checked against the code" and end with "gh pr checkout <n>, then tenet bless" without a pull request.
- AB-A11 (F-37) says "plain-text board groups sections by file". [p07-ux-part-2](../../../../pkg/conformance/board/p07-ux-part-2/expected.md) pins status headings followed by bare section names in an [exact comparison](../../../../test/views/specs-board-conformance.test.ts#L142). Grouping the displayed sections by file changes that screen.

## Resolution

1. Keep Group A paused. The track brief puts s16 after a green Group A pull request.
2. The Owner can ask the independent case owners to update the walkthrough and board expectations to the approved acceptance items.
3. The Owner can revise the acceptance items if the earlier rendered output is still required.

## Owner decision

The Owner confirmed that AB-A9–A11 stand and authorized Group A implementation without changing independent cases. The UX proposal in this pull request gives the case owners the exact card and board text.

The body-only budget in AB-A6 also conflicts with three independent fixtures. [check n09](../../../../pkg/conformance/check/n09-ci-budget-crossing/input.json) expects a crossing at 201 of 200 tokens, but the head body is 145 tokens. [check n12](../../../../pkg/conformance/check/n12-local-budget-warning/input.json) expects a warning at 190 of 200, but the body is 134 tokens. [board n04](../../../../pkg/conformance/board/n04-over-budget/input.json) likewise reaches its threshold only with front matter. These expectations remain with their case owners.

## Completeness checklist

- [x] Quotes the conflicting acceptance items.
- [x] Names the stop signal and the independent tests.
- [x] Names the Owner as the lowest level that can resolve the conflict.
- [x] Lists stopping as the first option.
