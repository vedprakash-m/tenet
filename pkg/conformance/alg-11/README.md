# `pkg/conformance/alg-11` — independent conformance cases for `ALG-11` and `CP-0048` (`tenet onboard`)

Written independently from `ALG-11` (`tenet/specs/tech-spec/algorithms.md:174–176`), `OB §1` (`tenet/specs/tech-spec/onboarding.md:9–45`), `contracts §4` (`tenet/specs/tech-spec/contracts.md:62–72`), `kit/schemas/{inventory,assignment}.json`, and the `CP-0048` build contract (`tenet/specs/plan/alpha.0b.md:49–63`).

## Running a case

Each case folder holds `input.json` and `expected.json`:

- `input.json.repo.files` is the committed repository snapshot at `repo.revision` (`HEAD`, or `null` when the repository has no commits yet); `input.json.repo.worktreeOnly` holds uncommitted or untracked working-tree files (such as a local test report or dirty source edits); `input.json.repo.committedDates` provides the last-commit date per documentation file.
- `input.json.options` carries the `onboard({inventoryOnly, refresh, layout})` arguments.
- `expected.json` projects the required fields of `{ok, exitCode, preflight, inventory, assignment, errors}`. As in the other independent conformance suites (`check`, `alg-10`, `board`), `{"$assert": "present"}` requires a non-empty value, `{"$assert": "contains", "value": [...]}` requires every projected entry to appear in the actual array, and `{"$assert": "size", "value": n}` requires the array length to equal `n`.

Fields whose exact formatting or enumeration is still open (such as `sources.skipped[].reason` labels, unit `id` / merge neighbor direction, and `findings[].message` strings) are left unconstrained in the projection and recorded in `tenet/packets/CP-0048-onboarding/escalations/proposals-r4.md`.

## Cases (8 positive, 5 negative)

| Case | Kind | Spec line exercised |
|---|---|---|
| [p01-small-one-file-service](p01-small-one-file-service/input.json) | positive | `ALG-11` (`algorithms.md:176`) `< 20,000` source lines and `< 4` CODEOWNERS areas selects `layout: "one-file"` with a single drafting unit and `output.paths: ["tenet/intent.md"]`; `OB §1` (`onboarding.md:30`, `35–38`) classifies a repository with a `Dockerfile` exposing a port as `project_kind: "service"` and populates `assignment.json` per `contracts §4` (`contracts.md:71`) |
| [p02-four-codeowners-areas-separate](p02-four-codeowners-areas-separate/input.json) | positive | `ALG-11` (`algorithms.md:176`) `≥ 4` CODEOWNERS areas selects `layout: "separate"` even when `size.source_lines < 20,000`, producing one drafting unit per CODEOWNERS area and the five separate output paths from `OB §1` (`onboarding.md:41–44`) |
| [p03-twenty-thousand-lines-separate](p03-twenty-thousand-lines-separate/input.json) | positive | `ALG-11` (`algorithms.md:175–176`) counts lines across tracked source extensions (`ts`, `py`) and selects `layout: "separate"` at `size.source_lines >= 20,000` with one unit per top-level source folder when no CODEOWNERS areas exist |
| [p04-merge-small-unit-into-neighbor](p04-merge-small-unit-into-neighbor/input.json) | positive | `ALG-11` (`algorithms.md:176`) merges any drafting unit under `2,000` source lines (`util/`, `600` lines) into its neighbor when `layout` is `"separate"` |
| [p05-layout-override](p05-layout-override/input.json) | positive | `ALG-11` (`algorithms.md:176`) and `CP-0048` (`alpha.0b.md:54`) `onboard --layout separate` overrides the size-calculated `"one-file"` layout and sets `assignment.output.paths` to the five separate specification paths (`onboarding.md:44`) |
| [p06-cli-kind-and-instruction-files](p06-cli-kind-and-instruction-files/input.json) | positive | `OB §1` (`onboarding.md:30–31`) detects `project_kind: "cli"` from a package `bin` entry and records `CLAUDE.md`, `.github/copilot-instructions.md`, `.windsurfrules`, and `AGENTS.md` (with content outside Tenet's marked block) in `sources.files` with `kind: "instructions"` |
| [p07-local-test-report-in-observations](p07-local-test-report-in-observations/input.json) | positive | `OB §1` (`onboarding.md:18`) and `contracts §4` (`contracts.md:69`) record a present local test report under `observations.reports` by its `sha256` digest and case count while keeping repository facts deterministic from `HEAD` |
| [p08-first-findings-all-four-kinds](p08-first-findings-all-four-kinds/input.json) | positive | `OB §1` (`onboarding.md:20–26`) and `contracts §4` (`contracts.md:69`) populate `findings[]` with all four first-finding kinds: `dead-path` (broken link in `docs/architecture.md`), `skipped-tests` (`test.skip(` via `ALG-09`), `owners-unmatched` (CODEOWNERS pattern matching no tracked file), and `no-test-report` |
| [n01-no-commits-refused](n01-no-commits-refused/input.json) | negative | `OB §1` (`onboarding.md:13`) and `CP-0048` (`alpha.0b.md:57`) refuse a repository with no commits (`HEAD` unborn) with `TN-ENV-NO-COMMIT` (exit code `3`, `messages.md:67`) |
| [n02-secrets-and-env-skipped](n02-secrets-and-env-skipped/input.json) | negative | `OB §1` (`onboarding.md:15`) never reads `.env*` or credential files (`*.pem`, `*.key`, `id_*`, `*credentials*`, `*secret*`); they are omitted from `sources.files` and listed in `sources.skipped` |
| [n03-generated-vendored-and-tests-excluded-from-size](n03-generated-vendored-and-tests-excluded-from-size/input.json) | negative | `ALG-11` (`algorithms.md:175`) excludes `vendor/`, `node_modules/`, `dist/`, `build/`, test files (`ALG-09` test globs), paths marked `linguist-generated` in `.gitattributes`, and files whose first 5 lines contain `Code generated` or `@generated` from `size.source_lines` |
| [n04-binary-oversize-and-onboard-exclude-skipped](n04-binary-oversize-and-onboard-exclude-skipped/input.json) | negative | `OB §1` (`onboarding.md:15`) skips binary files, files over 1 MB, and paths matching `onboard.exclude` in `tenet.yaml`, recording each in `sources.skipped` and excluding them from `sources.files` and `size.source_lines` |
| [n05-uncommitted-worktree-source-ignored](n05-uncommitted-worktree-source-ignored/input.json) | negative | `OB §1` (`onboarding.md:13`) reads tracked files from `HEAD` rather than the dirty working tree, so uncommitted working-tree edits and untracked source files neither enter `sources.files` nor flip `layout` |
