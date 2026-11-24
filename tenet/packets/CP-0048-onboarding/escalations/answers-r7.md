# CP-0048 · Answers to the round 7 specification questions

Answers to [pending-r7.md](pending-r7.md), decided on 2026-11-23 to finalize `CP-0048`.

1. **Working inputs and deterministic findings (`contracts.md:76, 128`, `onboarding.md:14, 27`, `alpha.0b.md:58`).**
   - `inventory.json` (except `observations.reports`) and `assignment.json` are a deterministic function of `(HEAD tree, working-tree tenet.yaml)`, and the full `onboard` output is deterministic over `(HEAD tree, working-tree tenet.yaml, .tenet/reports/* working-tree bytes)`.
   - Local report contents live only in `observations.reports` (named by `sha256` digest), while report availability (`observations.reports.length > 0`) suppresses the `no-test-report` entry in `findings[]` (matching `p07`).
   - Any file under `.tenet/reports/` that is tracked in `HEAD` remains in `sources.files` (`kind: "config"`), never in `observations.reports` from `HEAD` alone; `observations.reports` reads only readable working-tree files in `.tenet/reports/` and configured `checks[].report_path` locations on disk.
   - **Spec edits:** `tenet/specs/tech-spec/onboarding.md` §1 (`lines 14, 27`), `tenet/specs/tech-spec/contracts.md` §4 (`line 76`) and §8 (`line 128`, fixing `onboard`'s return fields to `{preflight, inventory, findings, assignment}`), and `tenet/specs/plan/alpha.0b.md` (`CP-0048` *Behavior*, `line 58`).

2. **Refresh scope and draft anchors (`onboarding.md:35, 48, 68–71`, `alpha.0b.md:59`).**
   - `--refresh` inspects `tenet/intent.md` or configured `policy.specs.documents` under `<records>/` (the specification outputs) for front-matter `tenet.drafted_at_rev` commit OIDs.
   - If no document has a valid `drafted_at_rev`, all current `inventory.units` are assigned.
   - If any `drafted_at_rev` is present:
     - Each anchor commit must exist (`git cat-file -e <rev>^{commit}`); an unreachable anchor (e.g., shallow clone lacking history) surfaces an error rather than silently substituting `HEAD` and returning an empty assignment.
     - Compute the union of `git diff --name-only --no-renames <rev> <HEAD>` across those anchors, excluding specification outputs, `.tenet/*`, and `sources.skipped` paths (including deleted files `--diff-filter=D` as well as present `sources.files`).
     - A drafting unit is kept iff any file in the changed set falls under `within(root, file)` (`root === "." || root === file || file.startsWith(root + "/")`) for any `root` in `unit.paths`, **or** the changed set contains a shared/root file outside all units' `paths` (which marks all units for refresh). Overlapping unit paths assign every matching unit; deleted areas are already absent from `inventory.units`.
   - **Spec edits:** `tenet/specs/tech-spec/onboarding.md` §1 (`line 71`) and `tenet/specs/plan/alpha.0b.md` (`CP-0048` *Behavior*, `line 59`).

3. **Check integration on refresh (`alpha.0b.md:53, 59`).**
   - During `--refresh`, `deps.check({ cwd })` runs against the repository root before writing `.tenet/onboard/{inventory,assignment}.json`.
   - Structural/citation diagnostics returned in `check`'s `{findings, summary}` flow through the CLI envelope (`errors` in `--json`; human diagnostics on stderr) and do **not** enter `inventory.findings` or block updating `.tenet/onboard/inventory.json` and `.tenet/onboard/assignment.json` (which are advisory git-ignored inputs so the agent can fix those drafts). Only fatal errors (missing git repo, no commit, invalid `tenet.yaml`, or unreachable `drafted_at_rev`) abort before writing.
   - Wiring `check` from `src/specs/check.ts` into `src/commands/onboard.ts` (`makeOnboardCommand({ check })`) tracks as a follow-up integration task now that `CP-0009` has landed on `main`.
   - **Spec edits:** `tenet/specs/plan/alpha.0b.md` (`CP-0048` *Behavior*, `line 59`).

4. **Classification and extraction tie-breakers (`onboarding.md:15–25, 29–33`, `algorithms.md:176`).**
   - **Languages (`sources` / `modules`):** `ts, tsx → typescript`; `js, jsx, mjs, cjs → javascript`; `py → python`; `go → go`; `rs → rust`; `java → java`; `kt → kotlin`; `cs → csharp`; `rb → ruby`; `php → php`; `swift → swift`; `c, h → c`; `cc, cpp, hpp → cpp`; `scala → scala`.
   - **Manifests (`kind: "manifest"`):** `package.json`, `pyproject.toml`, `setup.py`, `setup.cfg`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`, `build.gradle.kts`, `Gemfile`, `composer.json`, `Package.swift`.
   - **Runners (`inventory.tests[].runner`):** `.py → pytest`; `.go → go`; `.java → junit`; `.rs → cargo`; JS/TS checks imports (`node:test`, `vitest`, `@jest/globals`), then `vitest.config.*` / `jest.config.*`, defaulting to `node:test`.
   - **Project-kind precedence:** `cli` (`package.json` `bin` or `cmd/` folder) > `service` (server dependency, `Dockerfile*` with `EXPOSE`, or non-Node manifest server framework) > `library` (non-private `package.json` with name+version, or `[project]`/`[package]` in `pyproject.toml`/`Cargo.toml`) > `data` (`dbt_project.yml`, `*.ipynb`, `dags/`) > `infrastructure` (`*.tf`, `Chart.yaml`, K8s YAML `apiVersion:` + `kind:`) > `application`.
   - **Doc heading & date fallbacks:** `title` falls back to `basename(path)` when no `# ` heading exists; `last_changed` falls back to `revision` when `lastChangedMap` has no commit date.
   - **CODEOWNERS wildcards & `dead-path` resolution:** leading `/` anchors to root, trailing `/` matches subtrees (`**`), bare names match `**/<pattern>`; `dead-path` resolves `/…` from repo root, `./…` or `../…` only relative to `doc.path`, and bare paths relative to `doc.path` first then repo root.
   - **Spec edits:** `tenet/specs/tech-spec/onboarding.md` §1 (`lines 15–33`).

5. **Test declaration representation (`onboarding.md:23`, `contracts.md:76`).**
   - `inventory.tests[]` keeps `{path, runner, cases}` where `cases` is the count of `ALG-09` declarations from `scanTests` (matching `kit/schemas/inventory.json`), and `scanTests` skip matches feed `findings[]` (`skipped-tests`). Declaration names stay out of `inventory.json` v1 and are read from test files by agents during drafting.
   - **Spec edits:** `tenet/specs/tech-spec/onboarding.md` §1 (`line 23`).

6. **Preflight and managed output paths (`onboarding.md:9–14`, `alpha.0b.md:55`).**
   - Pin `onboard`'s CLI preflight transcript (matching `src/commands/onboard.ts:50–57`): `Will read: …`, `Will skip: …`, `Drafting sends project content to your agent and its model provider.`, `Read <read_count> files at <revision> and skipped <skipped_count>.`, optional `Working tree has uncommitted changes.` when `dirty_warning: true`, optional `First findings: …`, and `Drafting assignment: .tenet/onboard/assignment.json`.
   - Keeping `.tenet/onboard/` untracked is owned by `init`'s `.gitignore` block (`onboarding.md §2`); `onboard` writes `.tenet/onboard/{inventory,assignment}.json` atomically without rejecting repos where `.gitignore` has not yet been updated.
   - **Spec edits:** `tenet/specs/tech-spec/onboarding.md` §1 (`lines 9–14`).
