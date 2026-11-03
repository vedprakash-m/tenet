# Decision packet: blocking owner decisions for R1

Date: November 3, 2026. Prepared from `main` at `06bcbb0`. **Status: proposal for owner decisions. Nothing in this file is approved, and writing a recommendation here does not select it.** This file changes no source, test, tool, ceiling or spec. The only edits in the commit that adds it are this file.

## How to use this packet

- Answer each decision separately, by number and letter (for example "1A, 2A, 3B"). Each decision stands alone except where it names a dependency. The project rules require one decision at a time; the packet is grouped only so the owner can read everything before answering.
- Decision 1 should be answered first. Its answer changes what decisions 2, 5, 9 and 10 cost.
- Every number carries one label. **Measured** means a tool or run produced it from source; the packet says which. **Forecast** means an estimate from a spec. **Unobserved** means nobody has seen it happen on the real host.
- Where the plan says not to copy numbers, the packet cites the section. Where it quotes a number, it does so because the decision cannot be read without it, and it names the section the number came from.
- "Never-waivable" refers to PRD §4.7: AC-07, AC-11, AC-16, AC-17, AC-25 (safety cases), AC-27 and AC-28 (CI-security cases). Every other requirement is waivable only by the narrowing route in PRD §4.7.

### What was read, and what was not

Read in full: `specs/fixed-budget-simplification.md`, `protocol-capacity.md`, `protocol-prototype.md`, `trait-detection.md`, `result-demo-path.md`, `shared-files.md`, `starter-runtime.md`. Read in part (the status, decision and open-item sections named in the citations): `plan.md` (dashboard, §2–§4, §9, §11, §12.3, §12.12–§12.19, top of §13), `schema-migration.md`, `config-completion.md`, `reconstruction.md`, `sealed-baseline.md`, `recovery-reconfirmation.md`, `storage-retention.md`. PRD and tech-spec were read only at the rows cited. Not read: `migration-closure.md`, the `eval-*` specs, `harness-eval.md`, `admission-policy.md`, `evidence-classification.md`, `evidence-outputs.md`, `ux-spec.md` beyond J-06. I also read source at the lines cited and ran the repository's own `measure` and `budgetChars` functions (`tools/lint-quality.ts`) on this checkout. I did not build the bundle, run tests, or run `npm run ci`.

## Summary

| # | Decision | Recommend | Unblocks (requirements) | Depends on |
|---|---|---|---|---|
| 1 | Complete-target capacity | **A** Raise the fixed ceilings to the measured size of the finished candidate, approved in two steps | CFG-01/03/04/08/09/10, RSC-04/08, CON-05, LFC-03/04, QLT-11/13/14, and every later feature that needs new source in a full owner | none |
| 2 | Schema-2 activation and migration open items | **A** One schema 1 to 2 migration; close the listed items in the stated order | LFC-04, CON-05, CFG-*, QLT-11, RSC-04, CON-07, RES-05 (RD-3) | 1 |
| 3 | Configuration identity and readback | **A** Keep the canonical receipt rule; amend TS §8.8 for the contract base; sign §14.1 after review | CFG-01/03/04/08/09/10, EVD-01/03 | 1, 2 |
| 4 | QLT-11 work-correction binding; deferred-R2 disclosure | **A** Bind through the existing facts projection; show a static R2 notice | QLT-11, QLT-13, QLT-14; never-waivable AC-07, AC-27 | 2 |
| 5 | RES-05 result demo (RD-1 to RD-5) | **A** Approve RD-1 and RD-2 now; review RD-5; hold RD-3 and RD-4 mechanism until 1 and 2 | RES-05 (Must, Beta) | 1, 2, 4 |
| 6 | ENG-09 trace contract | **A** Extend the journal `call` record with kernel-observed fields and declared gaps | ENG-09 (Must, Beta); ENG-06 (Should) | none |
| 7 | GIT-03 trailers | **A** Fixed names; amend the wording | GIT-03 (Must, M0) | none |
| 8 | WRK-08 extension wording | **A** Only active time is extendable; amend the wording | WRK-08 (Must, M0) | none |
| 9 | The missing `publish` verb | **B** Cut it from R1 as a recorded decision | GIT-05 (holds), GIT-06 | 1 |
| 10 | Pre-authorized cut list | **A** Take cuts 1, 2 and 4 now; hold 3 | EVD-04 (Must), EVD-14, QLT-15 | 1 |
| 11 | The 19 Should items | 11 implement, 8 omit (table; owner signs each) | PRD §4.7 "Should pass or owner-signed omission" | 1, 9, 10 |
| 12 | External lead-time requests | **A** Authorize preparing and sending all four request groups now | AC-28 (never-waivable), AC-16, AC-17, AC-25 host evidence, 16 host-only Musts, pilot | none |

Ordering: 1 → 2 → 3/4/5. Decisions 6, 7, 8 and 12 can be answered at any time. Decisions 9, 10 and 11 interact and are easiest to answer together after 1.

## Shared facts: source capacity today

**Measured on this checkout (`06bcbb0`, 2026-11-03)** with the quality gate's own `measure` and `budgetChars`, non-whitespace characters. These match the November 2 table in `protocol-prototype.md`. Ceilings are lines × 57.6 from `tools/lint-quality.ts`; no separate recorded ceiling overrides them.

| Owner | Used | Ceiling | Free |
|---|---:|---:|---:|
| pipeline + verbs + decisions | 247,182 | 247,219 | 37 |
| `adapters/store-fs` | 25,706 | 25,920 | 214 |
| `adapters/git-cli` | 37,801 | 37,843 | 42 |
| `core/budget` | 8,806 | 8,870 | 64 |
| `core/schemas` | 26,371 | 26,899 | 528 |
| `adapters/node-ts` | 20,160 | 20,160 | 0 |
| `core/review` | 16,981 | 20,160 | 3,179 |
| `core/verdict` | 12,549 | 17,280 | 4,731 |
| `core/risk` | 4,779 | 8,640 | 3,861 |
| `adapters/runner` | 9,928 | 20,160 | 10,232 |

Also fixed: the kernel bundle at 819,200 bytes (TS §3.2; the November 2 baseline build is 784,061 bytes, from `protocol-prototype.md`; not rebuilt here) and the coordinator skill at 4,000 tokens (4,000 used; `protocol-prototype.md`).

Consequence stated once, because it recurs: the free space left in the five owners that any new feature must use (central, store, Git, budget, schemas) totals 885 characters. Any feature that needs more than a few lines in those owners cannot be added without a ceiling change or a deletion elsewhere. That includes `publish`, GIT-14, the sealed-baseline work, RES-05 and the whole schema-2 protocol.

---

## 1. Complete-target capacity

**Context.** The owner approved a consented schema 1 to 2 upgrade (D8), configuration-to-evidence binding (D7), launch accounting, a recovery fence, and QLT-11 trait state in the same schema. The owner then chose "keep all budgets fixed and pursue a larger behavior-preserving simplification" (`fixed-budget-simplification.md`, October 31) and, on November 2, authorized a complete sizing candidate that returns "complete measurements, omissions, simplifications and proposed exact production limits for a separate decision" (plan §1). This is that decision, with one gap: the candidate is not finished (plan §12.19, last two items open; the plan says ten todos are blocked), so the exact limits cannot be proposed yet. What can be decided now is the direction.

**The numbers, by what kind of evidence they are.**

| Owner | Forecast excess over ceiling (`protocol-capacity.md` §4, October 29 baseline, before QLT-11) | Measured on the incomplete scratch candidate (plan §1, 2026-11-01) |
|---|---|---|
| central | 14,138 to 23,338 | 293,390 vs 247,219: **46,171 over** (+18.7%) |
| store | 7,700 to 13,300 | 38,277 vs 25,920: **12,357 over** (+47.7%) |
| `core/budget` | 2,745 to 4,745 | 23,047 vs 8,640 (ceiling at that date): **14,407 over**; against today's 8,870, 14,177 over (+160%) |
| schemas | 6,937 to 11,437 | 26,891 vs 26,899: eight free, because the QLT-11 trait state was not yet implemented |
| Git | 78 to 198 | not reported |
| bundle | 802,488 to 819,676 bytes vs 819,200 | 814 KiB vs 800 KiB (+14 KiB, +1.75%) |

- Forecast total: 43,290 to 72,160 added characters (`protocol-capacity.md` §4). It is an additive estimate by row, not measured code.
- The scratch candidate passes 1,656 of 1,658 tests; the two failures are the bundle-size invariant and the owner-budget gate (plan §1). It lacks migration and runtime responsibilities (plan §1: "passing tests do not prove the missing migration/runtime responsibilities implemented"), so these figures are not an upper bound.
- On central and `core/budget` the measured excess is already above the forecast high (my arithmetic: central about 2.0 to 3.3 times the forecast added size, assuming the scratch base was main's 247,213 recorded in `fixed-budget-simplification.md`; `core/budget` about 3 to 5 times). The forecast was too low where it can now be checked. Store falls inside its forecast range.
- The plan's own trigger (plan §2 item 5, §11.2: a module more than 25% over its budget forces a decision) is met by store and `core/budget` in the scratch measurement and not by central (my arithmetic from the table).
- Simplification results so far: schemas −135; first installed slice −818 net across schemas, accounting and central; scratch central −453; a scratch accounting patch −287 (223 in the accepted form). Two bounded investigations (central, store) found no safe reduction (`protocol-prototype.md`, November 1). For `core/budget` the measured gap is about 65 times the best saving found, and for central about 100 times (my arithmetic: 14,407 ÷ 223 and 46,171 ÷ 453); no saving was found for store.

**Alternatives.**

- **A. Raise the ceilings to the finished candidate's measured size.** Approve the direction now. The exact new ceilings come from the finished, independently reviewed candidate and need a second approval. After that approval the ceilings only fall (TS §6.2 rule). Stop condition proposed: if the finished candidate exceeds the figure the owner approves, work stops and returns.
- **B. Cut scope to reduce the raise.** Three candidate cuts, each reopening an earlier owner decision; none fits by itself, because all of them leave more than the free space above.
  - B1. Build schema 2 only for new workspaces and refuse upgrades of existing ones (`config-completion.md` §15.1 Option B). Removes the upgrade machinery. Forecast rows S3, S4, C8, A1, A2, A3, O5, O8 sum to about 15,600 to 25,700 of the 43,290 to 72,160 forecast (my sum of `protocol-capacity.md` §4 rows; forecast, not measured). LFC-04 (Must, R1) stays unmet and reverses D8.
  - B2. Drop the launch-accounting protocol and keep finalization-only accounting. Rows C3, C4, C5, C7, B1, R1, G1 sum to about 11,320 to 18,940 (forecast). The combined review accepted its absence as a safety gap (`config-completion.md` §17 item 4: finalization-only accounting cannot prove interrupted launch counts). No narrower claim is written down for it.
  - B3. Move trait state out of schema 2 (reverses R5, 2026-10-31, where the owner chose schema 2 over a sidecar).
- **C. Keep the ceilings and continue refactoring.** This is the October 31 direction. The evidence above is the reason it is now a question.

**Recommendation: A.** The measured candidate already exceeds the forecast where the forecast can be checked, and the refactoring results are far smaller than the gap, so a fixed-ceiling path has no demonstrated route. B1 to B3 each give up an approved safeguard and still leave a ceiling increase. A keeps every approved safeguard, makes the cost explicit, and still lets cuts 9, 10 and 11 below reduce the number that gets approved. Apply opportunistic simplification when it pays for itself, but do not make it the plan.

**Work that follows.**
- A: finish the 28-row plus QLT-11 candidate (plan §12.19), run the integrated gates and the one authorized independent review, then return with exact limits per owner. After approval: update TS §6.2 and §3.2, `tools/lint-quality.ts` budgets, `tools/quality-baseline.json`, the bundle limit (`tools/build.ts`, `packages/kernel/test/invariants.test.ts`) and the skill limit if it moves; then implement in vertical slices, red test first.
- B: a reduced-protocol spec, a fresh independent review of it, a PRD §4.7 waiver for each Must narrowed, and edits to `config-completion.md`, `schema-migration.md`, `trait-detection.md`. Then the same candidate work at a smaller size.
- C: more bounded replacement passes; no scheduled outcome.

**Effect on R1 definition of done.** Ceilings are not themselves a done-condition. The protocol they pay for protects never-waivable AC-17 (state and Git recovery; CON-05 maps to it) and AC-07 (a configuration change must not leave stale passing evidence usable; this is my reading of AC-07's "stale identities" and AC-18's input-drift case). B1 and B2 would narrow LFC-04 and RSC-04's accounting; whether either can be a PRD §4.7 narrowing is not stated in §4.7 (it speaks of "value or experience" targets), so the owner would have to rule on that.

---

## 2. Schema-2 activation and migration open items

**Context.** Schema 2 is approved in scope (D7, D8, R1, R2 lifetime, R5) and unapproved in mechanism. `schema-migration.md` §16 to §20 is a proposal; no migration code is allowed in the shipped tree before final review and sign-off. The legacy-record capture exists (123 files, all ten effect kinds, archive SHA-256 `2f3b7979…963c81e5`, plan §13 2026-11-03). Several items below are still open and several need an owner choice rather than more engineering.

**Open items, with a proposed disposition for each.** All dispositions are my proposals.

| Item (source) | What is open | Proposed disposition |
|---|---|---|
| Final sign-off | Needs integrated independent review, budget fit (decision 1) and the hardening decoder row (§18.1). The owner chose to include `hardening` on November 2; the row needs integrated review and real producer fixtures. | Review once, after the complete candidate exists; fixtures now exist. |
| R3: supported bridge and rollback target (§16.9, "Unknown: owner/reviewer before activation") | Which released build is the supported rollback minimum, its digest, and the rollout requirement. No guarantee for arbitrary old binaries. | Name the first release that contains the approved schema-1 bridge admission stage (owner decision 15 A, `schema-migration.md` §18.7) as the minimum. This needs a release to exist; it cannot be settled by a coding session. |
| R4: finite reference inventory, informational-key allow-list, privacy-intent format (§16.9) | Missing classification means refusal, not a guess. | Keep refusal as the rule. Return a policy question only if a real fixture needs one. |
| Manifest edge identity (plan §12.3, 2026-10-31) | §18.1 requires a file hash equal to the manifest hash, but real review producers store a path and a 16-character packet hash. | Copy actual bytes under their own SHA-256 and keep historical packet-body identity separate; otherwise treat such sources as unavailable. |
| Explicit recovery-set deletion interface (`protocol-prototype.md`; `protocol-capacity.md` §6) | R1 (2026-10-24) says retain the source recovery set until previewed deletion, but no `decide` kind or phase validator is specified. | Specify one previewed deletion kind in the protocol review. Without it the retained copy has no way out except `forget`. |
| Non-empty `state.archive` | No writer exists for it (`storage-retention.md` review finding 2), so there is nothing to decode. | Accept: an empty archive migrates, a non-empty one is unavailable (`schema-migration.md` §18.6). |
| Opaque cached responses | Need a finite decoder per producer or refusal. | Refuse any producer without a decoder. |
| Backup reconfirmation R08 | Owner deferred sign-off until the migration contract is approved (`recovery-reconfirmation.md` status). | Sequence it after this decision. |
| `SCHEMA_VERSION` and shared-files S1 (`shared-files.md` D5) | The decision files entry changes the trust union; D5 says revisit "bump and migrate" before R1 ships. | Put S1 inside schema 2 or defer it; do not ship it on schema 1. |
| RD-3 optional receipt field (`result-demo-path.md` §13.2) | A stored-schema change. | Decide inside this migration (decision 5). |

**Alternatives.**

- **A. One schema 1 to 2 migration** covering configuration binding, launch accounting and recovery, and QLT-11 trait state, with the items above closed in this order: capacity (1), protocol review, deletion interface, bridge identity (R3), then sign-off.
- **B. No schema 2 in R1.** Ship the approved schema-1 bridge admission (already implemented and validated locally) and refuse newer stores. Configuration binding, launch accounting and QLT-11 state are narrowed or cut. LFC-04 has no migration to preview or reverse.
- **C. Two migrations.** Schema 2 for configuration binding and launch accounting now; trait state and the RD-3 receipt field in a later schema 3. This reverses R5 and doubles the kill-and-restart test matrix (`schema-migration.md` §16.8, M4).

**Recommendation: A.** The owner has already chosen the scope twice (D8, then R5), and splitting into two migrations costs more test work than doing one. B drops approved safeguards for requirements that are Musts. The one thing the owner must supply is the R3 release identity, which depends on a release.

**Work that follows.**
- A: complete candidate (decision 1), one independent integrated review, then implement with the planned `schema-migration.test.ts` and the M1 to M7 checks (`schema-migration.md` §16.8), real SIGKILL at each prefix, paired bridge and target builds.
- B: spec edits to mark schema 2 out of R1; PRD narrowing for each affected Must; remove or rewrite the plan rows for §12.16 row 3.
- C: a second protocol review for the later migration; split of `schema-migration.md` §16.2.1.

**Effect on R1 definition of done.** AC-17 is never-waivable and CON-05 maps to it. Option B keeps AC-17 safe by refusing unknown schemas (the current behavior, `schema-migration.md` §2) but leaves LFC-04 (Must, R1, AC-10) unmet. Under A the kill-and-restart matrix (M4) is part of what AC-17 needs to show.

---

## 3. Configuration identity and readback contract

**Context.** `config-completion.md` §14 (input and response), §16 (evidence binding) and §18 (recovery and launch protocol) are proposals. The Oct 24 review left three blockers: B1 (declaration versus execution equivalence) is resolved as design; B2 (the persisted invalidation representation for all affected work) and B3 (measured fit) stay open (`config-completion.md` §14.10). Two further points need an owner answer: whether receipts carry a second configuration stamp, and whether check identity includes the contract base.

**Open items.**
- **Receipt stamp.** The canonical §16.2 Receipt row says: no duplicate stamp; the versioned `checkInputId` carries the full work binding. A scratch receipt change added an optional `configEvidence` field anyway; plan §12.3 (2026-10-31) records this as a conflict with the canonical contract and asks for consumer and producer reconciliation before any shape change. The scratch treatment since then keeps legacy `configEvidence` inert and uses canonical versioned IDs for new receipts (plan §1, 2026-10-31 checkpoint).
- **Check identity and the contract base.** Main now hashes `work.git.base` into `checkInputId` (plan §12.3, 2026-11-01), because PRD EVD-01 requires it. TS §8.8's enumerated identity omits it. The plan records the canonical clarification as owner-pending. Receipts with the earlier identity become conservatively stale when re-evaluated.
- **Input and response envelope** (`config-completion.md` §14.1). Plan §12.3 (2026-11-01) calls the complete strict-envelope contract unsigned.
- **Persisted invalidation for all work** (B2), including shared-file changes and obligation-ID collisions (`config-completion.md` §14.10, §16.4, §16.5).
- **Fit** (B3): decision 1.
- Not decided here: user scope and personal storage, charter write and instruction precedence, SEC-04 equivalence, AC-23 items 8, 10, 12, 16 (`config-completion.md` §12.2 V9). They depend on host spike SP-02 (decision 12).

**Alternatives.**
- **A. Keep the canonical rule.** No second stamp on receipts. Amend TS §8.8 to list `work.git.base` as part of check identity. Sign §14.1 after the independent review in decision 2.
- **B. Amend the canonical rule** to add `configEvidence` to receipts (simpler admission, one more stored field, a spec change).
- **C. Defer both** until the finished candidate shows which is smaller.

**Recommendation: A.** The spec rule already exists and was written to avoid duplicate stamps; the scratch work converged on it. The TS §8.8 change is a one-line description of behavior already in main. B changes a contract to fit one scratch experiment.

**Work that follows.**
- A: edit TS §8.8; reconcile `config-completion.md` §16.2; regression tests for stamp absence on receipts and for same-tree later-HEAD identity (the `[EVD-01, EVD-03]` test exists); implement §16.4/§16.5 consumer admission in slices.
- B: amend `config-completion.md` §16.2 and the schema; extend the migration upcast and the fence; the Receipt schema changes.
- C: no work; the decision returns.

**Effect on R1 definition of done.** Stale evidence reuse after a configuration change falls under never-waivable AC-07 and AC-27 (verdict policy), and AC-18. The identity amendment (A) documents behavior that already prevents a wrong "checked-local". CFG-01/03/04/08/09/10 are unmapped Musts that depend on this contract.

---

## 4. QLT-11: work-correction binding and deferred-R2 disclosure

**Context.** `trait-detection.md` is owner-signed for behavior; implementation waits on the integrated migration review. The review left two findings that no spec settles (plan §12.3, 2026-11-01): (1) a change correction can alter obligations without altering the project resolution or the candidate diff, and the spec binds only the project resolution (`TraitProjectState.resolutionHash`) into the work state (`schema-migration.md` §16.2.1, §20.2); (2) E19 requires disclosure of apparent R2 traits, but schema 2 admits only the ten R1 assessments and no notice format exists.

**Decision 4a: work-correction binding.**
- **A. Include canonical work assessments and current bound corrections in the existing facts projection.** No new persisted hash. This is the plan's own recommendation (§12.3).
- **B. Add a persisted work resolution hash** to `TraitWorkState`, matching the project-side `resolutionHash`. Explicit, one more stored field and one more consumer binding.

**Decision 4b: deferred-R2 disclosure.**
- **A. A static, registry-owned notice** naming `data-pipeline`, `infra`, `ml` and `mobile` as "not assessed in R1", shown wherever trait assessments are reported. No stored state. It is shown always, which is broader than E19's "a project appears to use an R2 trait"; E19 would be reworded.
- **B. A bounded `deferred` list in `TraitProjectState`**, filled from R2 signal stubs in the registry. Closer to E19's wording, but it needs a new schema field and partial R2 detection signals, and E19 says R1 claims no complete R2 detector.
- **C. Documentation only.** Fails E19 and the PRD disclosure intent.

**Recommendation: 4a-A and 4b-A.** 4a-A avoids a new stored field and needs only the regression the plan already requires (a same-diff correction must not keep dependent proof or a cached verdict). 4b-A is the only option that fits without a schema change; the cost is a notice that is sometimes irrelevant.

**Work that follows.** 4a-A: define the facts-projection fields and tests in the migration review; add the failing-first regression before implementation. 4a-B: add the field to §16.2.1, the decoder, the invalidation rule and the tests. 4b-A: amend E19 in `trait-detection.md`; add the notice text to the registry and one assertion. 4b-B: schema field, R2 stub signals, decoder and tests.

**Effect on R1 definition of done.** Decision 4a touches never-waivable AC-07 and AC-27 (verdict honesty); the plan says to raise it immediately and not to activate the incomplete design. QLT-11 is a Must (Beta, AC-20); QLT-13 and QLT-14 consume the same state. Neither alternative waives anything.

---

## 5. RES-05 result demo (RD-1 to RD-5)

**Context.** `result-demo-path.md` §§9 to 19 is a review draft; the owner selected the kernel-validated proposal direction (2026-11-01) and, for RD-4, "five currently retained screenshots; replace stale captures". RES-05 is a Must (Beta, AC-20) and unmapped. Current state: no `Result.demo` is emitted (§2); `Project.readBounded` is implemented as a primitive (§19.1); two real Playwright observations exist, one with path attachments and one with inline base64 bodies (§18.1, §19). The five decisions:

| ID | Subject | State |
|---|---|---|
| RD-1 | Strict bounded `FinishInput.demo` and structured `Result.demo`; source-checked, not executed | Reviewed at draft level (§17); owner review pending |
| RD-2 | Coordinator-declared applicability limit until QLT-11 change assessment exists | Owner review pending; needs decision 4 |
| RD-3 | Capture, report, then a receipt-bound manifest chain, with an optional receipt field | A stored-schema change (§13.2); fit unproven |
| RD-4 | Count selected; byte unit open; retirement mechanism superseded by §19 and incomplete | Partly decided |
| RD-5 | Finish identity and revalidation, ephemeral host boundary | Draft names an independent cache, cleanup and commit review as a precondition; not yet done |

**RD-4 byte unit.** The spec proposes 400,000 bytes and asks for the unit to be confirmed (§13.3). The repository reads kilobytes and megabytes as binary elsewhere: the bundle's "800 KB" limit is 819,200 bytes (TS §3.2; `tools/build.ts`), and the store's 50 MB record bound is `50 * 1024 * 1024` (`adapters/store-fs.ts:26`). By that convention the screenshot ceiling would be 409,600 bytes.

**Alternatives.**
- **A. Staged approval.** Approve RD-1 and RD-2 now. Order the independent cache, cleanup and commit review that RD-5 requires, then approve RD-5. Decide RD-3 and the RD-4 mechanism inside decisions 1 and 2, because RD-3 changes a stored schema and §19's capture accounting needs new storage code. Set the screenshot ceiling at 409,600 bytes. First slice is the command and example steps, which the spec says does not by itself complete RES-05 (§15).
- **B. Approve all five as drafted** for implementation now. This commits to a receipt-schema change and a capture-accounting mechanism before capacity is known, and §19 lists unfinished gates (raw-report image retention, the capture-only record format, worker and crash observations).
- **C. Coordinator-only rendering** (`result-demo-path.md` §5, approach 2). The kernel emits nothing; RES-05 becomes a host behavior. It would add RES-05 to the host-only bucket, cannot be tested deterministically, and ties verified commands and screenshots to host behavior that is unobserved.

**Recommendation: A.** It starts the part that needs no schema change, keeps RD-3 and RD-4 where their cost can be seen, and does not approve a step that its own review precondition has not covered.

**Work that follows.**
- A: implement the RD-1 contract red-first (`result-demo.test.ts`, DP-T01, DP-T02, DP-T07), then RD-5 after its review (DP-T05, DP-T06). Update TS §8.3 and UX §4.2 wording. RD-3 and RD-4: decide after 1 and 2, then DP-T03, DP-T04, DP-T09.
- B: the same plus the receipt field, `Project.readBounded` consumers, the Playwright helper, capture-only accounting, and the schema migration of decision 2.
- C: amend PRD RES-05 and TS §8.3; remove the demo contract; write a host-only test plan.

**Effect on R1 definition of done.** RES-05 is a Must (Beta). Under A and B it needs host acceptance for the rendering part (DP-2b, DP-T10); no unit test can establish it. Under C the whole requirement depends on the host. Screenshot privacy is not attested by any option (§13.4). No never-waivable item is touched.

---

## 6. ENG-09 trace contract

**Context.** ENG-09 (Must, Beta, AC-13a) requires trace events that "link intent revision, work, role, observed model, action, permission outcome, check outcome, timestamps and termination state, and shall declare visibility gaps". Three sources disagree or are silent:
- The PRD data-model table puts a "Trace event" at `.tenet/traces` (PRD line 552).
- TS §16 defines a `CallRecord` in the journal with `work`, `role`, `model`, `permission` (`approved | auto-approved | denied | unknown`), `checkOutcome`, `termination` (`completed | cancelled | timeout | crashed`) and `visibilityGaps?: string[]`. It has no field for the intent revision.
- The code writes `{verb, exit, revision}` only (`pipeline-render.ts:107`); the journal schema keeps extra fields (`adapters/store-fs.ts:31`, passthrough). None of the other fields exist.

The open points listed in plan §12.3 (2026-10-31): where the event lives, how it is correlated, the vocabulary for missing values, the taxonomy for action, permission and check outcome, the mapping to termination, and retention. Retention is partly settled: PRD §5.15 reduces traces older than 90 days to summaries, and `core/journal-reduce.ts` already does that for `call` records. Its monthly summary keeps counts by verb and by exit code only (`journal-reduce.ts:45-48`), so any new trace field would not survive in a summary unless the summary shape is extended.

**Alternatives.**
- **A. Extend the journal `call` record with fields the kernel observes** (work, verb as action, exit, revision, intent revision, check outcome, timestamps, termination) and write the host-dependent ones (role, observed model, permission) as declared visibility gaps with the explicit value `unknown` until a host mechanism qualifies. Use closed vocabularies registered like reasons. Reconcile the PRD table row to say traces are `call` records.
- **B. Same journal placement with the full TS §16 shape**, accepting coordinator-reported role, model and permission as fields labeled `reported`.
- **C. A separate `.tenet/traces` store** as the PRD table says. A new retention class and new store code.

**Recommendation: A.** It records only what the kernel can observe, matches the project's rule that `unknown` stays `unknown`, and uses retention that already exists. B can be added later for fields a host qualifies (SP-03, SP-04). C duplicates the journal and the store has no free space.

**Work that follows.**
- A: amend TS §16 (add `intentRevision`, closed vocabularies) and the PRD data-model row; extend the `tx.call` producer; a red-first test that a real call yields each field or a declared gap; check redaction (SEC-11); decide whether the monthly summary keeps any of the new fields.
- B: the same plus a rule for who may report each field and how reports are labeled.
- C: new store module, retention rule, redaction path, lint-arch and quality-ceiling impact.

**Effect on R1 definition of done.** ENG-09 is a Must. No never-waivable item is changed directly. Records must still carry no file contents, prompts, secrets or command output (TS §16; SEC-11 maps to AC-11 and AC-16, which are never-waivable). ENG-06 (Should) would use the same record.

---

## 7. GIT-03: configurable trailers or fixed names

**Context.** PRD GIT-03 (Must, M0), the PRD text at lines 582 and 1597, and TS §10.3 (step 4) and §10.7 say the `Tenet-Work` and `Tenet-Req` trailers are configurable. TS §10.3 (recovery) and §10.5 (undo) and the code require the exact name: the producer is `verbs/commit.ts:184`; commit recovery checks the exact `Tenet-Work` line (`adapters/git-cli.ts:743`); undo finds commits with a regular-expression grep built from the label (`adapters/git-cli.ts:878`). No setting for the names exists in the catalog. `Tenet-Req` is written and read by nothing else today (my grep of `packages/kernel/src`).

**Alternatives.**
- **A. Fixed names.** Amend PRD GIT-03 and §3.9.3 and TS §10.2, §10.7 to say the names are fixed in R1.
- **B. Configurable names.** Add settings; the producer and every historical consumer change together. Consumers that would need a list of every name ever used in the project: commit recovery, undo, the planned reconstruction (RC-2, RC-5 in `reconstruction.md`), the residue text. The user-supplied name would also enter a `git log --grep` pattern, so it needs validation. The history of names is stored state, so it would probably have to be part of schema 2.
- **C. Make only `Tenet-Req` optional** (emit or not), keeping `Tenet-Work` fixed because discovery depends on it. This is my variant; it satisfies "configurable" for the one trailer nothing reads.

**Recommendation: A.** The PRD gives no user need for other names, the requirement text for discovery is stricter than the requirement text for configuration, and B puts recovery and undo (AC-17, AC-25 safety) behind a new input. If the owner has a real user need, choose C before B.

**Work that follows.**
- A: edits to the PRD (GIT-03 and the two other lines) and to TS §10.3 and §10.7; a plan §12.3 row closed. No code, no test change (fixed emission already has walking-skeleton coverage).
- B: new catalog entries, name validation, name-history state, edits to `commit.ts`, `git-cli.ts` (42 free characters), the reconstruction design, and kill and undo regressions.
- C: one catalog entry and a branch in `commit.ts`; a test; spec edit for the one trailer.

**Effect on R1 definition of done.** GIT-03 is an M0 Must; its safety side (human work never committed or reverted, index preserved) is the never-waivable AC-25 and does not change under A. B would need the recovery and undo regressions re-run as AC-17/AC-25 evidence.

---

## 8. WRK-08: extension wording versus the active-time mechanism

**Context.** WRK-08 (Must, M0, AC-15c, AC-19) says at the bound Tenet stops "with a diagnosis and a specific extension proposal". The mechanism extends only active time: the refusal proposes an interval and `decide extend` (with the user's words) zeroes the time since check-in (`decisions/extend.ts:12`; TS §8.6 "Active time"). Attempts, review rounds and delegations stop with `budget-exhausted` and a next step ("finish with the current evidence", "stop and diagnose"; `verbs/manifest.ts:43,115`, `core/review.ts:157`). No approved mechanism extends them. A proposal to reset the global counters was reviewed and rejected as inconsistent with these semantics (plan §12.3, 2026-11-01).

**Alternatives.**
- **A. Clarify the wording.** Only the active-time check-in is extendable. For the other three bounds the stop gives a diagnosis and its next step. Amend PRD WRK-08 and §4.4.2 and TS §8.6 accordingly.
- **B. Add extension for every bound.** A separately reviewed contract: what a user grant means for attempts, rounds and delegations, how it interacts with repeated-failure stops, reservations and the lane limits (PRD §4.4.2 values are "Provisional", mechanism class "Boundary-checked"). `core/budget` has 64 free characters.
- **C. Extend attempts and active time only.** Review rounds and delegations are tied to risk floors and reservations. Would still need its own contract.

**Recommendation: A.** It matches what is built and tested (`active-time` boundary regression, plan §1) and avoids reopening the budget core. If the owner wants B or C, it should be a new spec with its own review.

**Work that follows.** A: three wording edits; close the plan §12.3 row; no code. B or C: a feature spec (lifecycle step 1), review, sign-off, then red-first tests for each extension, `core/budget` changes within its ceiling or after decision 1.

**Effect on R1 definition of done.** WRK-08 is a Must (M0). Under A the requirement text matches the mechanism and no never-waivable item changes. The plan row for the separate NFR-05 gap (provider, tool and network time) is unaffected.

---

## 9. The missing `publish <push|pr>` verb

**Context.** TS §6.5 lists `publish <push|pr>` (class M, consequential) and §10.6 specifies it: `decide {request: remote}` binds URL, branch and exact commit; push uses `git push` with `git ls-remote` reconciliation; a PR uses `gh pr list --head` then `gh pr create`. `packages/kernel/src/verbs` has no `publish`; `decisions/` has no `remote` kind; the invariant test asserts there is no verb and no remote Git command (`packages/kernel/test/invariants.test.ts:28`); `tools/lint-arch.ts:47` says remote effects arrive "after M0". No plan row schedules it (plan §13, 2026-11-03). GIT-05 (Must, M0) holds today because it restricts remote actions to explicit requests and none exist. UX J-06 describes the user flow ("Reply 'push' or 'cancel'"); PRD J-06 lets the user push or open the PR themselves. The coordinator skill lists `publish` among the verbs it only offers (`SKILL.md`). A fake-`gh` and bare-origin fixture design is in TS §17.

**Alternatives.**
- **A. Schedule it for R1.** Add the verb, the `remote` decision kind, `git push`/`ls-remote`, the `gh` calls, fixtures, reason codes. No estimate exists in any spec. It needs `git-cli` (42 free) and central (37 free) growth, so it depends on decision 1.
- **B. Cut it from R1 as an explicit recorded product decision.** Narrower claim: Tenet never runs remote Git commands; the coordinator drafts the PR brief in chat (GIT-06) and the user pushes or opens the PR.
- **C. Schedule the PR brief only** (the kernel renders the brief, no push).

**Recommendation: B.** The PRD requirement (GIT-05) is satisfied by the absence of remote commands, plan principle 2 says to ship an operation only with its safeguards or not at all, and the build has no free space for the remote safeguards. The cut list in TS §19.4 cannot be extended without "an explicit, recorded product decision" (plan §11.2); this answer is that record.

**Work that follows.**
- A: a feature spec for `publish` (the §10.6 text is a sketch), review, sign-off, `invariants.test.ts` and `lint-arch.ts` changes, adapter and verb code, fake `gh` fixtures, `SKILL.md` text, plan rows.
- B: edit TS §6.3, §6.5, §10.6, §17, the allowlist pattern in §4.6, UX J-06, `SKILL.md` row for `integrate`/`publish`, the `lint-arch.ts` comment, and the plan's GIT-05 narrower claim. Keep the invariant test.
- C: as A for the brief only.

**Effect on R1 definition of done.** GIT-05 stays a Must that passes (no remote action without request). AC-25 (never-waivable safety cases) concerns human work, which is not touched; its "no remote effect without request" clause remains true. GIT-06 (Should) is decided in decision 11.

---

## 10. The pre-authorized cut list (TS §19.4)

**Context.** The list is applied in order if a module exceeds its budget by more than 25% or a milestone slips (plan §11.2). Decision 1's measurements meet the first trigger for two owners; the milestone estimates in plan §12.17 are also behind. Five items, each with a narrower claim already defined. Facts that bear on each:

"Built?" below: in source, `check --stage committed` is refused (`verbs/check.ts:122`), `open recipe-upgrade` is refused as not implemented (`verbs/open.ts:32`), nothing mentions `import-ci`, and no sealed-checkout code exists (the words appear only in two reason-code descriptions and the receipt stage enum).

| # | Cut | Built? | Requirement tied to it | Note |
|---|---|---|---|---|
| 1 | Committed-tree check (scope stays "working tree with your edits") | no | none: the sealed-baseline spec says slice 2 has no PRD ID | The owner's decision 40 A (2026-10-25) put both sealed-baseline slices in scope without narrowing the cut list (`sealed-baseline.md` D1). Estimate there: `git-cli` +70 lines, verbs +180 (§15.6, unverified). |
| 2 | `check --import-ci` (`ci-external` unavailable) | no | EVD-14 (Should) | `inspect`/`check` have no import path. |
| 3 | Sealed baseline checkout (`classification-unknown`) | no | **EVD-04 (Must, Beta)** | See the defect below. |
| 4 | Recipe upgrades (manual migration guidance) | no | QLT-15 (Should) | Plan §9.2 already says "or cut". |
| 5 | MCP front-end, if the command line wins SP-12 | no MCP code in the repository | none | SP-12 is not complete (plan §4.2: N=3, the bar is 3 tasks × 5 runs). |

**Defect found.** Plan §11.2 ends with "Nothing on this list is a Must requirement". EVD-04 (PRD line 822) is a Must and requires the sealed-checkout rerun, which is cut 3. `sealed-baseline.md` D1 already states the conflict ("a Must is narrowed only by a recorded PRD §4.7 waiver") but the plan sentence stands. Propose it for §12.3.

**Alternatives.**
- **A. Take cuts 1, 2 and 4 now; hold 3; record 5 as "no MCP code ships unless SP-12 selects it".** Cuts 2 and 4 remove only Should items. Cut 1 reverses owner decision 40 A for slice 2 only.
- **B. Take cut 3 as well.** Needs the recorded trigger and a PRD §4.7 narrowing of EVD-04, whose AC links (AC-18, AC-19) are waivable only by narrowing.
- **C. Take none now**; decide after decision 1 fixes the ceilings.

**Recommendation: A.** Cuts 1, 2 and 4 follow the list's own order, delete nothing that exists, and the narrower claims are written. Cut 3 stays held because it narrows a Must and its cost is the largest of the five; hold it until decision 1 shows whether a ceiling that includes the sealed-baseline estimate is acceptable. If the owner declines that raise, B is the next step and needs the waiver.

**Work that follows.**
- A: record the trigger in the plan; mark the EVD-14 and QLT-15 rows `✂️` with their narrower claims written out (plan §0.1); amend `sealed-baseline.md` to mark slice 2 cut; correct plan §11.2's sentence.
- B: add the EVD-04 narrowing to the waiver list; `classification-unknown` must then be produced (it has no producer today, plan §13 2026-11-03), with a fixture.
- C: nothing.

**Effect on R1 definition of done.** Cuts 1, 2 and 4 touch no Must. Cut 3 narrows EVD-04 and needs the §4.7 route; the never-waivable AC-27 verdict table must still be shown to pass with `classification-unknown` outcomes (the narrower claim is the honest one, not a pass).

---

## 11. The 19 Should items

PRD §4.7: each Should "passes, or has an owner-signed omission". The owner signs each individually; the "proposed" column is my proposal only, and a "no" does not decide anything. "Implement" below means "meet the requirement and gather evidence", and for several it means "close with evidence for something that mostly exists". The coordinator skill is at its 4,000-token cap, so any new instruction needs an equal deletion.

| ID | Requirement (short) | State I found | Proposed | Reason |
|---|---|---|---|---|
| INS-08 | README explains the native recovery path when policy blocks install | `README.md` and `plugin/README.md` have no mention of policy | Implement | Documentation only |
| INT-13 | Designate existing planning documents as intent sources | Not built. A test carries the tag but its title is about byte preservation around managed blocks; not reviewed | Omit | Needs a different intent projection; no capacity. Narrower claim: Tenet writes `INTENT.md` |
| INT-14 | Keep `docs/architecture.md` current | Not built; `shared-files.md` §1 and §9 defer it to "if the owner wants it before R1" | Omit | Needs a new `decide` kind in a full owner. Narrower claim: Tenet does not maintain the architecture document |
| AGT-09 | Focused same-session pass for small tasks, not called a separate agent | Test `focused-review.test.ts` carries `[AGT-09, REV-01]` | Implement | Exists; close with evidence |
| TDD-05 | Refactor after green, rerun affected checks | "refactor" appears in the agent, command and skill text | Implement | Instruction level; mechanism class is cooperative |
| EVD-14 | Imported CI results marked externally produced | `--import-ci` not built | Omit | Follows cut 2 |
| RES-08 | In Guided style offer to start the local app under native consent | Not built; `result-demo-path.md` §12.5 says startup is a separate coordinator action not implemented | Omit | Depends on RES-05 commands, host consent is unobserved, skill budget full. Narrower claim: the result gives run instructions only |
| RES-09 | Show the Deep budget envelope before Deep work | `deep-budget-preview.test.ts` checks the skill text; TS §8.6 describes the preview | Implement | Exists as instruction; close with evidence |
| GIT-06 | Draft a PR description on request | Not built; TS §10.6 attaches it to `publish pr` | Implement | As a chat draft from contract, evidence and open findings; no remote effect; fits decision 9B |
| GIT-07 | Starter includes a CI workflow running the same checks | `template/.github/workflows/ci.yml` runs typecheck, lint, test, build, OpenAPI and e2e on Node 22.12.0 and 24 | Implement | Exists; I did not compare it with the recipe's declared obligations |
| GIT-14 | Offer to delete a work branch after integration or abandonment; never delete unintegrated work without consent | No `branch -d` in source or plugin text | Implement | As a text offer naming the branch and command, with the user running it; no kernel deletion, so no capacity cost. If the owner means Tenet deletes it, omit |
| CFG-07 | Explicit "always in this project" corrections persist locally with provenance; inferred ones need confirmation | `decide config` persists project settings; tests carry the tag. Owner D5 excluded per-setting provenance history | Implement | With the narrower claim "layer revision, not per-setting history" |
| RSC-05 | Conserve prefers focused passes for optional roles; Serial dispatches no optional or parallel subagents; required review still runs | `resource_mode` is a setting passed to the coordinator in `open` (`core/config.ts:22`, `verbs/open-context.ts:17`); no kernel enforcement | Implement | Cooperative instruction, labeled as such; skill text must replace, not add |
| LRN-04 | Propose lessons only when supported by evidence from that work, for confirmation | `decide lesson` exists (`decisions/lesson.ts`); I did not check the evidence rule | Implement | Verify the rule, then close |
| QLT-08 | Handover keeps README run instructions, decision records, architecture doc and CHANGELOG current | Overlaps INT-14, INT-09 (S1 unsigned) and RES-05 | Omit | Narrower claim: the handoff names documents the user may want to update |
| QLT-15 | Record recipe version; offer recipe upgrades with a diff | Not built | Omit | Follows cut 4 |
| ENG-06 | Trace fields follow the pinned OpenTelemetry GenAI subset | TS §16 says the diagnostics export maps names; `inspect` has no `export` view (`verbs/inspect.ts:32`) | Omit | Needs the export and decision 6. Narrower claim: plain field names |
| OSS-03 | RFC process and certification levels for outside contributions | `CONTRIBUTING.md:95` says the process is not written and such contributions cannot be accepted | Implement | Documentation only; or omit with the current sentence as the narrower claim |
| OSS-06 | `/tenet feedback` produces a redacted, previewable report | No `export` view; not built | Omit | Needs the export; narrower claim: users file issues by hand |

Count: 11 implement, 8 omit. Tags on tests are structural mapping, not acceptance; the evidence ledger has no entries, so none of these has a disposition today.

**Alternatives for the packet as a whole.** A. Sign each line as proposed. B. Sign each line with the owner's own choice. C. Defer all signatures until after decisions 1, 9 and 10. The owner signs per line in any case.

**Recommendation.** Answer after decisions 1, 9 and 10, because the "omit" lines for EVD-14, QLT-15, GIT-06, ENG-06 and OSS-06 follow from them.

**Effect on R1 definition of done.** Each omission is a signed record published with the release (PRD §4.7). No Should is never-waivable.

---

## 12. External lead-time requests to start now

**Context.** The plan estimates 14 to 25 weeks on the critical path and says host and participant scheduling take most of the time in phases C and D (plan §12.17, "Start host/pilot access requests in parallel"). A coding session cannot start these. What the owner can do now is authorize the requests to be prepared and sent. Each campaign, spike, recruitment and spend still needs its own authorization (plan §4.5, §12.13): a request is not a run.

**Four request groups.**

1. **Host access.** A native macOS arm64 workstation with the proposed R1 tuple: VS Code stable desktop, the Local agent harness, a Copilot plan and organization policy that allow agent mode, plugins, custom agents and subagents (PRD §2.2). No qualified tuple is recorded; the 2026-10-19 spike run did not record the extension version (plan §4.1). A green GitHub macOS runner is not installed-host evidence (plan §12.13). Spikes waiting on this: SP-08 completion (its authority is exhausted, plan §12.14), SP-01 (the 16-minute command test needs a rerun, plan §4.1), SP-02, SP-06 and SP-10 dispositions, then SP-12 (3 tasks × 5 runs per front-end; observed N=3 so far). Unobserved today: parallel dispatch on the tuple, cancelled children, `usages`, instruction-file precedence, `.tenet/` indexing exclusion.
2. **Model tuple and account.** Which model and how it is observed (`Auto` behavior is SP-04; RSC-08 needs golden-suite results to label a model). The evaluation account is partly decided: existing-account serialized windows, included allowance only, no overages (decisions 21 B, 22 A, plan §4.5). Still open there: the account identifier, terms and organization-policy checks, externally verified enforcement, finite limits, isolation, run authorization. Q-16 funding is tied to SP-05 and SP-11 (plan §4.3).
3. **Participants.** 8 to 12 external technical builders, at least 2 task pairs each, plus a two-week follow-up (PRD §6.6.2); formative: 5 unfamiliar builders for AC-02, six formative sessions, 10 or more eligible tasks across 2 repositories (PRD AC-02, AC-12; plan §12.12 row I). Research consent is separate from product consent; research data is deleted 90 days after analysis unless the participant agrees otherwise (plan §4.5). Recruitment needs its own authorization.
4. **Release and review prerequisites.** Publisher, namespace and final name (plan §4.5, §9.5); a signing identity for the signed tag and provenance; an external reviewer for the 72-hour public review window the solo-maintainer rule requires (PRD line 1493); a clean environment for the independent source and dependency rebuild; 10 reserved qualification tasks stored outside the public catalog (plan §9.3).

**Alternatives.**
- **A. Authorize preparing and sending all four groups now.** Each request names what it does not authorize (no run, no spend, no recruitment, no publication).
- **B. Start groups 1 and 2 now; hold 3 until decisions 1 and 2 settle,** so participants are not scheduled against a build that may not exist.
- **C. Start nothing until Phase B.**

**Recommendation: A.** The lead time is the longest item on the path and the requests commit nothing. Group 3 can be sent as an interest request that asks for no commitment. If the owner is concerned about scheduling people against an unfinished build, choose B.

**Work that follows.** A: draft the four requests and a tracking list in the plan; record the tuple once chosen; then request authorization for each spike or campaign by name. B and C: the same for the groups chosen; later groups follow decisions 1 and 2.

**Effect on R1 definition of done.** AC-28 (never-waivable) requires the native-host suite on the qualified tuple; AC-16, AC-17 and AC-25 need host evidence for their host-visible cases. Sixteen Musts are host-only today and 0 of 181 are qualified (plan §1). None of these closes without group 1 and group 2.

---

## Other gates found while reading, not among the twelve

Each of these needs an owner decision or sign-off before the work they gate. They are listed so that none is forgotten; I have not made recommendations on them.

- **Starter memory on Node 24.** `starter-runtime.md` (draft, not ready for sign-off): the unchanged starter peaks at 403,046,400 bytes and the best candidate at 357,793,792 bytes on pinned Node 24.22.2, against a 300,000,000-byte target; Node 24 is a supported LTS line. The alternatives the spec lists as "not selected" (heap flags, narrower runtime support, a higher target) change the requirement, so a decision is needed if the candidates keep failing.
- **Sealed baseline D4 to D8** (`sealed-baseline.md` §16) and its short independent review; D1 to D3 are resolved.
- **Shared files S1 and S3a** (INT-09, GIT-09) are unsigned; S2 is implemented. S3b needs its own spec.
- **Reconstruction D1 to D6** (`reconstruction.md` §13) for CON-07, including the tag grammar defect (`[EX-…]` as built versus `// @tenet` as specified).
- **Storage retention** deferred mechanisms for CON-08 (snapshot pruning, archive compaction, per-machine run-file cap; `storage-retention.md` §12).
- **Sixteen reason codes have no producer and eleven more have no test** (plan §13, 2026-11-03). Each needs a spec check before it is built or removed.

## Spec and plan defects found while preparing this packet

I did not edit `plan.md` or `CHANGELOG.md`, because other lanes are editing them in parallel. The integrator should add these rows to plan §12.3.

1. **Plan §11.2 says "Nothing on this list is a Must requirement"; EVD-04 is a Must that needs cut item 3.** Sources: PRD line 822; TS §19.4; `sealed-baseline.md` D1. Does not touch a never-waivable item directly; AC-27's verdict table depends on the honest `classification-unknown` claim.
2. **Plan §11.1 and §13 (2026-11-03) cite a 250-line verb file cap; TS §6.2 and `tools/coverage.ts:348` use 265.** `verbs/recover-effects.ts` at 263 lines is inside the actual cap. The plan text is stale; no source defect.
3. **PRD data-model row (line 552) puts trace events at `.tenet/traces`; TS §16 defines them as journal `call` records; the TS record omits the intent revision ENG-09 requires.** Resolved by decision 6.
4. **Plan dashboard says owner budgets are "within 5–214 characters of their caps".** Measured today: `core/schemas` has 528 free and `adapters/node-ts` has 0. Stale text from the October 31 figures.
5. **TS §3.2 and §9.10 state sizes as "KB" without a unit definition; the code reads them as binary** (`tools/build.ts:13` uses `800 * 1024`; `adapters/store-fs.ts:26` uses `50 * 1024 * 1024`), and the result-demo spec proposes decimal 400,000 for the screenshot. Resolved for the screenshot by decision 5.
