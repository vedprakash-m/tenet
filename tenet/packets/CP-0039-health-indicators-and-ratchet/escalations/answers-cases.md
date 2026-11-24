# Answers to CP-0039 conformance output questions (`proposals-cases.md`)

Answers to GPT's five questions on `pkg/conformance/health/` (`p09-sarif-enforce`, `n07-second-sarif-run`, `n13-report-limit`, `n14-report-limit`, `n15-report-limit`, `n31-conflicting-module-map`, `n39-waiver-wrong-evaluation`, `p37-card-unconfigured`, `p39-card-at-limit`, `p40-card-overflow`, `p41-card-shared-head`). Codified in [health.md](../../../specs/tech-spec/health.md) and [contracts.md](../../../specs/tech-spec/contracts.md).

## Q1. SARIF metadata binding and admission (`p09-sarif-enforce`, `n07-second-sarif-run`)

- **Run property paths (`runs[i].properties`):** Tenet reads completeness and scope claims from `runs[i].properties.coverage` (`{ complete: boolean, analyzed_paths?: string[], analyzed_modules?: string[] }`) and `runs[i].properties.scope_digest` (`"sha256:..."`), plus optional `runs[i].invocations[].executionSuccessful`. `runs[i].tool.driver` is never trusted as tool identity; `tool: { name, version, config_digest }` comes solely from `<base>` `tenet.yaml` (`checks.<name>`).
- **All-runs admission & error codes:**
  - Every SARIF file must contain `runs.length >= 1` (`TN-REPORT-MALFORMED` in `enforce` / advisory `unknown` in `observe`/`advise`).
  - If **any** run lacks `properties.coverage` (with boolean `complete` and `analyzed_paths` or `analyzed_modules`) or `properties.scope_digest`, reject the report with **`TN-REPORT-MALFORMED`** (in `enforce`; advisory `unknown` in `observe`/`advise`).
  - If **any** run's `properties.scope_digest` disagrees with the indicator's expected `scope_digest` (or runs within one SARIF file disagree with each other), reject with **`TN-HEALTH-CONFIG-CHANGED`** (in `enforce`; advisory `unknown` in `observe`/`advise`).
  - If run 0 has `complete: true` and any later run has `complete: false` (or `invocations[].executionSuccessful === false`), the combined report's `complete` is **`false`**: admission does not mark the indicator `holding` — it fails **`TN-GATE-UNKNOWN`** in `enforce` at `verify`/`assure` (advisory `unknown` in `observe`/`advise`).
  - When every run has `complete: true`, matching `scope_digest`, and zero failed invocations, the admitted set unions `analyzed_paths`/`analyzed_modules`, extracts results across **all** `runs[]` (so `n07-second-sarif-run` combines run 0 + run 1 and triggers `regressed` / `TN-HEALTH-REGRESSED`), deduplicates identical locations `(rule_id, file, line, end_line, symbol, snippet_hash)` to `1`, and sorts canonically by ASCII/`Buffer.compare` `(file, startLine, endLine, ruleId, fp_key)`.

## Q2. Report limits and error codes (`n13-report-limit`, `n14-report-limit`, `n15-report-limit`)

- **50 MB byte limit:** Exact `50 * 1024 * 1024 = 52,428,800` raw bytes (`<= 52,428,800` admitted; `>= 52,428,801` rejected — matches `src/reports/registry.ts:353` and `src/verify/bundle.ts:12`).
- **Depth limit (`64`):** The root JSON value (top-level object or array) or root XML element is **depth `1`**; every nested object/array/element adds `+1` (`<= 64` admitted; `>= 65` rejected — matches `src/verify/bundle.ts:75-78` and `src/reports/registry.ts:67`).
- **20,000 item limit:** Inclusive (`<= 20,000` admitted; `>= 20,001` rejected). Counts **raw** items per admitted report before location deduplication: `sum(entries[].findings.length) + sum(entries[].architecture_graph.edges.length)` for `tenet-health-json`, raw `sum(runs[].results.length)` for `sarif`, and raw record count (`SF`+`DA` / `<line>`) for `lcov`/`cobertura`.
- **Error codes:**
  - Single-report parse/schema/size/depth/item-limit failure during report admission (`operation: "admit-health-report"`): **`TN-REPORT-MALFORMED`** (matches `src/reports/read.ts`).
  - Package/bundle-level size (`> 52,428,800` aggregate bytes), bundle `bundle.json`/directory depth (`> 64`), or aggregate cross-check case/item total (`> 20,000`): **`TN-RECORD-BUNDLE`** (matches `src/verify/bundle.ts` & `src/verify/record.ts`).

## Q3. Conflicting architecture module map (`n31-conflicting-module-map`)

- `architecture_graph` in `kit/schemas/health-input.json` allows **only** `{ modules: string[], edges: [{ from_module, to_module }], module_map_digest?: "sha256:..." }` (unknown keys refused per `contracts.md:5`). Target `<base>` `tenet.yaml` (`health.architecture.modules`) solely owns module paths and area mappings.
- **Two distinct refusal outcomes:**
  1. **Forbidden producer mapping field -> `TN-REPORT-MALFORMED`:** Any inline module-map field (such as `reported_module_map` in `n31-conflicting-module-map/report.json`) violates `health-input.json` (`additionalProperties: false`) and fails schema validation before provenance comparison with **`TN-REPORT-MALFORMED`**.
  2. **Permitted digest / module-set mismatch -> `TN-HEALTH-PROVENANCE`:** When a schema-valid report omits forbidden keys and carries `architecture_graph.module_map_digest` differing from `sha256(RFC 8785 health.architecture.modules)` (or lists module IDs / `analyzed_modules` differing from `<base>` `health.architecture.modules` keys when not an observable omission), provenance comparison fails with **`TN-HEALTH-PROVENANCE`**.

## Q4. Waiver for another evaluation (`n39-waiver-wrong-evaluation`)

- When a valid `accept-health-regression` `Decision` binds `evaluation_id: "different-evaluation"` instead of the current `"eval-health"`:
  - The older waiver grants **zero gate credit** (`waived` does not apply) and is retained solely as a non-authorizing stale-evaluation observation emitting **`TN-DEC-STALE`** (`"Reply targets evaluation {actual}, but current evaluation is {expected}."` per `contracts.md §13` / `messages.md §3`).
  - The indicator claim stays **`status: "regressed"`** (gate claim result `"failed"`), emitting **`TN-HEALTH-REGRESSED`** (`verdict: "refuse"`, `disposition: "blocks"`, `reasons: ["TN-GATE-CLAIM"]` + `TN-HEALTH-REGRESSED`, with `TN-DEC-STALE` surfaced as diagnostic context).

## Q5. Exact proof-card rendering (`p37-card-unconfigured`, `p39-card-at-limit`, `p40-card-overflow`, `p41-card-shared-head`)

- **`p37-card-unconfigured` (`configured: false`):** Omit the `Health:` summary line and all health sections completely from `renderCard` / `renderCheckSummary` (bytes match non-health cards). (`all-unknown` with `health` configured still emits `Health: 0 holding · 0 improved · 0 regressed · 0 waived · <U> unknown · 0 n/a`.)
- **`p39-card-at-limit` (`budget: 60000`):** Exact **60,000-character** inclusive boundary (`rendered.length <= 60_000` fits inline with `overflow: false`, `overflow_ref: undefined`, preserving `conclusion`). When exceeding 60,000 before overflow, non-essential health sections shed in order (`holding` -> `improved` -> `advisory_regressed` -> `waived` -> `stale`/`config_changed`/`unknown`) after alpha.0's `same-area` / passing sheds; `blocking_regressed` and `! Tamper watch:` are **essential** and never shed.
- **`p40-card-overflow` (`essential-over-limit`):** When essential lines alone exceed `budget`:
  - Persist full untruncated rendered card UTF-8 LF bytes in `refs/tenet/records` at **`proof/<work>/<evaluation_id>/<run_id>-<attempt>-card.md`** (`work` is `pr-<n>` or `main`), and set `card.overflow_ref` to that path (`card.degraded` & `card.why` append `"check summary exceeded 60,000 characters; full proof card in refs/tenet/records"`).
  - Bounded check-run summary keeps `error.essential.slice(0, Math.max(0, budget - pointer.length))` (no split UTF-16 surrogates) plus exact pointer line `"\n… (truncated at 60,000 characters · full proof card in refs/tenet/records)"`.
  - **Preserve evaluated CI `conclusion`** (`"failure"`, `"neutral"`, or `"success"` — overflow never overrides a passing check to failure or masks an `enforce` failure).
- **`p41-card-shared-head` (`shared_head: [1, 2], budget: 60000`):** Sort PRs sharing `head` ascending by PR number (`#1`, `#2`), prefix each card with `"Pull request #<number>\n"`, join cards with `"\n"` (`overhead = sum(heading.length) + (N - 1)`), give each card per-PR budget `Math.max(0, Math.floor((60_000 - overhead) / N))`, and publish worst conclusion (`failure > neutral > success`) across the $N$ PRs.
