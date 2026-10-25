# Specification: Version Pinning and Schema Migration (LFC-03, LFC-04, CON-05)

> Status: Reviewed 2026-10-24 (fresh-context subagent: 16 findings, 3 blockers; dispositions in §12). **§13 (v2) supersedes §3 to §11 where they differ**: version pinning and the pause are specified for build; schema migration is split out and deferred with its design notes recorded. Awaiting owner decisions (§14). No code before sign-off. Date: 2026-10-24 | Decision owner: @vedprakash-m.
> Sources: PRD LFC-03, LFC-04, CON-04, CON-05, §5.14 (continuity matrix: "Tenet update mid-contract"); tech-spec §7.7, §15.2, §15.3 (`version-changed`), §7.2 (`pinned` field), failure matrix.

## 1. Outcome

When Tenet is updated while a project has state, the user is never silently moved between versions: a contract pinned to the old versions stops at its next boundary, says what changed, and continues only after an explicit reconcile; an older state document is migrated only after a preview and with a restorable backup; a state document written by a newer kernel is never rewritten by an older one. Records that cannot be understood are diagnosed, not reset.

**Verification:** real stores and real kernel processes; compare responses, stored documents and backups with the examples in §5.

## 2. Current state (inspected 2026-10-24)

- Only schema version 1 exists (`SCHEMA_VERSION = 1`, `core/schemas.ts:7`), so no migration has ever been needed or written.
- The store refuses any marker whose `schema` differs from the running kernel's, older or newer alike, with `unsupported-record` (exit 4, "needs a compatible kernel or an approved migration; it was not quarantined", `adapters/store-fs.ts:221`). No code path produces the reason `migration-needs-approval` (declared in `core/reasons.ts:76`).
- There are no upcast functions, no `state.v<N>.bak`, no read-only mode for a newer document. `state.prev` is the only older copy and it exists for crash recovery.
- A contract records `pinned: { tenet, schema }` when it is created (`core/state.ts:64`, `core/schemas.ts:296`). Nothing ever compares it with the running kernel, so the reason `version-changed` (`core/reasons.ts:77`) is never produced. The technical specification's `pinned` also lists `recipe` and `adapter` (tech-spec line 780); the code records neither.
- The adapter version is already part of the toolchain fingerprint, so a changed adapter makes old receipts stale, but nothing tells the user or pauses the contract.
- `State` is a strict object with an optional `_ext`; unknown top-level fields are refused at parse, not preserved.

## 3. Requirements

| ID | Requirement | Source |
|---|---|---|
| VM-1 | A contract records, when created, the kernel version, schema version, recipe id and version (if any) and adapter version it runs under (`pinned`). | LFC-03 |
| VM-2 | On every call that names a contract, the running versions are compared with the contract's `pinned`. A difference makes the call return `version-changed` (exit 3) with one question; only `inspect`, `stop` and the answering `decide` proceed. A check or other job already running is never interrupted: the pause applies from the next call. | LFC-03, PRD §5.14 |
| VM-3 | The answer to the question is `decide version-reconcile` with the choices "continue under the new versions" (re-pins; evidence keyed to the old adapter or toolchain is already stale and reruns) or "stop" (parks the contract). Nothing is decided for the user, and grants, locks, counters and intent are unchanged by either choice. | LFC-03 |
| VM-4 | A state document with a lower schema than the kernel's is read through pure upcast functions. Read-only calls upcast in memory only. The first mutating call returns `migration-needs-approval` with a preview of what changes and where the backup goes. | LFC-04, TS §7.7 |
| VM-5 | On acceptance, the old document is kept byte for byte as `state.v<N>.bak` before the new one is published; if the user declines, the kernel runs read-only and says so. | LFC-04 |
| VM-6 | A state document with a higher schema than the kernel's is never rewritten: the kernel runs read-only, names the schema it saw and the kernel version that wrote it, and explains how to update. | LFC-04, TS §7.7 |
| VM-7 | Unknown fields are kept under `_ext` where safe, and make a record unsupported (`unsupported-record`, exit 4) inside grants, restrictions and consents. | LFC-04, CON-05 |
| VM-8 | A malformed, unknown-version or conflicting record is diagnosed with its location and the choices that exist; it is never reset and never grants authority. | CON-05 |
| VM-9 | Rolling the plugin back restores `state.v<N>.bak` only if nothing was mutated since the migration; otherwise the older kernel runs read-only (VM-6) and explains. | LFC-04 |

## 4. Design

- **Pinning.** `WorkContract.pinned` becomes `{ tenet, schema, adapter, recipe? }`, all optional-compatible for existing documents (a missing field reads as "unknown", which is treated as unchanged for that field so existing contracts do not all pause once; the first reconcile fills it). `newContract` takes the adapter and recipe versions from the stack and project state.
- **Detection.** A pure `versionDrift(pinned, running)` in `core/` returns the changed fields. The pipeline's envelope step (which already resolves the contract) raises `version-changed` before the verb runs, except for the verbs that may proceed (VM-2). Because it sits in the shared envelope it cannot be bypassed by a front-end.
- **Reconcile.** `decide version-reconcile` (a new kind in the registry) applies the choice and re-pins. It writes one line to the handoff.
- **Migration registry.** `core/migrate.ts` holds an ordered list of `{ from, to, upcast(doc) }` pure functions (empty today, since only schema 1 exists) and `migratePath(from, to)`. The store reads the marker and state schema, upcasts in memory, and distinguishes lower, equal and higher. The `migration-needs-approval` response carries a preview built from a pure `describeMigration`. The backup is written with the existing synchronized private-file writer before the new document is published.
- **Read-only mode.** The store gains a `readOnly` condition surfaced to the pipeline, which refuses mutating verbs with the reason and still serves read-only views.
- **Test seam.** The store accepts an injected migration list so tests can exercise the whole flow with a fake `1 → 2` upcast without shipping a real second schema.

## 5. Examples (test ownership)

| # | Example | Test file |
|---|---|---|
| E1 | A contract created under kernel 0.1.0 is called by a kernel reporting 0.2.0: `version-changed`, one question, `inspect` and `stop` still work. | `version-pin.test.ts` |
| E2 | The answer "continue" re-pins; the next call runs; grants, locks, counters and receipts are unchanged. | `version-pin.test.ts` |
| E3 | A check is running when the version changes: it finishes and publishes; the following call pauses. | `version-pin.test.ts` (real process) |
| E4 | A contract with no recorded adapter or recipe (older document) does not pause for those fields. | `version-pin.test.ts` |
| E5 | The adapter version changes: the contract pauses, and after "continue" the old receipts are stale and a check reruns. | `version-pin.test.ts` |
| E6 | Schema 1 state, kernel with a fake `1 → 2` migration: a read-only call upcasts in memory and writes nothing. | `schema-migration.test.ts` |
| E7 | The first mutating call returns `migration-needs-approval` with a preview; nothing is written. | `schema-migration.test.ts` |
| E8 | Acceptance writes `state.v1.bak` equal byte for byte to the old document, then publishes schema 2. | `schema-migration.test.ts` |
| E9 | A kill after the backup and before publication leaves the old document intact and a rerun completes the migration. | `schema-migration.test.ts` (real SIGKILL) |
| E10 | Declining leaves the kernel read-only with a clear message; mutating verbs are refused, inspect works. | `schema-migration.test.ts` |
| E11 | A schema 3 document under a schema 2 kernel is never rewritten; the response names both versions. | `schema-migration.test.ts` |
| E12 | Rollback with no mutation since the migration restores the backup; with a mutation it runs read-only and explains. | `schema-migration.test.ts` |
| E13 | An unknown field at the top level is kept under `_ext` and survives a publish; inside a grant it is `unsupported-record`. | `schema-migration.test.ts` |
| E14 | A malformed state with a valid `state.prev` is diagnosed and falls back as today, never reset; a conflicting marker and state schema is diagnosed. | `schema-migration.test.ts` |

## 6. State and contract changes

- `pinned` gains optional `adapter` and `recipe`. Both schemas are non-strict at the nested object, so older readers ignore the new fields.
- New files in `.tenet/`: `state.v<N>.bak` (one per migration), counted against the storage budget and never evicted while the migrated schema is current (plan §12.10).
- New decision kind `version-reconcile`; new response states `version-changed` (exit 3) and the read-only condition.
- No change to the journal format, receipts or the marker beyond its existing `schema` field.

## 7. Alternatives

| Option | For | Against |
|---|---|---|
| A. Everything now, including a real schema 2 | Exercises the path end to end | There is no schema 2 to migrate to; inventing one is speculative and adds a format nobody needs |
| B. Pinning and the pause (VM-1 to VM-3) plus the migration machinery with an injected test migration (VM-4 to VM-9) | Closes LFC-03 for real, builds and proves the migration flow before it is needed, no invented format | The registry is empty in the shipped kernel; the first real migration still has to be written and reviewed |
| C. Pinning only; defer migration until a schema 2 is needed | Smallest | LFC-04 stays unbuilt and untested until the day it is urgent, which is the wrong time to build a data-safety path |

**Recommendation: B.** LFC-03 is a visible, user-facing safety behavior that can be completed and proven now; the migration machinery is cheap to build against a fake migration and expensive to build under release pressure.

## 8. Risks

- A version check in the shared envelope pauses every contract once after a normal update. The `unknown`-field rule (E4) limits that to real changes; a kernel patch release still pauses contracts once, which is the specified behavior ("pause at the next boundary") but may feel noisy. Decision D2.
- The read-only mode touches the pipeline. It must refuse mutating verbs in one place.
- The injected migration is a test seam in production code (an option on the store); it must be unreachable from the command line.

## 9. Assumptions

- The kernel version is available at run time (`version.ts`) and the adapter version from the stack's fingerprint.
- Users update the plugin through the host; Tenet cannot observe an update except by seeing different versions on the next call.

## 10. Acceptance criteria

1. E1 to E14 pass with real stores and processes.
2. No path rewrites a document written by a newer schema.
3. A migration never publishes before its backup is durable.
4. `npm run ci` within module budgets (increases above 1% raised for decision); built-CLI scratch run; plan, changelog, TS §7.7/§15.3 backfill.

## 11. Decisions for the owner

- **D1.** Option B (recommended), A or C.
- **D2.** Which version changes pause a contract: any change in kernel, schema, adapter or recipe (recommended, as specified), or only schema, adapter and recipe (patch releases of the kernel alone do not pause).
- **D3.** `state.v<N>.bak` retention: keep until the next migration (recommended), or delete after N successful mutating calls.

## 12. Independent review: findings and dispositions (2026-10-24)

Reviewer: a fresh-context subagent, read only. I re-checked the load-bearing claims: the envelope runs only under `if (input.h && current)` (`pipeline-mutate.ts:162`); `open --resume` selects a contract by profile and takes no handle (`verbs/open.ts:99`); `marker()` throws `marker-mismatch` on any schema difference (`adapters/store-fs.ts:172`), a second refusal beside `acquire`'s `unsupported-record` (`:221`). Two claims in §2 were wrong: `SCHEMA_VERSION` is at `schemas.ts:8`, and the refusal described as "any mismatch" holds on the mutating path only, while read-only calls fail earlier in `marker()`; and §6 cited plan §12.10 for backup retention, which says nothing about backups.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | Blocker | The envelope runs only when a handle is given: `open --resume` (the path an update forces, in a new chat) and every read-only verb bypass the check. | **Accepted.** v2 checks in the plan step after the fence, for handle calls and for `open --resume` by its selector; read-only verbs report drift as a non-blocking reason (§13.2). |
| 2 | Blocker | Order against `fence` decides everything: before it, the version check blocks the takeover, abandon, repair-lock and quarantine answers; after it, `version-reconcile` can be fenced behind a pending question or `work-busy`. `recover` runs before any check. | **Accepted.** Explicit order and a verb-by-decision table in §13.2; `version-changed` is a returned question bound to the drift, never a stored pending question, so the fence is not entangled. Recovery under the new kernel is stated as acceptable (it only completes recorded effects whose postconditions it checks). |
| 3 | Major | "Running adapter version" undefined: the fingerprint includes node and dependencies (would pause on `npm install`), can throw, and the stack port does not expose `ADAPTER`; the recipe version has no source (project-level `recipe.version` changes only on scaffold). | **Accepted.** `stack.adapterVersion()` returns the constant; drift compares only that. Recipe is dropped from drift (no honest source); it stays out of `pinned`. |
| 4 | Major | "Unknown means unchanged" leaves old contracts permanently unpinned; kernel version has no defined change rule; an older kernel strips the new fields. | **Accepted.** A missing `adapter` is back-filled silently on the first call. The kernel field compares `major.minor` plus the pre-release tag. An older kernel stripping the fields is covered by the drift rule itself (it re-pins after a visible reconcile). |
| 5 | Blocker | Migration vs the marker: the marker also carries `schema`; `acquire` and `marker()` refuse before any approval path; a crash between marker and state writes yields marker≠state and a silent `state.prev` fallback; `prev` has the old schema right after migration and the new validator rejects it. | **Accepted; migration deferred.** The full ordering (backup, directory sync, marker, state, directory sync), the four marker/state mismatch recoveries, upcasting `prev`, and versioned parsing in `publishState` and `prevRevision` are recorded as design notes (§13.4), not built. |
| 6 | Major | Read-only upcast without a lock and revision counting. | **Accepted; deferred.** Note recorded: an upcast never touches `revision`. |
| 7 | Major | Read-only mode cannot be enforced in one pipeline place: `acquire`, `repairLogTail`, `ensureMarker`, `evict`, `sweepTemp`, `purge`, `cleanTemp`, `repairLock` write outside the pipeline. | **Accepted; deferred.** Recorded: enforce in `FsStore.transaction`/`acquire` with an explicit allow-list. Not needed for pinning, which never makes the kernel read-only. |
| 8 | Major | A newer state fails parse and `read()` falls back to `state.prev`, so an older kernel would write over newer state. | **Accepted; deferred, with a present-day check.** Today the marker's schema check protects a mismatched store; a test that a store with a higher marker schema is never written is added to this slice (E11). |
| 9 | Major | Rollback (VM-9) undefined: an older kernel cannot know `.bak`; "nothing mutated" is not recorded. | **Accepted; deferred.** Recorded: `migratedAtRevision` in the backup header and a `decide rollback-migration` run by the new kernel, or a documented manual restore. |
| 10 | Major | A byte-for-byte backup contains lessons, so `decide forget` must scrub it; backup write failure must abort before publishing. | **Accepted; deferred.** Recorded as a requirement of the future migration spec; relevant to `forget.ts` today only once backups exist. |
| 11 | Major | Test seam is production code; must be unreachable from `wire.ts`; must also inject the target validator. | **Accepted; deferred** with the migration. Not used by pinning. |
| 12 | Major | Unknown fields: nested plain `z.object`s strip unknown keys on every `publishState`, a present forward-compatibility data-loss path; `strictObject` rejects top-level unknowns; the rule table is missing. | **Accepted; logged.** Recorded in plan §12.3 as a spec defect to fix with the migration spec; no change here. |
| 13 | Minor | Kernel version is the fixed string `0.1.0-m0`; D2 noise. | **Accepted.** D2 recommends `major.minor` plus pre-release. |
| 14 | Major | Missing examples (two kernels on one store, downgrade, kill at each step, quarantined document, marker/state mismatch, `open` on a paused project, parked handle after reconcile). | **Accepted.** The pinning ones are in §13.3; the migration ones go with the migration spec. |
| 15 | Minor | Budget estimate and module ceilings. | **Accepted.** Estimate in §13.5; any increase above 1% is raised for decision. |
| 16 | Major | Option B overstates: with an empty registry LFC-04's "tested path back" is a mechanism, not a release path; CON-05 relies on the `state.prev` fallback; LFC-03's "migrate or reconcile" has no migrate choice. | **Accepted.** LFC-04 stays open and is not claimed; CON-05 is recorded as partly met; LFC-03 is met by reconcile (continue or stop), and "migrate" applies once a migration exists. |

## 13. Revised scope, v2 (supersedes §3 to §11 where they differ)

**1. What is built now: LFC-03 only.** Version pinning and the pause. Migration (VM-4 to VM-9, LFC-04) is deferred to its own spec, triggered by the first real schema change; the reviewed design notes in §13.4 are the starting point. The injected-migration seam, `state.v<N>.bak`, read-only mode and rollback are not built.

**2. Pinning, detection and the order.**
- `pinned` becomes `{ tenet, schema, adapter }`. New contracts record all three. `adapter` comes from a new `stack.adapterVersion()` (the `ADAPTER` constant). A missing `adapter` on an existing contract is back-filled silently at its first call. Recipe is not part of drift.
- Drift is a pure `versionDrift(pinned, running)` returning the changed fields: `tenet` compared as `major.minor` plus any pre-release tag; `schema` and `adapter` compared exactly. It is symmetric: an older kernel on a newer pin also drifts (a downgrade is named as one).
- Order in the plan step: parse, `fence` (pending-question rules, `work-busy`), then the version check, then the verb. For `open --resume` the contract is selected by its existing selector and checked the same way. Read-only verbs and `inspect` do not stop; they add a non-blocking `version-changed` note for the contract in view.
- When it stops a call, it returns exit 3 with a question bound to the drift (`version-reconcile`), not a stored pending question.
- Allowed while paused: `stop`; `inspect` and other read-only verbs; `decide` kinds `version-reconcile`, `abandon-confirm`, `takeover-check`, `repair-lock` and the quarantine answers. Every other verb and decision is refused with `version-changed`.
- `decide version-reconcile` answers `continue` (re-pin to the running versions; evidence keyed to a different adapter is already stale and reruns; grants, locks, counters and intent unchanged) or `stop` (parks the contract). It re-pins only the contract it names. Other contracts pause independently on their next call. Creating a new contract on a project with paused ones is allowed and pins the new versions.
- A check already running is never interrupted; the pause applies to the next call (the existing `work-busy` fence already refuses calls during a run).
- Recovery runs before the check, as today; it only completes effects already recorded and checks their postconditions.

**3. Examples (all in `version-pin.test.ts`, real stores, a stack wrapper reporting other versions).** E1 a contract pinned under one adapter version, called by a kernel reporting another: `version-changed` with one question; `inspect` and `stop` work. E2 "continue" re-pins; the next call runs; grants, locks, counters and receipts unchanged; old receipts are stale and a check reruns. E3 a real check is running when versions change: it finishes and publishes; the next call pauses. E4 an older document with no `adapter` is back-filled, not paused. E5 `open --resume` on a drifted contract pauses. E6 a read-only verb (`inspect --view status`) returns a non-blocking note and is not refused. E7 a pending takeover question and a drift together: the takeover answer is accepted, then reconcile. E8 a downgrade (older kernel, newer pin) is named a downgrade and pauses. E9 a handle of a parked contract after another contract reconciled: still pauses for itself. E10 `open` of a new contract on a project with a paused one succeeds and pins the running versions. E11 a store whose marker has a higher schema is never written by this kernel (no `.gitignore`, journal repair, eviction or temp sweep changes anything). E12 patch-only kernel change (`0.1.0-m0` to a patch of the same major.minor) does not pause.

**4. Migration design notes (recorded for the later spec; not built).** Step order: durable backup, directory sync, marker, state, directory sync, with a recovery rule for each marker/state mismatch (marker N and state N-1 resumes; marker N-1 and state N rolls the marker forward; never fall back to `state.prev` on a schema mismatch). Upcast `state.prev` too; version the parsing in `publishState` and `prevRevision`. An upcast never changes `revision`. Read-only is enforced inside `FsStore.transaction` and `acquire` with an allow-list, covering the store's own writers (`repairLogTail`, `ensureMarker`, `evict`, `purge`, `cleanTemp`, `sweepTemp`, `repairLock`). Read the raw schema before parsing and never fall back. Rollback is a `decide` run by the new kernel using `migratedAtRevision`, or a documented manual restore. `decide forget` must scrub backups. Nested plain `z.object`s strip unknown keys on every publish today; the migration spec must list each record type's unknown-field behavior. The test seam must inject the target validator and be unreachable from `wire.ts`.

**5. Size and state.** `Obligation`-level nothing changes. `WorkContract.pinned` gains `adapter` (non-strict, optional). Estimated growth: about 30 lines in `core/` (`versionDrift`, semver compare), 45 in `pipeline-mutate.ts`/`open.ts`/`decisions` (check, resume path, `version-reconcile`, read-only note), 3 in the stack port and node-ts. The verbs ceiling would rise by about 2% (needs the owner's decision at build time, not pre-approved).

**Acceptance (v2).** E1 to E12 pass; no existing test changes behavior; full CI within budgets; plan, changelog, TS §15.3 backfill; LFC-03 recorded as met for kernel, schema and adapter versions (recipe excluded), LFC-04 and CON-05 recorded as open and partly met.

## 14. Decisions for the owner (review applied)

- **D1.** Approve v2: build pinning and the pause now; split migration into its own later spec (triggered by the first real schema change). Alternatives: (a) also build the migration machinery now, which the review shows touches the store's deepest paths (marker, `state.prev`, journal repair, read-only enforcement) for a format that does not exist; (b) defer both.
- **D2.** Which changes pause: `major.minor` plus pre-release of the kernel, any schema change, any adapter change (recommended); or only schema and adapter.
- **D3.** Budget: the build needs about 2% of the verbs ceiling; approve in advance, or I raise it at build time.
