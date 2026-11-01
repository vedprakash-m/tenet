# Implementation reassessment and delivery order

October 31, 2026. **Local source audit and repair; R1 remains incomplete.**

## What the evidence establishes

The checkout started clean at `2855576`. The unchanged source passes full `npm run ci`: **1,238 tests, 202 suites, zero failures/cancellations/skips**. The initial sandboxed run cannot inspect process start identities and consequently refuses transaction admission; it is not evidence of a product regression. The successful baseline uses the OS access required by the existing real-process tests.

The [200-row inventory](requirements-current.md) refreshes all Must/Should requirements due through R1 from the live PRD, structural mapping, test-file hashes and source budgets. Its semantic recommendations retain explicit [October 28 provenance](../2026-10-28/requirements.md). This pass directly traces authentication/admission, transactions, schema definitions, budget recovery, private-store admission, pipeline rendering, check identity/verdict inputs and the current protocol/capacity reviews. It does not independently re-prove every assertion in every earlier audit. No audit can establish that all possible defects have been found.

| Cumulative milestone | Musts | Test-tag mapped | Host buckets | Unmapped | Qualified |
|---|---:|---:|---:|---:|---:|
| M0 | 34 | 30 | 4 | 0 | 0 |
| Alpha | 100 | 90 | 9 | 1 | 0 |
| Beta | 158 | 113 | 13 | 32 | 0 |
| R1 | 181 | 115 | 16 | 50 | 0 |

The evidence ledger still has **zero records**; all 19 Should dispositions remain open. The 115/181 mapping ratio is about 64%, but it is **not a completion percentage**. Mapped requirements may have incomplete consumers; host buckets are pending evidence, not exemptions. `npm run ci` gates M0 structural mapping, not all R1 acceptance criteria. R1 coverage correctly exits nonzero for the 50 unmapped Musts.

## Implementation and remaining gaps

| Workstream | Useful implementation | Exact remaining work / evidence |
|---|---|---|
| Kernel and safety | Single pipeline, six ports, pure verdict/budget, bounded inputs, guarded effects, Git/index preservation, real crash/process tests | Full effective configuration identity, atomic all-work invalidation, typed check-versus-operation launches, every retry/ordinal's ownership and usage, stale-result accounting and completion-versus-proof separation |
| Configuration/migration | Typed settings, restrictions, safe unsupported-execution refusal, schema-1 admission bridge, reviewed protocol/capacity documents | Finish fixed-budget feasibility and final mechanism sign-off; strict actual-producer decoding, finite migration prefixes, consistent backup set, recovery floors, reconfirmation, pristine rollback, recovery-set forgetting; no schema-2 activation yet |
| Evidence and checks | Behavioral red/green, preservation/lock controls, Vitest/static/Playwright receipts, rerun/flaky handling, input/version invalidation | Sealed neutral-tree producer, complete failure-kind/signature equivalence and individual excluded-failure reporting, committed-tree checks, Jest/audit matrix, complete browser/toolchain closure and safe configured execution |
| Intent and continuity | Stable IDs, confirmed basis, plans, decisions, adoption previews, lessons, pause/resume and local forget recovery | Reprojection after adoption, safe external block reconciliation, architecture/hardening and MADR projection, ID-aware integration, loss reconstruction without invented grants/proof, aggregate retention with protected evidence |
| Review/resources/UX | Fresh-review gates, focused/recheck chains, Deep architect/security gates, counters, status/impact/handoff | Native isolation/tool limits and cancellation proof; dispute/lifecycle consumers; Serial/Conserve behavior; durable launch accounting; personal preferences after storage spike; approval friction and formative UX evidence |
| Starter | Neutral React/Fastify/SQLite platform, auth/CSRF, real account and fixture-only loan journeys, OpenAPI generation, backups/restore, schema-history and concurrency tests | Authentication write-boundary race repaired in this increment; API compatibility/semver consumers, changed-journey obligations, manual accessibility receipts, ASVS applicability/results, workload receipts/trends/attention and remaining performance qualification |
| Performance | Approved independent admission, bounded page queries and transaction deadlines, executable full-size isolated workload | Retained Node 26 RSS failure remains open. Statement reuse is an unaccepted experiment; performance after the new transactional reads is unmeasured. No fresh workload or reference-hardware qualification is claimed by this increment |
| Evaluation | Ten public fixtures, offline validation/replay/report helpers, negative controls | Full pipeline/port replay; protected/native capture; 30 public and 10 reserved tasks; successive changes and ablation campaigns; frozen protocol, account enforcement, spend/isolation limits and campaign authorization |
| Host/humans | Partial historical observations, plugin/skills/agent definitions | Exact supported tuple and outstanding SP-01/02/03/04/05/06/07/08/10/11/12 dispositions; installation/update/removal and permissions; six formative sessions, accessibility observations and counterbalanced pilot. Exhausted historical authorizations do not authorize new host/model calls |
| Release | Explicit payload, hashes, same-source double-build checks, draft notices/docs and CI security checks | Corrected remote CI observation, independent clean rebuild, installed integrity/lifecycle, final publisher/support/permissions docs, complete dependency notices, source/history privacy, signed tag/provenance, accepted Must evidence/Should omissions, published risks and release approvals |

Safe refusals, generated schemas and draft designs are not completed workflows. Historical repaired defects in the previous audits must not be relisted as currently open. The [October 29 reassessment](../2026-10-29/reassessment.md) and [source audit](../2026-10-28/report.md) retain the earlier counterexamples and repairs.

## Newly reproduced mistakes and repair

**AC-16 / QLT-12: request admission freshness did not extend through authentication writes.** The application refreshed `req.actor` transactionally, but sign-in and password replacement retained user/session snapshots while asynchronous scrypt ran and while the final write retried. Twelve tests fail against the unchanged implementation:

- Sign-in authenticates an obsolete password or obsolete email, returns an obsolete role, or raises 500 after a concurrent user deletion.
- Password replacement overwrites a concurrently changed password, recreates authority from a revoked or expired session, or returns an obsolete role.
- Two real concurrent password requests can both acknowledge replacing the same old password; the later request invalidates the earlier success.
- A real `SQLITE_BUSY` retry can publish after an independent writer changes the password and revokes sessions.

Recipe **0.4.1** reads current user/credential identity inside the final sign-in transaction. Password replacement rechecks the signed live session, expiry and verified password hash inside its final transaction. Both return the current user projection. A rejected transaction issues no replacement cookie and preserves the concurrent writer's password/session state. Current-password verification and new hashing remain outside the write transaction; existing hashing work/queue, quotas, DTOs, status vocabulary and absolute retry deadline remain intact.

Tests use actual scrypt, a second SQLite connection, real transaction contention, persisted-state checks and parallel HTTP injection. Driver instrumentation only observes real reads/errors and places independent writes at deterministic boundaries; it supplies no fake authentication result. Existing source and built journeys must still run every browser case and the full starter suite. Neutral/evolved expected app populations increase from **89/116 to 101/133**; browser populations remain **12/16**.

**The same stale actor affected loan writes.** Five further old-source failures reproduce reserve/return after revocation or idle expiry and an admin returning another member's loan after demotion during an actual held-writer retry. The existing session module now exposes `refreshActor` for an earlier trusted actor, reusing its existing session/user/expiry inspector. Loan services call it and authorize inside every immediate transaction attempt; their supplied application clock is read again on retry. Reserve also reads its item and forms its DTO in the transaction. Rejected operations preserve every loan byte and foreign keys. The common error handler clears a presented invalid session cookie when authority expires or is revoked after initial admission; the absent-cookie status path remains cookie-free. The template's architecture guidance describes this pattern for future features. All **17 targeted regressions** pass with real hashes/SQLite, types and lint.

**Progress wording also remained stale.** Earlier dashboard notes still said current admission validation was open after publication validated it, and the local admission report still described committed source as uncommitted. This new checkpoint controls current work; earlier observations remain historical. Source validation and host/release qualification remain separate.

## Efficient completion plan, with fixed budgets

The owner explicitly selected **keep every budget fixed and pursue larger behavior-preserving simplification**. The [fixed-budget work plan](../../../specs/fixed-budget-simplification.md) replaces the earlier recommendation to seek additional capacity. No cap, matcher, ratchet, instruction limit or bundle limit changes in this increment.

| Order | Deliverable / implementation homes | Binary exit and dependency |
|---|---|---|
| 1 | Stabilize present behavior: auth repair, `starter.test.ts`, loan golden journey, payload and tracker | Seventeen old-source failures become passes; complete CI, built CLI neutral/evolved journeys, types/lint and unchanged security/browser assertions pass. Record exact identities and remaining limits |
| 2 | Fixed-budget simplification of existing schema/central/store/accounting responsibilities | Concrete replacement candidates, equivalence tests and actual measurements fit **all** owners and the complete protocol; no shifted ownership or deleted safeguards. Small savings alone do not pass. Final mechanism review/sign-off still precedes activation |
| 3 | Shared protocol as complete vertical slices in existing owners | Config preview/confirm/persist/readback/invalidate/restart; every launch producer/retry and proof consumer; real kill/stop/settlement/rollback/forget matrix. No partial schema activation or legacy-proof relabeling |
| 4 | Continuity: shared projections, adoption/external edits, stable-ID merge, reconstruction and retention | Preserve every unowned byte; malformed/ambiguous input refuses; recovery never invents authority/evidence; aggregate limits retain protected records. Depends on the shared publication/recovery protocol |
| 5 | Sealed materialization, classification and optional committed checking | Exact neutral trees and dependency identity, bounded links/filters, owned cleanup and real crash controls precede failure equivalence/exclusion reporting. Apply only the already authorized cut list if required; preserve narrowed claims |
| 6 | Resource/result and starter quality consumers | Required independent review survives every resource mode; actual launches count once; changed journeys/manual receipts/API compatibility/workload trend attention each have real workflow tests. Performance targets pass on the specified tuple without weakened crypto/quotas or omitted samples |
| 7 | Native/human qualification | Separately authorized exact tuple, host/loading/permissions/lifecycle evidence, expanded public/reserved campaigns, successive changes, ablation, formative sessions and pilot. No source-only substitute |
| 8 | Release | Every Must accepted on every supported tuple, all Should dispositions, published limitations, independent rebuild/installed verification/privacy/notices/provenance and explicit product/release approval |

Keep one shared-contract writer and one active implementation slice. Reuse existing test homes and current mechanisms. Do not combine migration, sealed execution, shared-file projection and new quality consumers into an unreviewable change. The [requirement inventory](requirements-current.json) supports per-AC review; do not populate the authoritative ledger merely to make counts look better.

## Final local verification

Full repaired-tree CI passes **1,238 tests/202 suites**, zero failures/cancellations/skips, including all existing structural, quality, build, payload and repeat-build gates. Node **26.3.0 and 22.12.0** each pass **149 built CLI acceptance scenarios** and the complete shipped-CLI feature journey: **101 app/12 browser** cases in the neutral platform and **133 app/16 browser** cases after evolution. The kernel bundle remains **776,837 bytes**, SHA-256 `77378e987b04abbe05799d064b425d15716c7698af87865d246895b3a3093ecb`; the full payload has **92 files**. Kernel source and lockfiles are unchanged. [Exact source/log/artifact identities and limitations](validation.json); retained [current](authority-uat-current.json) and [minimum](authority-uat-minimum.json) UAT observations.

## Current boundary

The authentication repair is implemented locally; final validation is recorded in [validation.json](validation.json). The full product has **not** been implemented or qualified. A complete within-budget simplification/target candidate has not yet been demonstrated; this is unresolved engineering work, not permission to raise limits. Host/human/account/release prerequisites also remain open. No commit, push, native spike, campaign, recruitment or release is performed by this increment.
