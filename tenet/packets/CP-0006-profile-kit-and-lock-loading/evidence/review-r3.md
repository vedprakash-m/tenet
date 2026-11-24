# Independent round 3 review · CP-0006

Reviewed `main` at `1729379` (after commit `7b8fd8e` / merge `ab82537` containing GPT's `src/policy/load.ts` fix) against `tenet/specs/plan/alpha.0.md:63–75`, `tenet/specs/tech-spec.md:151–205`, `tenet/specs/tech-spec/algorithms.md:53, 91–103`, `tenet/specs/tech-spec/contracts.md:170–181`, and `tenet/specs/tech-spec/messages.md`.

| Contract field | Verdict | Evidence |
|---|---|---|
| Needs | met | `CP-0004` schemas and `CP-0005` core helpers are used as specified. |
| Owns | met | Only `src/policy/` and `test/policy/` are owned and touched. |
| Exports | met | `loadPolicy`, `ruleMode`, `match`, `ownersFor`, `areaFor`, `loadKit`, and `verifyLock` are exported from `src/policy/index.ts`. |
| Behavior | partly | Round 2 Finding 1 is resolved: `src/policy/load.ts:96–101, 111–126, 385–388` now resolves unavailable levels (`verify`, `assure`) to `effectiveLevel = "observe"` before computing `rawDefaults(effectiveLevel)`, matching explicit `level: observe` rule defaults (`advise` for the five alpha.0 rules) with one `TN-POLICY-LEVEL-UNAVAILABLE` warning. However, `src/policy/load.ts` still invents non-contract codes (`TN-POLICY-SCHEMA`, `TN-POLICY-ALPHA0-CAP`, `TN-USAGE-REF`) and ignores section-level front-matter owners. |
| Edge cases | met | Missing `tenet.yaml` (`TN-POLICY-MISSING`), unknown rules (`TN-POLICY-RULE`), loosening overrides (`TN-POLICY-LOOSEN`), branch edits (`TN-POLICY-BRANCH`), unavailable levels (`TN-POLICY-LEVEL-UNAVAILABLE`), and missing CODEOWNERS fallback are all exercised in `test/policy/policy.test.ts`. |
| Out of scope | met | `level` and `rules` CLI commands remain deferred to `CP-0050`. |
| Fixtures | met | `test/policy/policy.test.ts:45–83` now explicitly asserts exact equivalence between unavailable levels (`verify`, `assure`) and explicit `observe` across `loadPolicy` and `ruleMode`. |
| Proving | met | `npm test -- test/policy` passed on Windows (`7 pass, 0 fail`), and three-platform CI passed on PR #1 and PR #2 (`tenet/ledger/L-0036-round-2-merged.md:20–21`). |

## Findings

- **should** · `src/policy/load.ts:77, 155, 219, 245, 339` and `:115–160, 202–205, 225–249, 352–357, 464–467, 493–495` versus `tenet/specs/tech-spec/contracts.md:170–181` and `tenet/specs/tech-spec/messages.md:16–65`. `load.ts` emits unregistered codes `TN-POLICY-SCHEMA` (instead of `TN-SCHEMA`), `TN-POLICY-ALPHA0-CAP`, and `TN-USAGE-REF`, and its `TN-POLICY-*` / `TN-GATE-UNKNOWN` messages and fixes do not use the canonical templates from `messages.md`. **Fix:** replace `TN-POLICY-SCHEMA` with `TN-SCHEMA` and format policy findings and errors from `tenet/specs/tech-spec/messages.md`.
- **should** · `src/policy/load.ts:270–309` and `:473–488` versus `tenet/specs/plan/alpha.0.md:71`, `tenet/specs/tech-spec/contracts.md:52`, and `tenet/specs/tech-spec/algorithms.md:53`. Carried over from round 2: `readFrontMatterOwners` only inspects top-level `tenet.owner` and cannot resolve `sections.<slug>.owner`. **Fix:** support section-qualified owner lookup (`path#slug`) or delegate section owner precedence to `CP-0044`'s parsed `section.owner`.

## Proving on Windows

Ran on Windows (Node 24.22.1) against `1729379`:
- `npm run lint` and `npm run check:examples`: exited `0`.
- `npm test -- test/policy`: exited `0` (`7 pass, 0 fail`).
