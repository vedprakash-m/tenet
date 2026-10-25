# Specification: Evidence Classification (EVD-04, EVD-08, EVD-09, EVD-11)

> Status: Reviewed 2026-10-24 (fresh-context subagent: 13 findings, 3 blockers; dispositions in §14). **§15 (v2) supersedes §3 to §13 where they differ.** Awaiting owner decisions D1 to D3 (§16). No implementation before sign-off.
> Date: 2026-10-24 | Decision owner: @vedprakash-m | Canonical sources: PRD §3.7.2, §3.8.3, §4.4.1, §5.13, EVD-04/08/09/11; tech-spec §9.6, §9.8, §9.9; plan §11.2 (cut list item 3).

## 1. Outcome

When a check result is read, the reader can tell, from the receipt alone, whether it passed on this candidate, failed on code this contract introduced, failed on code that was already broken, was flaky, was not a complete run, or says nothing. A failure is never called pre-existing without evidence from the starting code, a pass is never reported for a run whose inputs moved, and a declared mutation by a check is never mistaken for a human edit.

**Verification:** drive real Git repositories and real test processes through `open`, `check` and `finish`; compare the receipts and the endpoint with the examples in §4.

## 2. Current state (inspected 2026-10-24)

| Requirement | What exists | What is missing |
|---|---|---|
| EVD-04 | `check --stage baseline` runs the acceptance obligations and targeted checks before code changes and compares them with their declared expectations. `core/verdict.ts` already separates pre-existing from introduced failures, using `baselineFailures` and `excludedScope`. The reason codes `baseline-failure-excluded`, `baseline-failure-not-excluded` and `classification-unknown` exist. | `baselineFailures` is always `[]` (`verbs/facts.ts:96`), so every failure reads as introduced. `classification-unknown` is never produced. There is no sealed-checkout materialization (TS §9.8) and no rerun on the starting candidate. |
| EVD-08 | The receipt schema and the verdict know the four qualifiers. The Playwright adapter turns a retried or flaky test into `inconclusive`. | `receipts.ts` always writes `qualifiers: []`. No rerun policy exists, so nothing is ever classified flaky. `simulated`, `partial` and `history-unavailable` have no definition in the PRD or the technical specification. |
| EVD-09 | Ignored files do not enter the inventory digest; declared ignored inputs are tracked by stat. | There is no way to declare that a check writes to a tracked fixture, a cache or an output, so such a write reads as an edit and invalidates the run. |
| EVD-11 | `core/receipts.ts:94` returns `concurrent-edit` (inconclusive) when the inventory digest after the run differs from the one before. A unit test covers it. | No real-process test edits a file while a check runs. The check-input identity (toolchain fingerprint, execution envelope) is computed once before the run and is not compared after it. |

No test is tagged with any of the four IDs today.

## 3. Requirements

| ID | Requirement | Source |
|---|---|---|
| EC-1 | When a broader (not distinguishing, not targeted) check fails on the candidate and no baseline record names the failing tests, the failure is classified by the rule in §6, never defaulted to introduced or to pre-existing. | EVD-04, TS §9.8 |
| EC-2 | A failure is `pre-existing` only when the same failure is reproduced on the actual starting candidate. A failure at HEAD alone is not pre-existing when the start tree was dirty. | TS §9.8 |
| EC-3 | An unclassifiable failure is `classification-unknown`. The user may exclude it or treat it as introduced; neither choice is made for them. | TS §9.8 |
| EC-4 | A required test that fails reruns its whole obligation up to 2 times on unchanged inputs, each rerun counted as a Tenet-launched check. A pass after a failure adds the `flaky` qualifier and keeps the failure in the receipt history. A flaky required check never reaches `checked-local`. | EVD-08, PRD §4.4.1, TS §9.9 |
| EC-5 | `simulated`, `partial` and `history-unavailable` are set by the rules in §6 and are shown in the receipt and the report. A result carrying any of them is not a plain pass. | EVD-08 |
| EC-6 | An obligation may declare outputs it writes (paths or globs). Changes to declared outputs during a run do not change the candidate identity and do not make the run inconclusive. A declared output that is a tracked file is recorded on the receipt and raised as attention for the reviewer. | EVD-09 |
| EC-7 | A declared output cannot be a locked test, a support file, a protected path or an excluded path. | EVD-09, EVD-10, SEC-14 |
| EC-8 | If any relevant input changes between the start and the end of a run, the receipt is `inconclusive` with reason `concurrent-edit`. Relevant inputs are the inventory digest, declared inputs, the lockfile, the toolchain fingerprint and the execution envelope. | EVD-11 |
| EC-9 | When the OS temporary directory cannot be written, sealed classification is `classification-unknown` and says so. Tenet never stashes or resets user work to test a baseline. | PRD §5.13 |

## 4. Behavior as examples (test ownership)

| # | Example | Test file |
|---|---|---|
| E1 | A broader suite fails on a test that also fails at the clean starting commit: with sealed baselines the failure is `pre-existing`; without them it is `classification-unknown`, and `finish` blocks `checked-local` until the user excludes or accepts it. | `evidence-classification.test.ts` |
| E2 | The start tree was dirty (a human-edited file) and the failure reproduces at HEAD only: `classification-unknown`, never pre-existing. | `evidence-classification.test.ts` |
| E3 | The same failing test passes on a start-candidate rerun: `introduced`. | `evidence-classification.test.ts` |
| E4 | A test fails once and passes on rerun 1: the receipt is `pass` with `flaky`, shows the earlier failure, counts 2 launched checks, and `finish` will not report `checked-local`. | `evidence-classification.test.ts` |
| E5 | A test fails three times: `fail`, with 3 launched checks and no `flaky`. | `evidence-classification.test.ts` |
| E6 | A manual receipt (user-run) is stored as `simulated` and does not satisfy a required check. | `evidence-classification.test.ts` |
| E7 | A run killed after discovering 10 tests and executing 4 is `inconclusive` with `partial`. | `evidence-classification.test.ts` |
| E8 | In a shallow clone whose lock anchor commit is missing, the receipt carries `history-unavailable`. | `evidence-classification.test.ts` |
| E9 | A test writes `fixtures/snapshot.json` (tracked) and declares it: the run stays valid, the receipt lists the mutation, the reviewer sees an attention item. | `evidence-classification.test.ts` |
| E10 | The same write, undeclared: `inconclusive`, `concurrent-edit`. | `evidence-classification.test.ts` |
| E11 | A real process edits a source file while a test runs (a file the test reads): `inconclusive`, `concurrent-edit`, no passing receipt published. | `evidence-classification.test.ts` (real process) |
| E12 | The lockfile or the toolchain fingerprint changes during a run: `inconclusive`. | `evidence-classification.test.ts` |
| E13 | A declared output that is a locked test or a protected path is refused when the basis is recorded. | `evidence-classification.test.ts` |
| E14 | OS temp is unwritable: classification is `classification-unknown` with the reason; user files are untouched. | `evidence-classification.test.ts` |

## 5. Proposed definitions (the sources do not define three of the qualifiers)

These are proposals for the owner to confirm or amend; no source defines them.

- **`partial`:** the run executed fewer tests than it discovered for reasons other than declared skips, or ended early (timeout, kill, truncated output) after producing some results. Always at most `inconclusive` for a required check.
- **`simulated`:** the result was not produced by the kernel running the obligation's own command on this candidate: a manual receipt, or an unverified imported result. Never satisfies a required check.
- **`history-unavailable`:** the check or its comparison needs Git history that is not present (a shallow clone missing a lock anchor or a start commit, or an unborn HEAD). The result is reported with the limit; it cannot establish a baseline.

## 6. Classification rule for a failing broader check

1. If a recorded baseline names every failing test, use it: `pre-existing` (excluded or not, as today).
2. Otherwise, if sealed baselines are enabled and the start candidate is reproducible, rerun the obligation there: same failure set is `pre-existing`; a pass is `introduced`; a different set is `classification-unknown`.
3. Otherwise (sealed baselines not enabled, start not reproducible, OS temp unwritable, start tree dirty with a changed start file): `classification-unknown`.

## 7. State and contract changes

- `WorkContract.baselineFailures: string[]` (test identities from baseline-stage and sealed runs) feeds the existing verdict input. No change to its consumers.
- Receipt gains `history: Array<{ status, counts, at }>` for flaky reruns (bounded to 3) and `mutated: string[]` (declared outputs that changed).
- Obligation and basis example gain optional `outputs: string[]` (cap 20), validated by EC-7 when the basis is recorded.
- Candidate identity excludes declared outputs. This changes `checkInputId`, so every stored receipt is stale after upgrade. Receipts are local evidence and are re-run, so this is acceptable (decision D3).
- Adapter version bumps (`node-ts@4`), as the earlier receipt corrections did.

## 8. Alternatives considered

| Option | For | Against |
|---|---|---|
| A. Everything now: sealed baseline materialization, reruns, qualifiers, declared outputs | Satisfies the four Musts fully | Sealed checkouts are the largest piece (temporary index, `checkout-index`, dependency linking, TS §9.8); it is on the pre-authorized cut list (item 3) |
| B. Qualifiers, flaky reruns, declared outputs and the real-process EVD-11 proof now; sealed baseline reduced to `classification-unknown` (the cut-list claim); sealed checkouts later | Small and honest: nothing is called pre-existing without evidence; every other requirement is fully met; the cut list already authorizes the narrower claim | EVD-04's sealed rerun stays unbuilt, so users with a broken suite classify by hand |
| C. Skip EVD-04 until committed-tree checks exist | Builds the materializer once for both | Leaves four Musts open longer; delays flaky handling that does not need it |

## 9. Recommendation

**Option B.** It closes EVD-08, EVD-09 and EVD-11 and the honesty half of EVD-04 (EC-1 to EC-3, EC-9) with no new process machinery. The sealed rerun (EC-2's reproduction path) follows as its own spec together with the committed-tree check, because both share the materializer. Plan §11.2 already records `classification-unknown` as the pre-authorized narrower claim for EVD-04.

## 10. Risks

- Flaky reruns add Tenet-launched checks against the per-contract limits; the reruns must count (EC-4) and the limits must still stop a loop.
- Declared outputs are cooperative: a model could declare a source file to hide an edit. EC-7 and the reviewer attention item are the guard; they do not make it a sandbox.
- Changing candidate identity invalidates stored receipts (D3).
- The `simulated` and `history-unavailable` definitions are proposals; a wrong definition would be user-visible wording.

## 11. Assumptions

- A required test's identity is stable between runs (adapters already refuse duplicate identities).
- Reruns run the same command in the same envelope; a rerun does not edit the workspace.
- The inventory digest is a faithful proxy for "relevant inputs" apart from the toolchain and envelope, which EC-8 adds.

## 12. Acceptance criteria

1. E1 to E14 pass on real repositories; E11 and E12 use a real running test process.
2. A failing broader check is never reported as pre-existing without a recorded or reproduced baseline (property check over the verdict input).
3. A flaky required check never reaches `checked-local`; the reruns appear in the launched-check count.
4. A declared output never changes the candidate identity; an undeclared one does.
5. `npm run ci` passes within module budgets (any increase logged under the owner's pre-approval or raised for decision); built-bundle scratch run on Node 26.3.0 (and 22.12.0 where available); plan, changelog and canonical-spec backfill done.

## 13. Decisions for the owner (one at a time)

- **D1.** Choose option B (recommended), A or C.
- **D2.** Confirm or amend the three qualifier definitions in §5.
- **D3.** Accept that adding declared outputs changes candidate identity and so makes every stored receipt stale once.

## 14. Independent review: findings and dispositions (2026-10-24)

Reviewer: a fresh-context subagent with read-only access. I re-checked the load-bearing claims in code: `ADAPTER = "node-ts@9"` (`node-ts.ts:15`); `rc.failures` is cut to 5 (`receipts.ts:138-143`); a baseline-stage run executes only the acceptance obligations (`check.ts:104-107`); TS §8.8 and §9 already list declared outputs outside identity and drift. All findings are accepted unless stated.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | Blocker | The adapter is already `node-ts@9`; "node-ts@4" is wrong, and declared outputs are not what stales receipts. | **Accepted.** The next value is `node-ts@10`. A bump is needed because receipt content and the verdict's reading of `flaky` change; the staleness comes from the bump, not from outputs. §7 and D3 corrected. |
| 2 | Blocker | `baselineFailures` filled from baseline-stage runs would name planned reds (distinguishing tests); a fix that never worked would read `baseline-failure-not-excluded` instead of `evidence-failed`. | **Accepted.** Only failures of a broader check on a recorded starting tree may enter the list; planned reds and any obligation with a declared red never do. Moot in this slice (§15, item 1) but recorded as a rule for the sealed-baseline spec. |
| 3 | Blocker | `failures` holds at most 5 names; "every failing test is in the baseline" can pass with 7 failures of which 2 are new. | **Accepted.** The pre-existing test must require `failures.length === counts.failed`; otherwise the result is not pre-existing. Recorded as a rule and a required test for the sealed-baseline spec. |
| 4 | Major | EVD-04 is a Must; only a PRD §4.7 waiver narrows a Must; the cut list triggers on a >25% overrun or a slipped milestone, and none is recorded. Option B overstated. | **Accepted.** EVD-04 stays `◐` (not met). The honest claim: the baseline half (acceptance and targeted before code) is built; the sealed rerun is open. Using the cut-list claim needs the owner to record the trigger (D1). "Every other requirement is fully met" is removed. |
| 5 | Major | Under B every red broader suite would become `classification-unknown` and block, replacing today's `evidence-failed` with next=implement; E2, E3, E14 are untestable under B. | **Accepted.** v2 changes no failure handling. Today a failing check is `evidence-failed` (conservative, blocks `checked-local`) and makes no claim that it was introduced. EC-1 to EC-3 and EC-9, and E1 to E3 and E14, move to the sealed-baseline spec. |
| 6 | Major | "The user may exclude it" has no mechanism: `excludedScope` is hard-coded empty, no `decide` kind sets it, the verdict has no unknown-classification input. | **Accepted.** Deferred with item 5; the sealed-baseline spec must add the verdict input, the `decide` kind, wording and the reason text change. |
| 7 | Major | Flaky reruns: (a) baseline-stage planned reds would be rerun and `matchBaseline` would see `pass+flaky`; (b) one shared process serves all test obligations, so "2 launched" is wrong; (c) no limit consumes `checksLaunched`, so "limits stop a loop" is false and 3 reruns of a 10-minute timeout is 30 minutes in one call; (d) tripled runtime; (e) the failure signature is cleared by the final pass; (f) `passedAll` ignores qualifiers, so a flaky pass issues a review manifest; (g) "unchanged inputs" undefined; (h) `history` loses failing test names; (i) Playwright reruns cost a port, a database and minutes. | **Accepted, all nine.** §15 item 3 defines: candidate and integrated stages only; rerun only the failing obligations' files; count one launched check per obligation rerun; a wall-time bound; digest rechecked after each rerun (mismatch is `concurrent-edit`); `history` keeps up to 5 failing names; the failure signature is kept when any attempt failed; `passedAll` treats a flaky pass as not passed; Playwright obligations are not rerun in this slice. |
| 8 | Major | Declared outputs: excluding paths from the inventory removes them from `entries`, `status` and the digest, so lock hashes, attribution, review paths and commits would lose them; E9 contradicts EC-7 (a fixture is a support file); globs can hide `src/**`; every digest caller must pass the same list. | **Accepted.** v2 keeps outputs in `entries` and `status` and removes only their content from the digest; records blob before/after on the receipt; rejects outputs that classify as source, test or config, match scope, touched or keep-out paths, are dirty at the start, or are support or locked files; matches globs at every check; prefers `.gitignore` (ignored paths are already outside the digest); names the home of the field. Because it is the riskiest piece it becomes its own slice with its own review (§15 item 4). |
| 9 | Major | EC-8: the lockfile and config are already declared inputs (so in `after`); the envelope is a constant and cannot change mid-run; the toolchain fingerprint is not in the digest; `fingerprint()` can throw inside `execute` and become exit 5. | **Accepted.** v2 compares the toolchain fingerprint after the run (cheap, uncached), treats a throw as inconclusive, drops the envelope from E12, and states the real gap: `checkInputId` is computed before the run, so a mid-run change today yields `stale` only at the verdict; the new rule makes the receipt `inconclusive` at once with `concurrent-edit`. Compared in `core/receipts.ts` with the digest passed as a pair. |
| 10 | Major | Qualifiers: no verb creates manual or ci-external receipts, so `simulated` has no producer and `fresh()` ignores `source`; `partial` is redundant with `timeout`, `report-invalid`, `population-mismatch`, and a killed vitest run yields `report-missing`, never "discovered 10, executed 4"; `history-unavailable` has no producer and marking all shallow-clone checks would mislead. | **Accepted.** Only `flaky` has a producer. `partial` maps to the existing inconclusive reasons (documented, not a new qualifier). `simulated` waits for manual or imported receipts; `history-unavailable` waits for sealed or committed-tree checks. The report wording change (`receiptSummary`, handoff, UX) is named in §15. EVD-08 stays `◐`. |
| 11 | Minor | §2 claims verified true; no file:line citations; "no real-process test edits a file during a check" unproven. | **Accepted.** Citations added in §15; the claim is limited to "none found by search of `test/`" until a full read. |
| 12 | Minor | Schema bounds, bundle and module-budget impact, property-test generator unnamed. | **Accepted.** Bounds in §15; budget impact estimated; the property check is a `fast-check` generator over verdict inputs in `verdict.test.ts`. |
| 13 | Minor | Test ownership: pure rules belong in `receipts.test.ts` and `verdict.test.ts`; one real-Git file for the flow; tags per title. | **Accepted.** §15 assigns files and tags `EVD-08`, `EVD-09`, `EVD-11` on specific titles. |

## 15. Revised scope, v2 (supersedes §3 to §13 where they differ)

**What is true today (with citations).** `baselineFailures: []` is hard-coded (`verbs/facts.ts:96`); no qualifier is ever set (`core/receipts.ts:77`); `after !== before` returns `concurrent-edit` (`receipts.ts:94`, unit test `receipts.test.ts:90`); baseline-stage runs execute only acceptance obligations (`verbs/check.ts:104-107`); a failing check is `evidence-failed` with next=implement (`verbs/check-finalize.ts:82-86`); failures are capped at 5 (`receipts.ts:138-143`); `checksLaunched` is recorded but never limits anything (`core/budget.ts:67`); the adapter is `node-ts@9` (`adapters/node-ts.ts:15`).

**1. EVD-04 stays `◐`, with no behavior change.** A failing check keeps today's conservative handling (`evidence-failed`, blocks `checked-local`, makes no claim about when the failure arose). Two rules are recorded for the later sealed-baseline spec: only failures of a broader check on a recorded starting tree enter `baselineFailures` (never planned reds), and "pre-existing" requires `failures.length === counts.failed`. The cut-list claim (`classification-unknown`) is not adopted until the owner records its trigger (D1).

**2. EVD-11 proof (small).** Add the real-process test (a file the test reads is edited while it runs: `inconclusive`, `concurrent-edit`, no passing receipt published). Compare the toolchain fingerprint before and after the run in `core/receipts.ts`; a throw while fingerprinting after the run is `inconclusive`. Tests live in `receipts.test.ts` (pure) and one real-process file; titles carry `[EVD-11]`.

**3. EVD-08 flaky classification (medium).**
- Candidate and integrated stages only; never baseline or any planned red.
- When a required test obligation fails, rerun only the failing obligations' test files, at most 2 times, each rerun recorded as one launched check per obligation rerun.
- Reruns stop if the first run took over 2 minutes or the wall-time bound for the call would be exceeded; they never run after a timeout, kill or `concurrent-edit`.
- After each rerun the inventory digest and toolchain fingerprint are compared; a mismatch is `concurrent-edit`.
- A pass after a failure sets `flaky` and keeps `history: [{status, failed: string[<=5], at}]`, at most 3 entries. A fail on every attempt stays `fail` with `history`.
- The repeated-failure signature stays set when any attempt failed. `nextStep` treats a flaky pass as not passed (no review manifest, no reservation, no `checked-local`); the report says "passed after a rerun (flaky)".
- Playwright obligations and static tools are not rerun in this slice.
- Adapter advances to `node-ts@10`; stored receipts go stale once.

**4. EVD-09 declared outputs (separate slice, own review).** Field `outputs: string[]` (at most 20, each at most 200 characters, globs allowed) on `BasisElementInput` and copied to the acceptance `Obligation`. Content of matching paths is removed from the digest; the paths stay in `entries` and `status`. The receipt records `{path, before, after}` blobs for each changed output and an attention item is raised for the reviewer. Rejected when recorded: a path that `classify` calls source, test or config; matches scope, `touched` or keep-out paths; is dirty at the start; is a support or locked file; or is protected. Globs are matched at every check. One shared digest function takes the outputs list so `gather`, `execute`'s `after`, `worldDigest`, commit and finish agree. Documentation prefers `.gitignore`. Abuse tests: declaring `src/**` is rejected; an output that is also edited by a human is still attributed.

**5. Qualifiers.** `flaky` only. `partial` is documented as the existing inconclusive reasons (`timeout`, `report-invalid`, `population-mismatch`, `not-executed`). `simulated` and `history-unavailable` stay in the schema with no producer until manual or imported receipts and sealed or committed-tree checks exist.

**6. Wording.** `receiptSummary` (`check-finalize.ts:34-42`), the handoff text and the skill gain the flaky wording; no other qualifier text is added. The skill body is at its token ceiling, so the text must replace, not add.

**Implementation note (slice 1, 2026-10-24).** The toolchain comparison is folded into the post-run digest in the effect layer (`check-rerun.ts#digestAfter` tags the digest when the fingerprint moved), so the pure rule `after !== before` in `core/receipts.ts` is unchanged and still the single decision point; the review suggested passing a pair to `receipts.ts`, which would be equivalent but needs more plumbing. A mutation check (disabling the tag) fails the toolchain test.

**Test ownership and tags.** `receipts.test.ts` (`[EVD-11]` toolchain pair, throw), `verdict.test.ts` (`[EVD-08]` flaky never reaches `checked-local`, property check with a `fast-check` generator over verdict inputs), `evidence-flaky.test.ts` (real Git and real test processes: pass-after-fail, fail-thrice, planned red not rerun, edit between reruns, count and time bound), `evidence-midrun.test.ts` (real process edit during a run), and later `evidence-outputs.test.ts` (`[EVD-09]`).

**Schema and budget.** `Receipt` and `Obligation` are non-strict, so added optional fields are readable by older kernels. `history` is bounded (3 entries, 5 names), `mutated` at most 20 paths. Expected growth: about 25 lines in `pipeline + verbs + decisions` and 40 in `core/` for slices 1 to 3; slice 4 about 30; each logged under the owner's under-1% rule or raised for decision if larger.

**Acceptance (v2).** EVD-11 and EVD-08 examples pass on real repositories and processes; a flaky required check never reaches `checked-local`; reruns appear in the launched count and stay inside the time bound; no failure is ever called pre-existing; full CI; built-bundle scratch run; plan and changelog updated. EVD-04 and the qualifiers `simulated` and `history-unavailable` are recorded as open, not met.

## 16. Decisions for the owner (review applied)

- **D1. Scope and EVD-04.** Recommended: two slices. Slice 1 = EVD-11 proof and EVD-08 flaky reruns (items 2, 3, 5, 6). Slice 2 = EVD-09 declared outputs (item 4), after its own short review. EVD-04 stays open (`◐`) and its sealed-baseline half gets its own spec later; to claim the cut-list narrower claim instead, you must record the trigger. Alternatives: (a) all four items in one slice; (b) build the sealed baseline first.
- **D2. Qualifiers.** Recommended: approve that only `flaky` has a producer now, `partial` is the existing inconclusive reasons, and `simulated` and `history-unavailable` wait for their producers. The §5 definitions of the first draft are withdrawn.
- **D3. One-time staleness.** Accept that advancing the adapter to `node-ts@10` makes every stored receipt stale once (a re-run, no data loss).
