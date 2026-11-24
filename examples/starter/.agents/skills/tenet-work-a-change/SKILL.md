---
name: work-a-change
description: Implement a code or spec change using Tenet blessed context, pull-request acceptance items, tagged tests, and local verification.
---
# Work a Change (`work-a-change`)

Follow these steps in order for every change:

1. **Get blessed context.**
   Before changing code, call the MCP tool `tenet_context` (or run `tenet context --paths <paths>`) for the paths you will touch. Read every blessed requirement it returns, including `scope: global` rules. If `omitted` lists any IDs, fetch them by ID. If a requirement is flagged `edited` or `sources-changed`, follow its **blessed text** and note the dependency in your pull request. Draft sections are hints only.

2. **Prepare the pull request.**
   If the host can open a draft pull request early, open it now; otherwise write the pull request description when ready.

3. **Write `## Acceptance`.**
   Add an `## Acceptance` block naming `Implements: <ID>, ...` (any blessed requirement IDs this change addresses) and one line per testable item, numbered from 1 in this pull request:
   - `- [AB-1] <what must hold>`
   - `- [AB-2] <what must hold>`

4. **Implement and write tagged tests.**
   Write the code and add tests tagged with `[AB-1]` (or `tenet_AB_1` / `tenet.case` per `AGENTS.md`). A test that should continue proving a requirement across future changes also carries `[<prefix>-<n>]`. Never delete, skip, or weaken an existing test to make checks pass; if an existing test is wrong, explain why in the pull request.

5. **Run checks locally.**
   Run every check configured in `tenet.yaml` locally and run `tenet check`.

6. **Propose spec fixes alongside code.**
   Where code shows a specification is wrong or incomplete, edit the specification file in the same pull request and explain why (never touch `{records}/blessed/` or blessing front-matter fields).

7. **Follow the stop rules.**
   Stop and ask your question in the pull request if a requirement conflicts with the task, the same check fails three times, or passing requires changing an existing test, acceptance item, or specification.
