# CP-0039 independent definition review - round 2 (MAI)

Reviewed `shape/cp-0039` at `afcc6c0` against `origin/main` at `a64fdf2`. The round 1 GPT review was available at `review/cp-0039-gpt-r1`; the round 2 GPT review was available at `review/cp-0039-gpt-r2`.

## Earlier MAI findings

No `review-r1-mai.md` exists on the shaping branch or in the available review refs, so there is no round 1 MAI finding to mark resolved, withdrawn, or maintained.

## Round 2 findings

### F1 - blocker - ALG-15 is not deterministic enough for the three-platform acceptance item

**Exact text concerned:** definition.md line 47: "Run `git -c core.quotepath=false diff -U0 -M <base_sha>..<tested_sha>`"; line 79: "Determinism ... `-c core.quotepath=false`"; AB-2, line 86: "Shared `git diff -U0 -M` mapper resolves hunks, renames, deletions, unusual paths across OSes" and "100% golden parity".

**Basis:** `core.quotepath=false` fixes path quoting, not Git's rename search, rename similarity, diff driver, text conversion, or external-diff inputs. `src/core/git.ts:11` supplies only `core.quotepath=false`. The repository already has two private pieces of related behavior in `src/specs/touched.ts:88` and `:112-174`: one parses `--name-status -z -M`, while the other parses patch headers from `diff --unified=0 -M`. Neither pins rename limits, similarity, `diff.algorithm`, external diff, or text conversion. With the same commits, different configured or attributed diff behavior can therefore produce different rename pairing, hunk ranges, and touched scope. That cannot satisfy AB-2's cross-platform determinism or be safely reused by ALG-08/09/14 and CP-0036.

**Change accepted:** Define one reusable raw diff-mapper module and require all touched-scope consumers to call it. Pin a complete Git argument/config contract, including an explicit rename threshold and fixed rename-search cap, `--no-ext-diff`, `--no-textconv`, `--no-color`, NUL-delimited paths/status, and byte/path decoding rules. If rename matching is truncated or ambiguous, return `unknown` rather than a platform-dependent mapping. Replace the private logic in `src/specs/touched.ts`. Add fixtures that run with hostile global Git settings, many rename candidates, attributed text conversion, quoted names, CRLF, and deletion/rename cases on Windows, macOS, and Linux.

### F2 - blocker - `tenet-health-json` has no implementable producer/consumer contract

**Exact text concerned:** definition.md line 55: "Core accepts canonical `tenet-health-json` (`kit/schemas/health-input.json`)"; AB-3, line 87: "Core ingests `tenet-health-json` and optional area adapters ... pass: valid normalized"; proposed spec changes at lines 102-105.

**Basis:** The definition specifies indicator payload fragments and a separate receipt, but not the canonical document envelope, schema version, indicator cardinality, attachment point in a verification bundle, relation between a test report and a health report, adapter output, or failure payload. Current verification is shaped around one test report per check: `src/verify/bundle.ts:13` limits `ReportKind` to test formats, `kit/schemas/bundle.json:100-142` carries a single `report` and `report_sha256`, `src/verify/run-checks.ts:83-126` creates and hashes that one report, and `src/verify/record.ts:108` converts accepted reports into `TestReport` cases. The proposed evidence changes at definition.md line 104 add fields to `measurement`, but do not define how those measurements cross the bundle/receipt boundary. An independent builder and test author would have to invent incompatible schemas, so AB-3 cannot independently prove normalization or missing-report behavior.

**Change accepted:** Specify the exact `health-input.json` top-level schema and its discriminated `scalar`/`finding_set` entries, including `schema_version`, evaluation/check identity, expected and analyzed scope, receipt fields, source format, indicator cardinality, and canonical ordering. State explicitly whether a check bundle may contain a test report plus zero or more health reports or whether a health-only check uses a new report kind. Update the bundle schema and `VerifyDeps`/reader boundaries in the definition. Give a field-by-field normalization table for canonical JSON, SARIF, LCOV, and Cobertura, plus fixtures that prove the same canonical bytes for equivalent adapters and distinct outcomes for missing, partial, mismatched, malformed, and oversized reports.

### F3 - blocker - Waiver-owner fallback is not a value in the current policy model

**Exact text concerned:** definition.md line 73: "Authorized actor = indicator `owner` -> `area` owner -> `owners[]`"; line 77: "Every pinned `checks.<name>` and `health.indicators.<name>` resolves `owner` (`indicator.owner ?? check.owner ?? area.owner`)"; AB-8, line 92: waiver authority rejects author/agent self-waive.

**Basis:** `kit/schemas/tenet-yaml.json:314-350` defines each area with `owners` as an array, not `area.owner`. Global `owners[]` is an array of structured identities with optional `forge_accounts` (`kit/schemas/tenet-yaml.json:106-132`), while a check has an optional single string owner. `src/policy/load.ts:417-486` treats area owners as a list and uses filename mapping for display; it does not define a single authorized waiver principal or the proposed fallback. A builder must choose whether `owners[]` means every global owner, the first entry, any area owner, a named owner ID, or a raw forge account. That choice directly changes who can waive a blocked regression and can turn an unresolved owner into broad authority, contradicting R-203's self-waive control.

**Change accepted:** Define owner references as a closed, typed set of policy owner IDs. Add the exact area-level owner field/list (or remove `area.owner` and define list membership precisely), require that check/indicator owner references resolve, and define empty or unknown ownership as `TN-GATE-UNKNOWN`, not global authorization. State how multiple owners combine, how `forge_accounts` and agent/bot identities participate, and which collection is used for waiver permission versus routing and display. Add no-owner, unknown-owner, multi-owner, wrong-area, self-author, delegated-agent, and bot fixtures for AB-8 and AB-10.

### F4 - should - R-178 has no bounded execution model

**Exact text concerned:** definition.md line 74: "Track every inserted non-generated source line `L_0` ... over `[M.merged_at, M.merged_at + 30d]` along default-branch history with `-M` rename following"; AB-12, line 96: the durability view "tracks line lineage" over the mature cohort.

**Basis:** A direct implementation scans a rolling 60-day integration set and follows every inserted line through up to 30 days of later history. On each main recording run, the naive version repeats Git history walks and rename/diff work for the same line. The acceptance list tests correctness fixtures but gives no complexity bound, incremental record, cache invalidation rule, timeout, or required result when the history/input budget is exceeded. `evidence/research-code-health.md:43` says CI feedback is budgeted in minutes and slow analyses should not block. This makes the feature buildable but easy to implement as an unbounded recorder cost that harms main throughput or produces stale, partially reconstructed board data.

**Change accepted:** Choose either an incremental lineage record model that advances only once per new integration or an explicitly budgeted asynchronous computation that never gates a change. Pin complexity inputs, retention/state digests, timeout/truncation behavior, and the required `unknown`/coverage result. Add a large-cohort fixture and an incomplete-state fixture to AB-12.

VERDICT: BLOCKING 3
