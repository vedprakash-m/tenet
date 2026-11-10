# Changelog

## 2026-11-10 — Deep work warns about an unqualified or unknown model

- Entering Deep work on a model whose label is not `qualified` returns one `model-unqualified-for-deep` question at `open`, and again before the first `check` after a later rise to Deep: "This model configuration hasn't been evaluated for Deep work. Continue with that limitation, or pause?" `continue` records the answer for this work and its model record only (a changed record asks again); `pause` parks the work. The model label is never changed and no other model is suggested (RSC-08, TS §4.8, UX §5.1). No qualification table exists yet, so every model is `unknown` and every Deep contract is asked. Files: `verbs/model-limit.ts`, `decisions/model-limit.ts`, `decisions/index.ts`, `verbs/open-new.ts`, `verbs/check.ts`, `core/schemas.ts` (optional `modelAck`), `plugin/skills/tenet/SKILL.md`; tests `model-qualification.test.ts`, `deep.test.ts`.

## 2026-11-09 — Dirty-file choices: wait, include, leave out

- The `dirty-overlap` question now offers the UX J-03b choices: `wait` (recommended; records nothing, and a file the user committed or set aside meanwhile stops being human-dirty at the next check), `include` (the named files are committed with the work), and `leave-out` (Tenet neither edits nor commits the file; a check that finds it declared or changed is refused with `attribution-mixed-file`). The legacy `keep-out` answer is still accepted. Owner decision 2026-11-09: consented inclusion of named files is allowed; PRD §5.12 now says so, matching the UX and Tech specs (P47). Files: `verbs/dirty.ts`, `verbs/check.ts`, `decisions/simple.ts`, `core/schemas.ts` (optional `leaveOut`), `plugin/skills/tenet/SKILL.md`, `README.md`, `specs/PRD.md`; tests `dirty-overlap-bind.test.ts`, `scenarios.test.ts`.

## 2026-11-09 — Preview safety fixes: Git variables, consent binding, cleanup removal

- Ignore Git's repository-local variables (`GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE` and the rest of `git rev-parse --local-env-vars`, any case) in the kernel process, `GitCli`, the bench fixtures, the privacy check and the test helpers, so an inherited value cannot point them at another repository (P75, P77, P78). Files: `adapters/git-env.ts`, `adapters/git-cli.ts`, `wire.ts`, `main.ts`, `tools/bench-fixtures.ts`, `tools/privacy-check.ts`, `test/helpers.ts`; test `git-env.test.ts`.
- A `dirty-overlap` answer must match the files the question showed, and the question names every file (P47, in part). Files: `decisions/simple.ts`, `verbs/dirty.ts`; test `dirty-overlap-bind.test.ts`.
- After a declined hook or filter question, a later explicit `commit` asks again instead of running the hook (P48). File: `verbs/commit.ts`; test in `workflows.test.ts`.
- Disable confirmed `decide cleanup` removal (`capability-missing`); the preview still lists what would be removed (P30). Files: `decisions/cleanup.ts`, `plugin/skills/tenet/SKILL.md`, `README.md`; test `cleanup-disabled.test.ts`, test-only seam in `residue.test.ts`.
- Not qualified. Recovery and attribution defects (P61, P65), the missing dirty-file choices and NFR-01 remain open.

## 2026-11-08 — Integrated preview: undo disabled, record keys kept, admission cached

- Merge open PRs #7, #8, #9, #11, #12, #13 and #14 into one candidate on `preview-integration`; #10's save is excluded. Conflicts were resolved by keeping both sides.
- Disable `undo` and `decide undo-confirm` (`capability-missing`); its path discovery can overwrite human work (P67, P70–P72). The README lists the open safety defects; the skill no longer offers undo. Files: `verbs/undo.ts`, `plugin/skills/tenet/SKILL.md`, `README.md`, `tools/uat/uat.mjs`; tests `undo-disabled.test.ts`, with a test-only seam in `undo.test.ts`, `backup-accounting.test.ts` and `fixtures/crash-undo.ts`.
- Keep record keys named `__proto__` when state is read: `ownRecord` replaces `z.record` for persisted state maps, and `currentTestHashes` builds the verdict's hash map on a null-prototype object (AC-07/AC-17/AC-27). Files: `core/schemas.ts`, `verbs/facts.ts`; test `own-record-keys.test.ts`.
- Cache state admission by file identity in `adapters/store-fs.ts`: #14's per-read admission re-parsed state on every blob and log access and raised long-history warm p95 from 347 ms to 904 ms on CI (435 ms after this change).
- Publish state with one full read instead of three (each read also replays the journal), re-reading only when the state file's identity changed; record the just-published files as admitted; test duplicate keys in place instead of on a copied tail in `parseUniqueRecord`. Files: `adapters/store-fs.ts`, `adapters/private-record-fs.ts`; test `unique-record.test.ts`.
- Not qualified. Linux/macOS CI before the cache change: 1,831/1,833 tests (the two failures were the test seam, since fixed). NFR-01 warm p95 still exceeds 300 ms.

## 2026-11-07 — Cache capabilities by declared dependency identity

- Bind each capability's cache key to explicit host version, plugin version, project policy and declared inputs. Reuse only unchanged entries, retain original probe provenance, and refresh optional schema-1 state through the existing mutation pipeline. Unknown host identity prevents reuse; unavailable declared inputs degrade only their dependent capability.
- Expose capability provenance in status and explain dependency declarations and stateless doctor behavior. Descriptor resolution is not a new native-host observation or qualification.
- Files: `core/capabilities.ts`, `core/schemas.ts`, `adapters/host-plugin.ts`, new `pipeline-capabilities.ts`, pipeline/ports/wiring/status modules, descriptor and coordinator skill, three canonical specs, install help, new `capability-cache.test.ts`, and built UAT.
- Six focused controls pass locally, including the documented Windows mutation refusal. Typecheck, all lints, M0 structural coverage, 785 KB/900 KB bundle and payload verification pass. Supported-POSIX persistence controls and built scratch UAT remain pending in exact-source hosted CI; native host behavior remains unobserved.
- Hosted head 53d6fa6 exposed seven no-op/accounting regressions in Ubuntu's 1,754-test suite. Keep absent verb state absent instead of publishing current state for a cache refresh; add a portable red/green no-op control and built repeated-open controls. The focused suite now passes seven controls; repaired-source full CI/UAT remains pending.
- Executable/effects changes retain the solo 72-hour review window; the owner merges. Shared approved D01 capacity-only changes are included, without schema-2 activation or dependency.
## 2026-11-07 — Report five kernel-call timing fields (NFR-05)

- Add invocation-local `active`, `tool`, `provider`, `network` and `userWait` timings to newly rendered responses and journal call records. Measure active and the union of tool/check intervals with a monotonic clock; preserve exact host observations or null with unknown provenance, never estimates. Invalid or failed host observations fail explicitly.
- Preserve historical cached response timing, legacy optional response decoding, stored schema and existing active-budget accounting. The shipped plugin does not observe provider, network or user-wait timings; no native-host qualification is claimed.
- Files: new `core/timing.ts`, `pipeline-timing.ts` and `test/timing.test.ts`; `pipeline.ts`, `pipeline-render.ts`, `core/schemas.ts`, `ports/types.ts`, `adapters/system.ts`, `verbs/inspect.ts`, `test/trace-journal.test.ts`, `test/audit-boundaries.test.ts`, `tools/uat/uat.mjs`, both READMEs, and canonical technical/UX specifications.
- Ten timing fixtures and existing trace/quality controls pass locally (34 tests); Windows static gates, payload verification and same-source/toolchain reproducibility pass. Full POSIX CI and built real-repository UAT remain pending. Reuses the approved D01b capacity-only commits; no separate ceiling change.
- Hosted validation exposed four transport-refusal stubs without timing ports and two stale shared capacity controls. The refusal stubs now supply only clock/host observations and still assert no repository state creation (4/4 pass locally); the shared capacity repair `070bb23` is reused unchanged (11/11 local portability fixtures pass). Revised exact-head hosted validation remains pending.
## 2026-11-07 — Process policies and CI measurements

- Add Contributor Covenant 2.1, supported-version/security-report policy, PR compatibility and solo-review disclosures, strict SemVer checks and help version/source fields.
- Add monthly current-model evaluation reminders, dispatch-only Linux built-bundle UAT, frozen-fixture budget CI and production startup/health peak-RSS measurement. Amend the starter target to 400 binary MB; this limited workload does not qualify the reference workload or full NFR-01.
- Files: process documents and PR template; `tools/semver.ts`, `tools/starter-memory.ts`; process-policy, platform and memory tests; workflow YAML; `package.json`; `verbs/inspect.ts`; canonical memory specification.
- ENG-08 uses the owner's revised skill-only, five-repeat choice. The preregistered introduction-compression proxy runs 40 independently recorded trials with frozen floors; native skill quality remains unknown and the baseline remains deployed. Branch protection, signing identity, private vulnerability reporting and release environment settings remain owner actions.
- Preserve benchmark and RSS process failures with direct stdout redirection instead of `tee` pipelines. Run [42408929961](https://github.com/vedprakash-m/tenet/actions/runs/42408929961) contained a failed long-history warm-latency row (347 ms p95 against 300 ms) despite a green workflow; that artifact remains failure evidence, not qualification. Files: `.github/workflows/system-budgets.yml` and `packages/kernel/test/process-policy.test.ts`. The new `[NFR-01]` control failed before the repair and passes afterward; exact-head hosted gates remain pending.
- Preserve both corrected measurements: push [42410239534](https://github.com/vedprakash-m/tenet/actions/runs/42410239534) fails large/long-history warm p95 at 312/406 ms; PR [42410242380](https://github.com/vedprakash-m/tenet/actions/runs/42410242380) passes on a different reported CPU model with identical bundle bytes. Historical load and causality are unobserved. Add bounded same-runner baseline/candidate diagnostics with five paired repeats on each failing fixture, unchanged judgments, exact sources/bundles, raw call timings and Linux CPU/load counters. Missing evidence or any measured failure fails the diagnostic; NFR-01 remains partial. Files: `tools/bench-comparison.ts`, `packages/kernel/test/bench-comparison.test.ts`, `.github/workflows/system-budgets.yml`; three red-first controls pass locally, with typecheck and all static gates passing. Hosted repeated evidence remains pending.
- Paired run [42412488892](https://github.com/vedprakash-m/tenet/actions/runs/42412488892) completed all 20 attempts with 12 failed warm rows; both baseline and candidate fail all five long-history repeats. Exact hashes, fixed fixture identities and every timed raw call verify; setup/discarded calls are not retained. Whole-trial CPU/load counters do not establish an operation-level cause or justify a product fix. NFR-01 remains partial; no passing run replaces failure evidence.
- Required PR run [42412488898](https://github.com/vedprakash-m/tenet/actions/runs/42412488898) passed Windows/Ubuntu but failed macOS nested watcher calibration before review. Add bounded watcher event/path/error diagnostics and an isolated native control before mandatory full POSIX CI, retaining five-second deadlines and all review assertions. Files: `packages/kernel/test/read-only-review.test.ts`, `packages/kernel/test/ci-security.test.ts`, `.github/workflows/untrusted.yml`. Typecheck, all lints, coverage and 25 focused controls pass locally; native diagnostic evidence and root cause remain unobserved.

## 2026-11-07 — Apply approved D01/D01b capacity ceilings

- Set the central responsibility owner to 400,000 non-whitespace characters and the kernel bundle ceiling to 900 KiB. Charge configuration, schema, budget, migration and private-record companion files to their original owners; retain the per-file, complexity, nesting and width gates.
- Record the reconciled candidate's measured owner totals and set other measured owners to those totals plus 5%, rounded up. Unmeasured owners retain prior allowances. These are capacity settings, not schema-2 activation, a qualified bridge or migration completion.
- Files: `tools/lint-quality.ts`, `tools/quality-baseline.json`, `tools/build.ts`, `packages/kernel/test/quality-gate.test.ts`, `packages/kernel/test/invariants.test.ts`, `packages/kernel/test/tooling-portability.test.ts`, `specs/tech-spec.md`, and this changelog. Quality-gate fixtures cover every split owner, including `verbs/inspect.ts`. Portability controls use the approved bundle ceiling and prove acceptance at 921,600 bytes and refusal at 921,601 bytes without stale checksums; supported-platform exact-head CI remains pending.
- The isolated capacity-only schema-1 runtime measures 248,251 central-owner characters and an 800,807-byte bundle. Its local build, payload and reproducibility checks pass. These measurements do not replace the approved ceilings or qualify schema-2 migration.
## 2026-11-07 — Cover undo ownership changes after preview

- Add a real-Git regression proving that a foreign commit with the same
  `Tenet-Work` label arriving after preview is refused at confirmation. Source,
  index and history stay unchanged; no inverse is applied and no revert contract
  is created. The existing slice 0 guard is unchanged.
- File: `packages/kernel/test/undo.test.ts`. Tags: `[CON-12, GIT-04]`.
  Local static gates pass; supported-POSIX CI is pending.
- Files: `tools/lint-quality.ts`, `tools/quality-baseline.json`, `tools/build.ts`, `packages/kernel/test/quality-gate.test.ts`, `packages/kernel/test/invariants.test.ts`, `specs/tech-spec.md`, and this changelog. Quality-gate fixtures cover every split owner, including `verbs/inspect.ts`; supported-platform exact-head CI remains pending.
## 2026-11-07 — Prioritize interface-change review context

- Order review investigation paths as changed sources, linked acceptance/boundary tests (including unchanged tests), then remaining changed tests. Deduplicate and apply model exclusions before selection.
- Full, recheck and stateless packets direct native resolution of direct importers and callers of changed non-private interfaces/symbols before unrelated adjacent reads. Resolution stays unknown until evidenced; text-search fallback and unresolved/static coverage limitations are explicit. No stored schema, permissions, verdict or context-budget change.
- Files: `packages/kernel/src/core/review.ts`, `packages/kernel/test/interface-context.test.ts`, `plugin/skills/tenet-review/SKILL.md`, `plugin/skills/tenet/resources/focused-review.md`, `tools/uat/uat.mjs`, and `specs/tech-spec.md`.
- Five test-first [AGT-12] controls pass locally. The built scratch-repository UAT asserts unchanged linked test priority and unknown native resolution; supported-POSIX CI/UAT is pending. Native-host dependency resolution remains unobserved.
## 2026-11-07 — Prepare the hardened schema-1 bridge candidate

- Add strict minimal rollback-terminal admission, duplicate raw-key/schema refusal, operation-local exclusive writer locks and read-only artifact paths. Preserve schema-1 corruption recovery and stateless advisory artifacts; do not add schema-2 activation, migration replay, release identity or capacity changes.
- Files: `core/migration-terminal.ts`, `adapters/private-record-fs.ts`, `adapters/store-fs.ts`, bridge and filesystem tests/fixtures, `tools/reproducible-build.ts`, built bridge UAT fixtures, the untrusted workflow, `README.md`, `specs/tech-spec.md`, and `docs/schema-1-bridge.md`.
- Failing-first terminal/writer/read-only/raw-duplicate/unbound-blob controls and reproducibility-identity controls were observed on Windows. Typecheck, lints and structural coverage pass locally; POSIX processes and built UAT require exact-source hosted gates. The verifier reports actual bundle, payload-manifest and input digests with source/toolchain identity, not a qualified or released bridge. Installed-host and power-loss behavior remain unobserved.
- Files: `tools/lint-quality.ts`, `tools/quality-baseline.json`, `tools/build.ts`, `packages/kernel/test/quality-gate.test.ts`, `packages/kernel/test/invariants.test.ts`, `specs/tech-spec.md`, and this changelog. Quality-gate fixtures cover every split owner, including `verbs/inspect.ts`; supported-platform exact-head CI remains pending.

## 2026-11-07 — Extend verdict failure-boundary controls

- Add test-only controls for introduced failures across stop/budget states, excluded versus non-excluded baseline failures, and partially excluded, mixed or unnamed failure reports. These characterize existing verdict behavior; no runtime rule changes.
- File: `packages/kernel/test/verdict.test.ts`. The verdict suite passes 67/67 locally on Windows, with typecheck and all lints passing. The three tables check 162 combinations: 72 introduced-failure, 36 fully excluded/non-excluded baseline, and 54 partial/mixed/unnamed failure cases. Full supported-POSIX CI and public-pipeline proof remain pending; these tests do not establish failure-signature equivalence or complete AC-27 qualification.
- Wrap-up validation: the complete Windows portability cohort passes 375/375 with no skips. Typecheck, all lints, M0 structural coverage, build (782 KB/800 KB), complete 97-file payload verification and same-source/toolchain reproducibility pass. Staged and prior writer-admission addition privacy scans found no likely leaks; scans are not proof of absence. Hosted full CI and real-repository built UAT must validate the published source separately.

## 2026-11-07 — Retry transient competing-writer admission reads

- Retry only the bounded private-record read-change refusal during admission when a live competing lock is confirmed, within the existing lock deadline. Extract private-record filesystem helpers to keep the adapter within its established module-size budget, and align the project-reference UAT assertion with the named unsupported-configuration refusal.
- Files: `packages/kernel/src/adapters/store-fs.ts`, new `packages/kernel/src/adapters/private-record-fs.ts`, and `tools/uat/uat.mjs`.
- Exact-source hosted run [42323039009](https://github.com/vedprakash-m/tenet/actions/runs/42323039009) passed on Ubuntu and macOS: full CI passed (1,744 tests, 0 failures on Ubuntu), and built UAT passed on current and minimum supported Node on both platforms. Windows portability passed. The one-shot capture step was skipped; this does not establish host observation, qualification or overall plan completion. Local Windows cannot run the real-process store test because directory `fsync` returns `EPERM`; local typecheck and all lints pass.

## 2026-11-06 — Name unsupported TypeScript configurations

- Return a named `adapter-unsupported-config` refusal with an inconclusive receipt when static TypeScript checks cannot safely interpret `tsconfig.json`; preserve `null` for unavailable tools/configs and advance the adapter identity to `node-ts@28`.
- Files: `packages/kernel/src/adapters/static-config.ts`, `packages/kernel/src/adapters/node-ts.ts`, `packages/kernel/src/adapters/runner.ts`, `packages/kernel/src/core/receipts.ts`, `packages/kernel/src/ports/types.ts`, `packages/kernel/src/verbs/check-evidence.ts`, `packages/kernel/src/verbs/check-execute.ts`, and their static-check tests.
- The new configuration refusal controls pass 6/6. Typecheck, all lints, M0 coverage, build, payload verification and reproducible-build checks pass locally. Full Windows CI reports 1,096 passing, 631 failing and 17 skipped tests; platform-dependent mutating workflows are unsupported on this host, so this is not POSIX validation. Hosted POSIX CI and built UAT remain pending; Phase 4's broader adapter-matrix item remains open.

## 2026-11-06 — Make filesystem watcher canaries race-safe

- Keep each canary file until its recursive watcher reports the create event, then clean it up. This prevents the test from deleting the canary before the watcher observes it.
- File: `packages/kernel/test/read-only-review.test.ts`. The focused test passes locally on Windows/Node 24.22.1. The previous hosted run failed only this test (1 of 1,742) on Ubuntu; exact-source hosted CI is pending. No runtime behavior or qualification claim changed.

## 2026-11-06 — Clarify observer-hook qualification gate

- State that the source preview ships no observer hooks and any future hooks are gated on qualification, matching the UX requirements without implying a host observation or release commitment.
- File: `README.md`. Documentation-only change; checked against the README requirements in `specs/ux-spec.md` §6.1.

## 2026-11-06 — List excluded baseline failures in verdicts

- Include every failing test name in the `baseline-failure-excluded` reason so a `checked-local` result lists the pre-existing failures whose scope was excluded.
- Files: `packages/kernel/src/core/verdict.ts`, `packages/kernel/test/verdict.test.ts`. The new regression failed before the change and passes afterward; the verdict suite passes 64/64, typecheck and lints pass locally. Supported-POSIX CI, full UAT and qualification remain open.

## 2026-11-06 — Make the UAT command shell-portable

- Remove the POSIX-only `/dev/null` redirection from the UAT script so `npm run uat` invokes the harness on Windows as well as POSIX shells.
- File: `package.json`. On Windows/Node 24.22.1, the command now reaches the built-CLI harness; it remains unpassed because the first mutating scenario is refused by the documented unsupported-platform guard. This change does not qualify UAT or supported-POSIX behavior.

## 2026-11-06 — Add flaky checkpoint predicate control

- Add a pure `[EVD-08]` regression confirming that checkpoint evidence refuses a current flaky required receipt even when the candidate and last-check identity match. This supplements, but does not validate the public packet mutation path; its real-process regression remains blocked on supported-POSIX execution.
- File: `packages/kernel/test/verdict.test.ts`. Focused verdict suite passes 63/63 on Windows/Node 24.22.1.

## 2026-11-06 — Require passing evidence for manual review packets

- Require `packet reviewer` to pass the same current full-checkpoint evidence predicate used by commit admission, rather than accepting a matching candidate digest alone. Add a real-process regression for requesting a reviewer packet after a flaky candidate check.
- Files: `packages/kernel/src/verbs/packet.ts`, `packages/kernel/test/evidence-flaky.test.ts`. The focused real-process flaky suite is unverified on Windows because the kernel correctly refuses state-changing work there. Typecheck, lints, M0 structural coverage, verdict tests, build, payload and same-toolchain reproducibility pass locally. A complete local `npm run ci` reaches all pre-test gates and finishes the 1,717-test suite on Windows/Node 24.22.1 with 1,079 passed, 621 failed and 17 skipped. The flaky real-process regression and other mutating-workflow cases encounter the documented `win32` capability refusal; this does not establish that every failure has that cause and is not supported-POSIX CI. Built-CLI UAT remains open.

## 2026-11-06 — Expand sampled-caller review controls

- Check that sampled-caller review is reused for a current full passing type receipt, but not for missing, stale-input, stale-candidate, targeted, baseline, failed, inconclusive, skipped or non-type static evidence. Check that the newest current non-baseline result controls reuse, while a later stale or baseline result does not.
- File: `packages/kernel/test/review-admission.test.ts`. Receipts and their ordering are synthetic; the control does not establish their real producer paths or installed-host behavior. No runtime behavior changed.
- The sampled-caller review and verdict selections pass on Windows/Node 24.22.1, as do typecheck, lints and M0 structural coverage. Supported-POSIX CI, full built-CLI UAT and qualification remain open.

## 2026-11-06 — Align intake guidance with the kickoff

- Preview the new-project instruction-file draft with the kickoff rather than after scaffolding, and state the consent, decline and existing-content limits. Bound thin-answer follow-ups to the specified first intake and to one per thin dimension; do not revisit substantive answers.
- Files: `plugin/skills/tenet-intake/SKILL.md`, `resources/onboarding.md`, `resources/conventions-draft.md` under that skill, and `packages/kernel/test/prerequisite-guidance.test.ts`. These are instruction changes and text controls, not new kernel state or authority.
- The guidance suite passes 14 tests on Windows; lint, typecheck, M0 structural coverage, build, payload and same-toolchain reproducibility pass locally. The built doctor reports the expected unsupported-platform `L0` result in a scratch Git repository without creating project files. Supported-POSIX CI, a full built-CLI UAT and installed-host behavior remain unobserved.

## 2026-11-06 — Add malformed-report receipt controls

- Add seeded property-based controls for 22 malformed Vitest and Playwright report fields and inconsistent population totals, with 100 generated inputs per class. Each report retains an earlier valid selected file; malformed input must discard partial normalized facts and produce inconclusive file, tagged-example and suite receipts. Valid two-file reports remain passing controls.
- File: `packages/kernel/test/receipts.test.ts`. These are in-memory synthetic reports, not a complete hostile corpus or a change to runtime behavior.
- The receipt and Playwright adapter suites pass 73 tests on Windows/Node 24.22.1; typecheck, lints and M0 structural coverage pass. Supported-POSIX CI, full built-CLI UAT, real-host observation and qualification remain open.

## 2026-11-06 — Observe stateless review without project writes

- Add a real-port review control that watches a scratch project, compares entry names, file hashes, modes and symlink targets, and checks traced Git commands and attempted runner calls. Negative controls detect a transient nested file on a separate same-filesystem watcher and, after review, on the same project watcher; they also detect changed file bytes and a traced Git configuration write. Correct the existing review-and-inspect scenario's title to match its root-entry, Git-status and object-count checks.
- Files: `packages/kernel/test/read-only-review.test.ts` and `packages/kernel/test/scenarios.test.ts`. Review artifacts use a private temporary directory; no runtime behavior changed.
- On Windows/Node 24.22.1, the final control passes five repetitions and alongside the verdict and checkpoint suites. A separate built-CLI scratch review reports no project watcher events or final snapshot changes, and its project watcher sees the post-review canary; all 23 traced Git starts match the read-only allowlist and Git reports no child commands. The canary does not prove delivery of every event during review, and direct process launches outside the instrumented runner remain unobserved. Supported-POSIX CI, full built-CLI UAT, installed-host observation and qualification remain open.

## 2026-11-06 — Add verdict evidence controls

- Add verdict controls for missing and skipped evidence, basis and review coverage, major and blocker dispositions, authority, and preservation of blocking reasons. Check that targeted acceptance feedback does not supply a missing full-suite result and that checkpoint planning refuses a later targeted result until full evidence is refreshed.
- Files: `packages/kernel/test/verdict.test.ts` and `packages/kernel/test/commit-green.test.ts`. These controls do not change runtime behavior or establish actual user authority or a public producer path for the synthetic receipts.
- The focused verdict and checkpoint suites pass 78 tests on Windows; typecheck and architecture, skill and quality lints pass. Supported-POSIX CI and built-CLI UAT for those workflows remain open.

## 2026-11-06 — Coordinate the reservation-race fixture

- Require all five reservation workers to open their own SQLite connections and signal readiness before the parent releases them. Each worker checks that its insert runs in a transaction. Check that no loan exists before release, then require one success, four unique-index conflicts, one stored loan and intact foreign keys. Bound worker waits and clean up child processes on failure.
- Files: `packages/kernel/test/fixtures/golden-tasks/loan-desk/server/test/concurrent-reservation.test.ts.txt` and `server/test/fixtures/concurrent-reserve-worker.ts.txt` under the same fixture.
- On Windows with Node 24.22.1, the baseline-only reservation test passes without the feature service, five repeated races pass, and the copied candidate passes 178 application tests, typecheck, lint and build. The prior worker fails the readiness check; removing the scratch unique index yields five winners and fails the invariant. In a separate scratch mutation, the previous test passes when the write transaction is removed; the transaction assertion makes all five workers report an error. The barrier does not prove simultaneous SQLite lock acquisition. Full supported-POSIX CI, built-CLI UAT and installed-host qualification remain open.
## 2026-11-05 — Repair dependency verification and project text preservation

- Invalid registry timestamps and non-finite ages stay unknown and obey `unknown_age`; they cannot bypass a deny policy. npm lockfile versions 2/3 validate consumed metadata before normalization. Same-version integrity, license, script and link changes remain in the verification population.
- pnpm v9 retains changed resolution metadata under identical package keys, rejects duplicate identities/unsupported versions, and does not report a package dropped while another version remains. npm removal comparison uses a name set; pnpm grouping avoids repeated array copies. Upgrade matching pairs only one absent prior with one new version, independent of package ordering; ambiguous matches remain additions.
- After explicit owner approval, project text reads refuse malformed UTF-8 before replacement characters can enter managed documents. Update the canonical spec and compatibility test; preserve raw-byte hashes, valid Unicode and literal U+FFFD, and absence semantics.
- Add nine dependency-core regressions, one decision-pipeline denial control and one filesystem preservation control. Focused suites pass 26/26 core, 25/25 dependency integration, and 66/66 combined core/filesystem compatibility; typecheck/all lints pass. Built CLI plus real npm against a synthetic loopback registry proves age denial without publication/install, valid-date preview, decline restoration and malformed-intent refusal without rewriting bytes. The initial strict-decoding candidate exposed the explicit legacy-compatibility assertion; the owner approved the change and that assertion now requires refusal. Full local CI passes 1,718 tests/263 suites without failures/skips; all 152 bundle scenarios and the focused dependency/adoption flow pass on verified Node 22.12.0 against the final 799,293-byte bundle. All 152 scenarios and the focused flow also pass on Node 26.3.0 against the same bundle; the complete 97-file payload and same-toolchain reproducibility pass. No native-host/human qualification follows.
- Refresh the implementation audit and all 200 due Must/Should rows: 141 mapped / 16 host-only / 24 unmapped Musts, 0 qualified; all 19 Should dispositions open. Record the ordered completion path, partial mapped obligations, unsigned contracts and existing capacity discrepancy. No schema, capacity limit, host qualification or release change.
- Files: `core/dependencies.ts`, `core/dependency-admission.ts`, `adapters/project-fs.ts`, dependency/filesystem tests, `specs/tech-spec.md` §9.11, local `specs/plan.md`, and `docs/audits/2026-11-05/`.

## 2026-11-05 — Isolate dependency resolution and refuse unsupported layouts

- `decide dependency` resolves in a private run directory from one validated manifest/lock snapshot and publishes the output to `package.json` and the lockfile only when both still equal that snapshot; a concurrent change returns `revision-conflict` with nothing published. Decline restores only from complete, hash-verified before-images over the verified resolver output.
- Refused before any process runs (`capability-missing`, exit 2): Yarn or competing lockfiles, a root `.npmrc` (checked by presence only, never read or copied), `pnpm-workspace.yaml`, pnpm resolver hooks, npm workspaces, local/link/workspace sources in the manifest or lockfile, pnpm patched dependencies and invalid manifest/lock text. Confirmation rechecks the manager layout and configuration and holds the preview (exit 3) if either changed.
- Move the pure admission, preview-text and file-comparison logic into `core/dependency-admission.ts`; no message, exit code or behavior changed by the move. Central production usage is 248,116 characters (enforced ceiling 248,256; approved 247,219 unchanged and still exceeded, as before). No budget changed.
- Known limitation, not claimed fixed: a race with an external writer between final validation and the two project writes.
- Files: `packages/kernel/src/core/dependency-admission.ts` (new), `decisions/dependency.ts`, `dependency-start.ts`, `dependency-job.ts`, `verbs/recover-effects.ts`, `adapters/project-fs.ts` (stat-only `exists`), `adapters/store-fs.ts` (`readArtifact`), `ports/types.ts`, `specs/tech-spec.md` §9.11, `specs/ux-spec.md` J-11. Tests: `dependency.test.ts`, `project-boundary.test.ts`, `store-boundary.test.ts` (113 focused pass).
- Local validation: typecheck, all lints, coverage, build, payload and reproducibility pass; 1,702/1,707 tests passed in the full run on a heavily loaded machine, and the four timed-out golden/hidden-refusal/integrate files then passed 84/84 alone. Built UAT on a scratch repository: `.npmrc`, Yarn, `file:` spec and missing-quote refusals; a real npm resolve of `is-number@7.0.0`, decline restore, a held confirm after `.npmrc` appeared, and install. An identical retry after the hold returns the recorded `historical` response until `--again` is passed (existing pipeline behavior). pnpm was not driven on the real CLI.
## 2026-11-05 — Reconcile preview status with current source evidence

- Record the approved immediate planning target as a controlled developer preview from existing main, not public R1 or activation of the separate schema-2 candidate. Installed-host, safety and distribution gates remain open; no public release is authorized.
- Replace obsolete current-status CI references with exact-source run `41977194444` at `14aa0f71a5970c708e62423b44d5a06b81a93c94`: Linux/macOS full CI and built UAT on current/minimum Node, plus Windows portability only. Distinguish deterministic evidence from installed-host qualification and retain the earlier audits as historical records.
- Correct the interrupted-dependency-recovery warning: unknown content is preserved and dependent work fenced. Keep the separate live resolution-failure restoration caveat explicit; no general preservation guarantee is claimed.
- Retain the unresolved production-capacity decision: central usage is 248,083 against the prior approved 247,219 ceiling; the enforced 248,256 ceiling remains proposed, not approved. No threshold changed.
- Files: `README.md`, `docs/user/qualified-tuple.md`, local `specs/plan.md`, `CHANGELOG.md`. No runtime or shipped plugin behavior changed. Validation: typecheck, lints, coverage, bundle/payload and reproducibility checks pass, as do 365 Windows-selected tests, 46 boundary controls (including seven interrupted-resolution preservation controls), seven receipt-privacy controls and four README/release-checklist checks. The R1 audit still refuses all 181 unqualified Musts.

## 2026-11-04 — Wait for browser focus before keyboard input

- Source `7134b9c` passes Ubuntu full CI and both-runtime built UAT plus Windows portability; macOS's sole failure is the loan-desk keyboard focus scenario. Reproduce the initial Email focus failure on the real app with delayed heading focus.
- Wait for the initial and reloaded heading's actual focus before sending Tab. Retain visibility, validation, authentication, error-focus and input-preservation assertions; keep the delayed-focus regression in the existing browser test. No production UI, rate-limit or store behavior changes.
- Advance recipe 0.4.7 to 0.4.8 for the changed shipped test content; dependency lock pin is unchanged. Files: starter `server/test/e2e/auth-browser.e2e.spec.ts`, `recipe.json`, `packages/kernel/test/starter.test.ts`.
- Local typecheck, all lints, build, payload, reproducibility and lock-pin regression pass. Two fresh application runs each pass typecheck, 178 Vitest cases and all 16 real browser scenarios. A separate shared-server repeat experiment failed through reused state/rate limits; those protections were not relaxed. Final exact-source CI remains pending.

## 2026-11-04 — Lock concurrent test observations

- The `dde2bf2` CI run passes macOS full CI and built UAT on Node 24 and 22.12.0, plus Windows portability. Ubuntu passes 1,695/1,696 tests; the sole failure is an unlocked `runningCheck` test observation racing a journal append.
- Read the check observation through the existing store transaction and await asynchronous polling predicates. Update the two caller type annotations to the resolved observation type. Keep production bounded-read refusals, locking and all process/signal assertions unchanged.
- Files: `packages/kernel/test/support/fixture.ts`, `scenarios.test.ts`, `execution-envelope.test.ts`, `filter-jobs.test.ts`. Two red-first observer regressions, typecheck and all lints pass locally; final supported-POSIX validation remains pending.

## 2026-11-04 — Keep archives and noncanonical specs local

- Ignore the entire `.archive/` directory and every file under `specs/` except `PRD.md`, `tech-spec.md` and `ux-spec.md`. Remove previously tracked local-only files from current main without deleting their local copies.
- The owner selected current-main removal, not a history rewrite: earlier GitHub commits retain the published files. Document the local-only boundary for contributors and agents, and the local plan requirement of the candidate release-notes draft tool.
- Files: `.gitignore`, `.gitattributes`, `.github/copilot-instructions.md`, `README.md`, `CONTRIBUTING.md`, `packages/kernel/test/privacy.test.ts`; archived source and noncanonical specs removed from the Git index. Add a red-first regression for archive/spec ignore rules and the exact canonical allowlist.
- Consolidation follow-through: repaired-source CI passes Windows and 1,693/1,694 tests on each POSIX runner; the sole failure is a stale golden loan-desk suite count (148 executed, 147 expected). Correct that exact-count assertion in `packages/kernel/test/golden-task-loan-desk.test.ts`; all receipt/status assertions remain unchanged.
- The next run exposed stale loan-desk migration/restore fixtures overwriting current starter safety tests. Synchronize both fixtures with the starter, retaining only their loan-schema expectations; add a red-first preservation regression so future drift fails directly. The actual overlaid application typecheck and all 178 Vitest cases pass locally. Expect the full 178-case population in the kernel golden journey; do not waive reviewer attention or weaken production checks.

## 2026-11-04 — Consolidate reviewed repairs and preserve nonshipping work

- Integrate the implementation-audit repairs, including repeated detection, reviewer packet/admission follow-through, receipt privacy, candidate identity, starter migration/restore safety, and read-only interrupted dependency recovery. Normal dependency rollback safety and the unsigned finding-lifecycle routes remain open.
- Preserve seven dirty-worktree snapshots and three unmerged candidate branches under `.archive/consolidation/2026-11-04`, outside runtime, payload and tests. The owner selected preservation rather than runtime promotion. Ignore local environment credential files while retaining `.env.example`.
- Merge current mechanism documentation without replacing existing spec decisions. No new schema activation, size-limit approval, host qualification or release.
- Files: `packages/`, `plugin/`, `tools/privacy-check.ts`, `tools/payload-files.json`, `.github/workflows/untrusted.yml`, `.gitignore`, `README.md`, `specs/`, `docs/audits/2026-11-04/`, `.archive/consolidation/2026-11-04/`.
- Validation so far: static/artifact gates and 276 supported Windows pure/privacy tests pass. Full supported-POSIX CI and built UAT remain pending at this checkpoint.
- Merge compatible starter cookie and typescript-eslint updates; starter types/lint and 145 tests pass. Preserve both TypeScript 7 updates, ESLint 10 and Node 26 types after owner disposition of compatibility failures. Record full indexed/history privacy checks and reviewed false positives in `docs/audits/2026-11-04/consolidation-validation.json`.
- First published CI exposed stale NOTICE/recipe-lock metadata and incomplete demo/trace fixtures. Refresh both notices, advance the pinned recipe to 0.4.7, supply npm provenance, compare independent fixture IDs by their example meaning, distinguish check questions from receipt outcomes, and trigger journal compaction. Add a direct stamp regression; no demo/trace/store product rule changes. Preserve two newer Dependabot revisions when the deletion lease detects their changed heads.
- Complete verified cleanup of 27 additional worktrees, 31 local branches and all six remote dependency branches after publication and preservation. Repaired-source full-index privacy scans cover 925 files; 21 outgoing commits have no Gitleaks findings. Reviewed indexed matches remain evidence hashes and synthetic fixtures, not identified real secrets or PII.

## 2026-11-04 — Revise the NFR-07, QLT-05 and QLT-13 draft specs to answer the independent review

- Revise `specs/diagnostics-export.md`, `specs/workload-receipt.md` and `specs/trait-threat-data.md`; each stays "draft, revised, unreviewed" and needs a second independent review before sign-off. Append a dispositions table to each of the three review files: 53 findings, 38 Accepted, 15 Accepted-with-owner-question, 0 Rejected, 0 Deferred.
- Diagnostics: claims narrowed to a table of what the kernel enforces and what is cooperative; preview cap 16 KiB (was 256 KB); `export` is Consequential; recovery never fences; four outside-the-project port methods costed; the OpenTelemetry attribute list withdrawn (deferred, Q1). Workload: obligation derived from the recipe record, not a file; measurements stated as project-produced; uncovered harness reasons become `fail`; strict trend rule with a declared floor; series append atomic with `finish`; migration, budget and consumer lists. Threat note: link rule in the code's terms; constraints disclosed as unchecked; late-trait conflict with `trait-detection.md` §5 item 8 stated; `INTENT.md` disclosure and trait-lowering authority raised as owner questions.
- `plugin/skills/tenet-review/resources/threat-note.md`: one sentence of link wording corrected (an invariant is linked through a child example). The resource is still **unreferenced and unsigned**, and its payload line was added before sign-off (commit `46e7d16`); a release that ships it must disclose the changed content (LFC-02).
- Three spec defects logged in `specs/plan.md` §12.3; capacity figures corrected (central 147 free against the proposed, not approved, ceiling; over the approved ceiling by 890; `core/schemas.ts` 463 free). Owner questions are consolidated in the plan §13 entry.
- Files: `specs/diagnostics-export.md`, `specs/workload-receipt.md`, `specs/trait-threat-data.md`, `specs/reviews/` (3 files), `plugin/skills/tenet-review/resources/threat-note.md`, `specs/plan.md`, `CHANGELOG.md`. Tests: none added; no kernel source changed. R1 mapping unchanged.
## 2026-11-03 — Independent review of the NFR-07, QLT-05 and QLT-13 draft specs

- Add `specs/reviews/diagnostics-export-review.md`, `specs/reviews/workload-receipt-review.md` and `specs/reviews/trait-threat-data-review.md`: numbered findings with severity, evidence and a suggested fix, and a verdict for each draft. All three need revision. 53 findings: 1 Blocker, 31 Major, 21 Minor.
- The draft specs were not edited and no source or test changed. R1 mapping unchanged.
- Files: `specs/reviews/` (3 new), `specs/plan.md`, `CHANGELOG.md`. Tests: none added.
## 2026-11-03 — Release-notes tool and release workflow candidates (LFC-02, ENG-07)

- Add `tools/release-notes.ts`: drafts release notes from repository facts (changed paths per disclosure item, R1 mapping, open gates, known limits) and `--check` fails while a section lacks a written statement. Notes location assumed to be `docs/release/notes/v<version>.md`; the specs leave it open.
- Add `.github/workflows/release.yml` (candidate, never run): version-tag trigger, protected-branch and signed-tag gate, build, `verify:payload`, `verify:reproducible`, build-provenance attestation, attestation check, draft release. Add `docs/release/release-verification.md` with the manual installed-payload steps. Signing, attestation and branch protection are unobserved; ENG-07 stays unmapped.
- `ci-security.test.ts` scopes its untrusted-tier checks to `untrusted.yml`; action pinning still covers every workflow. R1 mapping 139/16/26 to 140/16/25 (`[LFC-02]`).
- Files: `tools/release-notes.ts`, `.github/workflows/release.yml`, `docs/release/release-verification.md`, `packages/kernel/test/` (release-notes, release-workflow, ci-security), `specs/plan.md`, `CHANGELOG.md`. Tests: 4 + 7 new; no kernel source changed.
## 2026-11-03 — Add the NFR-01 benchmark harness and the ENG-08 experiment tool (candidate branch)

- Add generated reference fixtures (small, large, long-history) and `tools/bench.ts`, which gives every PRD §4.4.3 budget a status: measured (non-win32 only), delegated to lint, or not measurable with the reason. A win32 run reports `unobservable`. No kernel latency has been measured yet.
- Add `tools/experiment.ts` with a manifest schema (`eval/experiments/manifest.schema.json`): allowlist per tech-spec §17.8, trial and cost records, a holdout rule and the PRD §6.10.1 disposition. The allowlist omits PRD §6.10.1's configuration surface; logged in plan §12.3 as an owner decision. No model is run.
- R1 mapping unchanged (139 / 16 / 26): neither requirement is proven yet, so no tag was added.
- Files: `tools/bench.ts`, `tools/bench-fixtures.ts`, `tools/experiment.ts`, `eval/experiments/manifest.schema.json`, `package.json` (two scripts), `packages/kernel/test/bench.test.ts`, `packages/kernel/test/experiment.test.ts`, `specs/plan.md`, `CHANGELOG.md`.
- Tests: 10 bench and 24 experiment tests pass locally on Windows (Node 24.22.1); the real kernel sequence is unobserved.
## 2026-11-03 — Draft specs for NFR-07, QLT-05 and QLT-13

- Add three feature specs, each marked "draft, unreviewed": diagnostics export (previewed, redacted, saved to a chosen path; OpenTelemetry mapping), workload obligation and fitness-trend attention, and the threat and data note. Each lists owner questions and the estimated central-code cost; none fits the current ceiling. They are not canonical specs and change no behavior.
- Add the review resource `threat-note.md` named in Tech Spec §5.1 and list it in the payload inventory. Nothing references it yet.
- Record five spec defects in `specs/plan.md` §12.3. R1 mapping is unchanged (139 mapped, 16 host-only, 26 unmapped).
- Files: `specs/diagnostics-export.md`, `specs/workload-receipt.md`, `specs/trait-threat-data.md`, `specs/plan.md`, `plugin/skills/tenet-review/resources/threat-note.md`, `tools/payload-files.json`.
- Tests: none added or changed. `typecheck`, `lint-arch`, `lint-skills`, `lint-quality` and `coverage` pass on Windows.
## 2026-11-03 — Fit the held ENG-09 and RES-05 candidates under a proposed central ceiling

- Merge the ENG-09 journal call record (`core/trace.ts`) and the RES-05 RD-1/RD-2 demo slice (`core/demo.ts`) onto one branch; both merges were clean. Together the central owner (`pipeline + verbs + decisions`) measures **248,109** characters against the approved 247,219, so 890 over.
- **Proposed, not owner-approved:** raise that one budget from 4,292 to **4,310 lines** (+18, 0.42%; 248,256 characters, 147 free), following decision-packet decision 1, recommendation A. Edited `tools/lint-quality.ts` and tech-spec §6.2 consistently; `tools/quality-baseline.json` is unchanged because the owner is within its budget, so no module ceiling is recorded. No other owner exceeded its limit, so no other limit moved. The bundle is 772 KB of the unchanged 800 KB cap (§3.2 untouched). The exact approved figure needs a later owner decision; if a different number is approved, this one is replaced.
- Files: `tools/lint-quality.ts`, `specs/tech-spec.md`, `specs/plan.md`, `CHANGELOG.md`, plus the merged ENG-09 and RES-05 files.
## 2026-11-03 — Make the Windows test stage end

- `npm test` on Windows ran about 18 minutes and never finished. Three test files never ended because a spawned child outlived a failed assertion that ran before the test's cleanup (`runner-ownership`, `forget-recovery`, `filter-jobs`): Windows has no `ps -o lstart=` process identity and `process.kill(-pid)` throws.
- Add `NO_POSIX_PROCESSES` to the test helpers (a skip reason on `win32`, `false` elsewhere) and skip the 11 affected tests with it. No assertion changed, nothing is skipped on Linux or macOS, and no kernel source changed.
- Windows full `npm test` now ends in 22.2 minutes: 1462 tests, 825 pass, 625 fail, 12 skipped (the 11 above and one test that needs a build). The failures are the known `win32` mutation refusal and other Windows differences; they are not hidden.
- Files: `packages/kernel/test/helpers.ts`, `runner-ownership.test.ts`, `forget-recovery.test.ts`, `filter-jobs.test.ts`, `specs/plan.md` (§12.3, §13), `CHANGELOG.md`.

## 2026-11-03 — Integrate decision-packet build lanes

- Apply the document amendments for decisions 3A, 4b-A, 7A, 8A, 9B and 10A and the binary byte unit (owner blanket direction; no Should signed). `publish` is cut from R1; trailer names are fixed; only active time is extendable.
- Implement the 11 Should "implement" rows as text and evidence: README policy-recovery note, coordinator and build skill steps, `[INS-08]` and `[GIT-07]` tests.
- Add the pure, unwired QLT-11 trait core (`core/traits.ts`, 43 tests), the reason-code tests and audit, the unmapped-Must classification, the decision packet and the external-request drafts.
- Not merged: the ENG-09 journal record (245 characters over the central ceiling) and the RES-05 demo slice (608 over) stay on branches pending the capacity decision.
- Files: `specs/` (PRD, tech-spec, ux-spec, plan and feature specs), `plugin/`, `README.md`, `packages/kernel/src/core/traits.ts`, `packages/kernel/test/` (traits, reason-codes, starter-ci, readme), `docs/`.

## 2026-11-03 — Pin line endings to LF

- Add `.gitattributes` (`* text=auto eol=lf`, common binary types) so Windows checkouts no longer carry CRLF that breaks tests reading repository files. Both QLT-16 tests pass after conversion; the full suite needs supported POSIX CI because mutation is refused on `win32`.
- Record the independent completion audit in `specs/plan.md` (dashboard summary, §12.3 row, §13 entry).
- Files: `.gitattributes`, `specs/plan.md`, `CHANGELOG.md`.

## 2026-11-03 — Verify source-generated schema-1 capture

- Run [41547683311](https://github.com/vedprakash-m/tenet/actions/runs/41547683311) produced a complete capture: 123 hashed store files, all ten effect kinds, cached responses, backup recovery and interrupted intent. The archive SHA-256 is `2f3b7979afd871eb83a058b9200c65d44762f6554cfc41fc9ec190f5963c81e5`; producer source/runtime paths match frozen candidate `84730f9`. The dependency effect uses a simulated runner with the actual pipeline and journal.
- Ubuntu full CI, capture, built UAT and Windows portability pass. The overall run is red because macOS full CI fails on a starter browser-focus assertion and a host CLI timeout `kill EPERM`; this failure is recorded separately from the successful capture.
- Files: `specs/plan.md`, `specs/protocol-prototype.md`, `CHANGELOG.md`.

## 2026-11-03 — Defer version-probe process-group cleanup

- After the failed macOS job was rerun, it reproduced `kill EPERM` from the unconditional process-group signal on the version-probe child exit. Defer that signal for 10 ms and send it only while output streams remain open, consistent with the existing guarded cleanup path.
- Exact-source run [41558087675](https://github.com/vedprakash-m/tenet/actions/runs/41558087675) for `05d055f` passes Ubuntu/macOS full CI and built UAT plus Windows portability. The macOS version-probe timeout test passes; local typecheck and all lints also pass.
- Files: `tools/host/copilot-cli.ts`, `specs/plan.md`, `CHANGELOG.md`.

## 2026-11-02 — Add a one-shot POSIX legacy-record capture harness

- Add a test-only CI path that captures actual schema-1 store records from real pipeline tests, hashes the captured files and requires all ten current journal effect kinds, cached response state, backup recovery and an interrupted effect. The dependency case is explicitly identified as using a simulated runner.
- Exact-source run [41537883711](https://github.com/vedprakash-m/tenet/actions/runs/41537883711) passes full Ubuntu/macOS CI, built UAT on both supported Node versions, and Windows portability. Its capture step was skipped because the one-shot commit marker was missing. Marked run [41543195281](https://github.com/vedprakash-m/tenet/actions/runs/41543195281) passed all selected tests but packaging failed because `HEAD^` was absent from the shallow checkout. Commit `b22499e` resolves the source identity from the push base and fetches that single commit; the corrected run's verified result is recorded in the 2026-11-03 entry above.
- Files: `.github/workflows/untrusted.yml`, `packages/kernel/test/helpers.ts`, related recovery/workflow tests, `tools/protocol-legacy-capture.mjs`, `specs/plan.md`, `specs/protocol-prototype.md`.

## 2026-11-02 — Record protocol candidate capture blockers

- The isolated frozen source and bundle pass baseline lint/build checks, but real schema-1 record capture is blocked because the kernel correctly refuses mutation on Windows and WSL has no installed distribution. Five controls confirm refusal only; no legacy producer records were generated.
- Current source has ten journal effect kinds, including `hardening`, while `schema-migration.md` §18.1 listed nine and said eight SETTLE keys. The owner selected inclusion of the exact hardening op/result variant; the proposed strict decoder row is documented, with integrated independent review and real producer fixtures still required.
- Files: `specs/plan.md`, `specs/protocol-prototype.md`, `specs/protocol-capacity.md`, `specs/fixed-budget-simplification.md`, `CHANGELOG.md`.

## 2026-11-02 — Add proposed hardening effect to migration inventory

- Add the owner-selected hardening journal variant to the inactive finite schema-2 decoder proposal, including its exact source op/result shape and external-file/no-store-edge classification.
- The runtime remains unchanged; source-generated fixtures and integrated independent review remain prerequisites. Candidate record capture is still blocked on an authorized supported-POSIX execution route.
- Files: `specs/schema-migration.md`, `specs/plan.md`, `specs/protocol-prototype.md`, `CHANGELOG.md`.

## 2026-11-02 — Validate process cleanup and SQLite retry test fixes

- Exact-source GitHub Actions run [41516188207](https://github.com/vedprakash-m/tenet/actions/runs/41516188207) at `5c965572576a88aea35042a68b5176b3bbc3fda7` passes Ubuntu full CI/built UAT, macOS full CI/built UAT, and Windows portability.
- The stream-aware process-group re-signal passes the previously failing macOS host timeout test; the starter auth-freshness tests and full loan-desk golden task also pass on both supported POSIX runners. Existing failure histories remain unchanged, and no host qualification or full-plan completion is claimed.
- Local typecheck, lints, M0 coverage, build, payload verification and same-toolchain reproducibility pass.
- Files: `tools/host/copilot-cli.ts`; starter and golden SQLite test fixtures; `specs/plan.md`.

## 2026-11-02 — Defer host re-signal until stream state settles (local candidate)

- Run [41390356159](https://github.com/vedprakash-m/tenet/actions/runs/41390356159) passes Ubuntu full CI/built UAT and Windows portability; macOS passes the SQLite contention journeys and fails only the host CLI timeout test with `kill EPERM` from a post-exit process-group re-signal.
- After a stopped/timed-out leader exits, wait 10 ms and re-signal only while stdout or stderr remains open; cancel the pending signal on child `close`. This retains cleanup for descendants holding the pipes without signaling a group whose streams already closed. Signal errors remain visible; assertions and production SQLite behavior do not change.
- Typecheck, lints, M0 coverage and whitespace checks pass. POSIX process tests cannot run on the Windows host (extensionless shell fixtures); WSL has no distribution installed. This change is uncommitted pending owner approval to publish for exact-source CI.
- Files: `tools/host/copilot-cli.ts`, `specs/plan.md`.

## 2026-11-02 — Record SQLite retry improvements and remaining macOS signal failure

- Exact-source run [41390356159](https://github.com/vedprakash-m/tenet/actions/runs/41390356159) passes Ubuntu full CI/built UAT and Windows portability. On macOS, the auth-freshness suite and complete loan-desk golden task pass; the full run reports 1,405/1,406 tests.
- The only failure is `host-cli.test.ts:28`: `kill EPERM` from `process.kill(-child.pid, "SIGKILL")` in the exit-handler re-signal at `tools/host/copilot-cli.ts:137`. That second signal exists to catch descendants racing the first group signal. Do not mask the error or relax timeout/signal assertions; the process-group fix remains undecided pending owner direction.
- The SQLite busy-timeout changes are test-only, retain real locks and assertions, and leave the production retry deadline unchanged. This CI run shows both affected journeys passing, without proving root cause or future stability.
- Files: process-cleanup investigation in `tools/host/copilot-cli.ts` and `packages/kernel/test/host-cli.test.ts`; `specs/plan.md`.

## 2026-11-02 — Narrow starter auth-freshness busy waits (local candidate)

- Run [41387472377](https://github.com/vedprakash-m/tenet/actions/runs/41387472377) passes Ubuntu CI/built UAT and Windows portability but macOS stops at the starter scaffold check: `OB-suite` is qualified flaky despite 105/105 passing on its final attempt. The earlier failed assertion is not present in the retained receipt. The golden task stops before writing the loan-desk fixture, so the fixture-only change from the prior entry is not exercised by this run; run [41384392664](https://github.com/vedprakash-m/tenet/actions/runs/41384392664) had reached it and recorded two 503 authority-recheck failures.
- In the starter's real-busy auth-freshness test only, set the service connection's SQLite busy timeout to 1 ms before the held-writer request. This retains the real SQLite lock and application retry while avoiding the connection driver's 250 ms wait; production behavior and assertions are unchanged.
- In a scratch starter, all 12 auth-freshness cases pass in five consecutive runs (60/60); template typecheck passes. The root integration cannot run on this Windows host because mutating work is intentionally refused. This candidate remains local pending separate publication approval; no cause or hosted fix is claimed.
- Files: `plugin/skills/tenet-starter-ts-web-api/template/server/test/auth-freshness.test.ts`, `specs/plan.md`.

## 2026-11-02 — Isolate QLT-12 retry timing in the golden fixture

- Exact-source hosted run [41384392664](https://github.com/vedprakash-m/tenet/actions/runs/41384392664) passes Ubuntu CI/built UAT and Windows portability but still fails macOS: two final-attempt held-writer authority-recheck cases return 503 instead of 401/403. The earlier reduction to two outer test files did not eliminate the failure.
- In the loan-authority fixture only, shorten the service connection's SQLite busy timeout to 1 ms before holding a real writer lock. This lets the test exercise `writeTx`'s application retry without spending its one-second deadline in repeated 250 ms driver waits; production settings, real-lock setup, authority assertions and evidence rules are unchanged.
- In a scratch scaffold, all five authority cases pass in five consecutive runs (25/25). The root golden integration is not runnable on this Windows host because the kernel rejects mutating work by design. The owner approved committing the fixture test, then its plan/changelog record, and pushing for exact-source GitHub CI. That validation is pending; no macOS fix is claimed.
- Files: `packages/kernel/test/fixtures/golden-tasks/loan-desk/server/test/loan-authority.test.ts.txt`, `specs/plan.md`.

## 2026-11-02 — Reduce nested CI test contention

- After two exact-source macOS runs classified the starter's real SQLite contention suite as flaky, reduce the outer Node test-file concurrency from four to two. This is a bounded diagnostic to reduce overlapping integration workloads; it does not change test assertions, app retry deadlines, or flaky-evidence handling.
- Local Node 24.22.1 validation passes the focused 14-test report-path suite, typecheck, all lints, M0 coverage, build, payload verification and same-toolchain reproducibility (94 payload files, 766 KB bundle). Exact-source hosted CI at concurrency two is pending; no full CI pass is claimed.
- Files: `package.json`, `specs/plan.md`, `CHANGELOG.md`.

## 2026-11-02 — Repair report identities, offline projections and build-input integrity

- Canonicalize Vitest, Playwright, ESLint and TypeScript report identities, reject directory/parent/cross-drive identities, and accept real CRLF compiler populations. Advance to `node-ts@20`; older normalization evidence stays stale.
- Preserve exceeded/unknown wall budgets in Markdown/JUnit, include false positives at severities absent from seeded truth in review precision, and explicitly list missing first attempts despite passing retries. Snapshot installed esbuild loader/platform compiler bytes during reproducibility checks.
- Add 18 red-first tests and include report/receipt regressions in Windows CI on both runtime versions, plus pure static regression selection. All 367 selected Windows-compatible checks pass on Node24.22.1 and Node22.12.0; a retained walkthrough passes fifteen built/offline CLI calls on each runtime. Real installed-compiler pass/fail CRLF output also passes on Node24. Full supported-POSIX CI/mutating UAT remains pending, not inherited from the earlier green base.
- Files: kernel adapters and `report-paths.test.ts`; evaluator report and tests; reproducibility tool/test; `.github/workflows/untrusted.yml`; `CONTRIBUTING.md`; technical/harness specs; `specs/plan.md`; dated validation record. Fixed budgets, mapping, qualification and release gates are unchanged.

## 2026-11-01 — Enforce offline input and assertion-proof boundaries

- Reject malformed UTF-8 in referenced fixture/grader bytes even with matching hashes; preserve exact-byte identities. Reject replay child/tool start-ID collisions in either source order.
- Recognize bounded quoted JSON credential assignments so structured proposals refuse before persisting likely secrets. Public built CLI controls preserve state/backup/journal on Node26/22; ordinary placeholders remain usable. This remains a heuristic.
- Reject executed assertions under skipped/pending Vitest files. Anchor Vitest/Playwright assertion diagnostics so native runtime errors cannot establish assertion-only baseline red; enforce the 2,000-character bound on every Vitest diagnostic; advance to `node-ts@18`, leaving earlier evidence stale.
- Add exact replay byte/event/multibyte bounds and inert-data process/network/write effect traps. All 119 focused Node22 checks and independent review pass; integrated CI/general UAT are in progress. No capacity, native campaign or qualification gate is closed.

## 2026-11-01 — Complete the public R1 golden-task catalog

- Add twenty public tasks for the exact thirty-task PRD mix, including staged-human continuity and Python/Go source inspection. All thirty validate offline with 122 controls and deterministic repeated grading; the original Alpha ten remain pinned.
- Add `--r1` catalog preflight, reject conflicting selectors, validate staged dirty paths, preserve unrelated staging during selective control commits, and normalize task directory identity with the native path API. Independent validator review and four focused controls pass.
- Correct one shortcut control’s behavior without changing its expected failures; document five synthetic reserved-domain privacy false positives without weakening normalization cases. Final integrated CI passes **1,367 tests / 209 suites**; minimum Node22 R1 validation passes all thirty tasks. Probe diagnostics normalize only known workdir prefixes, with three red-first controls; other origins remain untrusted. No reserved tasks, agent/model/native runs or qualification claim.

## 2026-11-01 — Continue evidence, cleanup and bounded-source implementation

- Preserve complete failure kinds across Vitest/Playwright diagnostics and tagged results, classify diagnostic first lines, and reject whole-run exit contradictions outside selected tests. Reject contradictory supplied Vitest total populations; advance to `node-ts@15` to invalidate earlier local normalization evidence.
- Protect active run/focused-review/child-packet temp files from both cleanup scopes. Add the independently reviewed bounded source-reader API with strict UTF-8, typed refusals and exact caller allocation limits; preserve legacy readers.
- Record actual synthetic Playwright attachment shape and the owner’s five-current-screenshots policy. Capture retirement/result/schema activation remain separately gated. Final integrated CI passes **1,367/209**, minimum Node22 focused runtime checks **100/100**, and built CLI UAT **152 observations each on Node26/22**. Exact identities are in the dated continuation validation record.

## 2026-11-01 — Develop and review the RES-05 kernel proposal contract

- Record the owner-selected kernel-validated proposal direction and draft the bounded input/result, command/cwd, example, screenshot provenance, retention and finish-replay contract in `specs/result-demo-path.md` §§9–17.
- Disposition three independent review findings and confirm the revised cwd, source-reader and issuing-generation boundaries. Update the plan; owner implementation decisions, compatibility, capture/retirement mechanics and complete capacity remain open.
- Documentation only; runtime source hashes remain unchanged. No new RES-05 implementation, passing test, mapping, native observation or qualification is claimed.

## 2026-11-01 — Audit main and repair evidence/configuration boundaries (uncommitted)

- Add a dated implementation review, dependency-ordered completion plan and generated 200-requirement inventory; correct stale current HEAD and cumulative Alpha/Beta counts in `specs/plan.md`. Preserve existing commits and inherited prototypes; all new work stays on `main`.
- Reject passed Vitest assertions with failure messages and unusable report file identities; advance the adapter to `node-ts@13` so old normalization evidence is not reused. Reject invalid-scope configuration reset before it can remove project overrides. Require a Git blob for frozen campaign protocols instead of accepting a directory.
- Five behavior defects have failing-first controls, including the final reproduction of truthy nonboolean reset markers deleting overrides. Only literal `true` triggers reset; strict proposal-envelope design remains gated. Independent final review found no actionable runtime regression; focused receipts/settings/coverage controls pass. Final local CI passes **1,314 tests / 207 suites**, 81 minimum-runtime focused checks pass, and final built reset UAT passes on Node26/22. Full general CLI UAT passed on both runtimes before the final marker follow-up; exact artifact scopes are retained in the dated validation record. Fixed budgets and qualification gates remain unchanged.
- Files: `packages/kernel/src/adapters/node-ts.ts`, `packages/kernel/src/decisions/simple.ts`, their regression tests, `tools/coverage.ts`, `packages/kernel/test/coverage.test.ts`, `docs/audits/2026-11-01/`, `specs/plan.md`, `CHANGELOG.md`.

## 2026-11-01 — Check and commit accumulated implementation work

- Commit accumulated implementation, tests, starter payload, tooling and evidence as `e9f3f1e`; specs and progress follow separately. All staged added-line privacy checks pass after documenting two redaction-sentinel false positives.
- Full prepublication CI passes **1,308 tests / 207 suites** and rebuilt CLI UAT passes. Push is withheld because the first commit acquired automatic local-machine identity metadata; identity-only amendment awaits explicit approval. No hosted CI or release qualification is claimed.

## 2026-11-01 — Refuse passed Playwright results carrying errors (uncommitted)

- Reject a passed execution with nonempty errors, including an empty error message; preserve explicit empty errors as valid. Reuse the existing contradiction diagnostic and the unpublished adapter-version-12 repair batch.
- Red-first regression and all 15 focused adapter tests pass. Full local CI passes **1,308 tests / 207 suites**; rebuilt CLI UAT passes. Report fixtures are not live Playwright qualification.
- Files: `packages/kernel/src/adapters/playwright.ts`, `packages/kernel/test/playwright-adapter.test.ts`, `specs/plan.md`, `CHANGELOG.md`.

## 2026-11-01 — Refuse contradictory Playwright skip expectations (uncommitted)

- Reject a report that marks a test expected-skipped but claims it passed, even when aggregate counts agree. Emit the existing contradiction diagnostic and no normalized population; preserve genuine skipped reports as skipped, not executed.
- Advance the Node adapter identity to `node-ts@12` so prior normalization evidence is not reused under repaired semantics. Existing version reconciliation remains required; receipts are not relabeled.
- Red-first contradiction/version controls and a valid-skip control pass. Full local CI passes **1,307 tests / 207 suites** and rebuilt CLI UAT passes; fixed budgets are unchanged.
- Files: `packages/kernel/src/adapters/playwright.ts`, `packages/kernel/src/adapters/node-ts.ts`, `packages/kernel/test/playwright-adapter.test.ts`, `specs/plan.md`, `CHANGELOG.md`.

## 2026-11-01 — Verify exact active-time admission boundary (uncommitted)

- Add a real-repository WRK-08 regression: a candidate check launches one millisecond below the Quick limit, then is refused at exactly 15 active minutes including the gap after the successful call. Refusal preserves counters and launches no check.
- Four focused active-time controls pass; final combined CI passes **1,307 tests / 207 suites**, and rebuilt CLI UAT passes. Runtime behavior and time-accounting policy are unchanged; provider/tool/network waiting-time separation remains open.
- Files: `packages/kernel/test/active-time.test.ts`, `specs/plan.md`, `CHANGELOG.md`.

## 2026-11-01 — Bind check identity to the pinned contract base (uncommitted)

- Repair the `[EVD-01, EVD-03]` identity omission reproduced with a real repository: identical candidate files under different contract bases no longer share a check ID. Later HEAD commits do not change the pinned base or content digest; earlier receipts retain their recorded IDs.
- Preserve obligation projection fields/order and identity length; fixed source budgets remain unchanged. Full local `npm run ci` passes **1,304 tests / 207 suites**; rebuilt CLI UAT passes. This is not configuration/cache/migration protocol closure or semantic qualification.
- Files: `packages/kernel/src/verbs/facts.ts`, `packages/kernel/test/audit-regressions.test.ts`, `specs/plan.md`, `CHANGELOG.md`.

## 2026-11-01 — Verify acceptance cannot promote check evidence (uncommitted)

- Add a real-repository `[EVD-06]` workflow regression for owner acceptance with missing candidate checks and with failed candidate checks. Acceptance leaves receipts, verdict endpoint and blocking reasons unchanged.
- Full local `npm run ci` passes **1,303 tests / 207 suites**; built CLI UAT passes. Runtime behavior is unchanged; no semantic ledger disposition or qualification is assigned.
- Files: `packages/kernel/test/workflows.test.ts`, `specs/plan.md`, `CHANGELOG.md`.

## 2026-10-31 — Refuse conflicting Vitest JSON reporter settings (uncommitted)

- Before launching a check, refuse a Vitest/Vite config that redirects the JSON reporter output away from the adapter's private report file; also refuse reporter declarations the bounded source inspection cannot verify.
- Add two `[TQ-10]` real-runner regressions. Full `npm run ci` passes, including **1,301 tests / 207 suites**; the built bundle refuses an opaque reporter config with no receipt or project output.
- The source inspection is not a full JavaScript config parser. This is a narrow adapter guard, not SP-10 qualification or a Phase A mapping; Vitest/Jest/Playwright/ESLint/tsc qualification remains open.
- Files: `packages/kernel/src/adapters/node-ts.ts`, `packages/kernel/src/ports/types.ts`, `packages/kernel/src/verbs/check.ts`, `packages/kernel/test/static-conformance.test.ts`, `specs/plan.md`.

## 2026-10-31 — Distinguish shotgun surgery in reviewer guidance (uncommitted)

- Match the Stage B reviewer wording to Tech Spec §8.7 by separating shotgun surgery from blast radius; add a focused regression in `packages/kernel/test/prerequisite-guidance.test.ts`.
- Full local `npm run ci` passes, including all 1,299 tests across 207 suites. This closes one Beta checklist item; it does not change requirement mapping or qualification.
- Files: `plugin/skills/tenet-review/SKILL.md`, `packages/kernel/test/prerequisite-guidance.test.ts`, `specs/plan.md`.

## 2026-10-31 — Audit QLT-11 implementation boundary (uncommitted)

- Trace the existing trait field through state, risk assessment and tests. The code only stores/consumes caller-supplied project traits; no trait registry, project/change inference, user correction workflow or missed-trait review path exists.
- Record the unresolved inference, correction-binding and review-discovery contract in `specs/plan.md`; do not implement or map partial behavior without the owner's decision. R1 remains 139/181 mapped, 16 host-only and 26 unmapped.

## 2026-10-31 — Re-audit the remaining Phase A mappings (uncommitted)

- Run three disjoint read-only reviews of the 26 unmapped Musts against canonical requirements, implementation, and test evidence. No additional existing test proves a whole Must safely enough to tag.
- Record bounded implementation candidates and distinguish them from release, owner-decision, and native-host gates in `specs/plan.md`; no code or mapping changes result from the audit.

## 2026-10-31 — Record candidate implementation gates (uncommitted)

- Review ENG-09 as the smallest apparent local implementation path; defer it because the trace location, event correlation, missing-value vocabulary, taxonomy, termination and retention/export contract is not settled. Record the spec gap in `specs/plan.md` §12.3.
- Identify CFG-08 as a locally testable privacy slice, but defer edits until its supporting configuration-completion spec receives the required final sign-off. Phase A remains 139/181 mapped; no requirement is qualified.

## 2026-10-31 — Render decision links in adopted intent (uncommitted)

- Include affected IDs in each adopted decision summary so the MADR context, options, choice, consequences and links remain visible in `INTENT.md`; decisions without links keep their prior rendering.
- Add a failing-first `[INT-09]` integration assertion using a real requirement ID and verify the full decision projection. Focused decision and intent projection tests pass 24/24; full `npm run ci` passes with 1,298 tests across 207 suites, and `git diff --check` passes.
- Files: `packages/kernel/src/core/intent-md.ts`, `packages/kernel/test/decision-record.test.ts`, `specs/tech-spec.md`, `specs/plan.md`.
- R1 structural mapping is 139/181, with 16 host-only and 26 unmapped. Built-bundle UAT and `git diff --check` pass; no requirement is qualified.

## 2026-10-31 — Document pre-publication source review (uncommitted)

- Add a release checklist separating review of the working source tree, reachable Git history, and built package inclusion; clarify the privacy checker scans added lines in a specified range and is not full-history proof.
- Add a regression for the checklist requirements and review record. The focused test passes; R1 mapping moves to 138/181 (16 host-only, 27 unmapped), but actual pre-publication review and requirement qualification remain open.

## 2026-10-31 — Investigate result demo paths (uncommitted)

- Add coordinator guidance to include verified demo steps for user-facing changes and captured UI screenshots when available; add an untagged regression because the current kernel does not return demo or screenshot data.
- Draft `specs/result-demo-path.md`; independent review found blocking decisions around command provenance, demo input and screenshot artifacts. Findings are dispositioned, but owner sign-off is required before implementation.
- Phase A remains at 137/181 mapped (16 host-only, 28 unmapped); no RES-05 mapping or qualification is claimed.
- Full `npm run ci` passes: 1,298 tests across 207 suites, zero failures, cancellations or skips. R1 coverage is 138/181 (16 host-only, 27 unmapped); its nonzero exit is expected while unmapped Musts remain. Built-bundle UAT and final `git diff --check` pass.

## 2026-10-31 — State child-agent authority limits (uncommitted)

- State in the reviewer and analyst agent definitions that child work must not expand authority, reset assigned budgets or delegate further, and must report such violations found in evidence.
- Add a red-first `[AGT-06]` regression. Full local CI passes **1,296 tests / 206 suites**; built-bundle UAT, privacy and whitespace checks pass.
- R1 structural mapping is 137/181, with 16 host-only and 28 unmapped. Tool access is read-only, but prompt adherence and trace detection are not verified; Phase A remains incomplete.

## 2026-10-31 — Clarify coordinator conflict handling (uncommitted)

- State that factual disagreements are resolved by comparing evidence and normative product/risk choices are presented as options with a recommendation.
- Add a red-first `[AGT-07]` skill regression. The seven-test guidance suite and all lints pass; the skill remains within its token budget.
- R1 structural mapping is 136/181, with 16 host-only and 29 unmapped. This is instruction-presence evidence, not observed coordinator behavior or qualification; Phase A remains incomplete.

## 2026-10-31 — Extend reviewer security checklist (uncommitted)

- Direct the reviewer skill to flag new network destinations, telemetry calls, credential handling and permission changes introduced in generated code.
- Add a red-first `[SEC-09]` regression. The combined guidance suite passes 6/6; all lints and `git diff --check` pass. The latest full CI predates this slice and passes 1,293 tests / 206 suites.
- R1 structural mapping is 135/181, with 16 host-only and 30 unmapped. This is instruction-presence evidence, not observed review behavior or qualification; Phase A remains incomplete.

## 2026-10-31 — Verify reviewer acceptance-basis guidance (uncommitted)

- Add a `[REV-09]` regression confirming the shipped review skill checks example fidelity, identifies missing examples/checks and reports out-of-scope changes.
- The combined guidance suite passes 5/5. Full local CI passes 1,293 tests / 206 suites, and built UAT, privacy, whitespace and all lints pass.
- R1 structural mapping is 134/181, with 16 host-only and 31 unmapped. This checks reviewer instructions only, not observed reviewer behavior or qualification; Phase A remains incomplete.

## 2026-10-31 — Clarify intake decision questions (uncommitted)

- Limit intake questions to decisions that change the next dependent action; state a recommendation, consequences and a reversible default where justified.
- Add a red-first `[INT-03]` instruction regression. The focused guidance suite passes 4/4, and architecture, skill and quality lint pass.
- R1 structural mapping is 133/181, with 16 host-only and 32 unmapped. This is instruction-presence evidence, not observed model adherence or qualification; Phase A remains incomplete.

## 2026-10-31 — Map the starter ASVS inventory test (uncommitted)

- Tag the existing ASVS inventory regression with `[QLT-02]`; it verifies the complete pinned Level 1 ID set, declared methods/results/applicability and explicit non-conformance boundaries.
- The focused inventory test passes. The previously completed local full CI run for the QLT-16 slice passes 1,291 tests / 206 suites; built UAT, privacy and whitespace checks pass.
- R1 structural mapping is 132/181, with 16 host-only and 33 unmapped. Phase A remains incomplete; the inventory does not establish ASVS conformance or qualify any Must.

## 2026-10-31 — Add starter dependency maintenance controls (uncommitted)

- Schedule monthly Dependabot npm update pull requests for both the repository and the starter template.
- State that critical starter dependency reports or alerts use the existing 3-day acknowledgement and 7-day decision targets, and disclose that repository security settings are not verified by this checkout.
- Add `[QLT-16]` regressions for both scheduled update directories and the published response policy.
- Full local `npm run ci` passes: typecheck, lints, M0 coverage, build, payload verification, reproducibility and 1,291 tests / 206 suites. Built UAT, privacy and `git diff --check` pass.
- R1 structural mapping is 131/181, with 16 host-only and 34 unmapped. Phase A remains incomplete; no host qualification, commit or push.

## 2026-10-31 — Complete local CI for usage, guidance and alternative checks (uncommitted)

- Report per-contract attempt, review-round, delegation, launched-check and active-time totals consistently in work, status and finalized finish responses; record the contract without changing the response envelope or state schema.
- Replace draft README placeholders with source-preview prerequisites, support/assistance matrix, execution permissions, publisher/verification limits, first tasks and update/removal boundaries. Add `[RSC-04]` and `[INS-02]` regressions.
- State that nonbehavioral work uses a named alternative check rather than an artificial test, and report its result; add a `[TDD-06]` skill regression.
- Exclude ignored `node_modules` trees from payload inventory; symlinks inside admitted payload content remain rejected. The bundle is 763 KB and local payload checksums/reproducibility pass.
- Full local `npm run ci` passes: typecheck, lints, M0 coverage, build, payload verification, reproducibility and 1,289 tests / 206 suites. Built UAT, diff check and privacy scan pass.
- R1 structural mapping is 130/181, with 16 host-only and 35 unmapped. Phase A remains incomplete; no host qualification, commit or push.

## 2026-10-31 — Implement approved WRK-06 prototype hardening slice (uncommitted)

- Refuse prototypes when the declared sensitive-data assessment is High, write and update a protected per-prototype hardening block, report missing gaps at finish, and recover the write from its journal.
- Add the dedicated `hardening-gaps-invalid` reason; test gap validation, preserved user content, immediate pre-write rehash, absent-file creation and snapshot inclusion, plus three real SIGKILL recovery points. Update the Tech Spec, UX Spec, skill and plan for the approved SF-21–24 behavior.
- Focused prototype tests pass 11/11; typecheck, lints, full tests 1,280/204, general built-bundle UAT and targeted scratch-folder built-CLI UAT pass. `npm run ci` builds the 762 KB bundle, then stops at payload verification because an ignored template `node_modules/.bin/acorn` symlink is rejected; reproducibility is not reached.
- R1 structural mapping is 119/181 (65.7%), with 16 host-only and 46 unmapped. WRK-06 is not qualified; Phase A remains incomplete. S1 and S3 remain unsigned. No commit or push.

## 2026-10-31 — Implement SEC-15 execution-envelope disclosure (uncommitted)

- Require consent for the exact unknown-exposure envelope before spawning project checks; disclose the envelope, matching authorization and network/data/credential limits in check and finish results.
- Add regression coverage for pre-consent no-spawn, hash-bound authorization, runner errors, repeated finish, disclosure deduplication and unchanged schema-1 envelope history.
- Document the response field and UX exception for abnormal unknown exposure. Focused cohort passes 79/79; the full test suite, typecheck and lint pass. Full CI is blocked at payload verification by an ignored local template `node_modules` symlink.
- R1 structural mapping increases from 117/181 to 118/181 (65.2%); Phase A remains incomplete and no qualification is claimed.

## 2026-10-31 — Add Phase A–D evidence-mapping plan (uncommitted)

- Define the percentage ladder as structural requirement-to-test mapping only: 154/181, 172/181, 180/181 and 181/181; keep implementation, qualification and release readiness separate.
- Add phase gates, estimates, capacity prerequisite, parallel-read/serial-write strategy, host/pilot scheduling dependencies, and a one-hour Phase A scope that does not overclaim completion.
- Start four disjoint read-only audits of the 48 unmapped Musts; no behavior or completion tags are changed by audit alone.

## 2026-10-31 — Complete parallel audit of 48 unmapped Musts (uncommitted)

- Four disjoint read-only audits classify the unmapped IDs against canonical ACs, existing tests/behavior, likely real gaps, and host/release dependencies.
- Most findings are substantive implementation or qualification gaps; WRK-06 appears substantially present but needs a true data-limit/per-prototype regression. No tag-only closure or completion credit is recorded.
- A one-hour run cannot defensibly satisfy the Phase A +37 mapping target; proceed with a bounded red-first local slice and keep external evidence dependencies visible.
- The first candidate, WRK-06, is blocked on unsigned SF-21–24 policy; no source or tests were changed.
- QLT-07's local migration/restore contract is already covered by 28 focused tests, so no change or mapping was justified; supported-platform qualification remains open. Next target is a bounded SEC-15 consent/disclosure regression against the settled AC.

## 2026-10-31 — Revalidate main CI during Phase A (uncommitted)

- Current full `npm run ci` passes typecheck, lints, coverage, build, payload and reproducibility; tests pass 1,269/1,270.
- The sole failure is an EVD-13/QLT-04 starter test timeout waiting for the actual Chromium process identity; its isolated retry passes 2/2 in 33 seconds, suggesting but not proving test-process contention/intermittency.

## 2026-10-31 — Measure fixed-capacity simplification candidates (uncommitted)

- Preserve one measured store simplification (−739 characters) and one launch-phase accounting simplification (−45); focused store/accounting tests, typecheck and accounting differential cases pass.
- Re-measure complete charged accounting responsibility at 33,779/8,640; store remains 38,370/25,920, budget owner 23,066/8,640, and central 293,700/241,805.
- No cap, matcher, baseline, assertion or requirement changed. Central analysis found no behavior-preserving bounded edit that could plausibly close its deficit; full source suite has not been rerun after these scratch-only edits.

## 2026-10-31 — Hold receipt identity change at contract conflict (uncommitted)

- Trace the schema-2 receipt identity from issuance through check, manifest, verdict and review consumers; current producer/consumer/test behavior conflicts with canonical §16.2's versioned full-binding identity and prohibition on legacy-ID authority.
- Do not change source or tests because historical duplicate-field acceptance is not specified; record the exact owner decision required and the evidence in the plan/session report.

## 2026-10-31 — Prototype canonical receipt identity in scratch (uncommitted)

- Preserve existing `configEvidence` as inert history and use canonical full-binding IDs for newly issued schema-2 receipts; stale legacy IDs plus the old stamp do not gain current authority.
- Five new failing-first regressions pass and typecheck passes; the focused cohort is 285/286 due one manifest fixture missing `stack.fingerprint`.
- Changes remain in the authorized scratch feasibility copy, not main. Fixed source owners still fail quality and no full source suite/build was run.

## 2026-10-31 — Clarify plan progress and correct confirmation fixtures (uncommitted)

- Record honest R1 mapping/host/unmapped percentages separately from qualification: 64.6% structurally mapped, 0/181 Musts qualified, 0/19 Should dispositions closed.
- Adapt four scratch required-composition tests to confirm the exact proposal under the canonical configuration contract; all original safety assertions remain.
- Full scratch source is 1,574/1,575 passing; its only failure is the unchanged three-owner capacity gate.

## 2026-10-31 — Record full scratch closure regression checkpoint (uncommitted)

- Whole typecheck/architecture/skills pass; source suite passes 1,570/1,575 tests across 226 suites.
- Four required-check composition regressions are assigned for repair; the fifth failure is the unchanged three-owner capacity gate.
- No failing assertion, capacity limit or completion claim is weakened.

## 2026-10-31 — Verify scratch real effect crash prefixes (uncommitted)

- Effect lane reports 110 focused controls plus one legacy regression, including 43 actual SIGKILL exits across 39 controls; repair recovered operation-closure ordering and introduced quality defects.
- Nested required-check alternatives normalization preserves equivalent external bindings while meaningful changes invalidate; 54 coupled controls/typecheck pass.
- Coordinator full scratch checkpoint is running; receipt alignment, source capacity and complete migration/qualification remain open.

## 2026-10-31 — Repair scratch proof-owner quality (uncommitted)

- Newly added shared Deep predicates reside in the budgeted verdict owner; actual review/verdict matcher limits pass and 110 focused controls/typecheck pass.
- Exact duplicate-free receipt issuance/admission repair is identified; coordinated producer/schema/consumer changes remain pending.
- Whole-candidate capacity and acceptance remain open; no limit change or installation.

## 2026-10-31 — Close local effect proof slice; retain acceptance failures (uncommitted)

- Scratch normal/recovered effect identity, asynchronous publication and verdict caller gating report 71 focused controls, one real legacy integration regression and typecheck passing.
- Remaining configuration matrices and real crash prefixes continue in parallel; introduced quality violations are assigned for repair.
- Four source owners remain over capacity; receipt duplicate-stamp discrepancy is logged against the canonical contract. No whole-candidate acceptance or installation.

## 2026-10-31 — Implement scratch D6 safe-subset configuration (uncommitted)

- Save only disclosed tighter additions from well-shaped content-invalid proposals; preserve held restrictions and reject malformed/conflicting checks.
- Lane reports 50 focused passes and typecheck; remaining transition matrices and combined candidate validation are open.
- Central responsibility is 290,159/241,805, still failed under unchanged limits. No candidate installation or activation.

## 2026-10-31 — Advance scratch configuration transitions (uncommitted)

- Candidate implements strict scoped previews, confirmation/decline, all-valid batches, resets, source-sensitive retries and atomic all-work refresh.
- Lane reports 43 focused passes; D6 safe-subset composition and complete transition matrices remain pending.
- Central source remains above its unchanged limit; no candidate installation or full-protocol acceptance.

## 2026-10-31 — Close scratch manifest proof shortcuts (uncommitted)

- Candidate manifest and verdict share latest-role/current/native/completeness checks; review done reuse requires a current completed full parent.
- Five proof-closure controls and coupled cohort report 110 passes; whole candidate typecheck awaits concurrent effect-test repair.
- Changes remain in the authorized scratch candidate, not the shipped kernel. Fresh recovered-proof callback integration is assigned to the existing effect lane.

## 2026-10-31 — Preserve all offline reporting evidence (uncommitted)

- Fix `packages/eval/src/report.ts` campaign time/count totals to include unplanned and dangling attempts without attributing them to planned subgroups.
- Preserve non-completed statuses in Markdown, numeric attempt order in JUnit, and known unplanned safety violations as failures rather than skips.
- Add four discriminating controls in `packages/eval/test/report.test.ts`; actual offline CLI UAT covers all formats. Full main CI passes 1,270 tests/204 suites, with no skipped/cancelled tests.
- Protocol configuration and pure proof-consumer closure continue in exclusive authorized scratch lanes; no new persisted-format or limit approval is inferred.

## 2026-10-31 — Verify recovery proposal dispositions (uncommitted)

- Independent verification resolves paired contract blockers without new scope.
- Narrow manifest identity amendment is requested but unapproved; canonical wording, runtime refusal and active limits remain unchanged.

## 2026-10-31 — Reconcile paired recovery proposal boundaries (uncommitted)

- Disposition independent review blockers with one proposed persisted encoding and explicit internal-observation mapping, plus packet-decoder dependency.
- Focused verification remains pending; no new persisted format, owner approval or limit change.

## 2026-10-31 — Review paired missing recovery contracts (uncommitted)

- Complete session-only finite inventory and recovery-set proposals, then commission fresh cross-contract review.
- New descriptor/decoder decisions and unsupported-family blockers remain explicit; no persistence, capacity or activation change.

## 2026-10-31 — Prepare missing complete protocol contracts (uncommitted)

- Assign session-only retained-inventory and migration recovery-set contract proposals rather than add disconnected primitives.
- Current reachable bundle is 808,969 bytes with local payload integrity verified; unused future paths and missing sign-offs prevent complete-protocol claims.

## 2026-10-31 — Verify full snapshot/copy regression checkpoint (uncommitted)

- Full scratch source run passes 1,431/1,432 controls with zero skips/cancellations; sole failure remains fixed source capacities.
- Independent inventory/install and complete migration recovery-set contracts remain missing, and limits are unchanged.

## 2026-10-31 — Repair snapshot constructor function quality (uncommitted)

- Focused validation helpers restore function/width limits without relocating responsibility; 69 controls and typecheck reported passing.
- Budget capacity and independent inventory/install proof remain missing; full snapshot/copy source checkpoint is underway.

## 2026-10-31 — Record snapshot/copy primitive limits (uncommitted)

- Scratch private-copy primitive passes real kill-prefix controls but is not a complete recovery set or Store/Tx contract.
- Coordinator typing/architecture/skills pass; new constructor function-quality defects and larger source-capacity failures remain. Assign coupled constructor repair without changing limits.

## 2026-10-31 — Implement witnessed checkpoint constructor in scratch (uncommitted)

- Pure construction requires independently witnessed retained-key coverage and preserves launch uncertainty; lane reports 69 focused passes and typecheck.
- Actual full inventory, durable installation and protected restart remain unimplemented; no capacity or activation claim.

## 2026-10-31 — Advance remaining recovery protocol boundaries (uncommitted)

- Assign independent accounting snapshot construction and protected migration-copy implementation to exclusive scratch lanes.
- Reconcile stale task blockers to the complete repaired regression checkpoint; source capacity and full migration/qualification remain open, with no limit or activation change.

## 2026-10-31 — Verify complete source after retained-floor repair (uncommitted)

- Full scratch run passes 1,413/1,414 tests with zero skips/cancellations; all retained-state regressions pass together.
- Only the unchanged source-owner capacity gate fails. Reviewed policy direction remains unapproved; full protocol and qualification are not complete.

## 2026-10-31 — Repair retained-budget semantic rollback (uncommitted)

- Retained copies now raise high-water counters without restoring old reservations, signatures, last-call timestamps or resettable active time.
- Schema-1/schema-2 store regressions cover the defect; coupled run reports 408/409 with only capacity failing. Full source checkpoint is underway, safety fences unchanged.

## 2026-10-31 — Disposition capacity proposal review (uncommitted)

- Independent review reports no blocking defect for a direction-only request; clarify two-stage approval and consistent partial-work credit.
- No owner approval or active cap change follows; recovery regression repair remains open.

## 2026-10-31 — Review session-only capacity policy proposal (uncommitted)

- Prepare alternatives with no current cap changes, then commission independent review of complete-target criteria, responsibility accounting and evidence accuracy.
- Recovery behavior repair remains separate; proposal does not authorize activation or qualify the candidate.

## 2026-10-31 — Repair retained full-suite regressions and prepare policy alternative (uncommitted)

- Latest full source run passes 1,374/1,412; coupled review/workflow regressions require root-cause repair, not weakened proof assertions.
- Prepare a session-only source-capacity policy proposal under renewed friction-removal direction; no active limit, safety gate or schema activation changes.

## 2026-10-31 — Verify retained-store integration boundary (uncommitted)

- Admit actual primary/previous originals before selection; retain conservative unknown fallback and fenced schema-2 compaction. Lane reports 167 focused controls and ten real kill boundaries.
- Typecheck/architecture/skills pass; three fixed source-owner caps fail. Updated reachable bundle is 808,883 bytes with local payload integrity verified; full source run remains underway.
- Capacity amendment is pending owner review, not approved; complete retained inventory/snapshots, migration and activation remain open.

## 2026-10-31 — Disposition legal unresolved-launch delta (uncommitted)

- Preserve original differential mismatch and explicitly justify prepared→starting diagnostic correction without changing accounting facts.
- Report unchanged comparison populations with exact/justified deltas separately; snapshot construction and full retained inventory remain unimplemented.

## 2026-10-31 — Advance retained recovery into the store boundary (uncommitted)

- Pure horizon reports 71 focused passes; retain launch differential mismatch pending explicit legal-transition proof.
- Assign actual admitted-copy/checkpoint store integration; unsupported full inventory remains conservative refusal. Capacity and whole protocol closure remain open.

## 2026-10-31 — Reject inadequate central abstraction (uncommitted)

- Six-job abstraction passes its frozen controls but saves only 371 characters; restore original central source byte-identically rather than retain unjustified indirection.
- Central capacity remains 19,015 over; recovery adapter contracts are the next concrete integration dependency.

## 2026-10-31 — Record frozen candidate CLI UAT (uncommitted)

- Existing UAT reports 152 observations with stable bundle identity and exit zero on Node26.
- Retain explicit unimplemented committed-tree and synthetic-review limits; summary is agent-reported because the requested full log was not persisted.

## 2026-10-31 — Verify repaired full source and reachable bundle (uncommitted)

- Full scratch source run passes 1,382/1,383 controls; only fixed-owner quality fails. Build is 804,905 bytes within its unchanged limit; complete local payload checksum verification passes.
- Reachable-bundle fit is not complete protocol fit. Assign central structural replacement and retained recovery-horizon closure in parallel, with coordinator-owned adapter integration.

## 2026-10-31 — Record central and accounting repair checkpoints (uncommitted)

- Central reports four full-suite regression repairs and guarded checkpoint-laundering paths, with 90 focused passes.
- Accounting reports witness/replay guards, 42 controls and 24,000 differential comparisons; responsibility-total capacity still fails by 9,494 characters.
- Central capacity and complete recovery horizon remain open; coordinator full repaired regression run is underway.

## 2026-10-31 — Correct store replacement evidence (uncommitted)

- Record final targeted outcome as 124 passing, one failed and one cancelled under unchanged deadlines; isolated retry is not full-cohort resolution.
- Restore original reported source identities as historical after the replacement overwrote them; separate later captures and disclose unverified original-byte retention.

## 2026-10-31 — Record replay repair and store replacement limits (uncommitted)

- Scratch replay rejects cross child/tool start-ID collisions; focused combined eval reports 51 passes with inert effect traps and byte/event bounds. Results remain synthetic.
- Store reuse saves 274 characters but remains 6,948 over budget; final targeted run has two deadline failures. Record failures rather than accepting isolated retry as proof of resolution.

## 2026-10-31 — Repair static protocol referenced UTF-8 validation (uncommitted)

- Scratch protocol validation now rejects matching-digest malformed UTF-8 in fixture/grader references while hashing original bytes and accepting valid non-ASCII content.
- Lane reports 24 focused passes and typecheck; full acceptance/CI and native qualification remain open. No CLI or authorization change.

## 2026-10-31 — Add independent approved evaluation lanes (uncommitted)

- Assign static protocol and synthetic replay acceptance closure alongside the three kernel repair lanes, with exclusive shared-validator/replay ownership and coordinator CLI integration.
- Require concrete missing cases rather than redundant test churn; sealed baseline remains approval-blocked and no native qualification follows.

## 2026-10-31 — Apply dependency-based parallel scheduling (uncommitted)

- Adopt structural replacement and distinct engineering/native/qualification evidence from the supplied assessment; correct stale candidate figures, tag-as-completion claims and requirement-label mismatches.
- Continue three exclusive implementation lanes and one read-only next-work lane rather than a serial six-sprint schedule or overlapping writers. No invented capacity threshold, spec amendment, campaign approval or qualification follows.

## 2026-10-31 — Repair full candidate failures in parallel (uncommitted)

- Full scratch source suite reports 1,357/1,363 passing; retain four central proof regressions and actual quality-cap failure as open.
- Make the Git ignore control self-contained in a real isolated fixture; targeted assertion passes without touching main Git state.
- Assign exclusive central, accounting and store structural repair lanes, preserving safeguards, budgets and failing assertions.

## 2026-10-31 — Record observed migration source slice (uncommitted)

- Record actual bounded source/reference/process capture and two-snapshot comparison; assertion-only migration admission refuses. Lane reports 110 targeted passes and resolved function-quality defects.
- Store exceeds its fixed ceiling by 7,222 characters. Log the actual manifest producer/identity spec mismatch and retain conservative refusal; installation/rollback and complete protocol acceptance remain open.

## 2026-10-31 — Validate integrated scratch runtime (uncommitted)

- Apply subtype-preserving shared runtime-state signatures; whole scratch typecheck passes.
- Coordinator validates 90 protocol/runner controls and 23 coupled legacy backup/stop controls. Architecture/skills pass; owner capacity and migration function-quality gates fail and remain recorded.
- Complete recovery horizon, coverage integrity, migration and full acceptance remain open; no installation, activation or cap change.

## 2026-10-31 — Record active integration blockers precisely (uncommitted)

- Central runtime integration reports remaining shared-wrapper type errors and central/accounting cap overruns; request exact state-preserving boundary patches.
- Correct corpus retention evidence: the retained manifest describes scenarios, not raw journal payloads. Migration observation must capture actual source records.

## 2026-10-31 — Advance observed migration closure in parallel (uncommitted)

- Add an exclusive scratch lane for actual bounded source/reference/process observation while central launch integration and proof import/collision repair continue.
- Preserve fixed-owner budgets and safeguards; source capture does not establish migration installation, rollback or whole-candidate acceptance.

## 2026-10-31 — Track conservative collision guard and import blocker (uncommitted)

- Proof lane reports five conservative collision controls; stored unproved declarations cannot inherit intrinsic or recipe-tool proof.
- Config-first import reveals a coupled initialization cycle; repair and import-order regressions are in progress. Whole-candidate success remains unproved.
- Record the store lane's exact refusal/publication coverage and limits rather than claiming all maintenance races or migration closure.

## 2026-10-31 — Record versioned store slice and align scratch ports (uncommitted)

- Store lane reports 97 targeted passes for strict version admission/publication and preserved recovery/evidence. Its current store owner is 798 characters over the fixed ceiling; schemas fits.
- Coordinator applies generic state-preserving `Tx`/`Store`/`Ports` with legacy defaults in scratch. Central recovery typing, whole-candidate validation, writer closure and migration remain pending; no shipped activation or budget change.

## 2026-10-31 — Record scratch proof-consumer integration (uncommitted)

- Record the core lane's exact hash/serial/durable-floor admission and retained schema-1 behavior/history. It reports 60 targeted passes, owned-graph typecheck and owned quality checks; review/verdict remain within their fixed ceilings.
- Central caller wiring, complete-candidate validation and fixed-adapter equivalence/collision clarification remain open. No shipped implementation or activation follows from this bounded report.
- Clarify that whole scratch typecheck failed during concurrent edits. Existing §16.6 conservative collision guards are unfinished implementation, not a new policy blocker; assign that bounded follow-up without inventing positive declaration equivalence.

## 2026-10-31 — Validate scratch foundations and start runtime integration (uncommitted)

- Coordinator checkpoint passes 59 protocol/runner controls across eight suites, typecheck, architecture and skills lint. Quality lint fails only accounting at 8,841/8,640; preserve this measured failure.
- Correct current test-selector evidence: Node glob discovery includes protocol and runner-launch files in the base selector; the earlier omission claim is not established for this runtime.
- Central-capacity report saves 363 characters; runner acknowledgment and actual-producer corpus now have combined checkpoint evidence. Record checkpoint hashes separately from subsequent active edits.
- Assign disjoint existing-runtime integration for pipeline/accounting, core proof consumers and store/schema version admission. No second pipeline, owner relocation, budget change, installation, activation, commit or push.

## 2026-10-31 — Record scratch schema fit and reconcile store diagnostics (uncommitted)

- Schema-owner report: 31,541 to 26,790 non-whitespace characters, 109 under its unchanged ceiling; 61 relevant controls pass. Schema-1 permissive and schema-2 strict contracts remain.
- Store confirms its earlier return-type errors were corrected before its passing final typecheck. Runner tests are still being edited; stable integrated typecheck, accounting fit and whole-protocol acceptance remain pending.

## 2026-10-31 — Record incomplete scratch accounting fit (uncommitted)

- Budget-owner report: save 136 non-whitespace characters (8,997 to 8,861), with 55 focused passing controls. The fixed 8,640 ceiling is still exceeded by 221; no required contract was removed.
- Concurrent store typecheck diagnostics require reconciliation at the stable integrated checkpoint. Accounting fit and full candidate validation remain open.

## 2026-10-31 — Record scratch store fit and producer coverage (uncommitted)

- Store-owner report: 25,877/25,920 characters, 84 focused passing controls, typecheck pass and no remaining store quality finding. Fixed caps and owner matching are unchanged.
- New scratch corpus reports all nine actual schema-1 effect producers, cached response, previous-state recovery and real-SIGKILL interrupted work. Dependency is simulated failure-path coverage only. Stable-source rerun and combined integration gates remain pending; no activation or installation.

## 2026-10-31 — Use dependency-based parallel scratch delivery (uncommitted)

- Update `specs/plan.md` and `specs/protocol-prototype.md` with disjoint owner-based lanes, coordinator integration and serialized heavyweight gates. Add runner/ports launch acknowledgment and central-capacity assignments alongside the existing feasibility work.
- Correct the supplied acceleration assessment's unsupported scope cuts, blanket Should omissions, invented qualification tuple and serial calendar estimate. Preserve the actual §11.2 cut list, fixed budgets, every required safeguard and independent host/release authority.
- Protocol-quality refactoring has an agent-reported 30-test pass; integrated validation and whole-protocol closure remain pending. No production activation, installation, new branch/worktree, commit or push.

## 2026-10-31 — Continue isolated protocol feasibility work (uncommitted)

- The owner explicitly authorized a swarm for disjoint scratch-only work, superseding the earlier single-agent restriction. The candidate now has schema-version/upcast, configuration-evidence, effect-replay, durable launch-journal and migration-admission slices.
- All 49 protocol tests across six suites and scratch typecheck pass on Node 26.3.0; the existing repository suite separately passes 1,266/204. Its default glob omitted the new top-level protocol tests, so the scratch test script now includes them explicitly and a combined run is pending. Initial lint reports three fixed-owner overages and complexity/width findings; disjoint scratch-only remediation is active. No whole-protocol, migration/kill acceptance, fit or activation is claimed. Migration facts are supplied to a pure gate and are not independently observed.
- No shipped-tree implementation, budget change, schema activation, installation, commit, push or final sign-off. [Scope and current evidence](specs/protocol-prototype.md).

## 2026-10-31 — Authorize isolated protocol feasibility prototype (uncommitted)

- On the owner's direction to “go full pace” and amend friction-causing rules, the schema-migration gate now narrowly allows the complete configuration/migration candidate in isolated scratch. No shipped-tree implementation, schema activation, parallel agents, commit or push is authorized. Fixed owner budgets, safeguards, independent review and final implementation sign-off remain.
- The candidate scope, 28 responsibility checklist, compatibility/kill evidence and stop conditions are in [protocol-prototype.md](specs/protocol-prototype.md). No fit or feasibility conclusion is claimed until it passes.

## 2026-10-31 — Begin isolated protocol record and settlement slice (uncommitted)

- Scratch-only candidate adds strict schema-2 identities, recovery/checkpoint/launch records and a pure contiguous launch-settlement fold. Red-first controls cover exact phase unions, conflicting ownership, replay, holes, known-later obligation units, positive no-launch evidence and safe counter settlement.
- Twelve focused tests and scratch typecheck pass. These helpers are not wired into the main pipeline, durable journal, runner or migration; the actual schema-1 producer corpus, whole-protocol fit and process/kill/recovery acceptance remain pending. [Current scope and evidence](specs/protocol-prototype.md). Main schema-1 source and bundle remain unchanged.

## 2026-10-31 — Verify exact password replacement behavior (uncommitted)

- Recipe 0.4.5 extends real starter API coverage: the password-change route rejects a canonically decomposed current password, accepts the exact composed Unicode value, and subsequent sign-in accepts only the exact new password while rejecting case, whitespace, normalization and the previous password.
- Final source CI passes 1,266/204. Final bundled starter/loan/browser and CLI-library journeys pass on Node26 with 105/138 neutral/evolved app cases and 12/16 browser cases; 152 bundled CLI scenarios pass. Node22/24 were not available for this source version; earlier 0.4.4 runtime evidence is historical. [Exact evidence and limits](docs/audits/2026-10-31/asvs-password-change-validation.json). ASVS rows remain pending; authentication policy is unchanged.

## 2026-10-31 — Add bounded password assurance controls (uncommitted)

- Recipe 0.4.4 adds starter tests for current 12/256 length boundaries, unrestricted representative password composition, and exact Unicode password verification through the actual sign-in API. ASVS rows V6.2.1, V6.2.5 and V6.2.8 cite these controls but remain pending for complete/manual review.
- Preserve current authentication policy. The inventory records that Level 1 requires at least 8 characters and strongly recommends 15; no 15-character policy, waiver or other identity change is inferred.
- Full CI passes 1,266/204. Final bundled starter/loan and CLI-library journeys pass on Node22/24/26 with 105/138 neutral/evolved app cases and unchanged 12/16 browser cases. Node26/22 each pass 152 bundled CLI scenarios. [Exact evidence and limitations](docs/audits/2026-10-31/asvs-password-validation.json). QLT-02 and all requirement statuses remain unchanged; no commit/push or new branch/worktree.

## 2026-10-31 — Record private-read consistency and prototype boundary (uncommitted)

- Retain the three red-first restored-mtime private-read controls, bounded same-descriptor byte comparison and shared temp-leaf enumeration already included in the later takeover validation. Preserve permission/link-only changes, short reads and distinct age/cap policies. [Evidence reconciliation](docs/audits/2026-10-31/store-continuation.md), [final validation](docs/audits/2026-10-31/store-validation.json). Later bounded-write/starter/schema changes remain intact and are not counted again.
- On owner speed feedback, define one isolated complete configuration/migration candidate, focused iteration and batched final gates. [Exact scope](specs/protocol-prototype.md) is authorized in scratch only; no budget change, target activation, installation, qualification or publication.

## 2026-10-31 — Share existing schema-1 validators (uncommitted)

- `core/schemas.ts` reuses actual basis validators in obligations, derives consecutive unchanged input fields and shares receipt/history status. Preserve parsed key order, distinct input support bounds, strictness, defaults and diagnostics; no new schema language or contract.
- `contract.test.ts` adds two before/after characterization controls. All 52 generated JSON schemas and 5,060 differential probes, including 46 distinct actual producer records, match the frozen implementation; two scratch mutations are caught. Source saves 135 characters, bundle saves 186 bytes, all budgets and other owners unchanged.
- Full CI passes 1,266/204; Node22/24/26 pass the new controls. Node26/22 each pass 152 actual bundled CLI scenarios and complete 103/12 neutral, 136/16 evolved app/browser plus brownfield CLI/library journeys. Update fixed-budget work plan, progress and scoped working references. [Exact evidence and limits](docs/audits/2026-10-31/schema-sharing-validation.json). No full protocol-fit/sign-off, schema activation, ASVS waiver, qualification, commit/push or new branch/worktree.

## 2026-10-31 — Publish pinned starter ASVS applicability (uncommitted)

- Recipe 0.4.3 ships `docs/asvs.md`, linked from README/hardening and included in the explicit payload. Account for all 70 official ASVS v5.0.0 Level 1 IDs: 46 pending, 19 scoped non-applicable and five gaps; none passed. Identify verification methods, actual source/test starting points, expiry of non-applicability and remaining manual/independent work.
- Add red-first `starter-assurance.test.ts` and four scratch mutation falsifiers for missing/invented IDs, false passing claims and missing scope reasons. The actual golden scaffold/finish loop confirms the published document is byte-identical and Git-tracked. Full CI passes 1,264/204; inventory controls pass Node22/24/26; built Node26/22 complete journeys retain 103/12 neutral and 136/16 evolved app/browser cases.
- [Exact evidence](docs/audits/2026-10-31/asvs-inventory-validation.json). QLT-02 remains unmapped: a complete inventory is not ASVS conformance. Authentication/exposure and stewardship gaps need their review/dispositions; no silent policy change, waiver, target/budget amendment, commit/push or new branch/worktree.

## 2026-10-31 — Redact root authentication log fields (uncommitted)

- Recipe 0.4.2 adds root `password`, `currentPassword`, `newPassword` and `csrfToken` redaction alongside the existing nested/header paths. A real app-logger stdout control first reproduces the leak, then verifies redaction and retained safe structured fields. Actual health/404/500 controls preserve correlation IDs and exact non-leaking response shapes.
- Files: starter logging, new logging tests, hardening scope, recipe version, payload inventory and exact scaffold/loan population assertions. Full CI passes 1,263/204; built Node26/22 journeys pass 103/12 neutral and 136/16 evolved app/browser cases; each runtime also passes 152 built CLI scenarios. Supported Node24 actual-app controls and current-runtime scratch types/lint pass locally. Bundle unchanged; payload checksums rebuilt. [Exact evidence and limits](docs/audits/2026-10-31/logging-validation.json).
- QLT-04 gains a structural mapping only: R1 117 mapped/16 host/48 unmapped, no semantic acceptance or qualification. No arbitrary-content sanitizer, dependency change, target/budget amendment, commit/push or new branch/worktree.

## 2026-10-31 — Exercise a brownfield TypeScript CLI/library (uncommitted)

- Add `packages/kernel/test/golden-task-cli-library.test.ts`: real library/caller characterization, two assertion-failing baseline cases, singular-output repair, three passing candidate cases and no-commit finish. Preserve existing caller, characterization, metadata and HEAD; use the existing adapter without a web recipe or dependency.
- Full source CI passes 1,263/204; the shipped bundle passes this journey on Node22/24/26. Review submission is synthetic transport only, not independent review evidence; trait consumers, complete AC-20 and qualification remain open.
- Update plan and scoped working-inventory references. Bundle/payload and all budgets/targets remain unchanged. [Exact evidence and limits](docs/audits/2026-10-31/cli-library-validation.json). No commit, push or new branch/worktree.

## 2026-10-31 — Complete prerequisite recovery instructions (uncommitted)

- Add canonical missing-Node/Git/package-manager guidance to the shipped entry agent and intake onboarding: official links, user-managed installation, manager identity, actual version/doctor recheck, restart permission and advisory no-kernel limits. Distinguish missing dependencies, unsupported versions and launch errors. Red-first shipped-instruction control added; native adherence remains unobserved, not enforced or qualified.
- Full CI passes 1,262/204 and both Node26/22 pass all 152 built CLI scenarios. Existing budgets and kernel bundle unchanged; complete payload checksums rebuild. Update technical mechanism, plan and working requirement inventory. [Exact evidence](docs/audits/2026-10-31/prerequisite-validation.json).
- Record rejected isolated Node24 transaction-dispatcher/header-compilation/API-bundling trials and RSS/heap/allocation profiles. None solves memory acceptance; no candidate installed, target/security/quota change, native spike, commit/push or new branch/worktree. [Trials and limits](docs/audits/2026-10-31/runtime-profile-validation.json).

## 2026-10-31 — Retain bounded workload authentication diagnostics (uncommitted)

- Add redacted `failureReasons` counts to each failed sign-in probe without changing login/gate/timeouts, scheduling, counters or acceptance criteria. Exact known status/cookie categories and fixed error classes never retain arbitrary exception/body/credential data. A real HTTP 503 control proves status retention and gate release; smoke checks diagnostic counts. Files: loan workload client/harness/test/docs and golden exact-case assertion.
- Final full CI passes 1,261/204; built Node26/22 loan journeys pass 101/12 neutral and 134/16 evolved app/browser cases; supported Node24 types/lint/all 134 app cases pass. The unchanged bundle is byte-identical.
- Isolated Node24 source still fails memory at 402,784,256 bytes. The same uninstalled compiled/statement candidate fails at 358,596,608 bytes and reproduces four `signin-status-503` refusals, with no operation busy responses. This is status-stage evidence, not proof of the precise busy/quota cause or historical timing. Discard an initial CI-overlapped trial as confounded. [Exact evidence](docs/audits/2026-10-31/workload-diagnostics-validation.json); update plan/runtime draft. No relaxed targets, candidate installation, absent approval, qualification, branch/worktree, commit or push.

## 2026-10-31 — Reject premature runtime-candidate acceptance (uncommitted)

- Validate the combined scratch runtime on supported Node24.22.2: memory fails at 357,793,792 bytes, four sign-in probes fail and operation busy degradation is unobserved. Unchanged source also fails memory at 403,046,400 bytes. Preserve both failed full reports, correct bursts/invariants/cleanup and exact runtime/ABI restoration evidence.
- Update `specs/starter-runtime.md` to not ready for implementation sign-off; its two Node26 passes cannot replace supported-LTS acceptance. No candidate installation, absent owner approval, target/crypto/quota change or qualification claim. Main fixture code/full CI remains the previously validated source. [Evidence](docs/audits/2026-10-31/runtime-lts-validation.json); plan updated.

## 2026-10-31 — Strengthen return concurrency proof and evaluate runtime memory (uncommitted)

- Replace the generated loan test's deadline-consuming external-writer startup barrier with five ready real processes plus actual SQLite protected-read observation. Preserve the exact one-winner/four409or403 and persisted timestamp/row/FK assertions. Both cases reject an unprotected-read mutation; 20 current and 10 minimum-runtime repetitions, full built loan journeys and full CI 1,261/204 pass. No production service/deadline change. Files: the loan `concurrent-return` test/worker fixtures; [exact evidence](docs/audits/2026-10-31/return-memory-validation.json).
- Standalone finite-statement reuse and JavaScript production-output trials fail the unchanged memory target. Their scratch-only combination passes two full current-runtime workloads at 292.4/293.4 MB with all checks intact. No candidate is installed. Add independently reviewed `specs/starter-runtime.md`; accept its Node24 matrix/citation/publication findings. Owner sign-off and final installed-artifact validation remain pending. Update plan/defect log; no dependency, budget, target, crypto, quota, commit/push or qualification change.

## 2026-10-31 — Bound host version diagnostics (uncommitted)

- Replace blocking, unbounded version probes with asynchronous owned process groups using the run's remaining absolute deadline and the existing one-MiB per-stream limit. Preserve successful version text; report timeout/deadline/output/spawn unavailability explicitly without relabeling the main command's outcome or changing its transcript. Reuse narrow owned-group cleanup, including leader exit.
- A real red proves one stalled version probe falsely times out an independent successful command. Real shell/descendant, output-limit and deadline-exhaustion controls, ten repeated final probe/stop runs and all 40 offline harness controls pass. Final full CI passes 1,261 tests/204 suites without failures/skips. Files: `tools/host/copilot-cli.ts`, `packages/kernel/test/host-cli.test.ts`, plan and [exact evidence](docs/audits/2026-10-31/host-probe-validation.json). Shipped artifact and application workload source are unchanged; no new-source remote/native qualification, commit/push or branch/worktree.

## 2026-10-31 — Repair offline cancellation and remeasure current application (uncommitted)

- Preserve complete UTF-8 stop events across stdout chunk boundaries and re-signal the owned process group at leader exit after stop/timeout. Real red controls reproduce missed recognition and stopped=true/timedOut=true; raw transcript bytes, existing watchdog/stop assertions and live-run authority remain unchanged. Files: `tools/host/copilot-cli.ts`, `packages/kernel/test/host-cli.test.ts`.
- Thirty repeated real-process runs, 38 focused controls and full CI 1,259 tests/204 suites pass without failures/skips. The shipped bundle remains byte-identical; no new-source remote or native-host pass is claimed.
- Remeasure the complete unchanged post-authentication application on both runtimes. Current Node 26 has 8,756 successful samples but fails the 300 MB memory target at 326,828,032 bytes; Node 22 locally passes with 8,763 samples and 298,844,160 bytes. Both retain twelve correct bursts, 48 successful sign-ins, bounded busy degradation and database invariants. Single local observations are not reference-hardware qualification. [Exact evidence](docs/audits/2026-10-31/process-workload-validation.json). Update plan; memory, loan-barrier/version-probe diagnosis, protocol fit/sign-off and qualification/release remain open. No commit/push or new branch/worktree.

## 2026-10-31 — Bound private writes and reconcile main takeover (uncommitted)

- Apply the existing 50 MB private-record bound to UTF-8 bytes before the shared synchronized writer opens or truncates a leaf. A real red reproduces oversized artifact overwrite; the regression preserves existing/absent leaves on refusal and accepts exact-bound content. Files: `packages/kernel/src/adapters/store-fs.ts`, `packages/kernel/test/store-boundary.test.ts`.
- Preserve inherited `main` edits and four inert older worktrees. Reject/remove a central intent-helper candidate that grew its measured owner by 68 characters. All ceilings, deadlines and test populations remain unchanged; store headroom is 214 characters.
- Final full CI passes 1,258 tests/204 suites, zero failures/skips; both Node runtimes pass 152 built CLI scenarios and complete 101/12 neutral, 133/16 evolved app/browser journeys. [Exact local evidence](docs/audits/2026-10-31/takeover-validation.json).
- Refresh `specs/plan.md` with the dependency-ordered completion backlog, all 50 unmapped Musts, all 19 due Should dispositions and actual failed remote CI. Linux/Windows passed run 41177820140; macOS loan/process-stop failures have no proven cause despite passing local repetitions. Final protocol fit/sign-off, semantic acceptance, native/human campaigns and release remain open. No commit/push, new branch/worktree or qualification.

## 2026-10-31 — Fixed-budget simplification and preservation repairs (uncommitted)

- Require own vetted/support entries for filename attribution, protected paths, behavioral-change assessment, scaffold replay and lock disposition. Real old-bundle control proves a human `constructor` file entered a commit; repaired execution preserves it and requires attribution. Changed unvetted test/build configuration now requires explicit attention disposition.
- Share identical schema views/counter operations, copy the recovery map once with safe own data slots, use set membership for inventory scans, and remove redundant empty response defaults. Net saving 818 source characters; all fixed ceilings and schema-1 contracts retained. Bounded differential checks and synthetic timing are local evidence, not complete target-fit or performance qualification.
- Files: kernel core accounting/schemas/attribution, central decisions/verbs, backup/prototype/configuration/golden tests, built UAT driver and canonical progress/audit documents. Full CI passes 1,254 tests/204 suites with zero failures/skips. [Exact built evidence and limitations](docs/audits/2026-10-31/continuation-validation.json); [findings and remaining sequence](docs/audits/2026-10-31/continuation.md). Full migration/configuration protocol, semantic ledger and host/human/release gates remain open. No budget increase, activation, commit or push.

## 2026-10-31 — Revalidate authentication at the final write boundary

- Recipe 0.4.1 prevents sign-in from issuing sessions for obsolete credentials or deleted users, and prevents password replacement from reviving revoked/expired authority or overwriting a concurrent replacement. Current user fields are read inside the final immediate transaction, including every busy retry. Crypto, quotas, DTOs, dependencies, SQL schema and kernel budgets are unchanged.
- Add twelve regressions using real scrypt, independent SQLite connections, actual contention and parallel HTTP requests. All twelve fail against the original implementation and pass after the repair; rejected operations preserve concurrent state and issue no replacement cookie. Expected neutral/evolved app populations become 101/133; existing browser populations remain 12/16. Final CI/built evidence and limitations are retained in `docs/audits/2026-10-31/validation.json`.
- Follow the same defect into loan mutations: five held-writer controls reproduce reserve/return after revocation/expiry and administrative return after demotion. Reuse the protected session inspector through `refreshActor` inside each write attempt, pass the application clock, preserve loans on refusal and clear a presented invalid cookie after late authentication failure. Document the feature-authoring pattern. The complete new regression population is seventeen.
- Final validation: all 1,238 repository tests/202 suites pass with zero skips/failures; both Node 26.3.0/22.12.0 pass 149 built UAT scenarios and the full 101/12 neutral, 133/16 evolved app/browser journey. The complete payload has 92 files; kernel source, its 776,837-byte bundle and both lockfiles are unchanged.
- Refresh the 200-requirement working inventory, implementation audit, ordered completion plan and owner-selected fixed-budget simplification work plan. A scratch accounting candidate saves 287 source characters with 8,000 matching generated recovery comparisons; it remains uninstalled and does not establish full protocol feasibility. No requirement is newly qualified; no commit, push, host campaign or release.

## 2026-10-31 — Publish preserved work and repair cold-browser CI setup

- Published implementation/tests (`35c26df`) and specification/audit records (`2bf4c38`) separately after staged and outgoing-range privacy checks. The owner explicitly retained Git's inferred identity. No amendment, new branch, force push or unsigned protocol/cap activation.
- Exact-head remote CI passed Windows, but both Linux/macOS starter and golden journeys failed because their pinned Chromium was absent (1,235/1,237 tests passed per POSIX job). Add a red-first workflow control, then install the starter's locked Playwright/browser prerequisites from runner-owned temporary tooling before full CI; keep the shipped payload clean. A golden-check diagnostic reports the actual failed response instead of a secondary missing-review dereference.
- Files: `.github/workflows/untrusted.yml`, `packages/kernel/test/{ci-security,golden-task-loan-desk}.test.ts`, plan and [publication evidence](docs/audits/2026-10-31/publication-validation.json). Targeted setup control is red then green (10/1 then 11/0); full local CI passes 1,238 tests/202 suites, zero failures/skips. Repair commit `a98b78d`; bundle/payload unchanged. Corrected remote CI remains pending. Prior local observations and failed remote evidence remain historical, not R1 qualification.

## 2026-10-29 — Owner-authorized configuration/migration capacity proposal (uncommitted)

- Added `specs/protocol-capacity.md`: existing-owner measurements, 28 target responsibilities, two in-memory source candidates, transparent source/bundle forecast limits and coordinator wording feasibility. Small source candidates save 180 characters/302 bundle bytes; no candidate is installed and no actual target deficit or cap increase is claimed.
- Corrected current coordinator capacity to 3,999/4,000 tokens; historical headroom is not available current capacity. Updated plan and reassessment/review records with the owner's proposal-only selection and remaining review/sign-off gate. Runtime source, shipped artifact, caps, schema and authority remain unchanged; preceding source CI/UAT is baseline evidence only.
- The separately authorized independent capacity review finds no blocking document defect. Disposition its two nonblocking items by making the six-reduction S-C coupling explicit (adding guidance alone is 4,088 tokens) and naming existing effect-reconciler cost within C6/C8. Target budget/implementation sign-off remains open.

## 2026-10-29 — Reassess current progress and repair admission integration (uncommitted)

- Fresh full-source validation found four failures rather than inheriting the older green results. Match the starter's exact protected-path expectation to the approved admission modules; propagate metadata-test cleanup errors instead of swallowing them; preserve relocated Git's helper path in the submodule fixture while retaining isolated Git configuration.
- The real starter and generated-feature workflows keep their attention, review, test-population, browser-cancellation and commit-preservation assertions. Built UAT also reproduces a stale eleven-versus-twelve browser population expectation; retain the exact twelve-case assertion and report the observed receipt count. Final exact-source CI passes 1,237 tests/202 suites with zero failures/skips. Node 26.3.0 and 22.12.0 each pass 149 built UAT scenarios and the full shipped-bundle feature loop (89 app/12 browser-source-server neutral; 116/16 evolved). [Exact local evidence](docs/audits/2026-10-29/reassessment-validation.json), not qualification.
- Files: `packages/kernel/test/{starter,repo-layout}.test.ts`, the starter's `server/test/rate-metadata.test.ts`, `tools/uat/uat.mjs`, canonical protected-path documentation, plan and October 29 reassessment/review records. No product-policy, dependency, kernel-schema/port, quality-budget, qualification, commit or push change.

## 2026-10-29 — Composed abuse controls and production UI validation (uncommitted)

- Recipe 0.3.3 repairs sign-in route overrides bypassing the existing default IP ceiling. Independent early IP admission now composes with the unchanged per-account check; quota/retry/correlation headers and public problem responses remain intact. Three application regressions include a real held SQLite writer. A scratch naive-hook mutation proves the five-attempt control catches skipped account enforcement.
- Preserved all browser assertions against a new current-source production UI build in an owned temporary directory, with the real source API and allocated port/token. This replaces development-only duplicate-effect traffic in the shared cohort; limits, credentials and assertions are unchanged. Output/cache is removed on fixture exit.
- Recorded pre-repair memory diagnostics for startup/hash batches/full workloads on current/minimum Node. RSS spikes and runtime heap headroom remain open; no cryptographic/concurrency reduction, forced GC or memory-fix claim.
- Files: neutral/loan app composition, new `server/test/abuse-limits.test.ts`, both browser-server fixtures, recipe/version/count/payload metadata, starter README/architecture/hardening, canonical progress/testing facts and audit records. Final isolated CI passes 1,237 tests/202 suites, zero failures/skips; both runtimes pass 149 built UAT scenarios and full 85-app/15-browser loops (59/11 neutral). Preserve the initial Git-hook failure, unchanged deadline, three focused passes and improved diagnostics in the validation record; cause is unconfirmed. The current full workload remains failed/unqualified. No commit or push.

## 2026-10-29 — Local fixture workload tooling (uncommitted)

Files: the loan golden test and fixture `workload/`, package/typecheck metadata, production-entry export, workload tests and usage docs; canonical testing/progress docs and audit working index.

Validation: final full CI 1,237 tests/202 suites, zero failures/skips; built current/minimum feature loops 82 app/15 browser cases each; unchanged shipped artifact 149 base UAT scenarios per runtime. Exact source/artifact identities and failed workload observations are recorded in the October 29 audit.

- Added a production-process reference workload to the loan golden fixture, with a full isolated dataset, real authentication, twenty clients, 70/20/10 operations, timed collision/sign-in probes, an independent SQLite writer, validated response percentiles, server RSS/event-loop metrics and database invariant/cleanup checks. Added fixture scripts, typecheck coverage and usage documentation; the neutral starter and recipe 0.3.2 dependency graph are unchanged.
- Added fourteen workload controls, including real-process non-qualifying smoke, percentile/coverage/failure controls, refusal to reset existing databases and a red-first seeded-inventory regression. The full measurement exposed insufficient client inventory; the corrected run has no invalid returns. Integrated the complete fixture into the actual golden baseline/candidate loop with stable package/typecheck metadata so the kernel's red-invalidation guard remains effective.
- Removed unnecessary shared-signal listeners from per-client pacing after a red-first real-process Node 22 warning control; cancellation remains bounded without suppressing or raising listener limits. The minimum full run has 9,247/9,460 rate refusals and 297,517,056-byte peak RSS. Both final runtimes remain unqualified.
- The corrected current-runtime 30-second warm-up/120-second observation failed: 9,248 rate refusals from 9,461 operations, only 213 successful samples and peak server RSS 331,710,464 bytes. The existing rate/security controls remain active. Workload receipts/trends/attention and reference-hardware qualification remain open. See the October 29 audit findings and validation record for final gates, exact identities and limitations. No kernel policy/budget expansion, qualification, commit or push.

## 2026-10-28 - Validate application schema history before migration and restore

**Changed.** Recipe `ts-web-api@0.3.2` shares checksum/forward-only history admission between migrations and backup restore. Reject retroactive migrations before backup/application, reject incompatible or unrecorded schemas and foreign-key-invalid copies before replacing live data, and revalidate copies during interrupted recovery. Foreign-key postflight now runs inside each migration transaction, so failure rolls back its SQL and ledger row. Existing durable ownership/marker/aside/rollback behavior stays in place.

**Quality.** Add six real SQLite history/refusal/recovery controls, including actual SIGKILL and rollback after backup mutation. A frozen, independently built schema-1 fixture preserves old users, hashes and a valid session through the real loan upgrade, automatic backup, authentication, new feature, restore and re-upgrade. A scratch-only destructive migration control fails its preservation assertions. Frozen SQL bytes match base Git revision; no current migration/seed helper builds the old data. Final CI passes 1,237/202; both runtimes pass 149 built UAT scenarios plus the complete feature loop, including neutral 56/11 and evolved 68/15 app/browser cases. The complete payload has 83 files. Exact results/limits are in schema-history-validation.json and plan.md. No dependency/lock or kernel protocol/state/port/authority/budget change, qualification, commit or push.

## 2026-10-28 - Honor SQLite contention in loan returns and session writes

**Changed.** The generated loan fixture now reads the loan, checks ownership/status, updates it and forms the response inside one existing immediate transaction. Under contention, a second return receives the established conflict rather than falsely acknowledging success. Recipe `ts-web-api@0.3.1` also uses the existing bounded write helper for session maintenance and sign-out deletion, returning 503 and preserving the cookie/session when a writer remains busy. The template remains domain-neutral.

**Quality.** A held SQLite writer and five real service processes reproduced five successful responses for one loan. Add owner/admin and wrong-member controls with deterministic barriers, isolated databases and bounded child cleanup. Require one winner, four 409s (or four 403s for unrelated members), the exact persisted winner timestamp and clean foreign keys. Preserve all API/browser cases and update the golden task’s scope/count. Two additional HTTP lock windows reproduced 500s in session refresh/sign-out; test bounded retries, retained session/cookie and successful read/sign-out recovery. Current/minimum focused checks pass 61 evolved app and 15 browser cases. Inventory 82 payload files; no dependency or lock change. Final full CI passes 1,237/202; both runtimes pass 149 built UAT scenarios plus the complete feature loop, with neutral 50/11 and evolved 61/15 app/browser cases. Exact identities, red controls and scope are in return-concurrency-validation.json and plan.md. No kernel source, API shape, authority, state, port or budget change; no commit or push.

## 2026-10-28 - Generate the starter API contract from runtime schemas

**Changed.** Recipe `ts-web-api@0.3.0` generates OpenAPI 3.1 through the specified Fastify Swagger/Zod integration. Account and health routes declare shared success/problem response schemas and cookie/CSRF metadata. `npm run --silent openapi` exports JSON using an ephemeral database, without reading ambient configuration or opening a listener. The loan fixture contributes real feature paths, bounded pagination, nullable return and borrower-private/admin response contracts. Runtime authorization stays in the existing hooks/services.

**Validation and delivery.** Test-first missing-generator and missing-feature-metadata controls; added/changed-schema discovery, deterministic real-process export, poisoned database/config preservation, actual auth responses and full browser preservation. Add explicit Swagger 9.9.2 dependency without changing any resolved package version; update recipe/lock, 81-file payload, CI export, starter docs/skill and direct dependency/license inventory. Targeted kernel scaffold/receipt/commit/Chromium-cancel and loan evolution pass. Final full CI passes 1,237/202; both runtimes pass 149 built UAT scenarios plus the complete generated feature journey (57 app and 15 browser cases). Neutral starter checks pass 48 app and 11 browser cases, with byte-identical six-path export. Exact identities are in openapi-validation.json and plan.md. Compatibility findings/trait/semver enforcement, manual accessibility, workload/applicability and qualification remain open. Clean install retains an upstream ESLint deprecation notice. No kernel authority/state/port/budget change, commit or push.

## 2026-10-28 - Exercise the loan increment through the browser

**Changed.** Extend the golden loan-desk fixture with Equipment navigation, paginated availability/own-loans/admin views and reserve/return confirmation through fresh server reads. Add actor-scoped `GET /api/loans` so reload can recover the borrower’s persisted loans without exposing another member. Keep the shipped recipe domain-neutral.

**Quality.** Test-first API 404 and missing-browser-view controls; four domain browser scenarios preserve eleven platform/server cases. Cover real SQLite persistence, two-context conflicts, direct owner/role denial, admin identity, loading/empty/pending/refusal/retry, axe/keyboard and mobile overflow. Register the domain journeys and unobserved manual procedure. The kernel golden journey can also drive the built CLI for UAT; its list flags use the actual comma-separated CLI contract. A full-gate failure exposed a partial PID-marker read in an existing timeout test; publish that test-only marker atomically. The synthetic review submissions are not native observations. Final CI passes 1,237 tests/202 suites; both runtimes pass 53 app tests, 15 browser cases, 148 built UAT scenarios and the built-CLI domain journey. Exact identities and failed-run dispositions are in the plan and domain-ui-validation.json. Manual accessibility, date-interval reservations, changed-journey enforcement and full qualification remain open. No commit or push.

## 2026-10-28 - Add the starter's React/Vite account journey

**Changed.** `ts-web-api@0.2.0` now includes a source-bound React/Vite account shell over the existing API: validated sign-in, independent session confirmation, reload persistence, sign-out confirmation, pending/error/retry states, input retention, duplicate submission guards and heading/error focus. Shared CSRF response validation is reused by client/server. The application template remains free of domain features.

**Quality.** Nine real Chromium account cases plus two source-server cases cover keyboard navigation, axe scans, real cookies/CSRF/SQLite, synthetic denial/conflict/network failures, revoked sessions and retry. A real kernel test scaffolds/checks/commits the recipe and cancels a live Chromium process. The first browser red proved the absent sign-in page; a later browser failure caught validation moving the submit button during blur, fixed by reserving error space. A test DOM typing error was corrected before passing the integrated check.

**Dependencies and delivery.** Pin React/React DOM 19.3.1, Vite 8.3.5, matching React types and axe Playwright 4.14.0. Retain coherent TypeScript-ESLint 8.55.0 because the newer checked dependency chain excludes Node 22.12; no unsupported visitor-key override or runtime-floor increase. Final registry audit reports zero advisories. Update the lock hash, explicit 78-file payload, template CI (both runtimes, engine-strict install/build/browser checks), recipe skill, journey registry, accessibility procedure, architecture/hardening docs and existing loan-evolution fixture's shared CSRF export. No kernel schema, port, authority or cap changed.

**Validation.** Both runtimes pass 45 starter unit/integration tests, types/lint/build; minimum Node also passes engine-strict installation and all 11 real browser/API cases. The real kernel scaffold/receipt/commit/cancel test and loan-feature evolution pass locally. Final full repository CI passes 1,237 tests/202 suites, zero failures/skips; 148 built CLI scenarios pass on each of Node 26.3.0 and 22.12.0. The unchanged 776,837-byte kernel bundle has SHA-256 `77378e987b04abbe05799d064b425d15716c7698af87865d246895b3a3093ecb`; complete 78-file payload and repeat-build checks pass. Final prerequisite-only doc edits have fresh lint/build/integrity/repeat-build verification. Exact source/artifact/results are in starter-ui-validation.json; actual-addition privacy and whitespace checks pass. Desktop/mobile screenshots were inspected. Domain UI, manual screen-reader observations, workload, OpenAPI, ASVS applicability/results and complete qualification remain pending. No commit, push, model/native-host run or release.

## 2026-10-28 - Close output-definition and recovery failure counterexamples

**Changed.** Declared output patterns now bind check-input identity and baseline retention. Stable-ID additions/removals cannot reuse an earlier red; unchanged definitions preserve proof and a fresh red restores acceptance locking. A recovery refusal renders the actual published transaction revision. Forget uses bounded no-follow packet reads, propagates enumeration/read/delete errors and distinguishes inaccessible temp roots from absence, retaining its lesson and intent until recovery can finish.

**Modified files.** Kernel `core/obligations.ts`, `verbs/facts.ts`, `pipeline-mutate.ts`, `adapters/store-fs.ts` and the corrected `Store.purge` comment; real-process evidence/forget tests and built UAT. Canonical notes, migration progress, audit review packet and plan updated. No schema, dependency, port signature or cap increase.

**Validation.** Red controls reproduce three output-definition failures (including false checked-local after fresh review), a recovery response at revision 5 versus disk 8, five packet failure cases, and inaccessible temp-parent false success. Focused controls pass. Final full CI passes 1,237 tests/202 suites, zero failures/skips; 147 built CLI scenarios pass on each of Node 26.3.0 and 22.12.0, same 776,837-byte bundle SHA-256 `77378e987b04abbe05799d064b425d15716c7698af87865d246895b3a3093ecb`. Actual-addition privacy and whitespace checks pass; exact evidence is in continuation-validation.json. An initial full gate caught a newly unused import, which was removed. The old bundle failed the new output UAT before rebuild. Exact final evidence follows in continuation-validation.json. No qualification, native host, commit or push.

## 2026-10-28 - Sync GitHub and implement approved store and forget repairs

**Changed.** Fast-forwarded main to upstream `8b7bbc4`, preserving local work, initial owner decisions and all inherited worktrees. Added the synchronized reassessment and revised the completion order: approved MC-2 and schema-1 forget precede unsigned schema-2/configuration activation; R08 remains owner-deferred. Upstream cleanup, verdict and skill/documentation improvements are included.

**Repairs.** Existing store maintenance now follows lock acquisition and fresh compatibility admission. Quarantine tightens permissions under its bootstrap lock before moving records; owner-unwritable existing directories fail explicitly. Forget journals IDs, purges only lesson packets before two publications, records completion and recovers after interruption. Read-only `Tx.state` follows the actual publication, fixing response/cache/call revision drift. Unknown-lesson retry preserves recovery notes without a new reason code or response shape. Run ownership records and check reports survive matching lesson text.

**Modified files.** `adapters/store-fs.ts`, `decisions/forget.ts`, `verbs/recover-effects.ts`; two real-process suites and fixtures; built UAT and crash wrapper; technical specification, feature status notes, plan, changelog and audit artifacts. The explicit October 27 under-1% approval pays for the measured shared delta: 241,047 → 241,776 characters (+729); existing headroom limits the cap increment to 10 lines (0.24%), 241,229 → 241,805. Store remains within its unchanged cap. No port signature, state schema or dependency change.

**Validation.** Synchronized baseline full CI passes 1,204 tests/196 suites. MC-2 red run has nine failures and three controls, then all 12 pass; existing store/quarantine/boundary regressions pass 94/94. Forget red run has eight failures and one control; all 22 new/existing forget/lesson tests pass, including five real SIGKILL points, backup fallback, live-child preservation and lost-response retry. All three FG-4 controlled mutations fail, then source is restored. Minimum-Node LA/FG tests pass 22/22 with inherited experimental type stripping. Final full CI passes 1,226 tests/198 suites with zero failures/skips; 139 built UAT scenarios pass on each runtime against the same 776,671-byte artifact, SHA-256 `17f036f941e8d116233f430542f50a2d30b8d3fa658f06b5c9791e5987447149`. Exact evidence is in `docs/audits/2026-10-28/synced-validation.json`. Actual-addition privacy/whitespace checks pass. The validated MC-2 spec is archived with one explicit `.gitignore` file exception; unrelated archive contents remain ignored. New work remains local ◐, with independent implementation review, requested commit and remote validation pending. No commit, push, native-host run, model call or qualification.

## 2026-10-28 - Audit implementation and repair evidence/privacy admission

**Changed.** Reviewed current source against the canonical specs and code-quality preferences; added a detailed gap report, a draft index of all 181 Musts and 19 Shoulds due by R1, and a dependency-ordered completion plan under `docs/audits/2026-10-28/`. The authoritative evidence ledger remains unchanged and empty; no qualification is inferred.

**Repairs.** Playwright command metadata now uses the bounded, exclusion-aware stack reader; installed Playwright version and ignored configuration participate in evidence freshness; e2e receipts identify Playwright rather than Vitest. `node-ts@11` conservatively invalidates previous evidence through the existing adapter-version pause. Own-property guards reject inherited verb/decision/setting/reason names. Structured proposals containing likely-secret material are refused before persistence; existing request/quote redaction is retained, and structured semantics are never silently rewritten. The documented GitHub fine-grained token and Cookie/Set-Cookie redaction formats have red-first controls and are now covered. The same heuristic limits apply; historical record erasure is not claimed.

**Modified files.** Kernel `adapters/node-ts.ts`, `adapters/playwright.ts`, `core/config.ts`, `core/input.ts`, `core/obligations.ts`, `core/reasons.ts`, `core/redact.ts`, `pipeline.ts`, `verbs/check-evidence.ts`, `verbs/decide.ts`; regression tests and built UAT; audit artifacts, technical implementation notes and plan. Duplicate receipt-context construction was consolidated within the existing budget. No state schema or dependency manifest changed, and no budget was raised.

**Validation.** Unchanged baseline: full local CI 1,177 tests/192 suites and 129 built UAT observations. Initial evidence/registry repairs: 17 regressions and 112 affected tests pass; full local CI 1,194/194 passes. The later persistence counterexample required its own red/green cycle: privacy/admission suite 31/31 on Node 26.3.0 and 22.12.0. Final full CI passes 1,196 tests/195 suites, zero failures/skips; 133 built UAT scenarios pass on Node 26.3.0 and 22.12.0 against the same 776,152-byte bundle (SHA-256 `7de9a0ce8096b16cb92520a166e9087f1c4cbfe9e8a58ae6e7e2a42a99b724b2`). Final full-tree results and exact artifact identities are recorded in `docs/audits/2026-10-28/validation.json`; all work remains local `◐` until independently reviewed, committed and remotely validated. Initial owner-decision spec edits and four inherited worktrees were preserved. No native-host run, model call, qualification, commit, push or release.

## 2026-10-27 - Assert the unsupported Windows workflow boundary

**Changed.** `packages/kernel/test/workflows.test.ts` now verifies the documented `capability-missing` refusal, absent handle and absent state for the EVD-07 feature workflow on Windows. The full assurance and control assertions remain unchanged on supported POSIX; runtime behavior is unchanged.

**Validation.** The focused Windows regression passes 1/1; typecheck and all linters pass. A full `npm run ci` attempt reached tests but hit Windows `EPERM` on POSIX directory `fsync`; the unsupported run was stopped, so no full-suite pass is claimed. POSIX workflow execution and host rendering remain unverified. `specs/plan.md` records this limit.

## 2026-10-26 - Preserve human and active files during automatic cleanup

**Changed.** `packages/kernel/src/adapters/store-fs.ts` refuses to enumerate already-linked manifest/review groups during run-cap cleanup, matching the existing age-sweep safeguard. Both cleanup paths now use the native separator when protecting a live descendant. No deletion scope, authority, storage format or budget changed.

**Tests and review.** `packages/kernel/test/store-boundary.test.ts` adds four real-filesystem controls: linked manifest/review targets retain their human bytes and links; cap and age cleanup still remove owned expired artifacts while retaining active descendants/reservations, without protecting sibling prefixes. Three controls failed before the fix; restoring the old age-sweep separator also makes the fourth fail. `.github/workflows/untrusted.yml` runs the focused controls on Windows, guarded by `packages/kernel/test/ci-security.test.ts`. The owner approved the bounded repair; independent caller/boundary review found no blocker.

**Validation.** Windows Node 24.22.1 passes the existing 236-test/32-suite selection and four cleanup controls, typecheck, all lints, M0 coverage, build, complete payload integrity and clean-output repeatability. Built scratch help/status and unsupported editing refusal preserve the exact scratch listing with no project state. `specs/plan.md` records the defect and evidence. Full supported-POSIX CI and dual-runtime feature UAT on these local edits remain required; Windows mutation, concurrent replacement and aggregate retention are not qualified.

## 2026-10-26 - Reconcile implementation evidence and strengthen verdict proof

**Changed.** Added direct baseline/exclusion and partial-outcome controls in `packages/kernel/test/verdict.test.ts`, without enabling sealed-baseline execution. Corrected `README.md`, `plugin/README.md` and `docs/user/what-tenet-adds.md` to distinguish git-ignore from host-indexing privacy, observed dispatch from unproved isolation, conditional basis confirmation and local subsets from full remote CI. The coordinator skill inventory now includes the existing `lesson`, `forget`, `cleanup` and `version-reconcile` kinds. No new decision kind, authority, state format or kernel behavior was added.

**Plan.** `specs/plan.md` records the synchronized `159caab` pickup, current green CI, the exact 50 unmapped Musts, corrected stale checklists and dependency-ordered next work. The evidence ledger remains empty; 115 tagged Musts are not 115 complete or qualified requirements. Full R1, unsigned mechanism implementation and native/human/release gates remain open.

**Storage policy.** Owner selected PRD §5.15's eviction order; `specs/tech-spec.md` and `specs/storage-retention.md` align that policy. Aggregate eviction, snapshot/archive mechanisms, protected retention and final implementation sign-off remain open; no storage runtime changes are included.

**Validation.** A controlled mutation of the baseline-exclusion predicate made the new assertion fail; production code was restored before the focused **51/51** green run. Final typecheck, all lints, M0 coverage and integrated Windows selection pass **236 tests / 32 suites**, zero failures/skips. Skill lint, build, 66-file payload verification and same-source/toolchain repeat builds pass. Full Linux/macOS CI and dual-runtime built UAT passed at pickup `159caab` in [run 40270175062](https://github.com/vedprakash-m/tenet/actions/runs/40270175062); that evidence does not validate these later local edits or qualify a host tuple. Independent review retained explicit failure-kind/signature and final excluded-failure-listing gaps instead of claiming full AC-27 completion.

## 2026-10-26 - Isolate report-integrity Git-state assertions

**Changed.** `packages/kernel/test/coverage.test.ts` now invokes the actual report-integrity CLI in an owned initialized Git fixture rather than comparing a live shared checkout. It retains exact requirement/evidence hashes and whole Git status, with staged, unstaged and untracked changes explicitly present. No runtime behavior, concurrency or assertion is weakened.

**Validation.** Full Linux/macOS CI and dual-runtime UAT passed in run `40268539603`; Windows exposed changing live-checkout status whose producer was not established. After isolating the observation, the integrated Windows-safe selection again passes 234 tests/32 suites without skips, plus typecheck/lints/privacy/whitespace. The follow-up requires its own full CI/UAT; earlier failed runs remain recorded in the plan.

## 2026-10-26 - Isolate machine-residue regression fixtures

**Changed.** `packages/kernel/test/residue.test.ts` now uses a uniquely owned canonical temp namespace and restores the original temp environment on cleanup. A final documentation-only CI run exposed another parallel test process adding an OS-temp directory between whole-listing assertions. Exact no-mutation/retention assertions and real kernel behavior remain unchanged; test concurrency and runtime cleanup policy are not weakened.

**Validation.** Added a passing isolated-namespace setup regression on Windows; typecheck/lints/privacy/whitespace pass. Run `40266255726` retains the original Ubuntu failure and passing macOS/full UAT and Windows results; the test-only correction requires its own full supported-POSIX CI/UAT. The prior reproducibility implementation baseline remains green at `19b7cdc`.

## 2026-10-25 - Windows reproducibility verification and macOS handoff

**Changed.** Added `tools/reproducible-build.ts` and `npm run verify:reproducible`: two independent empty output builds using the same source/toolchain, complete payload/hash comparison, observed-input-change refusal, recorded versions and owned cleanup. Refactored `tools/build.ts` into an import-safe build operation with validated independent staging; shared inventory helpers in `tools/payload.ts`. Default build and size budgets remain unchanged. Package/full CI and Windows workflow/regressions invoke the new checks.

**Validation.** Added eight real-build and failure controls in `packages/kernel/test/reproducible-build.test.ts`, after observing the missing-module red. Integrated Windows-safe selection passes 234 tests/32 suites on Node 24.22.1; minimum-runtime selection passes 57 tests/five suites on Node 22.12.0, with no skips/failures. Typecheck, all lints, coverage, build, payload verification and actual repeat-build CLI pass. This is not independent source/dependency reproducibility, installed verification, authenticity or signing.

**Pushed evidence.** Implementation `e83cbc7` and documentation `19b7cdc` are on `main`; [CI run 40264544000](https://github.com/vedprakash-m/tenet/actions/runs/40264544000) at `19b7cdc` passes all Windows/Linux/macOS jobs, including full supported-POSIX CI and built UAT on current/minimum runtimes. Native qualification and release gates remain open.

**Documentation.** Contributor and technical-spec build notes state the bounded scope. Plan/harness/replay records reconcile the earlier green cross-platform run, distinguish implemented synthetic offline helpers from native/full-pipeline evidence, and record the macOS pickup sequence and remaining owner/native/human/release gates. No native campaign, account, capture, model spend, publication or qualification is implied.

## 2026-10-25 - Align inherited launch-failure regression

**Changed.** Updated the existing missing-executable test in `packages/kernel/test/host-cli.test.ts` to assert `ENOENT` rejection and no observation/transcript, matching explicit launch-error propagation. First pushed CI passed Windows but both POSIX suites exposed this stale expectation as their sole failure; no runtime assertions were weakened. Plan records the remote evidence and pending rerun.

## 2026-10-25 - Preserve host-runner launch errors

**Changed.** `tools/host/copilot-cli.ts` now rejects process launch errors rather than publishing ambiguous null-exit observations. Its deadline is cleared in `finally`, including rejection. Added `packages/kernel/test/host-launch.test.ts` and both Windows runtime CI selectors; updated harness/plan records.

**Validation.** Three offline controls pass on Node 24.22.1 and 22.12.0: missing executable rejects with `ENOENT` without observation/transcript output, an isolated controller exits promptly after rejection, and an actually started process's nonzero exit still produces the ordinary observation. These tests launch only the local Node executable or a nonexistent fixture path, with no live host/model activity. Typecheck/lints pass. Existing stop/timeout flags, group termination and POSIX interruption assertions remain unchanged; the macOS failure is not claimed fixed.

## 2026-10-25 - Doctor agrees with blocked platform readiness

**Changed.** `packages/kernel/src/verbs/inspect.ts` no longer returns overall success when assistance is blocked at L0, even if all individual dependency checks pass. It reuses one readiness result, keeping the existing source-size budget unchanged. Added red-first supported/unsupported-platform controls to `packages/kernel/test/platform.test.ts` and clarified the diagnostic in the install guide.

**Validation.** All 11 platform controls pass, including darwin/Linux success and Windows/FreeBSD failure with otherwise healthy probes; typecheck, lints, build and complete-payload verification pass. Actual built-bundle doctor UAT on Windows with installed supported dependencies and configured Git has all named checks passing but correctly returns L0, `ok: false`, exit 2 and `blockedBy: ["platform"]` on both Node 24.22.1 and 22.12.0. Help/status still pass and editing refuses without state creation. The macOS interrupted-probe failure remains unchanged pending supported-POSIX process evidence; no timeout flag or assertion was weakened.

## 2026-10-25 - Local payload inventory and minimum-runtime regressions

**Changed.** Added the explicit 66-file preview inventory in `tools/payload-files.json` and deterministic exact-byte checksum generation/verification in `tools/payload.ts`. The build invalidates stale `SHA256SUMS` before compilation and refuses missing, extra, linked or nonregular files. `npm run verify:payload` checks the complete local payload; full CI invokes it after building. Generated checksum metadata is ignored and excludes only itself from hashing.

**Corrected during integration.** Parallel project-local fixtures changed checkout-wide Git status during another test's no-mutation assertion. Tooling/evaluation fixtures now share a canonical ignored parent through `tools/test-scratch.ts`, with unique owned-directory cleanup. Real Windows Node 22.12 execution also exposed incompatible `lstat`/`fstat` device IDs: bounded reads now use additional Windows path-opened descriptors for strict same-API volume identity, without dropping device checks. POSIX direct comparisons and all replacement/link controls remain. The untrusted workflow adds a focused Windows job for Node 24 and minimum-runtime evaluator/payload checks; full POSIX jobs remain unchanged.

**Files and validation.** Build/payload tooling, inventory, package scripts, scratch helper, protocol reader and tests, CI workflow/regressions, contributor documentation, evaluation/technical specs and plan. Red controls reproduced checksum/inclusion failures, stale manifests, scratch Git-status pollution and minimum-runtime file refusals. Final Windows checks pass **222 tests / 30 suites on Node 24.22.1**, plus **54 tests / four suites on Node 22.12.0**, without skips. Typecheck, lints, coverage, build, complete-payload verification and built minimum-runtime help/status/review/platform-refusal smoke pass. Independent fixture builds have identical hashes; independent clean release builds, installed verification, authenticity, remote CI and full POSIX UAT remain unproven. No commit, push or publication.

## 2026-10-25 - Local-main portability and correctness repairs

**Changed.** Central mutation admission now returns `capability-missing` on unsupported platforms before state access, as TS §4.9 requires; read-only/stateless operations remain available. Build/compiler launch, architecture/skills/quality paths and coverage parsing handle Windows paths and CRLF without weakening their gates. Existing CI actions use immutable official commit references. Offline evaluation now retains safety failures across all attempts, scopes review truth correctly, withholds incomplete metrics, preserves unknown JUnit outcomes, normalizes optional/unordered inputs, and reports reversed concurrency intervals as unknown. Bounded file admission rejects observed linked ancestors/leaves and identity replacements; it does not establish atomic containment against transient ancestor swaps.

**Modified files.** Kernel pipeline/platform wiring and regressions; tooling/build/coverage and regression tests; evaluation protocol/report readers, helper and tests; root/starter workflows; contributor/install documentation; evaluation specs, technical budget and implementation plan. No dependency or schema semantics changed.

**Validation.** Windows x64 / Node 24.22.1: 208 focused tests pass, with no skips; typecheck, all lints, M0 coverage, build and whitespace checks pass. Built-bundle smoke covers help, status, advisory review and mutation refusal without state creation. Actual unstaged/new additions pass the privacy scanner. Full supported-POSIX CI/UAT, minimum-runtime validation of this artifact, the upstream macOS interruption failure, owner contracts and qualification remain open. These are local repairs, not completed feature lifecycle or release qualification; nothing was committed or pushed.

## 2026-10-25 - Owner decision: implement offline campaign reporting

**Changed.** Under owner decisions 38 A and 39 A, implemented strict bounded report input validation, denominator-preserving aggregation, safety/review/cost metrics, exclusions and diagnostics, deterministic JSON/Markdown/JUnit rendering, and the stdout-only `npm run eval:report` CLI. Exact input-byte hashes remain distinct when reordered inputs produce the same derived results; only completed attempts establish known pass/fail. Seventeen focused report tests pass on Node 26.3.0 and 22.12.0; full CI passes 1,118 tests/184 suites. No live operation, capture or qualification.

## 2026-10-25 - Owner decision: draft offline campaign report contract

**Changed.** Owner selected A to draft and independently review `specs/eval-report.md`. The contract defines strict local input, retained slots/attempts/exclusions, explicit metrics/denominators/unknowns, cost scopes, deterministic JSON/Markdown/JUnit formats, and non-authoritative eligibility. Two read-only reviews' findings are dispositioned; JUnit importer compatibility remains explicitly limited. No report code or live operation was authorized.

## 2026-10-25 - Owner decision: pure-helper offline replay

**Changed.** Owner selected A to implement `ObservationReplayV1` over hand-authored synthetic events using pure `tools/host/evaluate.ts` helpers. Added bounded fixture validation, deterministic comparison, fail-closed selection attribution, `npm run eval:replay`, and ten replay tests. Final CI passes 1,101 tests/183 suites. No capture, full kernel replay, host, model, network, account or spend activity.

## 2026-10-25 - Owner decision: draft offline observation replay contract

**Changed.** Owner selected A to draft and independently review `specs/eval-replay.md` for hand-authored synthetic events through pure observation helpers only. Seven review precision findings were dispositioned; sample output matches current helpers. Replay implementation and all capture remain unapproved; no code or data was added.

## 2026-10-25 - Owner decision: static protocol validator implementation

**Changed.** Owner selected A and signed the static `StaticProtocolV1` contract for offline implementation. Added shared qualification-tuple schema, strict protocol validation, duplicate-key detection using existing `yaml`, bounded local reference/hash checks, CLI `tools/eval.ts` / `npm run eval:validate`, and eight focused tests. All eight protocol tests pass on Node 22.12.0 with strip-types; final CI passes 1,091 tests/182 suites on Node 26.3.0. No new dependency. Trusted authorization, subject-payload verification, native UI, replay execution, capture, account, network and spend remain out of scope.

## 2026-10-25 - Owner decision: draft offline protocol contract

**Changed.** Owner selected A to draft and independently review the offline protocol contract. Added `specs/eval-protocol.md` for static `StaticProtocolV1` validation only; six review precision findings incorporated. Decision 34 A later approved its static implementation. Trusted execution authorization remains deferred.

## 2026-10-25 - Offline evaluation evidence corrections

**Changed.** `tools/host/evaluate.ts` now requires explicit denial evidence, associates it with the exact tool-call ID, reports ambiguous attempts as unknown and incomplete/invalid concurrency intervals as null. Added three red-first SP-08 synthetic controls. Focused offline tests pass 5/5; full `npm run ci` passes 1,083 tests/181 suites. Native event-code meaning remains unobserved, and no host qualification is claimed. No live calls or capture.

## 2026-10-25 - Owner decision: G0 offline implementation sign-off

**Changed.** Owner selected A and signed the harness spec for bounded offline protocol/admission, synthetic replay and reporting implementation only. Native UI, model calls, capture, account/OS setup, spend and live CI remain unapproved; G1/G2 are not passed. Updated harness status, plan and audit.

## 2026-10-25 - Owner decision: reviewed synthetic fixture eligibility

**Changed.** Owner selected A: only minimized synthetic derivatives may be proposed as public fixtures after individual privacy/security review and explicit owner approval. Raw captures and reachable history are excluded; no automatic publication or history rewrite. Updated harness, plan and audit. Capture and publication remain unauthorized.

## 2026-10-25 - Owner decision: local-only artifact destination

**Changed.** Owner selected A: raw captures and reviewed metadata/replays are intended for encrypted, access-controlled local storage on the dedicated evaluation machine, excluded from repositories, sync, CI artifacts and backups. Actual encryption, ACL, isolation and deletion controls remain unverified and must be proven before capture. Updated harness, plan and audit. No setup or data collection authorized.

## 2026-10-25 - Owner decision: least-privilege reviewed-artifact access

**Changed.** Owner selected A: private reviewed metadata/replays are limited to the designated operator, privacy/security reviewer and specifically assigned engineers. CI may consume only individually reviewed fixtures approved for that use; it cannot browse the private archive. Updated harness, plan and audit. Destination and capture remain undecided/unapproved; no data collected.

## 2026-10-25 - Owner decision: least-privilege raw-capture access

**Changed.** Owner selected A: raw captures are limited to the named evaluation operator and designated privacy/security reviewer; protected graders receive only minimum case-specific inputs through D-06; no general agent/CI access to stored raw captures. Updated harness, plan and audit. Reviewed-artifact access and destination remain undecided. No capture or data access occurred.

## 2026-10-25 - Owner decision: minimal evaluation-capture purpose

**Changed.** Owner selected A: any separately authorized capture is limited to minimum synthetic evidence for independent grading or reproducible diagnosis of a named failure; no general analytics, model training or general session recording. Updated harness D-05 and plan/audit. Retention decisions 19/20 are unchanged. Access, destination, publication, capture and live execution remain unapproved; no data collected.

## 2026-10-25 - Owner decision: shared-account policy alignment

**Changed.** Owner selected B: amended PRD 5.9.3/6.4.3 and TS 17.5/17.6 to allow a shared existing account in bounded serialized windows with explicit attribution uncertainty. Included allowance only, no paid overages, and verified provider/organization hard blocking are mandatory; otherwise live runs stay blocked. Updated harness, plan and launch audit. No account access, spend, setup, capture, live execution or runtime implementation authorized.

## 2026-10-24 - Owner decision: protected grading boundary

**Changed.** Owner selected A: candidate code must remain unable to access hidden graders/canaries/credentials, alter controller or authoritative results, or use unapproved egress while grading probes execute. A separate process alone is insufficient. Updated harness D-06/HE-AC-04, plan and audit. OS-enforced mechanism and negative proof remain open; G2 blocked. No setup, account access, case, capture, spend or live execution authorized.

## 2026-10-24 - Independent harness specification review

**Changed.** Dispositioned six read-only review findings in harness, plan and audit: corrected tooling inventory, retention criteria, grading inputs and initial/formative batch distinction. Recorded the now-selected candidate-probe boundary requirement, plus the unresolved canonical account conflict and CLI observation inference risks. No runtime repair/test, canonical account amendment, G0 approval, host setup or live execution claimed.

## 2026-10-24 - Owner decision: bounded initial feasibility limits

**Changed.** Owner selected A: one worker, at most two initial cases, 20 minutes per ordinary case, no automatic retries. Replaced the draft multi-cycle proposal; further batches/special long-running cases need separate authorization. Updated harness, plan and launch audit only. No named case/call, capture, setup, implementation, live or spend approval; enforcement/isolation and finite usage/dispatch limits remain open.

## 2026-10-24 - Owner decision: dedicated local evaluation OS user

**Changed.** Owner selected A as isolation strategy: dedicated local OS user, existing approved identity after manual sign-in, no primary profile/keychain copying, synthetic fixtures only. Updated harness draft, plan and launch audit. Setup and filesystem/credential/network negative-boundary proof remain open; no containment claim or OS/account/host change, live/spend/capture or implementation authorization. Documentation only.

## 2026-10-24 - Owner decision: no additional paid evaluation usage

**Changed.** Owner selected A: included allowance only, no additional paid usage/overages, paid fallback, purchases or account switching. Verified provider/organization enforcement is required before separately approved live calls; absent proof keeps them blocked. Zero additional charges is not unlimited execution or free included credits. Updated harness, Q-16, plan and launch audit only; usage/case limits, identity/terms, isolation and live-run gates remain open.

## 2026-10-24 - Owner decision: existing-account evaluation strategy

**Changed.** Owner selected B: existing Copilot account in bounded serialized evaluation windows, with attribution uncertainty disclosed. Updated Q-16, harness D-02, plan and launch audit. Identification, permitted-use checks, external cap/enforcement, isolation and live-run approval remain open. No account access, purchase/creation/switch, credential collection, spend, execution or implementation authorization. Documentation only.

## 2026-10-24 - Owner decision: reviewed synthetic metadata/replay retention

**Changed.** Owner selected A: private reviewed synthetic metadata/replays retain 90 days after associated-run finalization. Raw capture/research/operational/migration policies remain separate; public fixtures require independent privacy review/publication approval. Updated harness draft, plan and launch audit only. No capture, harness implementation, public upload or paid execution authorization.

## 2026-10-24 - Owner decision: raw synthetic capture retention

**Changed.** Owner selected A: approved raw synthetic captures stay private and delete 14 days after finalization, earlier on withdrawal/incident where applicable. Failed/cancelled runs finalize with actual outcomes; unresolved safety references stay separate. Updated harness draft, plan and launch audit; D-05 only partly resolved. No capture, implementation, live/spend/publication authorization or runtime change.

## 2026-10-24 - Owner decision: research-data retention

**Changed.** Owner selected A: confirm research deletion 90 days after analysis unless participant separately agrees otherwise, retaining withdrawal deletion and limited access. Updated PRD §6.7, UX §14.3, plan and launch audit. Separate operational/capture/backup policies and all collection/recruitment/spend/publication authorizations remain open. Documentation only.

## 2026-10-24 - Owner decision: limited discovery aggregate consent

**Changed.** Owner selected A for Q-15: retain only the two documented totals and derived percentage with a single-user exploratory caveat. Removed project count, analysis dates and quoted prompt wording from the current PRD paragraph; raw data/scripts/identities remain private. Updated PRD, plan and launch audit. History/privacy audit remains required; no publication or history-rewrite authorization. Documentation only.

## 2026-10-24 - Owner decision: MIT for Tenet and its starter

**Changed.** Owner selected B: MIT for Tenet and Tenet-owned starter code. Added root/template LICENSE files; plugin metadata uses MIT; build copies LICENSE/NOTICE into the payload. Third-party terms/notices remain intact. Updated NOTICE, README/contribution/plugin guidance, canonical Q-03/spec wording and plan. No dependency, lockfile, kernel/runtime permission or budget change. Publication/name clearance remain unapproved.

**Verification.** Red-first packaging test and independent review pass; full CI 1,083 tests/181 suites, zero failures/skips. All 129 CLI scenarios pass on Node 26.3.0/22.12.0, including real scaffold license delivery. First full run hit an empty-JSON fixture read in existing filter-timeout coverage; isolated and unchanged full reruns pass without test/timeout changes. Legal copies match; diagnostics/diff and actual unstaged/new-file likely-leak checks pass. No commit or push.

## 2026-10-24 - Schema-1 compatibility admission hardening (local)

**Changed.** Owner approved bounded stage 15 A. Added raw schema classification and owned-store admission before state fallback, direct mutations and pipeline preLock; waiting writers re-admit, and machine cleanup retains unproven candidates. Unsafe-read failures cannot silently become fallback permission; same-schema JSON/UTF-8 corruption recovery remains. Files: versions/store/pipeline/Store port, existing store/boundary/cleanup/scenario/pinning tests, UAT and technical specification §7.7. No new schema/format, migration, WIP import or budget increase.

**Verification.** Red-first controls and independent review; full local CI 1,082 tests/180 suites, zero failures/skips (23 added tests). All 128 CLI scenarios pass on Node 26.3.0/22.12.0 against one 775,782-byte bundle. Unsafe-read/EIO, real waiting-writer and guard-bypass controls pass; actual unstaged/new-file likely-leak scan and diagnostics/diff checks pass. Store/shared budgets unchanged with 1,323/51 characters free. Large-record latency and host qualification remain unmeasured; no commit or push.

## 2026-10-24 - Proposed protocol closure and bounded bridge-stage review

**Changed.** Added proposed recovery/launch/replay and migration reference/rollback/privacy/terminal engineering tables. Focused independent review identifies schema-1 admission hardening as a separate first implementation stage under unchanged budgets. Recorded its exact scope, reserved sentinels, preservation tests and pending owner decision 15 in existing specs/plan. No runtime/schema activation, budget increase or implementation claim.

## 2026-10-24 - Owner decision: retain minimal migration completion metadata

**Changed.** Owner selected A: after backup deletion retain only operation ID, format versions, outcome and binding digest until explicit local-record removal. Exclude quotes/paths/lesson text/output/payloads; privacy overrides exact replay, and unverifiable retries refuse. Updated migration/binding drafts, plan and audit only. Concrete format/deletion/safety protocols, review, budget and final implementation sign-off remain; no runtime/schema/cleanup behavior changed.

## 2026-10-24 - Owner decision: protected migration backup retention

**Changed.** Owner selected A for migration R1: retain the protected recovery set until explicit previewed deletion, including after rollback becomes ineligible. Storage pressure refuses data-adding work rather than silently evicting it; confirmed forgetting overrides retention. Keeping a backup never authorizes unsafe rollback. Updated migration draft, plan and launch audit only; terminal metadata lifetime, deletion protocol/review and final implementation gates remain open.

## 2026-10-24 - Proposed first migration and evidence-binding protocols reviewed

**Changed.** Drafted finite upgrade/rollback/backup and evidence-binding protocols in existing specs. Combined independent review identified recovery validity, read-only observation, replay eligibility and launch-accounting gaps; all accepted, with legacy initialization reconciled and remaining mechanics explicitly blocked. Updated plan. Backup/terminal retention, focused protocol closure/re-review, budget and final sign-off remain. No runtime/schema/budget change or passing implementation claim.

## 2026-10-24 - Owner decision: real state upgrade for existing workspaces

**Changed.** Owner selected A for configuration D8: previewed/consented first schema upgrade with durable recovery, interrupted-transition tests and rollback that preserves newer work. A tested hardened rollback minimum is required; unsupported older development binaries cannot be retroactively fenced. Updated configuration/migration specs, plan and launch audit. No runtime/schema upgrade, budget change or implementation approval; concrete protocol/review/final sign-off remain.

## 2026-10-24 - Evidence-binding compatibility and budget feasibility

**Changed.** Read-only review identified older-state fallback and pre-admission writer limitations that optional binding fields/schema numbers alone cannot fix. Recorded real-upgrade versus new-workspace-only options, tested rollback minimum requirements and measured module headroom in configuration spec, plan and launch audit. No upgraded records, runtime/schema/budget change or implementation approval; compatibility boundary and concrete protocol remain pending.

## 2026-10-24 - Owner decision: configuration-to-evidence binding prerequisite

**Changed.** Owner selected A for configuration D7: include evidence-validity binding across receipts, baselines, reviews and Analyst results, preserving history without stale reuse and protecting against older-writer stripping. Updated feature draft, plan and launch audit. Scope approval only; concrete binding/schema/compatibility review, measured budget and final implementation sign-off remain. No runtime/schema/budget change.

## 2026-10-24 - Configuration design reconciliation and independent review

**Changed.** Concrete design/test ownership and review dispositions added to configuration spec: fresh pre-cache identities, transport errors, dependency-relevant confirmation bindings and monotone new-check declarations distinct from execution proof. Read-only WIP audit found admission/binding/partial-update defects and measured +9,187 runtime characters before repairs. Full configuration/evidence binding and compatibility is a new owner-controlled prerequisite; budget and final sign-off remain open. Files: feature spec, plan and launch audit. No runtime, schema or budget change.

## 2026-10-24 - Owner decision: include restriction-only safe revisions

**Changed.** Owner selected A for configuration D6: retain only valid tightening from mixed invalid updates, report applied/rejected parts, and never bypass command/check confirmation or relax held restrictions. Updated draft/acceptance text, plan and launch audit. All D1-D6 policy/scope choices are settled; concrete design/review/final implementation sign-off remain pending. Documentation only.

## 2026-10-24 - Owner decision: report only recorded configuration revisions

**Changed.** Owner selected A for configuration D5: label the recorded local counter layer-wide, retain contributing sources, and mark missing revision data unavailable. No invented per-source/setting history or new history state. Updated feature draft/acceptance text, plan and launch audit only; D6 and final sign-off remain before implementation.

## 2026-10-24 - Owner decision: local configuration proofs before host qualification

**Changed.** Owner selected A for configuration D4: proceed with locally testable privacy/coexistence work after design sign-off while personal-storage and actual host proofs remain open. CFG-08/CFG-09 stay partial; no release waiver or host/spend authorization. Updated feature draft, plan and launch audit only. D5-D6 and final sign-off remain before implementation.

## 2026-10-24 - Owner decision: keep configuration guidance in the existing skill

**Changed.** Owner selected A for configuration D3: remove redundant explanations to fit guidance within the existing skill budget, with no new resource or budget increase and no loss of mandatory controls. Updated feature draft, plan and launch audit only; actual skill edits remain gated on D4-D6 and final sign-off.

## 2026-10-24 - Owner decision: confirm command and check-definition changes

**Changed.** Owner selected A for configuration D2: preview/confirm all actual command add/remove/replace/reset and existing required-check invocation/configuration/population/pass-criteria changes. Equivalent reapplication stays a no-op; saving grants no execution authority. Updated PRD §7.5/7.6, UX §8.1, TS §8.5, configuration draft/acceptance text, plan and launch audit. Documentation only; D3-D6 and final sign-off remain before runtime implementation.

## 2026-10-24 - Owner decision: configuration read-back and confirmation timing

**Changed.** Owner selected conversation A (config spec B): save explicit durable preferences/provable tightening with read-back; preview and confirm before loosening/material restriction changes. Reconciled PRD CFG-01/§7.5, UX §8.1/8.2 and TS §8.5; updated feature draft, plan and launch audit. No runtime change or WIP import. Command/required-check classification and remaining design/sign-off gates stay open.

## 2026-10-24 - Owner decision: workspace recovery confirmation

**Changed.** Owner selected A for backup D3 interaction: one workspace-level confirmation, no required surviving contract handle, changed-fact invalidation and durable success acknowledgment preventing duplicate recovery publication or counter reset. CLI capture remains reported; no old authority returns. Updated recovery draft, plan and launch audit. All D1-D3 policy choices are resolved; concrete protocol review/dispositions and final sign-off remain before runtime implementation.

## 2026-10-24 - Owner decision: bounded fail-closed recovery validation

**Changed.** Owner selected A for backup D2 scope: bind required recovery facts and revalidate before publication; missing, unsupported, changed or uncertain facts prevent confirmation. Bounded neutral read-only Git inspection is allowed, not project execution/mutation. Updated recovery draft, plan and launch audit. No runtime/API/schema implementation; D3, concrete manifest/protocol review and final mechanism sign-off remain pending.

## 2026-10-24 - Owner decision: recovery needs fresh authorization

**Changed.** Owner selected A for backup-reconfirmation D1: acknowledgment cannot reactivate prior grants or execution consents. Updated the recovery draft, technical specification §15.2, plan and launch audit. No runtime, state schema or API change. Revalidation/binding scope, public confirmation contract and revised mechanism sign-off remain pending; no recovery implementation or qualification is claimed.

## 2026-10-24 - Owner decision: inherited NODE_OPTIONS stays dropped

**Changed.** Owner selected A: retain current project-check behavior and correct technical specification §9.3/9.4. Inherited options are not passed or hashed; projects depending on them need another supported configuration. Kernel-launch protection is unchanged. Files: technical specification, plan and launch audit. Existing real-process regression coverage verifies the drop; no runtime, permission, dependency or bundle change.

## 2026-10-24 - Launch review and bounded safety corrections (local)

**Changed.** Undo refuses foreign commits sharing a work label. Stateless reviews refuse complete over-budget packets; unchanged partial full reviews share a round without reusing Quick assignment identities. Repeated open reports version drift without duplicating work. Golden validation stops before executing rejected fixtures and refuses unsafe dirty paths/types. Live-run reservations reject invalid limits/corrupt counts. Qualification requires passing support for every required AC while retaining honest failed history.

**Files.** Existing review/manifest/open/undo modules and tests; coverage, golden validator and host-runner tools/tests; built UAT; quality budget (+8 shared-module lines, 0.19%, existing pre-approval); plan and dated launch audit. Inherited work is inventoried without deletion or importing unsigned semantics.

**Verification.** Red-first regressions and independent review; full local CI passes 1,059 tests/177 suites, zero failures/skips (76 added tests). All 122 built-CLI scenarios pass on Node 26.3.0/22.12.0 against one 774,754-byte bundle. Edited-file diagnostics, documentation/diff checks and unstaged/new-file likely-leak scan pass. R1 audit correctly blocks all 181 unqualified Musts. No native qualification, host/spend authorization, release claim, commit or push.

## 2026-10-24 - Version pinning and the pause (LFC-03, local)

**Changed.** A contract pins the kernel, state schema and adapter versions it was created under (`pinned.adapter` is new; an older document is back-filled silently). A call under different ones (kernel major.minor or pre-release, any schema, any adapter) returns `version-changed` (exit 3) with one question after the fence has run; `stop`, read-only views and the answering decisions (`version-reconcile`, `abandon-confirm`, `takeover-check`, `repair-lock`, quarantine) still work, and read-only calls only add a note. `open --resume` returns its new handle together with the question. `decide version-reconcile` continues (re-pins that contract) or stops (parks it). A downgrade is named as one; a kernel patch release does not pause. Migration (LFC-04) is deferred with its design notes recorded in `specs/schema-migration.md`.

**Files.** `core/versions.ts`, `pipeline-version.ts`, `pipeline.ts`, `pipeline-mutate.ts`, `decisions/version-reconcile.ts`, `verbs/open.ts`, `ports/types.ts` (`Stack.adapterVersion`), `node-ts.ts`, `core/state.ts`, `core/schemas.ts`, `test/version-pin.test.ts`, `tools/lint-quality.ts` (+75 verbs lines at 1.8%, approved in advance by the owner).

**Verification.** 12 new tests; full CI 965 tests; tags unchanged at 114 plus LFC-03 mapped. Not run: built-CLI UAT for this slice.

## 2026-10-24 - Declared check outputs and named files in every concurrent-edit (EVD-09, local)

**Changed.** An acceptance example may declare `outputs`: patterns (a literal leading directory, ending in `*`, `**` or a data file) for untracked data files its check writes. Matching untracked paths are omitted from the inventory, so creating, rewriting or deleting them no longer makes the run `concurrent-edit`; nothing about them is committed or reviewed except one attention item telling the reviewer an output is declared. Before every run a declared output is refused if it matches a tracked file, a file already present when the contract started, code, a test, configuration, an input or anything in scope. Every `concurrent-edit` receipt now names up to five files that moved (or "the installed toolchain") and says what to do. The execution helpers moved from `check.ts` to `check-execute.ts`.

**Files.** `core/outputs.ts` (new), `verbs/check-outputs.ts`, `verbs/check-execute.ts`, `check.ts`, `check-evidence.ts`, `check-rerun.ts`, `check-finalize.ts`, `adapters/git-cli.ts` (third inventory parameter), `ports/types.ts`, `core/schemas.ts`, `core/basis-build.ts`, `core/obligations.ts`, `decisions/basis.ts`, `tenet-intake` skill, `test/evidence-outputs.test.ts`, TS drift rule, `tools/lint-quality.ts` (+41 verbs lines at 1.0%, +4 git-cli, +3 schemas, all within the pre-approval).

**Verification.** 29 new tests (real Git and real test processes, a property test with 3,000 runs that found and fixed a hole where `a.ts/**` also matched a file named `a.ts`; a mutation check shows the declared-output test fails without the omission); full CI 953 tests; tags 114 of 181. Not done: tracked fixtures a test rewrites (EVD-09 stays partly met), the sealed baseline (EVD-04), the other qualifiers. Not run: built-CLI UAT for this slice.

## 2026-10-24 - Flaky reruns and the end-of-run input comparison (EVD-08, EVD-11; local)

**Changed.** A required test that fails at the candidate or integrated stage now reruns only the failing obligations' files, at most twice, on inputs that must still equal the candidate's. A pass after a failure keeps the first receipt's identity, gains the `flaky` qualifier and a bounded `history` (3 entries, 5 names), and can no longer reach `checked-local`, issue a review or lock an acceptance test; each rerun obligation counts as a launched check, and a failed attempt still feeds the repeated-failure signature. Planned reds, timeouts, kills, moved inputs, Playwright and static tools are never rerun. After every run the toolchain fingerprint is compared with the one taken before it: a change, or an unreadable fingerprint, makes the receipt inconclusive (`concurrent-edit`). The adapter is `node-ts@10`, so stored receipts go stale once.

**Files.** `core/receipts.ts` (`settleReruns`), `core/schemas.ts` (`history`), `verbs/check-rerun.ts` (new), `check.ts`, `check-evidence.ts`, `check-finalize.ts`, `node-ts.ts`, `test/evidence-flaky.test.ts` (new), `test/receipts.test.ts`, TS §9.6/§9.9, the spec, `tools/lint-quality.ts`.

**Verification.** Five pure and six real-process tests (real Git, real Vitest, a real process editing a file mid-run; a mutation check shows the toolchain test fails without the fix); full CI 921 tests; `npm run uat` (built CLI) completes; tags 113 of 181. Not done: declared outputs (EVD-09, slice 2), the sealed baseline (EVD-04 stays open), the qualifiers `simulated`, `partial` and `history-unavailable`. Budget: `pipeline + verbs + decisions` +80 lines (2.0%), above the 1% pre-approval and owner-confirmed on 2026-10-24; `core/schemas` +3 lines (0.58%).

## 2026-10-24 - Impact shown in the plan preview (INT-08, local)

**Changed.** `decide plan` now returns `data.impact` with its confirmation question: for the items an edit or drop changes, the plan items that depend on them, linked elements, decisions and contracts in flight, before anything is recorded. Files: `decisions/plan.ts`, `test/impact.test.ts`, `tools/lint-quality.ts` (+3 lines, 0.05%). Verification: one new test; full CI below. Not done: `decide basis` previews (a proposal adds new elements; no edit path to accepted ones exists yet) and `@tenet` test-tag scanning.

## 2026-10-24 - Repository layouts named at open (GIT-13, local)

**Changed.** The Git probe reads shallow history, submodule paths, LFS attributes and a linked worktree without running any repository program (`adapters/git-layout.ts`). `open` names each layout once as a non-blocking note (`repo-shallow`, `repo-submodule`, `repo-lfs`, `repo-linked-worktree`), and refuses an editing contract whose scope is inside a submodule. Detached HEAD, rebase, merge and conflicts were already refused.

**Files.** `adapters/git-layout.ts` (new), `git-cli.ts`, `ports/types.ts` (`RepoProbe.layout`), `core/reasons.ts`, `verbs/open-new.ts`, `test/repo-layout.test.ts`, `tools/lint-quality.ts` (git-cli +3 lines, verbs +11 lines, both under the pre-approval).

**Verification.** Five real-Git tests (shallow clone, submodule, LFS, linked worktree, plain); full CI 909 tests; tags 111 of 181. Not done: offering a branch on detached HEAD, a refusal of commits that would transform LFS files (waits for committed-tree checks).

## 2026-10-24 - Bundle size budget raised to 800 KB (owner decision)

**Changed.** The kernel bundle budget is 800 KB (was 750 KB): the bundle had reached 746 KB. Files: `tools/build.ts`, `invariants.test.ts`, tech-spec §3.2, plan §11.1 and §12.3.

## 2026-10-24 - Bounded storage: journal reduction, run-file cap and ceiling (local)

**Changed.** Independent review of `specs/storage-retention.md` (10 findings, 2 blockers) led to a smaller, safer v2: no journal segments and no new journal record kind. At `open` and `finish`, once `log` passes 5 MB, old calls, completed old pairs and old accounting records become monthly counts in `.tenet/summaries.json` (written first, keyed by the hash of the journal it came from, then the journal is replaced by rename); the newest 100 records, every unresolved intent and everything recovery reads are kept. Run files are capped per project, oldest first. `open` returns `storage-protected-full` naming the largest classes when protected data alone is over the ceiling; `stop` and `inspect` still work. One sentence reports a reduction.

**Files.** `core/journal-reduce.ts` (new), store (`evict`, options, summaries), `Tx.evict`, `verbs/common.ts` (`reclaim`), `open.ts`, `finish.ts`, `test/storage-eviction.test.ts`, `test/fixtures/crash-evict.ts`, the spec (review dispositions, v2), TS §7.6 (implemented subset), `tools/lint-quality.ts` (+19 lines, 0.45%).

**Verification.** 13 new tests including a real SIGKILL after the summaries write and a 10,000-record reduction in about 70 ms; full CI 904 tests; built-bundle scratch run: an 8 MB aged journal reduced to 9.5 KB during one `open` (0.78 s). Bundle is 746 of 750 KB. Not done: shadow-repository snapshot pruning, archive compaction, the per-machine cap, the PRD/TS eviction-order decision. Node 22.12.0 not run.

## 2026-10-24 - Residue listing and previewed cleanup (local)

**Changed.** `inspect --view residue` lists what Tenet leaves behind (`.tenet/` size, the run files in the OS temp folder, the adopted documents that stay, what is kept) without creating anything. `decide cleanup --target project|machine` previews and then removes Tenet's run folders: this workspace's, or every stale `tenet-ws_*` folder on the machine (a folder counts as recent if anything inside it was used in the last hour). It refuses while a review or analyst packet is open. It never removes `.tenet/` or project files: a call cannot safely delete the store it runs in, so the user is given the exact command.

**Files.** `core/residue.ts` (new), `decisions/cleanup.ts`, store port and adapter (`residue`, `cleanTemp`), `verbs/inspect.ts`, `SKILL.md` (condensed to stay under its token budget), `test/residue.test.ts`, `tools/lint-quality.ts` (+23 lines, 0.57%, under the pre-approval).

**Verification.** Six new tests; full CI 891 tests; structural tags 109 of 181 Musts. Not done: removing `.tenet/` itself, the "this machine" user directory (no plugin data path is known until SP-02), naming leftover test processes.

## 2026-10-24 - SP-08 HC-04 passes: two analysts run in parallel (local)

**Changed.** One authorized run of HC-04 (selection verified first with a zero budget). Two `tenet:tenet-analyst` children started 1 ms apart and overlapped for about 10 s; the kernel held two reservations. Report appended to `docs/audits/2026-10-24/sp08-cli.md`.

**Verification.** Live: 1 run, 47.5 s, 1 premium request, 0 denials. Budget 8 of 8 spent. CLI tuple only.

## 2026-10-24 - SP-08 retry: HC-02 reproduced, HC-04 not run (local)

**Changed.** Authorized retry of HC-02 and HC-04. HC-02 reproduced its result (child attempted nothing, reported no write tools, wrote nothing). My test selector also matched the `describe` title, so HC-03 ran too and used the last run of the budget; HC-04 was refused by the ledger and did not run. The `describe` title no longer carries case IDs. This is disclosed in `docs/audits/2026-10-24/sp08-cli.md`.

**Files.** `packages/kernel/test/host-sp08.test.ts`, the audit note.

**Verification.** Live: 2 runs executed (HC-02, HC-03), about 40 s, 1 premium request reported (HC-03 killed before reporting). Run budget 7 of 7 spent; one run beyond the authorization.

## 2026-10-24 - SP-08 live cases HC-02 to HC-04 on the Copilot CLI (local)

**Changed.** One authorized live run each. HC-02 and HC-03 passed; HC-04 failed because its premise ignored the Quick lane's two-delegation limit. HC-02's evidence is weak (the child tried nothing), so its prompt now demands an attempt; HC-04 now dispatches two analysts. Neither changed case has been rerun. Findings in `docs/audits/2026-10-24/sp08-cli.md`.

**Files.** `packages/kernel/test/host-sp08.test.ts`, the audit note.

**Verification.** Live: 3 runs, about 82 s total, 2 premium requests reported (HC-03 was killed before reporting). Run budget 5 of 5 spent.

## 2026-10-24 - SP-08 gated host tests, offline only (local)

**Changed.** `tools/host/evaluate.ts` reads a headless transcript for SP-08: children with their declared tools, their own calls (matched by `parentToolCallId`), start and end; maximum concurrency; and a tool-enforcement verdict (`violated`, `enforced-by-host`, `cooperative`, `not-exercised`) that treats a file on disk as the evidence. The harness can kill a run at the first output line a condition accepts. `host-sp08.test.ts` holds five offline tests on synthetic streams and three gated live cases: HC-02 (declared vs enforced tools), HC-03 (a stopped child leaves the kernel consistent), HC-04 (three analysts in one batch, concurrent or queued).

**Files.** `tools/host/evaluate.ts`, `tools/host/copilot-cli.ts`, `packages/kernel/test/host-sp08.test.ts`.

**Verification.** Full CI 885 tests. The evaluator reproduced the real HC-01 coordinator's duration (17,033 ms) and call list from its transcript. **No live run was made.** Event types for a cancelled or failed child are unobserved, so the evaluator reports "no completion observed" rather than "cancelled".

## 2026-10-24 - SP-11 run 2: HC-01 passes headlessly with an isolated config (local)

**Changed.** The harness takes an isolated `COPILOT_HOME`; HC-01 states the kernel path and passes `--allow-all-paths`. The second authorized live run passed: the kernel created a plan contract and the coordinator stopped at the plan-confirmation gate. Report appended to `docs/audits/2026-10-24/sp11-hc01.md`.

**Files.** `tools/host/copilot-cli.ts`, `packages/kernel/test/host-cli.test.ts`, the audit note.

**Verification.** Live run 2: exit 0, 30 s, 1 premium request, 0 denials. One run, one task, CLI only; no qualification inferred.

## 2026-10-24 - SP-11 feasibility run HC-01 and transcript summary (local)

**Changed.** One authorized live run of HC-01 through the Copilot CLI. It finished but never reached the kernel (path permission denied in the subagent); findings are in `docs/audits/2026-10-24/sp11-hc01.md`. The harness now summarizes a transcript's events (skills, subagents with declared tools, tool counts, denials, premium requests) into each observation.

**Files.** `tools/host/copilot-cli.ts`, `packages/kernel/test/host-cli.test.ts`, the audit note.

**Verification.** One live run (1 premium request, 31 s); harness tests 6 pass. HC-01 itself failed on its own evidence rule.

## 2026-10-24 - Automated host-test harness for the Copilot CLI (local)

**Changed.** `tools/host/copilot-cli.ts` runs the Copilot CLI headlessly (`-p`, `--output-format json`, `--plugin-dir`) against a fixture and records an observation (tuple, arguments without the prompt, exit, timing, raw transcript path). A live run is counted against `TENET_HOST_RUNS` in a ledger and refused when the budget is spent. `host-cli.test.ts` tests the harness on every run against a fake binary (five tests) and holds one live case, HC-01, that decides from the kernel's own `.tenet/state`, never from the model's report. The live case is skipped unless `TENET_HOST=cli`.

**Files.** `tools/host/copilot-cli.ts`, `packages/kernel/test/host-cli.test.ts`, `.gitignore` (`.host-runs/`).

**Verification.** Full CI 879 tests. Not observed: any live run; it needs the owner's credit cap and time box (plan §4.1).

## 2026-10-24 - Intent-change impact view (local)

**Changed.** `inspect --view impact --topic <ids>` answers INT-08 from one pure `impact(state, ids)`: a requirement reaches its examples and invariants, an example reaches its requirement but not its siblings, then the plan items that carry them and their dependents, linked decision records, test files and live contracts that carry an affected element or plan item. Unknown IDs are named, never guessed. The `tenet` skill tells the coordinator to show this before changing accepted intent.

**Files.** `core/impact.ts` (new), `verbs/inspect.ts`, schemas, `plugin/skills/tenet/SKILL.md`, `test/impact.test.ts`, `tools/lint-quality.ts` (+4 lines, under the 1% pre-approval).

**Verification.** Four new tests; full CI 874 tests. Not done: calling impact from every `decide basis` / `decide plan` preview, and `@tenet` test-tag scanning.

## 2026-10-24 - Crash-safe starter restore (local)

**Changed.** The starter's database restore now follows tech-spec §12.5. The app and the restore tool each take `<db>.owner` by exclusive create (process ID and start time, so a dead holder is removed and a live one, even idle under WAL, blocks restore). Restore refuses a backup that is the live database or its -wal/-shm, writes a durable `.restore-in-progress` marker naming where the originals go, moves the database with its log files aside together, installs a verified copy by rename, and removes the marker last. While the marker exists the app will not start and a second restore is refused; `npm run restore -- --finish` or `--rollback` settles it.

**Files.** Starter `platform/owner.ts` (new), `platform/restore.ts`, `platform/db.ts`, `server.ts`, `restore-cli.ts`, `docs/hardening.md`, `test/restore.test.ts`, `test/support/restore-child.ts`; golden-task fixture copy of `restore.test.ts`.

**Verification.** Starter suite 39 tests, typecheck and lint clean in a scratch install. 11 new tests, including a real SIGKILL after each of the seven steps with both finish and rollback checked. Full CI 870 tests; bundle 738 KB of 750 KB. Not observed: a running server holding the owner file under the real host.

## 2026-10-24 - Lessons and previewed forgetting (local)

**Changed.** `decide lesson` keeps an explicit "always" correction as a scoped (task or project) lesson with the user's words as provenance; a new lesson can retire the ones it contradicts. `inspect --view lessons` lists them. Active lessons reach reviewer and analyst packets as advice within 1,500 tokens and never change obligations, grants, lane or floor (the proposal body is strict, so a field that would carry authority is refused). `decide forget` previews the exact text, then removes it from the state, publishes twice so `state.prev` lacks it, clears cached last responses and deletes packet files that contain it, and says that copies already sent to the host's model are outside Tenet's control. The state document gains `lessons` (default empty, schema version unchanged).

**Files.** `core/lessons.ts` (new), `decisions/lesson.ts`, `decisions/forget.ts`, store `purge` port and adapter, manifest, inspect, schemas, state, `tenet` SKILL.md, `tools/lint-quality.ts` (pipeline+verbs+decisions budget +36 lines, awaiting owner confirmation), `test/lessons.test.ts`.

**Verification.** 12 new tests (LRN-01/02/05, CON-10); full CI 870 tests / 154 suites; built-CLI scratch run on Node 26.3.0 (record, list, preview, confirm, no copy left). Not observed: Node 22.12.0 run, a native host.

## 2026-10-24 - RC1 stable process-record admission (local)

**Changed.** Process recovery reads only stable regular UTF-8 records through a no-follow/nonblocking bounded short-read loop before trusting the prepared sentinel or process identity. FIFO records cannot stall recovery; observed changes and malformed encoding retain uncertain ownership without signals. Valid short reads and Unicode remain usable. No schema, authority, reason vocabulary, dependency, runtime minimum, adapter identity, execution permission or budget changed.

**Files.** Runner adapter, existing runner-ownership tests and shared process fixture, built-CLI fault/UAT drivers, technical specification §7.3 and implementation plan.

**Verification.** Seven added source controls (five red-first); 39 focused tests and full CI (858 tests / 150 suites) pass without raising the complexity ceiling. All 119 CLI scenarios pass on Node 26.3.0 and 22.12.0 against the same artifact. Three added real-killed-preparation cases cover FIFO refusal, stable short reads and observed sentinel growth, preserving actual budget counters, grants and human source/Git facts. Unknown-process reconciliation, path races and broader recovery/host/release qualification remain open. No commit or push.

## 2026-10-24 - RC1 nonblocking private-write admission (local)

**Changed.** Synchronized private writes open no-follow/nonblocking and verify a regular descriptor before permissions, truncation or content changes. FIFO artifact leaves cannot block waiting for a reader or receive artifact bytes through an attached reader. Complete regular-file replacement, private permissions and fsync remain. No schema, authority, new effect/reason, dependency, runtime minimum, adapter identity, execution permission or budget changed.

**Files.** Store adapter, existing store-boundary tests and process fixture, built-CLI fault/UAT drivers, technical specification §7.6 and implementation plan.

**Verification.** Five added source controls (two red-first); all 76 focused tests and full CI (851 tests / 150 suites) pass. All 116 CLI scenarios pass on Node 26.3.0 and 22.12.0 against the same artifact. Five added controlled artifact-leaf cases cover four pre-launch refusals preserving exact state, leaf content/type, zero pipe bytes and human source/Git facts; ordinary files still permit launch. Parent-path races, aggregate retention and broader recovery/host/release qualification remain open. No commit or push.

## 2026-10-24 - RC1 own-property recovery dispatch (local)

**Changed.** Recovery settlement and result publication dispatch only explicitly declared handlers, not inherited object members. Unknown pending names retain uncertainty; completed unknown records remain readable without a state publisher. No schema, new effect/handler/reason, authority, dependency, runtime minimum, adapter identity, execution permission or budget changed.

**Files.** Recovery verb, existing project-recovery tests and CLI UAT driver, technical specification §7.4 and implementation plan.

**Verification.** Twelve added source controls (seven red-first); all 54 focused tests and full CI (846 tests / 150 suites) pass. The first quality-gate failure was repaired by removing a redundant local variable without changing its ceiling. All 111 CLI scenarios pass on Node 26.3.0 and 22.12.0 against the same final artifact. Twelve added synthetic-journal cases check repeated recovery, retained uncertainty and journal history, and ownership/authority/source/Git preservation. Unknown-effect reconciliation and broader recovery, retention and host/release qualification remain open. No commit or push.

## 2026-10-24 - RC1 unresolved-effect tuple pairing (local)

**Changed.** Store unresolved-intent discovery now pairs results by structured effect/ID tuples, matching pure replay. Delimiters within either field cannot let an unrelated result conceal a pending effect and release source ownership. Exact matching results retain their existing behavior. No schema, new effect, reason, dependency, runtime minimum, budget, adapter identity or execution permission changed.

**Files.** Store adapter, existing store-boundary tests and CLI UAT driver, technical specification §7.4 and implementation plan.

**Verification.** Three added source controls (two red-first) cover both collision directions, transaction reload and ordinary pairing. All 71 focused tests and full CI (834 tests / 150 suites) pass with no failures/skips. All 99 CLI scenarios pass on Node 26.3.0 and 22.12.0 against the same artifact. Three added synthetic-journal cases verify repeated stop retains uncertainty/source ownership until exact completion; journal history, grants, consents, source, index, HEAD and branch are preserved. Broader recovery, retention and host/release qualification remain open. No commit or push.

## 2026-10-24 - RC1 conflicting accounting checkpoint admission (local)

**Changed.** Accounting recovery rejects regressing usage/sequences and contradictory same-revision completeness/in-flight flags while retaining maximum observed facts. Timestamp-only retries and monotone progress after an unpublished checkpoint remain valid. No schema, dependency, runtime minimum, budget, adapter identity or execution permission changed.

**Files.** Core budget recovery, existing backup-accounting tests and CLI UAT driver, technical specification §7.3 and implementation plan. Added a draft backup-reconfirmation specification with approval gates; no reconfirmation behavior or decision kind is implemented.

**Verification.** Six added controls: four red-first cases, a timestamp-only positive retry, and a real-kill positive retry that exposed and corrected an over-restrictive first fix. All 61 focused tests and full CI (831 tests / 150 suites) pass with no failures/skips. All 96 CLI scenarios pass on Node 26.3.0 and 22.12.0 against the same artifact. Seven added synthetic-checkpoint cases retain record bytes, source, index and branch; regressions/conflicting flags block new editing authority while monotone retries remain verified. Backup reconfirmation, unknown-cost/process reconciliation and host/release qualification remain open. No commit or push.

## 2026-10-24 - RC1 nonblocking report-type admission (local)

**Changed.** Report opens now use `O_NONBLOCK` with the existing no-follow flag before descriptor-type validation. A FIFO substituted after path inspection cannot stall the kernel waiting for a writer. Directory and symlink substitutions remain unusable. No usable-report semantics, adapter identity, schema, dependency, runtime minimum, budget or execution permission changed.

**Files.** Runner adapter, existing runner-artifact tests and read-race fixture, built-CLI fault/UAT drivers, technical specification §9.6 and implementation plan.

**Verification.** Three added real-process controls, with the FIFO control initially timing out; all 64 focused tests pass. Full CI passes 825 tests / 150 suites, zero failures/skips; all 89 CLI scenarios pass on Node 26.3.0 and 22.12.0 against the same artifact. Three added built cases return inconclusive evidence and retain replacement types and exact original bytes. Complete path-race protection, other RC1 work and host/release qualification remain open. No commit or push.

## 2026-10-24 - RC1 runner report-file admission (local)

**Changed.** Runner reports use bounded short-read loops, reject observed byte-count/size/mtime/ctime changes and validate UTF-8 bytes before decoding. Unusable reports retain the existing inconclusive normalization; valid Unicode remains exact. Adapter identity advances to `node-ts@9`, invalidating older receipt identities. No schema, dependency, runtime minimum, budget or execution permission changed.

**Files.** Runner and Node adapters, existing runner-artifact tests and read-race fixture, built-CLI fault/UAT drivers, technical specification §9.5/9.6 and implementation plan.

**Verification.** Nine added source controls, six initially failing; all 61 focused tests pass. Full CI passes 822 tests / 150 suites, zero failures/skips; all 86 CLI scenarios pass on Node 26.3.0 and 22.12.0 against the same artifact. Three added synthetic Vitest controls distinguish stable success from invalid encoding and valid-JSON mutation while retaining report bytes. Snapshot/path-race guarantees, other RC1 work and host/release qualification remain open. No commit or push.

## 2026-10-24 - RC1 strict private-record encoding (local)

**Changed.** Private records validate UTF-8 bytes before decoding so corrupt complete records cannot become accepted replacement-character text. Journals validate their complete prefix while retaining torn multibyte-tail recovery. Valid Unicode, literal replacement characters and previous-state fallback remain supported. No schema, dependency, runtime minimum, budget, adapter identity or execution permission changed.

**Files.** Store adapter, existing store-boundary tests and CLI UAT driver, technical specification §7.6 and implementation plan.

**Verification.** Six added source controls, four initially failing; all 62 focused tests pass. Full CI passes 813 tests / 150 suites, zero failures/skips; all 83 CLI scenarios pass on Node 26.3.0 and 22.12.0. Three new corrupt-record CLI cases retain exact bytes and refuse without a transaction; a fourth preserves Unicode through torn-tail inspection and repair. Aggregate retention, remaining recovery races and host/release qualification remain open. No commit or push.

## 2026-10-24 - RC1 private record read admission (local)

**Changed.** Private JSON now shares the bounded no-follow record reader with journals/blobs. Short reads preserve complete records; observed byte-count/size/mtime changes refuse before parsing. Permission/hard-link ctime changes remain readable, and previous-state fallback is unchanged. No schema, dependency, runtime minimum, budget or execution permission changed.

**Files.** Store adapter, existing read-race fixture and store-boundary tests, existing built-CLI fault/UAT drivers, technical specification §7.6 and implementation plan.

**Verification.** Nine added controls cover real-process valid-JSON mutations, stable short reads and metadata-only changes. All 64 focused store/recovery/envelope tests pass. Final CI passes 807 tests / 150 suites, zero failures/skips; all 79 CLI scenarios pass on Node 26.3.0 and 22.12.0. Three new private-record cases refuse without a transaction and retain foreign bytes. An initial ctime-only false refusal was reproduced and repaired without weakening content assertions. Aggregate retention, full path-race and host/release qualification remain open. No commit or push.

## 2026-10-24 - RC1 installed-metadata mutation admission (local)

**Changed.** Installed-tool and dependency metadata reads handle legitimate short reads within the existing bounded allocation and refuse observed same-size valid-JSON mutations using post-read size/mtime/ctime checks. Adapter identity advances to `node-ts@8`; no stored schema, dependency, permission, runtime minimum or budget changed.

**Files.** Node adapter, existing read-race fixture and static-conformance tests, existing built-CLI fault/UAT drivers, technical specification §9.5 and implementation plan.

**Verification.** Four red-first controls; all 68 focused tests pass. Full CI passes 798 tests / 150 suites with no failures/skips; all 76 CLI scenarios pass on Node 26.3.0 and 22.12.0. Two added real-process mutation cases refuse before launch and retain prior state and foreign edits. Full graph/path-race and host/release qualification remain open. No commit or push.

## 2026-10-23 - RC1 bounded project reads and metadata refusals (local)

**Changed.** Project reads/hashes allocate only the admitted size plus one probe byte, handle legitimate short reads and refuse observed concurrent byte-count/size/time changes. Stack detection preserves filesystem admission errors instead of treating unsafe package inputs as absent. Adapter identity advances to `node-ts@7`; no schema, dependency, runtime minimum, permission or budget changed.

**Files.** Project filesystem and Node adapters, existing boundary/static tests and new read-race fixture, existing built-CLI fault/UAT drivers, technical specification §7.4/9.5 and implementation plan.

**Verification.** Thirteen added controls, including eight red-first real-process mutations, two positive short-read cases and three caller refusals. All 71 focused tests pass; full CI passes 794 tests / 150 suites, zero failures/skips. All 74 CLI scenarios pass on Node 26.3.0 and 22.12.0; seven added refusals preserve state and four retain foreign edits. Complete path-replacement qualification and other RC1/release gates remain open. No host qualification, commit or push is claimed.

## 2026-10-23 - RC1 installed-tool metadata admission (local)

**Changed.** Installed runner/static-tool package JSON now shares the bounded no-follow descriptor reader used by npm installed records. Unsafe files, invalid UTF-8, malformed/deep JSON and linked leaves refuse before execution; package-manager directory links remain supported. Adapter identity advances to `node-ts@6`. No dependency, runtime minimum, state schema, environment permission or quality budget changed.

**Files.** Node adapter, existing static-conformance tests, CLI UAT driver, technical specification §9.5 and implementation plan.

**Verification.** Four red-first controls; all 37 static-conformance tests pass. Full CI passes 781 tests / 150 suites with no failures/skips; all 67 built-CLI scenarios pass on Node 26.3.0 and 22.12.0, including four new pre-launch refusals preserving prior state. The earlier starter SIGSEGV did not recur in baseline/rebuilt minimum-runtime UAT or the complete scratch recipe; its cause remains unproved. No compatibility fix, host qualification, commit or push is claimed.

## 2026-10-23 - RC1 scaffold replay guard; starter runtime blocker exposed (local)

**Changed.** Historical scaffold replay now recognizes durable per-file vetting instead of transient touched paths cleared by commit, preserving finished contract and recipe bookkeeping. Added a strict real-starter CLI install/check/review/finish/recovery scenario; no recipe, dependency, engine range or authority changed.

**Files.** Recovery publisher, existing scaffold test, CLI UAT driver, technical specification §7.4 and implementation plan.

**Verification.** Source scaffold suite passes 15/15, including seven crash cases; full source CI passes 775 tests / 150 suites with no failures/skips. All 63 CLI scenarios pass on Node 26.3.0. The new real-starter journey fails on Node 22.12.0 with database-backed Vitest worker SIGSEGVs and inconclusive checks; cause remains unproved and both-runtime UAT is not green. The minimum-runtime compatibility blocker is recorded, with no skipped assertion or narrowed claim approved. Budgets unchanged; no host qualification, commit or push.

## 2026-10-23 - RC1 adoption replay freshness (local)

**Changed.** Completed adoption replay no longer replaces newer accepted trust/provenance and contract file attribution. New write intents bind the prior trust snapshot; replay applies only against that predecessor and skips already-applied results without relying on clock order. Conservative legacy handling preserves existing acceptance. No general intent reverse parsing/re-projection, new authority or environment forwarding was added.

**Files.** Pure state recovery, adoption intent preparation and result replay, existing adoption tests, CLI UAT driver, technical specification §7.4 and implementation plan.

**Verification.** Two new source controls cover real acceptance, clock order and legacy/idempotence; all adoption crash cases remain green. Adoption/accounting controls pass 41/41. Full CI: 774 tests / 150 suites, zero failures/skips; all 62 CLI scenarios pass on Node 26.3.0 and 22.12.0. Budgets unchanged; local-only evidence, no host qualification, commit or push.

## 2026-10-23 - RC1 complete bounded-journal replay (local)

**Changed.** Recovery no longer loses unpublished effects beyond a 400-entry journal tail. It uses the complete validated bounded journal and linear structured effect/ID pairing, preserving result order, first-intent semantics and diagnostic-tail views. No storage ceiling, retention policy, state schema or authority changed.

**Files.** Pure state recovery, recovery verb, store transaction/port, existing backup-accounting tests and built-CLI fault/UAT drivers, technical specification §7.4 and implementation plan.

**Verification.** Three added source cases include a real SIGKILL plus 450 later records, distant/cross-effect/duplicate identities and diagnostic views. Neighboring recovery/adoption/scaffold controls pass 53/53. Full CI: 772 tests / 150 suites, zero failures/skips; all 61 CLI scenarios pass on Node 26.3.0 and 22.12.0. Budgets unchanged. Aggregate retention, formal performance and host qualification remain open; no commit or push.

## 2026-10-23 - RC1 durable foreign-path review replay (local)

**Changed.** Successful commit results retain observed foreign paths. Recovery after a result-fsync/publication crash restores the landed commit and its review attention through shared pure attribution, preserving accepted dispositions and avoiding duplicate commits. Missing/malformed unpublished foreign metadata stays uncertain instead of being assumed clean; already-published history remains readable. No automatic rollback or new authority was introduced.

**Files.** Pure attribution, commit result recording and recovery replay, existing backup-accounting tests, built-CLI/fault drivers, technical specification §10.3 and implementation plan.

**Verification.** Two added source controls plus existing real commit-crash cases; three added CLI complete/legacy/malformed result-fsync cases preserve human staged/unstaged content. Full CI passes 769 tests / 150 suites, zero failures/skips. All 60 CLI scenarios pass on Node 26.3.0 and 22.12.0. Budgets unchanged; local-only evidence, no host qualification, commit or push.

## 2026-10-22 - RC1 installed dependency identity (local)

**Changed.** Node toolchain identity now includes a digest of npm's installed dependency record, invalidating evidence when that ignored record changes despite unchanged source/tool versions. Bounded no-follow reads, UTF-8/JSON/depth/shape admission and operation exclusions distinguish missing metadata from unsafe/corrupt records; only a digest is exposed. Adapter identity advances to `node-ts@4`. No dependency or stored receipt field was added. Full graph/configuration and package-content assurance remain pending; `NODE_OPTIONS` forwarding remains unchanged pending the recorded owner decision.

**Files.** Node adapter, optional port fingerprint field, existing static-conformance tests, CLI UAT driver, technical specification and implementation plan.

**Verification.** Nine source controls include a real compiler stale-evidence workflow; two CLI cases cover ignored-record changes and malformed pre-check refusal. Full CI passes 767 tests / 150 suites; all 57 CLI scenarios pass on Node 26.3.0/22.12.0. Budgets unchanged, local-only evidence. No host qualification, commit or push.

## 2026-10-22 - RC1 interrupted-check replay consent (local)

**Changed.** Prepared checks retain their admitted execution envelope. Confirmed termination after a crash or cancellation invalidates unknown-check consent even for an unchanged envelope; unrelated envelope/hook/filter consent remains. Missing legacy bindings are treated conservatively, cached responses are cleared, and no interruption is promoted to a receipt or new authority. Process termination and unknown external side effects are disclosed separately. Journal call records now accept documented kernel-error exit 5 while still rejecting invalid exits.

**Files.** Execution-envelope core/schema and shared recovery helpers, check preparation, recovery/stop verbs, store validator, existing envelope/store tests, CLI UAT driver, technical specification and implementation plan.

**Verification.** Real SIGKILL/cancel and consent-population controls; external scratch effects remain unchanged before fresh approval and on decline, then run once after approval. Full CI: 758 tests / 150 suites, zero failures/skips. All 55 built-CLI scenarios pass on Node 26.3.0 and 22.12.0 against one artifact. All budgets remain unchanged. Local evidence only; no qualification, host dispatch, commit or push.

## 2026-10-22 - RC1 physical Git postconditions and foreign-path review (local)

**Changed.** Commit finalization/recovery verify the complete physical parent list, so hook-created merges cannot masquerade as the planned commit. Kernel Git invocations ignore replacement-object views while preserving the refs themselves, preventing hidden foreign trees/paths. A known landed foreign-path commit is retained but returns exit 3 before contract closure, with persistent attention that survives checks/retries and supports the existing explicit disposition flow. Automatic reference rollback and full configured-program qualification remain open.

**Files.** Git adapter, pure attribution/review helpers, shared commit finalization, existing Git/workflow tests, built-CLI UAT driver, technical specification §10 and implementation plan.

**Verification.** Five added real-Git tests; strengthened check/retry/user-disposition workflow; 42 focused Git/filter tests pass. Full CI passes 754 tests / 150 suites, no failures or skips. All 53 CLI scenarios pass on Node 26.3.0 and 22.12.0. All quality ceilings remain unchanged; local-only evidence, no host qualification, commit or push.

## 2026-10-22 - Staging and commit timeout contract aligned (local)

**Changed.** Owner selected the existing 120-second limit for staging and commit individually, including their filters/hooks. Technical specification §15.2 now agrees with §10.3 instead of allowing 10-minute commit hooks. Production behavior is unchanged. The existing real-filter pipeline test asserts both runner dispatch deadlines; the plan records the resolved decision and remaining safeguards.

**Files.** `packages/kernel/test/filter-jobs.test.ts`, `specs/tech-spec.md`, `specs/plan.md`, `CHANGELOG.md`.

**Verification.** Focused real-filter test and full local CI pass: 749 tests / 150 suites, zero failures or skips. No host observation, qualification, commit or push.

## 2026-10-22 - RC1 private record and cleanup boundaries (local)

**Changed.** Journal/blob reads use bounded no-follow descriptors. Journal envelopes and depth are validated before recovery or torn-tail repair; corrupt complete records are preserved and refused. Appends cannot create an unreadable oversized journal. Blob writes enforce byte bounds, reads verify content hashes, and corruption is never reported as absence. Automatic cleanup skips linked workspace/manifest/review directories instead of deleting outside human files. Expired owned artifacts are still removed and explicit live paths retained. Aggregate storage admission, compaction, protected retention and concurrent path-replacement qualification remain pending.

**Files.** Store filesystem adapter, existing store-boundary tests, built-CLI UAT driver, technical specification §7.6 and implementation plan.

**Verification.** Eleven new controls; focused store/accounting tests pass 41/41. Full local CI passes 749 tests/150 suites, with no failures or skips. All 50 built-CLI UAT scenarios pass on Node 26.3.0 and 22.12.0. An initial scenarios-file import failure did not recur in isolated or subsequent full reruns and remains unclassified. No quality budget, host authorization, qualification, commit or push changed.

## 2026-10-22 - RC1 project-check execution envelope (local)

**Changed.** A project check now derives a hash-bound envelope for its planned test, static, and e2e commands before spawn. Unknown exposure asks for explicit consent once per project/envelope hash; decline launches nothing and a changed envelope asks again. Receipts retain the exact admitted envelope, with passed/dropped environment names only and normalized workspace/run paths; no environment values or absolute workspace path are recorded. This is initial check-command coverage only; configured commands and the rest of RC1 remain open.

**Files.** `core/execution-envelope.ts`, check and runner adapters, shared consent decision, `execution-envelope.test.ts`, existing fixture/UAT harnesses, `tenet` skill, `specs/tech-spec.md` §9.3, `specs/plan.md`.

**Verification.** Focused envelope, active-time, scaffold, and process-cancellation tests pass. Full `npm run ci` passes 738 tests / 150 suites with no failures or skips; `npm run uat` passes. Local T1 evidence only; no host, release, campaign, commit, or push.

## 2026-10-21 - RC0 evidence ledger and requirement qualification gate (local)

**Changed.** `tools/coverage.ts` now reports structural mapping separately from sparse semantic disposition, uncovered AC IDs, evidence tiers/references, and qualification. It validates strict JSON v1 ledger/history, content hashes, repository-contained evidence paths, and campaign tuple/protocol/artifact bindings, failing closed on stale records. Added a separate `tools/release-audit.ts` gate requiring all due Musts to qualify on one tuple/artifact; its output explicitly does not certify the other PRD Section 4.7 conditions. Added the tracked empty `docs/audits/evidence-ledger.json`; no requirement status or qualification was invented.

**Files.** `tools/coverage.ts`, `tools/release-audit.ts`, `docs/audits/evidence-ledger.json`, `packages/kernel/test/coverage.test.ts`, `specs/tech-spec.md` §19.2, `specs/plan.md`.

**Verification.** Focused ledger tests pass 8/8. Full local `npm run ci` passes 733 tests/150 suites, zero failures/skips. `npm run uat` passes. The R1 requirement-qualification command correctly blocks all 181 current due Musts. Local-only evidence; no campaign, host action, commit, or push.

## 2026-10-21 - Analyst guidance and npm install audit separation (local)

**Changed.** Reviewer and Analyst packet guidance now specifies that `openDependencies` contains plain strings with evidence inline, and provides a string example. The existing strict schemas remain unchanged; object-shaped values are still rejected. npm's implicit advisory request is disabled for lockfile resolution/install in the dependency flow, starter recipe, root CI and generated starter CI; explicit normalized auditing remains separate and open. The SP-08 evidence records actual results without rewriting them.

**Files.** `core/review.ts`, dependency command paths, starter recipe/workflow/docs, root CI workflow, existing Analyst/dependency/starter/workflow/hook tests, built-CLI UAT driver, tech spec, plan and SP-08 evidence.

**Verification.** Red-first dependency guidance and npm-command regressions pass; hook test passes 1/1. Full CI passes 725 tests/150 suites, zero failures/skips. Starter scaffold and golden-task integration pass in 11s and 20s. All 47 built-CLI scenarios pass on Node 26.3.0 and 22.12.0 against the same 740,734-byte artifact, SHA-256 `a1e6d195488232c9bd5bdb38b02bc6a73f6bfab86a3031512ac2e96968b673e5`. A disposable same-lockfile probe measured 1.4s with `--no-audit` versus the earlier 301s advisory timeout. Explicit normalized dependency auditing remains unimplemented; local-only, no host dispatch, commit or push.

## 2026-10-21 - Readable, exclusion-aware review packets (local)

**Changed.** Owner-approved single JSON packets carry the exact rubric as bounded ordered text parts, explicit sampled-item guidance, and canonical default/effective exclusions. Reviewer, Analyst and focused-pass instructions apply restrictions before native reads/searches and never use kernel records as substitute evidence. Stored review schemas remain strict; cooperative guidance is not a sandbox claim.

**Files.** Core review/exclusion helpers; Reviewer/Analyst/stateless packet callers; two agent bindings and review guidance; existing contract/Analyst tests and UAT driver; technical specification, plan and SP-08 evidence.

**Verification.** Red-first packet controls; full local CI passes 723 tests/150 suites. All 47 built-CLI UAT scenarios pass on Node 26.3.0 and 22.12.0 against one 740,396-byte bundle. Quality ceilings unchanged. Native behavior on this payload remains unobserved; exhausted SP-08 authorization was not extended. No commit or push.

## 2026-10-21 - Subcommand help cannot open work (local)

**Changed.** A live SP-08 attempt found `open investigate --help` created a Quick contract instead of displaying help. CLI help now routes to stateless inspection before command parsing or stdin reads; preload admission remains unchanged.

**Files.** CLI frontend, existing CLI-input test, built-UAT driver, technical specification §4.5, plan and SP-08 evidence report.

**Verification.** Red-first real-pipeline regression; full local CI passes 720 tests/150 suites. All 46 built-CLI UAT scenarios pass on Node 26.3.0 and 22.12.0; the new case checks four mutating commands create no state and leave Git unchanged. Host spike remains incomplete; no commit/push or release claim.

## 2026-10-21 - Evidence-integrity repairs and release-plan reassessment (local)

**Changed.** Tagged acceptance receipts now use complete per-test outcomes rather than capped failure diagnostics, preserve skipped/file-level/focused failures, and match complete example tags. Playwright reports validate nested records, actual outcomes, complete totals and identities; malformed, contradictory, interrupted or unsupported retry/expected-failure evidence cannot pass. Adapter `node-ts@3` invalidates earlier receipts. The plan now records measured progress, partial requirements, data-recovery risks and the ordered remaining implementation/qualification work.

**Files.** Kernel receipt core, Node/Playwright adapters and normalized port type; existing receipt/parser tests; technical specification §9.5/9.6 and implementation plan. No stored receipt schema, quality ceiling or host claim changed.

**Verification.** Eight red-first tests; full local CI passes 719 tests/150 suites. All 45 built-CLI UAT scenarios pass on Node 26.3.0 and 22.12.0 against the same 738,644-byte artifact. Unstaged privacy scan finds no likely leaks. Host qualification and the complete release plan remain open; no commit or push.

## 2026-10-21 — WRK-07 built: prototype promotion, the first Beta item (`✅`, local)

**Changed.** Owner authorized starting Beta-scoped work ahead of its own gate (Alpha not yet exited, SP-12 unresolved), the same judgment already applied to start Alpha early. `open promote` ("promote" was already a valid `Profile` value but hard-refused) now proceeds and floors its lane at Standard — never lower, using the same `maxLane` composition every other floor uses. This one change delivers WRK-07's full requirement: `core/verdict.ts#judgeLink` already treats a same-session review as a *blocking* `reduced-independence` reason outside Quick, so flooring at Standard alone guarantees a fresh review before `checked-local`, with no new verdict code.

**Not built, by design.** Tech-spec §12.9's "inventory `docs/hardening.md` shortcuts" and "characterize behavior with preservation tests" are coordinator workflow guidance over a free-form prose document, not kernel-enforced validation; parsing `docs/hardening.md` into structured obligations would be the over-engineering this project's principles warn against. Instead, `tenet` SKILL.md gained a short "Promoting a prototype" section instructing the coordinator to read it, propose each shortcut as a requirement or constraint for the user to confirm, and write preservation tests plus a distinguishing test per missing safeguard.

**Files.** `verbs/open.ts`, `verbs/open-new.ts`, `plugin/skills/tenet/SKILL.md`, `tech-spec.md` §12.9.

**Tests.** `packages/kernel/test/promote.test.ts` (3 new tests, tagged `[WRK-07]`); `test/audit-regressions.test.ts` updated (`"promote"` removed from the blanket specialized-profile-refusal loop; `recipe-upgrade`/`continue` remain refused there).

## 2026-10-21 — PH0-4 closed: a real branch switch confirms the existing reconciliation (`✅`, local)

**Changed.** The Phase 0 decision that branch reconciliation needs no new engine (`open`'s existing trust-comparison already re-reads shared files on every call) now has a fixture with a *real* `git checkout -b`, not just a same-branch edit. Confirms a branch with its own divergent committed `INTENT.md` and `tenet.policy.json` is treated as an ordinary external edit on `open`, with nothing carried over from the old branch's paused contract.

**Files.** `adopt.test.ts`.

**Tests.** 1 new test.

## 2026-10-21 — EVD-13: a free port, a verified server, a dedicated test database (`✅`, local)

**Changed.** EVD-13 is now T1-tagged: a global `OB-e2e` obligation runs Playwright against a server Tenet starts and verifies for the current candidate, on a dedicated test database, never the developer's own. New: `Runner#allocatePort` (bind 0, read, release, retried on `EADDRINUSE`), `adapters/playwright.ts` (a new Stack-port adapter normalizing Playwright's JSON report into the same shape Vitest's uses), `core/obligations.ts#wantsE2e`/`withE2e`. The free port, a run token and a dedicated database path are generated per run and passed as environment; Playwright's own `webServer` starts the real server as its child, so no new server-lifecycle code was needed in the runner. The starter recipe pins `@playwright/test`, adds `playwright.config.ts` and one real e2e spec (server-identity + database-isolation).

**Two real defects found and fixed, not style choices.** `tsx`'s own IPC socket path exceeds the platform's socket-path length limit inside Tenet's run directory, failing the server with `EINVAL` — the recipe now starts its server with plain `node --experimental-strip-types`. Playwright's default `test-results/` output directory landed inside the project tree, correctly tripping the kernel's own concurrent-edit guard — `playwright.config.ts` now redirects it into the run's own `TMPDIR`.

**One test adjusted, not weakened.** `requirements.test.ts`'s SEC-03 network-import scan now permits `node:net` in exactly `adapters/runner.ts`, for the port allocator's bind-and-release only (a separate assertion confirms no client/`.connect(` usage appears) — this makes no network connection and carries no data, so it does not touch what SEC-03 forbids.

**Files.** `adapters/runner.ts`, `adapters/playwright.ts` (new), `adapters/report-bounds.ts` (new), `adapters/node-ts.ts`, `core/obligations.ts`, `verbs/check.ts`, `verbs/check-evidence.ts`, `decisions/{basis,scaffold}.ts`, `verbs/reconcile.ts`, `ports/types.ts`, `core/schemas.ts`, `test/requirements.test.ts`, the starter template (`package.json`, `playwright.config.ts`, `server/test/e2e/server-identity.e2e.spec.ts`, `.gitignore`), `recipe.json`, `tech-spec.md` §12.7.

**Tests.** 8 new `playwright-adapter.test.ts` unit tests (pass/fail/skip counting, nested suites, malformed reports, path traversal); `starter.test.ts` extended with real `OB-e2e` assertions (a real `npm ci`, a real Playwright run against a real started server).

## 2026-10-21 — Golden task: the equipment-loan feature built by the real loop (`✅`, local)

**Changed.** QLT-01 (persistence, validation, server-side object/role authorization, a real local journey) and QLT-12 (identity, exposure and data model per PRD §5.16) are now T1-tagged, proven by a golden-task test: a real starter scaffold, a real Standard-lane feature task for PRD's equipment-loan example (items, reservations, borrower privacy), a genuine baseline red, a genuine green with persistence/validation/object-role-authorization, a 5-process database concurrency race (TS §12.5's own stated test), and the Deep lane's native architect and security passes (the migration raises reversibility and compatibility) reaching `checked-local`, committed.

**A caught mistake.** The feature was first written directly into the shipped recipe template, contradicting TS §12.2's explicit "`features/<f>/` starts empty." Reverted before commit; rebuilt as a kernel-side golden-task fixture instead (inert `.txt` files, never `.ts`, so this repo's own typecheck and test glob never pick them up).

**Files.** `packages/kernel/test/golden-task-loan-desk.test.ts`, `packages/kernel/test/fixtures/golden-tasks/loan-desk/**`, `tech-spec.md` §12.2.

**Tests.** 1 new golden-task test (scaffold → basis → red → green → review → architect/security → finish).

## 2026-10-21 — INS-04: plugin-ready, project-ready, action-ready reporting (`✅`, local)

**Changed.** INS-04 had no tech-spec or ux-spec section at all, only a one-line PRD requirement — a genuine spec gap, now backfilled (TS §8.2). A new pure `readinessReport` in `core/risk.ts` groups the existing readiness probes `assistanceLevel` already gates into two tiers (plugin-ready: Tenet's own prerequisites; project-ready: this project's stack/state) with zero change to any existing gating logic. `inspect doctor` reports both; `inspect why` additionally reports action-ready (every current verdict reason that is not a disclosure note), repeating plugin/project there only when not ready.

**Files.** `core/risk.ts`, `verbs/inspect.ts`, `tech-spec.md` §8.2, `readiness-report.test.ts`.

**Tests.** 4 new tests: a healthy project, a project missing dependencies, action-ready true at `checked-local`, action-ready false naming an unauthorized protected-path edit.

## 2026-10-21 — RSC-01/RSC-03 tagged by a structural-absence proof (`✅`, local)

**Changed.** RSC-01 ("the Reviewer and an analyst always inherit the active model, with no path to request a different one") and RSC-03 ("no mechanism exists to switch models, fund, purchase or enable overage") are now T1-tagged in `model-record.test.ts` — by a structural scan proving the mechanism is absent from the source, not a scenario, since these are absence claims a behavioral test cannot demonstrate any better. RSC-01 reuses an existing test (no field exists to request a model, so inheriting it is the only possible outcome). RSC-03 is two new tests scanning the `VERBS`/`DECISIONS` registries and the closed `ActionClass` vocabulary for any funding/model-switch-related name.

**Files.** `model-record.test.ts`.

**Tests.** 2 new tests plus 1 retagged existing test. Alpha coverage: 83 → 85 Musts tagged, unmapped 8 → 6.

## 2026-10-20 — pnpm dependency verification; corrected a tech-spec claim (`✅`, local)

**Changed.** Dependency verification (SEC-05) extends from npm-only to npm and pnpm: a hand-rolled line scanner reads pnpm-lock.yaml's narrow shape (no new kernel dependency, no general YAML parser). Generating real pnpm lockfiles found tech-spec's claim that pnpm records lifecycle-script evidence via `requiresBuild` was wrong — it records none at all, so pnpm's script status is honestly `"unknown"` (disclosed, never blocking, never silently treated as "no script"). Same for license: pnpm's lockfile has no license field, so license-policy checks stay unavailable for pnpm. Yarn remains refused.

**Files.** `core/dependencies.ts`, `decisions/{dependency,dependency-start,dependency-job}.ts`, `core/schemas.ts`, `verbs/recover-effects.ts`, `tech-spec.md` §9.11, `dependencies.test.ts`, `dependency.test.ts`.

**Tests.** 3 new pure-parser tests, 1 policy test, 1 end-to-end pnpm resolve-preview-install test, 1 yarn-refusal test.

## 2026-10-20 — `decide basis` refuses a support input that overlaps its own scope (`✅`, local)

**Changed.** A real VS Code host run found that listing the file being implemented as a locked `support` input guarantees a self-inflicted `red-invalidated`, no matter how correct the implementation is, discovered only after a full implement-review-check cycle. `decide basis` now refuses this at proposal time, before anything is recorded (new reason code `support-overlaps-scope`, exit 1).

**Files.** `decisions/basis.ts`, `core/reasons.ts`, `declared-inputs.test.ts`, `tenet-intake/SKILL.md`.

**Tests.** One new test: refuses the basis and records nothing when `support` names a `scopePaths` path.

## 2026-10-20 — Fix the shared-testFile receipt-matching bug found in the live spike (`✅`, local)

**Changed.** The same VS Code run found that a passing preservation example sharing a test file with a failing distinguishing example was wrongly marked unproven at baseline — `core/receipts.ts` aggregated by file, not by the obligation's own assertions. A test whose title names its own example id (`[EX-006-5ze.1]`, the id `decide basis` returns) is now matched to only its own tagged assertions; untagged behavior is unchanged.

**Files.** `core/receipts.ts`, `receipts.test.ts`, `scenarios.test.ts`, `tenet-intake/SKILL.md`, `tech-spec.md` §9.6.

**Tests.** Two unit tests (precise match when tagged; unchanged fallback when not) and one end-to-end scenario reproducing the live failure shape.

## 2026-10-21 — Starter restore tool; CI security checks (`✅`, local)

**Changed.** The starter can restore a verified backup (`npm run restore -- <backup>`): it refuses a corrupt backup, one from newer code, or a busy database, keeps the replaced file aside, and says which code the data needs. A test fails if the CI workflow gains a privileged trigger, a secret, a wider token or persisted checkout credentials. A verdict test proves a recheck is chained to the basis of its full review.

**Files.** Starter `server/src/platform/restore.ts`, `server/src/restore-cli.ts`, `package.json`, `eslint.config.js`, docs and skill text; `packages/kernel/test/{ci-security,verdict}.test.ts`.

**Tests.** Four starter tests, `ci-security.test.ts` (5), one verdict test.

## 2026-10-21 — No function over the limits (`✅`, local)

**Changed.** `judgeReview`, `verdict`, `comparePolicy`, `effectivePolicy` and `resolveSetting` are split into short functions. Behaviour is unchanged; the recorded function offenders go from five to none. 287 over-wide lines remain recorded (296 before).

**Files.** `core/{verdict,policy,config}.ts`, `tools/quality-baseline.json`.

**Tests.** None added or changed: the existing suites are the proof.

## 2026-10-21 — Host port and capability descriptor (`◐`, local)

**Changed.** The plugin ships a capability descriptor and a `Host` port reads it. `inspect doctor` shows it; the review-independence control says what the host binding observed, and nothing it did not; the charter reader takes its candidate files from the descriptor. A host name in core, verbs, decisions or the pipeline now fails `lint-arch`.

**Files.** `core/{capabilities,controls}.ts`, `adapters/host-plugin.ts`, `ports/types.ts`, `wire.ts`, `verbs/{finish,inspect,manifest}.ts`, `plugin/com.github.copilot/descriptor.json`, `tools/{lint-arch,lint-quality}.ts`, specs (TS §4.4, §6.2).

**Tests.** `host-descriptor.test.ts` added (4).

## 2026-10-21 — Project charter in review manifests (`◐`, local)

**Changed.** The Reviewer's manifest carries the project's own charter when `AGENTS.md` or `.github/copilot-instructions.md` has one valid marked block, and the default charter otherwise. Adopting a charter is not built; it waits for SP-02.

**Files.** `core/charter.ts` (new), `verbs/manifest.ts`, `tools/lint-quality.ts`, specs (TS §6.2, §7.8).

**Tests.** `charter.test.ts` added (3).

## 2026-10-21 — Active work time (`✅`, local)

**Changed.** The kernel counts active work time between check-ins (call durations plus the gap after a call that said to keep working), warns at 80% of 15, 60 or 120 minutes, and refuses a new full candidate check at the bound with a proposal to extend. `decide extend --quote <words>` records the user's yes and restarts the count. The tenet skill has the steering row.

**Files.** `core/{budget,schemas}.ts`, `pipeline{,-render,-mutate}.ts`, `verbs/check.ts`, `decisions/{extend,index}.ts`, `plugin/skills/tenet/SKILL.md`, `tools/lint-quality.ts`, specs (TS §6.2, §8.6).

**Tests.** `active-time.test.ts` added (3).

## 2026-10-21 — Model record (`✅`, local)

**Changed.** The contract and each review and analyst result record the model the coordinator reported (`--model` on `open` and `findings`), or `inherited` with source `unknown`; `open`, `inspect status` and `finish` show it. Nothing is inferred. The tenet skill says to pass `--model` only when the host reports it.

**Files.** `core/{schemas,state}.ts`, `verbs/{open-new,open-context,findings,inspect,finish}.ts`, `plugin/skills/tenet/SKILL.md`, `tools/lint-quality.ts`, specs (TS §4.8, §6.2).

**Tests.** `model-record.test.ts` added (3).

## 2026-10-21 — Deep evidence (`✅`, local)

**Changed.** Deep work finishes `checked-local` only after a complete native architect pass and security pass on the current candidate. Before, the verdict ignored Analyst results and Deep could never get there. After the review is recorded, the result lists the passes still owed. The plugin has the spec's `tenet-analyst` agent; `tenet-reviewer` is for reviews only. The size ceiling for pipeline, verbs and decisions is 3,720 lines (+10).

**Files.** `core/verdict.ts`, `verbs/{facts,findings,manifest}.ts`, `plugin/com.github.copilot/agents/{tenet-analyst,tenet,tenet-reviewer}.agent.md`, `plugin/skills/tenet/SKILL.md`, `tools/lint-quality.ts`, specs (TS §6.2).

**Tests.** `deep.test.ts` added (2); `verdict.test.ts` (+2); the lint-skills fixture follows the new agents line. 662 tests.

## 2026-10-20 — Build TDD-03: test-alongside with a negative control (`✅`, local)

Implemented the protocol proposed and approved earlier: a new `disposition` outcome, `alongside`, lets the user record why a behavioral red is infeasible for an obligation (a reason is still required, like every other disposition). A new `--alongside <paths>` flag on `check` (mirroring the existing `--scaffold` flag) exempts named existing source paths from the baseline contamination check, but only once some obligation has a recorded `alongsideReason` — an undeclared `--alongside` bypasses nothing, and the seeded fault still has to genuinely fail the test for the baseline to be proved. Once proved, the verdict discloses `reason("test-alongside", ...)` as a non-blocking note (a reason code that existed in the registry but was previously dead code). Four new tests cover the refusal, the no-bypass-without-a-reason case, a non-failing seeded fault granting no false proof, and the full protocol reaching `checked-local` with the disclosure.

Changed `core/schemas.ts` (`Obligation.alongsideReason`, `WorkContract`/`CheckInput.alongside`), `verbs/check.ts`, `verbs/check-evidence.ts`, `core/verdict.ts`, `decisions/simple.ts` (split `disposition.run` into `reviseLock`/`dispositionAttention`/`dispositionFinding`/`dispositionElement`/`recordAlongside` to keep it under the quality gate after the new branch — this also dropped it from the recorded-offender list), `scenarios.test.ts`. Module budgets re-baselined as recorded feature increments: `core/schemas` 440→445 lines, `pipeline+verbs+decisions` 3,670→3,710 lines. Full `npm run ci` green: **658 tests / 136 suites**; 5 recorded quality offenders left, was 6; built-bundle UAT green; `npm run privacy` clean. Alpha coverage: TDD-03 newly T1-mapped (80/100, was 79).

## 2026-10-20 — Tag WRK-10's checkpoint clause honestly, partial (`◐`, local)

WRK-10 has two distinct clauses: checkpointing so a pause or interruption loses at most the work since the last checkpoint (T1-capable, already proven by two existing tests), and never auto-confirming a host pause (kernel has no concept of this; host territory, unobserved). Tagged only the first clause, on the existing pause/resume and SIGKILL-during-check tests. Considered INS-04 (three-tier readiness) too and left it untagged: the current single-scale assistance level does not actually report three separate tiers, so tagging it would repeat the mis-tagging pattern corrected earlier.

Changed `workflows.test.ts`, `scenarios.test.ts` (test-title tags only, no production code). Full `npm run ci` green: **654 tests / 135 suites**; built-bundle UAT green. Alpha coverage: WRK-10 newly T1-mapped, partial (79/100).

## 2026-10-20 — Verify `branching: current` through `integrate`; correct stale progress notes (`✅`, local)

Added the missing end-to-end test: an editing contract set to `branching: current` stays on its base branch through basis, check and finish, then `integrate` correctly refuses ("committed on the base branch itself") instead of erroring or switching branches. The one existing "nothing to integrate" test used a non-editing profile, which never takes a branch regardless of this setting, so it didn't actually prove this path. Also corrected three stale "not done" notes in the plan: `exclusions`/`required_checks`/`dependency_policy` already have real consumers; `commands` and `resource_mode` consumers genuinely remain open but for different, more current reasons (execution envelopes and an R1 Should, respectively, not "no analyst yet").

Changed `integrate.test.ts`. Full `npm run ci` green: **654 tests / 135 suites**; built-bundle UAT green.

## 2026-10-20 — Reduce `buildPlan`'s complexity below the quality gate's limit (`✅`, local)

Behavior-preserving refactor: split `core/plan.ts#buildPlan` (complexity 35) into `assignIds` (ID validation/assignment), `buildItem` (one proposed item's construction and same-vs-changed check) and a much shorter orchestrating `buildPlan` (complexity 12). No test changed; the full suite passes unmodified.

Changed `core/plan.ts`. Full `npm run ci` green: **653 tests / 135 suites**; built-bundle UAT green. 6 recorded quality offenders left, was 7.

## 2026-10-20 — Reduce `issueReview`'s complexity below the quality gate's limit (`✅`, local)

Behavior-preserving refactor: extracted `admissionGate`, `nextAttempt`, `dispatchNext` and `reserveIssued` out of `verbs/manifest.ts#issueReview`, the single highest-complexity function recorded by the quality ratchet (47). It is now 30 lines, complexity 21, within the per-function limit and no longer an offender (7 left, was 8). No test changed; the full suite passes unmodified.

Changed `verbs/manifest.ts`. Module budget bumped by a small recorded increment (3,650→3,670 lines) for the extracted functions' own declarations — quality-refactor growth, not new scope. Full `npm run ci` green: **653 tests / 135 suites**; built-bundle UAT green.

## 2026-10-20 — Default engineering charter reaches the Reviewer (`◐`, local)

The review manifest now carries a `charter` field (PRD §1.8's default engineering charter, 115/300 tokens), and the reviewer's Stage B is told to judge against it literally. This is the first charter awareness the Reviewer has had at all. Scope: only the default-charter half of QLT-09; a project's own adopted charter (parsed from `AGENTS.md`/`copilot-instructions.md`) remains unbuilt.

Changed `core/review.ts`, `verbs/manifest.ts`, `plugin/skills/tenet-review/SKILL.md`. New assertion in `contract.test.ts` (tagged `[QLT-09]`). Full `npm run ci` green: **653 tests / 135 suites**; built-bundle UAT green. Alpha coverage: QLT-09 newly T1-mapped (78/100).

## 2026-10-20 — Guard `repair-lock` against an unreproduced race (`◐`, local)

`repairLock` checked both lock files for liveness, then unconditionally removed whatever existed in a second pass — unlike the already-safe `breakStale` path, which re-reads and compares the nonce immediately before removing. A fresh live claim landing between the two passes would have been deleted. Fixed to match the existing safe pattern exactly. This is a code-reviewed defensive fix, not one proven by a reproduced race (R08's real-process races remain scheduled, not closed).

Changed `adapters/store-fs.ts`. New idempotency test in `store.test.ts`. Full `npm run ci` green: **653 tests / 135 suites**; built-bundle UAT green.

## 2026-10-20 — Selected-fix integrity fixes (`◐`, local)

`open fix` now refuses duplicate finding numbers instead of silently colliding two findings on the same synthesized ID. `attentionOf`'s stray-file exemption now compares a vetted file's current content hash to its recorded one, instead of exempting any path merely present in `vetted`: an edit to a scaffolded file outside the named findings is no longer silently invisible to review.

Changed `verbs/open.ts`, `verbs/check-evidence.ts`. New tests in `fix.test.ts` (2 added, 6 total). Full `npm run ci` green: **652 tests / 135 suites**; built-bundle UAT green. R09 remains open: review-identity retention, stale-review-context detection, explicit scope extension.

## 2026-10-20 — Bounded project-file reads and a log-repair fix (`◐`, local)

A bounded slice of R07 (storage bounds): project-file reads (policy, intent, manifest, lockfile) now refuse past 20 MB instead of loading unbounded. Found and fixed a real defect: `repairLogTail` never actually truncated a torn log line that happened to end in a newline — the keep-prefix calculation used the file's own trailing newline instead of the newline before the bad line, so corrupted bytes accumulated in `.tenet/log` forever (harmless to past recovery, since `readLog()` already drops the line per-entry, but wasteful and re-parsed every transaction).

Changed `adapters/project-fs.ts`, `adapters/store-fs.ts`, `core/reasons.ts` (new code `project-file-too-large`). New tests in `store.test.ts` and `project-boundary.test.ts`. Full `npm run ci` green: **650 tests / 135 suites**; built-bundle UAT green. R07 remains open: log-entry schema validation, bounded blob/log-tail reads, a total `.tenet` ceiling, and a real `sweepTemp` retention protocol.

## 2026-10-20 — Analyst agent, first slice (`◐`, local)

`packet analyst` dispatches a read-only researcher/architect/security assignment with no basis precondition; `findings` records its result via a new `kind`-discriminated `AnalystResult`/`ReviewResult` union. Several analysts can be live at once on one declared revision (AGT-03), reusing the existing reservation mechanism unchanged. A moved revision between dispatch and result is disclosed as a non-blocking note (AGT-11); non-completed status is never treated as a finished answer (AGT-05). Reuses the existing `tenet-reviewer` subagent; adds `architect.md`/`security.md` rubric resources.

Changed `core/schemas.ts`, `core/review.ts`, `core/state.ts`, `verbs/{packet,findings,manifest}.ts`, `plugin/skills/tenet/SKILL.md`, `plugin/com.github.copilot/agents/tenet-reviewer.agent.md`, `tools/lint-skills.ts`, `tools/uat/uat.mjs`. Module budgets re-baselined as recorded feature increments: `core/schemas` 400→440 lines, `pipeline+verbs+decisions` 3,560→3,645 lines (TS §6.2). New: `analyst.test.ts` (7 tests). Full `npm run ci` green: **648 tests / 135 suites**; built-bundle UAT green. Alpha coverage: AGT-03, AGT-05 newly T1-mapped (77/100). Not committed; not observed on a real host (SP-08 remains deferred).

## 2026-10-20 — Static populations and required-check conflicts (`◐`, local)

Conflicting required-check definitions now block checking and verdicts instead of silently selecting one. Doctor applies metadata exclusions before reading. Default static receipts retain bounded analyzed workspace files and reject unknown, linked, stat-only, malformed or incomplete proof. Supported local TypeScript/ESLint profiles are explicit; unsupported versions/configuration graphs do not execute. TypeScript names the project and disables incremental writes. Runner output is bounded by bytes, preserves UTF-8 across chunks and reports truncation as inconclusive. Adapter `node-ts@2` stales older evidence.

Changed configuration/receipt/schema/pipeline consumers, Node/process adapters, regression suites and built-CLI UAT. Final CI: **641 tests / 134 suites pass**, including 34 new controls. **45 UAT scenarios pass on Node 26.3.0 and minimum 22.12.0 against one 713,587-byte artifact**. [Evidence, fixture corrections and remaining work](docs/audits/2026-10-20/static-integrity.md). No ceiling raised, host run, commit or push. Effective configuration/dependency graphs and composite/reference isolation remain open before broader execution support.

## 2026-10-20 — Guarded Git filter preparation (`◐`, local)

Filter execution now stages through the published, guarded commit job with a recorded process group, minimal environment, timeout and cancellation. Intent preparation disables filters and filesystem monitors. Current consent preserves duplicate command order. Mutations or moved HEAD prevent an ordinary commit result; transformations refuse until committed-tree checks exist. Recovery checks the known work trailer and fails closed on unreadable trees.

Changed `adapters/git-cli.ts`, new pure `core/git-filters.ts`, commit/recovery ports and consumers, `filter-jobs.test.ts`, built-CLI UAT and canonical progress/mechanism docs. **607 tests / 131 suites pass; 38 built-CLI scenarios pass on Node 26.3.0 and 22.12.0** against the same 710,549-byte artifact. Sixteen new real Git/process controls. [Evidence and remaining work](docs/audits/2026-10-20/filter-jobs.md). No quality ceiling raised, host run, commit or push. R05/R06 static population and obligation composition are next; full Git qualification stays open.

## 2026-10-20 — GitHub reassessment and policy/static-evidence corrections (`◐`, local)

Reviewed the twelve cloud commits through `d457714` and their successful GitHub CI; added a current audit, all F01–F22 dispositions, a 200-requirement inventory and an ordered completion plan. Tightened adopted restrictions now apply before recovery/read-only admission. Contradictory ESLint populations are inconclusive, and unsupported static configuration/population/pass/alternatives refuse default substitution.

Changed `verbs/reconcile.ts`, `core/obligations.ts`, `adapters/node-ts.ts`, three regression suites, built-CLI UAT and canonical progress/mechanism documentation. Full CI: **591 tests / 130 suites pass**; **33 UAT scenarios pass on Node 26.3.0 and 22.12.0** against the same 709,447-byte bundle. No quality ceiling changed. Configured-filter preparation and the report's remaining gaps stay open. No host run, new commit or push.

## 2026-10-20 — Boundary-example note (`✅` T1; review plan A3d)

**Changed.** `decide basis` now says which requirement has neither a boundary example nor an invariant (`boundary-example-missing`, a note), except in Quick, so the coordinator proposes one as its own addition (INT-15). The intake skill says what to do with the note.

**Files.** `decisions/basis.ts`, `core/{obligations,reasons}.ts`, `plugin/skills/tenet-intake/SKILL.md`. **Tests.** `boundary-example.test.ts` (2); 579 tests. Alpha Musts with a T1 fixture: 76 of 100.

## 2026-10-20 — "Fix findings N and M" (`✅` T1; review plan A3c)

**Changed.** `open fix` takes the findings the user named, as the review gave them. They become the contract's open findings (`FND-n`) and its scope; a change to a file they do not name raises an attention item (`outside the named findings`) that needs a disposition, and the verdict stays unchecked while a named major finding is open. Before, the `fix` profile was refused. The tenet skill's steering row uses it.

**Files.** `core/schemas.ts`, `verbs/{open,open-new,check-evidence}.ts`, `plugin/skills/tenet/SKILL.md`, specs (TS §2.4).

**Tests.** `fix.test.ts` added (4). 577 tests.

## 2026-10-20 — Starter: backup before migrating, byte-wise secret comparison (`✅` T1; review plan A3b)

**Changed.** The starter takes a verified backup beside its database file before it applies a migration to a database that already holds data (it only happened if the caller passed a path, and the real start path never did). Secrets are compared by bytes through one `safeEqual`: a CSRF token with the same number of characters but different bytes was an unhandled error, and is now a 403. Not done: the restore tool, the UI shell and the first journey.

**Files.** Starter `server/src/platform/{migrate,safe-equal}.ts`, `auth/csrf.ts`, `session/session.ts` and two starter test files.

**Tests.** Two starter tests added (they run inside the kernel's starter suite: 24 tests); 573 kernel tests.

## 2026-10-20 — The starter reaches checked-local; declining a step (`✅` T1; review plan A2a, A3a)

**Changed.** Unchanged files a recipe scaffold wrote no longer raise the lane (they were forcing Deep, which cannot be satisfied yet), so the starter scaffold ends `checked-local` and committed, with its tests, types and lint run by the kernel. `decide decline --target tests|review --quote <words>` records a declined mandatory step: the contract stops with reason `declined` and the result names the step, instead of `finish` answering `continue-required`. The tenet skill's steering table uses it.

**Files.** `pipeline-mutate.ts`, `decisions/{decline,index}.ts`, `plugin/skills/tenet/SKILL.md`, specs (TS §6.5, §8.2).

**Tests.** `decline.test.ts` added; `starter.test.ts` and `scaffold.test.ts` assert the new journey. 573 tests.

## 2026-10-20 — The kernel runs the project's typecheck and lint (`✅` T1; review plan A1a)

**Changed.** `check` runs TypeScript and ESLint as obligations (`OB-types`, `OB-lint`) with their own receipts and normalization, so a passing test run cannot hide a type error. A contract owes them when its recipe names them (`recipe.json` `checks`; the starter does) or when a required check is named `types`, `typecheck`, `lint`, or has tool `tsc` or `eslint`; they apply from the next call after the setting changes. Other required checks and configured commands are still refused. CI runs on every branch push.

**Files.** `adapters/node-ts.ts`, `core/{obligations,receipts,config,schemas}.ts`, `ports/types.ts`, `verbs/{check,check-evidence,check-finalize,reconcile,inspect}.ts`, `decisions/{basis,scaffold}.ts`, `pipeline-mutate.ts`, starter `recipe.json`, workflow, specs (TS §12.2).

**Tests.** `static-checks.test.ts` added (normalization, receipts, which checks are owed, a real `tsc` through the pipeline); `starter.test.ts` now relies on the kernel's own types and lint. 569 tests.

## 2026-10-20 — Stabilise: Git filters, refusals, budgets, UAT in CI (`✅` T1; review plan S0)

**Changed.** Reading never runs a configured Git filter, and a filter no file uses no longer matters (Git LFS installed globally blocked `open`, `check` and `review` with no way forward). A commit that would run an applying filter asks first (`filter-consent`) and runs it only after consent; undo and integration refuse under one. Refusals have their own reason codes and a next step (`handle-required`, `handle-unknown`, `not-a-repository`, `hook-consent-needed`, `filters-not-run`); a refused `open` in a folder with no Git creates nothing. Module line budgets are ceilings in `tools/lint-quality.ts`, counted in lines. One default for a test's baseline expectation. The built-bundle scenarios moved to `tools/uat/` and run in CI on Node 24 and 22.12.0.

**Files.** `adapters/git-cli.ts`, `ports/types.ts`, `decisions/consent.ts`, `verbs/commit*.ts`, `verbs/open*.ts`, `pipeline*.ts`, `core/{errors,reasons,obligations,verdict,risk}.ts`, `tools/lint-quality.ts`, `tools/coverage.ts`, `tools/uat/`, CI workflow, `README.md`, specs (TS §6.2 names the budget checker).

**Tests.** `filters.test.ts` and `refusals.test.ts` added; `quality-gate.test.ts` covers module ceilings; three expectations moved to the new codes. 556 tests; the starter install test needs registry access.

## 2026-10-19 to 2026-10-20 — C0 corrective batch after the audit (committed in `e0bc1a0`, CI green)

**Changed.** Safety corrections found by `docs/audits/2026-10-19`: store and state admission, source ownership and late-job fencing, human-file attribution, operation exclusions and flagged Git inputs, receipt and baseline integrity, lock revision provenance, risk, budget and branch admission, a destructive-stop preview, Quick's focused review, takeover confirmation, guarded runner spawn and report admission, quarantine and fresh start, durable spent-counter recovery, journalled index-sync recovery, checkout-hook admission, atomic project-file writes with policy-aware recovery. Unbuilt committed-tree checks, scoped review and specialised profiles refuse. Later commits split the longest functions and added the quality ratchet (`tools/lint-quality.ts`).

**Files.** Kernel adapters, core, verbs, decisions, pipeline, ports; plugin guidance; tools; specs; `docs/audits/`.

**Tests.** 545 tests / 118 suites at `e0bc1a0`; thirty built-bundle scenarios on Node 26.3.0 and 22.12.0. Details: `docs/audits/2026-10-19/remediation.md` and `remediation-evidence.json`.

## 2026-10-19 — Declared scaffolding, self-sufficient review manifest, plugin loads on Copilot CLI and VS Code

Added `check --stage baseline --scaffold <paths>` (declared scaffolding is not contamination; TS §9.8), a working-tree digest in the call identity (TS §6.4), a review manifest that carries the reviewer's `rubric` and a `resultTemplate` (the reviewer subagent has only read and search tools and cannot load a skill), a YAML-parsing front-matter lint, and the real `$schema` URL in `plugin.json`. Plugin text: every `description` is quoted YAML; the `tenet` skill defines how to run the kernel and says to stop if not started by the agent. Budgets: bundle 750 KB, pipeline/verbs/decisions 2,200 lines with a 250-line cap per file. Observed on Copilot CLI 1.0.99 and VS Code 1.142.0: the standard-lane loop with a real reviewer subagent (see `specs/plan.md` §4.1; partly observed). Tests: 201. Modified: `packages/kernel/src` (schemas, check, manifest, review, recipes), `plugin/`, `tools/` (build, coverage, lint-skills), `specs/tech-spec.md`, `specs/plan.md`. New dev dependency: `yaml`.

## 2026-10-19 — Prototypes, hook and index observations, support locks, integrate and undo

Added the shadow repository for non-Git prototypes, `decide sync-index`, locks on support files and runner configuration, `integrate` and `undo` (with `decide undo-confirm`, `branch-switch` and `config`), `tools/bench-inventory.ts`, and tests against real husky and lint-staged. Tests: 196. Modified: `packages/kernel/src` (git adapter, pipeline verbs and decisions), `plugin/skills`, `specs/plan.md`.

## 2026-10-18 — M0 kernel, plugin, starter recipe

Added the deterministic kernel (ten verbs, one pipeline, six ports), the plugin (agents, commands, five skills), the `ts-web-api` starter recipe and its scaffold effect, the build, architecture, skill and privacy checks, and a requirement-to-fixture coverage report. Tests: 177 across core, verdict, store, Git, scenarios, workflows, scaffold, starter, tools and invariants. Not observed on the real VS Code Copilot host; see `specs/plan.md`.

| Area | Where |
|---|---|
| Kernel | `packages/kernel/src` |
| Plugin | `plugin/` |
| Checks | `tools/` |
| Tests | `packages/kernel/test` |
