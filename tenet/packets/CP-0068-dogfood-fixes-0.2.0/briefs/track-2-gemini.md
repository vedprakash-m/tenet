# Track 2 · Gemini · Independent scenarios s17 to s20, then the OD-3 fixture refresh

Read [common.md](common.md) first. Worktree: `Q:\Ved\Pers\tenet-track2`.

You are the **independent writer** for groups A and B. Write from [definition.md](../definition.md) alone. Don't read track 1's or track 3's branches.

- **Branch:** `cp-0068/scenarios-s17-s20`.
- **Pull request:** `CP-0068 scenarios s17 to s20`.
- **Layout:** follow `pkg/conformance/scenarios/s16-verify-local-preview` and the [scenarios README](../../../../pkg/conformance/scenarios/README.md).
- **Index:** add rows to [INDEPENDENT.md](../../../../pkg/conformance/INDEPENDENT.md).

## The scenarios

- **s17-draft-without-front-matter** (AC-A1 to A5). A one-file onboarding: a synthetic repository, its `assignment.json`, and a `tenet/intent.md` with valid sections, citations and statements, but **no front matter**. Expect, in this order:
  1. `check` reports the missing front matter on that file, with its pointer;
  2. `board` doesn't say "No specifications found";
  3. `fix` writes the front matter (assert only the fields the definition fixes: the `tenet` block, and a `sections` map with each section `draft`);
  4. `check` passes;
  5. `onboard --card` passes;
  6. a scripted `bless` of one section succeeds and is recorded.
- **s18-invented-front-matter-shape** (AC-A1, A4). The same draft with this front matter:
  ```yaml
  tenet: "~0.1"
  sections:
    - {id: vision, heading: Vision, level: L0}
  ```
  Expect:
  - `check`, `onboard --card` and `bless` each fail with the same `TN-SCHEMA` code and the same pointer;
  - `bless` asks no question first;
  - no command reports `TN-INTERNAL`.
- **s19-non-test-exit-not-skip** (AC-B2). A pull request changes a normal script (not under any test path) to add `sys.exit(1)` and `process.exit(1)` in error branches, and changes a real test file to add a `pytest.skip`.
  - Expect `skip-added` only for the test file.
- **s20-first-setup-protected-files** (AC-B1, decided as OD-13 A in [L-0043](../../../ledger/L-0043-owner-decisions-0.2.0.md)). Use two cases.
  - **Base with no `tenet.yaml`; the head adds Tenet's setup.** Expect:
    - no protected-file finding for the paths that `init`'s manifest lists;
    - the note *"First-time setup: protected Tenet files are expected in this pull request."*;
    - a protected path outside the manifest, such as `CODEOWNERS`, is still flagged.
  - **Base that already has `tenet.yaml`; the head edits `tenet.yaml`.** Expect it flagged as today.

## Then · OD-3: refresh the old alpha.1 fixtures (branch `cp-0068/od-3-fixture-refresh`)

The Owner accepted OD-3 A ([L-0043](../../../ledger/L-0043-owner-decisions-0.2.0.md)). You wrote the audit, so you make the change.
- Refresh `events/p08`, `events/n06`, `full-board/p05` and `evaluator-trial/history.yaml` (with its `expected.json`) to what 0.1.0 and 0.1.1 actually write (`src/verify/records.ts`). Apply OD-4 A to `kernel-schemas/n06`.
- Add the missing `evaluator-trial/` row to `INDEPENDENT.md`, and fix the stale line references your audit listed.
- Follow the proposed fixes in your own report, `CP-0067-groundwork-0.2.0/independent-cases-alpha.1.md`, and the decisions in L-0043.

## Rules

- Where the definition leaves output open, assert only what it fixes.
- Mark the cases pending as the README describes, because they fail until groups A and B merge. Your pull request may be red on its own. Say so in its body, and the coordinator will verify it together with the builders' pull requests.
