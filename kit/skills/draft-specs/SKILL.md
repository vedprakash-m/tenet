---
name: tenet-draft-specs
description: Draft grounded project specifications from the repository inventory and Owner interview answers during onboarding, without blessing or resolving conflicts.
---
# Draft Specifications (`tenet-draft-specs`)

Follow these steps in order when onboarding a repository to Tenet:

1. **Build the inventory and assignment.**
   Run `tenet onboard` and read `.tenet/onboard/assignment.json`.

2. **Interview the Owner.**
   Ask at most `assignment.question_limit` questions in total. Take them from `assignment.questions.project_kind` first, then fill the remaining count from `assignment.questions.generic`. Never repeat a question. Record every answer in `.tenet/onboard/interview.json` under `{questions: [{id, text, answer, answered_at}]}` with UTC timestamps.

3. **Draft each unit in order.**
   For each drafting unit in `.tenet/onboard/assignment.json`, in order (or, in an empty repository with no source files or docs, draft purely from `asked` interview answers and `"undecided, needs the Owner"` without inventing `observed` or `documented` statements):
   - Read its slice of `.tenet/onboard/inventory.json` and the files it names.
   - Draft its specification sections into `assignment.output.paths` (`tenet/intent.md` for `one-file`, or separate view files under `tenet/` for `separate`); write nowhere else.
   - Cite every `observed` or `documented` statement (`path:start-end`, `test: <file> > <name>`, or `doc: <path>#<slug>`).
   - Mark cross-cutting never-dos `scope: global`.
   - Give prose sections `applies_to` path globs.
   - List disagreements between sources as open `- [ ] CF-<n> (section: <slug>) ...` items under `## Conflicts`; never choose a side.
   - Write `undecided, needs the Owner` where nothing in code, docs, or answers tells you.
   - From existing instruction files (inventory kind `instructions`, such as `copilot-instructions.md`, `CLAUDE.md`, `GEMINI.md`, or editor rules): turn project rules into requirements (`origin: documented`, `scope: global`, citing the file) and working rules into a `## Working rules` design section, without copying anything that is a secret or a personal detail.

4. **Normalize IDs and verify citations.**
   Don't write YAML front matter by hand. Run `tenet fix` to add it, then run `tenet check` and fix every citation finding until checks pass on the draft.

5. **Run a self-check pass.**
   Review each drafted statement against its citation. List any statement whose citation does not support it, then either correct the statement/citation or mark it `origin: inferred`. Label this pass in the pull request as a **self-check** (an independent review requires a separate `spec-reviewer` assignment).

6. **Commit and render the onboarding card.**
   Commit the drafted specifications (never commit `.tenet/onboard/`), run `tenet onboard --card` (which records `drafted_at_rev`), and open one pull request named **"Set up Tenet"** with the generated card as its description.

**Rules:**
- Never bless a section or edit blessing front-matter fields or `{records}/blessed/`.
- Never resolve a `CF-` conflict.
- Never copy secrets, credentials, or personal details into specifications.
