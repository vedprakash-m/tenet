# Tenet plan: 0.1.0-alpha.2 (verify)

> Level L2 · Track 1 draft for Owner approval · Budget: 6,000 tokens · Part of [plan.md](../plan.md)

**Context card.** CP-0042 → CP-0046 → CP-0021. L-0030 records observed signing and the outstanding forge observations. Uses [kernel](../tech-spec/kernel.md) (K), [contracts](../tech-spec/contracts.md) (C), [CI](../tech-spec/ci.md), [agents](../tech-spec/agents.md) (AG) and the [technical specification](../tech-spec.md) (TS). Standard JSON envelopes, exit codes, and three-platform checks follow the alpha.0 build contracts.

**CP-0042 · Replay, trust and safe failure · R-026, R-035, R-110, R-217**
1. *Needs:* Alpha.1; TS §§4–5; ALG-07; CI §§7, 8, 10; K §§1–3, 5.
2. *Owns:* `src/kernel/replay.ts`, `src/verify/{trust,safe-failure}.ts`, computed close endpoint, doctor trust output, replay and trust tests.
3. *Exports:* `replay(history, snapshot, asOf) → {transitions, state, findings}`, `observeTrust`, `requiredOutcome → {conclusion, guarantee, reasons}`.
4. *Behavior:* Reproduce the historical evaluation time and record. Compute closure and tentative expiry. Record T1–T3 and declared or observed T4 separately from required-status availability. Apply CI §10 and label explicit overrides accepted without verification.
5. *Edge cases:* Expiry boundary, late evidence, store loss, stale trust, unavailable protection and shared decision account.
6. *Out of scope:* Signing, host containment and the GA close command pending release-boundary reconciliation.
7. *Fixtures:* `test/kernel/replay/{tentative,expiry,late,policy-change,close}/`, `test/verify/trust/{t1-t4,unavailable,override,outcome-table}/`.
8. *Proving:* `npm test -- test/kernel/replay test/verify/trust`. Required unavailable controls hold the gate in verify and overrides stay separately labelled.

**CP-0046 · Signed evidence and candidate checks · R-100**
1. *Needs:* CP-0042; CI §§3–7, 10; C §11; K §§2, 3, 5; L-0030.
2. *Owns:* Sealed workflow, recorder signing, `src/core/sign.ts`, signed store, upgrade wiring, fixed-candidate binding and person-present wire fixtures.
3. *Exports:* `signReceipt`, `verifyReceipt`, `personPresentPayload(request, choice, actor, challenge)`, `recordCandidate`.
4. *Behavior:* Keep the approved two-job boundary. Validate provenance, completeness and size before reading reports or applying a result. Use the documented signing backend where confirmed. Write immutable receipts and apply CI §10 to the exact candidate. Validate the canonical payload and report whether presence is available.
5. *Edge cases:* Missing key, partial shards, wrong run, retry, fork, superseded merge candidate and unknown security-key presence.
6. *Out of scope:* Assure activation and full later R-152 functionality. Preserve unresolved scope in the evidence track.
7. *Fixtures:* `test/verify/attest/{signed,tampered,wrong-run,partial-shards,candidate-stale,retry,fork,person-present}/`.
8. *Proving:* `npm test -- test/verify/attest`. Run signed candidate and failure paths in a supported real sandbox. Retain outstanding fork, sealed runner and required-status observations as open until tested.

**CP-0021 · Adversarial conformance suite · R-063, R-106**
1. *Needs:* CP-0046; TS §§13–14; CI §§5–8, 10; K.
2. *Owns:* `pkg/conformance/red-team/`, CI job and deterministic red-team test runner.
3. *Exports:* Manifest, `npm run test:red-team`, results `{case, declared_level, observed_disposition, reason, result}`.
4. *Behavior:* Cover every applicable R-106 case and record the delivery milestone of future cases. Compare outcomes and guarantee levels. Unknown required inputs and missing observations remain explicit. Keep logs and fixtures sanitized.
5. *Edge cases:* Malformed or over-limit bundle, invalid signature, stale decision, missing shard, unavailable record store and unsupported required status.
6. *Out of scope:* Proof of isolation or forge enforcement from fixture results alone.
7. *Fixtures:* `pkg/conformance/red-team/{hostile-bundle,forged-record,stale-decision,unavailable-required-control}/` and one expectation for every applicable R-106 row.
8. *Proving:* `npm run test:red-team`. Verify CI §10 under actual branch protection before claiming that guarantee.

**Coverage.** K §3 covers person-present bytes and §5 covers merge-group subjects. CP-0021 covers hostile bundle and forged record rejection. Apply CI’s release procedure and plan §1’s separate build and evidence gates.
