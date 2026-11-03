# Reason codes with no test (2026-11-03)

Scope: the 27 of 119 codes in `packages/kernel/src/core/reasons.ts` that no test names (plan §13 finding, 2026-11-01; `node tools/coverage.ts --milestone M0` reported 92 of 119 referenced). Sixteen have no producer in `packages/kernel/src`; eleven have a producer and no test. Each code was traced to what TS Appendix C, the UX Spec and the PRD say raises it, then classified.

Result: the coverage tool now reports **103 of 119**. No production code changed. The 16 codes with no producer stay unreferenced: 14 belong to features that are not built, one needs an owner decision and one is a spec defect.

## Classification counts

| Classification | Codes |
|---|---|
| tested-now (producer exists, test added) | 11 |
| deferred-to-unimplemented-feature | 14 |
| blocked-on-decision | 1 (`disk-full`) |
| spec-defect | 1 (`basis-gap-open`) |

Of the 11 tested, 6 were run and pass on this Windows host and 5 need Linux or macOS (the kernel refuses mutating verbs on win32, and a Windows directory cannot be fsynced, so the store cannot publish state here). Those 5 are written but unrun; CI is their validation.

## Table

"Verified locally" means the test ran and passed on this host. For the 11 tested codes, the 5 pure or adapter tests were also shown to fail when the producer's reason code was changed (then reverted), which stands in for a failing-first run because the producer already existed.

| Code | Spec trigger | Classification | Action taken | Test | Verified locally |
|---|---|---|---|---|---|
| `recheck-exhausted` | TS §8.6 budgets, Recheck row: one per contract, a second is refused; PRD REV-05 | tested-now | Test on `checkResult`: rechecks used = 1 refuses with this code, 0 accepts | `reason-codes.test.ts` "refuses a second recheck result…" | yes |
| `run-dir-unavailable` | TS §9.3 Run directory: without a writable run directory checks do not run; UX §10 "No temporary space" | tested-now | Test on `FsStore.tempDir` and `writeArtifact`: escaping names, and a temporary area that cannot be created. Store level only; the `check` verb's response to this refusal is not tested (see gap 3) | `reason-codes.test.ts` "store: run directory" (2 tests) | yes |
| `envelope-unknown` | TS §9.3 Envelope record, SEC-15: unknown exposure leads to one question before spawn | tested-now | Test on `envelopeConsentPlan`: exit 3, the code with the envelope hash as ref, one `envelope-consent` question, no re-ask once consented, none for an empty command list | `reason-codes.test.ts` "execution envelope: unknown exposure" (2 tests) | yes |
| `inventory-too-large` | TS §9.4 guard: more than 20,000 untracked files or 500 MB; UX §10 | tested-now | Real Git repository with 20,001 untracked files; `inventory` rejects with the code, exit 2, naming `.gitignore`. The 500 MB half has no code (gap 2) | `reason-codes.test.ts` "refuses an inventory of more than 20,000…" | yes |
| `git-locked` | TS §15.2: index.lock held, 3 retries with backoff, then `git-locked` | tested-now (classification only) | A pre-commit hook takes `$GIT_INDEX_FILE.lock`, so real Git fails its own `git add` with its real "index.lock" message; the commit adapter maps that text to the code and HEAD stays put. The retry with backoff has no code (gap 1) | `reason-codes.test.ts` "reports git-locked…" | yes |
| `git-identity-missing` | TS §10.3 Failures and GIT-15: missing identity leaves the candidate uncommitted; UX §10 | tested-now | Real repository with `user.useConfigOnly` and no name or email: `probe().identity` is false and the commit adapter returns the code with HEAD unchanged. The verb-level refusal in `commit.ts` is not driven | `reason-codes.test.ts` "leaves the candidate uncommitted with git-identity-missing…" | yes |
| `attribution-unexplained-change` | TS §10.2 attribution table: a clean or absent file Tenet did not declare is a question at the next boundary | tested-now | Added an assertion to the existing GIT-08 flow that already asserts the `unexplained` question | `scenarios.test.ts` "keeps a concurrent edit to an unrelated file out of the commit…" | no (needs Linux or macOS) |
| `attribution-mixed-file` | TS §10.2: a dirty file Tenet must edit needs the user's decision first; PRD 5.12 | tested-now | New test: file dirty at `open`, outside scope, then declared in `check --touched`; expects exit 3, the `dirty-overlap` question and this code | `reason-codes.test.ts` "asks before Tenet edits a file the person already changed…" | no |
| `branch-switch-needed` | TS §10.4 Branch switch disclosed, never silent; UX A12; Appendix C | tested-now | Added assertions to the existing test that already asserts the `branch-switch` question with uncommitted edits | `integrate.test.ts` "asks before a switch that carries uncommitted edits…" | no |
| `hook-consent-needed` | GIT-12 and UX-D16: hook consent is asked once before the first commit | tested-now | Added an assertion to the existing flow that already asserts the `hook-consent` question | `backup-accounting.test.ts` "replays a foreign-path review gate…" | no |
| `host-limit` | TS §15.2 and §11.4: on a host usage limit, `stop pause` with `host-limit`, counters intact | tested-now | New test: `stop --mode pause --reason host-limit` sets stop reason `host-limit`, parks the contract and leaves the six counters unchanged. The code is a stop reason only; no response lists it as a reason (gap 4) | `reason-codes.test.ts` "a host usage limit parks the contract…" | no |
| `classification-unknown` | TS App. C; `evidence-classification.md` EC-3; `sealed-baseline.md` SB-8 | deferred: EVD-04 sealed baseline (Beta). `sealed-baseline.md` is unsigned; plan §13 says `baselineFailures` stays empty and unknown failures are `evidence-failed` | none | none | n/a |
| `sealed-deps-unavailable` | TS §9.8; `sealed-baseline.md` E10 (workspaces, linked `node_modules`, no lockfile) | deferred: EVD-04 sealed baseline, same spec | none | none | n/a |
| `alternative-check-missing` | TS §8.3 verdict pseudo-code, `judgeAlternativeCheck`; PRD TDD-06 | deferred: TDD-06 (Beta). No model for a declared alternative check; `verdict.ts` has only `judgeRed` | none | none | n/a |
| `accessibility-claim-narrowed` | TS §8.3 Limitations; PRD QLT-03 | deferred: QLT-03 (R1). No journey or screen-reader check record exists | none | none | n/a |
| `fitness-trend-degraded` | PRD QLT-05 and §4.3; TS App. C | deferred: QLT-05 (R1). No workload or fitness-function model | none | none | n/a |
| `audit-unavailable` | TS §8.3 Limitations; §9.5 tool table (`npm audit --json`, kind `audit`) | deferred: the audit adapter under EVD-05. `kind: "audit"` is accepted by the schema and nothing runs it | none | none | n/a |
| `dependency-unverified` | TS §9.11 step 7 and §17.3: an install that bypassed Tenet | deferred: SEC-05 after-the-fact detection (Alpha, listed partial in plan §13). Steps 1 to 6 are built | none | none | n/a |
| `port-in-use` | TS §9.3 Servers step 3 (brownfield fixed port) | deferred: EVD-13 brownfield path. Only the starter's allocated port exists. How a fixed port is discovered is not specified | none | none | n/a |
| `server-identity-weak` | TS §9.3 Servers step 3 (server without the run token) | deferred: EVD-13 brownfield path | none | none | n/a |
| `build-not-fresh` | TS §9.3 Servers step 4 | deferred: EVD-13 brownfield path. There is no "declares a build step" field on an obligation | none | none | n/a |
| `migration-needs-approval` | TS §7.7 and LFC-04; `schema-migration.md` VM-4, E7 | deferred: LFC-04 (R1). D1 to D3 approved and the version pin built; the migration half is open (plan §13) | none | none | n/a |
| `observation-incomplete` | TS §4.7: spool capped at 500 files, then the next result reports observation as incomplete | deferred: observer hooks (Beta), gated on spike SP-03, which needs separate authorization. `kernel/hook.mjs` does not exist | none | none | n/a |
| `ended-without-finish` | TS §4.7 `Stop` hook row | deferred: observer hooks, same gate | none | none | n/a |
| `model-unqualified-for-deep` | TS §4.8 Deep warning; PRD RSC-08 | deferred: RSC-08 (R1). Waits for the qualification table (plan A2b-iii) | none | none | n/a |
| `disk-full` | TS §15.2: "`disk-full` (exit 2); completed effects listed" | blocked-on-decision: D1 below | none | none | n/a |
| `basis-gap-open` | TS §8.3 and App. C list it; plan §12.3 (2026-10-18) records that M0 turns each basis gap into a `major` finding and reports `major-undisposed`, so it is never emitted | spec-defect: the Appendix C row has no trigger in the shipped design; already logged in plan §12.3 | none | none | n/a |

## Gaps found while tracing (spec says more than the code does)

1. **`git-locked` retry.** TS §15.2 says three retries with backoff of 100 to 800 ms, then `git-locked`. The code retries nothing on a commit: it maps Git's output text. The index-sync lock retries three times at 40 ms and then reports `index-sync-needed`, not `git-locked`.
2. **`inventory-too-large` size.** TS §9.4 also limits untracked content to 500 MB. `git-cli.ts` checks the file count only.
3. **`run-dir-unavailable` exit.** Appendix C gives exit 0, and `KernelError` takes its exit from the registry, so the store's refusal carries exit 0 even though checks cannot run (NFR-03 says a required control never fails open silently). I could not run the pipeline here to see how the response renders. Needs a look on Linux.
4. **`host-limit` is not a reason in any response.** It appears only as the `StopReason` value, so the registry exit of 2 never applies. This matches TS §8.1 ("Stop reasons"), so it may be intended; Appendix C lists it as a reason code.
5. **`classification-unknown` text.** Appendix C says "a sealed baseline passed but the start tree was dirty"; EC-3 and SB-8 use it for any unclassifiable failure. `sealed-baseline.md` D7 already lists the Appendix C amendment.

## Decisions for the owner

- **D1, `disk-full`.** The trigger is clear (no space left, exit 2) but the mapping is not placed. The one central place is `fail()` in `pipeline.ts` (map `ENOSPC` to the code), and the `pipeline + verbs + decisions` ceiling has 37 characters of room; the change needs about 120 and I did not raise the ceiling. A second question is whether `ENOSPC` during an in-flight effect should stay `effect-uncertain`. Recommendation: map `ENOSPC` in `fail()` only when no effect intent is open, raise the ceiling by the measured amount, and list completed effects from the transaction. Alternative: leave `disk-full` unimplemented and record that it is covered by exit 5 today.
- **D2, `basis-gap-open`.** Amend Appendix C to say the code is reserved and not emitted in R1 (recommended: registry additions are minor under §6.7, removals are not), or remove the row.

## Not done

- `specs/plan.md` and `CHANGELOG.md` were not edited, to avoid merge conflicts with parallel lanes. The plan §13 finding of 2026-11-01 (line 1522) should be closed with this file's counts: 11 tested, 14 deferred, 1 decision, 1 spec defect.
- The five unrun tests are the only changes not proven on this host.
