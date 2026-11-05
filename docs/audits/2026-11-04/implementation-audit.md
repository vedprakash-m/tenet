# Implementation audit and completion plan

Date: 2026-11-04 UTC (2026-11-03 Pacific). Audited implementation:
`34d6030c61f3f02783fd9bd096ff1fd7cc39f8a8`.

## Repair continuation (2026-11-04 UTC)

### Current unresolved finding packet context

Full and recheck manifests now include active contract findings required by
Tech Spec §8.7. Fixed items remain visible until reverified; blockers remain
visible unless verified or withdrawn, even when otherwise dispositioned.
Verified/withdrawn findings and disposed nonblocking majors are omitted. This
context participates in the existing complete-manifest 20,000-token bound;
over-limit packets refuse without truncation.

The regression fails first on unchanged production, then passes for all nine
stored states, immutable contract input, manifest identity and exact/over-limit
cases. Seven exact offline Windows workflow selections pass422/185; the review
selection contains19controls/runtime.93overlapping core/verdict/artifact
controls/runtime also pass. Types, lints/fixed capacities, M0 structural
coverage, build, payload and reproducibility pass.
`integratedOpenFindingsPacketIncrement` binds412-file inventory
`7343f5cdff3d566633594f62dec9e22b6e389672180e9f557c68ba625ea4f8d4`,
786,745-byte bundle
`1723b9d8908dd67edfd6ccc5b9deecd95f89751e8a2c6fafb766affc826e00bf` and
96-file manifest
`f35d69da349669a913aeeb4876f75c4afe07e67583caddf3cbfe7f7ad9c80b3e`;
central247,156/247,219. Expected1,597whole-source passing remains unobserved;
99/83/18/zero-qualified unchanged. Whole-source and POSIX/native acceptance
are not claimed. No state transition, API or verdict change.

### Interrupted full Windows test attempt

The retained `npm test` output contains 188 failure markers (including test
and suite entries) before the attempt was stopped. A focused rerun of
`active-time.test.ts` on Win32 confirms that its mutating setup is refused with
`capability-missing` ("mutating work is unavailable on win32"); the affected
tests then fail when they assume state was created. These tests are not
Windows acceptance controls, and skipping or weakening them would hide the
kernel's intentional platform boundary. This confirms a platform mismatch for
that failure cluster, not a cause for every marker in the interrupted output.

Separately, one spawned recovery fixture terminated with
`EPERM: operation not permitted, fsync` while `FsStore.ensureMarker` called
`fsyncDir` on Windows (`packages/kernel/src/adapters/store-fs.ts:139`).
That establishes a Windows directory-fsync incompatibility in that run. The
attempt is not whole-source acceptance evidence; supported POSIX acceptance
remains unobserved for the current candidate.

### Current Windows starter and root gates

On the current worktree, the starter template's complete configured Vitest suite
passes 145 tests across 15 files. Starter typecheck and ESLint pass. Its actual
Playwright run starts the real API and freshly built UI with a dedicated
temporary database; all 12 browser tests pass, including sign-in/session/
sign-out, refusal/retry, and this-run server identity controls.

The root Node 24.22.1 typecheck, architecture/skills/quality lints, M0 coverage,
build, payload verification, and same-toolchain reproducibility also pass.
The exact Node24 Windows portability test selectors in
`.github/workflows/untrusted.yml` pass 422/422:357 tooling/pure/offline,
31 static, four cleanup, 11 recovery/lesson, and 19 review-admission controls.
These are platform-safe selections, not the whole kernel suite. The Node22
hosted workflow job was not run in this session. Local Node22.12.0 minimum-
runtime Windows selectors subsequently pass166 tests plus19 review-admission
controls. Under Node22,59 restore/migration/schema-history tests, starter
typecheck and ESLint pass. The starter's full suite initially passes144/145
before a single five-second architecture-boundary test times out; an unchanged-
source retry passes145/145. All12 actual Playwright journeys also pass with
Node22 running the API and child server. Both outcomes are retained; the retry
does not erase the initial timeout. These local Windows results do not
substitute for the hosted Node22 job or supported-POSIX whole-source run.
The rebuilt 786,745-byte kernel bundle remains SHA-256
`1723b9d8908dd67edfd6ccc5b9deecd95f89751e8a2c6fafb766affc826e00bf`, with the
96-file manifest identity recorded above. `git diff --check` passes. These are
local Windows artifact checks only; they do not establish supported-POSIX
whole-source acceptance, host qualification, or release readiness. The starter
dependency install used its unchanged lockfile; package manifests were not
modified.

### Prior latest review-chain reuse

Packet issuance now uses existing review-verdict eligibility on current facts,
not any historical completed result. Orphan/incomplete recheck chains and later
failed/stale/non-native/uncovered results cannot hide a needed packet. Valid
full/recheck/later-success reuse, Quick same-session, explicit retry and
nonsemantic sampling with fresh full types evidence are preserved. Remove the
unsupported checks-pass claim from review-only cache guidance.

A corrected-fixture regression fails first;27direct issuance cases pass.
Eighteen combined review controls/runtime, all seven offline Windows workflow
selections421/184cases and95overlapping core/verdict/artifact tests/runtime pass
on24.22.1/22.12.0. Static/artifact gates pass; central247,156/247,219, unchanged
owners/limits and core review/verdict/schema/facts construction.
`integratedReviewCacheEligibilityIncrement` binds current412-file inventory
`be4385134c6195fc31eb89c0263bc4270337ecd51b029eed1067f63538101011`,
786,588-byte bundle
`4a83fb2b572910ea1cd6c1f66d9d54758fec95e6bce4a51a60c2f007488adc9b`
and96-file manifest
`0825b2a5a670a50cf82b27a3e49c89c7f32c1e46c1da4a31ff94ec74788b6d7c`.
Expected1,596whole-source passing remains unobserved;99/83/18/zero-qualified
unchanged. Prior identities below are historical. No public POSIX/native
acceptance, schema/API/cap activation, host probe, commit/push or release.

### Prior Deep analyst settlement guidance

Completed analyst settlement now uses the existing Deep scheduler on the fresh
candidate and resulting analyses. Stale, non-native and unresolved results
retain required role actions; other lanes' completed behavior and all lanes'
noncompleted retries remain. Status, history, stale notes and native-only
accounting are unchanged. Initial review-dependency characterization had an
incorrect status assertion: production already marks open coverage partial and
requires follow-up. Corrected unchanged-source baseline1pass/1fail distinguishes
that positive control from the actual missing analyst action.

Final24analyst/nine review-dependency cases join17combined review controls;
17review and95overlapping core/verdict/artifact tests pass per Windows24/22.
Static/build/payload/reproducibility pass within central247,219/247,219; core
verdict/review/schema and scheduler source are unchanged.
`integratedAnalystNextActionIncrement` binds current412-file inventory
`f28e8445893e40802ed1aec6f858aa0e327f95e184e00db044142609ca68be14`,
786,711-byte bundle
`0da8cca8e487553827203cbfc22cda1e9d1683066efd5470b7a795e6004fb876`
and96-file manifest
`cfdfd446ab1da8a3b86734a713f26a6cd97b42d5fc57484ee23504df7c59b109`.
Expected1,595whole-source passing is unobserved;99/83/18/zero-qualified unchanged.
Prior identities below are historical. No public POSIX/native acceptance,
schema/API/cap activation, host probe, commit/push or release.

### Prior finding completion guidance

The completed-review handler omitted fixed blockers/majors from blocking data
and suggested finish before verification. It also omitted blockers in deferred,
risk-accepted and wont-fix states. The unchanged verdict already rejects those
as blocker closure. A direct handler matrix fails first; all36combinations of
four severities and nine states then pass with exact blocking IDs, correct
finish guidance, unchanged findings/input and reviewer accounting. Major
dispositions and minor/note behavior remain unchanged.

Fifteen combined review controls and95overlapping core/verdict/artifact controls
pass per Windows24.22.1/22.12.0; static/build/payload/reproducibility gates pass.
Central247,216/247,219, unchanged limit and owners. Both runtime workflow
selections include the new control; all-seven-selection execution remains
historical, not transferred to this source.

`integratedFindingCompletionGuidanceIncrement` binds current412-file inventory
`61688666e59fe5aabbc45d7001c42e3834291c17c7bcaea7b83ad0475ce8e173`,
786,738-byte bundle
`38ad5a493e001853665d8bc856a76a7fe3f9c797505810d510c3f715267b2f68`
and96-file manifest
`e0328f08f451bce6fcb42036c32b2c11d5ffef928a590888ea0cba688a3fdaab`.
Expected1,593whole-source passing is unobserved;99/83/18/zero-qualified unchanged.
Prior identities below are historical. No verdict/schema/API/cap activation,
public POSIX/lifecycle acceptance, native observation, commit/push or release.

### Prior Deep analyst next-action consistency

Deep scheduling used any historical current native success and ignored open
dependencies, while verdict checks the latest result per role. A matrix
regression fails first. Required architect/security actions now disappear only
when the latest result is current, completed, native and has no open dependencies.
Both roles, all incomplete statuses, stale/same-session/open evidence, successful
retry, unrelated researchers, non-Deep lanes and input preservation are covered.
A direct production findings-handler control also preserves reviewer accounting
and analyses while retaining or removing the required action appropriately.

Seven exact offline Windows workflow selections pass417/180cases on
24.22.1/22.12.0, including14review controls each;95overlapping core/verdict/
artifact controls pass per runtime. Static/build/payload/reproducibility gates
pass. The first quality run exposes an extra wide line and eight characters over
the central ceiling; final central247,210/247,219 after splitting the condition
and shortening redundant guidance. No limit increase or cross-owner move.

`integratedDeepPassSchedulingIncrement` binds current412-file inventory
`f3c8f133e3611e8ae74409d79ba1bfcdc27847563751cec4471a2c3516723979`,
786,701-byte bundle
`d70cad30d895718ed31da9dbce9ec5cb3d722cf2b291347f487f5ea322e83dd1`
and96-file manifest
`4937ea365930cc670379ce38a3174d78754a541b3a5e5d426f0633eb6d5d18ce`.
Prior identities below are historical; expected1,592whole-source passing remains
unobserved and99/83/18/zero-qualified unchanged. Verdict/review/schema source is
unchanged. This is not public POSIX transaction acceptance or native analyst
effectiveness. No schema/API/cap activation, host probe, commit/push or release.

### Prior named recheck result template

Recheck packets named findings but omitted the existing `rechecked` result
field from the answer template. A shape regression fails first. Only recheck
templates now include each exact named ID, both existing outcome choices and
evidence guidance; empty rechecks emit `[]`, full packets omit the field.
Both instantiated outcomes pass the production result decoder and matching
fixed-finding admission. A populated packet passes exactly20,000tokens and
refuses one extra character or another named finding, without truncation.

Twelve combined review/packet controls and87pure/core/verdict/artifact controls
pass per Windows24.22.1/22.12.0. Static/fixed-budget/build/payload/reproducibility
gates pass; core/review18,119/20,160, builder41lines/complexity9. Generated
review-result schema remains byte-identical. These are direct builder/decoder/
admission controls, not public packet issuance or native reviewer observation.

`integratedRecheckResultTemplateIncrement` binds current412-file inventory
`add79a43e61a0afb1d9a0ac21313cbd27852e835641ef0fd25dd9bfc4f6965d1`,
786,706-byte bundle
`80baceab1d2d6951418478fed88ee6cddd6d0c8b394987f4b26142420b3d4af1`
and96-file manifest
`8f7c0ec992f7aa74d12f499a8bf8f79c3607e7dfa210fbcb0832e1c8fa1e8e09`.
Expected whole-source1,590passing is unobserved;99/83/18/zero-qualified unchanged.
Prior identities below are historical. No stored assignment, lifecycle API,
schema/cap activation, supported-POSIX acceptance, host probe, commit/push or release.

### Prior reviewer attention admission

Duplicate attention entries previously used the first disposition, including
contradictory `accepted`/`finding` entries. Blank explanations also applied.
Two pure/direct-handler regressions fail first. Admission now requires known
unique IDs and nonblank reasons before any attention disposition is applied.
Unknown-ID refusal is preserved; omitted and single accepted/finding entries
retain their existing reported actor and verdict behavior.

Final matrices cover six refusal and three positive cases under both native
and same-session dispatch: rejected results retain attention/findings/reviews,
reservation and round/recheck counters, while only native dispatches count.
Ten combined attention/recheck/role admission tests pass per Windows24.22.1/
22.12.0. Exact seven offline workflow selections pass413/176cases;11artifact
contracts/runtime,51additional minimum-runtime verdict controls and six built
help/doctor/platform-refusal cases pass. These counts overlap and do not prove
supported-POSIX attention transactions, native effectiveness or full current CI.

The initial inline guard exceeds complexity27/25; grouping existing/new
attention checks in a same-owner pure helper restores24/25 without a limit
increase. Review owner17,960/20,160; static/build/payload/reproducibility gates pass.
`integratedReviewAttentionAdmissionIncrement` binds current412-file inventory
`db24ad22fe727b0baee3b5c1a3dbc07e702ea24a103646fd87cb638f0cffea40`,
786,543-byte bundle
`d524c5f77a3bfe83273f10b9428783200ad9108af4881bd514c4e1c2b71d2920`
and96-file manifest
`204aa735f46c66a982dd467e620e9544ac65c1f630b0630d4ecea183e0388783`.
Expected whole-source1,588passing remains unobserved;99/83/18/zero-qualified
triage unchanged. Earlier identities below are historical. No finding-linkage,
schema/API, cap waiver, host probe, commit/push or release.

### Prior finding recheck admission

Before application, require unique existing `fixed` finding IDs and nonblank
evidence. Unknown, non-fixed, duplicate and contradictory claims return the
existing `review-result-invalid` reason. Refusal preserves findings, reviews,
reservation and round/recheck counters while counting a reported native dispatch.
Both admitted fixed outcomes retain their existing history/link/settlement behavior.

Two corrected-fixture regressions fail before the guard; eight pure/production-
handler admission controls then pass per Windows24.22.1/22.12.0. Preserve the
initial invalid-handle fixture failure separately, not as handler defect proof.
The seven offline workflow selections pass411/174cases;11artifact contracts per
runtime and87additional overlapping pure/verdict/workflow-security controls pass.
Six rebuilt help/doctor/platform-refusal cases pass without private state.
The first built helper wrongly expected a ready scratch doctor; its correction
asserts the existing exit2/platform-not-ready response, not a product change.

The pipeline scenario no longer treats an edit as a fixed transition. Its
supported-POSIX execution remains unobserved. Current fixed-state admission
does not prove evidence truth or immutable named-assignment binding; the public
fixed/dispute/withdrawal API and severity history remain incomplete.

Static, fixed-capacity, structural coverage, build/payload/reproducibility gates
pass; core/review17,606/20,160. `integratedFindingRecheckAdmissionIncrement`
binds current412-file inventory
`4bfb2cefd9f39d74b1619bdbd5c95cbbbfa54bff424611790e1868aa65d352ea`,
786,354-byte bundle
`a2239ffa4ab59632d39ae6fe0d1447f2ed7c4cb9b11eb04626703706a4df7379`
and96-file manifest
`75fa26ec5f6e14016505ddfcbbb868972fb03e6355450750bf9425d2e289e061`.
Older identities below are historical; expected whole-source population1,586
is not observed wholly passing. Triage99/83/18/zero-qualified unchanged.
No new schema/decision mechanism, capacity waiver, host probe, commit/push or release.

### Prior unrecorded-data migration preservation

Automatic backup previously depended only on nonempty migration history.
A first migration could therefore change existing user data without a copy.
Three real-SQLite controls fail first for default/explicit destinations and
occupied-destination refusal; user-table admission now requires the existing
verified backup before migration SQL. Empty user tables are conservatively
protected too. Ledger initialization/checkpoint housekeeping can occur before
refusal; no byte-identical pre-initialization copy is claimed.

Exact-prefix follow-through exposes `LIKE 'sqlite_%'` treating `_` as a
wildcard: legal `sqliteNotes` is a user table, not internal metadata.
A migration regression fails on that name; a restore regression reaches a
safety sentinel after admission, before marker/moves. Both checks now use
literal-prefix `GLOB`. Copies preserve original rows and empty history;
strict restore still refuses them rather than inventing compatible history.

Final145starter unit/integration and59restore/migration/history controls pass
per Windows24.22.1/22.12.0. Two actual npm cases per runtime observe startup/
HTTP health with an automatic copy, then strict restore refusal preserving
the exact database/backup bytes and file set. The session preload invokes the
existing shutdown handler after health; a first self-signal attempt exited1
and was replaced by event emission, with no OS-signal claim.
The first final minimum-runtime full trial's144passes/one existing five-second
architecture timeout remain beside one unchanged-source145-pass rerun.
An intermediate144-case trial's143passes/one timeout remain historical.
No deadline, warmup relocation or assertion change.

Starter/root static and artifact gates and14artifact contracts per runtime
pass. `integratedStarterUnrecordedBackupIncrement` binds the412-file source
inventory, unchanged kernel bundle, updated96-file manifest and byte-identical
tested template. Whole1584supported acceptance remains unobserved, with
99bounded slices/83known-incomplete/18host-pending/zero-qualified unchanged.
No unrecorded-schema adoption, concurrent-writer/owner/recovery-race closure,
browser rerun, POSIX/host/release qualification, schema/cap change or publication.

### Current protocol prerequisite review

The v3 admitted-root type cannot be passed to the retained runner guard or stop
declarations. A nonshipping v4 supplement now propagates that root through
guard/request/acknowledgment/stop and explicit completion values. Extracted
declaration controls retain the original two incompatibilities, accept revised
calls and reject four cross-family calls; unrelated dependencies remain opaque.
This is not a full candidate typecheck or installed runtime repair.

Two further integration gaps remain: `check-job-*` roots are outside the current
`runFiles()` capacity/sweep enumeration, while whole-root cleanup needs association
retention pins; transaction overloads alone do not version `Store.read`,
read-only dispatch or error rendering. Exact findings and acceptance obligations
are [LP-1/LP-2/LP-3](../../../specs/protocol-prototype.md#november-4-launch-port-integration-review).
No setting was approved by the unavailable-owner response. Runtime inventory,
test populations and requirement triage below are unchanged.

### Current dangling restore-marker fencing

A real dangling directory junction exposes another unreadable-marker bypass:
the read fails, then target-following `existsSync` returns false and the decoder
reports absence. One failing-first control stops at that decoder assertion;
baseline startup/restore effects are not deliberately executed. The fallback
now uses entry-based `lstat`; an existing entry or failed inspection remains
the existing unreadable sentinel. Startup/new restore refuse; recovery reports
unreadable marker before ownership writes. No new recovery policy.

The control now preserves exact filename set/link target/database/backup bytes,
creates no owner, and permits ordinary restore after fixture removal, retaining
original records aside. Five actual separate npm cases per Windows runtime
cover startup/new restore/finish/rollback refusals and successful retry.
All 141 starter unit/integration and 55 restore/migration/history controls pass
on Windows 24.22.1/22.12.0. The first minimum-runtime full trial's 140 passes/
one existing five-second architecture timeout remain beside one unchanged-source
141-pass rerun. No deadline or assertion change.

Architecture timing investigation measured Node 24 cold ESLint discovery at
3,032 ms versus subsequent new-instance lint calls of 109/29/19 ms. No robust
performance correction established; moving warmup outside the deadline is not
claimed as a repair. Timing reliability remains unresolved.

Starter types/lints, root static/artifact/reproducibility gates and 14 artifact
contracts pass per runtime. `integratedStarterMarkerLinkIncrement` binds the
412-file inventory, unchanged 786,087-byte bundle, updated 96-file manifest,
byte-identical tested template and retained failure. All 290 closure references
verify, with triage 99/83/18 and zero qualified unchanged. Whole 1,584 supported
acceptance remains unobserved. Permission-denied inspection was not induced;
POSIX link behavior, atomic path replacement, owner/late-reader/recovery race
and release qualification remain open.

### Current restore staging preservation

New restores previously admitted unknown install-copy/database-sidecar staging
entries and marker temporary entries. The marker writer overwrote its temporary
entry; installation could overwrite its copy or delete its sidecars. Four real
filesystem regressions fail first at an after-marked safety sentinel before
database moves. The marker temporary fixture is already overwritten/renamed
there; installation overwrite/deletion is not deliberately executed. New
restores now `lstat` all four paths before the marker and refuse explicitly
for manual inspection. Unknown files are neither adopted nor cleaned.

All four controls pass with exact filename/every-file-byte preservation, no
marker/retained owner and successful unoccupied retry. Eight actual separate
npm restore cases per Windows runtime establish four refusals/four retries,
restored backup records and original records retained aside, without clock
injection. Staging contents are synthetic bytes, not live sidecars. All 140
starter unit/integration and 54 restore/migration/history controls pass on
Windows 24.22.1/22.12.0. Retain the first Node 22 full trial's 139 passes/one
existing five-second architecture timeout beside one unchanged-source
140-pass rerun. No deadline increase or universal timing-reliability claim.

Starter types/lints, root static/artifact/reproducibility gates and 14
nonmutating artifact/recipe/CI contracts pass per runtime. The tested template
matches the payload byte-for-byte; cached locked native bindings are reused
and probed with exact Node 24 restoration in finally.
`integratedStarterStagingIncrement` binds the current 412-file source inventory,
unchanged 786,087-byte bundle, updated 96-file manifest and retained failure.
Whole 1,584 supported acceptance remains unobserved; triage stays 99/83/18,
zero qualified. Install/recovery code is unchanged. Point-in-time preflight is
not external path reservation, stale-owner/late-reader/interrupted-recovery
race safety, supported POSIX or release qualification.

### Current occupied restore destination admission

New restores generated a kept-aside name without checking for an occupied
database, WAL or SHM destination. Recovery-oriented move logic skips existing
destinations, which can mistake earlier retained content for the current
originals. Three real filesystem controls reproduce marker creation and stop
at a deliberate after-marked sentinel before moves; destructive replacement
is not deliberately executed. New restores now `lstat` all three paths before
writing the marker and refuse explicitly. Recovery code is unchanged.

The controls improve from zero passes/three failures to three passes. They
require exact filename/every-file-byte preservation, no marker/retained owner,
and successful retry after removing the fixture collision, with both restored
backup and retained original records verified. Actual separate npm restore
processes provide six cases per Windows runtime: three collision refusals
and three successful unoccupied retries. A session-only clock preloader makes
the name deterministic; product clock code is unchanged. Retained sidecar
destination bytes are synthetic, not live-WAL observations.

All 136 starter unit/integration and 50 restore/migration/history controls pass
on Windows 24.22.1/22.12.0. Starter types/lints, root static/artifact/reproducibility
gates and 14 nonmutating artifact/recipe/CI contracts pass per runtime. Cached
locked native bindings are reused and probed, with the exact Node 24 binding
restored in finally. Prior timing failures remain preserved; current passing
runs do not establish universal timing reliability.

`integratedStarterAsideCollisionIncrement` binds the current 412-file source
inventory, unchanged 786,087-byte bundle, updated 96-file manifest and
byte-identical tested template. Whole 1,584 supported acceptance remains
unobserved; triage stays 99/83/18, zero qualified. This point-in-time preflight
does not reserve paths against concurrent external creation or close owner/
late-reader/interrupted-recovery races, supported POSIX or release gates.

### Current restore hard-link alias admission

Resolved names do not identify hard links. A real hard link to the live
database passes the old alias check and reaches an after-validation safety
sentinel before marker/moves. The existing refusal now additionally compares
bigint filesystem device/file identities against the database and both
sidecars, before reading the backup. No new lock protocol or policy.

The regression improves from zero passes/one failure to one pass. Its matrix
also covers synthetic sidecar-file aliases, exact filename/every-file-byte
preservation, no marker/owner and successful separate-backup retry. Only the
first database-link matrix case is independently red-first; sidecar fixtures
are not live-WAL observations. Actual separate npm restore processes provide
six cases per Windows runtime: three alias refusals and three independent
backup successes, preserving original records aside.

All 133 starter unit/integration and 47 restore/migration/history controls pass
on Windows 24.22.1/22.12.0. The first minimum-runtime full trial retained 131
passes and two existing five-second architecture/sign-in timeouts; one
unchanged-source rerun passes 133 without a deadline increase. Starter
types/lints, root static/artifact/reproducibility gates and 14 nonmutating
artifact/recipe/CI contracts pass per runtime. The tested template matches the
current payload byte-for-byte, and Node 24's native binding is restored/probed
after cached minimum-runtime binding use.

`integratedStarterHardlinkAliasIncrement` binds the current 412-file source
inventory, unchanged 786,087-byte bundle, updated 96-file manifest and retained
failure. Whole 1,584 supported acceptance remains unobserved; triage stays
99/83/18, zero qualified. This point-in-time check is not atomic against
concurrent path replacement and does not close stale-owner/late-reader/
interrupted-recovery races, supported POSIX or release gates. Earlier browser
observations remain historical.

### Current restore admission with a live WAL reader

SQLite's WAL-mode exclusive transaction permits existing readers, and a busy
`wal_checkpoint(TRUNCATE)` returns a result without throwing. The existing
restore ignored it. A real two-connection regression pins frames and proves
busy1; baseline reaches a deliberate after-validation sentinel before any
marker/move, not a destructive baseline replacement. The existing preflight
now checks the busy column and reports database-in-use before those effects.

The control improves from0pass1fail to1pass. All132starter unit/integration
cases and46restore/migration/history controls pass on Windows24.22.1/22.12.0.
Actual separate npm restore refuses while the parent reader/writer remain
open, preserves filename set/WAL/backup bytes and both snapshots, then restores
the same backup after release and retains the original records aside. Two
actual CLI cases pass per runtime. Main DB/shm bytes are not asserted unchanged:
checkpointing can partially progress. The first Node22full trial retained one
five-second architecture-test timeout with131passes; one same-source rerun
passes132. No deadline change or universal timing-reliability claim.

Starter types/lints, root static/artifact/reproducibility gates and14nonmutating
payload/recipe/CI contracts pass per runtime. The tested scratch template is
byte-identical to the current payload; the rebuilt minimum-runtime native
driver is followed by exact Node24binding restoration and SELECT1 probe.
See `integratedStarterWalReaderIncrement` for current412source identities,
unchanged786,087-byte bundle and updated96-file manifest. Whole1584supported
acceptance remains unobserved and triage99/83/18/zeroqualified is unchanged.
Prior browser observations remain historical. This point-in-time new-restore
check does not close late external-reader admission, stale-owner replacement/
release, interrupted-recovery exclusion, POSIX/native or release gates.

### Current skipped Playwright diagnostic admission

The existing passed-result error guard did not cover skipped results. Nonempty
error arrays were admitted, then discarded by skip counting; tagged/suite
assertion-only baseline proof could conceal the contradiction. The same guard
now covers passed/skipped results, including empty error objects/messages.
Absent/empty error arrays preserve clean skips. Failed/timed-out categories and
interrupted-result refusal remain unchanged; no schema/reason/invocation change.

One red-first regression now passes; 112 related controls pass per Windows
24.22.1/22.12.0. Separate synthetic 12-report/36-projection matrices expose six
baseline false reds, with zero candidate false reds. Twenty-four actual
baseline/candidate Playwright 1.64.1 reports preserve normal pass/assertion/skip/
teardown behavior; candidate 36 projections. Clean declaration/runtime skips
have empty errors, while teardown errors are failed results. No malformed
runner emission is claimed and no browser was launched. node-ts@27 stales prior
proof. All static/artifact gates, reproducibility and six rebuilt stateless/
refusal cases pass under unchanged limits (adapter 20,147/20,160).
Broader existing kernel/eval Windows workflow test selections pass locally:
403 cases on Node 24 and 166 on Node 22.12, zero failures/skips/cancellations.
These overlap focused cohorts, do not include the separate starter SQLite
steps or hosted setup, and are not supported POSIX mutation acceptance.
The 412-file source inventory, 786,087-byte bundle and 96-file manifest are
bound in the increment; 290 closure source references verify, with zero
heuristic added-line privacy matches and clean diff checks. Expected 1,584 whole-source
acceptance remains unobserved, triage 99/83/18/zero qualified unchanged.
See `integratedPlaywrightSkippedDiagnosticIncrement`. Global-unhandled Vitest
observation, unsigned launch mechanism and supported acceptance remain open.

### Current nonfailed-assertion diagnostic admission

Only passed assertions previously refused nonempty failure-message arrays.
Pending/skipped/todo/disabled diagnostics were validated then discarded;
tagged selections could pass or establish assertion-only red despite the
contradiction. The existing guard now covers every nonfailed assertion,
including an array with an empty diagnostic. Missing/empty arrays preserve
ordinary skip/population behavior. No new state, reason or mechanism.

One red-first matrix regression now passes; 111 related controls pass per
Windows 24.22.1/22.12.0. A separate 20-synthetic-malformed-report/40-projection
baseline exposes eight false reds; candidate matrices on both runtimes refuse
all20reports. These synthetic fixtures are not observed Vitest emissions.
Ten real Vitest 5 reports/twenty file-tagged projections separately preserve
passing, assertion-only, skipped, todo and mixed assertion/clean-skip outcomes.
node-ts@26 stales previous proof; unchanged owner limits (20,151/20,160).
All static/artifact gates, reproducibility and six rebuilt stateless/refusal
cases pass. Expected 1,583 whole supported acceptance remains unobserved and
requirement triage remains 99/83/18, zero qualified. All 290 closure source
references verify; heuristic added-line privacy/diff checks are clean.
See `integratedNonfailedDiagnosticIncrement`. Global-unhandled
observation and the nonshipping API-launch proposal below remain incomplete.

### Current cross-file focus refusal correction

Actual two-file Vitest5 reports let focus refusal in one file coexist with
a passing receipt or assertion-only behavioral red selected from another.
Two red-first receipt/baseline and real-process controls reproduce this.
Focus admission now considers every normalized file; otherwise eligible
test receipts refuse with focused-tests/inconclusive while selected counts
remain local. Ordinary sibling assertion failures preserve independent results.

Current110related controls pass per Windows24.22.1/22.12.0. Twelve actual
baseline/candidate reports produce24file/tagged projections, distinguishing
false pass/false red from corrected refusal and preserving ordinary behavior.
Six rebuilt stateless/refusal CLI cases and static/artifact gates pass.
The synthetic subsequent-pass settlement check is not a real rerun.
node-ts@25 stales prior evidence; no schema/reason/cap/mechanism change.
Expected1582whole-source acceptance remains unobserved; triage99bounded/
83incomplete/18host/zeroqualified remains unchanged.
See integratedCrossFileFocusIncrement. The global-unhandled mechanism below
is still nonshipping; shipping mixed-error false red is not resolved.

### Global-error observation mechanism: nonshipping feasibility, not closure

A completion-reporter prototype observes actual Vitest5 global errors missing
from built-in JSON. Twelve reporter-only reports across Node24/22 retain mixed,
rejection-only and uncaught-exception errors, but two imported-filter controls
still establish false red. A separate public-API launcher with an inline
always-preserve callback supplies12more actual reports and preserves that
imported fixture's error. Whole-file/tagged projections refuse emitted global
errors while preserving ordinary assertion-only red and passing tests.

These are24real reports/48projections, not integrated kernel acceptance.
The session prototype's absolute imports, inherited reporter internals and
intermediate publication are not an approved portable design. Its reused-receipt
settlement check is not a real rerun. [The reviewed draft](../../../specs/vitest-global-error-observation.md)
records required production tests and explicit blockers: loading/payload/
envelope topology, complete callback precedence, no automatic installation,
all admitted runner majors, crash/publication bounds and measured same-owner fit.
Only ten characters remain in the current adapter owner. No cap/matcher change
or implementation sign-off is inferred. Runtime remains adapter24 and the
shipping mixed-error gap remains open; requirement assessment is unchanged.

### Current unhandled-error suppression correction and remaining global-error gap

Real Vitest dangerouslyIgnoreUnhandledErrors:true suppressed an unhandled
rejection and produced exit0/passing suite evidence. The new red-first
regression now forces the setting false in argv: unhandled-only execution is
nonzero/inconclusive while clean execution remains passing. Explicit
onUnhandledError filter tokens in twelve inspected config forms refuse
without evaluating code; quoted/shorthand forms are covered. Comments/strings
can conservatively refuse; imported/computed graphs remain unqualified.

Current141related controls pass per Windows24.22.1/22.12.0. Ten actual reports
and two prelaunch refusals include **two unresolved mixed-error cases**:
assertion+global-unhandled errors yield assertion-only JSON/exit1 and still
incorrectly establish behavioral red. These are known-incomplete
characterizations, not passing acceptance cases. Complete attributable
global-error observation must be wired through execution/normalization/receipts.
TDD-02 is reclassified known-incomplete; current triage is99bounded slices,
83known-incomplete and18host-pending, zero qualified.

node-ts@24 stales earlier evidence; owner20,150/20,160after behavior-preserving
reuse/deduplication with explicit option/version controls. Static/artifact gates
and six rebuilt stateless/refusal CLI cases pass. Expected whole1580source
acceptance remains unobserved. See `integratedVitestUnhandledSuppressionIncrement`.
Supported POSIX/full dispatch, all runner majors, coupled protocol/recovery and
native/manual/release gates remain open. No commit/push.

### Prior Vitest suite-hook failure correction

A real failing assertion plus afterAll TypeError produced a failed file with a
suite-level error message, but normalization discarded that message whenever
any assertion failed. The resulting assertion-only receipt could establish
expected-red proof despite failed cleanup. Red-first real-process regression
now preserves the existing compile-or-import file-error kind beside assertions.
Hook-only and assertion-only controls retain their outcomes; tagged selection
and capped diagnostic examples cannot hide the suite error.

Current138related controls pass per Windows24.22.1/22.12.0. Six actual installed
Vitest5 reports exercise mixed, hook-only and assertion-only cases, each through
whole-file/tagged receipts and baseline matching (twelve projections, not twelve
reports). Six rebuilt stateless/refusal CLI cases preserve empty project roots.
node-ts@23 invalidates earlier evidence through existing admission. Node owner
20,151/20,160; no schema/reason/cap increase. Types/lints/M0/build/payload/repro
pass; exact evidence is `integratedVitestSuiteFailureIncrement`.

Whole1577source acceptance remains unobserved. This does not qualify unhandled
asynchronous errors outside file messages, other supported runner majors,
public POSIX check dispatch or native/manual/release behavior. Earlier
adapter22/starter evidence is historical. Protocol/recovery and approval gates
remain open.

### Prior runner focus-refusal correction

Actual Vitest allowOnly:true configuration overrides CI=1: a passing .only test
hid a failing sibling and produced a passing whole-suite receipt. The new
real-process regression fails first on that false pass. Playwright's permissive
forbidOnly:false configuration also admits the same false pass. Kernel-owned
commands now force --allowOnly=false / --forbid-only respectively, overriding
project settings rather than trusting CI defaults. Full and selected Vitest
commands preserve ordinary passing/assertion-failing outcomes. Focus refusal
uses existing focused-tests (Vitest) or global report-invalid (Playwright).

Current136related controls pass per Windows24.22.1/22.12.0. Sixteen actual
installed Vitest5/Playwright1 reports distinguish four deliberate unguarded
false-pass controls, four guarded refusals, four ordinary passes and four
assertion failures. Six rebuilt stateless/Windows-refusal CLI controls preserve
empty project directories. See `integratedRunnerFocusIncrement` for exact
identities and limits; no browser/network/native-host or public POSIX check
qualification is inferred.

node-ts@22 invalidates prior evidence through existing admission. Inline the
single-use detection language expression and return argv directly; final
20,149/20,160characters under unchanged caps, after rejecting20,163/20,160.
Types/lints/M0/build/payload/repro pass. Current whole1575source acceptance
remains unobserved; prior adapter21/starter evidence is historical. Protocol,
recovery, capacity and qualification/release decisions remain open.

### Prior Vitest normalization and baseline correction

Formatted assertion prefixes reproduced a legitimate-red refusal: Vitest
classification saw runtime-error where Playwright already removes terminal
controls before checking the prefix. The new regression exercises normalization,
receipt failure kinds and matchBaseline;0pass1fail becomes1pass. Classification
now uses the same Node utility, while persisted/displayed diagnostic bytes
remain original. Runtime prefixes and assertion-looking stack frames still
cannot establish a behavioral red.

Adapter node-ts@21 intentionally invalidates prior normalization evidence through
existing version admission, not receipt rewriting. Same-owner simplification
reuses one metadata wrapper per fingerprint, inlines its returned version and
the direct Vitest path. All reads/exclusions/argv remain;20,155/20,160 characters,
all other owners within unchanged caps. Current121related controls pass per
Windows runtime24.22.1/22.12.0. Six actual installed-Vitest5 report cases and six
rebuilt stateless/refusal CLI controls pass with exact evidence in
`integratedVitestFormattingIncrement`. These are not qualification of every
supported runner or public POSIX check mutation.

Types, all lints, M0 structural coverage, build/payload/repro pass. Current
whole-source1574 acceptance remains unobserved. The launch-setting decision
prompt returned owner unavailable; acknowledgment source, protocol/cap/schema,
recovery ownership and external qualification/release gates remain open.

### Prior owner-record admission and acceptance (131-case starter checkpoint)

Malformed owner JSON was treated as a dead holder and replaced. Read failures
also fell through to stale-owner removal; a directory entry refused only through
raw EISDIR. Exact positive safe-integer PID/string-start admission now refuses
and preserves unreadable/invalid entries. Only ESRCH proves PID absence;
unexpected signal errors propagate, and unavailable recorded/current start
evidence cannot prove replacement of a live PID. This changes neither the
read/unlink/create stale-owner race nor the unconditional release race.

Two real filesystem controls baseline0pass2fail now pass. Final controls
compare actual complete pre-call file sets/bytes, including any SQLite
sidecars, across malformed records and unsupported PID errors, preserve the
backup/live data and require no restore marker. Existing live/dead-holder
checks remain. Intermediate sidecar-assumption/expensive-Buffer-assertion
fixture failures are retained; exact encoded-byte snapshots keep the same
deadline and preservation checks.

Current default131unit/integration cases and12real browser journeys pass on
each Windows24.22.1/22.12.0. First minimum-runtime trial129pass2timingfail in
existing boundary/sign-in checks remains recorded, not waived by a rerun.
Starter/workspace static and artifact gates and23artifact/recipe controls per
runtime pass. Sixteen actual npm start/restore refusals verify exit1, exact
file/byte/credential preservation and no restore marker across four owner-error
shapes on each runtime. Node22 refusal precedes native database opening; its
successful unit/browser runs separately used its rebuilt driver.
`integratedStarterOwnerAdmissionIncrement` records current exact identities:
412scope0abaf6a1/96manifest ce33c7cb, unchanged bundle.
Full supported POSIX kernel/built acceptance, stale-owner/process
races, native/manual/protocol/recovery/release gates remain open; no publication.

### Prior browser startup acceptance (129-case checkpoint)

Actual browser startup reproduced two defects: an unquoted Node path under
Program Files, then owner-file creation before the database directory existed.
The quoted command and directory-before-exclusive-owner correction have
red-first controls. Ownership still precedes database opening; stale-owner
reclaim races are not repaired by creating a directory.

Final current default129unit/integration cases plus12real browser/API journeys
pass on Windows Node24.22.1 and22.12.0, zero skips/flaky. Two independent OpenAPI
exports now run concurrently after another minimum-runtime timeout; nonzero
child exit rejects, repeatability/untouched-ambient-file assertions and deadline
remain. ESLint excludes generated browser output and explicitly keeps application
source included. Final documentation-bound scope37790c79/manifest fd78cace, bundle unchanged;
exact `integratedStarterBrowserIncrement` supersedes earlier local snapshots.

Windows browser teardown leaves generated output and a stale owner file.
No clean-teardown/all-process-gone claim follows from passing journeys. Full
POSIX kernel/built acceptance and protocol/recovery/qualification gates remain
open. Earlier startup/timing failures are retained; nothing committed or pushed.

### Latest fixture portability and bounded whole-template run

Migration test fixtures leaked SQLite connections into directory cleanup:
existing baseline3pass4fail, corrected7pass. Schema-history crash checks now
require reached-step output, no spawn/timeout error and abnormal termination on
Windows, while retaining exact SIGKILL on POSIX. Production behavior/deadlines
are unchanged. Both42-case Windows CI selections pass.

The starter's existing Vitest config now sets maxWorkers2, following the workspace
test-concurrency limit. A failing-first config control now passes. Actual default
`npm test` passes128/128on Node24.22.1 and22.12.0 without a worker override and
with no competing build. This does not erase the unbounded-default126pass2fail trial
(OpenAPI timeout plus the corrected signal assertion), or first minimum-runtime
bounded125pass3fail timing trial during an independent build. Universal timing
reliability and supported POSIX acceptance remain open. Latest scope6f30c12d,
manifest d577e5df; bundle unchanged. Full outcomes and identities are in
`integratedStarterPortabilityIncrement`; earlier snapshots below are historical.

The unapplied launch-contract v2 packet now exposes durable association,
completion-error ownership and paired transaction surfaces. Parent review found
the union-generic Job excerpt did not enforce Tx/state family pairing. Unapplied
v3 now uses a distributive discriminated union; its isolated actual-candidate-type
compile proof rejects8mixed/nonnarrowed/wrong-publication cases and reproduces
the old generic bug. Parent read the review/proof. No runtime implementation
follows from this review. Acknowledgment-setting semantics still need owner approval.

### Current marker admission and minimum-runtime increment

The focused Windows CI job now executes all29restore controls on Node24 and
22.12.0 from runner scratch, with locked SQLite rebuilt for each runtime.
The workflow contract fails before wiring; all11checks pass afterward on both
runtimes. Both exact PowerShell steps run locally with29/29and verified runtime
identity. Hosted execution remains unobserved; supported POSIX/full acceptance
is still open. `integratedStarterCrashIncrement` records current source identities;
the scope digest in the earlier crash-prefix snapshot below is historical.

Latest crash-prefix follow-through: actual child termination after each of three
completed database/fixture-sidecar renames, synchronous reached-boundary proof
and byte-preserving retry. These three controls baseline0pass3fail; final29restore
controls and npmCLI pass on Windows24.22.1/22.12.0. No live-WAL/POSIX/full-durability
claim. Final128template cases remain expected; manifestd4bad22e/scope939c50d9 and
`integratedStarterCrashIncrement` supersede the26-control identities below.

Strict typed restore-marker parsing replaces arbitrary JSON casting. A marker
containing `null`, `false`, zero, an empty string, array or invalid fields remains
pending/unreadable, fences startup and new restores, and refuses recovery before
owner writes. The ten-value real-SQLite control baseline fails; all26restore
controls and actual npm CLI restoration/refusal pass on Windows Node24.22.1 and
22.12.0. The first minimum-runtime attempt fails native ABI loading, not behavior;
the existing locked scratch driver was rebuilt for Node22, then the original
Node24 binary restored. No Node download or host provisioning. Independent
decoder review found no significant issue.

Workspace static/artifact gates,29Node24 artifact controls and20Node22 artifact
controls pass. Final125template/full1573source populations remain expected, not
observed wholly passing. POSIX/whole starter/native qualification remains open.
Manifest91a4ff4f/scopef663b8c5 identify the latest candidate; bundle is unchanged.
See `integratedStarterMarkerIncrement` in the repair evidence. Prior markerless
and25-control identities below are historical.

The protocol lane separately advances to22partial/7missing/0closed: issued-check
binding141pass1capture-dependent skip, with supplied execution observations,
not actual runner/store qualification. Complete retained patchdbefd950,
report52264d5a and matrix7f4094b9 remain nonshipping; four original owners still
exceed caps. Typed launch-port proposal independently reviewed; four contract
clarifications dispositioned in revised unapplied patch2088402b,
interface89d2933f and packet7e307613. Durable association, finite acknowledgment,
completion rejection and versioned transaction contract remain blockers.
Contract review is not implementation sign-off or runtime acceptance.

### Current starter safety increment: rollback to original database absence

Recipe0.4.6 now records original presence in new restore markers. A rollback to
recorded absence keeps installed or changed database/log bytes at the marker's
existing kept-aside paths, reporting their location. It preflights collisions
before moving files and leaves the marker on refusal. Partial suffix progress
can resume. Ambiguous legacy absence and unreadable markers refuse; legacy
originals-aside rollback still works. Retained files require operator inspection
and manual cleanup. No new kernel schema, policy vocabulary or cap.

Actual SQLite/direct-Node killed-child controls reproduce the bug: initial
four2pass2fail; expanded nine2pass7fail. The first tsx-loader attempt returned no
result and a duplicated test-nesting attempt was superseded, not counted.
Final25restore controls pass, including ten new cases. A real
`npm run restore -- --rollback` invocation after a killed restore preserves
operator-modified bytes and restores absence. Starter types/lint and workspace
static/artifact gates pass. Independent final review found no significant issue.

The whole123template trial was117pass6fail, not green: four existing migration
cleanup EPERM cases, an OpenAPI timeout and a schema-history SIGKILL assertion.
The unchanged-restore baseline also failed those six, the seven new regressions
and two unrelated architecture/logging controls. Do not infer universal causes
from that comparison. Final124template cases (after one extra legacy control)
and1573source tests are expected, not observed passing. The scaffold fixture's
receipt/version expectations were updated but await POSIX.

Manifest16fc4921/scopefc39fc55 identify this increment; bundle d2650874 is
unchanged. See `repair-validation.json` `integratedStarterAbsenceIncrement`.
The original-present restore path, stale-owner race and uncooperative filesystem
race matrix are not newly qualified. Supported POSIX/Node22, whole G0/QLT07 and
native/release acceptance remain open. All earlier candidate identities below
are historical; no commit/push or release occurred.

### Current G0 safety increment: conservative dependency recovery and lesson retirement

The interrupted resolve reconciler now performs no project writes/deletes. It
compares the real manifest and manager-specific lock hashes with original intent
hashes. Unchanged originals settle as not completed, without claiming rollback;
changed, unreadable or missing-before postconditions remain uncertain. Journal
result failures are not swallowed by the read-error catch. No blob restoration
occurs, so no missing blob can become empty project content in this reconciler.
Seven direct production-reconciler controls distinguish baseline0pass7fail from
candidate7pass using real file reads and explicit mutation-attempt counters.
They are not crashed/live-resolver process evidence. The previous unsafe
pipeline test now requires repeated `effect-uncertain`, preserved bytes and an
unsettled intent; that public-path regression still needs supported POSIX.

Lesson retirement now validates IDs and applies explicit retirements before
duplicate detection, keeping no-op retries unchanged and allocating a new ID
when the matching record itself is explicitly retired. Four actual controls
distinguish baseline1pass3fail from candidate4pass, including active packet-input
selection and input immutability. Anchor reconciliation/offer lifecycle remain
unimplemented.

Independent preimplementation and implementation reviews have no outstanding
findings in these bounded corrections. Actual11safety and separate57related
controls, final types/all3lints/M0structuralcoverage/build/payload/repro pass.
Central247219/247219, recovery file265/265; no ceiling changed.
Bundle785891/d2650874,96manifest9d381c7b,412scopeb4c696f9 identify this candidate.
Windows CI explicitly selects the11platform-safe controls. The wiring assertion
fails before the step; all11workflow checks and the exact11-control selector
pass afterward on Windows. The workflow identity is recorded separately in the
G0 evidence; this is not a hosted run or POSIX mutation qualification.
All286worklist path/hash references match actual files; added-line heuristic
privacy scan reports zero findings. Publication request returned owner
unavailable, not approval; no commit/push performed.
Expected full1573 is not observed; current full supported CI and built mutation
UAT remain pending. Normal resolver failure/decline restoration still has
preimage and concurrency gaps, install recovery remains partial, and wholeF1/G0
is not closed. Historical1551Linux acceptance has no returned bound result.
Earlier continuation sections and identities below are historical.

### Current completion schedule and additional isolated lesson counterexample

The owner's same-day go-live request is addressed by the
[detailed completion plan](go-live-completion-plan.md): today's validation,
decision and safety timeboxes; G0-G7 full remaining work; exact pass/fail gates;
explicit no-go conditions and immutable elapsed qualification requirements.
It is a planning document, not a new scope cut or release authorization.

Four direct controls of production `addLesson` establish one pass/three failures:
a repeated active statement ignores requested contradictory retirement, accepts
an unknown retirement ID, and ignores explicit replacement of the matching ID.
The early duplicate return precedes retirement validation/application. The test
source and actual red log are preserved in session artifacts; their new block
is not integrated into shipping tests, and production lessons are unchanged.
No whole-pipeline effect, patch acceptance or complete LRN-02 closure is claimed.

### Latest integrated increment: catalog-setting diagnostics

The actual config decision now suggests a nearest valid catalog key for unknown
targets, reusing the policy parser's pure helper. Strict rejection, reason
`restriction-key-unknown`, explicit exit2, and state bytes are preserved. Five
corrected controls distinguish historical source (19pass/5fail specifically for
missing suggestions) from current source (24pass). The original assertion used a
nonexistent error property; its fixture-error baseline is superseded, not
behavioral evidence.

The actual combined configuration/policy/prerequisite/recipe cohort passes57/57,
with zero failure, cancellation or skip. Typecheck, all three lints, M0 structural
coverage, build, complete payload integrity and reproducibility pass under
unchanged budgets. A narrow independent review found no significant issues.
The expected full population is1,562, not an observed result; supported full CI
and built mutation UAT remain pending. Personal-preference parsing and mixed
configuration revision behavior remain incomplete, so CFG-11 is not closed.
Prior1,551/1,557artifact evidence cannot qualify this increment. Source-triage
counts remain100bounded/82known-incomplete/18host-pending, zero qualified.
The earlier increment's identities and52-test result below are historical.

### Latest integrated increment: nested diagnostics and Guided handover

Two independently reviewed repairs are now in the working implementation, not just
session candidates. Policy diagnostics name nearest valid nested keys while
preserving strict rejection, first-issue priority and the existing top-level key
field. Guided reports reference only the build skill's handover subsection:
native-consented host-terminal launch, URL response before success, honest launch
failure, credential location without values, stop instructions and a domain task.
Demonstrations are not test evidence; verification data stays separate.

The actual integrated policy/configuration/prerequisite/recipe cohort passes
52/52 with zero failure, cancellation or skip. Typecheck, all three lints, M0
structural coverage, build, complete payload integrity and reproducibility pass
without changing budgets. Full supported acceptance and native behavior remain
unconfirmed; the new expected full population is 1,557, not an observed result.

The former 1,551 candidate is preserved losslessly as all 412 raw files:
gzip 1,397,278 bytes, SHA-256
`4a21911f9d6b23fafd71ad746a2d3a448ecb78dcce416f8e1248dc38be5ccc18`.
Its outstanding validation remains bound to that historical artifact and cannot
qualify this increment. A source freeze is artifact-scoped, not a reason to block
independent implementation in another worktree. Latest source-triage counts are
100 bounded slices / 82 known-incomplete / 18 host-pending; none is qualified.
Earlier counts and candidate-only statuses below are historical.

**Current exact acceptance and green checkpoint repair:** frozen budget/stop CI
passes 1,519/1,519 tests across 233 suites, zero fail/cancel/skip
(log `31767359...`). Its lossless 35-file patch replays every raw identity.
All eight sequential dual-runtime built UAT/smokes completed before
subsequent source changes. The green checkpoint correction is now integrated:
thirteen supported baseline failures, all fifteen corrected controls,
119/119 local combined controls and both runtime public CLI refusal/green
positive smokes pass. It shares full nonflaky successful receipt coverage
with check finalization in the existing capped verdict module and reuses
its fresh selector. Refusals prepare no intent; green checkpoints do not
require final review. Local artifact gates pass with verdict
13,374/17,280 and central 247,213/247,219 under unchanged limits.
The broader supported cohort retained one failure (245/246): an older
workflow intentionally committed a baseline-red test. Its corrected setup
now checks a green implementation first while retaining genuine later live
changes, the original both-file review manifest, checked-local and two-commit
assertions. The exact same supported cohort now passes 246/246 across 32
suites (log `4fea6d7f...`). Frozen CI now passes 1,534/1,534 across 234 suites,
zero fail/cancel/skip (log `5f342036...`, 703,468 ms). Five sequential built
UAT/smokes per runtime have all completed with exit 0; the exact checkpoint
is persisted before subsequent repairs. The complete 39-file patch is 124,112 bytes,
SHA-256 `a9512e514e00c0bca6e238ad6eed50771f33928b9aca6b62cefc25d529538a16`,
with all raw source/test identities matching the supported scratch.

**Version, recipe and privacy assessment:** contracts pin Tenet/schema/adapter
but not recipe; project scaffold metadata does record recipe id/version.
Recipe upgrades explicitly refuse; the cut's formerly missing manual migration
procedure is now integrated in the starter skill. Neither a project-level version nor
plugin-update instructions complete contract recipe pinning or upgrade preview.
The redaction/version pure cohort passes 15/15. Separate synthetic receipt
controls reproduce recognized secret-shaped assertion/static diagnostic names,
analyzed paths and invalid-report explanations entering receipts. The correction
refuses sensitive identifiers before copying them, rather than
redacting identity and risking evidence collisions; it redacts diagnostic text.
Baseline: two pass/five fail; candidate: seven pass, combined receipt/verdict
cohort 101/101 and extended static/Playwright/redaction 49/49 (overlapping seven
new controls), virtual project typecheck clean. Exact source and tests are
integrated after the completed checkpoint. Supported privacy controls pass
200/200 and both runtime public CLI checks confirm no synthetic secret persists
in public/state/backup/journal/marker records. Private raw reports retain it:
full incident handling, historical cleanup and complete SEC-11 qualification
remain open. A second repair
implements the preauthorized manual recipe-migration narrower claim in the
starter skill: one missing-guidance regression fails before and passes after;
actual virtual payload lint passes closure and aggregate budgets. It does not
add automatic upgrades, change recipe metadata or close recipe contract binding.
The parent 102-test focused cohort and all applicable gates pass, with exact
bundle/96-file manifest agreement with the supported validator. Whole acceptance
is held for the bounded F2 candidate below, not inherited from the earlier
1,534-test artifact.

**F2 smaller conservative refusal integrated:** the agreed acceptance permits
refusing an unavailable hidden tracked input instead of reconstructing deletion.
Replacing the null-content fall-through with explicit exit-2 `stale`, naming
the path and retaining the successful branch, measures exactly 37,843/37,843
characters in the original Git owner (previously 37,801). No ceiling, matcher,
reason vocabulary or ownership group changes. Six real-Git controls reproduce
four pass/two fail before and six pass after for both assume-unchanged and
skip-worktree; modifications, caller exclusions, index bytes/flags and
restore-to-original identity are preserved. Quality and virtual project types
pass. Both real check/review/finish controls fail before and pass after;
the corrected supported cohort passes 134/134. Both runtime public CLI checks
refuse finish and commit after either hidden flag's file disappears, preserve
HEAD/index/flags and accept the restored checked tree. Synthetic reviews are
not native dispatch evidence. The exact correction is now integrated.
The initial isolated
guard lacked the explicit nonzero override and correctly failed two assertions;
it was never integrated. An accidentally nested suite registered both workflow
variants twice; hoisting preserves all assertions and runs each variant once.
The original ten-test evidence is retained, separate from the corrected eight.
Broad 1,542 and 1,550 CI were never started; a final handover instruction adds
one control, making the frozen expected population 1,551.

**Final bounded acceptance authorized:** parent six real-Git and 113 pure/content
controls pass, with all artifact gates. Bundle 785,466 bytes
(`c985f854...`) and 96-file manifest (`be69a27b...`) match the supported validator.
The 412-file source/test/tooling/payload identity inventory is frozen at
`f0696d6e...`; whole CI is authorized only after exact scope agreement, followed
by fourteen sequential dual-runtime built UAT/smokes. No result is claimed yet.

**Binding/runtime assessment:** four further requirements were checked through
the actual payload inventory, build entry/wiring, capability schema/adapter,
host descriptor and doctor/control consumers. Four capability/doctor/host-name
negative controls pass. The kernel bundles its dependencies for project Node;
the complete 96-file payload contains skills/thin binding files and no MCP
server/configuration. Static declarations and historical observed metadata
do not establish current native isolation, portability, installation or
qualification. **Current totals: 63 bounded assessed slices, 66 known-incomplete,
16 host pending, 55 unassessed; zero qualified.**

**Prototype/promotion assessment:** actual prototype admission refuses declared
High sensitive-data and personal-data traits before repository I/O, explicitly
disclosing that it does not inspect data. Promotion cannot lower its lane below
Standard; the reported-fresh-review verdict rule and instructions require
preservation/missing-safeguard checks. Managed hardening inventory includes
synthetic/public data limits and protects external prose/edited blocks. The
starter lists concrete local-only/backup/logging/deployment gaps. Eight grouped
pure, source-wiring, pre-I/O refusal, headline and content controls pass.
Existing full prototype/promotion and kill tests were read, not rerun as
Windows mutation evidence. Native review isolation, complete shortcut discovery,
data compliance and concurrent-edit recovery preservation are not established.
**Updated totals: 66 bounded assessed slices, 66 known-incomplete, 16 host pending,
52 unassessed; zero qualified.**

**Declared output/external CI assessment:** check admission reads a full
inventory before allowing omission of declared untracked data outputs. Tracked,
preexisting, code/config, input and in-scope matches refuse; declarations bind
evidence identity, and unexpected input movement is inconclusive. The existing
pure grammar/property cohort passes 25/25, including 3,000 generated cases;
nine grouped helper/admission-wiring/registry controls pass. Full real-run
fixtures were read and belong to frozen acceptance, not a new Windows run.
`ci-external` is reserved schema vocabulary, not an available CI-import or
protected-evidence verification route; the import cut remains incomplete.
**Latest totals: 67 bounded assessed slices, 67 known-incomplete, 16 host pending,
50 unassessed; zero qualified.**

**Stewardship, publication and refusal assessment:** monthly dependency schedules,
critical-response targets, no-source-disclosure/ownership terms and separate
source/history/package publication reviews have bounded configuration/content
evidence. Two maintenance tests, one publication-checklist test and four content
controls pass; none establishes actual steward response, legal clearance or a
completed release review. The contribution RFC/certification process is explicitly
unwritten and outside contributions remain refused. A genuine invalid temporary path refused by the store initially reached the
real pipeline renderer as exit 0 with `run-dir-unavailable` and no next action,
using an injected stateless caller. A follow-up failing-first regression
reproduced the issue; the reason registry and Appendix C now assign exit 2.
This confirms and corrects the success-shaped refusal, not a public check
bypass or execution. Public CLI check behavior, disk-full handling and
supported-POSIX acceptance remain unverified.
**Earlier assessment snapshot: 70 bounded assessed slices, 69 known-incomplete,
16 host pending, 45 unassessed; zero qualified.**

**Handover/scope/failure/feedback assessment:** QLT-08 lacked an explicit build
instruction for README run instructions, decision records, architecture and
CHANGELOG. Its new content control fails before and passes after the minimal
instruction, requiring verified outcomes, preserved history and disclosure.
This is prompt-level, not an automatic documentation mechanism. Existing
out-of-scope advisory guidance/control passes. The actual registered verbs and
shipped Markdown provide no feedback export route; OSS-06 remains missing.
The existing F1 recovery counterexample also leaves NFR-04 preservation
incomplete; this is not a new experiment or a corrected recovery claim.
**Earlier assessment snapshot: 72 bounded assessed slices, 71 known-incomplete,
16 host pending, 41 unassessed; zero qualified.**

### Remaining requirement source triage

Every one of the 200 requirements now has a bounded source-level assessment in
`implementation-closure.json`: **99 bounded implementation slices, 83
known-incomplete, 18 pending host observations, zero unassessed rows and zero
qualified requirements**. This completes the row inventory, not semantic
acceptance or an entire-codebase correctness proof. Each acceptance obligation
and independent disposition remains open; no implementation percentage follows
from these counts.

AGT-02 and REV-01 account for the two additional host-pending rows. The descriptor
records a historical observed dispatch but explicitly excludes context isolation.
It is not a new experiment or current-tuple fresh-context qualification. The
formal coverage mapping is unchanged: 16 host-only Musts, not 18.

The final source pass identifies these additional incomplete surfaces. These are
source findings, not new runtime counterexamples:

| Requirement | Implemented part | Exact remaining gap |
|---|---|---|
| RES-08 | Guided offer/consent/URL procedure now integrated; earlier absence finding repaired | Native launch, permission, response, data-isolation and stop journey remain unobserved |
| GIT-01 | Git admission, explicit init and snapshot prototype | The no-Git question omits the read-only alternative; working-tree review itself requires Git |
| GIT-10 | Starting snapshot and overlapping-dirty dispositions | No separate user checkpoint choice or complete three-choice starting-dirty workflow; editing in place is not leaving a file untouched |
| GIT-12 | Commit hook/filter inspection, consent and postconditions | Signing, integration-hook and checkout-hook execution paths are unavailable, conservatively refused rather than bypassed |
| CON-01 | Exact intent/policy preview and remembered decline | Not the full architecture, decision-record and single loaded-charter adoption set of PRD §3.2 |
| CON-08 | Journal reduction, external-run cap and protected-full refusal | Not all four ordered retention/compaction classes of PRD §5.15 |
| CON-10 | Distinct forget/cleanup/abandon/undo previews | Config reset applies directly; reset/delete-records/uninstall consequence flows are not all implemented |
| SEC-04, SEC-15 | Bound check envelopes and unknown-exposure consent | Dependency resolution and npm metadata jobs have no equivalent declared envelope and pre-execution unknown-exposure question |
| ENG-06 | Local call/effect/accounting journals | No validated pinned OpenTelemetry GenAI trace projection or mapped control |

CON-03 and CON-12 additionally retain the already reproduced F1 recovery and
general effect-accounting gaps; the F2 correction does not repair them. The worklist
keeps per-row source references and limits for the other 27 newly assessed slices.
No shipping source, test or payload changed during this source pass.

**Unreproduced restore counterexample candidate:** existing migration/backup and
kill-at-each-step restore controls exercise a database that originally exists.
`restore.ts` does not record an absence preimage. After restoring to an initially
absent database and interruption after copy, its rollback branch can leave the
restored file while returning “the original database is back.” This is inferred
from source, not a passing or failing experiment. Validate the exact shipped
implementation on the supported runtime after the frozen checkpoint, preserving
the current evidence. Do not infer absent-database rollback coverage from
existing-database tests.

**Budget boundary repair implemented (local candidate):** move existing
warning/handoff handling to shared final publication, after time accrual,
instead of duplicating it in each result handler. The first six controls
reproduce four failures; all ten final controls and the combined
132-test budget/evidence cohort now pass. Actual Reviewer/Analyst handlers,
live reservations, stale disclosures, stop handoffs, provisional results,
cached responses and unrelated contracts are covered. Types, all lints
and build/payload/reproducibility pass with central source at
247,189/247,219. A ninth failing-first control caught a milestone resetting
active time before the warning decision; the final correction evaluates
accrued pre-reset usage and still publishes the normal reset budget.
A tenth control caught stop returning a pre-stop handoff while final
publication stored the current one. The producer now creates both from
the resulting contract; pause, cancel and confirmed abandonment preserve
response/stored equality. New bundle SHA
`f80b77d38ee541035068264e680472243c25e8d820e9eeb3df226f4043612081`
is not the artifact in the completed 1,509-test basis checkpoint. That
checkpoint now has all tests and all six generic/plan/basis dual-runtime
UAT runs passing. The exact next candidate is transferred in four
hash-verified chunks. Supported controls pass 217/217 across 35 suites;
actual CLI budget/stale/pause/cache smokes pass on both runtimes, using
explicitly synthetic result records rather than native agents. Frozen
1,519-test CI is active; sequential built UAT follows. Prior eight/nine-control
transfers are superseded.

The protocol's full integrated review found six defects, including
unsupported-check proof eligibility, stale D6 publication, masked D2
changes, unrelated confirmation invalidation and settlement beyond the
durable allocation prefix. Those five now have isolated failing-first
corrections: five controls fail before repair, and the corrected
candidate/config/ledger cohort passes 95/95. Replacement patch
`3c032fad32a4dfe7ffdd47f6fc28e387f1b4308b38c0a74d0ec88767d18bfded`
remains nonshipping: all four owner caps fail, bundle/POSIX are unmeasured
and the matrix remains 21 partial/eight missing/zero closed.
Missing live dispatch/publication and the six policies remain incomplete.
Fresh integrated review verifies corrected patch/baseline/matrix
identities and reports no additional actionable findings or row
corrections. That review is not full-protocol acceptance.

**CI/evaluation assessment:** four further requirements were traced through
the actual package scripts, workflow, recipe obligation mapping, skill linter
and evaluation entry points. Thirteen existing workflow/recipe controls pass,
including missing-step/changed-script and action-pinning negative controls;
all five skills pass structural/context-budget lint. Current untrusted CI
has pinned actions, read-only credentials and locked installs. This is not
network containment, observed fork isolation or a protected/native campaign.
Offline protocol/replay/report tools do not complete ENG-04's full evaluation
and release gates. **Earlier CI/evaluation checkpoint: 59 bounded assessed slices,
63 known-incomplete, 16 host pending, 62 unassessed; zero qualified.**

**Checkpoint commit admission assessment (earlier checkpoint):** five further Git requirements
were traced through the actual commit/finish/check finalization, attribution
and dispatch paths plus coordinator instructions. `startCommit` checks
current candidate/touched hashes but not successful receipts; check
finalization writes those fields even on failure. Direct planning with
real scratch Git and schema-valid work/current failed receipt prepares a
commit job and intent, as do missing receipts; the green control also
prepares. No job was executed and HEAD stayed unchanged. Windows process
identity is explicitly synthetic, so a supported public-CLI reproduction
is queued after the frozen checkpoint, not claimed here. This leaves
GIT-03 green-boundary admission incomplete without implying a falsely
reported final endpoint. Nonpublication, PR drafting, branch cleanup
choice and failure-reporting paths have bounded evidence only.
**That checkpoint: 56 bounded assessed slices, 62 known-incomplete,
16 host pending, 66 unassessed; zero qualified.**

**Assignment assessment (earlier checkpoint):** six further AGT requirements were checked through
actual manifest constructors, live-reservation/result handlers and coordinator
instructions, with 15 direct pure/content controls. Both assignment payloads
omit contract/config revisions and assigned budget (AGT-04). Token limits
do not communicate assigned budget. Read-only permissions are conveyed
through role descriptors/rubrics; no dedicated action field is required
merely for its own sake. Old-revision analyst output gets a stale note, but completed
output has no required reconciliation action and the inspected coordinator
instructions omit an explicit before-acting stale-result procedure (AGT-11).
Detection is not reconciliation. Role definitions, simultaneous reservation
identity, result statuses and disagreement instructions are bounded slices,
not observed native behavior. That checkpoint had **52 bounded assessed slices,
61 known-incomplete, 16 host pending, 71 unassessed; zero qualified**.

**Configuration and learning assessment (earlier checkpoint):** eleven more complete requirements
were compared with the actual catalog, setters, reconciliation, lesson
storage, packet readers, forgetting and finish paths. Nineteen pure
configuration tests and direct pure lesson controls pass. Durable
configuration corrections lack a provenance record; strict restriction
errors do not suggest the nearest valid key; lesson anchors are not
reconciled; finish has no evidence-backed lesson proposal queue. Other
assessed behavior is bounded source/control evidence, not host adherence
or qualification. That checkpoint had **48 bounded assessed slices,
59 known-incomplete requirements, 16 host-observation-pending and
77 unassessed**, with zero qualified requirements.

**Latest reconciliation:** the plan/review candidate has completed all
1,500 supported CI tests, both direct-runtime built UAT passes and
real-bundle plan smoke on Node24.22.1/22.12.0. Distinct refs are accepted;
duplicate refs and changes to started-item dependencies/basis links refuse
without changing accepted intent or pending questions. The later basis
repair remains a separate candidate: supported tests-first baseline
reproduces all five defects; exact test bytes are now reconciled.
The complete supported targeted cohort passes 58/58, including all
11 contract controls. Real-bundle basis smoke passes on both runtimes:
duplicate request/Tenet refs refuse before questions and preserve accepted
state; distinct `__proto__` links resolve to the proper requirement.
Source/bundle/manifest preflight matches. The exact 1,509-test CI and all
six sequential dual-runtime generic/plan/basis UAT smokes now pass.
That checkpoint does not validate the subsequent budget/stop candidate.

Another 17 requirement assessments find three boundary gaps despite
28 passing pure/content controls. A direct production review-result
counterexample reaches Standard delegation5/6 with `nearLimit=true`,
no warning and no proactive handoff: the warning/handoff path is wired
only at check finalization (WRK-08/12). General operational failures do
not all enter the candidate-only repetition signatures (WRK-09).
Lane raising still receives project-wide traits, not captured change-trait
evidence (WRK-04). These are not fixed or waived by existing passing tests.
The current worklist is **41 bounded assessed slices, 55 known incomplete,
16 host pending and 88 unassessed; zero qualified**. Earlier counts below
are historical checkpoints, not current totals.

The isolated protocol candidate now wires D2/D6 parser/identity/candidate
decision/all-work refresh, but not schema2 production admission/publication.
Its exact patch is 303,829 bytes, SHA
`d8ec1fbc5050495da7923b87900d6ae987b7fde14fbc151b94908f8d8388320a`.
All four fixed owner ceilings still fail; its matrix remains 21 partial,
eight missing, zero complete. A narrow review resolves three earlier
prototype defects, not full integration. Full integrated independent
review is assigned. No cap change, activation or broad candidate CI.

**Latest basis identity repair (local candidate):** ambiguous basis refs can
redirect an example or duplicate retained IDs. Four failing-first input
controls now refuse before confirmation/allocation. A separate failing-first
case found `__proto__` becomes an inherited object rather than the assigned
requirement ID; Map-based local resolution fixes it while preserving the
returned plain-object mapping. Nine identity controls and the 47-test
portable basis/intent/plan cohort pass, as do types, all lints and
build/payload/reproducibility. The bundle is 784,709 bytes, SHA
`2794a8749ed921a51748b62e19e71cfa521d38e321c8d8c0590010bfb50cc610`;
manifest `b3789ad6f1f1480b05742567261ef6a42f3fe92d8fbb26bcb07120975d493841`.
This is input validation, not stored-state schema activation; all caps stay
unchanged (schemas 26,525/26,899, central 247,203/247,219).
Supported validation is queued after the untouched earlier artifact.
The attempted Windows contract cohort had eight mutation-guard failures,
not passing pipeline evidence; the Linux targeted cohort includes it.

**Intent assessment:** 22 pure parser/projection/impact controls pass.
INT-02 has a bounded recording/rendering slice; INT-15 has basis obligations,
cooperative intake instructions and a non-Quick advisory, not proof of model
adherence. INT-08 has cooperative coordinator guidance to inspect impact before intent
changes, but required automatic basis previews are incomplete: only inspect
and plan previews call impact, not basis/overview/decision changes, and the
helper does not scan test tags or verification refs. INT-09 records MADR fields in state and the adopted
summary but not specified standalone decision files; changing only
consequences is silently treated as a no-op (direct handler counterexample).
INT-13 still adopts only `INTENT.md`, not designated sections. These are
implementation gaps, not closed requirements. Further INT-04/07 assessment
confirms exact-proposal confirmation and unresolved-assumption gating, not
proof that a model correctly classifies user intent. INT-14 ships a static
starter architecture document and read-only architect guidance but lacks
a concrete create-and-maintain workflow for changed/arbitrary projects.
Worklist now has 18 bounded assessed slices, 49 known incomplete,
16 host pending and 117 unassessed.

**TDD and evidence assessment:** 94 receipt/verdict controls pass after
reading the basis/obligation, check preparation/execution/finalization,
lock disposition, packet and review-manifest paths. The implementation
distinguishes assertion reds from load/compile errors, binds test/support
definitions, rejects zero or contradictory populations, retains flaky
rerun history and blocks stale/inconclusive proof. These are bounded
deterministic mechanisms, not proof of correct model-authored tests,
preservation coverage or refactor judgment.

Two full-contract gaps remain explicit. INT-06's lock disposition takes
one path/reason but does not model a behavior-change user decision versus
an independent Reviewer's test-defect decision or a batch target.
EVD-10 has a final verdict lock comparison, but check/reviewer-packet
boundaries do not themselves turn changed locks into blocker Finding
records; generic diffs and a later endpoint refusal are not that specified
workflow. No new authority route or finding schema was invented to hide
these gaps. The worklist now has 28 bounded assessed slices, 51 known
incomplete, 16 host pending and 105 unassessed, zero qualified.

**Earlier plan/review artifact:** exact supported CI has naturally passed
all 1,500 tests/231 suites with zero failures, cancellations or skips
(671,640.209045ms; golden 153,291.450295ms). CI log SHA
`980e3398b79f25ec7ff7757cabb832951e3321f8e64d8682d45fb563af320ea8`.
Sequential dual UAT and real-bundle plan smoke are active. This validates
only the frozen `dc25bbf5...` source, not the subsequent basis correction.

**Final bounded plan follow-up:** four additional baseline-red controls show
in-progress/done items could change dependencies or basis-element links
despite the existing frozen-item contract. Its rejection now uses the existing
complete semantic equality; all 19 pure plan tests pass. Current combined
bundle SHA is
`dc25bbf50606e4c511b8bb64558fe3c23687884048dfbeb9c68673fc675b3b21`,
manifest
`f2c8d976f7dd4881d42b932d9e7be7d999595248d067195dd188a8d2bf599f75`.
Typecheck/lints/build/payload/reproducibility pass under unchanged limits.
Supported tests-first controls now reproduce ten pure-plan failures plus
the public decision asking instead of refusing, and both full-review
admission failures. Exact corrected source passes the combined 134-test
cohort. Its 1,500-test CI has now passed; dual built UAT and
a repaired-plan CLI smoke are active before the subsequent basis repair.
The earlier restore/snapshot/readiness artifact has now passed all 1,485
Linux CI tests with zero failures/cancellations/skips, followed by passing
Node24.22.1 and Node22.12.0 built UAT. That completed older checkpoint does
not validate the later plan/admission or basis changes. Each checkpoint
remains bound to its exact source.

**Additional instruction assessments:** actual entry/onboarding/intake and
Reviewer/Analyst text plus 10 passing content controls establish bounded
INS-11, INT-03 and AGT-06 instruction slices. They do not prove native
missing-tool recovery, question quality, authority enforcement or child
isolation. Worklist now has 14 assessed deterministic slices, 45 known
incomplete, 16 host-observation pending and 125 not yet assessed, with zero
formal requirement qualifications; this is not a completion percentage.

**Full-review recheck admission correction:** a baseline-red production
admission test confirms a full-mode result could supply `rechecked`.
The shared admission function now refuses nonempty recheck claims before
application using `review-result-invalid`; empty/absent claims stay valid.
A real findings-handler control preserves finding/history/reviews and the
live reservation while correctly counting the reported native dispatch.
Six focused controls, typecheck, lints and build/payload/reproducibility pass
locally. Supported exact-source acceptance is pending. This does not complete
the finding lifecycle: actual recheck assignment/state restrictions and
the unsigned decision API/schema remain open. The combined plan/admission
bundle is 784,603 bytes, SHA
`680063f4fe385c5875609e740afa30830316f8c8afc022afa31775590f49878b`.

**Planning admission gap:** direct production `buildPlan` controls show two
new items with the same `ref` return `ok: true` but the second item has no
ID and fails the production `PlanItem` schema. The reference map overwrites
the first allocation, then the positional lookup runs past its ID list.
Distinct-reference/dependency controls and all seven existing pure plan tests
pass. This is a reproduced INT-10/INT-12 builder gap, not evidence that an
invalid plan was durably published. Reject duplicate resolved proposal keys
before allocation; add collision and unchanged-input controls before source
integration. Six duplicate/alias controls fail against unchanged source in the
normal runner (nine passes/six failures). The integrated guard makes all 15
pure tests pass, preserving dependencies and existing duplicate-ID refusal.
Typecheck, all lints, M0 mapping, build, payload and reproducibility pass within
unchanged limits. A public decision regression also checks refusal with and
without confirmation, preserving accepted intent and pending questions;
supported execution is pending. The rebuilt bundle SHA is
`4c2de172ab5ef4a35040c62476841ef971a1bf407f0f8b30d0c2ce9eb7f9fd6a`.
The active Linux run remains isolated on the earlier frozen artifact and
does not validate this new plan correction.

**Latest exact acceptance:** the 1,485-test snapshot/readiness CI finished
with 1,484 passes and one failure: golden correctly withheld review because
a restore crash test timed out before passing its retry (`evidence-flaky`).
The unused second `unmarked` crash has now been removed without removing
assertions or changing deadlines/population. Focused baseline and candidate
both pass; actual tracing confirms two restore children become one.
Parent/Linux test SHA is
`02e8ac5758a2fa930a6b520bd3abe89b41b4d5a7349674bfd55e8b5a3da1c0ab`.
Kernel bundle is unchanged; regenerated manifest is
`281bceda3b1ea9f56ec5378f9817b97e7f08923cf7b0962c197e88373516ee17`.
Final exact-source CI and dual-runtime built UAT are requested, not passed.
Separately, nonshipping live CFG-10 now has Linux baseline-red/candidate-green
evidence; production capacity and complete protocol integration remain open.

**Latest follow-up:** REV-03 assessment reproduced an external `.snap`
expected-content replacement producing no attention. The existing collector
now lists external snapshot additions/replacements/removals with content-bound
disposition identity; both new pure controls fail on baseline and pass after
the repair. Existing net-marker semantics and verdict policy are unchanged.
Local checks pass within fixed limits. On Linux, all three corrected snapshot
controls are baseline-red and the candidate core/configuration suites pass
29/29. The first unused-snapshot fixture was invalid: Vitest pruned it and
correctly triggered concurrent-edit/inconclusive; that diagnosis is retained.
Final 1,485-test full CI is running, dual-runtime built UAT pending, for
bundle 784,397 bytes, SHA-256
`84732fa048f32923573d3e4926ef25b833fe924936a0a0361bde63e40a4fe853`.
Readiness-only full CI had 1,481 passes, no assertion failure and one golden
outer-timeout cancellation; it is not acceptance of that or the current
candidate.
The current run has since emitted a golden failure: retained inner Vitest
evidence shows the restore crash test's `unmarked` case exceeded its unchanged
five-second deadline (7,278ms), while the browser report has 12 expected and
zero unexpected/flaky results. Final CI counts are pending. Source inspection
found an unused second crash/setup after all `unmarked` assertions; a focused
scratch baseline/candidate comparison is planned after the active run ends.
This is not yet a validated correction or a reason to widen the deadline.

**Additional bounded assessments:** RSC-01/02/03 now distinguish the actual
inheritance-only request surface, reported/unknown model provenance and
closed paid-action vocabulary from unobserved native behavior. Four existing
deterministic controls and six direct session controls pass. REV-06's
same-session/unknown-isolation disclosure is assessed separately from its
still-unqualified host/test-author identity obligation. No model or native
resource qualification is inferred from these checks.

**Finding lifecycle:** the missing REV-04 transitions now have a concrete
[draft contract](../../../specs/finding-lifecycle-completion.md), with an
independent review and dispositions for all six findings. The proposal keeps
existing user dispositions, distinguishes reported coordinator/user authority,
requires `fixed` before Reviewer verification, and separates schema-gated
severity history. The existing direct `valid -> verified` behavior contradicts
the canonical chain; it is not an approved compatibility exception. No runtime
finding change, schema activation or capacity increase is implied. Owner
contract sign-off remains necessary before implementation.
Direct production schema/admission/application controls additionally admit a
full-review result carrying `rechecked` and turn `valid`, `fixed` or
`deferred` findings into `verified`, despite an empty recheck assignment.
Ordinary results preserve the state and a mismatched declared mode refuses.
These controls establish a pure admission/application gap, not an observed
whole-pipeline `checked-local` bypass. The draft includes explicit mode,
named-target and existing-disposition preservation acceptance cases.

**Current follow-up:** INS-04 assessment reproduced a separate readiness
defect: doctor observed an unwritable state directory but still reported
L4 and plugin-ready because the tier input hardcoded writability. The new
test fails on that baseline. A second red control proves the doctor-only
fix leaves the shared helper wrong for other callers. Shared readiness now
uses the actual observation; doctor reuses it exactly once for consistency.
All 36 platform/core controls pass locally (13 platform), with unchanged
quality limits. Exact-source Linux CI and dual-runtime built UAT are pending
for the new 784,310-byte
bundle. The 1,480-test acceptance below belongs to the preceding candidate,
not this changed artifact; [evidence scope](repair-validation.json).

The audit below describes the frozen baseline. The owner subsequently
directed implementation of independently actionable work. The current
uncommitted candidate repairs F3/F4 (reviewer role/cap), F5/F6 (quoted-key
privacy scanning and environment-file exclusions), F8 (repeated critical
detection), and the safe subset of F7 (transactional inserts and private
atomic credential publication). It also repairs later-Deep preview guidance,
the starter protected-path list and stale status/host-evidence wording.

Independent review findings for Quick issuance and evaluator severity
matching were accepted and corrected. Local type/lint/build/payload checks
pass. The final Windows population passes 350 tests / 39 suites with no
failures or skips; the same 350 checks pass on Node 22.12.0 with the
TypeScript opt-in inherited by subprocesses. This optional source diagnostic
does not replace minimum-runtime built acceptance. The final rebuilt
kernel is 784,297 bytes, SHA-256
`75d2480ebbf9c4988ac3d66ca942e56e1585b28c8796e8cfb397d7bbd1c7543f`;
its 96-file manifest is
`356eb0ee1b037b05ff1c4f3603fe4697489f76252a226d8620fea0b2b1bf71ee`.
Linux independently matches these identities and changed runtime source
hashes. This corrects an intermediate stale generated artifact, not a
cross-platform difference.
Exact identities and validation scope are retained in
[repair-validation.json](repair-validation.json).

**Final supported validation passes:** exact-source Linux `npm run ci`
completes 1,480 tests / 229 suites, all passing with zero failures, skips
or cancellations. Typecheck, all lints, coverage, bundle budget, payload
and reproducibility gates pass. Built UAT passes on Node24.22.1 and
Node22.12.0 as an ordinary non-root user. This validates the bounded repair
candidate, not F1/F2, whole-protocol integration, host qualification or release.

Earlier failed runs remain part of the evidence. The first run
passed all pre-test gates but failed 36 of 1,479 tests under a contaminated
validation setup: UID0 bypassed permission assertions, inherited offline
settings blocked subprocess downloads, inherited Git identities changed a
negative control, and Node24.11.1 failed a minimal symlink-removal control
that passes on Node24.22.1. Root bundle UAT also failed its permission
assertion. Corrected isolated non-root built UAT now passes on both
Node24.22.1 and Node22.12.0 against the matching final bundle. Corrected
final full CI also passes. No source fixes or skipped assertions were substituted for
correcting the environment. Baseline CI below is not validation of the
changed candidate.

An intermediate subsequent full run passed 1,479/1,480 tests with no skips or
cancellations; all pre-test gates pass and the loan-desk journey reaches
its exact 147 cases. The remaining starter failure occurs after its
114-case suite and 12 browser checks pass: the cancellation fixture's
60-second browser-readiness clock includes earlier suite/static phases.
Retained timing shows the browser phase starts about 44 seconds into that
clock. The test now observes the real forwarded runner invocation before
starting the existing browser-readiness deadline; all commands, browser
identity and termination assertions remain real and unchanged. Supported
validation of this test-only synchronization correction passes in final CI. The
unchanged starter-only run passes all four cases, including the complete
176.1-second journey, supporting the composite-run timing diagnosis.

**Still open:** F1/F2 production corrections have neither an accepted safe
design nor demonstrated fit within fixed owner budgets. Earlier attempts
measured 801 central and 263 Git characters over baseline ceilings; the
later F1 measurement and safety rejection are recorded below.
Their red regressions and conservative F1 source
candidate remain separate, not knowingly failing additions to the shipped
suite. Independent review also found that the F1 candidate's post-resolver
snapshot can include human edits, and its hash-check/write sequence still
races external writes; a capacity increase alone would not approve that
candidate. Automatic reconciliation of pre-commit orphan credentials and
historically partial starter databases is not implemented: uncertain
credentials explicitly refuse rather than overwrite, and existing users
remain untouched. The whole-protocol feasibility candidate is isolated,
not activated. Qualification and release gates are unchanged.

Linux scratch characterization confirms the unsafe F1 ownership cases:
both human edits made during resolver execution and between hash comparison
and restoration are overwritten (zero of two preservation controls pass).
Baseline and candidate each pass 35/39 characterization tests, with
different failures; two manually journaled recovery intents omit the
manager and therefore do not establish the intended recovery outcomes.
An isolated follow-up supplies the canonical required `manager: npm`:
baseline fails both controls; the candidate handles unchanged preimages
and refuses changed files with `effect-uncertain`, preserving them. The
remaining probe failure expects exit 0 instead of the actual conservative
exit 2. This clarifies those probes, not the unsafe rollback ownership.
The exact candidate central owner is 247,974/247,219 (755 over), superseding
the earlier estimate for that candidate. These results reject the candidate;
they are neither a shipping fix nor complete recovery validation.

**Protocol feasibility checkpoint:** the isolated candidate is preserved,
not integrated. Its patch SHA-256 is
`657e4e9cf4f8afa66a48587e84f07b033396aed7a0f610866486643d8ccf0e68`
(174,710 bytes, independently verified). Of 29 responsibility rows,
zero are integrated/closed, 21 have partial slices and eight remain absent:
C4, C5, C6, R1, V1, G1, O4 and O8. The author reports 178/178 focused
checks and passing type/architecture/skills/build gates, but fixed schema,
budget, store and central owner ceilings fail by 22,195, 6,546, 17,501
and 623 characters. The 792,974-byte partial bundle excludes unwired
helpers and is not complete-target sizing. All 123 captured file hashes
and byte counts were verified; 28 states and 11 of 14 journals decode,
while three unresolved forget/adopt journals refuse. This is not a
successful migration of the complete capture. Partial independent review
found three material defects; bounded fresh-context follow-up confirms
the allocation-floor, cross-workspace join and staged-symlink fixes, with
86 focused tests passing. The patch is unchanged and whole-candidate
review remains open. Durable launch/store/journal ownership, proof consumers,
migration/rollback/retention and trait policy/wiring remain blockers.

| Finding | Current candidate | Remaining closure |
|---|---|---|
| F1 recovery | Not integrated; unsafe candidates preserved separately | Resolver ownership and atomic conditional restoration, missing-preimage refusal, real concurrent-write/crash controls, capacity approval |
| F2 hidden deletion | Conservative nonzero refusal integrated; 134/134 focused and dual actual CLI pass, final frozen acceptance pending | Preserve exact index/flags and refuse unavailable assume-unchanged/skip-worktree inputs within the unchanged Git ceiling; no deletion reconstruction claimed |
| F3/F4 reservations | Role-aware issuance/results, cap refusal and Quick-slot preservation integrated; full Linux CI passes | No native-host qualification claim |
| F5/F6 privacy | Quoted-key scan and environment exclusions integrated | Keep heuristic limitations explicit; no proof of secret absence |
| F7 initialization | Transactional inserts, private atomic publication and uncertain-state refusal integrated | Owner-selected reconciliation for orphan credentials and historically partial databases; existing users are not rewritten |
| F8 report eligibility | Separate primary-attempt 4/5 detection gate and V2 output integrated; full Linux CI passes | Local reports remain untrusted campaign inputs |

## 1. Conclusion

Tenet has a substantial, tested kernel and a real plugin and starter, but it has
not completed its milestone gates or qualified a release. The most useful
description is **an implemented preview with significant Beta/R1 work and
qualification still open**, not "almost finished."

The audit found new counterexamples in dependency recovery, hidden-file
inventory, review reservation handling, starter initialization and offline
review measurement. These should be corrected before adding more product
behavior. In particular, recovery can overwrite human content, a hidden
tracked-file deletion can be omitted from candidate inventory, and a local
report can pass review eligibility after only one of five required critical
detections. Those affect data preservation and evidence honesty, not merely
presentation. The offline report is not trusted qualification authority.

**The full plan cannot honestly be completed in two hours.** In addition to
missing mechanisms and owner decisions, PRD section 5.9.2 requires a public
72-hour review window for applicable solo-maintainer changes, and section
6.6.2 requires a qualification pilot with a two-week follow-up. Neither can
be replaced by parallel coding or a green deterministic suite. A two-hour
stabilization slice is proposed in section 9; it is not R1 completion.

The original audit changed no product behavior; the subsequent repair
continuation is distinguished above. No commit, push, release, host spike,
model campaign or participant recruitment was performed.

## 2. Evidence and audit limits

### Exact-source evidence

[Workflow 41762334301](https://github.com/vedprakash-m/tenet/actions/runs/41762334301)
is successful at the exact audited commit:

| Environment | Evidence |
|---|---|
| Ubuntu | Full `npm run ci`: 1,462 tests / 228 suites; zero failures, cancellations or skips. Built-bundle UAT passes on Node 24 and 22.12.0. |
| macOS | The same full-suite totals and dual-runtime built-bundle UAT pass. This is hosted CI, not installed VS Code qualification. |
| Windows | The portability job passes. It deliberately does not claim POSIX mutation/process qualification. |
| This Windows checkout | Typecheck, all three lints, M0 structural coverage, build, complete payload verification and same-toolchain reproducibility pass after restoring locked dependencies. |
| Additional audit checks | 65 tooling/traceability/build-integrity tests, three privacy tests, 136 pure kernel tests and 62 offline evaluator tests pass. These are overlapping selections, not additional unique tests to add to the full CI total. |

The built kernel is **784,061 bytes** against **819,200 bytes**, leaving
35,139 bytes. It has SHA-256
`0818ed74bf8a8fd5f10ce53735e11150b252a3c4e885c84d46787922f5bbcb8e`.
The 94-file payload manifest has SHA-256
`270fd5bd72db55fa57a7b82f2236ed4acf4a37b90abda81ab5314ed1919017e0`.
Reproducibility here means two empty output destinations using the same
source and installed toolchain, not an independent clean-install rebuild.

### What was reviewed

The review covered the canonical requirements and current plan; the kernel's
core, pipeline, recovery, decisions, verbs and adapters; plugin practice and
host binding; starter platform/UI/test infrastructure; offline evaluation;
and build, traceability, quality and release tooling. Three bounded,
independent read-only lanes examined kernel correctness, plugin/starter
behavior and evaluation. Tooling, CI evidence and integration were examined
directly.

The tracked implementation contains 113 kernel source files, 110 kernel test
files and four evaluator source files with three test files. Counts exclude
starter tests inside the payload and are not a quality score.

This was a broad, risk-directed audit, not a proof that every line or possible
execution path is correct. Newly reproduced helper/port counterexamples are
distinguished below from real-Git observations and from untested risks.
The full POSIX mutation suite was not rerun locally on Windows; exact-source
remote results supply that baseline. No dedicated exploit-focused security
review or new native-host qualification was performed.

## 3. How much progress is actually established

The owner has authorized the integrated completion strategy. The initial
[implementation acceptance worklist](implementation-closure.json)
enumerates all 181 R1 Musts and 19 Shoulds, canonical acceptance suites,
source identities and tagged-test discovery references. It distinguishes
known gaps from unassessed implementation; it is not the formal evidence
ledger and does not declare mapped requirements complete. Semantic
assessment and integrated requirement closures remain active work under
plan §12.21.

Fresh results from `tools/coverage.ts`:

| Cumulative milestone | Musts | Tagged T1 mapping | Host-only | Unmapped | Qualified |
|---|---:|---:|---:|---:|---:|
| M0 | 34 | 30 | 4 | 0 | 0 |
| Alpha | 100 | 91 | 9 | 0 | 0 |
| Beta | 158 | 129 | 13 | 16 | 0 |
| R1 | 181 | 139 | 16 | 26 | 0 |

R1's 139/181 is **76.8% structural mapping**, not 76.8% implemented behavior,
engineering effort, acceptance coverage or release readiness. A test tag may
cover only part of a compound requirement. Some untagged requirements need
host evidence rather than code.

The evidence ledger has **zero records**: all 181 Must dispositions are
`unreviewed`; `tools/release-audit.ts --milestone R1` blocks all 181.
All **19 Should dispositions remain open**. There are zero mapping-integrity
errors. Tests reference 103 of 119 reason codes; references alone do not prove
every producer or every verdict row.

### Implemented capability versus remaining boundary

| Area | Substantial implementation present | What that does not establish |
|---|---|---|
| Deterministic kernel | One pipeline; strict input/state validation; authority and ownership; bounded outputs; final-response rebuilding; verdict and budget functions | Every composition path is correct; see the new recovery, inventory and reservation counterexamples |
| Store and recovery | Locks, guarded admission, atomic publication/backups, effect journal, process ownership and schema-1 bridge admission | Schema-2 migration/rollback, whole-protocol interrupted-launch accounting, complete aggregate retention |
| Git | Temporary-index commits, staged/unstaged preservation, attribution, local integration/undo, prototype shadow repository | Hidden-file deletion correctness, every concurrent recovery path, shared-file ID reconciliation |
| Evidence and review | Behavioral red/green, receipts and freshness, locks, supported report normalization, review packets/results, findings/dispositions, Analyst dispatch | Sealed-baseline classification, full adapter/configuration/version matrix, caller-aware manifests, native independence |
| Configuration and intent | Typed catalog, existing-layer resolution, project/task settings, policy trust foundations, managed-block adoption | Complete spoken readback/confirmation, personal layer, all-work invalidation, shared update/reverse parsing, reconstruction |
| Plugin experience | Five skills, coordinator/reviewer/analyst practice, inspect-versus-act rules, result/steering guidance | Native model adherence, enforcement of cooperative text, final front-end selection |
| Starter | Real TypeScript/API/browser platform, authentication/session/CSRF, SQLite/migrations/restore, OpenAPI generation, browser/axe tests, workload tooling | ASVS conformance, manual accessibility, supported workload acceptance, workload receipt/trend consumers, API compatibility enforcement |
| Evaluation/build | Public fixtures, offline protocol/replay/report tools, explicit payload hashes, pinned untrusted CI, same-toolchain double build | Live/protected/reserved/native/human campaigns, model qualification, signed provenance or release approval |

M0 and Alpha are not qualified just because their structural unmapped counts
are zero. Their outstanding host and milestone exit gates still apply.

## 4. New correctness findings and fix acceptance

Priority meanings: P1 threatens user content or evidence correctness; P2 is
a material budget/contract/tooling defect. These are work-order priorities,
not exploit-severity ratings.

### F1 - P1: interrupted dependency recovery does not preserve unknown content

**Current boundary:** the G0 correction above removes destructive writes from
the interrupted resolve reconciler and conservatively fences unknown content.
The description below is the original baseline counterexample. Normal
failure/decline restoration and missing-preimage/concurrent-write safety still
need correction and full supported acceptance; this finding is not closed.

Locations:
`packages/kernel/src/verbs/recover-effects.ts:162-170`,
`packages/kernel/src/decisions/dependency-job.ts:23-30`,
and related cleanup in `decisions/dependency-start.ts:147-153`.

Recovery restores before-images without first proving that current manifest
and lockfile contents belong to the interrupted resolution. Controlled calls
to the actual recovery code overwrite concurrent human contents. If an
original file was absent, restoration can delete a new human file. Missing
stored before-images are replaced with empty strings through
`readBlob(...) ?? ""`, and recovery reports a completed rollback.

This is not just missing functionality. Tech Spec section 7.4 requires
postcondition-based recovery and honest uncertainty. The existing dependency
test around `packages/kernel/test/dependency.test.ts:193` expects restoration
after changed contents; it does not distinguish resolver output from a later
human edit.

**Fix acceptance:** validate every needed before-image before any write;
restore only provably owned output; retain unknown current content and an
unresolved fence. Cover human edits, originally absent files, missing blobs,
partial restoration and repeated recovery. Use actual interrupted processes
on supported POSIX for the full acceptance case. Do not repair this with a
blanket catch or by declaring the effect settled.

### F2 - P1: deletion of a hidden tracked file escapes candidate inventory

Location: `packages/kernel/src/adapters/git-cli.ts:385-402`, `hiddenChanges`.

The hidden-entry path handles changed content but does nothing when a file
marked assume-unchanged or a similar index state is absent. The old index
entry remains and no deletion status is added. A real Git scratch repository,
using the public inventory method, reproduced an unchanged digest after an
assume-unchanged source file was deleted: the absent file was retained and
the status list was empty. This creates a stale-identity risk for ordinary
files not separately covered by declared-input processing.

The existing test at `packages/kernel/test/git.test.ts:44-51` checks changed
hidden content, not deletion. Real Git inventory is proven; the separate
receipt-to-verdict test remains pending. Do not equate the unchanged digest
counterexample with an already reproduced false `checked-local` result.

**Fix acceptance:** real Git controls for hidden-file modification and
deletion; deletion must change the candidate identity or conservatively
refuse it. Add a check-to-finish freshness regression, preserving the user's
index and flags. Test both supported hidden-index cases.

### F3 - P2: analyst/reviewer overlap bypasses delegation reservation admission

Location: `packages/kernel/src/verbs/manifest.ts:108-110`.

The existing-review search matches basis and candidate but not reservation
role. A live Analyst hold is treated as an existing reviewer reservation,
skipping new-reservation admission, while a distinct reviewer hold is then
created. Actual issuance functions reproduced six accounted Standard slots
becoming seven.

**Fix acceptance:** require reviewer role in reviewer reuse/admission and
retry paths. At five consumed delegations plus one live Analyst hold, a new
review must not create a seventh slot. Also preserve valid same-review
retries and prove no reservation/counter change on refusal.

### F4 - P2: reviewer result validation accepts an Analyst reservation

Location: `packages/kernel/src/core/review.ts:148-152`.

`checkResult` resolves a reservation ID without checking its role.
A reviewer-shaped result with matching binding fields from an Analyst
reservation was accepted by the actual validator. The Analyst validator
already has a role check; the reviewer check is asymmetric.

This proves cross-role admission, not a complete checked-local bypass:
coverage and freshness gates still matter.

**Fix acceptance:** reject cross-role result submissions in both directions
before settlement, without changing counters or consuming the wrong hold.
Fix F3 and F4 together because they share the reservation-role invariant.

### F5 - P2: the staged privacy heuristic misses quoted JSON credential keys

Location: `tools/privacy-check.ts:11`; tests:
`packages/kernel/test/privacy.test.ts:8-19`.

The ordinary assignment heuristic catches a synthetic unquoted `apiKey`
assignment but misses the same value in a JSON property with a quoted key.
All three baseline privacy tests pass;
a separate audit regression expecting the quoted assignment to be reported
fails. No real credential was used or found.

**Fix acceptance:** extend the named assignment heuristic and tests for
quoted JSON keys, escaping and ordinary non-secret placeholders. Keep the
documented limitation: heuristic scanning is not proof of no secrets.

### F6 - P2: root environment files are not ignored

Location: `.gitignore:1-11`.

`git check-ignore` excludes `.tenet/` and `node_modules/`, but not `.env`,
`.env.local` or `.env.production`. The staged privacy tool does reject
secret-store filenames, so this is a missing preventive layer, not evidence
that a credential was committed.

**Fix acceptance:** add repository-appropriate environment-file exclusions,
test representative names with `git check-ignore`, and keep staged checks.
Do not silently expand any exception for committed example files.

### F7 - P2: starter identity initialization does not recover a partial seed

Location:
`plugin/skills/tenet-starter-ts-web-api/template/server/src/platform/dev-identities.ts:12-19`;
startup invokes it in `template/server/src/server.ts:14-18`.

The actual `seedDevIdentities` function was called with a controlled failure
on its second user insert. One user remained, no credentials file was
published, and a second invocation skipped seeding because any existing
user is treated as completed initialization. This is a deterministic actual-
function failure/restart reproduction, not a real-SQLite or killed-process
test. Existing unrelated application users must not be overwritten as a fix.

**Fix acceptance:** recover each partial initialization boundary without
losing user data or publishing credentials that do not match persisted
accounts. Cover failure between account creation and credential publication
with real storage/process controls on the supported runtime.

### F8 - P1: offline review eligibility misses repeated critical-detection failure

Locations: `packages/eval/src/report.ts:310-358,437-445`;
PRD section 1.6 requires each critical seeded defect to be found in at least
four of five runs.

The actual report function was given five repetitions of one critical seeded
finding, with only one successful detection. It returned recall `1`,
review gate `pass` and eligibility `pass` against an 80% recall threshold.
Findings are deduplicated by finding ID across slots, so this measures
whether a unique defect was detected at least once. It does not enforce the
separate repeated-critical-detection rule.

This is a measurement/eligibility gap, not an authenticated qualification
bypass. The report already states that its inputs are untrusted local
declarations. Unique-defect recall may be useful, but it must not stand in
for repeated-run reliability.

**Fix acceptance:** review/sign the report contract for separate aggregate,
per-run and per-critical-defect metrics; test 1/5 refusal, the exact 4/5
boundary, missing attempts, retries, model strata and all output formats.
Preserve failed/cancelled observations and CLI exit 3 for failed or
inconclusive eligibility. Do not repair this by dropping missed attempts
or changing the frozen acceptance threshold.

### Persisted counterexamples

Runnable scripts are retained in this session's files:
`kernel-audit-repro.ts`, `seed-restart-repro.mjs`,
`review-recall-counterexample.mjs` and `privacy-audit-repro.mjs`.
The kernel script prints the destructive rollback,
missing-preimage, real-Git unchanged-digest, six-to-seven reservation and
cross-role acceptance counterexamples. The seed script asserts the partial
restart behavior; the evaluator script prints 1/5 observed detections versus
reported recall 1 and passing eligibility. The privacy script deliberately
exits nonzero on the missing JSON-assignment finding; that is the red regression, not a new
product-suite failure. No product implementation or committed test was
edited to obtain these observations.

## 5. Source-derived findings, uncertainties and previously known defects

These are not all newly reproduced defects and should not be presented as
such.

| Item | Evidence and consequence | Next check |
|---|---|---|
| Finding lifecycle is only partly executable (REV-04) | Tech Spec §8.4 and PRD §3.7.2 require disputed, linked fixed and contrary-evidence withdrawal transitions. The schema enumerates them, but `decisions/simple.ts:82-89` only accepts user deferred/risk-accepted/wont-fix and `core/review.ts` records valid/verified results. Correctly paired direct controls for open→disputed, valid→fixed and disputed→withdrawn all refuse with `revision-conflict`; valid→deferred passes. These are no-I/O controls, not host observations. | Review the concrete transition API and its evidence/authority binding before implementing; preserve current blocker/major gates. Enumerated states and the existing valid→verified recheck test do not close the whole requirement. |
| External snapshot changes bypass attention at baseline (REV-03) | Actual adapter classifies `.snap` as source; changing expected content matches no hunk pattern. Two added pure tests reproduce the missing item; the local collector repair and real-pipeline regression are recorded in `repair-validation.json` `snapshotFollowup`. | Finish exact-source supported pipeline/full acceptance; no closure borrowed from the prior bundle. |
| Starter stale-owner reclaim may race | `template/server/src/platform/owner.ts:23-33` removes a stale path and later releases by path. Two reclaimers may invalidate a newer owner. This is a source-derived risk, not a reproduced race. | Real-process barrier test for competing reclaimers and identity-checked release. |
| Starter Windows owner probing | `owner.ts:8-16` depends on `ps`; failure is treated conservatively as a live owner. | Not a current macOS R1 blocker. State a starter OS boundary or implement portability under separately approved scope. |
| Starter protected-path instructions omit two recipe paths | Starter `SKILL.md:24-25` names auth/session/migrations but omits `server/src/platform/admission.ts` and `rate-metadata.ts`, which the recipe and Tech Spec protect. | Align instructional preview with the actual recipe defaults; keep authority unchanged. |
| Host evidence is overstated in one canonical table | `specs/tech-spec.md:275` describes fresh context/parallelism as observed more broadly than `plugin/com.github.copilot/descriptor.json:3-5` and target-host observations support; line 270 also has contradictory descriptor/control-class wording. | Amend the table to distinguish target-host evidence from experiments on another harness and resolve control-class wording. Do not promote the descriptor. |
| `serial` dispatch is cooperative, not the specified kernel refusal | Tech Spec section 8.5 row 4 describes `packet analyst` refusal; current dispatch lacks that consumer. | Implement from the agreed mechanism or obtain an explicit spec amendment. |
| Deep preview covers kickoff, not every lane raise | Current skill has a kickoff Deep variant; Tech Spec section 8.6 also requires a preview at a lane change. | Regression for a non-Deep task raised to Deep after kickoff. |
| Git inventory size guard is incomplete | Existing reason-code audit finds the 20,000-untracked-file guard but no 500 MB aggregate guard. | Test the exact byte threshold and fail before unbounded reads. |
| Git lock retry contract is incomplete | `git-locked` classification exists; the specified retry/backoff does not. Index-sync retries are a different path. | Real lock contention with exact retry policy; no unsafe retry of an uncertain effect. |
| Run-directory refusal previously had exit 0 | Failing-first pipeline regression reproduced `run-dir-unavailable` as exit 0. The registry and Appendix C now assign exit 2, and the regression asserts the reason and empty next action. | Exercise the public CLI check path and supported-POSIX acceptance; do not treat this injected stateless fixture as disk-full or whole-source evidence. |
| Disk-full producer is absent | `disk-full` is registered, but ENOSPC mapping and in-flight-effect semantics are not implemented. | Preserve uncertain effects and completed-effect disclosure; do not merely rename every I/O error. |
| Reason registry is ahead of features | 16 codes remain unreferenced; prior audit classifies 14 as unbuilt-feature codes, one as decision-blocked and one as a spec defect. | Resolve producer/contract meaning before adding tags or removing codes. |
| Progress documents were stale at audited source | The dashboard/top log said no CI for the merged tree; README status is dated October 31. Exact-head green CI now exists. Plan also retains a stale 250-line cap versus the actual 265. | This audit reconciles the current plan summary and preserves history; README and the stale cap wording remain to align. |

Known reason-code detail is in
[the November 3 audit](../2026-11-03/reason-codes.md).

## 6. Exact outstanding Must inventory

### The 26 unmapped Musts

These are requirement frontiers, not 26 equally sized coding tickets.

| ID | Remaining behavior/evidence | Immediate dependency |
|---|---|---|
| INS-05 | Version/input-sensitive capability reprobe/cache with provenance | Probe identity/cache contract and host observations |
| AGT-10 | Users obtain results without managing specialist lifecycle/transcripts | Native journey evidence, not another instruction-presence test |
| AGT-12 | Changed public interfaces prioritize direct callers/importers and acceptance tests | Manifest context implementation and capacity |
| EVD-04 | Rerun broader failures on sealed baseline and classify honestly | Sealed-baseline decisions/review; materializer and live classification consumers |
| RES-05 | Source-checked run/demo instructions, confirmed-example steps, UI screenshots | Reviewed result contract; held candidate/capacity; trait/capture/retention integration |
| GIT-09 | ID-aware shared-file collision detection and confirmed merge | Shared-files S1/S3 sign-off, real Git integration |
| CON-07 | Reconstruct lost local state without invented receipts/grants | Reconstruction decisions, parsers and conservative workflow |
| CFG-01 | Spoken settings with interpreted value/scope/readback/confirmation | Combined configuration/migration contract and skill routing |
| CFG-03 | Complete layered resolution, non-equivalent command conflicts, restrictions | Same protocol; personal layer also needs SP-02 |
| CFG-04 | Effective setting explanation including sources, adoption and limits | Settings routing/enforcement metadata and protocol |
| CFG-08 | Personal preferences never enter shared documents | Close overview/adoption path as well as future personal layer |
| RSC-08 | Model qualified/unqualified/unknown label and pre-Deep warning | Authorized golden results, qualification table and dispatch consumer |
| LFC-01 | Release versioning against actual compatibility contract | First release and reviewed SemVer rationale |
| LFC-02 | Notes disclose permission/destination/executable/evaluator/schema/behavior changes | Release-note checklist or mechanism and exact candidate comparison |
| QLT-05 | Reference workload receipts, cross-change trends and degradation attention | Workload contract/consumers; supported-runtime acceptance |
| QLT-11 | Runtime project/change trait detection, persistence and correction | Pure core exists but is unwired; schema-2 protocol and all consumers |
| QLT-13 | Triggered threat/data note linked to tests or constraints | QLT-11 plus note shape/resource and evidence consumers |
| ENG-05 | Full native suite monthly and after observed model changes | Authorized host suite; resolve full-suite versus smoke wording |
| ENG-07 | Protected source/build/provenance/signature/install verification chain | Release workflow, signing identity and independent rebuild |
| ENG-08 | Frozen bounded improvement experiment with holdout | Surface allowlist discrepancy, experiment mechanism and authorized campaign |
| ENG-09 | Correlated trace fields with visibility gaps | Journal trace candidate is held over the central ceiling |
| ENG-11 | Public solo-maintainer review window and disclosure | Real open PR, elapsed review window, release notes |
| OSS-01 | Complete conduct/security/contribution/supported-version publication | Owner-selected contacts/conduct policy; placeholders remain |
| NFR-01 | Measured system budgets on frozen small/large/history fixtures | Benchmark fixtures/harness and complete storage retention |
| NFR-05 | Separate active/provider/tool/network/user-wait time | Report contract and explicit unknown attribution |
| NFR-07 | Requested, previewed, redacted diagnostic export | Export contract, schema/retention and capacity |

### The 16 host-only Musts

| Requirement IDs | Evidence still needed |
|---|---|
| INS-01, INS-03 | Qualified native install without a source build; task-first readiness |
| INS-09, INS-10, INT-01 | Stateless conversational inspection/help; engagement once; inspection before questions |
| INT-11, NFR-02, NFR-06 | Guided wording, keyboard/screen-reader usability, independent locale/convention choices |
| WRK-05, WRK-11 | Automatic request routing and native steering/resume journeys |
| REV-06, RES-03, RES-07 | Independence disclosure, no routine final approval, proportionate limit disclosure |
| SEC-01, SEC-16 | Native permission/denial behavior and high-risk-domain claim boundary |
| OSS-02 | Quickstart/examples/troubleshooting usable in first-use sessions |

Several of the 26 unmapped items also require host/human evidence. Therefore
16 is not the total number of requirements needing external observation.
Conversely, an unmapped operational requirement is not necessarily missing
source code.

### The 19 Shoulds

No omission in the proposal below is a new approval.

| ID | Current position and remaining disposition |
|---|---|
| INS-08 | Policy-blocked recovery wording and regression exist; native specificity/owner disposition remain. |
| INT-13 | Existing-doc intent sources not built; proposed omission needs signature. |
| INT-14 | Architecture-document maintenance not built; proposed omission needs signature. |
| AGT-09 | Focused same-session path exists; retain truthful reduced-independence wording and obtain evidence/disposition. |
| TDD-05 | Refactor-after-green instruction exists; cooperative behavior remains unobserved. |
| EVD-14 | CI import is an explicit cut; no signed omission yet. |
| RES-08 | Guided app-start offer/response confirmation not built; proposed omission needs signature. |
| RES-09 | Deep kickoff instruction exists; lane-raise gap remains. |
| GIT-06 | On-request chat PR-draft instruction exists; no kernel publishing and no native acceptance evidence. |
| GIT-07 | Starter workflow/check-command correspondence is tested; environment/host qualification remain. |
| GIT-14 | Branch-deletion offer is instructional; agent does not delete the branch. Native behavior/disposition remain. |
| CFG-07 | Local persistence exists, provenance is layer revision; narrower-claim approval and inferred-confirmation behavior remain. |
| RSC-05 | Conserve/Serial instruction exists; specified dispatch refusal is absent. |
| LRN-04 | Evidence-backed lesson proposal is instructional; evidence is optional in the kernel and no one-offer counter exists. |
| QLT-08 | Full handover-document maintenance not built; proposed omission needs signature. |
| QLT-15 | Recipe upgrades are cut; no signed omission yet. |
| ENG-06 | Pinned telemetry-subset export not built; proposed omission needs signature. |
| OSS-03 | Outside-contribution RFC/certification policy still needs criteria and approver, not invented documentation. |
| OSS-06 | Previewable redacted feedback export not built; proposed omission needs signature. |

Do not mark all eleven proposed "implement" rows passing merely because text
was added. The November 3 lane report explicitly records the remaining limits.

### Additional partial behavior hidden by the mapped count

The following must remain on the execution backlog even though related
requirements already have tags: full configuration-to-evidence invalidation;
durable interrupted-launch accounting; schema migration/rollback; aggregate
retention/pruning; generated OpenAPI compatibility checking; native review
independence and tool restrictions; full verdict-row composition;
after-the-fact dependency detection; brownfield server/build identity;
ASVS behavioral/manual evidence; manual accessibility; supported workload
measurements and kernel fitness-trend consumers.

## 7. The actual blocking dependency chain

### Capacity is a real gate

Original audit measurements, before the repairs above (not final-candidate
headroom):

| Owner | Used characters | Ceiling | Free |
|---|---:|---:|---:|
| Pipeline + verbs + decisions | 247,182 | 247,219 | 37 |
| Node adapter | 20,160 | 20,160 | 0 |
| Git adapter | 37,801 | 37,843 | 42 |
| Budget core | 8,806 | 8,870 | 64 |
| Store adapter | 25,706 | 25,920 | 214 |
| Schemas | 26,371 | 26,899 | 528 |

The five shared owners excluding the Node adapter have only 885 characters
free in total. The coordinator skill is at its 4,000-token cap. Moving code
to an uncapped helper or compressing safety logic is not a valid solution.

The current quality gate reports **zero grandfathered function offenders**.
That is positive evidence about measured length/complexity/nesting, not a
proof of correctness. Existing wide-line allowances remain. The problem is
that new required behavior has no demonstrated complete fit, not that the
current tree is failing its quality gate.

The held ENG-09 and RES-05 candidates are reported at 245 and 608 central
characters over the ceiling respectively. They are not integrated behavior.
Earlier larger scratch measurements are historical incomplete candidates,
not current production measurements or approved final ceilings.

### Recommended order

This is the original dependency order, not a list of untouched work.
F3/F4/F5/F6/F8 and the conservative F7 subset now pass final acceptance.
The first unresolved implementation work is F1/F2; the protocol candidate
remains partial and unintegrated.

1. **Stabilize existing invariants first.** Correct F1-F4, with F1/F2 first
   for data preservation/freshness. Close F8 before using offline eligibility
   as campaign evidence, and F7 before relying on restart-safe starter
   initialization. Keep reason-code repairs and privacy hardening in bounded
   follow-on changes, not mixed into migration.
2. **Close the complete-target capacity decision.** Finish one coherent
   candidate for all 28 protocol responsibilities plus QLT-11, with actual
   measurements and omissions. Obtain approval for exact limits only after
   independent integrated review. Do not keep spending cycles on tiny
   refactors while treating an unmeasured complete fit as a promise.
3. **Freeze one shared protocol and one integration owner.** Close
   configuration identity/readback, schema-1 decoding/bridge identity,
   migration/rollback, launch acknowledgment/accounting, recovery fences,
   trait state/corrections and all evidence consumers together. Do not let
   parallel agents invent different receipt or recovery contracts.
4. **Integrate vertical slices with distinguishing tests.** Compatibility
   and strict decoding first; configuration transition/invalidation next;
   launch/settlement/stop/recovery; trait persistence and risk/obligation/
   review consumers; real migration/rollback/forget and kill prefixes.
   Existing helper tests do not close these integrated responsibilities.
5. **Complete independent remaining mechanisms.** Sealed baseline,
   shared-file reconciliation, reconstruction, retained-storage mechanisms,
   demo/capture/freshness, diagnostics/traces, workload/trends, threat/data
   notes and caller-aware packets. Each retains its review/sign-off gate.
6. **Run campaigns on the frozen integrated artifact.** Authorized host
   spikes/front-end selection; protected/reserved/native golden runs;
   model table; performance/resource/security/privacy/accessibility;
   successive-change comparison and one bounded improvement experiment.
7. **Close the human and release gates.** Formative sessions and pilot;
   requirement-by-requirement ledger review; each Should passes or gets its
   own signed omission; residual risks published; independent rebuild,
   provenance/signature/install verification and owner approvals.

Parallelize only independently owned files with stable interfaces: bounded
existing-behavior fixes, documentation/policy preparation and independent
starter controls can proceed alongside the protocol candidate. Serialize
shared-schema changes, the integration checkpoint and heavyweight full
suites. Send external-access requests in parallel only after authorization;
the four existing drafts have not been sent.

The plan's existing 14-25 week range is historical planning, not a newly
validated estimate from this audit. A credible shorter schedule needs a
finished measured candidate, named external access/participants and
observed implementation throughput. Neither an exact two-hour promise nor
a newly invented multiweek estimate is supported.

### Owner decision brief and restart criteria

No response to a decision request is approval. While the owner is
unavailable, existing limits, contracts and qualification gates remain in
force; the validated repair candidate is preserved unchanged.

| Decision | Alternatives | Recommendation and prerequisite |
|---|---|---|
| Recovery ownership | Retain conservative refusal when ownership is unknown; or approve a new ownership/restore protocol | Preserve unknown content. Require a reviewed protocol that passes both human-edit race controls and real crash-prefix tests before implementing a production replacement. Increasing capacity does not repair ownership. |
| Capacity | Keep fixed ceilings and demonstrate a readable complete fit; or approve exact revised limits after measurement | Do not choose new limits from the partial candidate. First complete the coupled design, independently review it and report full-target sizes, including currently unwired helpers. Neither code compression nor moving ownership is an accepted substitute. |
| Starter reconciliation | Continue explicit refusal for orphan/partial state; or approve an identity-and-credential reconciliation policy | Keep the shipped refusal until the policy defines authority, handling of existing users and credentials, interruption recovery and distinguishing tests. Do not silently regenerate credentials or rewrite users. |
| Qualification | Preserve the preview claim; or authorize specific native-host/model/human campaigns | Keep the preview claim. Each campaign needs its own authorized target, access and evidence; deterministic CI cannot replace native observations or elapsed-time requirements. |

These are separate decisions, not a request for blanket approval. After
the relevant decision is recorded, resume with its reviewed spec and
failing distinguishing tests, then implementation, full CI and built UAT.
Release still requires all applicable qualification and sign-off gates.

## 8. Qualification work that cannot be hidden inside coding completion

The 30 public golden tasks and 122 declared controls are authored, but do
not supply ten protected reserved tasks or a live qualification campaign.
The ledger remains empty. A model qualification table cannot be truthfully
filled from synthetic replay.

The three implemented evaluator slices validate static protocols, replay
synthetic observations and aggregate declared report inputs. Replay is not
a native capture or execution runner. Golden graders and hand-authored
state fixtures demonstrate grader behavior, not that an agent/kernel
actually produced those records. Protocol hashes and run metadata in local
reports are not authenticated pre-run provenance. These are intentional
trust boundaries, not reasons to activate unsigned live-execution work.
F8 is a separate defect in the current metric/eligibility behavior.

The starter ASVS inventory accounts for 70 IDs: 46 pending, 19 scoped
non-applicable and five gaps, with none marked passed. Automated axe and
keyboard/focus checks are useful but do not replace the required manual
screen-reader observations. Supported Node 24 workload acceptance is
reported as failing in the unsigned runtime proposal; no target or runtime
scope change is approved by this audit.

The target host tuple remains unqualified. Hosted macOS CI does not prove
VS Code installation, plugin snapshots, approval semantics, child isolation,
denial handling, `.tenet/` indexing exclusion or uninstall behavior.
SP-01/02/08 observations are partial; other spike dispositions and SP-12's
front-end selection remain open.

Release still needs the actual verification chain, the public review window,
final conduct/security ownership, documented support/limitations and explicit
owner approvals. The release-audit tool checks due Must qualification;
it explicitly does not certify all of PRD section 4.7.

## 9. Efficient two-hour stabilization plan

**Recommended deliverable:** a narrow, verified stabilization candidate and
an owner-ready completion backlog. Not schema-2 activation, a complete Beta,
an R1 release or a claim that all findings are fixed.

The following budget is a scheduling proposal, not a promise that every fix
fits. It starts after selecting the slice and confirming a supported POSIX
validation/publication route. This audit itself has not implemented it.

| Time | Work | Pass/fail checkpoint |
|---|---|---|
| 0-10 min | Freeze source and select the safety slice. Confirm capacity treatment and any required contract decision. Start with F3/F4 as one small invariant repair; include F1/F2 only if their full safe fix fits. | No silent ceiling change, schema change, guessed rollback ownership or expanded scope. |
| 10-40 min | Add failing regressions for the selected defects, then minimal corrections. If disjoint work is explicitly authorized, a separate lane can handle starter seed/protected-path or privacy controls. | Each regression fails against the old implementation for the intended reason and passes after the fix. |
| 40-65 min | Run focused real-Git/process tests and built CLI acceptance for changed behavior; independently review the patch; integrate once. | No lost human contents, no stale candidate identity, no over-cap hold or cross-role result. Unresolved dependency ownership stays fenced. |
| 65-105 min | Run the complete supported-POSIX CI and dual-runtime built UAT on the exact candidate. Existing exact-head CI took about 18 minutes on Ubuntu and 31 minutes on macOS, excluding queue delay. | All applicable gates pass; no weakened assertions, deadlines, budgets or skipped required population. |
| 105-120 min | Reconcile evidence, plan and changelog; staged privacy check if a commit was requested. Report exact remaining failures and untouched findings. | Persistent patch and exact evidence. Commit/push only when separately requested; no borrowing old CI for changed runtime code. |

**Stop conditions:** if safe dependency recovery requires a changed journal
contract, if a fixed owner ceiling is exceeded, if POSIX execution is
unavailable, or if CI cannot finish, return the tested bounded slice and its
blocker. Do not label the full task done.

### Systematic backlog format

Use one row per requirement sub-obligation or reproduced defect:
`ID -> contract -> implementation -> red test -> passing test/UAT ->
review disposition -> capacity -> exact source/artifact -> qualification`.
Keep implementation, structural mapping and qualification as separate
columns. This prevents another large test-count increase from being
mistaken for closing the remaining product.

Use the existing plan as the progress record, but replace its competing
"current" summaries with one dated current snapshot and append-only history.
Do not use the 111 unchecked or 254 checked historical checkbox lines as
a progress denominator: many are duplicated or superseded.
