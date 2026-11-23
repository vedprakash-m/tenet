# CP-0053 · Specification board

Materialize `repo.files` in the working tree and inject the snapshot's `repo.now` and Git subject. Call `board(input.options)`. The JSON oracle in each `expected.json` requires every field present. Arrays match exactly unless an object with `"$assert": "contains"` instead names required members in any order. Require the top-level CP-0053 and Contracts §5 keys. This suite leaves contested values and representation choices open pending the [CP-0053 proposals](../../../tenet/packets/CP-0053-specification-board/escalations/proposals-r3.md).

Each `expected.md` pins the specified Markdown. In `fragments` mode, match each ordinary line as a case-insensitive fragment, ignoring indentation. An HTML comment of the form `<!-- absent: words -->` requires the fragment's absence (case-insensitive). In `ux-example` mode, the file preserves the exact LF screen example without the shell prompt. The UX shows stdout while CP-0053 asks for Markdown, and the fixture models its Design citation in a deferred section. See the proposal before binding this sample to a byte-identical Markdown renderer assertion.

| Case | Kind | Spec line exercised |
|---|---|---|
| [p01-fresh-draft](p01-fresh-draft/input.json) | positive | [CP-0053 lines 158–162](../../../tenet/specs/plan/alpha.0.md#a0-4) · A fresh draft is waiting for blessing. |
| [p02-half-blessed](p02-half-blessed/input.json) | positive | [CP-0053 lines 159, 162](../../../tenet/specs/plan/alpha.0.md#a0-4) · With `--all`, both the waiting section and the clean blessed peer are visible. |
| [p03-sources-changed](p03-sources-changed/input.json) | positive | [ALG-03 lines 48–50](../../../tenet/specs/tech-spec/algorithms.md#alg-03), [CP-0053 lines 159, 162](../../../tenet/specs/plan/alpha.0.md#a0-4) · The live anchor changed without an intent edit. |
| [p04-clean-all](p04-clean-all/input.json) | positive | [CP-0053 line 159](../../../tenet/specs/plan/alpha.0.md#a0-4) · `--all` adds a clean blessed section with no spec debt. |
| [p05-clean-default](p05-clean-default/input.json) | positive | [CP-0053 lines 158–159](../../../tenet/specs/plan/alpha.0.md#a0-4) · Default markdown hides an otherwise clean blessed section. |
| [p06-edited-only](p06-edited-only/input.json) | positive | [ALG-03 lines 48–52](../../../tenet/specs/tech-spec/algorithms.md#alg-03), [CP-0053 line 159](../../../tenet/specs/plan/alpha.0.md#a0-4) · Current text changed, so the blessed section is edited. |
| [p07-ux-part-2](p07-ux-part-2/input.json) | positive | [UX Part 2 lines 148–158](../../../tenet/specs/ux-spec.md#part-2-the-daily-loop), [Contracts §5 line 86](../../../tenet/specs/tech-spec/contracts.md#5-proof-card-and-board-models) · Directly preserves the worked board display and projects its named facts. |
| [n01-no-specifications](n01-no-specifications/input.json) | negative | [CP-0053 line 160](../../../tenet/specs/plan/alpha.0.md#a0-4) · No spec documents exist and the view offers onboarding. |
| [n02-broken-citation](n02-broken-citation/input.json) | negative | [CP-0053 lines 159, 162](../../../tenet/specs/plan/alpha.0.md#a0-4), [ALG-04 line 67](../../../tenet/specs/tech-spec/algorithms.md#alg-04) · An absent heading counts as broken-citation debt. |
| [n03-untested-requirement](n03-untested-requirement/input.json) | negative | [CP-0053 line 159](../../../tenet/specs/plan/alpha.0.md#a0-4), [ALG-09 lines 141–142](../../../tenet/specs/tech-spec/algorithms.md#alg-09) · An unrelated tagged test fails to cover the blessed requirement. |
| [n04-over-budget](n04-over-budget/input.json) | negative | [CP-0053 lines 159, 162](../../../tenet/specs/plan/alpha.0.md#a0-4), [TS §9 line 229](../../../tenet/specs/tech-spec.md#9-context-budgets-and-rollover) · A 201-token document exceeds its 200-token budget. |
