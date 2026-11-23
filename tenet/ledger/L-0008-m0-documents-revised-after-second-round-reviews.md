---
id: L-0008
kind: decision
date: 2026-11-22
packet: CP-0001
title: "M0 documents revised after the second round of reviews: rules from the target, evidence off-branch, signed content, a thinner 0.1.0"
---
# L-0008 · M0 documents revised after the second round of reviews

## Context

The v0.2 documents (L-0007) were reviewed again by Claude, Copilot, ChatGPT and Gemini. All four kept the direction and found that the new trust mechanisms broke on real git hosting: policy was read from the change being judged; signatures on commits were lost on squash and rebase and could be made by an agent holding the Owner's key; CI wrote evidence back onto branches, causing loops, races and fork failures; the board read only the main branch, hiding work in flight and its pending decisions; hand-written and concurrent events had no rule; `close` was scheduled after the milestone that needed it; packet aliases were too short and the legacy-ID promise excluded real packets; release 0.1.0 waited on an external pilot; and M1 had grown to 18 packets. Several requirements claimed more than they could enforce.

## Decision or event

Vision, PRD, tech spec, UX spec and plan revised to version 0.3:

1. **Rules come from the target branch**, never from the change; changes to the protected set need a signed `change-policy` decision.
2. **Two-job CI verifier**: a no-secrets check job and an attest job that never runs the change; evidence lives on `refs/tenet/evidence`, written only by the attest job, never on branches.
3. **Decisions are signed in their content** (`ssh-keygen -Y` over canonical JSON), with strengths `person-present` (security key) and `key`; only `person-present` is enforced for decisions reserved to people by default.
4. **Events carry `prev`**; CI replays them and labels each state change justified, pending evidence or unjustified; incompatible concurrent moves create a `conflict` resolved by a signed decision. `packet.yaml` holds identity only; tasks are marked done by events and are never evidence.
5. **Subjects**: every receipt, review and decision names what it covers (git tree or file set in 0.1.0); approvals go stale like receipts.
6. **Board** reads main, packet branches and the evidence store, records the refs it read, and takes its phases from the pack.
7. **Trust assumptions are stated and observed**: `enforced*` counts as enforced only while a fresh observation shows them holding. The limit that code under test can fake its own check is stated plainly.
8. Reviews with invalid findings are `incomplete` and never converge; reviewers that can unblock a gate pass a 5-case activation test; standard-lane tests are written by another run and pinned.
9. Express is granted by the evaluator within limits and ends at `checked` before merge.
10. Every PRD requirement has a guarantee column; the Rule of Two is worded precisely.
11. Packets get ULID identities and 6-character aliases; every existing `CP-NNNN` stays valid.
12. Vision: problem as drift between hand-offs; north star for authorized participants; eight headline metrics led by time to a correct decision; delivery unit is the **verified change**.
13. Tenet is positioned as the decision and evidence layer beside trackers, orchestrators and spec tools; GitHub is the first forge binding.
14. **0.1.0 is the trust spine**, gated on the red-team suite, the quick start, a real GitHub run and internal dogfooding; V-H1 is measured on 0.1.x with the external pilot. `close` is in 0.1.0.

Cut to offset additions: `sandbox`, `budgets.fleet` and twins removed from the profile until M3; express is a lane rule, not a loop; 0.1.0 ships two loops, two skills, two reference agents and only the schemas it uses; eight headline metrics instead of sixteen.

Rejected: five- or six-level independence classes and a full human-authority model in the core; a separate discovery milestone; four diverse pilots and eighteen experiments as gates; Sigstore signing of CI evidence before 0.1.0.

## Evidence

The four second-round reviews and their sources: OWASP CI/CD Top 10 (poisoned pipeline execution), GitHub rulesets with required workflows, OpenSSH security-key signing, OpenAI Symphony, GitHub Agentic Workflows, Chroma's context-rot study, and the round-one sources.

## Consequences

New 0.1.x packets CP-0025 to CP-0030; CP-0011 and CP-0023 move to 0.1.x; CP-0017 now runs before CP-0015; CP-0001 waits on CP-0015. `kit/TENET.md`, the schemas, the loop and `tenet.yaml` are reconciled in CP-0015. Supersedes the parts of L-0007 on commit signatures, evidence committed to branches, five-character IDs and the M1 gate.
