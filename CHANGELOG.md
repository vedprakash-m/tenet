# Changelog

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
