# Track 1 · GPT · Group A: blessing can be finished

Read [common.md](common.md) first. Worktree `Q:\Ved\Pers\tenet-track1`, branch `cp-0066/a-bless`.

## Specifications to read

- `tenet/specs/tech-spec/algorithms.md`, the bless session actions (around line 43) and ALG-03 (anchors, citations).
- `tenet/specs/tech-spec/onboarding.md` §1 (onboarding and blessing, R-223).
- `tenet/specs/ux-spec.md`, the bless session and onboarding card sections, and §8 (plain words).
- `tenet/specs/tech-spec/contracts.md`, the blessing log and board JSON shapes.

## Code to start from

`src/onboard/bless.ts`, `src/commands/bless.ts`, `src/onboard/card.ts`, `src/specs/check.ts` (budgets and `TN-SPEC-UNCOVERED-VISION`), `src/views/specs-board.ts`, `src/commands/board.ts`, `src/core/messages.ts`.

## What was observed (synthetic)

Build a fixture repository with a separate layout: a vision with about 9 sections and no open items, a PRD with three conflicts (`CF-1`, `CF-2`, `CF-3`) in three different sections, and seven sections that each have one open question (`- [ ] Q-n (section: <slug>) …`).

1. **AB-A1 (F-43):** settle CF-1, choose "Decide later" on CF-3. Today the session ends with `TN-BLESS-OPEN-CONFLICT`, nothing is blessed, CF-2 is never asked, and no vision section is reached.
2. **AB-A2 (F-44):** open questions block their section, but `bless` never asks them and nothing says how to resolve one.
3. **AB-A3 (F-46):** a session that blessed nothing ends with three ordinary lines and no count; the Owner read it as finished. Twice.
4. **AB-A4 (F-45):** with one owner listed, Enter on "Who is blessing?" gives "Choose one of the listed options". The contradiction prompt asks for a statement ID from memory.
5. **AB-A5 (F-48):** `tenet/blessed/log.jsonl` `minutes` rise by 3–4 s per section: it's the time since the session began.
6. **AB-A6 (F-49):** after blessing, `check` warns that the vision is at 5,040 of 4,000 tokens; the body is about 2,600. The rest is anchors and blessing fields in front matter.
7. **AB-A7 (F-50):** blessing only the vision gives 34 `TN-SPEC-UNCOVERED-VISION` errors and `check` exit 1 at level `observe`.
8. **AB-A8 (F-30):** the onboarding card lists conflicts but not the 8 open questions.
9. **AB-A9 (F-29, F-34):** `onboard --card` adds `drafted_at_rev` to all five specs without saying so, then ends with `→ gh pr checkout <n>, then tenet bless` when no pull request exists.
10. **AB-A10 (F-32):** the card says "all 234 citations checked against the code" when they cite Markdown and the check is existence and line range only.
11. **AB-A11 (F-37):** plain-text `board` lists "Completeness checklist" five times with no file names and shows no conflicts or questions, though `board --json` has them. Its JSON `read.main` holds the current branch's head, not the default branch.

## Notes

- Keep each change the smallest that meets its AB item. If the contract fixes a JSON field name (`read.main`), keep it and fix its value, or add a field; don't rename.
- AB-A7 changes a finding's severity: check the spec for the rule and propose the change in the same pull request.
- Existing independent cases under `pkg/conformance/` (board, card, check, scenarios) may expect today's output. If one blocks an AB item, stop and report which.

## After group A: write scenario s16

Once your pull request is open and green, write the independent scenario `pkg/conformance/scenarios/s16-verify-local-preview` for AB-C1–C3 from [definition.md](../definition.md) alone, without reading track 2's branch. Follow the layout of `s13-ux-walkthrough-new` (`before/`, `expected/`, `steps.json`) and the [scenarios README](../../../../pkg/conformance/scenarios/README.md), and add its row to [INDEPENDENT.md](../../../../pkg/conformance/INDEPENDENT.md). Cover:
- init with no runner and `--yes` writes no test check;
- `verify --local` prints a card marked as a local preview with a tagged test passing;
- a head that changes the test command gets the "takes effect after merge" note.

Where a rendering is undecided, write the expected projection only for what the definition fixes. Open it as its own pull request, `CP-0066 scenario s16`. It is expected to fail until group C merges; mark it the way the README says pending cases are marked.
