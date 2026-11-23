# CP-0058 Proposals for Files Owned Outside Track 2

> Created by the M0 Track-2 QA & content run (`m0/track-2-trial-kit`). All files below are outside Track 2's write boundary (`NEVER TOUCH`), so needed updates are recorded here as numbered proposals.

## Proposal 1 · `tenet/specs/tech-spec.md` §10 (`--json` finding shape)
- **Where:** `tenet/specs/tech-spec.md:237` (`--json carries {file, line, rule, message, fix}`)
- **Why:** `contracts.md §8` (and `CP-0009`) standardize every finding on a 7-field shape `{code, severity, rule, file, line, message, fix}` (with `rule`, `file`, `line` nullable) across CLI `--json` `errors[]`, `tenet check --json` `result.findings[]`, and MCP `tenet_check`.
- **Proposed change:** Update `tenet/specs/tech-spec.md:237` to read:
  `` `--json` carries `errors: [{code, severity, rule, file, line, message, fix}]` (`check` returns `result: {findings, summary}`). ``

## Proposal 2 · `tenet/specs/tech-spec.md` §2 (kit folder layout missing `practices/`)
- **Where:** `tenet/specs/tech-spec.md:44` (`kit/ SHIPPED AND VENDORED: ...`)
- **Why:** `L-0028` (`R-225`) and `CP-0012` added `kit/practices/default.md`, which is installed into `AGENTS.md` by `init`.
- **Proposed change:** Add `practices/` to the `kit/` directory list on `tenet/specs/tech-spec.md:44`.

## Proposal 3 · `tenet/specs/tech-spec.md` §15 (`npm run check:examples`)
- **Where:** `tenet/specs/tech-spec.md:279`
- **Why:** Minor wording/sync check so `npm run check:examples` (`CP-0003`) is listed alongside unit/property/red-team tests.
- **Proposed change:** Mention `npm run check:examples` in the testing summary (non-normative clarification).

## Proposal 4 · `tenet/specs/plan.md` §1 checklist item #5 & §3 `CP-0058` Done-when
- **Where:** `tenet/specs/plan.md:59` and `plan.md:146`
- **Why:** Checklist item #5 names `CP-0018` and five `CP-0044` pure functions, whereas the full trial also exercised `anchorsFor`, `relocate`, `matchRenamed`, and `touched` (plus `git` report functions); `CP-0058` "Done when" mentions putting the scorer's log in `tenet/ledger/` while packet workflow keeps evidence in `tenet/packets/CP-0058-medium-model-trial/evidence/scorer-log.md`.
- **Proposed change:** Once `CP-0058` completes, add the summary ledger entry referencing `tenet/packets/CP-0058-medium-model-trial/evidence/scorer-log.md` and note all tested `CP-0018` + `CP-0044` exports.
