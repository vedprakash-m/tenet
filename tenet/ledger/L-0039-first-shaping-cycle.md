---
id: L-0039
kind: decision
date: 2026-11-24
packet: CP-0039
title: "CP-0039 definition converged after five rounds and an Owner adjudication; review rules learned from the first cycle"
---
# L-0039 · The first shape, review and approve cycle

## Context

CP-0039 (health indicators and ratchet) was the first packet put through the full cycle by hand (L-0038):
- Gemini shaped the definition.
- GPT and MAI reviewed it as read-only critics.
- Rounds ran until both agreed, or five rounds passed.

Inputs were the research report in [evidence/research-code-health.md](../packets/CP-0039-health-indicators-and-ratchet/evidence/research-code-health.md) and the PRD rows R-151, R-174–R-178 and R-227.

## Decision or event

1. **Rounds 1–4 did not converge.** GPT raised 8–9 new blockers each round and MAI 3–4. Each blocker was real but one level deeper than the last. Each fix added mechanism, and the definition grew from 1,256 to 3,695 words. Two areas drew blockers every round: durability, and matrix and multi-run reduction.
2. **For round 5 the Owner cut scope and tightened the review rules.** The definition kept the core:
   - single values and finding sets against a committed baseline
   - the touched scope and tolerance
   - observe-first rollout
   - provenance on every result
   - the waive decision
   - the tamper check
   - the proof card
   - dogfooding

   Five parts became split packets: CP-0060 (durability), CP-0061 (matrix and multi-run reduction), CP-0062 (automatic baseline tightening), CP-0063 (merge atomicity and signed recovery), CP-0064 (runner supervision). Critics then worked under four rules:
   - **No moving the goalposts.** New blockers only on changed text or still-open findings.
   - **Concrete failure.** Every blocker states inputs, the wrong outcome and an acceptable change.
   - **Deferral is an answer.** A deferral or a documented limitation is not a blocker.
   - **Narrow blocker meaning.** A blocker means wrong, unbuildable, unsafe, contradicting a higher document, or untestable.
3. **Round 5 left 5 blockers** (GPT 4, MAI 1, the same issue as GPT's second), down from 12. Each critic's proposed change narrowed the core instead of extending it.
4. **The Owner accepted all five** ([owner-adjudication-r5.md](../packets/CP-0039-health-indicators-and-ratchet/escalations/owner-adjudication-r5.md)):
   - Only applicable enforcing indicators make a report mandatory.
   - Touched-line finding sets stay advisory; paired enforcement moved to CP-0065.
   - Raw LCOV and Cobertura coverage is advisory, with tool identity taken from `tenet.yaml`.
   - Architecture acceptance covers only omissions Tenet can observe.
   - Health waives follow R-203.
5. **Gemini wrote version 6** (about 2,400 words). In a verification-only pass, each critic checked only its own round-5 findings. Both returned `VERDICT: AGREE`.

## Evidence

- CP-0039's escalations folder: every review, response, the adjudication and both verifications.
- The branches `shape/cp-0039`, `review/cp-0039-*`.
- The Owner's messages of 2026-11-24.

## Consequences

- **Approval.** The definition goes to the Owner for approval. Approval also approves its proposed spec changes, which are then applied in a spec packet.
- **Order of work.** Independent conformance cases are written by someone other than the builder. The build follows the plan (0.1.x) under DEC-38 unless the Owner moves it. Information-only dogfooding on this repository may start after approval.
- **Lessons for the loops** (agents.md §5) and the critic card, to land through an `agent` packet:
  - A cap on rounds alone does not make a loop converge. Fixed scope and the four critic rules above do.
  - A final verification-only pass checks resolutions without opening a new round.
  - Many deep blockers in a row signal that the packet should be split, not grown.
