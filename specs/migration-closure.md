# Specification: Migration Closure for MC-1, MC-3 and MC-4

> Status: Approved 2026-10-27 by the owner after independent review (§10): budget path (a), forget repair as specified, and MC-1/3/4 dispositions as amendments. Implementation of §3.1 waits for a supported-POSIX test route. §§3.2-3.3 remain inactive target-protocol text.
> Owner: repository owner. Sources: [schema-migration.md](schema-migration.md) §§16.4, 16.6, 16.7, 18.1, 18.2, 18.4, 19; [config-completion.md](config-completion.md) §§18.2-18.4, 20; technical specification §7.4 (effects) and §7.7 (forgetting); CON-10, AC-09, LFC-04, CON-05.
> MC-2 is specified separately in [store-lock-admission.md](../.archive/specs/store-lock-admission.md) and is blocked on a POSIX test environment.

> Local schema-1 implementation update, 2026-10-28: FG controls are grouped in `packages/kernel/test/forget-recovery.test.ts` and `fixtures/crash-forget.ts`, alongside existing lessons tests. All five real SIGKILL points, fallback, lost-response retry and live-job preservation pass locally; all three FG-4 controlled mutations fail as required. `Tx.state` remains read-only at the port and exposes the last publication through a getter. Shared source grows 729 non-whitespace characters; the owner-approved under-1% allowance raises its cap by 10 lines (0.24%) after using existing headroom. Full local CI passes 1,226 tests/198 suites; built UAT passes 139 scenarios on both Node 26.3.0 and 22.12.0. Target-protocol sections remain inactive and this mixed-scope spec is retained until migration is implemented.

## 1. Outcome and scope

This document closes three of the four migration review blockers in [schema-migration.md §19](schema-migration.md#19-focused-migration-review-dispositions-2026-10-26) with the smallest mechanisms the current source supports:

- **MC-3**: forgetting a lesson becomes crash-safe by reusing the existing effect journal (intent, effect, result, reconciler). This also repairs a crash window in today's schema-1 `decide forget` (§2.1). It replaces the separate privacy intent file, tombstone, pre-staged sanitized images and fixed publication prefixes that §18.4 proposed for forgetting.
- **MC-4**: no new carrier for rollback floors is needed. §16.6 already admits rollback only when the live target matches the applied manifest exactly, so no schema-2 identity above the initial floor can exist when rollback is allowed. This document makes that a checked predicate and removes upgrade-created schema-2 objects during rollback.
- **MC-1**: no operation owned by the migration document needs to follow launch references. Each operation either never sees launch records or refuses when it does. The companion keeps ownership of the launch decoder, ownership association and settlement horizon.

Only the schema-1 forget repair (§3.1) is implementable now. The rest remains inactive target-protocol text: no schema 2, upcast, migration, rollback or launch ledger is activated.

## 2. Source findings (inspected 2026-10-27)

### 2.1 Present-day forget crash window

[forget](../packages/kernel/src/decisions/forget.ts) publishes the lesson-free state, then calls `ports.store.purge([statement, quote])`, then returns. The pipeline's [stamp](../packages/kernel/src/pipeline-render.ts) publishes a second time and appends the call record. No journal record describes the operation.

- Killed after the first publish and before `purge`: packet files under the workspace temp directory still contain the lesson text. `state.prev` also contains it until the next publication. A retry fails with "there is no lesson ... to forget" (exit 2), so nothing finishes the purge.
- Killed after `purge` and before `stamp`'s publish: `state.prev` holds the text until some later publication. If the primary is damaged before then, [read](../packages/kernel/src/adapters/store-fs.ts) falls back to `state.prev` and the forgotten lesson comes back.

Technical specification §7.7 says forgetting "reaches every copy Tenet controls". After either kill that is not true, and the user is not told. CON-10/AC-09 are Must requirements, but they are not on the never-waivable list in PRD §4.7. This is recorded in plan §12.3. It is not an emergency escalation.

Two further present-day defects in the same path, found by the independent review (§10) and confirmed in source:

- **Response revision lags the store.** `stamp` numbers the response, cached response and call record as `tx.state.revision + 1` ([pipeline-render.ts](../packages/kernel/src/pipeline-render.ts)), while each `publishState` rereads the live revision and adds one ([store-fs.ts](../packages/kernel/src/adapters/store-fs.ts)). `forget` is the only verb or decision that publishes before `stamp`, so a confirmed forget ends with the disk at `initial+2` and reports `initial+1`. A later call that compares revisions sees a response older than the facts it reports.
- **Purge reaches beyond packets.** `purge` scans the whole workspace temp base and deletes any file containing either text. That includes `run-*/run.json`, which holds `{"prepared":true}` and then the runner's process identity, and which stop and recovery read to find a live job. A lesson whose statement or quote is a substring such as `prepared` deletes process-control records of an unrelated live job.

### 2.2 Where lesson text lives

Current producers put lesson text (statement and quote) in exactly three kinds of place:

| Copy | Producer | Removed by |
|---|---|---|
| `state.lessons` in `state` and `state.prev` | [lesson](../packages/kernel/src/decisions/lesson.ts), [lessons.ts](../packages/kernel/src/core/lessons.ts) | `withoutLesson`, then two publications |
| Cached `session.last.response` on any work | `stamp` | `withoutLesson` clears every cached response |
| Review/analyst packet files under `<temp base>/manifests/` | `issueReview`/`issueAnalyst` in [manifest.ts](../packages/kernel/src/verbs/manifest.ts), called by mutating `packet`/`check-finalize` | `purge(texts)`, scoped to `manifests/` by §3.1 |

Journal entries carry no lesson text: intent/result payloads are the eight effect shapes in schema-migration §18.1, call records are `{verb,exit,revision}`, and accounting checkpoints hold counters. The same is true of `summaries.json`, decision records (a `decide lesson` call writes no decision record), dependency/undo blobs (user file content, not lesson copies) and the stateless `review` manifest (built from the working tree without reading state). Packets containing lessons are written only by mutating calls, under the store lock, after recovery has run.

Known limit, unchanged by this spec: entries moved into quarantine from a copied or imported `.tenet` are preserved inert and are not scanned. They belong to another store's history, and `forget` cannot name their lessons. This spec reports that limit; it does not change it.

### 2.3 Rollback eligibility already implies the initial floor

§16.6 admits rollback only when target files, references, log and summary match the applied manifest exactly, counters and sequences equal the saved projection, and no post-upgrade mutating action or pending job/reservation exists. It also sets `rollbackEligible=false` before any ordinary writer, including launch and finalize transactions. The companion's upcast ([config-completion.md §18.2](config-completion.md#182-typed-identities-and-minimal-schema-2-delta)) initializes every validity serial at 0, `jobSeq` at 0 and an empty job table, and leaves historical evidence unstamped. So a store that is still eligible for rollback has issued no validity serial above 0, no `jobSeq`, no launch and no stamped evidence. There is no floor above the initial one to preserve.

### 2.4 Migration operations and launch records

Schema-1 stores contain no `launch` journal records, no `State.recovery` and no ordinal ownership directories. The companion requires empty launch tables after a quiescence check before upcast. Upgrade sources are schema 1. Rollback sources are pristine schema-2 targets (§2.3).

## 3. Design

### 3.1 MC-3: crash-safe forgetting through the effect journal

Add one effect kind, `forget`, to the existing journal and reconciler table. The confirmed `decide forget` path becomes:

1. Find the lesson; ask `forget-confirm` exactly as today (preview unchanged).
2. `tx.intent("forget", id, { work, lesson })`, where `lesson` is the lesson id. No statement, quote or other text goes into the journal.
3. `ports.store.purge([statement, quote])` while the text is still in the admitted state. `purge` now scans only `<temp base>/manifests/`, the one directory that receives lesson-bearing packets. Run directories, check reports and `run.json` are never scanned, so process-control records cannot be deleted by a lesson's text.
4. Publish `withoutLesson(state, lesson)` twice, so both `state` and `state.prev` lack the lesson and every cached response is cleared.
5. `tx.result("forget", id, { completed: true })`.
6. Return as today. `stamp` then publishes once more, caches this call's response and appends the call record, exactly once.

Revision numbering: the store's `Tx.publish` sets the transaction's `state` to the document it just published. `stamp` already numbers the response from `tx.state`, so after any number of publications the response, cached response and call record carry the revision on disk. The decision receives a copy of the transaction with a different `state`, but shares the same `publish` function, which updates the pipeline's own transaction. Recovery publications follow the same rule. The pipeline's existing "recovered state differs from `tx.state`" checks then publish one extra time, which advances the revision without changing content; no comparison treats that as a change of meaning.

Steps 3-5 are one shared function used by both the decision and a new `SETTLE.forget` entry in [recover-effects.ts](../packages/kernel/src/verbs/recover-effects.ts). Recovery runs before any other work in the next mutating call:

- If the admitted state (primary, or `state.prev` after fallback) still holds the lesson, purge its texts, then publish twice and write the result.
- If it does not, the purge already completed, because step 3 precedes the first publication. Publish twice, which rotates any `state.prev` that still holds the text, then write the result.
- Add `"an interrupted forget was finished"` to the existing recovery notes.

The reconciler runs through the existing `settleEffects` loop. Its per-work guard (skip while that work's job process is alive, uncertain while cancelled) cannot hold a forget intent indefinitely: forget starts no job, and the next mutating call settles the intent before any job can start. A `stop` call defers effects and reports the intent as uncertain, as it does for every effect today; the next policy-aware call settles it.

Every kill point ends with no controlled copy left once the next mutating call has run. Repeating recovery is harmless: purge of absent text removes nothing, and extra publications only advance the revision. Stamp is never run for the killed call, which matches every other killed call today: no call record, no active-time accrual, no cached response. No plaintext is needed after a restart that follows the first publication, because the purge has already happened by then.

Exposure window: between a kill and the next mutating call, read-only views may show the lesson if the kill came before the first publication, and a damaged primary could fall back to a `state.prev` that still holds it. No packet can be written in that window: lesson-bearing packets come only from mutating calls, which run recovery first. This spec does not mask read-only views. It states the window plainly instead (§6, alternative M3-C).

Retry after a lost response: when `stamp` completed, the existing `session.last` cache replays the response. Otherwise the retried call first finishes recovery, and then the decision correctly reports that no such lesson exists (exit 2), with the recovery note naming the finished forget. No new reason code or response field.

Older kernels that meet an unresolved `forget` intent report it as uncertain through the existing unknown-effect path in [recover.ts](../packages/kernel/src/verbs/recover.ts). They do not act on it.

Interaction with the backup-reconfirmation draft ([recovery-reconfirmation.md](recovery-reconfirmation.md)): forget remains a work-scoped decision using the existing journal and `session.last` cache. It adds no pipeline terminal or retry mechanism, so there is nothing to reconcile with that draft's workspace acknowledgment, which remains its own open design.

**Target-protocol extension (inactive until migration is approved).** Forgetting is an ordinary writer, so §16.6 has already set `rollbackEligible=false` before step 2. §16.4 makes upgrade, rollback and their previews refuse while any intent is unresolved. Step 3 extends the scan to owned migration recovery sets, staging and payload-bearing descriptors. Any recovery set whose bytes contain either text is deleted whole, regular files first and then directories bottom-up once verified empty, as §16.7/R1 already require. Each schema-2 publication in step 4 is an ordinary `Tx.publish`, so it carries the companion's validity/launch checkpoint unchanged. This supersedes, for forgetting only, §18.4's privacy intent file, tombstone, staged sanitized replacements and the fixed P1/P2 publication prefixes: no lesson text exists in logs or blobs to sanitize (§2.2), and completion is a content condition rather than an exact byte image. The reserved sentinel `.tenet/migration-privacy.json` stays reserved and refused by the stage-19 bridge; nothing writes it. Explicit backup deletion (`backup-delete`) can use the same intent/delete/result pattern when it is specified; it is not specified here.

### 3.2 MC-4: rollback needs no floor carrier

Rollback admission adds an explicit pristine predicate, checked from the live target bytes and not only from the `rollbackEligible` flag: `State.recovery.jobSeq` is 0, `jobs` is empty, every `validity` serial is 0, no work or evidence stamp has a serial above 0, and the journal after the applied phase holds no `launch` record or version-2 effect payload. §16.6's exact-manifest match already implies this. The explicit check is a second guard, and it gives a falsifier that does not depend on the flag.

The applied manifest already names every schema-2 object the upgrade created, including converted archive objects with new hash names and target staging. Rollback adds one step between restoring the source marker (S/S/S in §18.2) and persisting the rolled-back completion: delete each listed upgrade-created object after verifying its recorded hash. An absent object counts as already deleted. A hash mismatch stops without deleting and without completing. Recovery after a kill repeats this step from the descriptor.

A later re-upgrade needs a new preview, consent and operation id, and starts at the initial floor. That is not a reset. The argument rests on what was issued, not on what was deleted: the rolled-back lineage issued no identity above the initial floor (§2.3), so any copy of its bytes that remains (converted archive objects, staging, descriptor digests) holds only identities at or below that floor and cannot collide with anything the re-upgrade issues. Deleting upgrade-created objects is storage hygiene and keeps the reference inventory exact, not a condition for the floor. The rollback descriptor is reduced to the §18.3 five-key terminal record as already specified; that record holds no target payload. Amend the companion's "jobSeq 0 only when no prior schema-2 lineage exists" to say that a lineage ended by pristine rollback counts as none, because it issued nothing. This also amends the §19 MC-4 instruction "never ... reset schema-2 lineage to zero": the instruction protects identities a lineage issued, and a pristine lineage issued none above zero. RB-1 and RB-2 are the falsifiers. The five-key R2 terminal record is unchanged.

### 3.3 MC-1: launch references by migration operation

| Operation | Launch records it can meet | Handling |
|---|---|---|
| Upgrade 1 -> 2 | None in a valid schema-1 source | The strict schema-1 journal decoder refuses any `launch` record as an unknown kind before preview. No launch decoder is needed in the source inventory. |
| Rollback 2 -> 1 | None in a pristine target | §3.2's predicate refuses before mutation when any launch record, job settlement or nonzero `jobSeq` exists. The rollback inventory never follows a launch reference. |
| Forget, schema 2 | Launch events and `launches/<ordinal>/run.json` | The purge scans only `<temp base>/manifests/` (§3.1) plus owned migration recovery sets, so ordinal ownership records and job reports are never scanned or deleted, and the stop/recovery horizon is untouched. |
| Compaction and storage pins | Unsettled launch events | Owned by companion §18.3. Migration recovery sets are created only from quiescent schema-1 sources, so their pins never contain launch identities. |

Add rows to schema-migration §18.1: `launch` journal records are classified by the companion's exact union and are never reference edges for migration copying; `launches/<ordinal>/` directories are non-restorable process-control metadata. The orphan, foreign, conflicting, missing-association and live-ordinal-child falsifiers listed for MC-1 in §19 belong to the companion's decoder and stop/recovery tests ([config-completion.md §20.2](config-completion.md#202-per-launch-ownership-must-reach-stop-and-recovery)). Migration owns only LR-1 to LR-3 below.

Also add a `forget` row to §18.1: op `{work, lesson}`, result `{completed}`, no reference edges. Unresolved intents already refuse migration.

## 4. Behavior as examples and test ownership

All rows are planned checks, not results. FG rows are the implementable schema-1 slice. RB and LR rows are inactive until migration is approved and will live in the planned migration suite.

| ID | Example and exact acceptance | Test home |
|---|---|---|
| FG-1 | Confirmed forget with packets holding the statement and quote: afterwards a byte scan of every file under `.tenet/` and the workspace temp base finds neither text; `state.prev` lacks the lesson; journal holds one `forget` intent and one matching result; exactly one call record. The response revision, cached response revision and call-record revision all equal the revision on disk. | [lessons.test.ts](../packages/kernel/test/lessons.test.ts) |
| FG-2 | Real child SIGKILL after the intent, after the purge, after the first publication, after the second publication and after the result. The next mutating call finishes the forget. The FG-1 byte scan passes, the recovery note appears where an intent was unresolved, and other lessons, works, counters and grants are unchanged. That call's response, cached response and call record carry the revision on disk. Two further restarts add nothing. | New `fixtures/crash-forget.ts` following [crash-adopt.ts](../packages/kernel/test/fixtures/crash-adopt.ts); assertions in lessons.test.ts |
| FG-3 | After the kill after the first publication, damage the primary so `read` falls back to `state.prev`: the next mutating call still ends with the lesson gone everywhere. | lessons.test.ts |
| FG-4 | Red controls. Move the purge after the first publication: FG-2's kill after the first publication leaves a packet with the text. Remove `SETTLE.forget`: the unresolved intent is reported uncertain and FG-2 fails. Remove the `tx.state` update in `Tx.publish`: FG-1's revision equality fails. Restore all three. | lessons.test.ts |
| FG-5 | Existing forget behavior is unchanged: preview question, `Keep it` changes nothing, unknown lesson exit 2, cached responses cleared, `outside` text present. | existing lessons.test.ts cases |
| FG-6 | Purge scope. A lesson whose statement is `prepared` and whose quote matches a `pid` field and a line in a check report is forgotten while another work has a prepared job with `run.json` and a live child process. `run.json` and the report stay byte-exact, `stop` still finds and ends the child, and the packet under `manifests/` holding the statement is deleted. | lessons.test.ts with a real child process |
| RB-1 | Pristine target: rollback succeeds and removes every manifest-listed upgrade-created object; re-upgrade begins at serial 0 and `jobSeq` 0 with a new operation id. | planned migration suite |
| RB-2 | Set `rollbackEligible=true` by hand on a target holding one `prepared` launch record, or one serial-1 stamp: preview and rollback refuse with byte/mode/inventory snapshots unchanged. | planned migration suite |
| RB-3 | SIGKILL during upgrade-created object deletion, with two restarts: deletion completes or stops on a hash mismatch, and never completes the rollback over a mismatch. | planned migration suite |
| LR-1 | Schema-1 journal containing a forged `launch` record: upgrade preview refuses before any write. | planned migration suite |
| LR-2 | Schema-2 forget with a live ordinal child and a report containing the text: `run.json` and the report byte-exact, stop still finds and ends the child, the packet under `manifests/` is deleted. | planned migration suite with runner-ownership fixtures |
| LR-3 | Upgrade or rollback with an unresolved `forget` intent: refuses before mutation. | planned migration suite |

Tag FG tests `[CON-10]`. Real processes and real signals are required. Windows mutation stays unsupported, so FG tests need the same supported-POSIX execution route that blocks MC-2.

## 5. State and contract changes

- **Journal (schema 1, additive):** new effect kind `forget` with intent op `{work, lesson}` and result `{completed: true}`. No schema version change: existing journal parsing admits any effect string; older kernels report it as uncertain.
- **Store port:** signature unchanged. `purge(texts)` scans only `<temp base>/manifests/` instead of the whole temp base. The store's `Tx.publish` sets `tx.state` to the published document.
- **State schema:** unchanged.
- **Responses:** shape unchanged, with one new recovery note string. A confirmed forget's response, cached response and call record now carry the revision on disk instead of one less.
- **Canonical specs after implementation:** technical specification §7.7 (forgetting order and crash recovery) and the §7.4 effect list. Schema-migration §18.1 gains `forget` and launch rows; §18.2 gains the deletion step and the pristine predicate; §18.4 is superseded for forgetting; §19 marks MC-1/3/4 dispositioned. Config-completion §18.2's lineage wording is amended. These are spec amendments and need owner approval (§9).

## 6. Alternatives

| Blocker | Option | Consequence | Recommendation |
|---|---|---|---|
| MC-3 | A: `forget` effect with purge before publish (§3.1) | Uses the existing journal and reconciler. No port signature, schema or response-shape change; purge scope narrows and responses report the true revision. Also fixes today's three defects (§2.1). | **Recommended** |
| MC-3 | B: §18.4/§19 privacy plan with pre-staged P1/P2 images, accounting/log bytes, fixed response and recorded call | Needs a second publication path beside `stamp`, a new intent file and byte-exact replay. Protects log/blob copies that do not exist (§2.2). | Not recommended |
| MC-3 | C: A plus masking lessons named by unresolved `forget` intents in `read()` | Closes the read-only display window, at the cost of store-fs code and a second meaning for `read()`. No copy is left behind without it. | Optional; ask only if the owner wants it |
| MC-4 | A: pristine predicate and upgrade-object deletion, no carrier (§3.2) | Small, checks what §16.6 already requires. | **Recommended** |
| MC-4 | B: bridge-readable floor file | New bridge format, lifecycle and reduction rules, needed only if rollback after post-upgrade work were allowed, which §16.6 forbids. | Not recommended |
| MC-4 | C: refuse every rollback | Drops the rollback path the owner approved in decision 12/D8. | Not recommended |
| MC-1 | A: per-operation table (§3.3); decoders stay with the companion | No migration-owned launch traversal. | **Recommended** |
| MC-1 | B: migration-owned launch decoder and reference graph | Duplicates the companion's schema and adds a second owner. | Not recommended |

## 7. Impact, budget and risks

Implementable slice, by budget owner:

- `adapters/store-fs` (1,267 characters free): scope `purge` to `manifests/` (expected to shrink or stay level) and set `tx.state` in `Tx.publish` (a few dozen characters).
- `pipeline + verbs + decisions` (5 characters free): the intent and shared completion function in [forget.ts](../packages/kernel/src/decisions/forget.ts) and one `SETTLE` entry in [recover-effects.ts](../packages/kernel/src/verbs/recover-effects.ts). Estimated 350-450 non-whitespace characters, roughly 6-8 budget lines (0.15-0.19%). This is an estimate, not a measurement.

[config-completion.md §20.4](config-completion.md#204-current-capacity-not-an-implementation-estimate) states that the five free shared characters are not an implementation budget and asks for measured, behavior-preserving simplification before growth. The owner's standing pre-approval for logged module-budget increases under 1% (plan §13, 2026-10-24; technical specification §6.2) has been used for earlier small increments, but the plan's config-completion entry records that the allowance alone authorizes no growth there. Whether it covers this repair is an owner decision (§9). Whichever path is chosen, the delta is measured with the quality gate's `measure`/`budgetChars` before the request is closed, and implementation stops and reports if measured growth exceeds the approved amount. No core, schema or bundle limit is expected to change.

Risks:
- Extra revisions: a forget now advances the revision by three instead of two, and recovery can add one more. Revisions have no user-facing meaning beyond ordering, and responses now report the true value.
- Purge before publish deletes packets first. A kill there leaves the lesson in state while its packets are gone. Packets are rebuilt on demand, and recovery finishes the forget, so nothing is lost.
- Narrower purge: a file outside `manifests/` that happens to contain the text (for example a check report quoting the same log line the lesson quotes) is no longer deleted. Such a file is source evidence, not a copy of the lesson Tenet made, and deleting it could remove process-control records (§2.1). FG-1's byte scan covers every location that receives lesson text from Tenet.
- Setting `tx.state` on publish changes a shared transaction field. Only `stamp` and the pipeline's recovered-state comparisons read it after a publication; the full CI suite is the check.
- Downgrade to an older kernel with an unresolved `forget` intent leaves it uncertain until a newer kernel runs. The version pin already discourages this.
- §2.2's inventory is a claim about current producers. FG-1's byte scan is its test; a new producer that writes lesson text elsewhere would fail it.

## 8. Assumptions

- Lesson-bearing packets are written only to `tempDir("manifests")` (manifest.ts `issueReview`/`issueAnalyst`). The stateless `review` manifest under `tempDir("review")` is built without reading state. Verified for current producers only.
- Publication via `Tx.publish` stays atomic per rename, with directory fsync, as today.
- §16.6 and the companion's upcast keep the wording cited in §2.3. If either changes, §3.2 must be rechecked.

## 9. Gates and decisions for the owner

Lifecycle: independent review with dispositions recorded in §10, then owner sign-off, then TDD on a supported-POSIX route, `npm run ci`, built scratch UAT on current and minimum Node, canonical amendments, changelog, plan, privacy check. Commit and push only when asked.

Decisions, one at a time:
1. How the shared-budget growth for the schema-1 forget repair (§3.1, FG-1 to FG-6) is paid for: (a) under the standing under-1% pre-approval, measured and logged; (b) a separately specified, measured, behavior-preserving simplification in the shared budget first, then the repair; (c) defer the repair and record the three present-day defects as open. Recommendation: (a). The repair fixes a privacy defect and two correctness defects, its expected size is under 0.2%, and (b) adds a refactor whose own review is larger than the repair.
2. Approve the schema-1 forget repair itself (§3.1 including the narrower purge scope and the `tx.state` revision rule).
3. Approve the MC-3/MC-4/MC-1 dispositions as amendments to schema-migration §§18-19 and config-completion §18.2 (inactive target text only).

Owner decisions, 2026-10-27: 1 = (a), measured and logged under the under-1% pre-approval; 2 = approve as specified, without read-only masking; 3 = approve all three. The amendments are applied in schema-migration §§18.1, 18.2, 18.4 and 19 and config-completion §18.2. Technical specification §7.7 and the §7.4 effect list are backfilled when §3.1 is implemented.

## 10. Independent review dispositions

Review 2026-10-27 by a fresh-context reviewer, checked against source. Every finding is accepted.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| R1 | Blocker | `stamp` numbers from the transaction's original state while each publication rereads and increments the live revision, so publications before `stamp` (today's forget, and the proposed reconciler) make the response, cache and call record report an older revision than the disk. | Accepted; confirmed in source (pipeline-render.ts `stamp`, store-fs.ts `publishState`, forget.ts). Recorded as a present-day defect in §2.1. Fixed by §3.1's revision rule: `Tx.publish` sets `tx.state` to the published document. FG-1, FG-2 and FG-4 assert revision equality. |
| R2 | Major | `purge` scans the whole temp base and can delete `run.json` and check reports when the lesson text is a substring of them, stranding a live job; §3.3's claim that `run.json` is never deleted was false, and LR-2 was inconsistent. | Accepted; confirmed (store-fs.ts `purge`, pipeline-mutate.ts writes `{"prepared":true}`). Present-day defect in §2.1. Purge is scoped to `manifests/`, the only lesson-bearing directory. §3.3, LR-2 and §7 risks are corrected; FG-6 added. |
| R3 | Major | §3.2's "no copy of its target survives" was not established; converted objects, staging and descriptor digests may remain. | Accepted. §3.2 now rests the floor argument on what was issued (nothing above the initial floor), so surviving copies cannot collide; deletion is hygiene, and the descriptor is reduced to the §18.3 terminal record as already specified. |
| R4 | Major | The budget claim relied on five free characters that config-completion §20.4 says are not an implementation budget, and omitted store-fs and pipeline changes. | Accepted. §7 lists every budget owner touched, states the conflict between the standing under-1% pre-approval and §20.4, requires measurement, and §9 decision 1 asks the owner. |

Claims the reviewer checked and found correct: §2.1's crash windows; the lesson-copy inventory (state and `state.prev`, cached responses, reviewer/analyst manifests; stateless review reads no lesson state); recovery runs only for mutating calls and before the verb; a forget intent cannot be paired with a live job of its own work; journal reduction keeps unresolved intents; exact-manifest rollback eligibility implies no identity above the initial floor; the crash fixture plan uses real processes and signals and `[CON-10]` is a valid tag. The coordinator also confirmed that journal parsing accepts any effect string and refuses unknown record kinds (store-fs.ts `LogRecord`).
