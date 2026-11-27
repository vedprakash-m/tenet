---
tenet: {spec: 1, doc: escalation, level: L2, version: "0.1", owner: ved}
sections:
  what-was-attempted: {level: L2, state: draft, digest: null, flags: []}
  where-it-rubs: {level: L2, state: draft, digest: null, flags: []}
  resolution: {level: L2, state: draft, digest: null, flags: []}
  completeness-checklist: {level: L2, state: draft, digest: null, flags: []}
---
# Escalation: AC-A3 changes the independent s13 skill checksum

> Work item `CP-0068` group A · Stop signal: independent case needs its expected value updated · Lowest level that can decide: Owner and independent case owner

## What was attempted

- Reproduced R2-13 in a synthetic one-file project. After inventory generated an assignment, the draft without front matter gave an empty `fix` change list, a clean `check`, the empty board and `TN-SPEC-NO-FRONT` from `onboard --card`.
- Reproduced R2-16 using a string for `tenet` and a list for `sections`. The card raised `TN-SPEC-NO-FRONT`. Blessing prompted for both synthetic sections and reported `TN-INTERNAL` for each.
- Ran `node --test --test-name-pattern=s13-ux-walkthrough-new test/onboard/scenarios.test.ts` on `feba813`. It passed. Temporarily changed one instruction line in `kit/skills/draft-specs/SKILL.md` and reran the same test. It failed at `04-onboard-inventory`. Restored the skill byte for byte.

## Where it rubs

- AC-A3 says the skill tells the agent “not to write front matter by hand, and to run `tenet fix` to add it” (`tenet/packets/CP-0068-dogfood-fixes-0.2.0/definition.md:27`).
- s13 pins the installed `.agents/skills/tenet-draft-specs/SKILL.md` checksum (`pkg/conformance/scenarios/s13-ux-walkthrough-new/expected/04-onboard-inventory.json:18–21`). The one-line probe kept 38 lines and changed the SHA-256 from `46a53dd2b0a90992221a7ea543f99781be76399aca98cccb67a572b5d6c9d725` to `21263bfc4256739d6bc211d191652058588fd6de75ef6aefde06b0b06d438489`.
- Tested replacement for the instruction in step 4: “Let `tenet fix` write the YAML front matter. Run `tenet fix` to add it, then run `tenet check` and fix every citation finding until checks pass on the draft.”
- The common brief requires the builder to stop on a contradiction with an independent case and requires a green full suite before pushing. Group B starts after the group A pull request is green.

## Resolution

1. Stop group A at the reproduced conflict and wait for the Owner to decide the update sequence.
2. Have the case owner update the pinned checksum for the final skill text through a paired case change. Keep exact checksum coverage.
3. If the Owner authorizes a temporary expected failure, open the group A PR with that failure listed and run the full suite again with the case-owner update integrated.

The coordinator chose the paired sequence. Group A can open with the listed independent mismatches. Track 2 owns the case update. The coordinator will verify the two changes together before merging. Group B proceeds on a separate branch.

## Completeness checklist

- [x] Quotes the conflicting acceptance rule and cites the independent expected value.
- [x] Names the stop signal and gives the reproducible failing step.
- [x] Names who can resolve it.
- [x] Lists stop as the first option.
