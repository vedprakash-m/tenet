# Track 2 (Gemini) · audit of the alpha.1 independent cases, and the evaluator-trial runbook

**Your file:** `tenet/packets/CP-0067-groundwork-0.2.0/independent-cases-alpha.1.md`. Your pull request adds nothing else. **Don't edit any case**, not even one you wrote. Problems go in the report; the Owner decides which to fix.

## Scope

- **Suites:** `pkg/conformance/kernel-schemas/`, `events/`, `gate/`, `decisions/`, `full-board/` and `evaluator-trial/`, with their rows in [INDEPENDENT.md](../../../../pkg/conformance/INDEPENDENT.md).
- **Contracts they test:** CP-0049, CP-0007, CP-0050, CP-0019 and CP-0008 in [plan/alpha.1.md](../../../specs/plan/alpha.1.md), and the algorithms and contract sections those entries name.
- **The evaluator trial** in plan [§4](../../../specs/plan.md#4-build-contract): "two fresh sessions get only `pkg/conformance/evaluator-trial/history.yaml` …".

## Method

1. **Every case.** For each case folder, find the clause it tests: a contract field, an ALG row or a K section, as `path:line`. Give it one verdict:
   - **matches**: the expected output follows from today's text;
   - **stale**: the text it relies on changed or moved;
   - **conflict**: today's text gives a different result;
   - **unclear**: the expected output can't be derived without inventing a rule.
2. **Coverage.** For each contract, list the *Behavior* rules and *Edge cases* that no case tests. Mark the three most important.
3. **Drift since the cases were written.** Check these changes against the cases:
   - CP-0066 changed the card (AB-C3 `card.why` note), the board (AB-A11) and anchors (AB-E2, hashes only);
   - 0.1.0 and 0.1.1 now write the records "alpha.0" means.

   List each case these changes affect.
4. **Evaluator trial runbook.** Write it so the Owner can run it without help:
   - what each fresh session gets: the files, and a prompt written out in full;
   - what it must output, and where;
   - how the scorer compares the two outputs with `expected.json` and with each other. Give the exact commands, including RFC 8785 serialization using code already in this repository; name the function and file;
   - how to record each invented rule;
   - what counts as a pass;
   - whether `history.yaml` and `expected.json` still match today's contracts. Where they don't, say which lines.

## Report shape (exactly this)

```
# Independent cases for alpha.1 · audit
## Summary
| Suite | Cases | matches | stale | conflict | unclear | Untested rules |
## <suite>
| Case | Tests (path:line) | Verdict | Problem | Proposed fix to the case or the spec |
### Untested rules
1. <contract field or edge case> · why it matters · a proposed case name
(repeat for each suite)
## Drift since the cases were written
| Change | Cases affected | What to change |
## Evaluator trial runbook
### Inputs · ### Session prompt · ### Scoring · ### Pass rule · ### Mismatches with today's contracts
## Owner decisions
D-1 · question · options · recommendation · why
```
