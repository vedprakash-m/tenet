# Review — CP-0010 (round 14)

- **Branch reviewed:** `origin/r9/cp-0010` at `d0600c3` (merged from `main` `46cc88b`), compared against `plan/alpha.0b.md` (`CP-0010`), `onboarding.md §2`, `contracts.md §§1, 6, 8, 10, 13`, `ci.md §§2–3`, `agents.md §1`, `ALG-12`, `answers-r5.md`, and the new round-14 rulings in [answers-r14.md](../escalations/answers-r14.md).
- **Verdict:** **Changes requested** (4 blockers, 3 shoulds).

Note on timing: `d0600c3` predates [answers-r14.md](../escalations/answers-r14.md) (`8ab1706`). Items 1 and 2 reflect those new rulings alongside two pre-existing contract/scope blockers (items 3 and 4).

## Blockers

1. **Unconsented writes outside the repository under `init --yes` on Windows** (`answers-r14.md §1`, `onboarding.md §2:83,93,101-104`, `contracts.md §8:100`, `plan/alpha.0b.md:79,87`)
   - `src/install/environment.ts:20-52` (`localProfileRoots`, `windowsCommandShimRequired`) and `src/install/preflight.ts:458-471` unconditionally populate `plan.local_keys` for detected MCP hosts (`claude` -> `USERPROFILE/.claude.json`, `cursor` -> `APPDATA/Cursor/User/mcp.json`, `vscode` -> `APPDATA/Code/User/mcp.json`) on `win32`.
   - `src/commands/init.ts:111-180` (`usage`, `options`, prompt loop) has no `--local-hosts` flag and no separate interactive `[y/N]` consent prompt (`Edit local host settings outside the repository? [y/N] `). Running `tenet init --yes` on Windows writes directly into real `%USERPROFILE%/.claude.json` and `%APPDATA%/{Code,Cursor}/User/mcp.json` when host markers exist.
   - Preflight human text (`src/commands/init.ts:83`) reads `Will edit locally:` rather than `Will edit locally (outside repository):` and gives no manual `cmd /c` note when declined/unflagged. `upgrade()` (`src/install/upgrade.ts:243-254`) also relies on `preflight` rather than gating strictly on `local_keys` already recorded in `.tenet/manifest.local.json` (`answers-r14.md §1`).

2. **Unpublished, `0.0.0`, prerelease, and `--offline` installs crash with `TN-INTERNAL` instead of computing local lock integrity** (`answers-r14.md §2`, `contracts.md §1:19`, `onboarding.md §2:77`, `plan/alpha.0b.md:84`)
   - `src/install/writes.ts:126-138` (`release()`) reads `environment.installedVersion ?? process.env.npm_package_version ?? "0.0.0"` instead of reading the installed package's `package.json`, never fetches registry `dist.integrity` online (`R-080`), and throws `new Error("No registry integrity was supplied for ...")` whenever `TENET_INSTALL_INTEGRITY` and `environment.registry.releases[version]` are absent.
   - `src/commands/init.ts:39-41` and `src/commands/upgrade.ts:22-24` convert that uncaught `Error` into `TN-INTERNAL` (exit `1`), breaking `tenet init --yes` and `tenet upgrade` on built `0.0.0` checkouts, unpublished `.tgz` prereleases, and `--offline` runs instead of computing deterministic `sha512-...` over installed package files (`x-integrity-source: "local"` + plain non-blocking warning) or rejecting malformed overrides with `TN-LOCK-INVALID`.

3. **Empty-repo `one-file` output and `examples/starter/` fail `tenet check`** (`CP-0010` *Owns* / *Behavior*, `onboarding.md §2:76,95`)
   - On an empty repository, `planWriteSet` (`src/install/writes.ts:633-648`) seeds `tenet/intent.md` (`one-file`), yet `buildPolicy` (`src/install/writes.ts:534-543`) hardcodes `specs.documents` to the five missing separate-layout files (`tenet/vision.md`, `tenet/specs/{prd,tech-spec,ux-spec,plan}.md`) and `documentsLine()` (`src/install/writes.ts:155-163`) writes those same five filenames into the `AGENTS.md` block instead of `tenet/intent.md`.
   - `examples/starter/` fails `node dist/cli.js --json --cwd examples/starter check` with **11 errors** (`exit 1`):
     - `TN-KIT-EDITED` on `examples/starter/tenet.lock:6`: `kit_sha256` (`b13b604d41a102024b2b35822da80fd006abf170f89f3176bf619e3571e2bac5`) does not match `kit/` (`9b865ac9981020b9c15dc920c121ad6060142c581e74aeae00143c5129560856`);
     - `10 × TN-SCHEMA` because `examples/starter/tenet.yaml:7-17` lists the five missing separate spec files (and `examples/starter/AGENTS.md:4` cites them) while only `examples/starter/tenet/intent.md` exists.
   - Regenerating `examples/starter/` cleanly (omitting `specs.documents` or pointing to `tenet/intent.md`, refreshing `tenet.lock` + `.tenet/manifest.json` digests, and syncing `AGENTS.md`) will resolve `tenet check`.

4. **Out-of-scope edits outside `CP-0010` (`kit/schemas/manifest.json`, `test/schemas/manifest/*`, `src/commands/onboard.ts`, `test/onboard/bless/bless.test.ts`)** (`plan/alpha.0b.md:78`)
   - `CP-0010` owns `src/install/`, the commands `init`/`upgrade`/`remove`/`doctor` with `kit/schemas/results/{init,upgrade,remove,doctor}.json`, `examples/starter/`, and `test/install/`.
   - `origin/r9/cp-0010` modifies `kit/schemas/manifest.json:61-74` (`CP-0004`) to make `previous_existed` **required** on `blocks[]`, forcing edits to `test/schemas/manifest/valid-contract.json:14` and `test/schemas/manifest/valid-x-extension.json:14` (and `onboarding.md §2:83` does not require `previous_existed`). Make `previous_existed` optional in `src/install/types.ts` / `manifest.json` (or drop the schema change from this packet) and revert unrelated `src/commands/onboard.ts:47` and `test/onboard/bless/bless.test.ts:281-289` (`CP-0052`) edits.

## Shoulds

5. **`localProfileRoot()` on `win32` points to `LOCALAPPDATA`, diverging from `localProfileRoots()` (`USERPROFILE` / `APPDATA`)** (`src/install/environment.ts:5-40`)
   - `localProfileRoot()` (`environment.ts:13-17`) resolves `process.env.LOCALAPPDATA` (`AppData/Local`), whereas `localProfileRoots()` (`environment.ts:31-39`) uses `USERPROFILE` for `claude` and `APPDATA` (`AppData/Roaming`) for `cursor`/`vscode`.
   - `src/install/init.ts:34,50-52,65-67` and `src/install/remove.ts:241` pass `localProfileRoot(...)` rather than `localProfileRoots(...)`. `writes.ts:801` stores `write.profile_root` per pending write, so normal `applyPlan` works, and `remove.ts:103` unions `recordedRoots` from `.tenet/manifest.local.json`; however any path falling back to `localProfileRoot()` on Windows (e.g. pending recovery or missing `manifest.local.json`) validates against `LOCALAPPDATA` instead of the host's root.

6. **Clean up Biome lint warnings in `src/install/writes.ts` and `test/install/conformance.test.ts`**
   - `npm run lint` (`biome lint .`) emits 7 warnings + 5 infos on `origin/r9/cp-0010`:
     - `src/install/writes.ts:412,423` (`noNonNullAssertion`), `:1005` (`noUnusedFunctionParameters` `plan` in `wroteItem`), `:195` (`useConst`), `:699,850,854,858,878` (`useTemplate`);
     - `test/install/conformance.test.ts:725,727` (`noAdjacentSpacesInRegex`), `:814` (`noUnusedFunctionParameters` `t`).

7. **Case-specific assertions missing in `test/install/conformance.test.ts` for `p03`, `p04`, `p13`, and `p14`**
   - `conformance.test.ts:225-344` executes all 4 cases end-to-end (checking generic files, skill naming, and repeat-`init` idempotency) and `preflight.test.ts` checks their preflight plans, but `conformance.test.ts` does not assert the produced `tenet.yaml` / workflow result for `p03`, `p04`, `p13`, or `p14` (`ci_mode`, preserved `services`/`matrix`, unmodified reusable caller). Add direct post-`init` assertions there, plus CLI tests for `init --yes` (leaves `local_keys: []` without `--local-hosts`) vs `init --yes --local-hosts`.

## Conformance & Home-Folder Audit

- **All 26 `pkg/conformance/install/` cases run unchanged:** `test/install/conformance.test.ts` reads `pkg/conformance/install/` directly for `p01`–`p18` (`lines 225-492`), `n01`–`n06`, `n08` (`lines 692-830`), and `test/install/doctor.test.ts:138-169` loads and asserts `n07-doctor-missing-lock` directly against `expected/01-doctor/tree/`. No fixture files under `pkg/conformance/install/` were modified.
- **No test in `test/install/` writes to the real user home folder:**
  - `test/install/conformance.test.ts:130-147` isolates `p12-windows-local-host` into `sandbox/profile` via `localProfileRoot` and removes `sandbox` in `t.after(() => dispose(setup))`.
  - `test/install/preflight.test.ts:89,163` passes a synthetic path with `platform: "linux"` and `preflight()` only; `preflight.test.ts:173-208` overrides `process.env.USERPROFILE` and `process.env.APPDATA` to `repo.path/{home,roaming}` and restores both in `t.after(...)` (`preflight()` only, no disk writes outside `repo`).
  - `test/install/cli.test.ts:48-89` runs `init --yes` in a clean temp repo with no `.claude`, `.cursor`, or `.vscode` directories, so zero `local_keys` are planned.
- **Contract / dependency boundaries & positives:**
  - `src/install/` and `src/commands/{init,upgrade,remove,doctor}.ts` never import `src/verify/`; workflow templates are loaded from `kit/workflows/` (`src/install/writes.ts:671-688,755`). `test/architecture.test.ts` passes (`5/5`).
  - Interruption checkpoint replay (`p11` across `pending` + every write), byte-preserving restoration (`previous_raw`, `previous_block`, `prefix_sep`), `remove` path confinement and preservation of user-edited created files/keys, `upgrade` keeping `tenet.yaml`, `doctor` bypassing the global environment gate (`checkEnvironment: false`) to check all 6 tools/artifacts, and all 4 new `kit/schemas/results/{init,upgrade,remove,doctor}.json` schemas are solid.

## Verification Observed on `origin/r9/cp-0010` (`d0600c3`)

- `npm run lint`: exited `0` (`Checked 210 files`, `7 warnings`, `5 infos` listed in Should 6).
- `npm run build` + `node --test test/install/*.test.ts`: **74 passed, 0 failed**.
- `node scripts/check-examples.mjs`: exited `0` (`Checked examples across 11 documents (6 YAML, 0 JSON fences; 2 documented failures).`).
- `node --test test/architecture.test.ts test/cli/*.test.ts`: all tests passed (`test/onboard/bless/bless.test.ts` had 1 unrelated pre-existing failure from `main` `46cc88b` at `bless.test.ts:396`, tracked on `CP-0052`).
- `node dist/cli.js --json --cwd examples/starter check`: exited `1` with **11 errors** (`1 × TN-KIT-EDITED`, `10 × TN-SCHEMA` — Blocker 3).
