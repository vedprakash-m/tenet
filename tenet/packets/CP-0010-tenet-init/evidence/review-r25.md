# Review — CP-0010 round 25 (PR #31: `origin/r24/remove-safety`)

- **Branch reviewed:** `origin/r24/remove-safety` at `9da3237` (commits `f6fef7a`, `b1ed4de`, `be3c139`, `12519a9`, `9da3237`) vs `origin/main` (`e0c18c8`) / [review-r24.md](review-r24.md), [answers-r19.md](../escalations/answers-r19.md), [answers-r20.md](../escalations/answers-r20.md), [contracts.md §13](../../../specs/tech-spec/contracts.md#L132-L145), and [onboarding.md §2](../../../specs/tech-spec/onboarding.md#L73-L114).
- **Note:** Code was inspected from `origin/r24/remove-safety` (`9da3237`) and its diff against `origin/main` without editing `src/**` or `test/**`.

---

## Status of `review-r24.md` Blockers and Shoulds

| Item | Summary | Status | Evidence (`origin/r24/remove-safety` vs ruling) |
|---|---|---|---|
| **Blocker 1** | PR #24 CLI `stderr` notice when `ci.mode !== "none"` | **RESOLVED** | `src/install/types.ts:316`, `src/install/doctor.ts:188-198, 246-279, 333, 348, 398`, `src/commands/doctor.ts:30-32`, `test/install/cli.test.ts` (`doctor` assertions added in `pr31.diff:574-576`). |
| **Blocker 2** | PR #25 `remove` symlink traversal & validate-before-delete | **NOT RESOLVED** | Fixed for `.tenet/` working state (`src/install/remove.ts:69-104, 277-281, 320-327, 372-379, 431-440`; `test/install/conformance.test.ts:619-659`), **but regressed in `validateRecordedPaths()`** (`src/install/remove.ts:166-168`). |
| **Blocker 3** | PR #25 nested/emptied `.tenet/` subdirectories stay behind | **NOT RESOLVED** | Fixed for `.tenet/cache/**` and `.tenet/runs/**` (`src/install/remove.ts:350-364`, `conformance.test.ts:614-616`), **but still leaves empty `.tenet/onboard/` and `.tenet/reports/` (plus `.tenet/`) behind after `init` -> `onboard` -> `remove`** (`src/install/remove.ts:404-422, 571-573`). |
| **Should 1** | PR #25 pre-existing empty `.tenet/` directories deleted | **RESOLVED** | `src/install/remove.ts:357, 415-422, 571-573`; `test/install/conformance.test.ts:661-678`. |
| **Should 2** | PR #24 `localLockIntegrity` version guard | **RESOLVED** | `src/install/integrity.ts:130-132`; `src/install/doctor.ts:188-189`; `test/install/doctor.test.ts:704-732`. |
| **Should 3** | PR #25 Windows case-insensitive path matching in `remove.ts` | **NOT RESOLVED** | `src/install/remove.ts:306, 367-396` unchanged. |

---

## Detailed Findings on Remaining Blockers

1. **Blocker 2 (NOT RESOLVED / regression) — `validateRecordedPaths()` bypasses `confine()` when any recorded manifest path traverses a symlink (`src/install/remove.ts:99-104, 166-168, 467-535` vs `onboarding.md:102`, `answers-r19.md:9`):**
   - `validateRecordedPaths()` (`src/install/remove.ts:167`) switched from `await confine(itemPath, cwd)` to `await validateRemovalPath(cwd, itemPath)`.
   - Because `validateRemovalPath()` (`lines 99-104`) returns immediately (`if (await symlinkPath(cwd, relative)) return;`) without calling `confine()`, any entry in `manifest.created`, `manifest.blocks`, `manifest.keys`, or `pending.writes` whose parent directory is a symlink (even pointing outside `cwd`) passes preflight validation.
   - `remove()` then deletes earlier `manifest.created` files (`lines 467-482`) before the creation/block/key loops call `await confine(item.path, cwd)` (`lines 468, 486, 509`) — throwing `TN-PATH-ESCAPE` mid-removal when targeting outside `cwd`, or deleting through an inside-repo symlink if the target resolves inside `cwd`.
   - **Fix needed:** Keep `confine(itemPath, cwd)` (never skipping symlinks) for `manifest.created`, `manifest.blocks`, `manifest.keys`, `manifest["x-created-directories"]`, and `pending.writes` in `validateRecordedPaths()`, reserving `validateRemovalPath()` strictly for `.tenet/` generated working state and `.tenet/manifest*.json` where unlinking a symlink without traversal is the intended behavior (`lines 277-281, 320-327, 372-379`). Also check `manifest.created` / `blocks` / `keys` against symlinks if symlinked inside `cwd`.
   - *(Confirmed working in PR #31: `symlinkPath()` cleanly unlinks inside/outside symlinked `.tenet/onboard`, `.tenet/reports`, `.tenet/cache`, `.tenet/runs`, and `.tenet/manifest*.json` without touching targets, and `lines 431-440` validate `configuredReports` such as `.tenet/reports/../secrets.json` before any deletion.)*

2. **Blocker 3 (NOT RESOLVED) — `.tenet/onboard/` and `.tenet/reports/` created after `init` stay behind when a manifest exists (`src/install/remove.ts:404-422, 571-573` vs `answers-r19.md:7, 23`, `onboarding.md:112`):**
   - `removePathTree()` (`lines 350-364`) now cleans nested subdirectories under `.tenet/cache/**` and `.tenet/runs/**`.
   - However, `manifest["x-created-directories"]` only records directories for `init`'s own `plan.created` / `blocks` / `keys` paths (`src/install/writes.ts:56-76, 793-798`), which include `.tenet` but never `.tenet/onboard` or `.tenet/reports`. Those directories are created later by `tenet onboard` or test runs.
   - In `removeGeneratedWorkingState()` (`src/install/remove.ts:404-422`), `removedParents` tracks every `.tenet/*` parent from which `removeRegularFile()` deleted a generated file (`line 407`), **but `lines 418-422` only remove `removedParents` when `createdDirectories === null` (the manifest-less path at `line 454`)**.
   - On the normal `init` -> `onboard --inventory-only` -> `remove` sequence (`line 572` passes `new Set(createdDirectories)`), `removedParents` is ignored, leaving empty `.tenet/onboard/` (and `.tenet/reports/` if emptied) behind and causing `rmdir(".tenet")` (`line 573`) to fail `ENOTEMPTY`.
   - *(Note: removing `[...removedParents]` unconditionally when empty preserves pre-existing empty `.tenet/onboard` / `.tenet/reports` directories too, because `removedParents` only includes parents where a Tenet generated file was actually deleted at `line 406` — provided `removePathTree` / `removeEmptyManagedDirectories` only `rmdir`s `.tenet/onboard` / `.tenet/reports` when `removedParents.has(...) || createdDirectories.has(...)`.)*

---

## Remaining Should & Sync Notes

- **Should 3 (NOT RESOLVED — `src/install/remove.ts:306, 367-396`):** `configuredReportPaths()` remains case-sensitive for `.tenet/reports/`, and `removeRegularFile()` uses `lstat` on `standardReportPaths` without checking exact basename case on case-insensitive Windows NTFS.
- **Registry error code alignment (`12519a9`, `src/install/integrity.ts:141, 203` vs `703a150` `contracts.md §13`, `messages.md §2`, `answers-r20.md:9`, `onboarding.md:77`):** PR #31's commit `12519a9` still throws `TN-LOCK-INVALID` (exit 1) for npm registry transport/lookup failures (`test/install/cli.test.ts`, `test/install/integrity.test.ts` assert `TN-LOCK-INVALID`), and forces `--registry=https://registry.npmjs.org/`. Now that `TN-ENV-REGISTRY` (environment class, exit 3, exact template in `messages.md §2`) is registered on `r25/registry-code`, update `src/install/integrity.ts` and its tests to emit `TN-ENV-REGISTRY` for registry transport failures (keeping `TN-LOCK-INVALID` for malformed `integrity` strings/responses). Also note that forcing `--registry=https://registry.npmjs.org/` ignores corporate/mirror npm registry configuration if a user legitimately sets one in user/global `.npmrc` (check if intentional to block only repo-local `.npmrc`).
- **Scenario isolation (`9da3237`, `test/onboard/scenarios.test.ts:809-833`):** Cleanly injects `TENET_TEST_REGISTRY_INTEGRITY: "not-found"` in `cliStep()` and `faultRun()` so scenarios stay offline without hitting npm.

VERDICT: CHANGES REQUESTED
