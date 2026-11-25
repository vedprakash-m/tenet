# Pending round 22 — Scenario goldens s07 and s13 resolved

Checked and proven against GPT's updated runner (`cbcd688`, with `isolateScenarioGit` and `assertGolden` `{{any:string}}` scalar support) in a scratch worktree: **all 13 scenarios pass** (`Scenario golden placeholder uses: 6`).

- **`s07` (`pkg/conformance/scenarios/s07-install-interrupted-part-way`):**
  - `expected/02-init-resume.json`: matches `kit/schemas/results/init.json`, `contracts.md §8`, `onboarding.md §2` (`ALG-12`), and `answers-r20.md`.
  - `expected/03-doctor.json`: matches `contracts.md §8` (`kit/schemas/results/doctor.json`); marks only host tool versions inside `detail` (`node`, `git`, `ssh`, `gh` — 4 placeholders) as `{{any:string}}` and keeps `lock` (`"tenet.lock and kit match"`) and `workflows` (`"No workflows configured (ci_mode none)"`) exact.
  - `expected/04-remove.json`: updated to `kit/schemas/results/remove.json` / `contracts.md §8` (`removed: [{path, kind}]`, `kept: []`, `reminder`) matching `init --yes`'s installed files for `s07` (non-GitHub remote, no `.mcp.json`).
- **`s13` (`pkg/conformance/scenarios/s13-ux-walkthrough-new`):**
  - `expected/04-onboard-inventory.json`: matches `onboarding.md §1` and PR #23 (`read_count: 11`, all 10 installed/config files `kind: "config"`, `tenet/intent.md` `kind: "doc"` 56 lines, `title: "repo intent"`, 8 `sections` slugs). Marks only `tenet.lock` and `.tenet/manifest.json` `sha256` (2 placeholders derived from `localIntegrity`/package) as `{{any:string}}`; keeps `tenet.yaml`, `tenet/intent.md`, `AGENTS.md`, skills, and dotfiles exact under `Scenario Owner`.
  - `expected/05-onboard-card.json` and `expected/05-card.md`: updated to the eight-section `kit/templates/intent.md` seed (`Sections (about 7 minutes)`, `_preamble` through `Completeness checklist`).
- **Remaining code note outside scenarios:** In `fcab5f7`, `src/install/integrity.ts` still skipped registry lookup for `version.includes("-")` (fixed in local commit `3907915`); both give `local-integrity` for unpublished `0.1.0-alpha.0`.
