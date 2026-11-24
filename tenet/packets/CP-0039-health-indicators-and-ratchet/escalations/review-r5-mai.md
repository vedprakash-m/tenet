# CP-0039 independent definition review - round 5 (MAI)

Reviewed `shape/cp-0039` at `fc70253` against `origin/main` at `7400a0e`, including `response-r4.md`, MAI reviews r2-r4, and the CP-0060-CP-0064 stubs.

## Earlier MAI findings

### Round 2

| Finding | Status | Reason |
|---|---|---|
| F1 - ALG-15 determinism | Resolved | v5 isolates Git/system/global/attribute inputs and adds the red-team `.gitattributes -diff` case. |
| F2 - health producer/consumer contract | Deferred (accepted) | The advanced secondary-report/multi-report shape is removed from core and the retained finding is carried to `CP-0061`; core now admits one raw report per check run. |
| F3 - waiver owner model | Resolved | v5 uses closed `owners[].id` references and explicit `TN-GATE-UNKNOWN` / quorum behavior. |
| F4 - unbounded durability execution | Deferred (accepted) | `R-178` is removed from core and carried with the lineage finding to `CP-0060`. |

### Round 3

| Finding | Status | Reason |
|---|---|---|
| F1 - ALG-15 did not cover ALG-09 | Resolved | `ALG-15` now replaces both `touched.ts` and `weakening.ts`. |
| F2 - secondary report production | Deferred (accepted) | Secondary report and matrix production are no longer claimed by core and are carried to `CP-0061`. |
| F3 - self-attested completeness | Deferred (accepted) | CP-0039 explicitly keeps subject-executed checks at the `ci.md §5` honest limit; protected per-unit supervision is carried to `CP-0064`. |
| F4 - integration-time freshness trigger | Deferred (accepted) | `CP-0063` owns merge-time atomicity and signed exception/recovery replay; CP-0039 documents evaluation-only waiver behavior. |
| F5 - undefined CP-0037 dependency | Deferred (accepted) | Durability and its CP-0037 input are moved to `CP-0060`. |
| F6 - owner-list routing order | Resolved | Noise routing uses an order-invariant sorted owner set. |

### Round 4

| Finding | Status | Reason |
|---|---|---|
| F1 - `.gitattributes` can bypass the mapper | Resolved | `--text`, attribute/config isolation, raw NUL classification, protected `.gitattributes`, and the deleted-test fixture address the concrete bypass. |
| F2 - matrix completeness lacks a shard manifest | Deferred (accepted) | Matrix and multi-run semantics are removed from core and preserved with the shard-manifest requirement in `CP-0061`. |
| F3 - finding-set regression math was undefined | Resolved | v5 defines `finding_set.scope_digest`, indicator-wide `excess_total`, and no cross-key masking. |
| F4 - durability state could not reproduce lineage | Deferred (accepted) | The complete lineage issue is carried verbatim to `CP-0060`, and durability is no longer in CP-0039's acceptance items. |

## Round 5 findings

### F1 - blocker - Paired `touched_lines` credit has no base-side input contract

**Changed text concerned:** definition.md lines 40 and 44, and AB-1/AB-5 lines 60 and 64: `touched_lines` may become enforce-eligible when "paired `<diff_base>` evidence is supplied", old hunks are paired and credited "bounded by `allowed_counts[k]`", and AB-5 requires a "harmless edit inside paired range" fixture. This is new round-5 text and preserves no base-occurrence data in the declared one-report `health-input.json` contract at line 45.

**Concrete inputs:** A committed baseline permits one `fp_key K` in `src/a.ts`, but that allowed occurrence is at unchanged line 100. A PR edits lines 20-21 and introduces a new occurrence with the same `K` in the new hunk. The current report contains one `K` in the edited hunk. The target policy is `max_new: 0`, and the indicator is configured as paired `touched_lines`.

**Wrong outcome:** Because the only declared baseline input is the global `allowed_counts[K] === 1`, one implementation can subtract that allowance inside the edited hunk and pass the new occurrence. The correct baseline-relative outcome is a regression: the allowed occurrence remains elsewhere at line 100, so the hunk created a second occurrence. Conversely, a separate case where the one allowed occurrence was inside the old hunk should pass, but the declared report has no base-hunk occurrence map or old report digest with which an independent implementation can distinguish the two cases. AB-5's paired fixture is therefore not independently constructible.

**Change accepted:** Either:

1. extend `health-input.json` and the bundle with an explicit canonical base/head occurrence map keyed by diff hunk (`old` and `new` findings, base/tested commits, report digests, and scope), and define one-to-one multiset matching between occurrences in that map; or
2. cap **all** `touched_lines` findings at `advise` in CP-0039, remove the paired enforce path from AB-1/AB-5, and defer enforceable paired-hunk comparison to a named split packet with the required input schema.

The concrete acceptance fixture must include both inputs above and require different verdicts.

VERDICT: BLOCKING 1
