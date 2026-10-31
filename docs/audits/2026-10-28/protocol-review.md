# Configuration and migration: review packet, October 28, 2026

Status: source-grounded preparation for the next independent review. This is not an independent review, final sign-off, an implemented target, or permission to activate schema 2. The original D1–D8 and MC-1/3/4 decisions remain settled. R08 remains owner-deferred until migration approval.

## Review boundary

Review config-completion §§16–20 and schema-migration §§16–19 together, applying migration-closure's approved amendments and the now-implemented MC-2/FG repairs. The next review must resolve concrete source/format/consumer/budget integration; another preference poll does not close it. The owner or a separately authorized fresh reviewer can supply the independent pass required by `.github/copilot-instructions.md` lifecycle steps 2–3.

Source baseline: upstream `8b7bbc4190fc76599b51e1fcfe50f23947a2963c` plus the local synchronized audit repairs and current counterexample repairs. `synced-validation.json` identifies the previous validated tree; continuation-validation.json will identify the current one after gates finish. No borrowed remote CI evidence.

## Confirmed shipped repairs and corrections to the drafts

| Item | Current source fact | Disposition |
|---|---|---|
| MC-2 | store-fs.acquire no longer changes protected permissions before claiming the normal lock; bootstrap quarantine freshly admits and tightens before moving | Implemented locally with genuine LA controls; historical “needs POSIX/not implemented” statements must not control current ordering |
| FG | completeForget journals IDs, purges manifests, publishes twice and records completion; recovery shares it; Tx.state is a getter for the actual publication | The source effect inventory now has nine handlers, including forget; do not use the older eight-handler inventory |
| FG error handling | Packet enumeration/read/delete errors formerly became success; bounded reader and absence-only catches now retain the lesson/intent on failure | Continuation tests cover unreadable file/directory, unwritable directory, oversized/invalid bytes and inaccessible temp parent; no successful purge claim from unavailable copies |
| Existing output declarations | checkInputId and deriveObligations omitted outputs; stable-ID addition/removal reached a false checked-local after fresh review | Bounded continuation repair includes outputs in identity and baseline comparison; no schema-2 activation or full definition/config-binding claim |
| Recovery refusal | fencedByUncertainty published completed recovery then rendered the older object | Continuation repair renders the actual Tx.state; test retains another unknown effect and repeats refusal without another write |

## Integration obligations for independent review

| ID | Source evidence and unresolved target detail | Required disposition and discriminating control |
|---|---|---|
| CR-1: typed check domain | Runner.run is shared by checks, dependency/scaffold and Git. Its current RunSpec has no kernel-issued check context; guardRun selects a callback by root path. Section 20.1 correctly excludes installs/Git from check units, but the exact port delta remains proposed. | One internal discriminated check/operation contract. Check producers must supply an admitted JobKey/owner and captured obligation set; a missing/stale/foreign context refuses before spawn. Never infer the domain from CLI/project text or fall back to the operation branch. Include every primary/static/e2e/rerun/port retry and a non-check passing control. |
| CR-2: ownership directory versus command scope | ProcessRunner.writeRecord writes root/run.json; stopProcess and discardDeadRuns each stop that one root. Current tests deliberately accept a prepared sentinel as no process. | A separate ownership directory beneath the admitted root for each validated ordinal; preserve command cwd, reports, DB, TMPDIR and writable/envelope paths. Enumerate the entire admitted ordinal set for stop/recovery, including later acknowledged groups beyond a hole. Do not derive ownership from arbitrary path strings. A prepared root plus live ordinal child must be stopped or explicitly uncertain. |
| CR-3: bounded spawn acknowledgment | guardLaunch holds the store lock only while synchronously obtaining a completion promise. Child spawn errors arrive through events; writeRecord file fsync is followed by rename without parent-directory fsync. | Persist starting before spawn, await only affirmative child/no-child acknowledgment and durable ownership/ledger metadata under the lock, then release while completion stays pending. An acknowledgment write failure stays uncertain and stops any safely identified group. Never await full tool completion under the lock or reinterpret a post-spawn failure as no-child. Test immediate exit, missing executable, lost acknowledgment, failed fsync and a long-running child stopped concurrently. |
| CR-4: settlement holes and discard | Current account counts units at finalize; superseded results are discarded first. Proposed JobSettlement has a contiguous settled prefix, while §20.2 requires all known usage settled before discard. | State exactly how later known launched units are displayed/retained while an earlier starting entry is uncertain. Prefix accounting may not erase those units, report a falsely complete total, charge them twice, or clear their ownership. Exercise uncertain first plus known second launch across cancellation and two restarts. This is a review question about the proposed representation, not a policy choice or an already-tested guarantee. |
| CR-5: cumulative recovery coverage | Current accountingCheckpoint contains numeric deltas, no proof floors, job association or launch prefix. Reduction protects primary/previous numeric recovery, not the target backup-wide horizon. | Strict schema-2 checkpoint/reduction validators must cover complete validity floors, jobSeq, retained associations/prefixes and unsettled suffix. A torn state after a durable allocation consumes it. A→B→fallback→two restarts→A cannot revive old proof. Read-only B remains an observation, not durable history. No aggregate retention completion follows. |
| CR-6: actual migration sources | archive[].blob has no producer payload decoder. session.last.response.data is unknown and produced by many verbs. String values are not reference declarations. Current additive forget has no blob edges. | A finite per-producer decoder or explicit refusal for each actual form; exact raw bytes and optional presence retained. Include all nine effect shapes and known success/failure variants, both primary/previous and inert root _ext. A useful migration happy path must be demonstrated on a real source fixture, not an empty hand-built state. Never silently drop cached data/history to make conversion pass. |
| CR-7: proof completion versus proof credit | recover-effects restores landed integration facts using the operation/mode. The proposed target must carry issued proof identity and revalidate before granting credit. | Preserve completion facts separately from current validation. Missing/legacy/mismatched binding never becomes a current pass through result replay, cached response, lastCheck or integrated.validated. Test changed configuration after durable result but before publication, with actual Git postconditions. |
| CR-8: target privacy and rollback | MC-3 uses ordinary journaled forget; MC-4 permits pristine rollback only, with no issued identity above zero. Migration backup deletion and target recovery-set inventory remain inactive. | Keep packet-only purge outside process-control records. Before target forgetting, forfeit rollback, delete any lesson-bearing owned recovery set whole, and rotate both states without reviving proof. Preserve unrelated work/counters. Rollback checks actual pristine bytes and deletes only manifest-listed matching upgrade objects before its terminal. Real kills at every deletion/publication boundary; mismatch refuses. |
| CR-9: exact budgets | Current measurements below leave nine shared characters and only 36 schema/55 budget characters. No target implementation estimate or measured simplification is established. | Identify each proposed record/consumer by its existing budget owner. Review a bounded behavior-preserving simplification with measured before/after deltas and a separate target estimate before asking for final implementation approval. Do not relocate code outside a matched owner, remove assertions, relax caps or represent estimates as executable measurements. |

## Current measured capacity

Measured by the existing measure/budgetChars functions, after the continuation runtime fixes. These are source measurements, not an implementation forecast.

| Owner | Used characters | Ceiling | Free |
|---|---:|---:|---:|
| adapters/git-cli | 37,801 | 37,843 | 42 |
| adapters/node-ts | 17,929 | 20,160 | 2,231 |
| adapters/runner | 9,928 | 20,160 | 10,232 |
| adapters/store-fs | 24,920 | 25,920 | 1,000 |
| core/budget | 8,585 | 8,640 | 55 |
| core/review | 16,981 | 20,160 | 3,179 |
| core/risk | 4,779 | 8,640 | 3,861 |
| core/schemas | 26,863 | 26,899 | 36 |
| core/verdict | 12,549 | 17,280 | 4,731 |
| pipeline + verbs + decisions | 241,796 | 241,805 | 9 |

The last validated bundle before continuation is 776,671 / 819,200 bytes. Its 42,529-byte headroom is not proof the target fits. The continuation build gets a new identity and measurement; no schema or bundle cap increase is selected.

## Review exit and next implementation order

1. Independently disposition CR-1–CR-9 against the exact current source and the existing proposed contracts. Resolve engineering omissions in those contracts; retain all policy decisions.
2. Specify the first within-cap simplification as a small reviewable change, with before/after measurements, behavioral equivalence and test homes. Do not implement a speculative framework to manufacture those numbers.
3. Produce a bounded target estimate that includes schemas, source inventory, publication/recovery, every proof/launch/stop/settlement consumer, skills and bundle. If safe simplification cannot provide capacity, present the actual deficit and alternatives for an owner budget decision.
4. Request final owner approval of that concrete reviewed protocol/budget/implementation slice. R08 stays deferred. After approval, implement test-first with real source→target→bridge fixtures and kills; activate only after all required consumers compose.

Other work can continue within already approved canonical contracts: semantic evidence review, existing behavior defects, public fixture authoring and runbook preparation. Native spikes, live evaluation, participant recruitment, publication, commit and push keep their separate gates.
