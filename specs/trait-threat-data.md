# Specification: Threat and data note for sensitive change traits (QLT-13)

> Status: **draft, unreviewed.** Written 2026-11-03 under the owner's blanket direction of that date to build candidates on an isolated branch. That direction is not a sign-off. This spec is not part of the canonical specs, changes no source, and authorizes no implementation. It extends `trait-detection.md` (TD-10, E20) and depends on QLT-11, which is itself blocked on the schema 1 to 2 migration gate. Open owner questions are in §9.
> Sources: PRD QLT-13, §5.16 ("Threat and data note"), §3.8.4, §3.8.5, AC-20; Tech Spec §§5.1, 5.3, 8.2, 8.3, 13; `trait-detection.md` TD-6, TD-8, TD-10, E20, E22; `docs/audits/2026-11-03/unmapped-musts.md` row QLT-13.
> Shipped with this spec: the review resource `plugin/skills/tenet-review/resources/threat-note.md` (Tech Spec §5.1), and its line in `tools/payload-files.json`.

## 1. Outcome

When a change carries `auth`, `persistence`, `personal-data` or `external-effects`, the contract holds a short threat and data note: who acts and where the trust boundaries are, which objects and operations need protection, what sensitive data exists and how long it is kept, and what a hostile or careless actor could try. Every security item in the note is a test or a constraint in the acceptance basis, so the verdict and the reviewer see it as they see any other requirement. An item that is neither stays visibly open and blocks `checked-local`.

Out of scope: detecting the traits (QLT-11); the per-trait obligations other than the note (QLT-14 and `trait-detection.md` E13 to E17); a security review of the whole application (the Deep security pass, TS §5.3); and any claim that the note's items are complete (a missing hostile case is for the reviewer to find).

## 2. Current state (read from this tree, `34d6030`)

- No note exists. `grep` finds the note only in `security.md` (a threat note there means one finding per concern, a different thing) and in the PRD and Tech Spec text. The coordinator skill and the intake skill do not mention it.
- `trait-detection.md` TD-10 and E20 specify the behavior and name the test file `packages/kernel/test/trait-threat-data.test.ts`. They leave the note's shape and the consequence of an unlinked item open ("an unlinked item remains open").
- The trait core (`core/traits.ts`) is pure and not wired into any verb or the stored state. It provides `TraitWorkState` (change assessments with outcome `present`, `not-indicated` or `unknown`, and the corrections that currently apply), `workTraitFacts` and `changeTraitRaises`. Nothing stores or consumes change traits yet.
- The basis is a set of `BasisElement`s (`requirement`, `example`, `invariant`, `constraint`, `assumption`, `decision`, `deferred`) stored in `project.intent.elements`; `work.basis` holds their IDs, a hash and a legacy `traits: string[]` (`core/schemas.ts:49, 261`). An example or invariant with a `test` becomes an obligation with a receipt. In `judgeElement` (`core/verdict.ts`) a `constraint` needs no verification, an `assumption` needs the user's confirmation, and anything else needs a fresh passing obligation, a review or a stated reason it does not apply.
- Lane floors: `auth` paths raise `access`; `external-effects` and `personal-data` change traits raise their dimensions; a migration raises reversibility and compatibility (TS §8.2, `core/risk.ts`). A `persistence` change that touches no migration raises nothing, so it can stay Quick, and the lane table puts the note in the Standard lane only (TS §5.3).
- The Reviewer and Analyst agents "cannot load skills" (`tenet-reviewer.agent.md`, `tenet-analyst.agent.md`); their instructions come from the manifest's `rubric`, which the kernel builds in `core/review.ts`. Resources under `tenet-review/resources/` (`security.md`, `architect.md`, and the new `threat-note.md`) are not referenced by any skill or agent text today. Whether a host reads them on demand is unobserved. This is recorded as a spec defect in plan §12.3.
- The coordinator skill body is 3,992 of 4,000 tokens (measured with the lint's own count). `tenet-intake` is 1,345 of 4,000; `tenet-review` is 824 of 4,500.
- Persisted records gain fields only through a schema version the owner approves; nested plain `z.object`s strip unknown keys on publish (`schema-migration.md` §16.7).

## 3. Requirements

| ID | Requirement | Source |
|---|---|---|
| TN-1 | The note is required for a change when any of `auth`, `persistence`, `personal-data`, `external-effects` has effective outcome `present` or `unknown` among the change traits. A correction that applies decides the effective outcome. `not-indicated`, an absent trait, and a project trait without a matching change trait do not require it. | QLT-13; `trait-detection.md` TD-6, TD-8, E3, E11 |
| TN-2 | The note has four sections: actors and trust boundaries, protected objects and operations, sensitive data and retention, abuse cases. It is short: at most 12 entries, each at most 300 characters. | QLT-13; PRD §5.16 |
| TN-3 | Every entry in the protected-objects, data and abuse sections is a constraint, or an example or invariant with a test. An entry that is neither is open. | QLT-13 ("security items become tests or constraints, not just review notes") |
| TN-4 | Every section has at least one entry. A section that does not apply says so through an entry that states it (for example a constraint "no sensitive data is stored or logged by this change"). | QLT-13 ("a short ... note") |
| TN-5 | If a required note is missing a section, or any entry is open, the verdict carries `threat-note-open` and cannot reach `checked-local`. | QLT-13; E20 |
| TN-6 | One note covers a change that carries several of the four traits. It is not required once per trait. | `trait-detection.md` E17; QLT-13 |
| TN-7 | A change of trait state (a new assessment, a correction, a changed candidate diff) recomputes the requirement before the next check, review or finish. | `trait-detection.md` TD-8, E5, E21 |
| TN-8 | Note text passes the same input guards as other basis text: likely secrets are refused before persistence, and length caps apply. | PRD SEC-11; TS §6.1 |
| TN-9 | Reviewers receive the note as part of the basis, with a rubric item that tells them to check each entry's protection and evidence. A reviewer's missing-case report is a basis gap, never a write to the note. | REV-03; `trait-detection.md` TD-7 |
| TN-10 | A schema-1 `basis.traits` list stays inert and requires nothing. | `trait-detection.md` E22 |

## 4. Proposed behavior and examples

Tests named here do not exist yet. `[QLT-13]` is added to a test title only when E1 to E10 pass against wired QLT-11 state (not a hand-built `TraitWorkState`), because the requirement depends on the trait being detected. No test for the resource file claims it changes behavior.

| Example | Expected behavior | Test file |
|---|---|---|
| E1: `auth` is `present` in the change traits and the basis has no tagged entries | The verdict carries `threat-note-open`, naming the four missing sections. Endpoint is not `checked-local`. | `packages/kernel/test/trait-threat-data.test.ts` |
| E2: the same for each of `persistence`, `personal-data` and `external-effects` alone | Same result, one test per trait. | `trait-threat-data.test.ts` |
| E3: all four traits `present` | One requirement, one reason, four sections. Adding one note satisfies all four traits. | `trait-threat-data.test.ts` |
| E4: the equipment-loan example (PRD §5.16): "only a borrower and an admin read a borrower's identity" (invariant with test), "only the borrower who holds a reservation or an admin alters it" (invariant with test), "availability responses carry no borrower fields" (example with test), "borrower email is not written to logs" (constraint), actors as confirmed assumptions | All four sections have entries and all entries are tests or constraints. No `threat-note-open`. Fixture: the loan-desk golden task. | `trait-threat-data.test.ts` |
| E5: an abuse entry whose element is an `assumption`, an example with no test file, or a `deferred` element | That entry is open. The reason names it by element ID. Other entries are unaffected. | `trait-threat-data.test.ts` |
| E6: `personal-data` is `unknown` | Required (TD-6 keeps possible obligations in the verdict). The verdict also shows the trait disclosure from QLT-11. | `trait-threat-data.test.ts` |
| E7: the user corrects `unknown` to `not-indicated`, then back | Requirement removed, then restored. A note recorded in between is kept in the basis and is not required to be removed. | `trait-threat-data.test.ts` |
| E8: a trait first appears in the candidate diff after `open` and after the basis was confirmed | At the next check the requirement appears. A basis revision that adds the note changes the basis hash; a review issued earlier reads `review-stale`. This consequence is stated in the response. | `trait-threat-data.test.ts` |
| E9: a note entry holds a `ghp_` token, or 301 characters | Refused before persistence with the existing guard messages; nothing stored. | `trait-threat-data.test.ts` |
| E10: a schema-1 contract carries `basis.traits: ["auth"]` and no typed trait state | No requirement, no reason, no migration of the string into a trait. | `trait-threat-data.test.ts` |
| E11: the review manifest for a contract with a required note | The manifest's basis part lists the tagged entries by section, and the rubric part carries the QLT-13 item. A reviewer `basisGaps` entry of kind `missing-invariant` does not change any element. | `packages/kernel/test/trait-review.test.ts` (shared with `trait-detection.md` E6) |
| E12: a `persistence`-only change in a Quick contract | Per the owner's answer to Q3 (floor to Standard, or the note recorded in Quick). Until answered the spec states no behavior. | `trait-threat-data.test.ts` |

## 5. Proposed contract

### 5.1 Note shape (recommended: tagged basis elements)

A threat-note entry is an ordinary basis element carrying one new optional field, `threat`, with the values `actor`, `asset`, `data` or `abuse`. The note is a derived view over the tagged elements of the contract's basis; there is no separate stored note record.

| Section (PRD §5.16 bullet) | `threat` | Element kind | Why this kind |
|---|---|---|---|
| Actors and trust boundaries | `actor` | `assumption` | Stated by the model, confirmed by the user in the same preview as the examples (INT-07); no test applies. |
| Protected objects and operations | `asset` | `invariant` or `example`, with a test | A rule such as "only an admin can alter a reservation" is testable. |
| Sensitive data and retention | `data` | `constraint`, or `invariant` or `example` with a test | Retention and logging rules are often constraints; "no borrower field in the response" is testable. |
| Abuse cases | `abuse` | `example` (a boundary or negative case) or `invariant`, with a test; or `constraint` | A hostile action and the expected refusal. |

Link rule (TN-3): an entry tagged `asset`, `data` or `abuse` is *linked* when its kind is `constraint`, or `example` or `invariant` with a test file. An entry that is tagged but of any other kind (`assumption`, `deferred`, `decision`, `requirement`, or an example without a test) is *open*. An `actor` entry needs no link.

Because the entries are basis elements, their tests are locked and run like other acceptance obligations, their text lives in project intent where it outlives the contract, and the verdict's existing element checks apply with no new mechanism. A `constraint` is not verified by the verdict (`judgeElement`), so the Reviewer is asked to name where each constraint is checked (the resource and the rubric item).

Bounds: `threat` entries per contract at most 12; text at most 300 characters for a tagged element (other elements keep 2,000).

### 5.2 When the note is required

`threatNoteStatus(workTraits, ctx, elements)` in new pure `core/threat.ts`:

- Effective outcome per trait: the assessment, overridden by a correction that currently applies (the same rule `changeTraitRaises` uses; the implementation should extract that rule to one helper in `core/traits.ts` rather than copy it).
- `required` when any of the four has effective outcome `present` or `unknown`. If the work trait state is `unassessed`, the status is `undetermined` and adds no reason: no check has run, and the verdict already lacks evidence. Assessment happens before each check (`trait-detection.md` TD-2), so the answer is known when a check launches.
- Returns `{ required, missingSections, open: [elementId] }`. It reads tagged elements of the contract's basis only.

Verdict: `judgeThreatNote` in `core/verdict.ts` adds one reason `threat-note-open` per call when `required` and (`missingSections` or `open` is non-empty). Reason text names sections and element IDs. The reason is blocking (not a note), so the endpoint is below `checked-local` until resolved.

### 5.3 Drafting and review

- **Drafting.** In the Standard lane the coordinator proposes the entries with the examples in one `decide --kind basis` preview, after the basis and before the contract preview (TS §5.3). Guidance text for the coordinator belongs in `tenet-intake` (about 150 to 250 tokens; room exists) and not in the coordinator skill (at its limit). Before QLT-11 is wired the coordinator cannot know a trait is `present`, so this guidance ships with the wiring, not now.
- **Review.** `core/review.ts` adds one rubric item when a note is required: for each entry check the four things in `threat-note.md`. The shipped resource carries the same four checks for hosts that load it; the kernel rubric is the path that is certain to reach the Reviewer.
- **Late trait (E8).** If the diff reveals a trait after the basis was confirmed, the requirement appears at the next check. The coordinator proposes a basis revision with the note. That changes the basis hash, so an earlier review is stale. This is the same cost as any basis change and is not avoided here.

### 5.4 New reason code

`threat-note-open` (exit 0, a verdict reason): "A change with auth, persistence, personal-data or external-effects has no complete threat and data note, or a security item is neither a test nor a constraint". Additive (TS §6.7). Needs a test fixture because the coverage tool counts codes without one.

## 6. State and compatibility

- **One new optional field**: `BasisElement.threat` and the same field on `BasisElementInput` (`core/schemas.ts`), about 60 non-whitespace characters. `core/basis-build.ts` (`shaped`) copies it. The element is a nested plain `z.object` inside `project.intent.elements`, so an older kernel would strip the field. It must be added to the schema 2 design alongside trait state (Q2).
- **`INTENT.md` projection.** Elements are projected into the shared `INTENT.md` OVERVIEW and element blocks by `core/intent-md.ts`. A tagged element appears there like any other. Whether the `threat` tag survives a round trip through the projection and an adoption diff must be designed and tested; this spec does not decide it (risk R2).
- **No change** to receipts, grants, the pipeline order, or the Reviewer result schema.
- **Consumers to cover:** `core/schemas.ts`, `core/basis-build.ts`, `decisions/basis.ts` (accepts the field through the schema; no new branch expected), `core/intent-md.ts`, `verbs/facts.ts` (compute and pass `threat` status into the verdict input), `core/verdict.ts`, `core/review.ts`, `inspect why` text, the contract preview wording (UX Spec owns layout), the `tenet-intake` skill, `tools/lint-skills.ts` closure (any skill text naming `threat` must parse), and the `INTENT.md` tests.

## 7. Does it fit central code, and what does it cost?

**The pure part does not touch central code. The wiring does not fit today** (central has 37 characters free). Estimates, not measurements, scaled from existing modules (`decisions/cleanup.ts` 1,039 characters; the quality gate's counting):

| Piece | Where | Central? | Estimate (characters) |
|---|---|---|---|
| `threatNoteStatus` and the section/open computation | `core/threat.ts` (new, pure) | No budget matches | 1,200 to 1,800 |
| Shared effective-outcome helper | `core/traits.ts` | No | 150 to 300 |
| Copy the tag, tagged-element text cap | `core/basis-build.ts` | No | 100 to 200 |
| Schema field | `core/schemas.ts` (528 free) | Own owner | 60 |
| `judgeThreatNote` | `core/verdict.ts` (4,731 free) | Own owner | 300 to 500 |
| Rubric item and manifest listing | `core/review.ts` (3,179 free) | Own owner | 400 to 700 |
| Pass the status into the verdict input | `verbs/facts.ts` | Yes | 150 to 300 |
| `inspect why` and preview text | `verbs/inspect.ts`, preview code | Yes | 150 to 400 |
| Reason code | `core/reasons.ts` | No | 200 |

**Central total: about 300 to 700 characters**, 8 to 19 times the free space. It lands in the same files and the same call sites as the QLT-11 wiring (the facts projection, decision-packet 4a-A), so the capacity request can be one request. Without QLT-11 wired, the central part has no input to read; do not build it first.

**Skill budgets.** The shipped `threat-note.md` is about 520 tokens. The lint has a budget only for `focused-review.md` (400); resources are otherwise unbudgeted and load on demand. `tenet-review`'s body is 824 of 4,500 tokens, so even an inline pointer fits. The loaded-token total (12,000) excludes `tenet-review`. `tools/lint-skills.ts` passes with the file added (run 2026-11-03). The resource is not referenced from `SKILL.md`: referencing a note that manifests do not yet carry would name behavior that does not exist.

## 8. Alternatives considered

| Option | What it does | Notes |
|---|---|---|
| A. Tagged basis elements; the note is a derived view (recommended) | As §5. | Smallest schema (one optional enum). Security items become real requirements: locked tests, durable intent, normal verdict checks. Cost: the note's narrative form is derived, an actor entry rides as a confirmed assumption, and the tag must survive `INTENT.md` projection. |
| B. A separate record `work.basis.threat` with explicit `{ item, link }` pairs | An explicit note with entries and links to element IDs. | Matches the PRD wording most literally and gives "unlinked item" a direct meaning. Costs about 300 more schema characters and a validator in `decisions/basis.ts` (central), and creates two places that must agree (the note and the elements). |
| C. A free-text note inside `design` (4,000 characters) | No schema. | Rejected: the kernel cannot check links in prose, and QLT-13 says the items must not remain "review notes". |
| D. A review-time check only (no recorded note) | Reviewer asks for the note. | Rejected: the PRD says Tenet records the note; a reviewer-only check records nothing and depends on a model. |

**Recommendation: A**, by the repository rule "the least code that solves the problem". If the owner prefers the PRD's wording literally, B is the alternative and §5.1's link rule becomes a field on the item instead of the item's kind.

## 9. Owner questions

**Q1. Note shape.** A (tagged elements, recommended), B (separate record), C and D rejected above.

**Q2. Schema 2.** Does the new optional `BasisElement.threat` join the schema 2 design with trait state? A. Yes (recommended; one more field in a migration already being designed). B. Wait for a later schema and ship only the pure core and the resource.

**Q3. Lane for a `persistence`-only change.** Today it can stay Quick, which has no note step. A. Add a floor: a required note sets the lane floor to Standard (recommended; touches `core/risk.ts`, 3,861 free). B. Record the note in Quick too (extends the Quick lane's steps, TS §5.3). C. Accept that a Quick persistence change has no note and narrow the claim for it.

**Q4. Where the drafting guidance lives.** `tenet-intake` (recommended; room for it), or a coordinator edit with a matching removal elsewhere (the coordinator is at its limit).

**Q5. What an `unknown` trait requires.** This draft requires the note (TD-6 conservatism), which can ask for a note on a change that does not touch the area. Alternative: require it only for `present`, and disclose `unknown` without the note. Recommended: require for `unknown` until QLT-11 shows how often `unknown` occurs.

**Q6. Central capacity.** §7 needs decision-packet decision 1 together with the QLT-11 wiring, or an offsetting removal.

## 10. Risks and assumptions

- **R1. Quality of entries.** The kernel checks the kind of each entry, not its meaning. A vacuous invariant with a weak test satisfies the link rule. The resource and rubric item ask the Reviewer to read the test; nothing proves they do. This is cooperative and unobserved on a native host.
- **R2. `INTENT.md` round trip.** If the projection drops the tag, the note vanishes on the next adoption cycle. Needs a red-first test and may need a projection change (`core/intent-md.ts`).
- **R3. Actor entries as assumptions.** An unconfirmed assumption blocks the verdict (`assumption-unresolved`), which makes the actor section something the user must confirm. This is intended, and adds one confirmation to the existing basis preview, not one more question.
- **R4. Trait detection under-detects.** If QLT-11 misses `auth` behavior implemented by indirection, no note is required. The note's existence rests on trait evidence (`trait-detection.md` §7).
- **R5. Resource reach.** Agents that cannot load skills may never read `threat-note.md`. The kernel rubric item is the reliable path; the resource is for hosts that do load it (unobserved).
- **R6. Late note.** A trait discovered after review costs a basis revision and a review round (E8). Accepted.
- **R7. Reuse across contracts.** Tagged elements are project intent, so they outlive the contract that wrote them, and a later contract in the same area meets the requirement again. Whether a basis may cite earlier elements by `ref`, or must restate them, was not checked in `core/basis-build.ts` and is open. Until it is answered, the safe reading is that each contract writes a short note about its own change, while the earlier entries remain as locked regression tests (project traits keep regression obligations, `trait-detection.md` TD-5).
- **Assumptions.** Each of the four traits has a stable `R1Trait` id (it does: `core/traits.ts`); `persistence` raises no dimension today (checked in `core/risk.ts` and `changeTraitRaises`); the lint's "claims enforcement" and "unscoped claim" word filters apply to the resource (it passes).

## 11. Acceptance criteria and gates

Before implementation: independent review with dispositions (§12 is the author's pass); owner answers Q1 to Q4 and Q6; owner sign-off on this spec; QLT-11 implemented and its migration gate passed (this spec is not implementable earlier); capacity decision. Implementation is red-first with E1 to E12, using wired trait state. Done when: all pass; `npm run ci` passes; the built bundle is driven on a scratch repository with a change touching an auth path and a repository file, observing `threat-note-open`, supplying the note through `decide --kind basis`, and observing the reason clear; the equipment-loan fixture of E4 produces the expected sections; `[QLT-13]` is then added to the E1 to E10 titles and R1 mapping is rechecked. Update `trait-detection.md` TD-10 and E20 (shape, consequence), Tech Spec §§5.3 and 8.3 and Appendix C, and PRD wording only for what changes. Host behavior stays "unobserved".

## 12. Review pass and dispositions (author, 2026-11-03, fresh re-read against the PRD text)

Method: re-read QLT-13 ("For changes with `auth`, `persistence`, `personal-data` or `external-effects` traits, Tenet shall record a short threat and data note whose security items become tests or constraints"), PRD §5.16 (four bullets and "become tests or constraints, not just review notes"), and `trait-detection.md` TD-10 and E20 against §§3 to 5. This is a self-review after drafting, not an independent review.

| # | Finding | Disposition |
|---|---|---|
| 1 | The first draft recorded the note in prose and linked items by convention. QLT-13 says items become tests or constraints, not review notes. | Fixed: the entries are basis elements (§5.1), so the verdict and obligations handle them. |
| 2 | "Record" a note: a derived view stores nothing. | Accepted and stated: the elements are the record, in project intent. Option B (explicit record) is listed for an owner who wants a stored note (Q1). |
| 3 | `judgeElement` treats a `constraint` as needing no verification. A constraint could therefore satisfy the PRD while nothing checks it. | Accepted: the PRD allows constraints. The resource and rubric item ask the Reviewer to name where each is checked. Residual risk R1. |
| 4 | Lane gap: `persistence` raises no dimension, so a persistence-only change can be Quick, which has no note step. | Open: Q3. Not resolvable by the author; it changes lane floors. Recorded in §2. |
| 5 | "Short" had no bound. | Fixed: 12 entries, 300 characters each (TN-2); the numbers are proposals for the owner. |
| 6 | `unknown` traits: the PRD says the note is for changes "with" the traits. TD-6 keeps possible obligations. | Open: Q5 with a recommendation; stated in TN-1. |
| 7 | Project traits must not require a note (E3, E11 of `trait-detection.md`). | Fixed: TN-1 and E-table state it; `threatNoteStatus` reads change traits only. |
| 8 | Composition: four notes for four traits would be wasteful and contradict E17 of `trait-detection.md`. | Fixed: TN-6 and E3. |
| 9 | Timing: change traits are known only after the candidate diff exists, after the basis. | Fixed: `undetermined` when unassessed, requirement from the first check, and the late-trait consequence stated (E8, §5.3). |
| 10 | I first wrote the resource for a separate note record (items "link" to elements). Under the recommended shape an entry is the element. | Fixed in the resource: "Each ... entry is a basis element or links to one", so it reads correctly under A or B. |
| 11 | The Reviewer and Analyst cannot load skills, so the resource may never be read. | Open as unobserved (R5) and logged as a spec defect in plan §12.3. The kernel rubric item is the proposed reliable path. |
| 12 | A byte-for-byte text test of the resource would only prove the sentence exists. | Accepted: no such test and no tag (§4 preamble). `lint-skills` covers structure only. |
| 13 | The `INTENT.md` projection may drop an unknown field. | Open as R2; needs a red-first test before the field is accepted. |
| 14 | QLT-13 maps to AC-20 only. AC-20 also expects "logging" and "data and access" cases; those come from the starter, not this note. | No change; out of scope. |
| 15 | Quick, Standard and Deep: the note requirement text in TS §5.3 appears only in Standard's row; Deep is "Standard, plus ...", so it inherits it. | Confirmed by reading §5.3; no change. |
| 16 | Elements are project-level and durable, so a second contract in the same area meets the same requirement. | Open as R7; not decidable without reading how a basis cites existing elements. Listed so the reviewer checks it. |
