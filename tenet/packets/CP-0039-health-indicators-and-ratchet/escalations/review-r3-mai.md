# CP-0039 independent definition review - round 3 (MAI)

Reviewed `shape/cp-0039` at `284458b` against `origin/main` at `7400a0e`. This is a definition review of v3 and `evidence/research-code-health.md`.

## Earlier MAI findings

| Round 2 | Status | Reason |
|---|---|---|
| F1 | Maintained | ALG-15 is pinned, but the definition still leaves ALG-09's existing private diff parser outside the new shared mapper (current F1). |
| F2 | Maintained | The normalized envelope is larger, but the producer discovery and trusted-coverage boundaries remain unspecified (current F2 and F3). |
| F3 | Resolved | Owner and waiver authorization are now expressed through typed `owners[].id`, area owner IDs, and explicit unknown-owner refusal. |
| F4 | Resolved | Durability now has incremental state and explicit per-run limits, timeout, and incomplete-result behavior. |

## Round 3 findings

### F1 - blocker - ALG-15 is still not the one mapper used by ALG-09

**Exact text concerned:** definition.md lines 54-56 and AB-2 line 122: `src/specs/diff-mapper.ts` "replaces `src/specs/touched.ts:88,112-178` for `ALG-08/09/14`"; AB-2 requires the "shared" mapper but names only `src/specs/touched.ts`.

**Basis:** ALG-09's live diff attribution is not in `src/specs/touched.ts`. `src/reports/weakening.ts:164-190` privately parses `git diff --name-status -z -M`, and `src/reports/weakening.ts:191` privately parses added and removed zero-context lines with unpinned Git configuration. Those parsers feed `ALG-09`'s test deletion, skip, and tamper weakening decisions. Leaving them in place means the protected tamper path can interpret the same change differently from CP-0039 health scope, especially under hostile Git configuration, unusual paths, rename overflow, or attributed diff behavior. AB-2 and AB-9 cannot both be proved by one cross-platform mapper fixture.

**Change accepted:** Make `src/specs/diff-mapper.ts` the required data source for `src/specs/touched.ts` and `src/reports/weakening.ts`, then list both replacements in AB-2 and `ALG-15`. Delete the duplicated `fileChanges` and `diffLines` parsers. Add an ALG-09 fixture that runs the same removed-test, renamed-test, and added-suppression changes under the hostile Git configurations used by the health fixtures and requires byte-identical structured output.

### F2 - blocker - A health check cannot produce every admitted bundle shape

**Exact text concerned:** definition.md lines 66-68 and 136: `bundle.checks[]` may add `health_reports?: [{format, report, report_sha256}]`; `checks.<name>` gets the new report formats and "optional `health_reports`"; AB-3 line 123 expects deterministic normalization across formats.

**Basis:** Current verification has one configured `report` and one `report_path`: `kit/schemas/tenet-yaml.json:187-213` permits exactly one primary report, `src/verify/run-checks.ts:83-118` resolves and reads one report path, and `src/verify/record.ts:108-130` resolves one format and passes one content buffer to a reader. `health_reports[]` has no corresponding target-policy shape, path/source convention, cardinality, per-report exit/outcome, or indicator-to-area binding. The adapter rows also require canonical `indicator` and `area`, but SARIF, LCOV, and Cobertura do not inherently carry those fields. The proposed `readHealth?(format, content, context)` leaves `context` opaque, so an independent implementer cannot decide whether one raw report creates one entry, one entry per indicator, or one entry per area.

**Change accepted:** Specify an exact `checks.<name>.health_reports` policy schema with report path or stdout identity, format, check ID, indicator/area selector, and required/optional status; or explicitly remove secondary health reports and require one check per raw report. Define how `VerifyDeps.readHealth` receives target policy, selected indicator(s), area, expected scope, receipt fields, and the tested/base commits. State missing, duplicate, and unreferenced-report behavior and add fixtures for a test report plus health report, a health-only check, two indicators from one raw report, and an existing-CI bundle with an omitted secondary report.

### F3 - blocker - Enforceable completeness still comes from the producer it is meant to judge

**Exact text concerned:** definition.md lines 73-81, AB-3 line 123: native `tenet-health-json` is "enforce" eligible; `complete === true` is accepted when the tool completes and the producer's `analyzed_paths` or `analyzed_modules` covers `expected_paths` or `expected_modules`.

**Basis:** `pinned_inputs_digest` proves that declared bytes were present, and `TN-SEALED-DIRTY` proves that tracked files were not changed after execution. Neither proves which files the executable actually analyzed, nor that the report was emitted by the declared executable. A forged or subtly patched analyzer can emit `analyzed_paths` equal to every expected path and an empty findings list; the subset test then declares it complete and makes it eligible to tighten `main`. The current honest limit in `tenet/specs/tech-spec/ci.md:185-189` says a check that runs changed code can be subverted; `src/verify/run-checks.ts:83-118` only reads the produced file and exit code. The research's "Agents game any check they can see or edit" and protected-input recommendation require this boundary, so this is not fixed by hashing the report after the fact.

**Change accepted:** Separate a report's claim of coverage from a trusted producer receipt. Make an indicator enforceable or tightening-eligible only when the protected runner verifies a defined producer capability: executable/package digest, effective command/config digest, actual file-scope source, and a trusted adapter receipt. If a native JSON or SARIF producer cannot supply that capability, cap it at `observe`/`advise` with explicit `coverage_unverified`; never let self-declared `complete` or `analyzed_paths` make it enforceable. Add a forged-complete fixture where every expected path is claimed with zero findings but the trusted producer receipt proves only a subset, and require `failure` for mandatory/enforce and no tightening.

### F4 - blocker - Baseline and waiver freshness has no atomic integration-time trigger

**Exact text concerned:** definition.md lines 40, 106-107, and AB-4/AB-8 lines 124 and 128: "At `integrate` / live merge gate" stale baselines must re-evaluate; "Live open-PR gates" must flip immediately at `now >= expires_at`; expired exceptions block later intake and gates.

**Basis:** The existing recorder workflow runs on `workflow_run` and `pull_request_target: edited` (`tenet/specs/tech-spec/ci.md:118-119,135-139`). A main push can tighten `health/baseline.json`, or the clock can pass `expiry`, without another test run or PR edit. The prior head check remains on the PR and no definition step updates it. `tenet/specs/tech-spec/kernel.md:72` assigns exact candidate binding and merge-group proof to `CP-0035`; CP-0039's packet declares only `blocked_by: [CP-0024]`, and the plan row has no CP-0035 dependency. A pure integration fixture can compute `stale-baseline`, but the production path still permits the old green status to be merged. The same race affects an open PR at waiver expiry.

**Change accepted:** Define one trusted integration-time evaluation source for ordinary merges, not just a pure function. Declare CP-0035/merge-candidate capability as a dependency, or give CP-0039 an approved equivalent hook that is triggered by target pushes and before every merge. It must bind the exact candidate, target commit, current baseline snapshot and injected merge time, publish/refresh the required status, and fail closed when refresh is unavailable. Add fixtures for a green PR whose baseline tightens on `main` with no PR push, and a waived PR that waits past `expiry` without an edit; both must be refused before integration.

### F5 - should - R-178 consumes an undefined CP-0037 dependency

**Exact text concerned:** definition.md line 110 and AB-12 line 132: durability joins `{agent_definition, work_type}` from CP-0037, while missing attribution is reported as `"unknown"`.

**Basis:** `tenet/specs/plan/0.1.x.md:23,25` gives CP-0037 and CP-0039 independent rows with no Needs relationship, and `CP-0039/packet.yaml` is blocked only by CP-0024. CP-0039 does not define the event fields, identity types, or precedence used to derive `agent_definition`. A builder can make every attribution `unknown` and satisfy the stated missing-attribution fixture without implementing the required grouping of attributed work, while a separately built CP-0037 may choose an incompatible shape.

**Change accepted:** Add CP-0037 as an explicit dependency in the packet/build contract, or copy the exact owned input contract CP-0039 consumes. Add known-human, known-agent, mixed, and conflicting-attribution fixtures; report unknown only when that source is absent or incomplete, not merely because CP-0039 deferred the join.

### F6 - should - Area noise is routed to a policy-list accident

**Exact text concerned:** definition.md lines 102-104 and 114: waiver authority has a 1-of-N set of area owners, but counters route to `areas[area].owners[0]`.

**Basis:** `R-177` assigns check and indicator ownership; the owner list is a set for authorization, not a declared primary-owner order. Choosing element zero makes notification and accountability depend on YAML ordering and gives the first owner all counter volume even when another owner is responsible for the check. Reordering a policy owner list can therefore change routing without changing any stated health rule.

**Change accepted:** Define the owner route as a canonical set, an explicit primary-owner field, or a deterministic check/indicator owner lookup that all members share. Add a two-owner fixture proving that list order cannot change the routed owner or that each owner receives the same canonical event.

VERDICT: BLOCKING 4
