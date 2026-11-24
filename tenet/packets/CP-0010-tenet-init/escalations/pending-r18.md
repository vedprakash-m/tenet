# Pending round 18 — CP-0010 code-versus-spec gaps found during scenario fixture alignment

When checking scenarios `s07`, `s11`, and `s13` against `kit/schemas/results/init.json`, `contracts.md §8`, `onboarding.md §2`, and `answers-r14.md §2`:

- **`s11/expected/01-init.json` and `s13/expected/01-init.json`:** current `init` output matches all four spec sources, so those two `init` goldens were updated.
- **`s07/expected/02-init-resume.json`:** left untouched because resumed `init` disagrees with the spec in the three ways below.

## 1. Resumed `init` drops the `local-integrity` warning

- **Spec (`tenet/packets/CP-0010-tenet-init/escalations/answers-r14.md:17`, `tenet/specs/tech-spec/onboarding.md:77`):** `0.0.0`, unpublished, local, or `--offline` builds without a registry override record `"x-integrity-source": "local"` in `tenet.lock` and warn in `findings` (`{ kind: "local-integrity", path: "tenet.lock", message }`) and stderr that CI workflows cannot verify the package until published and re-pinned via `tenet upgrade`.
- **Code (`src/install/init.ts:48-61`, `src/install/writes.ts:1104-1158`):** `init` returns immediately at line 54 (`if (resumed) return { ...resumed, findings: result.findings };`) before calling `planWriteSet` / `releaseIntegrity()`, so a resumed `init` never emits the `local-integrity` finding in `result.findings` (or `Warning:` on stderr).

## 2. Resumed `init` puts newly created block files into `plan.created`

- **Spec (`tenet/specs/tech-spec/contracts.md:114`, `kit/schemas/results/init.json:7-42`, `tenet/specs/tech-spec/onboarding.md:75-83`):** `init` is idempotent and separates created files (`plan.created`) from managed blocks (`plan.blocks`). Clean `init` (`src/install/preflight.ts:495-526`) places `.gitattributes` and `.gitignore` only in `plan.blocks`, not in `plan.created`.
- **Code (`src/install/writes.ts:893-897,1125`):** `planWriteSet` appends newly created block paths (`.gitattributes`, `.gitignore`) to `pending.manifest.created` (for `remove` cleanup), and `resumePendingPlan` reconstructs `plan.created` directly from `pending.manifest.created`, causing resumed `init` to list `.gitattributes` and `.gitignore` in BOTH `plan.created` and `plan.blocks`.

## 3. Resumed `wrote` varies per crash checkpoint against one static `02-init-resume.json`

- **Spec (`tenet/specs/tech-spec/contracts.md:114`, `kit/schemas/results/init.json:32-42`):** `wrote` lists `{ created, blocks, keys, local_keys }`.
- **Code & Runner (`src/install/writes.ts:1145`, `test/onboard/scenarios.test.ts:325-336`):** `resumePendingPlan` skips already-written files (`if (current.sha256 === write.after_sha256) continue;`), so `wrote` shrinks on every later crash checkpoint (`index = 0..N`), whereas `checkInterruptedInstall` asserts `assert.deepEqual(result.json, await readGolden(resume.expectedJson))` across every checkpoint with a single golden file.

## 4. Non-`init` follow-on gaps observed in `s07`, `s11`, `s13` (not blocking `01-init.json`)

- **`doctor` Windows OpenSSH version parsing (`src/install/doctor.ts:47` vs `tenet/specs/tech-spec.md:33`):** `tech-spec.md:33` requires `OpenSSH 8.9+`. On Windows (`OpenSSH_for_Windows_9.5p2`), `cleanVersion("ssh", ...)` uses `/OpenSSH[ _-](\d+\.\d+...)/i`, fails to match `OpenSSH_for_Windows_9.5p2`, and marks `"ssh"` `ok: false`.
- **Empty-repo `--yes` `tenet/intent.md` seed retains template checkout paths (`src/install/writes.ts:681-694` vs `tenet/specs/tech-spec/onboarding.md:95`):** `onboarding.md:95` specifies seeding `tenet/intent.md` with kind `other`, purpose `"Undecided · edit or run tenet onboard"`, and finding `no-test-report`; `writes.ts:690` leaves `kit/templates/intent.md`'s example lines (`src/checkout/gateway.ts`, `src/checkout/retry.ts`) in place, producing extra `dead-path` findings on subsequent `onboard` in `s13`.
