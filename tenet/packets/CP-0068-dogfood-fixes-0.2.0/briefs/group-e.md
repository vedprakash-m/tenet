# CP-0068 group E · briefs for every track

Read [common.md](common.md) first; its rules all apply. The acceptance items are AC-E1 to AC-E13 in [definition.md](../definition.md#e--round-1-items-deferred-for-012-l-0041-now-020). Each one names its round 1 entry (F-nn). F-nn IDs are the only link to the source project; never look for it.

## Who does what

| Track | Branch | Items |
|---|---|---|
| 1 · GPT | `cp-0068/e-cli` | AC-E1, AC-E2, AC-E3, AC-E10 |
| 2 · Gemini | `cp-0068/scenarios-s21-s23` | scenarios s21, s22, s23 |
| 3 · MAI | `cp-0068/e-onboarding` | AC-E4, AC-E5, AC-E12, AC-E13 |
| 4 · Flash | `cp-0068/e-checks` | AC-E6, AC-E7, AC-E8, AC-E9, AC-E11 |

Each builder opens one pull request, titled `CP-0068 E: <short summary>`. Gemini's is `CP-0068 scenarios s21 to s23`.

## Pinned values in independent cases

Some of these items change output that an independent case pins, such as the assignment in the ALG-11 fixtures, the installed skill's checksum in s13, or a card or plan snapshot. That's expected. Use the paired route that #74 and #75 used:
- don't edit `pkg/conformance/**`;
- list every case that fails, in a table in the pull request body: case and step, field, old value, new value;
- the pull request may fail CI on its own. Say so in the body. Track 2 writes the paired update, and the coordinator runs both together before merging.

If a pinned value disagrees with an acceptance item for any other reason, stop and report it.

`tenet/specs/tech-spec/contracts.md` is at 95% of its token budget. In it, add only code names to the existing tables, and put wording in `messages.md`. If `check` reports `TN-BUDGET` for it, stop and report; don't trim other text.

## Track 1 · GPT (`cp-0068/e-cli`)

- **AC-E1 · `init` checks the registry before *Continue?*.** Start at `src/install/preflight.ts`, `src/install/integrity.ts` and `src/commands/init.ts`. Today the lookup runs after the user confirms, and a failure there pastes npm's whole error into the message. Move the lookup into the preflight. When it fails, show it in the plan and offer *"Record local package integrity instead (same as `--offline`)? [y/N]"*. Give a one-line cause, and keep npm's full output for `--verbose`. Repro with a registry that doesn't answer; inject it, and never use the network in tests.
- **AC-E2 · `remove` plan and confirmation (proposal).** Start at `src/commands/remove.ts` and `src/install/remove.ts`. Reuse `init`'s plan style and its no-terminal handling (see `TN-INIT-NO-TTY`). Add a code for `remove` without a terminal, in contracts §13's exit table and in `messages.md`. Every caller that runs `remove` without a terminal must pass `--yes`, including tests, scenarios and docs. Change only the callers this repository owns, and list each one in the body.
- **AC-E3 · fast `--version` and `--help`.** Start at `src/cli.ts`, which loads `./commands/index.js`. Keep the command list and help text in a small module that loads no command code. Test it by checking which modules load, never by timing. Make every help description one sentence, starting with a capital letter and with no final period.
- **AC-E10 · `fix` output and style.** Start at `src/specs/fix.ts`, `src/specs/front-matter.ts` and `src/commands/fix.ts`. `--dry-run` gives one summary line for each change in each file. Add `--diff`. Human output is text. Keep flow or block front matter as written. Change only the fields `fix` must change.

## Track 3 · MAI (`cp-0068/e-onboarding`)

- **AC-E4 · documentation counts toward the layout (proposal).** The rule is in `src/onboard/inventory.ts`, where `size` and `layout` are worked out. Add documentation tokens to `size` (a new field, in contracts §4 and `kit/schemas/inventory.json`), and use the 12,000-token rule from the definition. Print the one-line reason in `onboard`'s human output.
- **AC-E5 · a `docs` unit in `separate`.** In `draftingUnits` (`src/onboard/inventory.ts`), documentation outside every code unit goes in a unit with `id: "docs"`, whose `paths` are those files' top folders. The small-unit merge must never fold `docs` into a code unit. Print each unit with its paths.
- **AC-E12 · the card's section list.** Start at `src/onboard/card.ts`. Group sections under their file's name. Show the preamble as *intro*, and a checklist as *checklist (<n> items)*. Leave both out of the unlabelled count and the review time. Show a table with no IDs as *table, no requirements*.
- **AC-E13 · the card's source line.** In `src/onboard/card.ts` (`read:`), rename `Read:` to `Available to the drafter:`. Give each skip reason its count. Add `Cited:` with the number of distinct files the draft's citations name.

## Track 4 · Flash (`cp-0068/e-checks`)

Work through these one at a time, in this order. For each one, first write a failing test with a synthetic input, then fix the code, then run `npm test`.

1. **AC-E8 · metadata keys only in the trailing block.**
   - The code is `src/specs/parse.ts`, about lines 190 to 220. The regular expression `(origin|cites|serves|scope|adopted_by)\s*:` is tested on text **outside** the trailing `{…}` block. That's the bug.
   - Test input: `- R-1 Out of scope: X. {origin: asked; serves: V-P1}` must give no `TN-SPEC-REQ-META`.
   - Keep the check for real errors inside the block. Its message must name the token that's wrong. Change the message in `src/core/messages.ts` and in `tenet/specs/tech-spec/messages.md`.
2. **AC-E9 · checklists aren't requirements.**
   - Find where `TN-SPEC-MISSING-ID` is raised (`src/specs/check.ts`), and where `fix` adds IDs (`src/specs/fix.ts`).
   - Lines that start with `- [ ]` or `- [x]` under a heading named `Completeness checklist` are not statements.
   - Test: for each file in `kit/templates/` that is a specification template, fill in its placeholders with plain text, run `check`, and expect no `TN-SPEC-MISSING-ID`. Then run `fix`, and expect no IDs on checklist lines.
3. **AC-E11 · inferred statements warn (proposal).**
   - Add a warning code, `TN-SPEC-INFERRED`. Message: `{n} inferred statement(s) need review before blessing: {ids}.` Fix: `Review {ids}, then change their origin or keep them labelled inferred.`
   - One finding per file, with severity warning. Add it to `src/core/messages.ts`, `tenet/specs/tech-spec/messages.md` and the warning row of contracts §13.
   - In `docs/concepts.md`, add one sentence: a citation check confirms that the cited lines exist, not that they support the statement.
4. **AC-E6 · kit files cite shipped files only.**
   - `kit/agents/drafter.md` line 67 names `contracts.md §3` and `onboarding.md §1`, which don't ship. Point it at `kit/templates/` instead.
   - Add a test that reads every file under `kit/` and fails if any names a file under `tenet/specs/`, or `contracts.md`, `onboarding.md`, `algorithms.md` or `agents.md`.
5. **AC-E7 · the skill doesn't commit unless asked.**
   - `kit/skills/draft-specs/SKILL.md` step 6 says to commit, run the card and open the pull request.
   - Change it: tell the user the draft is ready, and give the next commands as the README's quick start gives them. The agent commits or opens a pull request only if the user asked it to.
   - This changes the installed skill's SHA-256, which s13 pins. Put the paired table in the pull request body, with the new SHA-256.
   - The skill must stay under its 2,000-token budget (`test/kit/kit.test.ts`).

When you are done, run `npm run lint`, `npm test` and `node dist/cli.js check`.

## Track 2 · Gemini (`cp-0068/scenarios-s21-s23`)

Write from [definition.md](../definition.md) alone; don't read the builders' branches. Follow the layout of `pkg/conformance/scenarios/s20-first-setup-protected-files`, and add rows to `INDEPENDENT.md`.

- **s21-docs-heavy-layout (AC-E4, AC-E5):** a synthetic repository with under 500 lines of code in one folder and Markdown documentation of more than 48,000 characters in a top-level folder. Expect:
  - `onboard --inventory-only` chooses `separate`, and the human output gives the reason;
  - the assignment has a unit with `id: "docs"` that covers that folder;
  - with `--layout one-file`, the layout is one-file.
- **s22-spec-check-false-alarms (AC-E8, AC-E9, AC-E11):** a valid draft with these three things:
  - a requirement whose text contains `Out of scope:` before its `{…}` block;
  - a filled-in completeness checklist under its heading;
  - one `origin: inferred` statement.

  Expect `check` to give no `TN-SPEC-REQ-META` and no `TN-SPEC-MISSING-ID`, and exactly one warning for the inferred statement, naming its ID. Assert only what the definition fixes; the warning's code and wording are a proposal.
- **s23-remove-plan (AC-E2):** after `init --yes`, expect:
  - `remove` without a terminal and without `--yes` fails, and its message names `remove`;
  - nothing is deleted;
  - `remove --yes` removes the setup and reports what it kept.

Mark the three scenarios pending as the README describes, because they fail until the builders' pull requests merge. Your pull request may be red on its own; say so in its body.
