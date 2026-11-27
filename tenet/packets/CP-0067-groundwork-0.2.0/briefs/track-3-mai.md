# Track 3 (MAI Code 2) · readiness of CP-0050, CP-0019 and CP-0008

**Your file:** `tenet/packets/CP-0067-groundwork-0.2.0/readiness-cp-0050-cp-0019-cp-0008.md`. Your pull request adds nothing else.

## Scope

- [plan/alpha.1.md](../../../specs/plan/alpha.1.md), the entries **CP-0050 · Gate, levels and rule modes**, **CP-0019 · Decisions on pull requests** and **CP-0008 · Full board**.
- Every section their *Needs* lines name:
  - TS §4, §6.1 and §8;
  - contracts §5 and §8;
  - ALG-06 and ALG-07;
  - CI §3, §4, §6 and §10;
  - kernel §1 to §4;
  - L-0030.
- Today's code: `src/policy/`, `src/verify/`, `src/views/`, `src/commands/board.ts`, `src/commands/verify.ts`.
  - CP-0053 built the specification board, and CP-0066 AB-A11 changed it. CP-0008 says it owns "remaining `src/views/`". Say exactly which files and functions that means today.
- The independent cases in `pkg/conformance/gate/`, `decisions/` and `full-board/`, plus `evaluator-trial/`. Read them only to compare. Track 2 audits them in depth.

## Method

For each packet, work through the eight fields in order:

1. **Needs.** Open every reference. Does it exist, and does it say what the contract assumes?
2. **Owns.** Check each path: does it exist already, and what would change? For CP-0008, list every current board output (plain text, `--all`, `--json`) and say whether the full board keeps, replaces or extends it. A full board that breaks today's `board` output is a **conflict** with the s-scenarios and `pkg/conformance/board/`.
3. **Exports.** Write each signature in your report, not in `src/`, with three to five lines of pseudocode taken only from the text. Every point where you had to guess is an **invention**: record it.
4. **Behavior.** Follow each rule to its algorithm or contract section. Check in particular:
   - every ALG-07 row has a defined input and result;
   - the CI §10 mapping from verdict to check conclusion is complete;
   - each `TN-…` code is defined in the contracts' error table;
   - the friction thresholds (`not_useful_pct > 10`, `false_blocks_per_100 > 2`) are the same everywhere they appear;
   - **backtest:** the plan §0 table says the 100-PR cohort's agent group is empty. Say whether CP-0050's *Proving* can pass today, and what it needs.
5. **Edge cases.** Is each one defined well enough to write a test?
6. **Out of scope.** Does it conflict with anything CP-0042 or CP-0046 (alpha.2) expects?
7. **Fixtures.** Do the named folders match the independent cases? List what's missing on either side.
8. **Proving.** Would each `npm test -- <path>` select those tests with `scripts/run-tests.mjs`? Can each threshold be measured?

Then check **drift since 2026-11-23**, from the changes in 0.1.0 and 0.1.1:
- proof-card fields, for example `card.why` and the AB-C3 "takes effect after merge" note;
- board JSON (`main` is now the default-branch commit);
- `verify --local`.

List everything that changes what these three contracts assume.

## Report shape (exactly this)

```
# Readiness · CP-0050, CP-0019 and CP-0008
## Summary
| Packet | Verdict | gap | stale | conflict | Inventions | Owner decisions |
## CP-0050 · Gate, levels and rule modes
| # | Field | Verdict | Evidence | Problem | Proposed text |
(eight rows, 1 Needs … 8 Proving)
### Inventions
1. <rule a builder would have to invent> · where it belongs (file#section) · proposed text
### Drift since 2026-11-23
## CP-0019 · Decisions on pull requests
(same three parts)
## CP-0008 · Full board
(same three parts, plus: | Today's board output | Kept / replaced / extended | Evidence |)
## Owner decisions
D-1 · question · options · recommendation · why
```

The packet verdict is **ready** (no gap, stale or conflict rows), **ready after fixes** (every problem has proposed text and no Owner decision blocks it) or **not ready**.
