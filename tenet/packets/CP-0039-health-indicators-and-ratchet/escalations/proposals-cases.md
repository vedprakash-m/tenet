# CP-0039 conformance output questions

The independent suite is pinned to the approved `definition.md` v6 (`dd03350`) and the Owner answers at `da7a89c` on the spec branch. The Owner confirmed the split, `forge-verified` waive at `assure`, 30-day default expiry, information-only dogfooding, source maps and protected `.gitattributes`. The questions here concern exact fixture inputs or outputs the definition and those answers leave open. The affected cases contain inputs and have no `expected.json`.

## Q1. SARIF metadata binding and admission

**Cases** `p09-sarif-enforce`, `n07-second-sarif-run`.

Definition lines 45 and 62 require completeness and scope metadata and processing every SARIF run. Which result/run property paths carry the Tenet coverage and scope claims? What is the exact admitted set if the first run is complete and the second is incomplete or uses another declared scope?

Proposed answer. Pin a single versioned SARIF run properties mapping for `coverage` and `scope_digest`, require comparable admitted run scopes, normalize all results in deterministic order and keep `<base>` tool identity. Specify the error for a missing or inconsistent run property before publishing the expected files.

## Q2. Report limits

**Cases** `n13-report-limit`, `n14-report-limit`, `n15-report-limit`.

Definition line 62 inherits the limits in CI §3. Does `50 MB` mean 50,000,000 or 52,428,800 bytes for a raw report, what tree node starts depth counting, and which items count toward the aggregate limit? Which exact code belongs to raw parse refusal versus refusal of the containing bundle?

Proposed answer. Record byte units and inclusivity explicitly, count the root as depth 1, and pin which normalized facts count. Use `TN-REPORT-MALFORMED` for inside-report shape/limit violations and `TN-RECORD-BUNDLE` for package-level size or aggregate violations if that matches the recorder contract.

## Q3. Conflicting architecture module map

**Case** `n31-conflicting-module-map`.

Definition lines 32 and 65 name `TN-HEALTH-PROVENANCE` for mismatch and require a conflicting-map fixture. `architecture_graph.modules` is a list of module IDs. Where may a conflicting producer definition appear, and does a forbidden extra mapping field fail schema validation before provenance comparison?

Proposed answer. Distinguish shape refusal for a forbidden producer mapping from provenance refusal for a permitted, mismatching map digest. Accept a contemporaneous digest only if the normalized report contract actually defines it.

## Q4. Waiver for another evaluation

**Case** `n39-waiver-wrong-evaluation`.

Definition line 50 limits a waiver to its bound evaluation. What exact status, finding code and reason does the current evaluation expose when a valid older waiver is present but inapplicable?

Proposed answer. Keep the older decision as an observation, retain the current unwaived regression, and expose a stale-evaluation reason where the shared decision contract permits it. No gate credit for the older waiver.

## Q5. Exact proof-card rendering

**Cases** `p37-card-unconfigured`, `p39-card-at-limit`, `p40-card-overflow`, `p41-card-shared-head`.

Definition lines 53 and 69 give the summary line, block order, storage and preservation of the CI conclusion. Specify the exact empty/unconfigured rendering, boundary counting and host overhead, overflow record path and bytes, and the link/pointer line. The all-unknown case asserts the already specified summary line independently.

Proposed answer. Omit the health section when unconfigured. Count characters at the established CI §4 boundary, retain essential lines at equality, persist full overflow bytes and freeze a bounded pointer template. Use the shared-head ordering and budget from CI §4. Apply these choices to the exact card goldens before closing the four cases.
