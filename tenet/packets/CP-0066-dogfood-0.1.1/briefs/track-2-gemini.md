# Track 2 · Gemini · Scenarios s14 and s15, then group C: the test check

Read [common.md](common.md) first. Worktree `Q:\Ved\Pers\tenet-track2`.

## Part 1 · Independent scenarios (first, about an hour)

You are the independent writer for groups A and B. Write from [definition.md](../definition.md) alone; don't read track 1's or track 3's branches. Branch `cp-0066/scenarios-s14-s15`, one pull request `CP-0066 scenarios s14 s15`.

Follow the layout of `pkg/conformance/scenarios/s13-ux-walkthrough-new` (`before/`, `expected/`, `steps.json`) and the [scenarios README](../../../../pkg/conformance/scenarios/README.md). Add rows to [INDEPENDENT.md](../../../../pkg/conformance/INDEPENDENT.md).

- **s14-bless-decide-later-and-questions** (AB-A1–A3, A7). A draft with a vision of 3 sections without open items, and a PRD where:
  - one section has `CF-1`;
  - one section has `CF-2`;
  - one section has `Q-1`.

  Scripted answers: settle CF-1, "Decide later" on CF-2, answer Q-1, bless what's offered. Expect:
  - the vision's sections and the CF-1 and Q-1 sections blessed;
  - the CF-2 section unblessed;
  - Q-1's answer recorded;
  - the closing line "Blessed N of M sections".

  Then a second case where everything is deferred: expect "Blessed 0 of M" and "Nothing is in force yet". For AB-A7: bless only the vision, and expect one grouped warning, not one error per item, at level `observe`.
- **s15-context-paths-ranking** (AB-B1–B3). Blessed sections:
  - one with `applies_to: ["app/**", "pyproject.toml"]` holding `R-7`;
  - one with `applies_to: ["**"]` holding 40 statements;
  - one global rule.

  `context --paths app/core/x.py` must return the `app/**` section with R-7's text, ranked above the `"**"` section, with the large section indexed or summarized within the budget. Also cover `--paths a,b` and a repeated `--paths`, and `--include-drafts --ids R-9` returning a draft statement, marked as a draft.

Where the definition leaves a rendering open, assert only what it fixes. Mark the cases pending the way the README describes, because they will fail until groups A and B merge.

## Part 2 · Group C (branch `cp-0066/c-test-check`)

### Specifications to read

- `tenet/specs/tech-spec/onboarding.md` §2 (install and upgrade).
- `tenet/specs/tech-spec/ci.md`, the test job, the bundle and the card.
- `tenet/specs/prd/tooling.md` R-080 (network use; `verify --local` must make no network call).
- `tenet/specs/ux-spec.md`, init and the proof card.
- `kit/skills/review-with-findings/SKILL.md` and `kit/skills/work-a-change/SKILL.md`.

### Code to start from

`src/install/preflight.ts` (runner detection and the `npm test` fallback), `src/install/writes.ts` and `kit/defaults/tenet.yaml` (generated config and workflows), `src/commands/verify.ts`, `src/verify/run-checks.ts`, `src/verify/bundle.ts`, `src/verify/card.ts`.

### What was observed (synthetic)

1. **AB-C1 (F-11, F-41):** in a repository with Markdown and a few Python files and no `package.json`, init says "no test runner", then writes `checks.test.run: npm test` with `report: none`, and a workflow that runs it on every pull request. The docs never mention `report`, `report_from`, `report_path` or the formats (`junit`, `ctrf`, `go-test-json`, `jest-json`, `none`). The pytest preset is visible only in code.
2. **AB-C2 (F-54):** the work-a-change skill says to run every configured check locally, but `tenet verify --run-checks` exits 2 without a CI event file. There is no way to see a proof card without GitHub Actions. Add `verify --local`:
   - it runs the checks on the working tree;
   - it takes the base from the merge base with the default branch;
   - it builds the bundle and renders the card, labelled as a local preview;
   - it makes no network call.

   Propose the flag in `docs/commands.md`, `contracts.md` and the UX spec in the same pull request.
3. **AB-C3 (F-55):** `verify` loads checks from the base, so the pull request that fixes a wrong test command can't prove its own tests (exit 127). That's safe, but say so on the card, and in getting started.
4. **AB-C4 (F-36, F-42):** `tenet-tests.yml` triggers on `push` to `setup/tenet` and on `pull_request`, so each pull request gets two identical checks, and the setup branch name stays in a lasting workflow. Use `pull_request` plus `push` to the default branch; make `upgrade` rewrite existing generated workflows.
5. **AB-C5 (F-58):** the review skill starts "Read the proof card first", with no step for when there is none.

### Notes

Coordinate by reading only `origin/main`. Track 4 also edits init output text (F-10, F-06, F-07) in `src/install/`; rebase on `main` before pushing, and keep your changes to runner detection, config and workflows.
