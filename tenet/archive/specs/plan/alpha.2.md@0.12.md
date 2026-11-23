# Tenet plan: 0.1.0-alpha.2 (verify)

> Level L2 · Version 0.12 · Part of [plan.md](../plan.md) · Status: **draft, awaiting the Owner's approval** · Budget: 6,000 tokens · Added in L-0023 · Previous version: `archive/specs/plan/alpha.2.md@0.11.md`

**Context card.** Evidence is signed by a protected CI job so the record cannot be forged. Each packet has build-contract fields 1, 2 and 8 ([plan §4](../plan.md#4-build-contract)); the rest is written when alpha.1 ships. Order: CP-0042 → CP-0046 → CP-0021. Spike CP-0040 picks the signing method before this part is completed.

**CP-0042 · Replay, trust observations, safe failure and close** · R-026, R-035, R-110, R-217
1. *Needs:* alpha.1; TS §5; CI §7–§8; ALG-07.
2. *Owns:* `src/kernel/replay.ts`, `src/verify/trust.ts`, `src/verify/safe-failure.ts`, the commands `close` and `doctor` (trust part); gate snapshots, replay labels and tentative moves with their timeout; observation of T1–T3 and spot checks of T4; `test/kernel/replay/`, `test/verify/trust/`.
8. *Proving:* a move without evidence stays tentative and becomes unjustified after the timeout; a decision by the account whose agent opened the pull request is flagged; at `verify`, a control that cannot run fails closed and an override is recorded as `accepted-without-verification`.

**CP-0046 · Signed evidence and the two-job verifier** · R-100
1. *Needs:* CP-0042; CI §5; spike CP-0040's results.
2. *Owns:* the sealed test workflow; signing in `verify --record` (the attest job); `src/core/sign.ts`; the evidence store `refs/tenet/evidence` with retry; the card marked verified; `upgrade` turning on sealing and signing when a project moves to `verify`; `test/verify/attest/`.
8. *Proving:* on a real GitHub repository, a protected pull request, a rebased base, a merge, a fork pull request and a retried job each give one correct outcome; a forged record fails verification; a bundle from another run is rejected.

**CP-0021 · Red-team suite** · R-063, R-106
1. *Needs:* CP-0046; TS §13–§14.
2. *Owns:* `pkg/conformance/red-team/`, one automated case per R-106 entry with its declared level; a CI job running them.
8. *Proving:* each case is refused or reported at its declared level; the case list matches the guarantee table.

**Release 0.1.0-alpha.2:** CI §9's release procedure, then the gate in [plan §1](../plan.md#1-milestones).
