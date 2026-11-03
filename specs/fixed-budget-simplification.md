# Fixed-budget simplification work plan

October 31, 2026. **Owner-selected direction; candidate design and feasibility remain incomplete.**

## Constraint and objective

The owner selected “Keep all budgets fixed and pursue a larger behavior-preserving simplification” during the implementation reassessment. This supersedes the capacity proposal's recommendation to request larger envelopes. Keep the complete configuration/migration behavior and every safeguard; preserve existing public/stored schema-1 behavior while simplifying its implementation. No new budget or reduced semantic scope is inferred.

The [reviewed capacity inventory](protocol-capacity.md) remains the responsibility checklist and estimate provenance. Its recommendation is historical; its additive forecast is not proof that a replacement implementation cannot fit. Conversely, no sufficiently small replacement implementation has been measured. Do not call the direction feasible merely because a refactor is planned.

## Measured starting point and required savings

The current `measure`/`budgetChars` exports reproduce the existing source sizes. All figures below are non-whitespace characters using the actual quality gate. The last two columns use the reviewed **additive planning model after its 180-character candidate saving**, not measured target source.

| Existing owner | Used | Fixed ceiling | Free | Low-model excess | High-model excess |
|---|---:|---:|---:|---:|---:|
| schemas | 26,863 | 26,899 | 36 | 6,937 | 11,437 |
| pipeline + verbs + decisions | 241,796 | 241,805 | 9 | 14,138 | 23,338 |
| store | 24,920 | 25,920 | 1,000 | 7,700 | 13,300 |
| budget | 8,585 | 8,640 | 55 | 2,745 | 4,745 |
| Git | 37,801 | 37,843 | 42 | 78 | 198 |

Runner/review/verdict headroom cannot be borrowed by relocating another owner's responsibility. Bundle capacity is independently fixed at 819,200 bytes, currently 776,837. Coordinator capacity is independently fixed at 4,000 estimated tokens, currently 3,999. Passing one gate says nothing about the others.

**Baseline reconciliation (November 1).** The canonical pipeline/verbs/decisions ceiling is **247,219 characters**; current main source measures **247,213**, leaving **6** (`tech-spec.md` §6.2 and `tools/lint-quality.ts`). The table's **241,805** ceiling and additive low/high model are historical measurements from before the approved central-owner ceiling updates; they are not current capacity or feasibility evidence. Refresh every owner measurement and both complete-target scenarios from the same responsibility inventory before using the forecast to accept or reject a candidate. Do not infer that the larger ceiling makes the target fit.

**November 2 source resnapshot:** exact current-source owner counts and the candidate bundle/instruction identities are recorded in [protocol-prototype.md](protocol-prototype.md), using the existing quality and skill measurement logic. This supersedes the November 1 current-source figures above for present-day sizing; the additive target model remains an estimate predating the QLT-11 expansion, not a measured candidate or fit claim. Recompute the full candidate against the same frozen source before drawing conclusions.

## Refactoring sequence and equivalence obligations

1. **Freeze the observable contract and all actual producers.** Use the current schema-1 source/bundle as the oracle in isolated scratch copies. Inventory strict versus stripping objects, optional/missing/null behavior, defaults, diagnostic paths, serialized key order where observable, nine effect forms, cached responses, clock/random calls, store publication order and external jobs. Preserve no-follow reads, permission/error distinctions, fsync order, process ownership and conservative refusals. Compare real producer records, not only hand-constructed “valid” objects.
2. **Schemas: share actual record definitions and derive input/result views.** Start with `BasisElement`/`BasisElementInput`, `Finding`/review/Analyst locations, review axes/status and record projections. Use existing Zod shape/pick/extend facilities only where behavior and diagnostic equivalence are established; preserve distinct bounds and strictness. For the target, reuse unchanged legacy field validators and specify the exact changed overlay instead of duplicating whole legacy/target records. Legacy decoding remains inside the same measured owner. These are candidates, not assumed multi-kilobyte savings.
3. **Central owner: remove repeated state assembly and duplicated lifecycle wiring.** Inventory intent/work replacements in overview, plan, decision records, basis, open/stop/finish and recovery. A shared immutable update helper may replace identical assembly inside this owner, with revision increments still explicit at their original sites. Inspect repeated decision parsing/question assembly separately; never merge different fact-binding, decline, consent or error semantics merely because their syntax looks alike. Preserve provisional/final response rebuilding, input identity and every publication boundary. Do not add a second dispatch engine or default implicit authority.
4. **Accounting: share counter operations without changing accounting semantics.** A single typed list can drive repeated monotone-counter comparison/maxima; one active-gap function can serve warning/time-up/accrual. Keep signatures, reservation fields, check-in resets and total-versus-since-check-in distinctions explicit. Test reordered/missing/conflicting checkpoints and two restarts. This is a candidate reduction, not permission to adopt the unfinished launch protocol.
5. **Store: design replacement around existing read/write/lock primitives.** The private reader is already centralized. Preserve its bounded descriptor read, UTF-8/depth checks, symlink refusal and different absent/corrupt/unsupported outcomes. Do not “simplify” by catching more errors, dropping directory sync, merging admission and diagnostic reads, or moving store logic to an uncapped file. No concrete safe store candidate approaching the modeled 7,700–13,300-character excess has yet been demonstrated; this owner is a required feasibility stop.
6. **Re-estimate the complete replacement, then validate jointly.** For every proposed deletion identify the exact responsibilities still supplied and the tests that distinguish them. Count savings once, keep all 28 capacity responsibilities, and compile the whole candidate. Replace additive forecasts with actual sizes as implementation candidates become available. A small helper or schema consolidation does not establish target feasibility.

## Test homes and stop conditions

| Boundary | Required observations |
|---|---|
| Schema/input/result equivalence | Existing core/contract/boundary/review tests plus differential old/new acceptance, parsed values and diagnostics for actual producer records, unknown keys, omitted/null fields and boundary sizes |
| Central state/revision/UX | Overview/plan/decision-record/adopt/stop/finish/recovery and idempotency suites; exact questions, fact hashes, unchanged no-op revisions, cached/provisional/final behavior and user-byte preservation |
| Budget | Core/accounting/recovery suites; identical signatures/time/reset behavior and monotone counters under every admitted checkpoint order |
| Store/Git | Existing real lock races, permissions, no-follow, kill prefixes, rollback, index/human-edit preservation and repeated recovery; no substituted in-memory proof |
| Complete candidate | All existing quality/architecture/token/bundle/payload gates, full CI and current/minimum built UAT; complete target protocol integration and kill matrix before schema activation |

Do not modify `tools/lint-quality.ts` budgets or matchers, `quality-baseline.json`, the bundle limit, instruction limits, tests' deadlines/populations or source ownership to make a candidate pass. Do not shorten identifiers/comments or introduce a compact schema DSL solely to manufacture room. A candidate is accepted for simplification only when it reduces duplicated responsibilities and preserves behavior. Any changed behavior belongs in a separately reviewed implementation slice.

If the complete candidate still fails a fixed gate, retain the source and report the actual measured failed owner and unfulfilled responsibilities. The owner has selected fixed budgets; requesting a larger envelope is not the default next action. Return to replacement design or the already authorized cut list where applicable. Never silently drop a Must or a safeguard.

## Measured scratch candidate

The [accounting candidate patch](../docs/audits/2026-10-31/budget-candidate.patch) replaces the duplicated seven-field monotone counter inventory with one typed `MONOTONE_COUNTERS` list for comparison and maxima. It preserves the existing spread order and keeps signature selection distinct. Source measures **8,585 → 8,298 characters**, saving **287**. Bundled old/candidate recovery functions produce byte-identical serialized results in **8,000 deterministic generated comparisons**, covering increased/regressed counters and duplicate/gapped/absent checkpoints. The inputs are generated examples, not exhaustive equivalence or actual full producer coverage. [Exact identities and limits](../docs/audits/2026-10-31/budget-candidate.json).

The patch remains uninstalled. It improves cohesion but cannot supply the budget owner’s modeled 2,745–4,745-character deficit, much less the other four owners. No whole-target fit or behavioral qualification follows.

## Installed first slice (October 31 continuation)

The [continuation audit](../docs/audits/2026-10-31/continuation.md) records schema views, shared monotone accounting and private-map replay, redundant response defaults, and set-based inventory membership. Installed sizes are schemas **26,404/26,899**, accounting **8,362/8,640**, central **241,647/241,805**. Store and Git are unchanged. Net source saving including attribution is **818 characters**. All ceilings/matchers/ratchets remain fixed. Differential producer/probe evidence and final built validation are linked from that audit. Separately, red-first own-property/configuration-attention repairs close reproduced human-preservation and review gaps within these ceilings.

The earlier 287-character scratch patch above remains historical and uninstalled as written; the broader accepted accounting implementation saves 223. The first slice does not establish complete replacement fit. No store replacement approaching its forecast has been demonstrated, and protocol final review/sign-off is still open.

## Status

The source sizes are remeasured, the required reduction by owner is explicit, and candidate boundaries/equivalence checks are identified. **A bounded simplification slice is installed locally; no complete target candidate is implemented or proven to fit yet.** This document is a work plan, not a final refactor specification, independent review, target protocol sign-off, or schema activation. Authentication/loan authority repair 0.4.1 is separate and changes no kernel budget or protocol.

## October 31 takeover measurements

The [current checkpoint](plan.md#1216-october-31-main-takeover-and-current-completion-order) validates the inherited ctime-restoration guard and shared run enumeration, then repairs the synchronized writer's missing UTF-8 byte bound. Store now measures **25,706/25,920**, with **214** characters free; the earlier 24,920 measurement is historical. Central, schemas, accounting and Git remain at the installed first-slice measurements above.

A concrete immutable intent-replacement helper plus nine caller conversions measures central **241,647 → 241,715**, growing **68** characters after imports/comment/signature overhead. Its focused 119 controls pass, but it is removed together with its two candidate-only controls: no saving or installed abstraction is claimed. Explicit revision increments and original caller assembly remain. This rejects one small candidate, not every possible central replacement design.

Final local CI passes **1,258 tests/204 suites**; both actual built runtime journeys pass **152** UAT scenarios and complete **101/12 neutral, 133/16 evolved** application/browser cases. [Exact source/artifact identities and limits](../docs/audits/2026-10-31/takeover-validation.json). No fixed limit or assertion is relaxed, no responsibility moves to another owner, and no complete target fit or final protocol approval follows.

## October 31 schema-validator continuation

Reuse the actual basis record's optional support/output/test/expectation validators in obligations, derive the input's consecutive unchanged fields with `pick`, and share the identical receipt/history status definition. Keep the input's tighter support limit, original key order, explanatory comment, strictness and defaults. No compact schema language, owner relocation or new contract is introduced. Schemas measure **26,404 → 26,269/26,899**, saving **135** characters with **630** free. Other owners and every fixed ceiling remain unchanged.

Two characterization controls pass before and after the refactor; two scratch mutations fail their intended assertions. Frozen-before/current comparisons preserve all **52** generated JSON schemas and **5,060** acceptance/value/key-order/diagnostic probes, including **46** distinct actual lifecycle-produced records across **18** schema types. These are bounded observations, not exhaustive equivalence or independent review evidence; review transport in the fixture is synthetic. Full local CI passes **1,266 tests/204 suites**, zero failures/cancellations/skips. Node26/22 each pass **152** actual bundled CLI UAT scenarios and complete **103/12 neutral, 136/16 evolved** app/browser journeys plus the brownfield CLI/library fixture. Node22/24/26 pass both new schema controls. [Exact identities and limits](../docs/audits/2026-10-31/schema-sharing-validation.json). This additional saving does not establish a fitting implementation of the 28 protocol responsibilities or authorize schema-2 activation.
