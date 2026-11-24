---
packet: CP-0039
version: 1
---
# CP-0039 · Health indicators and ratchet

> Round 1 · `R-175`–`R-178` · [research](evidence/research-code-health.md), [L-0038](../../ledger/L-0038-review-rounds-and-public-home.md), [0.1.x](../../specs/plan/0.1.x.md).

## 1. Problem and outcome

Code health keeps code changeable (`V-V10`, `V-P9`) and promises intact without gating old debt (`V-M10`). Whole-repo thresholds stall work, offline dashboards go unread (~0% fix rate vs ~70% on diffs), noisy checks trigger bypasses, and agents game mutable graders (30%–76% cheating).

**Goodness without the tax:** baseline legacy debt, gate only touched regressions past tolerance, auto-tighten from `main`, post findings on the proof card, flag gate tampering, and demote loud checks (`R-177`/`R-216`).

## 2. Scope and deferrals

- **`0.1.x CP-0039`:** `R-175` two-kind ratchet (`scalar`, `finding_set`), `.tenet/health-baseline.json`, touched-scope + area fallback, expiring `accept-health-regression`, tool/version/`config_digest` binding; **tamper check** (`R-175`+`R-103`); `R-176` architecture rules; `R-177` `owner` + noise tracking; `R-178` 30-day durability; shared `git diff -U0 -M` mapper (`ALG-15`); repo dogfooding telemetry (`0.1.x`, `L-0038`).
- **`0.1.x CP-0036`:** `R-150` dimensions/fix hints; `R-151` mutation ingestion (Stryker schema) into 9 counts + `catching_tests` via `ALG-15` in a budgeted lane (`timed_out` never killed; `equivalent` by decision; cap in `excluded`). Thresholds stay **M2**.
- **Deferred (`DEC-38` `idea`/`M2`):** **`R-227` changed-line coverage** (`idea`, prepared by `ALG-15` + LCOV/Cobertura; repo % rejected as target); **review-cost signal** (`M2` `R-184`/`R-072`; cognitive complexity allowed only as a `finding_set` indicator); **anti-slop pack** (`idea`; deterministic checks opt in via `R-175`); churn/authors (`R-072`), M2 `R-177` fixtures/retirement, `R-149`, `R-161`.

## 3. Design

- **Kinds:** `scalar` (`value`, `unit`, `direction: up|down`, `aggregation: touched_lines|area|sampled_runs`, `min_changed_lines?`, `samples`) vs `finding_set` (`fingerprints[]`: `sha256:` over `(rule_id, file, normalized_symbol, snippet_hash)`, `{rule_id, path, hint}`, `scope: touched_lines|touched_files|area`). Architecture (`R-176`: layers, imports, cycles), lint/type/dead-code, broken doc refs use `finding_set` on `measurement`.
- **Baseline & ratchet:** Sorted `.tenet/health-baseline.json` (`protect`, `kit/schemas/health-baseline.json`): `{schema_version: 1, updated_at, updated_from_rev, areas: {<area>: {indicators}}}`. Adoption captures debt (`origin: observed`). On `main` matching `(tool, tool_version, config_digest)`: `scalar` updates **only if improved**; `finding_set` prunes resolved fingerprints (unpruned touched fixes advise `"baseline stale"`). Digest mismatch requires `"re-baseline"` (`change-policy`), never silent pass.
- **Touched scope:** Shared `git diff -U0 -M <base_sha>..<tested_sha>` (`ALG-15`, reused by `ALG-08/09/14`, `CP-0036`) normalizes POSIX paths and `-M` renames. Checks `touched_lines` hunks, `touched_files` new fingerprints, or `area` (`tenet.yaml`->`CODEOWNERS`) for unsplit rules (cycles, imports, duration, flake).
- **Tolerance & noise:** `scalar` `{kind: absolute|relative-pct, value}` (default `0`, `ALG-06` min); `finding_set` `max_new: 0`. Ratios default `min_changed_lines: 20` (`not-applicable` below). Sampled metrics (duration, flake) record `samples` + `quarantined` count and cap at `advise`.
- **Waive (`accept-health-regression`):** `forge-verified` (`person-present` at `assure`), non-author (`TN-GATE-SELF-WAIVE`), bound to `evaluation_id`/scope + `reason` + **mandatory `expires_at`** (UTC RFC 3339, default **30d**, capped by `waiver_max_days`). Keeps baseline strict; expiry re-surfaces decline on `board` (`V-M10`, `R-143`).
- **Rollout (`R-177`, `R-215`):** `health-ratchet` uses pack level (`0.1.x`); new indicators start `mode: observe` until `change-policy` promotion and name `owner`. `/tenet not-useful <finding>` + waivers >10% or >2 false blocks/100 flag demotion (`R-216`).
- **Inputs & determinism (`C §11`):** `checks.<name>.format`: `tenet-health-json` (`kit/schemas/health-input.json`), `sarif`, `lcov`, `cobertura` (`fast-xml-parser`), under `ci.md §3` limits (50 MB, depth 64, no DOCTYPE/ENTITY). Each `measurement` records `{tool, tool_version, config_digest}` + `report_sha256`. CRLF->LF, `-c core.quotepath=false`, POSIX paths, RFC 8785, ASCII/UTF-16 sort, `<base_sha>`, injected clock, shift-proof fingerprints.
- **Card & anti-gaming:** `Health: N holding · M improved · K regressed`; expands regressions (`rule_id`, `path`, delta, `owner`, hint), `main` gains, config changes, active waivers, and `! Tamper watch:` (blocking health/tamper untrimmed at 60k chars; hidden if unconfigured). Baseline + workflows in `protect`; configs from `base`; **tamper check** flags PR edits to tests (`ALG-09`), configs/`inputs`, baseline, workflows, or added suppressions (`eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `biome-ignore`, `# noqa`, `//nolint`, `#[allow(`); CI `measurement` only, never `self`.

## 4. Acceptance items

### Acceptance
Implements: R-175, R-176, R-177, R-178
- [AB-1] Config validates `health`, merges tightly, starts `observe`, caps noisy metrics at `advise` (`contract`+`unit`; `ALG-06`, `TN-POLICY-LOOSEN`; conformance: Yes).
- [AB-2] Shared `git diff -U0 -M` maps hunks, renames, POSIX paths identically across OSes (`unit`+`contract`; CRLF/rename/Windows; conformance: Yes).
- [AB-3] Adapters ingest JSON/`sarif`/`lcov`/`cobertura` requiring `{tool, tool_version, config_digest}` under `ci.md §3` limits (`contract`+`unit`; conformance: Yes).
- [AB-4] Ratchet checks `scalar` & `finding_set`, tightens on `main` only, flags stale baselines & config mismatch (`contract`+`integration`; 5 goldens; conformance: Yes).
- [AB-5] Touched-scope falls back to `area` and skips `<min_changed_lines>` ratios (`contract`+`unit`; `<20` lines `not-applicable`; conformance: Yes).
- [AB-6] `accept-health-regression` enforces `forge-verified` non-author `waive`, `reason`, unexpired `expires_at` (`contract`+`kernel`; `TN-GATE-SELF-WAIVE`; conformance: Yes).
- [AB-7] Tamper check flags edits to tests, configs/`inputs`, baseline, workflows, suppressions (`contract`+`integration`; conformance: Yes + red-team).
- [AB-8] Architecture rules (`R-176`) run as `finding_set` with fix hints (`contract`+`integration`; new edge fails `enforce`, baselined free; conformance: Yes).
- [AB-9] `owner`, `/tenet not-useful`, waivers flag >10% noise or >2 false blocks/100 (`unit`+`integration`; event history; conformance: No).
- [AB-10] `R-178` 30-day durability view & 60k-char card rendering match goldens (`contract`+`integration`; byte parity; conformance: Yes).

## 5. Proposed spec changes (exact Old/New, unapplied)

- `tech-spec.md:145`: Old ``| `protect` | Tenet's workflows, `tenet.yaml`, `tenet.lock`, CODEOWNERS |`` -> New ``| `protect` | Tenet's workflows, `tenet.yaml`, `tenet.lock`, `.tenet/health-baseline.json`, CODEOWNERS |``
- `tech-spec.md:146`: Old ``{indicators: {<name>: {check, metric, rule, tolerance, scope, area}}}`` -> New ``{baseline_path, waiver_max_days, tamper_watch, indicators: {<name>: {check, kind: scalar|finding_set, metric, direction?, tolerance, min_changed_lines?, scope, area, owner, mode?}}}``
- `tech-spec.md:160,168`: append ``| `health-ratchet` | Declared indicators hold on touched scope without `accept-health-regression` | 0.1.x | observe | advise | enforce | enforce |`` after `160`; append `` `0.1.x` adds `health` (`observe`) and check `format`/`dimension`.`` to `168`.
- `tech-spec/evidence.md:12`: Old ``{metric, value, threshold, direction, samples, baseline_value, rule, scope, confidence}`` | ``Samples meet the pass rule's minimum`` -> New ``{metric, indicator_kind?, value, threshold, direction, samples, baseline_value, rule, scope, confidence, tool, tool_version, config_digest, findings?, quarantined?}`` | ``Samples meet minimum; `{tool, tool_version, config_digest}` present``
- `tech-spec/contracts.md:14,20,84,155–157`: `14` Old ``, `loop`)`` -> New ``, `loop`; 0.1.x adds `health-baseline`, `health-input`)``; `20` Old ``except `manifest.json` and`` -> New ``except `manifest.json`, `health-baseline.json` and``; `84` Old ``degraded: [reason]}` `` -> New ``degraded: [reason], health?, tamper?}` `` (`Health:`/`! Tamper watch:` untrimmed); `155–157` add `TN-HEALTH-BASELINE` (`1`), `TN-HEALTH-REGRESSION`, `TN-HEALTH-CONFIG-CHANGED`, `TN-HEALTH-STALE`, `TN-HEALTH-TAMPER`, `TN-WAIVER-EXPIRED`.
- `tech-spec/ci.md:48,151,199,208`: `48` Old ``report_sha256, inputs}]`` -> New ``report_sha256, inputs, format?, tool?, tool_version?, config_digest?}]``; `151` add blocking health/tamper to never-cut set & tighten `.tenet/health-baseline.json` on `main`; `199` require `reason` + `expires_at` (30d) on `accept-health-regression`; `208` cover health findings in `/tenet not-useful`.
- `tech-spec/algorithms.md:194+`, `prd/catalog.md:16,39`, `plan/0.1.x.md:25`, `messages.md:100+`: add `ALG-15` (diff/rename) & `ALG-16` (ratchet, fingerprints, `min_changed_lines`, tamper); update `R-175` (two kinds, provenance, `min_changed_lines`, expiring waive, tamper; `R-227` stays `idea`), `R-177` (health in budget), `CP-0039` scope, `TN-HEALTH-*` templates.

## 6. Dogfooding (Tenet repository)

CI runs lockfile, Biome `lint`, `node --test` (JUnit), `check:examples` on 3 OSes.
- **Collect now (info-only):** Node `--experimental-test-coverage` LCOV (`ubuntu-latest`), Biome `noExcessiveCognitiveComplexity` `info`, suite `duration_ms` per OS -> `main` snapshots, seeding `.tenet/health-baseline.json` (`origin: observed`, `observe`; cf. `scripts/examples-known.json`) after >=5 runs.
- **`dist/` caveat:** `test/**/*.test.ts` (`test/cli/cli.test.ts:3`) imports `dist/*.js` and `tsconfig.json` omits `"sourceMap": true`, so LCOV maps to **`dist/`, not `src/`**. Enable `"sourceMap": true` or label `dist/` coverage before changed-line work.
- **Defer to `CP-0039`/`CP-0036`:** `jscpd`, `knip`, `dependency-cruiser`, `Stryker`.

## 7. Friction measures (`R-216`, `V-M11`)

Per indicator (`rules/<yyyy-mm>.jsonl`, `decisions/*.json`) vs `V-M11` (`<=2 min`/change, `0` quick steps, `<2` false blocks/100): `"not useful"` rate (`>10%`), waiver/false-block rate (`>2/100`), diff fix rate, health CI `duration_ms`, Owner minutes, small-diff skips.

## 8. Risks and open questions

**Risks:** unmapped `dist/` LCOV; PR pruning vs `protect`; debt shifted outside hunks; JS/TS tool coupling.

**Open questions for the Owner:**
1. **`DEC-38` dogfooding:** Is info-only CI telemetry outside freeze, and enable `"sourceMap": true` now or label `dist/`?
2. **Waiver expiry:** Confirm `expires_at` (default **30d**), keeping baseline strict until fixed or `change-policy` updated.
3. **Stale baseline:** Confirm recorder auto-tightening `.tenet/health-baseline.json` on `main` (avoiding `protect` friction), advising only on PRs.
4. **Tamper tiers (`R-103`):** Confirm splitting baseline/workflows (`protected-surfaces`) from tests/configs/suppressions (`tamper watch`, non-author review).
5. **Small-change threshold:** Confirm default `min_changed_lines: 20`.
6. **Review-cost (`R-184`):** Confirm cognitive complexity stays a `CP-0039` `finding_set` indicator while review-cost views stay `M2`.
