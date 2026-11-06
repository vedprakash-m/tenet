# Independent configuration/migration/trait protocol review

Date: November 5, 2026. Scope: read-only inspection of current source, local configuration/migration/trait contracts and the preserved protocol candidate. No source, schema, budget or activation approval follows. No tests or builds were run by this reviewer. The only reviewer-authored file is this report.

## Conclusion

The protocol is not ready for production implementation/activation sign-off. Enough behavior is settled to continue the isolated feasibility candidate. The next useful bounded slice is C5/V1: configuration-bound review and Analyst production/admission through existing builders and result consumers. Do not ask the owner again to choose already settled configuration, accounting or rollback policies.

The candidate and current main are different source identities. The historical candidate measurements and tests below are retained claims from its archive, not results independently rerun against current source.

## Actionable blockers

1. **No complete target candidate exists.** The preserved latest matrix records **22 partial rows, seven missing and zero closed**. Missing rows are C5, C6, R1, V1, G1, O4 and O8. Existing partial helpers and direct handler calls do not establish integrated schema-2 dispatch, actual runner execution, durable publication or recovery. The archive's latest measurements exceed unchanged schema, budget, store and central ceilings; its current bundle size is unknown. See `.archive/consolidation/2026-11-04/vedprakash-m-verbose-enigma/changes.patch`, lines 1228–1268. `protocol-capacity.md` section 1 explicitly says its older estimates exclude the later QLT-11 addition. Complete the missing consumers and measure one stable source identity before requesting exact production capacity approval.

2. **Review/Analyst configuration proof is represented but not consumed.** The archive patch defines `ConfigStamp`, optional stamped `Reservation2`, review and Analyst links, and focused reservation fields (lines 257–283). It contains no changes to `core/review.ts`, `verbs/manifest.ts`, `verbs/findings.ts`, Analyst builders or reservation settlement. Thus C5/V1 remains missing, rather than completed by stamp schemas. `config-completion.md` section 16.5 specifies the required builders, parent/retry/currentness predicates, stale-result handling and real-dispatch accounting. This is a concrete implementation task within the isolated prototype's existing scope.

3. **The runner port boundary is not ready to wire.** `config-completion.md` sections 20.2–20.3 require an admitted JobKey/runId/root association, separate ordinal process-control directories, unchanged command/output/database/environment/envelope paths, bounded affirmative spawn acknowledgment and separate completion. Current `ports/types.ts` supplies `RunSpec.runDir`, `guardRun` and `stopRun` without that full typed distinction. Moving ownership records alone would let stop inspect a prepared root while a live ordinal child survives. Finalize and review the exact association representation and finite acknowledgment-bound source before candidate runner integration. Preserve uncertainty after acknowledgment loss; never wait for tool completion while holding the lock.

4. **Trait state remains dormant and incomplete.** Current `core/schemas.ts` keeps `SCHEMA_VERSION = 1` and string trait arrays. The standalone `core/traits.ts` explicitly states that its typed state is not wired into stored State. Its `changeTraitRaises` uses a hard-coded map pending the authoritative registry. The signed behavior instead requires registry-owned signals, reasons, coverage, obligations and change-only contributions; unsupported/incomplete evidence stays unknown. Pure schemas and fixed-map tests cannot close QLT-11. Complete registry/evidence/correction capture and every risk/obligation/facts/verdict consumer before activation.

5. **Public action interfaces remain unspecified.** The migration and explicit recovery-set deletion surfaces have no approved complete request/preview/answer/retry/routing API. `config-completion.md` section 14.1's live-work config API does not automatically authorize a workspace migration action. `schema-migration.md` section 18.4 explicitly says internal operation labels are not decision registry additions; `migration-closure.md` section 3.1 leaves explicit backup deletion unspecified. Draft the smallest exact existing-pipeline API and obtain its review/owner decision before exposing it. Until then retain recovery sets and refuse deletion, preserving the approved retention policy.

## Approval boundaries and decision classification

Already settled: configuration D1–D8; exact confirmation for executable/check changes; restriction-only safe revision; full configuration-evidence binding and genuine first upgrade scope; protected backup retention and minimal terminal metadata; migration-closure MC-1/3/4 amendments; inert legacy trait conversion; QLT-11 behavior and inclusion in schema 2. These choices must not be repolled merely because their implementation is unfinished.

| Item | Correct next action |
|---|---|
| C5/V1 issued review/Analyst stamps and stale admission | Implement and test in isolated candidate under existing prototype scope. No new product policy is needed. |
| Finite source/reference decoders | Enumerate actual producer shapes, preserve admitted bytes and refuse unknown/unpreservable references. Conservative refusal is already required; do not treat it as a new policy choice or universal migration completion. |
| Runner association and spawn acknowledgment | Specify and independently review the exact typed engineering boundary before candidate wiring. Preserve settled accounting units and uncertainty rules. |
| Evidence/array bounds | Measure supported worst-case serialized state and source/backup/stage space; propose exact fixed bounds without silent truncation or changed scope. Measurement is engineering work; a required scope reduction or ceiling increase needs owner approval. |
| Registry signals/reasons/contributions | Detailed static detection can be designed within the signed complete/partial/unknown rule. New obligation/risk/correction semantics beyond that contract need explicit review and owner approval. Do not activate the candidate's placeholder map. |
| Bridge/target digests | Produce and verify exact artifacts at the later rollout gate. A scratch label is not a release identity. This does not block unrelated isolated proof-consumer implementation. |
| Migration/deletion public actions | Concrete API design, independent review and owner decision before exposure. No new kind inferred from an internal label. |
| Production ceilings/schema activation | Complete integrated source and measurements first; exact owner approval remains required. Green bundle size alone does not approve source overruns. |

The archived six-item “owner decisions” table mixes public policy/interface decisions with implementation and qualification tasks. Use the distinctions above to avoid another broad approval loop.

## Exact reconstruction and overlap risks

Preserved root: `.archive/consolidation/2026-11-04/vedprakash-m-verbose-enigma/`.

- Recorded base: `34d6030c61f3f02783fd9bd096ff1fd7cc39f8a8`; this Git object was verified to exist. It is not current main.
- Tracked delta: `changes.patch`, applied against that exact base.
- Additive source: `untracked/`, copied with its repository-relative directory structure.
- Manifest: `.archive/consolidation/2026-11-04/manifest.json`, the matching worktree entry.

Additions include `adapters/migration-fs.ts`; `core/budget-launch.ts`, `config-binding.ts`, `config-proposal.ts`, `schemas-legacy.ts`, `schemas-migrate.ts`, `schemas-upcast.ts`; candidate check/config/launch/migration/trait-wiring tests; `fixtures/crash-migration.ts`; and `support/migration-ctx.ts` and `schema1-fixtures.ts`.

Reconstruct in a separate scratch directory, preserving the exact base-plus-patch-plus-untracked snapshot and its fingerprints before making further changes. Do not create a branch/worktree or apply the archive to current main. Root reports that this exact reconstruction has now succeeded; that report is not an independent rebuild/test by this reviewer.

The tracked patch overlaps configuration, policy, obligations, schemas, traits, config decisions, pipeline mutation, check/finalization/evidence, facts, open and reconciliation. It also alters candidate quality owner matchers and local planning documents. Wholesale overlay onto main can regress post-base safety repairs. Rebase later current-source repairs selectively and record each source identity; never assume archived code already contains them. Candidate matcher changes must charge new responsibility files to the original measured owners and retain approved limits; they do not approve increases or relocation outside caps.

## Recommended next vertical slice: C5/V1

Use the existing schema-2 stamp representation and existing review/Analyst mechanisms, remaining isolated and nonshipping:

1. Capture the issued work binding in full/focused/recheck and Analyst packet body identity, manifest hash and reservation.
2. Admit done/live/retry/full-parent/delta/focused lookups only under the matching current binding and existing candidate/basis/file predicates. A stale parent requires a fresh full review.
3. Compare the issued reservation stamp to current work at findings/Analyst settlement; copy the issued stamp to accepted links. Never restamp a historical result using current work.
4. Preserve stale observations as history, with no verified finding, attention disposition, current Deep/design pass, completed round or recheck credit.
5. Charge actual native dispatch exactly once through existing budget helpers; same-session review remains nondelegating.
6. Preserve schema-1 behavior. Do not advertise schema-2 pipeline/store activation or integrated closure from direct pure/helper tests.

Distinguishing controls: equal candidate/basis/files but changed hash; A→B→A with an old serial; missing/malformed issued stamp; stale full parent; focused and Analyst mismatch; stale result retained but not accepted; actual dispatch charged once; same-session no delegation; unchanged-stamp positive controls. Then exercise the relevant existing handlers in the candidate. Keep C5/V1 partial until its full integrated consumer set is demonstrated.

Follow with C6 normal/recovered operation proof, the reviewed runner/association handshake, cumulative recovery snapshots and retention, migration routing/reference/privacy closure, and authoritative trait registry plus consumers. Finally run one coherent complete-candidate gate and real POSIX kill/restart matrix, dual-runtime built feature UAT, fresh integrated review, exact measurements and owner activation decision. Existing host/campaign/human/release gates remain separate.

## Follow-up: C5 native dispatch settlement dependency

A focused follow-up corrects the scope of the C5/V1 recommendation above: builders and proof-currentness predicates can proceed independently, but **full C5 once-only stale native-dispatch accounting cannot currently be completed from the existing primitives alone**.

`core/budget.ts` `releaseStale` discards invalid reservation identities. `recordDelegation` and `settleReservation` increment counters without a durable already-settled identity check. In `verbs/findings.ts`, an unmatched reviewer or Analyst native result calls `recordDelegation` but creates no retained result/settlement identity. The `session.last` cache suppresses only an immediately matching retry; an intervening call, changed retry identity or explicit `again` does not supply durable deduplication. Once the issued reservation has been removed, the result also cannot recover its trustworthy issued configuration stamp from current work or caller data.

The candidate's `LaunchEvent`, `JobSettlement` and `budget-launch.ts` do not solve this. They account for check-process obligation units: prepared events require baseline/candidate/integrated stage, tests/static/e2e command kind and captured obligations. They have no native reviewer/Analyst reservation or reported dispatch identity. Reusing them for delegations would invent a domain/schema and violate the check-versus-operation boundary. Existing settled review/Analyst links can identify some already-recorded results, but they do not retain a retired, unreturned issuance or currently rejected unmatched result; they are not a complete issuance/retirement/settlement protocol.

Before C5 can close, specify and review how native dispatch issuance survives proof invalidation, how an observed native completion is charged once, how repeat/conflicting reports are recognized, and how the evidence survives recovery, fallback, compaction and privacy retention. Determine whether the existing records can support that lifecycle with reviewed changes or whether versioned native settlement metadata is required. No new field, event kind, action API, launch-domain reuse or owner approval is inferred here. The contract already requires once-only settlement (`config-completion.md` section 16.5); the missing mechanism is an engineering/schema integration dependency, not permission to weaken the requirement or repoll its policy.

The next isolated slice should therefore be labeled **partial C5/V1 proof binding**, with failing controls documenting the unresolved native settlement lifecycle. Do not claim complete independent C5 closure or invent an unapproved settlement set merely to make those controls green.
