# Pending round 19 — Code-versus-spec gaps found aligning scenarios s11, s12, s13

Scenario fixtures checked against `origin/r11/cp-0052-fixes` (`e0bdf54`) and the specs:

- **`s12` (`pkg/conformance/scenarios/s12-ux-walkthrough-existing`):** Updated goldens (`01-init.json`, `02-onboard-inventory.json`, `06-onboard-card.json`, `06-card.md`, `08-board.json`) and changed the draft requirement ID in `steps.json` (`03-write-agent-draft`) from `C-1` to `R-1` to match `init`'s default `specs.id_prefix: R` (`contracts.md §1`, `§3`). Left without a commit between `01-init` and `02-onboard-inventory` per `ux-spec.md §1A` ("opens one onboarding pull request with the setup files") and `onboarding.md §1:14` (`dirty_warning: true`, `read_count: 10` from `HEAD`, working-tree `tenet.yaml`).
- **`s11` (`pkg/conformance/scenarios/s11-readme-walkthrough`):** Left without a commit between `01-init-yes` and `02-onboard-inventory` per `ux-spec.md §0:23-25` ("open one pull request named 'Set up Tenet' with the setup files and the drafted specifications") and `onboarding.md §1:14`. Updated `02-onboard-inventory.json` (`dirty_warning: true`, `read_count: 4` from `HEAD`), `06-onboard-card.json` / `06-card.md` (`1 source file, 1 test file`), `08-remove.json` (`contracts.md §8` / `kit/schemas/results/remove.json`), and removed `"expectedTree": "before"` on `08-remove` because `onboarding.md §2:113` requires `remove` never to touch `tenet/` specs or records (and `.tenet/onboard/` remains).
- **`s13` (`pkg/conformance/scenarios/s13-ux-walkthrough-new`):** Already commits after `init` (`02-commit-initial`, `03-commit-main`) per `ux-spec.md §1B:121`. Left `04-onboard-inventory.json`, `05-onboard-card.json`, and `05-card.md` untouched because downstream `s13` behavior disagrees with the specs in Items 1–3 below.
- **`s07` (`pkg/conformance/scenarios/s07-install-interrupted-part-way`):** Deferred as instructed pending `r19/cp-0010-gaps`.

## 1. Tenet's own `AGENTS.md` block is misclassified as `kind: "instructions"` (`s13`)

- **Spec (`tenet/specs/tech-spec/onboarding.md:25, 83`):** Line 25 defines instruction files as `AGENTS.md` **outside Tenet's block**; line 83 defines Tenet's markdown marker as `<!-- tenet:begin v<version> -->` … `<!-- tenet:end -->`.
- **Code (`src/onboard/inventory.ts:78-81`):** `kindFor()` strips `/<!-- tenet:begin -->[\s\S]*?<!-- tenet:end -->/g` without `v<version>`, so an `AGENTS.md` containing only Tenet's `<!-- tenet:begin v0.0.0 -->` block has leftover text and is classified as `kind: "instructions"` instead of `"config"`.
- **Effect on `s13`:** `04-onboard-inventory` emits `AGENTS.md` with `kind: "instructions"`, and `05-onboard-card` reports `"1 instruction file"` instead of `"0 instruction files"`.

## 2. Empty-repo `--yes` `tenet/intent.md` seed retains template checkout paths and example content (`s13`)

- **Spec (`tenet/specs/tech-spec/onboarding.md:95`, `tenet/specs/plan/alpha.0b.md:89`):** `init --yes` in an empty repository seeds `tenet/intent.md` with kind `other`, purpose `"Undecided · edit or run tenet onboard"`, and finding `no-test-report` only.
- **Code (`src/install/writes.ts:681-694`):** Replaces only `<owner>`, `<Project>`, and the `V-1` purpose sentence in `kit/templates/intent.md`, leaving `R-1`/`R-2` checkout payment requirements, `## Design` links to `src/checkout/gateway.ts` and `src/checkout/retry.ts`, and `Experience`/`Plan`/`Completeness checklist` sections intact.
- **Effect on `s13`:** `04-onboard-inventory` emits `dead-path` findings for `src/checkout/gateway.ts` and `src/checkout/retry.ts` (`lines: 56`), and `05-onboard-card` prints 7 sections (`7 minutes`) with `Requirements · 2 statements · 2 asked` instead of 2 sections (`2 minutes`) with `Requirements · 1 statement · 1 asked`.

## 3. Committed Tenet skill files under `.agents/skills/tenet-*/SKILL.md` generate false `dead-path` findings (`s13`)

- **Spec (`tenet/specs/tech-spec/onboarding.md:25, 29-33, 91, 95`, `tenet/specs/plan/alpha.0b.md:89`, `tenet/specs/ux-spec.md §1B:121`):** `init` installs `.agents/skills/tenet-*/SKILL.md`, UX §1B commits `init` files to `main` before running `onboard`, and `alpha.0b.md:89` specifies finding `no-test-report` only on an empty repository. `onboarding.md:11, 25` does not list `.agents/skills/tenet-*/SKILL.md` as skipped or as `config`/`instructions`.
- **Code (`src/onboard/inventory.ts:87`, `src/onboard/findings.ts:51`):** Every `.md` file not excluded by `earlySkip` or `kindFor` becomes `kind: "doc"`, and `deadPaths()` scans all `doc` files, emitting 10 false `dead-path` findings from Tenet's own skill templates (`.tenet/onboard/assignment.json`, `.tenet/onboard/interview.json`, `.tenet/onboard/inventory.json`, `CLAUDE.md`, `GEMINI.md`, `copilot-instructions.md`, `assignment.output.paths`, `assignment.project_kind`, `tenet/intent.md` when missing, `tenet.case`) and listing `.agents/skills/tenet-*.SKILL.md` in `card.ts`'s `Read:` line.

## 4. Note on `package.json` version mismatch (`0.1.0-alpha.0` on `main` vs `0.0.0` in scenario fixtures)

- Commit `40bf971` (PR `#8`) bumped `package.json` to `"0.1.0-alpha.0"` on `main`, while PR `#16` (`9f0b0a4`), `origin/r11/cp-0052-fixes` (`e0bdf54`), and all `expected/*.json` fixtures across `s01`–`s13` still expect `"version": "0.0.0"` (and `init`'s `local-integrity` message names `@vedprakash-m/tenet@0.0.0`). Running `origin/r11/cp-0052-fixes`'s `scenarios.test.ts` with `main`'s `package.json` therefore fails all 10 scenarios with JSON expectations solely on `version: '0.1.0-alpha.0' !== '0.0.0'`, whereas running with `r11/cp-0052-fixes`'s `package.json` (`0.0.0`) exercises all downstream steps cleanly.

## 5. Runner note: `scenarios.test.ts:461` (`r11/cp-0052-fixes`) does not substitute 7-char short SHAs in `expected.result.card`

- In `origin/r11/cp-0052-fixes:test/onboard/scenarios.test.ts:427-432`, `expectedCard` (`06-card.md` / `05-card.md`) is checked with `replaceRefs(expectedCard, short)` (substituting 7-char short SHAs like `175926e` / `cf8e94d`), which **passes** on `s11` and `s12`.
- At `test/onboard/scenarios.test.ts:461`, `assert.deepEqual(actual, replaceRefs(expected, refs))` passes `refs` (40-char SHAs only) without `short`, so `expected.result.card` inside `expected/06-onboard-card.json` still retains the golden 7-char prefix (`drafted from 175926e` in `s11`, `drafted from cf8e94d` in `s12`) and fails deep equality even when every other step and `06-card.md` pass.
