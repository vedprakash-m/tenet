# Review — CP-0010 round 24 (PRs #21, #24, #25, #26)

- **Branch reviewed:** `r24/review-mai-fixes-track2` at `origin/main` (`e0c18c8`; `r24/review-mai-fixes` already checked out in `tenet-track1`)
- **Scope:** PR #21 (`204ee1d`), PR #24 (`58801af`, merged at `e0c18c8`), PR #25 (`22a1a39`), and PR #26 (`cbb6d70`, registry integrity portion) against [pending-r18.md](../escalations/pending-r18.md), [answers-r19.md](../escalations/answers-r19.md), [answers-r20.md](../escalations/answers-r20.md), [audit-r20.md](../../release-0.1.0-alpha.0/audit-r20.md), [INIT.md](../../../../pkg/evals/smoke/results/2026-11-24/INIT.md), [contracts.md §1](../../../specs/tech-spec/contracts.md#L19), and [onboarding.md §2](../../../specs/tech-spec/onboarding.md#L73-L114).
- **Per-PR Verdicts:**
  - **PR #21 (`204ee1d`):** `APPROVE`
  - **PR #24 (`58801af`):** `CHANGES REQUESTED`
  - **PR #25 (`22a1a39`):** `CHANGES REQUESTED`
  - **PR #26 (`cbb6d70`, integrity part):** `APPROVE`

---

## Blockers

1. **PR #24 — Missing CLI `stderr` non-blocking notice for matched local-integrity locks when CI is configured (`src/commands/doctor.ts:23-34` vs `answers-r20.md:27`, `onboarding.md:77`):**
   - `answers-r20.md:27` requires: when both `kit_sha256` and `localIntegrity` match on a `x-integrity-source: "local"` lock, *"CLI stderr prints a non-blocking notice when CI workflows are configured (`ci.mode !== \"none\"`)."*
   - `src/install/doctor.ts:327-330` appends the advisory note to `checks[name="lock"].detail` only, and `src/commands/doctor.ts:24-34` never writes any notice to `context.stderr` (unlike `src/commands/init.ts:206` and `src/commands/upgrade.ts:58`). Running `tenet doctor --json` or `tenet doctor --quiet` emits empty `stderr` even when GitHub CI workflows are present.

2. **PR #25 — `removeGeneratedWorkingState` traverses symlinks inside the repo and validates confinement only after deleting manifest and managed files (`src/install/remove.ts:226-299, 327-329, 340-346, 454` vs `answers-r19.md:9, 15`, `onboarding.md:102, 112`):**
   - `removeRegularFile` (`src/install/remove.ts:287`) calls `confine(relative, cwd)` (`src/core/fs.ts:35-60`), which resolves `realpath()`. If a managed parent directory (for example `.tenet`, `.tenet/onboard`, or `.tenet/reports`) is a symlink pointing to another directory inside the repository (such as `notes/`), `confine()` resolves into `notes/`, `lstat(filename)` (`remove.ts:292`) sees `stat.isFile() === true`, and `rm(filename)` deletes the user's file outside `.tenet/`. Similarly `removePathTree` (`remove.ts:254`) resolves `parentPath` through `confine()`, following a symlinked `.tenet`, `.tenet/cache`, or `.tenet/runs` parent inside `cwd`. (`answers-r19.md:15` and `onboarding.md:112` require `lstat` confinement without traversing symlinks.)
   - Conversely, if `.tenet/onboard/inventory.json`, a `.tenet/reports/` file, or a path inside `.tenet/cache/` / `.tenet/runs/` is a symlink pointing **outside** `cwd` — or if `tenet.yaml` holds `report_path: .tenet/reports/../secrets.json` (`configuredReportPaths` at `remove.ts:238` checks `normalized.startsWith(".tenet/reports/")` before normalizing `..`) — `validateRecordedPaths()` (`remove.ts:88-141`) does not check those paths up front. `remove()` first deletes `manifest.created`, `manifest.blocks`, `manifest.keys`, and `.tenet/manifest.json` (`remove.ts:350-453`), and then crashes at `line 454` with `TN-PATH-ESCAPE`, leaving the repository half-removed.

3. **PR #25 — Nested `.tenet/cache/**` and `.tenet/runs/**` subdirectories remain as untracked empty directories (`src/install/remove.ts:266-277, 318-321` vs `answers-r19.md:7, 23`, `onboarding.md:112`):**
   - `removePathTree()` (`remove.ts:266-277`) recursively deletes files and symlinks inside `.tenet/cache` and `.tenet/runs`, but never calls `rmdir` on emptied nested subdirectories (for example `.tenet/runs/session/`). `removeEmptyManagedDirectories()` (`lines 318-321`) then checks only `[".tenet/onboard", ".tenet/reports", ".tenet/cache", ".tenet/runs", ".tenet"]`, finds `.tenet/runs` non-empty (`line 217`), and silently leaves `.tenet/runs/session/`, `.tenet/runs/`, and `.tenet/` behind. (Notice `test/install/conformance.test.ts:624, 632-643` created `.tenet/runs/session/output.txt` and verified the file was deleted, but did not assert `.tenet/runs/session` or `.tenet/runs` was removed.)

---

## Shoulds

1. **PR #25 — `removeGeneratedWorkingState` unconditionally `rmdir`s pre-existing empty `.tenet/` directories (`src/install/remove.ts:318-321` vs `lines 455-456` and PR #21):**
   - PR #21 specifically recorded `"x-created-directories"` (`src/install/writes.ts:56-76`) so `remove()` (`lines 455-456`) leaves pre-existing empty directories intact. Unconditionally passing `[".tenet/onboard", ".tenet/reports", ".tenet/cache", ".tenet/runs", ".tenet"]` at `remove.ts:318-321` deletes a pre-existing empty `.tenet` or `.tenet/reports` directory even when omitted from `x-created-directories`.

2. **PR #24 — `localLockIntegrity()` does not guard `lock.version === installedVersion` (`src/install/doctor.ts:172-204, 322` vs `answers-r20.md:26`):**
   - `answers-r20.md:26` restricts the local digest check to `lock.version === installedVersion`. In standard projects `verifyPackageLock` (`src/policy/kit.ts:206-212`) throws `TN-LOCK-MISMATCH` before `localLockIntegrity()` runs, but when `policy.kit_path === "kit"` (`src/policy/kit.ts:190-192` skips lock checks) or when a `verifyLock` dependency skips version checks, `localLockIntegrity()` (`doctor.ts:177`, which also uses `path.join` rather than `confine`) still checks `lock.integrity` and can report `TN-LOCK-INVALID` instead of `TN-LOCK-MISMATCH`.

3. **PR #25 — Case-insensitive filename handling in `remove.ts` on Windows (`src/install/remove.ts:238, 287-295, 306-312`):**
   - `configuredReportPaths()` (`line 238`) matches `.tenet/reports/` case-sensitively (`normalized.startsWith(".tenet/reports/")`), missing mixed-case Windows `report_path` entries, while `removeRegularFile()` on `standardReportPaths` (`lines 309, 291-295`) deletes via `lstat` without verifying exact basename case, which on NTFS would match a user file such as `.tenet/reports/TEST.XML`.

---

## Notes

1. **PR #21 (`pending-r18.md` items 1–4 and smoke findings):**
   - `pendingIntegrityFinding()` (`src/install/writes.ts:1112-1134, 1246`) and `src/install/init.ts:54` preserve `local-integrity` findings across interrupted-install resume.
   - `resumePendingPlan()` (`src/install/writes.ts:1210-1214`) reconstructs `plan.created` from `pending.writes.filter((write) => write.kind === "file")` plus `.tenet/manifest.json`, keeping `.gitignore` and `.gitattributes` solely in `plan.blocks`.
   - `completeWrote()` (`src/install/writes.ts:1102-1110, 1228`) returns a checkpoint-invariant `wrote` set while replay (`line 1234`) remains idempotent.
   - `cleanVersion("ssh", ...)` (`src/install/doctor.ts:48`) accepts `OpenSSH_for_Windows_*`.
   - `pullRequestTemplatePath()` (`src/install/preflight.ts:374-390, 532`; `writes.ts:907`) preserves existing `.github/PULL_REQUEST_TEMPLATE.md` casing.
   - `createdDirectories()` (`writes.ts:56-76`) + `"x-created-directories"` (`src/install/types.ts:154` / `remove.ts:455-461`) preserves pre-existing empty `tenet/` directories (`conformance.test.ts:598-614`).
   - Note that PR #21's filter in `src/onboard/findings.ts` (`pr21.diff:343-346`) excluding `.(agents|claude)/skills/tenet-*/SKILL.md` is no longer present at `src/onboard/findings.ts:51` on `origin/main` because a later onboarding classification change stopped tagging skill files as `doc`/`adr`.
2. **PR #25 (`audit-r20.md` seed & pin refresh):**
   - `seededIntent()` (`src/install/writes.ts:703-738`) strips sample requirements and checkout paths from `tenet/intent.md`, leaving only comment placeholders; verified in `test/install/cli.test.ts:201-222` (no `dead-path` findings and no `- R-n` lines).
   - `shouldApplyCreated()` (`src/install/upgrade.ts:97`) forces `tenet.lock` replacement whenever its `sha256` changes (`test/install/conformance.test.ts:669-707`), allowing same-version pin refreshes and clean transitions from `"x-integrity-source": "local"` to registry-pinned locks (`writes.ts:681`).
3. **PR #26 (`answers-r20.md §1` prerelease registry lookup):**
   - `releaseIntegrity()` (`src/install/integrity.ts:158-179`) skips npm lookup only when `options.offline === true` or `version === "0.0.0"`, queries `npm view <pkg>@<version> dist.integrity --json` for published prereleases (`lines 91-123`), treats only 404/not-found as missing (`line 113`), and rejects transport/registry errors with `TN-LOCK-INVALID` (`line 114`).

---

## Four-Question Check per PR

1. **Does the code do exactly what the ruling says, no more and no less?**
   - **PR #21:** Yes — resolves `pending-r18.md` items 1–4 and the smoke `INIT.md` issues (`dead-path` on skills, `PULL_REQUEST_TEMPLATE.md` case, pre-existing empty directories).
   - **PR #24:** Partially — `doctor` recomputes `localIntegrity` and reports matching/mismatched status cleanly (`src/install/doctor.ts:172-204, 322-330`), but misses the `answers-r20.md:27` CLI `stderr` non-blocking notice when `ci.mode !== "none"` (**Blocker 1**) and relies on `verifyLock` running first for `lock.version !== installedVersion` (**Should 2**).
   - **PR #25:** Mostly — `seededIntent()`, `upgrade` pin refresh, and `remove` of `.tenet/onboard/{inventory,assignment}.json` + `.tenet/reports/` match `audit-r20.md` and `answers-r19.md`, except `remove.ts` misses no-symlink-traversal `lstat` confinement (**Blocker 2**), leaves nested `.tenet/runs/**` / `.tenet/cache/**` subdirectories (**Blocker 3**), and can remove pre-existing empty `.tenet/` dirs (**Should 1**).
   - **PR #26 (integrity):** Yes — matches `answers-r20.md §1` and `contracts.md:19`.

2. **Is it tested, including edge cases named in the rulings?**
   - **PR #21:** Well tested (`test/install/conformance.test.ts:379-438, 567-614`, `test/install/doctor.test.ts:276-300`, `test/install/cli.test.ts:201-222`).
   - **PR #24:** `test/install/doctor.test.ts:207-274` tests local-integrity match and mismatch via `doctorEvaluation()`; CLI `stderr` behavior under `ci.mode !== "none"` is untested (because unimplemented).
   - **PR #25:** `test/install/conformance.test.ts:616-653, 669-707` and `test/install/cli.test.ts:209-222` cover basic `.tenet/` file preservation, an external junction inside `.tenet/cache/`, pin refresh, and seed cleanliness, but miss nested `.tenet/runs/session` cleanup assertions, symlinked `.tenet/onboard` or `.tenet/reports` parents, external symlinks on working-state files, escaping `checks[].report_path`, and pre-existing empty `.tenet/`.
   - **PR #26 (integrity):** `test/install/integrity.test.ts:5-22` tests `"0.1.0-alpha.0"` registry lookup via injected mock; `cli.test.ts:176-199, 256` test `"not-found"` fallback. (`--offline`, `0.0.0`, and non-404 failures are not directly covered in `integrity.test.ts`.)

3. **Can a user be surprised or lose data (especially `remove`, symlinks, case-insensitive paths, pre-existing `.tenet/` content)?**
   - **PR #21 & PR #26 (integrity):** No unexpected data loss observed.
   - **PR #24:** Minor surprise — `tenet doctor --json` / `--quiet` gives no `stderr` advisory notice when `ci.mode !== "none"`.
   - **PR #25:** Yes (**Blockers 2 & 3, Shoulds 1 & 3**): symlinked `.tenet/onboard` / `.tenet/reports` / `.tenet` directories pointing inside the repo can have targets deleted outside `.tenet/`; external symlinks in working state or `../` in `checks[].report_path` crash `remove` *after* deleting `manifest.json`; nested `.tenet/runs/session/` directories survive as untracked dirs after `.gitignore` removal; pre-existing empty `.tenet/` can be removed.

4. **Does any test reach the network or the real home folder?**
   - **Network:** None. Checked `test/install/cli.test.ts:26, 38, 52, 75, 256` (all subprocess runs set `TENET_INSTALL_INTEGRITY` or `TENET_TEST_REGISTRY_INTEGRITY: "not-found"`), `test/install/integrity.test.ts:14` (mock `registry`), `test/install/conformance.test.ts:35-37, 113-147` (`pkg/conformance/install/environment.json` static releases), `test/install/doctor.test.ts` (`environment()`), and `pkg/evals/onboarding/run.mjs:67` (`TENET_TEST_REGISTRY_INTEGRITY: "not-found"`).
   - **Real home folder:** None reached. `cli.test.ts:238-260, 307-339`, `conformance.test.ts:130-147`, `doctor.test.ts`, and `evals/onboarding/run.mjs:50-66` isolate `HOME`/`USERPROFILE`/`APPDATA`/`localProfileRoot` in scratch directories. Minor hygiene note: `cli.test.ts:18-49` (`run()`) does not strip `HOME`/`USERPROFILE`/`APPDATA` from the subprocess environment, relying on those tests not passing `--local-hosts` or local-host markers.

---

## Verification Observed on `r24/review-mai-fixes-track2` (`e0c18c8`)

- `npm test -- test/install/doctor.test.ts test/install/integrity.test.ts test/install/cli.test.ts test/specs/review-r4.test.ts`: **37 passed, 0 failed, 0 skipped**.
- `npm test -- test/install/conformance.test.ts`: **50 passed, 0 failed, 0 skipped**.

VERDICT: CHANGES REQUESTED
