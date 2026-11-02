# Complete-target deletion-map investigation — November 1, 2026

Read-only review of current main and the 28-row inventory in `specs/protocol-capacity.md`, plus the later QLT-11 scope. This is a responsibility map and failed replacement hypothesis, not a fitting implementation. No budget, matcher, safeguard or required behavior changed.

| Inventory | Current responsibility that must remain covered | Demonstrated deletion disposition |
|---|---|---|
| S1 | State, WorkContract, accounting/key validators | Legacy admission remains; no proven target saving. |
| S2 | Receipt, Reservation, session/inCall, AccountingCheckpoint | Target lifecycle union may replace target duplication; compatibility inputs remain. |
| S3 | Marker/journal shapes and migration phases | Missing migration responsibilities are additions, not deletion credit. |
| S4 | State.parse, schemaStatus, admissionRecord, readJournal | Legacy producer decoding remains required. |
| C1 | decisions/simple config proposal workflow | A full approved replacement must cover confirmations/readback; this function alone does not fund it. |
| C2 | reconcileShared/sharedPolicy/settingsFor/withRequiredChecks and pre-cache envelope | Resolution is already shared; all-work invalidation adds work. |
| C3 | guardLaunch, ownerOf, stillWanted, job preparation | Replacement must cover every producer and ordinal before old wiring disappears. |
| C4 | execute/runStatic/runE2e, reruns, finalization | One concrete additive launch-accounting deletion below; attempts/signatures remain distinct. |
| C5 | issueReview, recordReview/recordAnalyst, reservation settlement | Native delegation and process settlement are not interchangeable. |
| C6 | startCommit, integration settle, recovery SETTLE/PUBLISH | Completion, authority, postconditions and proof credit differ. |
| C7 | stopProcess, discardDeadRuns | Both already reuse recoverStoppedCall; no duplicate full recovery engine to remove. |
| C8 | main/CLI dispatch, completeForget, inspect/settings | Migration routing is new; ordinary dispatch/forget semantics remain. |
| A1 | Store admit/read/acquire/ensureMarker and descriptor reads | Reader mechanics already centralized; no substantial duplicate. |
| A2 | publishState/writeSynced/replaceSynced/fsyncDir | Migration installation/rollback has additional durability barriers. |
| A3 | reduceLog/evict/purge and writer boundaries | Horizons, forfeiture, protected retention and whole-set forgetting add obligations. |
| B1 | accountingCheckpoint/recoverAccounting/monotone inventory | Legacy conflict/maxima recovery cannot be replaced by target contiguous settlement. |
| R1 | Runner guardRun/run/writeRecord/stopRun | Identity-safe process control remains; process metadata is not an accounting ledger. |
| V1 | Review check/apply result and Analyst variants | Preserve full/focused/recheck/Analyst distinctions. |
| V2 | verdict and verdictInput | A single endpoint producer already exists; current-binding checks remain additional. |
| G1 | Three Git runner producers | Typed operation context adds little source but supplies no meaningful deletion. |
| O1 | validateSetting/resolveSetting/mergeLayers/effectiveSettings | Existing resolution is already shared. |
| O2 | comparePolicy/effectivePolicy and comparators | Tightening, commands and whole definitions have distinct semantics. |
| O3 | deriveObligations/static/E2E/baseline matching | Actual definition equivalence and baseline binding remain required. |
| O4 | reduceJournal/addMonths/store reduceLog | Monthly summaries are not cumulative recovery snapshots. |
| O5 | emptyState/newContract/recoveredState/recordedResults | Fresh initialization, legacy recovery and replay differ intentionally. |
| O6 | stableStringify/hashOf and current IDs | Structured keys add specificity, not large deletion capacity. |
| O7 | Job/Plan/Tx/Runner/RunSpec types | Type-only source contributes no material bundle saving. |
| O8 | main/wire/frontend entry | Early migration routing must precede ordinary dispatch without a second dispatcher. |
| QLT-11 | Project/basis string traits, claimSource risk, obligation/review consumers | Strings are not the typed target detector; legacy values stay inert. New registry/evidence/corrections cannot be counted as deletions. |

The one concrete deletion is the `check-evidence.account` block computing `ranTests`, `reran`, `launched` and calling `recordLaunchedChecks`: **366 non-whitespace characters before replacement/import adjustments**. Configuration §18.4 explicitly requires removing it **after** every primary/static/E2E/rerun invocation is covered by durable settlement, to avoid double charging. Removing it now would lose accounting. This is not a 366-character available saving on main today.

The last recorded scratch source is central 293,390, accounting 23,047 and store 38,277 characters. Against current approved ceilings, those historical excesses are 46,171 / 14,177 / 12,357 respectively; the accounting ceiling is now 8,870, not the older scratch 8,640. Recorded bundle was roughly 814/800 KiB. QLT-11 and complete migration/source closure were still missing. The small conditional deletion is orders below those gaps and does not demonstrate a fitting target.

No credible complete deletion map follows from the inspected source. The next step is to locate a single frozen candidate and reconcile its actual implementation against every row and QLT-11, with source identities and unchanged current caps. The tracker records no retrievable candidate location; main, the four known inherited worktrees and searched temporary roots do not identify that complete source. Its location was requested. Historical notes cannot stand in for current candidate bytes or acceptance.

A genuinely different lifecycle/storage architecture needs a reviewed design naming whole implementations it replaces while retaining legacy compatibility. Repeating another micro-helper extraction is not that experiment. No fixed-budget feasibility, schema activation, implementation sign-off or release follows from this investigation.
