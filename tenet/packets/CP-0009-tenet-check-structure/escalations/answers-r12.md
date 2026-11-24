# Answers — CP-0009 round 12

Decision on [pending-r8.md](../escalations/pending-r8.md) (`Citation oracle versus policy-mode contradiction`), decided from PRD `R-215` & `R-033`, `contracts.md §§8, 13`, and `algorithms.md` (`ALG-04`, `ALG-07`):

1. **Direct `check` vs CI/base rule-mode gating on citations (`contracts.md §13`; `algorithms.md` `ALG-04`; `plan/alpha.0.md` CP-0009)**
   Confirm MAI's split behavior (`src/specs/check.ts:680–683`):
   - **Direct `tenet check` (`!(options.ci && options.base)`):** citation failures (`TN-CITE-FILE`, `TN-CITE-RANGE`, `TN-CITE-HEADING`, `TN-CITE-TEST`) retain `severity: "error"` and `rule: "citations-valid"` under all policy levels including `observe`, failing direct structural validation (`exit 1`, matching `pkg/conformance/check/n01–n04`).
   - **CI / gate evaluation (`--ci --base <rev>` and `ALG-07`):** `citations-valid` follows its effective rule mode (`observe` omits, `advise` emits `severity: "advise"` with exit `0`, `enforce` emits `severity: "error"` with exit `1`). This mirrors `budget` (`TN-BUDGET-WARN` locally vs `TN-BUDGET` rule mode under `--ci --base`, `plan/alpha.0.md:132`).

   *Coordinator note for `CP-0054`-locked `prd.md:74` (`R-033`):* note that direct `check` citation checks always report `error`, while `--ci --base` applies the effective `citations-valid` rule mode per `R-215`.
