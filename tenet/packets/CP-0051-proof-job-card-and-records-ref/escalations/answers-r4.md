# CP-0051 · Answers to the round 4 specification questions

Answers to [proposals-r4.md](proposals-r4.md), decided on 2026-11-23 to pin exact `pkg/conformance/card/` JSON and byte-for-byte Markdown outputs for `CP-0051`.

1. **Card header template (`contracts.md:84`, `ux-spec.md:102, 115`).**
   - The first line of `renderCard(model)` is:
     `### Tenet proof · <tested.commit.slice(0, 6)> (<kindLabel>) · <badgeLabel>`
     where:
     - `<tested.commit.slice(0, 6)>` is the first 6 lowercase hex characters of `model.tested.commit` (matching `9b41d0` in `ux-spec.md:102`). `model.evaluation_id` stays in `proof-card.json` (and the records ref path).
     - `<kindLabel>` is `"merge candidate"` when `tested.kind === "merge-candidate"` and `"head"` when `tested.kind === "head"`.
     - `<badgeLabel>` is `"advisory"` when `badge === "advisory"`, `"verified on CI"` when `badge === "verified-on-ci"`, and `"advisory · intent not yet blessed"` when `badge === "intent-not-yet-blessed"` (matching `ux-spec.md:102, 115, 173`).
   - **Spec edits:** `tenet/specs/tech-spec/contracts.md` §5 (`line 84`) and `tenet/specs/plan/alpha.0b.md` (`CP-0051` *Behavior*, `line 72`).

2. **Byte-level Markdown grammar for sections 2–9 of `renderCard(model)` (`contracts.md:84`, `ux-spec.md:101–111`).**
   - `renderCard(model)` emits LF-terminated lines (`\n` at the end) in the exact nine-section order of `contracts.md §5`:
     1. **Header:** `### Tenet proof · <commit6> (<kindLabel>) · <badgeLabel>`
     2. **Requirements touched** (omitted when `model.requirements` is empty):
        - Heading line: `Your intent this change touches`
        - For each non-`same-area` entry in `model.requirements` (`why` in `"implements" | "cited-code-changed" | "text-changed"`):
          `  <id> <state> · "<excerpt>" · <why> · <testsSummary>`
          where `<testsSummary>` is `"<passed> tagged test passed"` (when `tests.passed === 1` and `tests.failed === 0 && tests.not_run === 0`), `"<passed> tagged tests passed"` (when `tests.passed !== 1` and `tests.failed === 0 && tests.not_run === 0`), `"<failed> tagged test(s) failed"` (when `tests.failed > 0`), or `"<not_run> tagged test(s) not run"` (otherwise).
        - For `why === "same-area"` entries (collapsed onto one line in `model.requirements` order):
          `  <id1, id2, …> blessed · may be affected (same area)`
     3. **Acceptance items:**
        - Heading line: `Acceptance`
        - If `model.items` is empty:
          `  ! no acceptance items · add the block from the template`
        - Otherwise, one line per item in `model.items`:
          - `result === "passed"`: `  ✓ <id> · test passed on this commit · <authorshipLabel> · <names.join(", ")>`
          - `result === "failed"`: `  ✗ <id> · test failed on this commit · <authorshipLabel> · <first_failure ?? names.join(", ")>`
          - `result === "no-test"`: `  ! <id> · no test · nothing tagged [<id>]`
          - `result === "skipped"`: `  ! <id> · skipped · <names.join(", ")>`
          - `result === "not-run"` with `tests.passed > 0` (`coverage === "not-confirmed"`): `  ! <id> · coverage not confirmed · <passed>/<expected> tagged tests ran`
          - `result === "not-run"` with `tests.passed === 0`: `  ! <id> · not run · <expected> tagged test(s) did not run`
          where `<authorshipLabel>` is `"written in this change"` (`written-here`), `"tag added here"` (`tag-added-here`), or `"existing test"` (`unknown`).
     4. **Tests, weakening, and protected files summary line** (sections 4, 5, and 6 combined on the summary line as in `ux-spec.md:109`, followed by optional detail lines for section 6 `blessings_changed` and section 7 `deltas`):
        - Summary line: `Tests <testsClause> · <weakeningClause> · <protectedClause>`
          - `<testsClause>`:
            - when `tests.report === "ok"` and `tests.failed === 0 && tests.skipped === 0`: `<tests.passed> passed`
            - when `tests.report === "ok"`: `<tests.passed> passed, <tests.failed> failed, <tests.skipped> skipped`
            - when `tests.report === "missing"`: `not checked (report missing)`
            - when `tests.report === "malformed"`: `not checked (report malformed)`
          - `<weakeningClause>`:
            - when `!weakening.found && weakening.not_checked.length === 0`: `✓ no weakening detected by these checks`
            - when `!weakening.found && weakening.not_checked.length > 0`: `✓ no weakening detected by these checks (not checked: <not_checked.join(", ")>)`
            - when `weakening.found`: `! weakening detected: <by.map(b => b.finding + " in " + b.file + " (" + b.names.join(", ") + ")").join("; ")>` (appending ` (not checked: <not_checked.join(", ")>)` when `not_checked.length > 0`)
          - `<protectedClause>`:
            - when `protected.length === 0 && !workflow_changed`: `✓ no protected files touched`
            - otherwise: `! protected files touched: <protected.join(", ")>` (adding ` (test workflow changed)` when `workflow_changed` is `true` and not already clear)
        - **Section 6 (`blessings_changed`) line** (omitted when `blessings_changed` is empty):
          `Blessings changed: <blessings_changed.map(b => b.doc + "#" + b.section + " blessed by " + b.blessed_by + " (committed by " + b.commit_author + ")").join(", ")>`
        - **Section 7 (`deltas`) line** (omitted when `deltas` is empty):
          `Spec deltas: <deltas.map(d => d.doc + " (+" + d.added + " ~" + d.modified + " -" + d.removed + ")").join(", ")>`
     5. **Section 8 (`Would have blocked`):**
        - Emitted when `model.rules.some(r => r.would_block)`:
          `Would have blocked: <rules.filter(r => r.would_block).map(r => r.reason).join(" · ")>`
        - Omitted when no rule has `would_block: true`.
     6. **Section 9 (`Why` and `Degraded`):**
        - When `model.degraded.length > 0`:
          `Degraded: <model.degraded.join(" · ")>`
        - When `model.why.length > 0`:
          `Why: <model.why.map(w => w.text + " [" + w.class + "]").join(" · ")>`
   - **Spec edits:** `tenet/specs/tech-spec/contracts.md` §5 (`line 84`) and `tenet/specs/plan/alpha.0b.md` (`CP-0051` *Behavior*, `lines 72–73`).

3. **`rules[]` and `why[]` membership (`contracts.md:84`, `algorithms.md:148–150`).**
   - **`card.rules`:** contains only the rules where `would_block === true` (in pack order: `tests-not-weakened`, `protected-surfaces`, `acceptance-passed`, `citations-valid`, `budget`), each with `{rule, mode: "advise", would_block: true, reason}`. When no rule would have blocked, `card.rules` is `[]` (and the `Would have blocked:` line is omitted).
   - **`card.why`:** contains entries explaining non-clean / judge / host conditions (e.g., `{text: "tests written in this change require reviewer judgment", class: "judge"}` when any passing item has `authorship === "written-here"`, `{text: "<language> files not checked for test weakening", class: "not-tenet"}` when `weakening.not_checked` is non-empty, or `{text: "<degraded reason>", class: "host"}` on host/bundle/records failures); empty (`[]`) when no note applies.
   - **Spec edits:** `tenet/specs/tech-spec/contracts.md` §5 (`line 84`) and `tenet/specs/plan/alpha.0b.md` (`CP-0051` *Behavior*, `line 72`).

4. **Canonical `degraded[]` strings for each `CI §10` degraded row (`ci.md:256–269`).**
   - Clean evaluation: `degraded: []`.
   - Malformed acceptance block (`CI §10` row 2): `degraded: ["<finding.code>: <finding.message>"]` (e.g. `"TN-ACC-MISSING-ID: Acceptance item needs an ID."`).
   - Report missing, malformed, or zero cases (`CI §10` row 3): `degraded: ["not checked: test report missing"]` (or `"not checked: test report malformed"` / `"not checked: 0 test cases discovered"`).
   - Non-zero check exit or teardown failure after passing report (`CI §10` row 6): `degraded: ["check failed after its tests passed"]`.
   - CI unavailable, check timed out, or bundle refused (`CI §10` row 7): `degraded: ["not checked: bundle refused (TN-RECORD-BUNDLE)"]` (or `"not checked: check timed out"`).
   - Records not kept (`CI §10` row 9): appends `"results not kept"` to `degraded`.
   - Policy or kit fails to load (`CI §10` row 10): `degraded: ["policy failed to load at head; using previous policy from base (tenet.yaml)"]`.
   - **Spec edits:** `tenet/specs/tech-spec/ci.md` §10 (`lines 256–268`) and `tenet/specs/plan/alpha.0b.md` (`CP-0051` *Behavior*, `line 73`).
