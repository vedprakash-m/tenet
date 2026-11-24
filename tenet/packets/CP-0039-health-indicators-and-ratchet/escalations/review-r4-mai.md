# CP-0039 independent definition review - round 4 (MAI)

Reviewed `shape/cp-0039` at `8d6aec7` against `origin/main` at `7400a0e`. This is a definition review of v4 and `evidence/research-code-health.md`.

## Earlier MAI findings

### Round 2

| Finding | Status | Reason |
|---|---|---|
| F1 | Maintained | The global Git options are pinned and both consumers share the mapper, but subject-controlled attributes can still change what that mapper sees (current F1). |
| F2 | Resolved | `health-input.json`, secondary report slots, reader context, and adapter normalization are now described. |
| F3 | Resolved | Typed owner IDs, closed fallback, and unknown-owner refusal are defined. |
| F4 | Resolved | Durability has explicit run limits and asynchronous, non-gating behavior. |

### Round 3

| Finding | Status | Reason |
|---|---|---|
| F1 | Resolved | `ALG-15` now replaces the private parsers in both `src/specs/touched.ts` and `src/reports/weakening.ts`. |
| F2 | Resolved | The primary and secondary health-report policy shapes and `VerifyDeps.readHealth` input are now concrete. |
| F3 | Resolved | Trusted runner receipts distinguish supervised actual scope from self-declared coverage. |
| F4 | Resolved | CP-0035 supplies the integration/expiry hook and CP-0039 now declares that dependency. |
| F5 | Resolved | CP-0037 is an explicit dependency and its consumed attribution record is named. |
| F6 | Resolved | Owner routing is an order-invariant sorted set rather than `owners[0]`. |

## Round 4 findings

### F1 - blocker - The shared mapper remains writable through repository attributes

**Exact text concerned:** definition.md lines 57-58 and AB-2 line 104: the pinned invocation uses `--no-ext-diff --no-textconv --no-color -M50%`, but does not force text diffing or ignore attribute sources.

**Basis:** Git still consults repository `.gitattributes` and applicable attribute configuration when deciding whether a path is treated as text or binary and which diff driver applies. A PR can mark a changed or test file with `binary`, `-diff`, or a custom diff attribute while the definition's R-103 table at lines 82-83 treats `.gitattributes` only as a non-`protect` diagnostic change. The resulting `--unified=0` output can contain no line hunks for a removed test or a health regression, so the shared mapper reports clean scope even though bytes changed. This defeats both `ALG-09` and `R-175`, and an agent can choose that route after seeing the check. Current parsing still exists in `src/specs/touched.ts:87-143` and `src/reports/weakening.ts:164-230`, with `src/core/git.ts:11` applying only `core.quotepath=false`; none of those layers pins attribute behavior.

**Change accepted:** Define the mapper's attribute isolation explicitly. Force a reproducible text comparison for all tracked blobs (for example, a pinned `--text` path), disable hostile global attribute files/configuration, and decide how paths containing NUL or genuinely binary data are classified. Put `.gitattributes` and equivalent mapper-input attributes in the protected or health-tamper class. Add a red-team fixture where a PR removes a failing test while changing an applicable `.gitattributes` entry, and require identical mapper output and the same weakening finding across all three operating systems.

### F2 - blocker - Matrix completeness has no expected-shard identity or scope assignment

**Exact text concerned:** definition.md line 77 and AB-3 line 105: `"matrix-agree"` requires "all expected shards" and `"matrix-distinct"` requires disjoint shard `scope_globs` whose union covers expected paths, while the only policy shape added at lines 69-71 is a report slot with `{id, format, report_path, indicators, required?}`.

**Basis:** Neither `shard_mode` nor the bundle shape declares what shards are expected, which `run.job/index` values belong to an indicator, or which scope each shard owns. Current `kit/schemas/bundle.json` records no matrix manifest; `src/verify/record.ts:91-105` can reject an observed duplicate `(job,index)`, but it cannot detect an omitted artifact because it does not know the expected cardinality. "All expected shards" and "disjoint shard scope_globs" are therefore inputs that no builder can construct or test independently. AB-3's "shard-conflict/overlap" cases omit the central missing-shard case, allowing a hostile or broken matrix to submit one convenient shard that covers a subset and have it accepted as the whole authoritative producer.

**Change accepted:** Add a protected target-policy matrix contract, for example an ordered shard manifest with stable `shard_id`, `run.job/index` or matrix-axis mapping, `scope_globs`, and required/optional status; or require a trusted workflow receipt that supplies the same manifest. Bind each health report to one manifest shard, reject unknown or duplicate shard identities, require the exact expected set for `matrix-agree`, and require pairwise disjoint canonical scope plus complete union for `matrix-distinct`. Add fixtures for a missing last shard, an extra shard, swapped shard scopes, overlapping scopes, and conflicting complete reports under a fixed manifest.

### F3 - blocker - Finding-set regression math is still undefined

**Exact text concerned:** definition.md line 27 requires a `BaselineEntry.scope_digest`; line 49 declares `finding_set.max_new` but no comparison unit; lines 62-64 say to evaluate touched and area multisets; AB-4 and AB-6 lines 106 and 108 promise baseline reconciliation and finding-set regression fixtures.

**Basis:** The only exact `scope_digest` formula is for `population: "area"` scalars at line 47. A `finding_set` has `touched_lines`, `touched_files`, or `area`, plus a rule/check/report binding, yet the definition never says how its digest represents stable membership. The same problem applies to `max_new`: one can apply it per `fp_key`, per `(path, fp_key)`, per file, per area, or to the indicator total, producing different verdicts and different ways to game duplicate fingerprints. `current[fp_key] > allowed_counts[fp_key]` at line 64 also omits the policy tolerance entirely. The requirement cannot be independently tested while the central pass predicate is absent, and full-area `finding_set` tightening cannot be compared safely without a stable digest.

**Change accepted:** Define one exact `scope_digest` formula for each finding-set scope, using target-owned policy membership and stable check/report/rule identity without hashing the current PR diff or evolving file list. Define the regression predicate as an exact integer formula, including whether `max_new` is per occurrence group or one indicator-wide allowance, and whether different fingerprints can consume a shared allowance. Specify ordering, deduplication, denominator-zero/not-applicable behavior, and the condition under which a permitted tolerance is retained or tightened on `main`. Add identical fixtures for duplicate `fp_key` occurrences, one new issue in each of two files, two fingerprints in one file, a scope-glob change, and sequential PRs that consume the same allowance.

### F4 - blocker - The durability state cannot reproduce lineage or late backfills

**Exact text concerned:** definition.md lines 91-92 and AB-12 line 114: `durability-state.json` stores only dated aggregate buckets plus `{processed_head, pending_gaps}` while it must attribute later rewrites to earlier inserted lines, preserve renames, and join CP-0037 records whose absence is currently reported as `unknown`.

**Basis:** Aggregate counters do not identify which surviving line belongs to which original `(integration, agent_definition, work_type)` bucket. When a later commit edits or deletes that line, a builder must know its origin, but `buckets[date][agent][type]` contains no line identity or reverse index. A late `work.integrated` timestamp or CP-0037 attribution also requires moving earlier counts out of the fallback timestamp/`unknown` bucket; aggregate state has no per-work data from which to subtract and reclassify them. Advancing `processed_head` across that history loses the only opportunity to produce a correct mature cohort. The bounded state and its recovery semantics are therefore not sufficient to satisfy "incremental and full-history runs" or the late/missing attribution cases named in AB-12.

**Change accepted:** Specify the complete versioned durable lineage schema, including stable per-line or per-diff-unit origin records, the dated cohort key, rename lineage, rewrite-once state, and an index from work/integration commit to all affected counters. Define idempotent reclassification when `work.integrated` or CP-0037 attribution arrives after a fallback, and define which checkpoint advances on budget stop, oversize gap, and backfill. Require incremental-versus-full replay fixtures with a delayed integration event, delayed human-to-agent attribution, an attribution conflict, a rename then rewrite, and more than 250 commits before claiming `AB-12`.

VERDICT: BLOCKING 4
