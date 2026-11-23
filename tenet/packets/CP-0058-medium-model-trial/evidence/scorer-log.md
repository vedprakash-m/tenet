# CP-0058 · Medium-Model Trial Scorer Log

- **Evaluator:** Antigravity specification QA engineer (Track 2, branch `m0/track-2-trial-kit`)
- **Scratch harness:** `Q:\Ved\Pers\tenet-trial` (Node 24.x ESM, `node:test`, `tsc --noEmit`, `fast-xml-parser`, `yaml`, `CP-0005` stubs for `sha256`, `jcs`, `git`, `readYaml`)
- **Workers:** Two isolated clean-room subagents (`trial-builder`, `Model: flash`) per round (`rN-a`, `rN-b`), seeing only `contract-pack/pack.md`, `stubs/cp0005.ts`, `package.json`, and `tsconfig.json`.
- **Scope exercised:** `CP-0018` (`reports.ts`: `readReport`, `parseAcceptance`, `scanTests`, `declaredTags`, `itemResults`, `weakening`) and `CP-0044` (`specs.ts`: `parseDoc`, `parseRequirement`, `sectionDigest`, `anchorsFor`, `resolveCitations`, `flags`, `relocate`, `matchRenamed`, `ladder`, `deltas`, `touched`).

---

## Round-by-Round Metrics

| Metric | Round 1 (`r1-a` / `r1-b`) | Round 2 (`r2-a` / `r2-b`) | Round 3 (`r3-a` / `r3-b`) |
|---|---|---|---|
| Session unit tests | 7 pass / 11 pass (0 fail) | 6 pass / 10 pass (0 fail) | 9 pass / 11 pass (0 fail) |
| `tsc --noEmit` errors | 0 / 0 | 0 / 0 | 0 / 0 |
| `QUESTIONS.md` items | 19 / 18 | 19 / 12 | 11 / 15 |
| `// INVENTED:` markers | 21 (`12+9`) / 17 (`9+8`) | 30 (`18+12`) / 31 (`19+12`) | 9 (`7+2`) / 15 (`10+5`) |
| Shared fixture errors | `node.xml` `<work>` XML crash (`r1-a`); `opts` string->object signature change later broke R1 re-run | 0 / 0 | 0 / 0 |
| `reports` comparison | DIFF (299B vs 315B) | DIFF (5,636B vs 5,637B — 1B vitest `teardown_failed`) | **MATCH** (0B diff across vitest, node:test, pytest, jest, go, ctrf) |
| `acceptance` comparison | **MATCH** | **MATCH** | **MATCH** |
| `specs` comparison | DIFF (5,248B vs 5,018B) | DIFF (6,352B vs 6,323B — `line` + `Finding` text) | Structural **MATCH**; raw 12B DIFF (`6,321B` vs `6,309B`) solely on free-text `Finding.message` / `fix` prose |
| `moved` comparison | DIFF (1,224B vs 1,590B) | **MATCH** | **MATCH** |
| `renamed` comparison | DIFF (155B vs 197B) | **MATCH** | **MATCH** |
| `pr` comparison | DIFF (1,636B vs 1,231B) | DIFF (1,577B vs 1,641B — `itemResults` matching) | **MATCH** |

### Exact Remaining Diff in Round 3

Only three `Finding` objects' human-readable `message` and `fix` strings differed in the 25,804B vs 25,792B JSON outputs:
- `.specs.reqInvalid.problems[0].message` / `.fix` (`TN-SPEC-NO-FRONT`)
- `.specs.reqInvalid.problems[1].message` / `.fix` (`TN-SPEC-MISSING-ID`)
- `.specs.citationsPrd[0].message` / `.fix` (`TN-CITE-FILE`)

Every structural field (`code`, `severity`, `rule`, `file`, `line`, `slug`, `heading`, `level`, `text`, `digest`, `requirements`, `vision_items`, `conflicts`, `questions`, `anchors`, `flags`, `relocate`, `matchRenamed`, `scanTests`, `declaredTags`, `itemResults`, `weakening`, `touched`, and all 6 parsed test reports) was **100% byte-identical** between `r3-a` and `r3-b`.

---

## Spec Fixes Applied Across Rounds

### Round 1 -> Round 2
- `tenet/specs/tech-spec/contracts.md`: clarified `readReport` `opts?: {prefix?, cwd?}` signature & `cwd` forward-slash relativization, `duration_ms` integer rounding (`Math.round`), `AB`/`CF`/`Q`/`V` reserved prefixes and `[UTF-8]` tolerance, `Conflict` / `Open question` parsing and `TN-SPEC-*` codes, 7-field `Finding` (`{code, severity, rule, file, line, message, fix}`).
- `tenet/specs/tech-spec/onboarding.md`: clarified Markdown table parsing in §1 (`(case-insensitive headers; —, - or empty cells map to null/[])`).
- `tenet/specs/tech-spec/evidence.md`: documented JUnit `classname > name` collapse, `node:test` `<undefined>` element traversal, `<failure>`/`<error>`/`<system-out>`/`<system-err>` `stopNodes` rule (fixing `<work>` / `<anonymous>` XML stack-trace crashes), pytest `"failed on teardown with"` rule keeping the testcase's own status, jest `invocations`/`retryReasons` retry decoding and suite-level teardown detection, `go-test-json` subtest parent suppression, and matrix shard merge order.
- `tenet/specs/tech-spec/algorithms.md`: fixed `ALG-02` section slugification, digest whitespace/citation normalization (`://` and `sha256:` exclusion), and CommonMark fence matching; pinned `ALG-08` multi-line JS/TS/`@Test`/`#[test]`/`t.Run`/`record_property` and `describe(` block inheritance rules, `via_describe` -> `authorship: "unknown"` precedence; pinned `ALG-09` `names` & `tests-consolidated`; pinned `ALG-14` pure-insertion hunk rule (`start <= L && L < end`) and CODEOWNERS precedence.
- `tenet/specs/plan/alpha.0.md`: aligned `CP-0018` and `CP-0044` TypeScript signatures and exact `DeclaredTag`, `TestReport`, `scanTests`, `weakening`, `anchorsFor`, and `matchRenamed` return shapes; removed `tests` param mismatch on `readReport`.

### Round 2 -> Round 3
- `tenet/specs/tech-spec/evidence.md`: specified `vitest` JUnit teardown (`classname === name` sets `teardown_failed: true` and keeps the case — fixing the 1B `reports` diff); fixed `50 * 1024 * 1024` bytes, `20,000` cases per file and merged total, `kind === "none"` no-disk return, `opts.cwd` explicit relativization vs path resolution, duplicate `<testcase>` retry collapsing & `<flakyFailure>`/`<rerunFailure>`, `tenet.case` / `extra.tenet_cases` token parsing, CTRF unknown status -> `"skip"`, and shard merge for `tags`/`file`/`duration_ms`/empty `path[]`.
- `tenet/specs/tech-spec/contracts.md`: pinned `parseAcceptance` missing-block return, code-fence skipping, multi-line `Implements:`, duplicate ID exclusion, and ASCII/UTF-16 sort; pinned `parseDoc` `_preamble.heading: ""`, `section.level`, omitted `applies_to: []`, scoped `TN-SPEC-MISSING-ID`, unknown key / invalid `origin` -> `TN-SPEC-REQ-META`, and conflict/question suffix stripping.
- `tenet/specs/tech-spec/algorithms.md`: excluded `describe(` from `scanTests` `declarations[]`; pinned `ALG-08` title-only matching (never tag-only fallback or `case.file` equality — fixing the 64B `pr` diff), `first_failure` on final `fail`/`error`, `declaredTags` file-scoped base lookup, `ALG-02` `section-<n>` non-preamble ordinal & citation boundary pattern, `ALG-03` non-blessed `flags() -> []`, `ALG-04` malformed citation `TN-CITE-RANGE` & `resolveCitations` `line`/`severity` (fixing `citationsPrd[0].line`), `ALG-09` `file-deleted` / `skip-added` `names` & `not_checked` head files, and `ALG-14` `.md` front-matter scan, `test:`/`doc:` block overlap, and per-file `same-area` top-level fallback before 10-item cap.
- `tenet/specs/plan/alpha.0.md`: added exact `scanTests` `kind` union, omitted `text` on `itemResults`, specified `relocate(anchor, file)` `file` is text content, and clarified `parseRequirement` `<prefix>-\d+` vs `parseDoc` `Vision` routing.

### Post-Round-3 Closing Clarifications (from `r3-a`, `r3-b`, & QA Review)
Applied after Round 3 without running a fourth trial round; Round 3 outputs are verified up to Round 3 (`r3-a`/`r3-b` did not re-run these additions, so items like sorted `implements` in `parseAcceptance` and `doc: tenet.doc` in `deltas` reflect the clarified spec rather than Round 3 code):
- `evidence.md`: `kind === "none"` returns immediately before disk/`path[]` checks; `vitest` teardown requires non-empty `classname === name` with `fail`/`error`; `go-test-json` ignores incomplete runs lacking a terminal action and omits `"Package > "` when `Package` is empty.
- `plan/alpha.0.md` (`CP-0018`): `readReport` error type includes `& {fix}`; `scanTests` accepts optional `cwd`; `parseAcceptance` excludes duplicates after the first and sorts both `implements` and `items`; `scanTests` starts `@Test`/`#[test]` `line` on the annotation/attribute line; `itemResults` requires a start/delimiter boundary (`^|[\s>./:]`), strips `AB-n`/`case.tags`, and dedupes by `(reportIndex, caseIndex)`.
- `plan/alpha.0.md` (`CP-0044`): defined `ladder(policy)` discovery & `L0 < L1 < L2 < null` then `path` sort; defined `deltas(base, head, opts)` `tenet.doc` + item-ID diff format; `touched` uses optional `cwd?: string`; `parseDoc` routes `V-(?:[A-Z]+)?\d+` in `L0` sections (including `Vision`) to `vision_items` and excludes duplicate IDs after the first; defined `anchorsFor` `test:` outer/peer indentation stop and `doc:` `texts` normalized body; excluded multi-slug merges in `matchRenamed`.
- `contracts.md`: scoped `TN-SPEC-MISSING-ID` cleanly to `Requirements`, `Vision`, and `L0` sections (or bullets with `{…}` / empty table ID cells).

---

## Token Budget Verification (Post-Final Edit)

| File | Characters | Estimated Tokens (`chars / 4`) | 90% Cap (`0.9 * 6,000`) |
|---|---|---|---|
| `tenet/specs/tech-spec/contracts.md` | 20,912 | 5,228 | 5,400 |
| `tenet/specs/tech-spec/algorithms.md` | 21,576 | 5,394 | 5,400 |
| `tenet/specs/tech-spec/evidence.md` | 6,146 | 1,537 | 5,400 |
| `tenet/specs/tech-spec/onboarding.md` | 8,419 | 2,105 | 5,400 |
| `tenet/specs/tech-spec/ci.md` | 20,415 | 5,104 | 5,400 |
| `tenet/specs/tech-spec/agents.md` | 17,067 | 4,267 | 5,400 |
| `tenet/specs/ux-spec.md` | 21,345 | 5,336 | 5,400 |
| `tenet/specs/plan/alpha.0.md` | 18,831 | 4,708 | 5,400 |
| `tenet/specs/plan/alpha.0b.md` | 10,922 | 2,731 | 5,400 |

---

## Remaining Open / Out-of-Scope Proposals

Proposals for files outside Track 2's write boundary (`tech-spec.md` §§ 2, 10, 15 and `plan.md` §1 #5 / §3 `CP-0058`) are recorded in [escalations/proposals.md](../escalations/proposals.md).

---

## Round 4 (`r4-a` / `r4-b` — with `messages.md`)

| Metric | Round 4 (`r4-a` / `r4-b`) |
|---|---|
| Session unit tests | 14 pass / 12 pass (0 fail) |
| `tsc --noEmit` errors | 0 / 0 |
| `QUESTIONS.md` items | 9 / 13 |
| `// INVENTED:` markers | 9 / 17 (10 `reports.ts` + 7 `specs.ts`) |
| Shared fixture errors | 0 / 0 |
| `compare.mjs r4` | **100% byte-identical (`identical=true`, `25,818B == 25,818B`)** across all 6 groups (`reports`, `acceptance`, `specs`, `moved`, `renamed`, `pr`) |

### Round 4 -> Round 5 Spec Fixes (Closing All `r4-a`/`r4-b` Inventions)
- `tenet/specs/tech-spec/contracts.md`: broadened `tenet_` left boundary in §1 to `(?:^|[^A-Za-z0-9]|_)` (`suite > tenet_AB_1`); in §2 pinned `parseAcceptance` `item.text` trimming vs whitespace-collapsed digest, `implements` deduping/sorting in digest, and `problems[]` defaults (`severity: "error"`, `rule: null`, `file: null`, `line`); in §3 pinned `scope` optional string/nullable, repeated metadata keys overwrite, and `TN-SPEC-NO-FRONT` `line: null`.
- `tenet/specs/tech-spec/messages.md`: defined `string[]` `{path}` formatting (`", "`-joined or `"[]"`) for both `TN-REPORT-MISSING` and `TN-REPORT-MALFORMED`.
- `tenet/specs/tech-spec/evidence.md`: restricted JUnit `<property name="tenet.case">` lookup to `<testcase>` elements; required throwing `TN-REPORT-MALFORMED` on unrecognized `jest-json` statuses; defined CTRF `case.file` (`filePath ?? file`) and `duration_ms` (`Math.round(duration)` ms).
- `tenet/specs/tech-spec/algorithms.md`: defined `via_describe` true iff enclosing `describe(` adds ≥1 absent tag; specified comment/string-aware brace depth for `end_line`; aligned `declaredTags` `requirement` authorship with `acceptance`; ordered `itemResults` tag stripping before pytest `[…]` suffix stripping; defined `ALG-09` `skip-added` `names` lookup (`line..end_line` enclosing or next 3 lines); defined `ALG-14` `text-changed` line-hunk fallback for normalized line edits and keyed `same-area` by pattern string (or `dir:<folder>`/`dir:.`).
- `tenet/specs/plan/alpha.0.md`: made `opts.cwd` optional on `declaredTags` and `weakening`; documented `itemResults` title-only matching rule; defined `parseDoc` vs `parseRequirement` `V-` routing and duplicate ID exclusion in both `requirements` and `vision_items`; pinned `ladder` default recursive walk exclusions (`.git`, `.tenet`, `node_modules`, `dist`, `build`) and `deltas` `string[]` ID arrays sorted numerically then ASCII using `jcs` comparison.

Post-Round-4 edit token counts: `contracts.md` `5,283` (`21,130B`), `messages.md` `2,005` (`8,019B`), `algorithms.md` `5,238` (`20,952B`), `evidence.md` `1,596` (`6,382B`), `alpha.0.md` `4,811` (`19,244B`), `tech-spec.md` `10,109` (`40,437B`). Proceeding to Round 5 to verify zero remaining inventions.
