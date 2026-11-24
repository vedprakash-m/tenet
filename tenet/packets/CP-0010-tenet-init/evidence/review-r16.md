# Review — CP-0010 (round 16)

- **Branch reviewed:** `origin/r9/cp-0010` at `5df814f` (PR #3, merged from `origin/main`), compared against [review-r14.md](review-r14.md), [answers-r14.md](../escalations/answers-r14.md), [pending-r13.md](../../CP-0009-tenet-check-structure/escalations/pending-r13.md), and the round-16 ruling in [answers-r16.md](../escalations/answers-r16.md).
- **Verdict:** **APPROVE** (all three install blockers B1–B3, the CP-0009 stale-flags bug, and S1–S2 are fixed; B4 and S3 have only minor non-blocking follow-up notes below).

## Round 14 Findings Re-evaluation

### Blockers from review-r14.md

1. **B1 — Unconsented writes outside the repository under `init --yes` on Windows:** **FIXED**
   - `src/install/environment.ts:20-52` (`localProfileRoots`, `windowsCommandShimRequired`): returns `undefined` outside `win32` unless `environment.localProfileRoot` / `windowsCommandShimRequired` is injected, and removes the `os.homedir()` fallback (`:4-40`).
   - `src/install/preflight.ts:472-491`: `localHostsAuthorized` requires `options.localHosts === true`, `options.answers?.allowLocalHosts === true`, or fixture `environment.localProfileRoot !== undefined`; `tenet init --yes` leaves `plan.local_keys: []` and omits `.tenet/manifest.local.json`. Interactive runs emit the `localHosts` prompt (`Edit local host settings outside the repository?`, `default: false`).
   - `src/commands/init.ts:61, 84-87, 114-115, 131, 157-176`: adds `--local-hosts`, uses `Will edit locally (outside repository): ...`, prompts `[y/N] `, and prints the manual `"cmd /c npx -y @vedprakash-m/tenet@${version} mcp"` instruction when declined.
   - `src/install/upgrade.ts:40-53, 193-206, 272-278`: `currentLocalManifest()` reads `.tenet/manifest.local.json`, sets `result.plan.local_keys` strictly from `local?.keys ?? []`, and `shouldApplyLocalKey()` updates only previously recorded entries matching the prior `cmd /c` definition.

2. **B2 — Unpublished, `0.0.0`, prerelease, and `--offline` installs crashing with `TN-INTERNAL`:** **FIXED**
   - `src/install/integrity.ts:35-48`: `installedPackage()` reads the package's `package.json` (`TN-LOCK-INVALID` if unreadable/incomplete).
   - `src/install/integrity.ts:28-33, 86-155`: `releaseIntegrity()` validates explicit overrides and registry `dist.integrity` (`npm view <pkg>@<ver> dist.integrity --json`, permitted by PRD `R-080`) against `/^sha512-[A-Za-z0-9+/]{86}==$/` (`TN-LOCK-INVALID` on malformed or non-404 lookup failure). When `--offline`, `0.0.0`, prerelease (`-`), or registry 404, `localIntegrity()` (`:65-84`) computes deterministic `sha512-` over sorted `package.json`, `LICENSE`, `README.md`, `dist/**`, `kit/**`, and `pkg/{migrations,conformance,hosts}/**`.
   - `src/install/writes.ts:652-658, 984`, `src/install/init.ts:56-61, 75`, `kit/schemas/results/init.json:49`, `src/commands/init.ts:205-207`, `src/commands/upgrade.ts:47-62`: records `"x-integrity-source": "local"` in `tenet.lock`, returns the non-blocking `local-integrity` finding in `init` results, and warns plainly on `stderr` without failing.

3. **B3 — Empty-repo `one-file` output and `examples/starter/` failing `tenet check`:** **FIXED**
   - `src/install/writes.ts:142-151, 164-174, 585-587, 648-650, 840-845`: `buildPolicy()` drops the hardcoded 5-file `specs.documents` list; `documentsLine(hasIntent)` emits `tenet/intent.md (L1)` in `AGENTS.md` for empty repos or when `tenet/intent.md` exists.
   - `kit/templates/intent.md:18-29` and `examples/starter/tenet/intent.md:21-29`: adds `Origin` to the Vision table and removes the commented requirement example; `examples/starter/tenet.yaml:5-11`, `examples/starter/AGENTS.md:4`, `examples/starter/tenet.lock:5-7`, and `examples/starter/.tenet/manifest.json` are synced (`test/install/starter.test.ts:29-44`, verified clean with `node dist/cli.js --json --cwd examples/starter check`).

4. **B4 — Out-of-scope edits outside `CP-0010`:** **PARTLY FIXED** (non-blocking)
   - `kit/schemas/manifest.json` and `test/schemas/manifest/*` were reverted in `8def3c1`, keeping `previous_existed` optional (`src/install/types.ts:187`, `src/install/remove.ts:284-285`) while preserving zero-byte block restoration (`src/install/writes.ts:897-904`, `test/install/conformance.test.ts:510-525`).
   - Still present on the branch outside `src/install/` / `test/install/`: `src/commands/onboard.ts:47` & `test/onboard/bless/bless.test.ts:281-289` (`42a6237` structured `onboard --card` fix, intentionally retained per `8def3c1` and passing), `kit/templates/intent.md:18-29` (needed for B3), `src/specs/check.ts` & `test/check/check.test.ts` (requested CP-0009 fix + worktree git-ls-tree prefix), `src/core/hash.ts` & `src/policy/kit.ts` & `test/policy/policy.test.ts` (`kit_sha256` normalization), and `test/evals/onboarding/run.test.ts` (home isolation + no `.claude.json` check).

### Shoulds from review-r14.md

5. **S1 — `localProfileRoot()` diverging to `LOCALAPPDATA` vs `localProfileRoots()`:** **FIXED**
   - `src/install/environment.ts:4-18` resolves `USERPROFILE` → `APPDATA` → `HOME` (removing `LOCALAPPDATA` and `os.homedir()`), and `localProfileRoots()` (`:20-40`) likewise drops `os.homedir()`. Tested at `test/install/preflight.test.ts:249-284`.

6. **S2 — Biome lint warnings (`writes.ts`, `conformance.test.ts`):** **FIXED**
   - `npm run lint` (`biome lint .`) checks 211 files with 0 warnings and 0 infos.

7. **S3 — Case-specific assertions (`p03`, `p04`, `p13`, `p14`) and CLI `--local-hosts` coverage:** **PARTLY FIXED** (non-blocking)
   - `test/install/conformance.test.ts:311-343` adds direct post-`init` assertions for `p03`, `p04`, `p13`, and `p14`.
   - `test/install/preflight.test.ts:173-216` and `test/install/commands.test.ts:159-209` test `--local-hosts` / interactive refusal, while `test/install/cli.test.ts:279-319` replaced the `dist/cli.js init --yes --local-hosts` subprocess test with an SDK-level `init()`/`remove()` loop (`localProfileRoot: home`, which auto-authorizes `localKeys` via `preflight.ts:477`). Adding a follow-up `dist/cli.js` subprocess test comparing `init --yes` (omitting `--local-hosts`) vs. `init --yes --local-hosts` with a detected MCP host marker on `win32` is recommended but non-blocking.

## CP-0009 Stale-Flags Check (`pending-r13.md`)

- **FIXED:** `src/specs/check.ts:12, 325-343` removes the `flags` import and the stored-vs-computed `TN-SCHEMA` error check at `/sections/${section.slug}/flags` while keeping `schemaFindings(entry.path, "spec-front-matter", entry.doc.front)` (`:326`) and blessed-copy verification (`:327-343`). `test/check/check.test.ts:619-634` verifies stale `flags: ["edited"]` no longer emits `TN-SCHEMA`, and `pkg/conformance/scenarios/s06-change-to-shared-helper/expected/05-onboard-refresh.json` remains `ok: true` / `errors: []`. (`src/specs/check.ts:559-563, 591` also fixes `git ls-tree` pathspecs in worktrees.)

## Assessment of New Decisions

- **(a) `kit_sha256` CRLF/CR → LF normalization (`src/core/hash.ts:15-19`, `src/policy/kit.ts:6, 104`, `src/install/writes.ts:118`, `test/policy/policy.test.ts:272-274`):** **Right and safe.** All 48 files under `kit/` are UTF-8 text (`.md`, `.yaml`, `.yml`, `.json`, `pre-commit` hook); normalizing line endings matches `contracts.md §11` and prevents CRLF vs. LF mismatches between Windows checkouts and Git object blobs (`filesAtRef` via `catFileBatch`). Both `writes.ts` and `policy/kit.ts` share `sha256Text`. No content, token, indentation, or line count change can hide behind line-ending normalization; note that `sha256Text` also maps bare `\r` to `\n` (and relies on `kit/` containing UTF-8 text only). Spec ruling recorded in [answers-r16.md](../escalations/answers-r16.md) and applied to `contracts.md §1`.
- **(b) Platform-injected local-host tests (`test/install/cli.test.ts:279-319`):** **Right.** Expecting outside-repository `local_keys` strictly on `win32` (and `[]` on `linux` and `darwin`) matches `onboarding.md §2` and `answers-r14.md §1`; POSIX runs use shared repository MCP config directly and never write `cmd /c` local profile files. (Same minor coverage note as S3 regarding CLI subprocess coverage.)

## Home-Folder Isolation & Conformance Suite Audit

- **No test reaches the real user home folder:** Verified across `src/` and `test/`:
  - `src/install/environment.ts:4-40` has no `os.homedir()` fallback (`test/install/preflight.test.ts:249-284` verifies unsetting `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA` yields `local_keys: []`).
  - `test/install/conformance.test.ts:130-147` isolates `p12-windows-local-host` to `sandbox/profile` via `localProfileRoot`; `test/install/cli.test.ts:214-277` isolates `HOME`/`USERPROFILE`/`APPDATA` in temp `home` and asserts `tree(home)` unchanged; `cli.test.ts:279-319` isolates into `localProfileRoot: home`; `test/install/preflight.test.ts:185-248` redirects env vars into `repo.path` for `preflight()` only and restores in `t.after()`; `test/evals/onboarding/run.test.ts:14-43, 68, 146-206` isolates all subprocess home/temp dirs in scratch and verifies `os.homedir()`/`os.tmpdir()` confinement.
- **All 26 `pkg/conformance/install/` cases run unchanged:** `git diff --name-only origin/main...origin/r9/cp-0010 -- pkg/` is empty (`p01`–`p18` and `n01`–`n08` untouched); `test/install/conformance.test.ts` (25 cases) and `test/install/doctor.test.ts:138-169` (`n07-doctor-missing-lock`) all pass.

## Verification Observed on `origin/r9/cp-0010` (`5df814f`)

- `npm run lint`: exited `0` (`Checked 211 files in 112ms. No fixes applied.`, 0 warnings, 0 infos).
- `npm run check:examples`: exited `0` (`Checked examples across 11 documents (6 YAML, 0 JSON fences; 2 documented failures).`).
- `npm test` (full build + suite): **`496 passed, 0 failed, 0 skipped, 0 todo`** (all 82 `test/install/*.test.ts` tests, `test/onboard/bless/bless.test.ts`, `test/check/check.test.ts`, `test/policy/policy.test.ts`, and `test/evals/onboarding/run.test.ts` passed).
- `node dist/cli.js --json --cwd examples/starter check`: exited `0`, `ok: true`, `errors: []` (`summary: {errors: 0, warnings: 0, advises: 0}`).
