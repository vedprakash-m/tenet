# Implementation reassessment and next delivery sequence

Date: October 29, 2026. Status: **local reassessment; not qualification**.

## Assessment and evidence boundary

Tenet has a substantial deterministic kernel and a locally exercised starter application. It is not a completed R1 product. Preserve the existing architecture and complete its missing consumers and cross-boundary workflows; a rewrite would discard useful preservation and recovery behavior.

At the start of this reassessment the checkout was `main` at `8b7bbc4190fc76599b51e1fcfe50f23947a2963c`, with extensive uncommitted changes. Those changes were preserved. Upstream CI for that commit does not validate this local tree. The reassessment itself authorized no commit, push, branch change, native spike, paid evaluation, participant recruitment or release publication. Subsequent owner-authorized publication is recorded below.

This pass refreshes the canonical requirement/verdict/evidence/starter contracts, current plan, previous all-200 inventory, approval records and current implementation. Direct source checks concentrate on check identity, verdict production, configured-check admission, obligation composition, schema admission, forgetting, session/admission freshness and workload measurement. The [October 28 source audit](../2026-10-28/report.md) and [200-requirement inventory](../2026-10-28/requirements.md) supply the broader prior review. This is not a new proof of every path or an assurance that no further defects exist.

## Measured progress

| Cumulative milestone | Musts | Test-tag mapped | Host buckets | Unmapped | Qualified |
|---|---:|---:|---:|---:|---:|
| M0 | 34 | 30 | 4 | 0 | 0 |
| Alpha | 100 | 90 | 9 | 1 | 0 |
| Beta | 158 | 113 | 13 | 32 | 0 |
| R1 | 181 | 115 | 16 | 50 | 0 |

The current `node tools/coverage.ts --milestone R1` reproduces 115/181 structural mapping and exits nonzero. Its semantic dispositions remain unreviewed. The authoritative `docs/audits/evidence-ledger.json` has no records. All 19 cumulative Shoulds still need evidence or individual signed omissions. These numbers are not a percentage of application completion: mapped requirements can be partial, and unmapped requirements can have useful unaccepted implementation.

| Area | Implemented or locally exercised | Still incomplete |
|---|---|---|
| Kernel and safety boundaries | One pipeline, typed ports, pure verdict/budget logic, bounded receipts, locks, guarded Git/effects, real crash/process tests | Complete effective inputs, launch accounting, safe configured execution, migration and reconfirmation |
| Evidence workflow | Planned behavioral red/green, preservation and lock controls, stale-proof rejection, static and Playwright receipts, output-definition repair | Neutral sealed baselines, failure signature classification, committed-tree execution, full browser/toolchain identity |
| Continuity | Basis/intent IDs, plans, decisions, adoption previews, lessons, pause/resume, local crash-safe forget repair | Full shared projections/MADR lifecycle, ID-aware integration, loss reconstruction, complete retention |
| Review and resources | Fresh-review gates, coverage/recheck chains, Deep architect/security gates, budgets and usage limits | Native isolation/cancellation qualification, disagreement/lifecycle consumers, full Serial/Conserve behavior, wait-separated and durable launch accounting |
| Starter application | Auth/session/CSRF, SQLite invariants, account UI, generated loan UI, real browser/axe/keyboard cases, OpenAPI generation, prior-data upgrade/backup/restore | API compatibility consumers, changed-journey/manual evidence, ASVS applicability/results, workload/trend/attention integration |
| Performance and admission | Approved policy A implementation, bounded page queries, absolute transaction retry deadline, executable full-size workload, passing source/built integration gates | Current-runtime memory target remains failed in retained observations; reference-hardware qualification |
| Evaluation and host | Offline validation/replay/report helpers and ten public fixtures; partial historical host observations | Full pipeline replay, native/protected driver and campaigns, 30 public/10 reserved fixtures, exact-host feasibility, human studies and improvement experiment |
| Release | Build/payload/repeat-build checks and draft notices | Independent clean rebuild, installed integrity/lifecycle, complete notices/policy, source/history privacy audit, publisher/provenance, public review and release approval |

## Gaps and mistakes to fix systematically

1. **Progress descriptions are stale and contradictory.** The dashboard's October 27 "Current focus" still describes approved store/forget implementation as waiting for POSIX; the current local source and later evidence contain those repairs. Its development-environment sentence describes a Windows session, not this macOS session. Section 12.12 G says "not started" while the starter UI, OpenAPI and workload tooling exist locally. Retain historical evidence, but clearly label it historical and make the current ordering authoritative.
2. **Passing gates are narrower than R1.** `npm run ci` gates M0 structural mapping. It does not complete the R1 semantic ledger, native campaigns, manual accessibility, Should dispositions or release chain. Do not create tags or ledger approvals merely to increase the reported count.
3. **Check identity is still only a partial execution contract.** `verbs/facts.ts#checkInputId` includes obligation definitions and toolchain identity, but its envelope remains a fixed Vitest description. Unsupported configured semantics are blocked by `unsupportedExecution`, which is the correct current restriction. Complete binding and every execution consumer together before widening support.
4. **Classification plumbing is not a sealed-baseline producer.** `facts.ts#verdictInput` supplies empty `baselineFailures` and `excludedScope`; `check.ts` refuses committed-tree checking. Existing pure verdict tests cannot establish production failure classification. Failure-kind/message equivalence and final excluded-failure reporting remain explicit AC-27 gaps.
5. **Declared schema/obligation kinds are not implemented workflows.** Schema-1 admission is still literal; workload/manual kinds and `manual-affected` categories exist, but ordinary recipe composition adds static checks and one global Playwright obligation. That does not implement schema migration, changed-journey selection, a manual-receipt workflow or workload trends/attention.
6. **Recovery repairs are valuable but do not complete recovery.** The shared forget completion now journals, purges and publishes twice, with recovery tests. Backup reconfirmation, target migration/rollback, cumulative evidence/accounting floors and all launch ownership/settlement consumers remain separate unfinished work.
7. **Performance closure is still open.** Earlier admission failures and memory failures must remain visible. The approved policy repairs legitimate-user admission; page-bounded SQL removes a reproduced allocation defect. Neither proves the remaining Node 26 RSS target. Statement reuse is only an experiment until measured; do not lower hashing work/concurrency, force GC, omit high samples or change thresholds to pass.
8. **Application quality evidence is incomplete despite the real UI.** OpenAPI generation does not enforce compatibility; axe/keyboard checks do not establish screen-reader behavior; a successful loan fixture does not establish ASVS/WCAG conformance across generated applications. Preserve the domain fixture/platform separation.
9. **Shared-contract capacity is a real implementation constraint.** The latest protocol review records almost no spare capacity in the central shared group, schemas and budget module. A reviewed simplification and measured target estimate are prerequisites, not justification to move code outside measured owners or raise caps silently.
10. **Host and release prerequisites remain real work.** Historical SP-08 authority is exhausted. Separate authorization is required for named spikes, account/capture operations and campaigns. No source test substitutes for the installed tuple or real participants.

The [source audit](../2026-10-28/report.md#reproduced-defects-and-local-repairs), [continuation repairs](../2026-10-28/report.md#continued-counterexample-repairs) and [current admission findings](admission-findings.md) retain reproduced counterexamples and exact limits. Their repaired defects must not be relisted as currently unfixed. Conversely, safe refusals must not be reported as completed capabilities.

## Efficient implementation order

Keep one shared-contract writer and one bounded implementation slice active. Do not merge the four old worktrees wholesale.

| Order | Work | Pass/fail exit |
|---|---|---|
| 1 | Stabilize the approved local admission/performance slice and reconcile the plan | Current source CI, built CLI and evolved feature journey pass on current/minimum Node; exact artifact/evidence recorded. Failed workload targets remain explicit. No qualification inferred |
| 2 | Finish the configuration/migration contract review and budget feasibility | Disposition CR-1 through CR-9 in the [protocol packet](../2026-10-28/protocol-review.md), specify any missing representation, measure within-cap simplification/target and obtain final owner sign-off |
| 3 | Implement the signed shared protocol in vertical slices | Preview/confirm/persist/readback/invalidate/restart compose; all primary/static/e2e/rerun/port-retry launches and stop/recovery/settlement paths participate; real crashes never revive proof or lose usage |
| 4 | Complete continuity in dependency order | Shared projections/adoption, external edits, ID-aware merge, reconstruction and retention preserve unowned bytes and never invent grants/receipts |
| 5 | Complete sealed materialization before classification and committed checks | Exact neutral trees, owned cleanup, bounded dependency/filter/link handling, exact failure equivalence, required committed obligation coverage and kill/retry controls |
| 6 | Complete resources/results and application-quality consumers | Required review survives resource modes; accounting includes interrupted launches; demos match confirmed examples; changed-journey/manual/workload/API compatibility consumers have real workflow tests |
| 7 | Observe the authorized installed host, then freeze qualification | Exact tuple, loading/permissions/dispatch/stop/install evidence; all required public/reserved tasks, negative controls and successive changes; human studies and maintainer experiment |
| 8 | Finish the release chain | Accepted Must evidence, Should dispositions, residual risks, clean rebuild/installed verification/privacy/notices/provenance/public review and explicit release approval |

Semantic evidence review can advance during contract review. Public task authoring and human-study scheduling preparation can advance independently, but are not permission to execute campaigns or recruit participants. Do not divert effort to another isolated foundation while the configuration/evidence publication contract remains unsigned.

## Immediate boundary

The approved admission slice can be validated now. Schema 2, the aggregate configuration/migration protocol, backup reconfirmation and sealed execution remain gated; this request does not override the repository's review/sign-off lifecycle. The next load-bearing approval is the concrete independently reviewed configuration/migration mechanism and its budget, not a repetition of settled D1-D8/MC policy questions.

## Reproduced integration failures and repairs

Fresh full-source validation failed: 1,233/1,237 tests passed across 202 suites, with no skips. It reproduced four failures:

- The exact starter protected-path assertion still expected three entries, omitting the two approved admission modules. Update the expected five-entry contract; do not remove the protected paths.
- `server/test/rate-metadata.test.ts` swallowed cleanup errors with an empty catch. The real attention gate correctly prevented both scaffold/finish workflows from claiming checked-local. Remove the catch and propagate cleanup failure; do not accept or suppress the marker.
- The real submodule fixture discarded `GIT_EXEC_PATH`, so this relocated Git executable could not find its submodule helper. Preserve that executable-support variable in the fixture, while retaining isolated global/system Git configuration. This changes neither product Git behavior nor support claims.

After these three bounded edits, all eight affected tests pass: the complete golden feature loop, all five repository-layout cases, and both starter cases including actual browser cancellation. No assertion population, guard, deadline, dependency, kernel protocol, security policy or budget was weakened.

The next full CI run passes all 1,237 tests/202 suites, zero failures/skips, including types, lints, M0 mapping, build, payload and repeat-build gates. Built UAT then exposed a fifth integration failure: its exact browser count still expected eleven cases although approved admission adds a twelfth. Keep the exact population check at twelve and derive the reported count from the actual receipt instead of a second literal.

Final validation on the repaired source passes full CI again: **1,237 tests/202 suites, zero failures/skips**. Node **26.3.0 and 22.12.0** each pass **149 built UAT scenarios** and the complete shipped-bundle loan feature loop: **89 app/12 browser-source-server cases** in the neutral starter, **116/16** after evolution. Reviewer/analyst submissions in that fixture remain synthetic, not native-host evidence. The kernel bundle is **776,837 bytes**, with **91 payload files**. [Exact source, artifact and raw-output identities](reassessment-validation.json) bind these observations; no new workload, qualification, commit or push is implied.

Whitespace, changed-document relative links/fences and evidence JSON checks pass. The actual tracked additions and this increment's new report/review/evidence/template-test content have zero likely-leak findings under the existing privacy heuristic; this is not proof of privacy. Nothing was staged.

## Independent protocol review outcome

The owner authorized one bounded read-only fresh-context review. Its [findings and dispositions](protocol-review.md) confirm that the combined protocol is **not ready for final implementation sign-off**. Settled policies remain settled. Current headroom is measured at nine non-whitespace characters in the shared central owner and 36 in schemas; a complete target estimate does not exist, so no numerical deficit or cap increase is justified yet.

The review also corrects the older packet's CR-4 framing: a rule retaining later known launches across a settlement hole already exists in section 18.4; its representation/consumer validation is partial, not wholly unspecified. Other source confirmations are integration obligations, not newly reproduced schema-1 defects. The next owner choice is bounded behavior-preserving simplification/sizing versus costing a cap increase while retaining current structure. No schema activation or partial safeguard omission follows from the review.

The owner subsequently selected bounded simplification and complete sizing, **proposal only**. The [completed capacity proposal](../../../specs/protocol-capacity.md) measures 180 source characters/302 bundle bytes of small in-memory savings, inventories 28 required responsibilities and labels the complete target ranges as estimates. Five owner ceilings remain exceeded in both planning scenarios; bundle fit is uncertain. Current coordinator capacity is 3,999/4,000 tokens, not the historical 3,892. The separately authorized independent capacity review is complete, with no blocking document defect; [dispositions](../../../specs/protocol-capacity.md#10-independent-capacity-review-and-dispositions) make the paired prose reductions and existing reconciler ownership explicit. Bounded budget/implementation sign-off is still required; runtime source is unchanged.

## Subsequent publication authority

The owner explicitly requested committing and pushing all changes with lifecycle safety. Implementation/tests were staged first; staged privacy and whitespace checks pass. Commit `35c26df81429c16217150ab174572dcef95c396b` contains the exact runtime source validated above, not a newly activated target protocol. After Git disclosed an inferred local-machine identity, the owner selected keeping it; no amendment or configuration change follows. Specifications, plan, changelog and preserved audit records follow separately. Outgoing-range privacy, push and exact-head remote CI remain pending; publication is not R1 qualification or permission to implement unsigned proposals.

October 31 follow-up: specifications/audits were committed as `2bf4c38fb36d2a86557eb123c8a0eb34587ceec5`; both commits passed the outgoing privacy heuristic and were pushed normally to `origin/main`. [Exact-head CI](https://github.com/vedprakash-m/tenet/actions/runs/41176202822) passed Windows but failed both POSIX jobs (1,235/1,237 each): pinned Chromium was absent, causing the starter browser receipt and downstream golden review assertion to fail. Cold-cache CI setup repair `a98b78d` has a failing-then-passing structural control and uses the starter's pinned lockfile/CLI in runner-owned scratch storage, not the shipped payload. Corrected full local CI passes **1,238/202**, zero failures/skips; [exact identities and retained failures](../2026-10-31/publication-validation.json) bind the unchanged bundle and changed test/workflow sources. Corrected exact-head remote validation remains pending; prior local evidence does not substitute for it.
