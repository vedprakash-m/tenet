# Answers — CP-0010 round 19

Ruling on local generated working state under `.tenet/` during `tenet remove` (`ALG-12`, `onboarding.md §2` [where `ALG-12` sits; previously §4], `contracts.md §§1, 8`, `ux-spec.md` Part 4 & UX-5, PR #17).

## Decision: Delete Tenet's local generated working state under `.tenet/`, never anything a user wrote

`tenet remove` removes the `.gitignore` block that ignores `.tenet/*`. Leaving Tenet's own generated runtime files behind turns previously ignored Tenet state into newly untracked files in `git status`, violating UX-5 ("No surprises in the repository"). `tenet remove` therefore deletes Tenet's known local generated working state under `.tenet/` (when present), while strictly preserving any user-authored files, specifications, and records.

### Exact paths deleted (with path confinement / `TN-PATH-ESCAPE`)

In addition to `manifest.created`, `manifest.blocks`, `manifest.keys`, `manifest.local.json`, and `.tenet/manifest.{json,pending.json}`:

1. **Onboarding generated outputs:** `.tenet/onboard/inventory.json` and `.tenet/onboard/assignment.json` (deterministic derived outputs of `HEAD` and `tenet.yaml`).
   - **Never delete** `.tenet/onboard/interview.json` (holds Owner interview answers written via the agent).
2. **Generated caches and runner worktrees/state:** `.tenet/cache/**` and `.tenet/runs/**` (regular files, directories, and internal runner artifacts; verify confinement with `lstat` so symlinks/junctions are unlinked rather than traversed).
3. **Generated test reports under `.tenet/reports/`:**
   - Any regular file matching `checks[].report_path` read from `tenet.yaml` **before** `tenet.yaml` is deleted, when confined inside `.tenet/reports/`, plus Tenet's standard runner report filenames under `.tenet/reports/` (`test.xml`, `test.json`, `junit.xml`, `ctrf.json`, `go-test.json`, `go-test-json.json`, `jest.json`, `jest-json.json`).
   - Leave any other file under `.tenet/reports/` (or `.tenet/` generally) untouched so custom user files are never deleted.

### Reporting and cleanup guarantees

- Every deleted generated working-state file under `.tenet/` is included in `result.removed` as `{ path, kind: "file" }` (sorted, deduplicated with `manifest.created`), keeping `contracts.md §8` and `kit/schemas/results/remove.json` valid with no schema change.
- `.tenet/onboard`, `.tenet/reports`, `.tenet/cache`, `.tenet/runs`, and `.tenet` are removed **only when empty** (`rmdir`, never recursive `rm -rf` of `.tenet`).
- Specifications (`tenet/intent.md`, `specs.documents`), records (`<records>/blessed/`, `tenet/ledger/`, `tenet/holdout/`), edited config/key files (`reason: "edited-by-you"`), `.tenet/onboard/interview.json`, and any custom user file under `.tenet/` are never modified or deleted.
- Note for `s11` (`pkg/conformance/scenarios/s11-readme-walkthrough/expected/08-remove.json`): once `src/install/remove.ts` implements this ruling, add `.tenet/onboard/assignment.json` and `.tenet/onboard/inventory.json` to `08-remove.json`'s `removed` array.
