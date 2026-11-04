# Specification: Threat and data note for sensitive change traits (QLT-13)

> Status: **draft, revised, unreviewed.** First written 2026-11-03 under the owner's blanket direction of that date to build candidates on an isolated branch. That direction is not a sign-off. An independent review the same day ([reviews/trait-threat-data-review.md](reviews/trait-threat-data-review.md), 15 findings) is answered in this revision; the disposition of each finding is in that file. A **second independent review is required before sign-off.** This spec is not part of the canonical specs, changes no source, and authorizes no implementation. It extends `trait-detection.md` (TD-10, E20) and depends on QLT-11, which is itself blocked on the schema 1 to 2 migration gate. Open owner questions are in §9.
> Sources: PRD QLT-13, §5.16 ("Threat and data note"), §3.8.4, §3.8.5, AC-20, SEC-12; Tech Spec §§5.1, 5.3, 7.8, 8.2, 8.3, 9.7, 11.4, 13; `trait-detection.md` TD-2, TD-4, TD-6, TD-8, TD-10, E20 to E22 and §5 item 8; `schema-migration.md` §§16.6, 16.7, 18.1; `ux-spec.md` §§4.4, 5.2, 13.1, J-08; `docs/audits/2026-11-03/unmapped-musts.md` row QLT-13.
> Shipped with this spec: the review resource `plugin/skills/tenet-review/resources/threat-note.md` (Tech Spec §5.1) and its line in `tools/payload-files.json`. It is **unreferenced and unsigned** (§7, Skill budgets).
> Code read for this revision: `main` at `8b1d574`.

## 1. Outcome

When a change carries `auth`, `persistence`, `personal-data` or `external-effects`, the contract holds a short threat and data note: who acts and where the trust boundaries are, which objects and operations need protection, what sensitive data exists and how long it is kept, and what a hostile or careless actor could try. Every protected-object, data and abuse item in the note is either a **constraint** or an element **verified by a test**. An item that is neither stays visibly open and blocks `checked-local`.

What this does and does not give. A test-linked item is run and judged like any acceptance obligation. A **constraint is not checked by the kernel** (`judgeElement` returns nothing for it, `core/verdict.ts:78`, and `linkElement` marks it "carries no check of its own"). A note made only of constraints therefore passes `threat-note-open` with no verification at all; only the Reviewer is asked where each constraint is checked, and that is cooperative and unobserved. The result and `inspect why` say so whenever the note holds constraints (TN-11). The kernel checks the **kind** of each entry, not its meaning: a vacuous invariant with a weak test is linked.

Out of scope: detecting the traits (QLT-11); the per-trait obligations other than the note (QLT-14 and `trait-detection.md` E13 to E17); a security review of the whole application (the Deep security pass, TS §5.3); and any claim that the note's items are complete (a missing hostile case is for the reviewer to find).

## 2. Current state (read from `main` at `8b1d574`)

- No note exists. `grep` finds the note only in `security.md` (a threat note there means one finding per concern, a different thing) and in the PRD and Tech Spec text. The coordinator skill and the intake skill do not mention it.
- `trait-detection.md` TD-10 and E20 specify the behavior and name the test file `packages/kernel/test/trait-threat-data.test.ts`. They leave the note's shape and the consequence of an unlinked item open ("an unlinked item remains open").
- The trait core (`core/traits.ts`) is pure and not wired into any verb or the stored state. It provides `TraitWorkState` (`status: unassessed | assessed`; change assessments with outcome `present`, `not-indicated` or `unknown`; the corrections that currently apply), `workTraitFacts` (`core/traits.ts:305`) and `changeTraitRaises` (`core/traits.ts:326`). The effective outcome is the assessment overridden by an applicable correction. `persistence` raises no dimension (`TRAIT_RAISES` in `core/risk.ts` holds `external-effects` and `personal-data`; `auth` raises `access` through a path signal), so a persistence-only change can stay Quick.
- The basis is a set of `BasisElement`s (`requirement`, `example`, `invariant`, `constraint`, `assumption`, `decision`, `deferred`) stored in `project.intent.elements`; `work.basis` holds the IDs built from this proposal, a hash and a legacy `traits: string[]` (`core/schemas.ts:57, 262`; `decisions/basis.ts:109`). `BasisElement` is a plain `z.object` (`core/schemas.ts:57`); `BasisElementInput` takes `origin`, `of`, `test`, `expect`, `testFile` by `pick` and has `text: z.string().min(1).max(2000)` (`core/schemas.ts:431-436`).
- **Only an example carries a test.** `shaped()` copies `test`, `testFile`, `support`, `outputs` and `expect` only `if (e.kind === "example")` (`core/basis-build.ts:30-36`). An invariant is verified through child examples (`of` set to the invariant's id, with a `testFile`) and otherwise falls back to a `review` link (`linkElement`, `core/obligations.ts`). The verdict accepts a `review` link when the review is ok (`judgeElement`, `core/verdict.ts:78-85`). A constraint has `notApplicable` and an assumption needs the user's confirmation.
- A basis cannot cite an earlier contract's element as its own: `assign` returns an existing id only for the contract's own elements, and `work.basis.elementIds` is `elements.map(e => e.id)` of this proposal (`core/basis-build.ts:50-70`; `decisions/basis.ts:80-109`). Earlier elements stay in project intent and their locked tests keep running as regression (locks are project-level, TS §9.7), but a new contract restates its own note. (This answers the earlier risk R7.)
- `renderIntent` writes every element as `id text` into the committed `INTENT.md` when intent is adopted (`core/intent-md.ts:65-81`); no tag would be written. Adoption is previewed and bound to the exact content (TS §7.8); the adoption offer warns when a remote exists.
- Lane floors: `auth` paths raise `access`; `external-effects` and `personal-data` change traits raise their dimensions; a migration raises reversibility and compatibility (TS §8.2, `core/risk.ts`). `laneFloor` takes only the assessment and an irreversibility flag (`core/risk.ts`): one High dimension is Standard, two are Deep. The lane table puts the note in the Standard lane only (TS §5.3); Deep is "Standard, plus".
- `trait-detection.md` §5 item 8 says a trait-state change "does not by itself require a new basis confirmation", and E22 repeats it for migrated work. TD-2 assesses change traits from the captured candidate diff **before each check**, so a trait first seen in the diff appears after the basis was confirmed. TS §5.3 places the note before the contract preview and baseline, which cannot hold for such a trait.
- The Reviewer and Analyst agents "cannot load skills" (`tenet-reviewer.agent.md`, `tenet-analyst.agent.md`); their instructions come from the manifest's `rubric`, which the kernel builds in `core/review.ts`. TS §5.1 lists `tenet-review` as "Reviewer and Analyst only" and says the coordinator never loads it. Resources under `tenet-review/resources/` are not referenced by any skill or agent text today. Whether a host reads them on demand is unobserved. Logged in plan §12.3.
- The coordinator skill body is 3,992 of 4,000 tokens (measured with the lint's own count). `tenet-intake` is 1,345 of 4,000; `tenet-review` is 824 of 4,500.
- `judgeElement` for an assumption needs the user's confirmation (`assumption-unresolved`). UX `ux-spec.md` §4.4 renders an assumption as "for now, <assumption> (easy to change later)". UX J-08 says a Deep change's security pass "drafts a short threat and data note whose items become examples".
- Persisted records gain fields only through a schema version the owner approves; every semantic field needs a strict versioned decoder and an inventory entry (`schema-migration.md` §18.1, line 408). Rollback is refused after any post-upgrade mutating action (§16.6).
- Capacity (measured 2026-11-03): central **147** characters free against the **proposed, not approved** ceiling of 248,256 (used 248,109); the approved ceiling of 247,219 is already exceeded by 890. `core/schemas.ts` has **463** free; `core/verdict.ts` 4,731; `core/review.ts` 3,179; `core/risk.ts` 3,861.

## 3. Requirements

| ID | Requirement | Source |
|---|---|---|
| TN-1 | The note is required for a change when any of `auth`, `persistence`, `personal-data`, `external-effects` has effective outcome `present` or `unknown` among the change traits. A correction that applies decides the effective outcome. `not-indicated`, an absent trait, and a project trait without a matching change trait do not require it. | QLT-13; `trait-detection.md` TD-6, TD-8, E3, E11 |
| TN-2 | The note has four sections: actors and trust boundaries, protected objects and operations, sensitive data and retention, abuse cases. It is short: at most 12 tagged entries per contract, each at most 300 characters. | QLT-13; PRD §5.16 |
| TN-3 | An entry in the protected-objects, data or abuse sections is **linked** when it is a constraint; or an example with a `testFile`; or an invariant with at least one child example (`of` the invariant) that has a `testFile`. Any other entry (an invariant verified only by `review`, an example without a test file, an assumption, a deferred, a decision or a requirement) is **open**. | QLT-13 ("security items become tests or constraints, not just review notes") |
| TN-4 | Every section has at least one **valid** entry. A section that does not apply says so through an entry that states it (for example a constraint "no sensitive data is stored or logged by this change"). | QLT-13 ("a short ... note") |
| TN-5 | If a required note is missing a section, or any entry is open, the verdict carries `threat-note-open` and cannot reach `checked-local`. | QLT-13; E20 |
| TN-6 | One note covers a change that carries several of the four traits. It is not required once per trait. | `trait-detection.md` E17; QLT-13 |
| TN-7 | A change of trait state (a new assessment, a correction, a changed candidate diff) recomputes the requirement before the next check, review or finish. | `trait-detection.md` TD-8, E5, E21 |
| TN-8 | Note text passes the same input guards as other basis text: structured input with likely secrets is refused before persistence with `invalid-input`, and a tagged entry has its own 300-character cap. | PRD SEC-11; TS §6.1 |
| TN-9 | Reviewers receive the note as part of the basis, with a rubric item that tells them to check each entry's protection and evidence. A reviewer's missing-case report is a basis gap, never a write to the note. | REV-03; `trait-detection.md` TD-7 |
| TN-10 | A schema-1 `basis.traits` list stays inert and requires nothing. | `trait-detection.md` E22 |
| TN-11 | Whenever a required note holds a constraint entry, the result and `inspect why` carry a note-level reason (`threat-constraints-unchecked`, not blocking) saying how many security items are constraints that no check covers. | QLT-13; `ux-spec.md` §4.1 (name scope and limits) |
| TN-12 | An entry is **valid** only if its element kind is allowed for its tag: `actor` needs `assumption`; `asset`, `data` and `abuse` need `constraint`, `invariant` or `example`. A tagged entry of another kind does not satisfy a section and is listed open. | QLT-13 |
| TN-13 | A correction that lowers `present` or `unknown` to `not-indicated` for one of the four traits is a risk acceptance: it is asked in plain chat (TS §11.4) with the consequence stated, and its capture stays `reported` (cooperative). | TS §11.4; SEC-13 (Q8) |
| TN-14 | When the work trait state is `unassessed` and any non-baseline receipt exists on the current candidate, the verdict carries `threat-note-open` with "change traits have not been assessed yet". With no such receipt, `unassessed` adds no reason. | `trait-detection.md` TD-2, TD-6 |

## 4. Proposed behavior and examples

Tests named here do not exist yet. `[QLT-13]` is added to a test title only when E1 to E11 pass against wired QLT-11 state (not a hand-built `TraitWorkState`), because the requirement depends on the trait being detected. No test for the resource file claims it changes behavior. A tag does not claim that the Reviewer checked any constraint.

| Example | Expected behavior | Test file |
|---|---|---|
| E1: `auth` is `present` in the change traits and the basis has no tagged entries | The verdict carries `threat-note-open`, naming the four missing sections. Endpoint is not `checked-local`. | `packages/kernel/test/trait-threat-data.test.ts` |
| E2: the same for each of `persistence`, `personal-data` and `external-effects` alone | Same result, one test per trait. | `trait-threat-data.test.ts` |
| E3: all four traits `present` | One requirement, one reason, four sections. Adding one note satisfies all four traits. | `trait-threat-data.test.ts` |
| E4: the equipment-loan example (PRD §5.16): invariant "only a borrower and an admin read a borrower's identity" with a child example that has a `testFile`; invariant "only the borrower who holds a reservation or an admin alters it" with a child example that has a `testFile`; example "availability responses carry no borrower fields" with a `testFile`; constraint "borrower email is not written to logs"; actors as confirmed assumptions | All four sections have valid entries and every entry is linked. No `threat-note-open`. The constraint produces the note-level `threat-constraints-unchecked` with n = 1. Fixture: the loan-desk golden task. | `trait-threat-data.test.ts` |
| E4b: a tagged invariant with no child example and only a `review` link | The entry is open (`threat-note-open` names its element ID). | `trait-threat-data.test.ts` |
| E4c: a note whose protected-objects, data and abuse entries are all constraints | No `threat-note-open`; the result says "n security items are constraints no check covers". | `trait-threat-data.test.ts` |
| E5: an abuse entry whose element is an `assumption`, an example with no test file, or a `deferred` element; and an entry tagged `actor` that is a `decision` | Each entry is open or invalid and does not satisfy its section. The reason names it by element ID. Other entries are unaffected. | `trait-threat-data.test.ts` |
| E6: `personal-data` is `unknown` | Required (TD-6 keeps possible obligations in the verdict). The verdict also shows the trait disclosure from QLT-11. | `trait-threat-data.test.ts` |
| E7: the user corrects `unknown` or `present` to `not-indicated`, then back | The correction is asked as a chat risk-acceptance question stating "this removes the threat and data note requirement" (TN-13). Requirement removed, then restored. A note recorded in between is kept in the basis. The capture is `reported`; the spec claims no more. | `trait-threat-data.test.ts` |
| E8: a trait first appears in the candidate diff after `open` and after the basis was confirmed | At the next check the requirement appears with `threat-note-open`. Satisfying it is an ordinary basis revision that adds tagged elements: it changes the basis hash, a review issued earlier reads `review-stale`, and the user confirms the new elements. The response states these consequences in the "Change of direction" form (§5.6). The tests of a note added after the baseline stage are declared `preservation` or `boundary` (expectation pass), or `distinguishing` only if a red on the baseline can still be shown, otherwise `no-distinguishing-red` follows (`core/verdict.ts:91-94`). | `trait-threat-data.test.ts` |
| E9: a note entry holds a `ghp_` token, or 301 characters | The token: the proposal is refused before persistence with the pipeline's `invalid-input` message "Structured input contains likely secret material; replace it with placeholders." (`pipeline.ts:94-95`). The 301-character text: refused by a new refinement on tagged `BasisElementInput` with "a threat-note entry is at most 300 characters". Nothing stored in either case. | `trait-threat-data.test.ts` |
| E10: a schema-1 contract carries `basis.traits: ["auth"]` and no typed trait state | No requirement, no reason, no migration of the string into a trait. | `trait-threat-data.test.ts` |
| E11: the review manifest for a contract with a required note | The manifest's basis part lists the tagged entries by section, and the rubric part carries the QLT-13 item. A reviewer `basisGaps` entry of kind `missing-invariant` does not change any element. | `packages/kernel/test/trait-threat-manifest.test.ts` |
| E12 (for the recommended Q3 option A): a `persistence`-only change in a Quick contract | The lane floor rises to Standard before any check (`laneFloor` gains a flag for a required note; the existing review and consent gates apply as in `trait-detection.md` E21), the raised floor and its reason are reported, and the note is required. Under Q3 B the note is recorded in Quick; under Q3 C there is no note and the claim is narrowed for Quick persistence changes. | `trait-threat-data.test.ts` |
| E13: a migrated contract has `unassessed` trait state and a candidate receipt from before migration | `threat-note-open` with "change traits have not been assessed yet" (TN-14); with no candidate receipt, no reason. | `trait-threat-data.test.ts` |
| E14: a Deep change that carries `auth` | The security-pass Analyst's packet asks it to draft the note's entries in its result; the Analyst writes nothing to the basis. The coordinator proposes the drafted entries through `decide --kind basis`. | `packages/kernel/test/trait-threat-deep.test.ts` |
| E15: intent is adopted with tagged elements present (Q9) | Under Q9 B the tagged elements are not written to `INTENT.md` (a render exclusion; a test shows the file holds none and that adoption read-back does not delete them from state). Under Q9 A they are written, the adoption preview names "n security entries", a deletion of one in the file is an outside edit that relaxes nothing until accepted through the diff (SEC-12). Whether a state element absent from the file survives read-back is unverified; this test is written first. | `trait-threat-data.test.ts`, `intent-md` tests |
| E16: schema-1 state is converted | No element has `threat`; no requirement arises from conversion. | `packages/kernel/test/threat-migration.test.ts` |
| E17: rollback after conversion | Eligible only before the first post-upgrade mutating action (§16.6). A tag can be written only by a mutating `decide --kind basis`, so tagged state cannot exist in a rollback-eligible store. | `threat-migration.test.ts` |
| E18: `forget` of a lesson; an older kernel reads state with tagged elements | `forget` does not touch element text (it is not lesson text). The older kernel refuses the document under the strict decoders; it does not strip the tag. | `threat-migration.test.ts` |

## 5. Proposed contract

### 5.1 Note shape (recommended: tagged basis elements)

A threat-note entry is an ordinary basis element carrying one new optional field, `threat`, with the values `actor`, `asset`, `data` or `abuse`. The note is a derived view over the tagged elements of the contract's basis; there is no separate stored note record.

| Section (PRD §5.16 bullet) | `threat` | Valid element kinds (TN-12) | Why |
|---|---|---|---|
| Actors and trust boundaries | `actor` | `assumption` | Stated by the model, confirmed by the user in the same preview as the examples (INT-07); no test applies. |
| Protected objects and operations | `asset` | `constraint`, `invariant`, `example` | A rule such as "only an admin can alter a reservation" is testable; some are constraints. |
| Sensitive data and retention | `data` | `constraint`, `invariant`, `example` | Retention and logging rules are often constraints; "no borrower field in the response" is testable. |
| Abuse cases | `abuse` | `example` (a boundary or negative case), `invariant`, `constraint` | A hostile action and the expected refusal. |

**Link rule (TN-3), in the code's terms.** `asset`, `data` and `abuse` entries are *linked* when: the element is a `constraint`; or it is an `example` with a `testFile`; or it is an `invariant` and at least one element with `of === invariant.id` is an `example` with a `testFile`. This mirrors `linkElement` (`core/obligations.ts`): an invariant gets obligation links only from child examples, and otherwise a `review` link, which is **open** here because QLT-13 excludes "review notes". An `actor` entry needs no link but must be an assumption (TN-12).

Because the entries are basis elements, their tests are locked and run like other acceptance obligations, their text lives in project intent, and the verdict's existing element checks apply with no new mechanism. A `constraint` is not verified by the verdict, which is why TN-11 exists.

Bounds: tagged entries per contract at most 12; text at most 300 characters for a tagged element (other elements keep 2,000). The 300 limit is a new refinement on `BasisElementInput` tied to `threat`, costed in §7 (no existing guard has this limit; E9).

### 5.2 When the note is required

`threatNoteStatus(workTraits, ctx, elements)` in new pure `core/threat.ts`:

- Effective outcome per trait: the assessment, overridden by a correction that currently applies (the same rule `changeTraitRaises` uses; the implementation extracts that rule to one helper in `core/traits.ts` rather than copy it).
- `required` when any of the four has effective outcome `present` or `unknown`. If the work trait state is `unassessed`, the status is `undetermined`: it adds no reason unless a non-baseline receipt exists on the current candidate, in which case it adds `threat-note-open` ("change traits have not been assessed yet", TN-14). Assessment happens before each check (`trait-detection.md` TD-2), so a contract that has been checked since migration is assessed.
- Returns `{ required, missingSections, open: [elementId], invalid: [elementId], constraints: n }`. It reads tagged elements of the contract's basis only.

Verdict: `judgeThreatNote` in `core/verdict.ts` adds one reason `threat-note-open` per call when `required` and (`missingSections`, `open` or `invalid` is non-empty), and one note-level reason `threat-constraints-unchecked` when `required` and `constraints > 0`. The first is blocking, so the endpoint is below `checked-local` until resolved; the second is a note and does not lower the endpoint. Reason text names sections and element IDs.

### 5.3 Drafting, review and the late trait

- **Standard drafting.** The coordinator proposes the entries with the examples in one `decide --kind basis` preview, after the basis and before the contract preview (TS §5.3). Guidance text for the coordinator belongs in `tenet-intake` (about 150 to 250 tokens; room exists) and not in the coordinator skill (at its limit). TS §5.1 gives the resource `threat-note.md` to `tenet-review`, which the coordinator never loads, so the resource is not the coordinator's source. Before QLT-11 is wired the coordinator cannot know a trait is `present`, so the guidance ships with the wiring, not now.
- **Deep drafting.** The Deep security pass is an Analyst. Agents explain and never write binding facts, so the Analyst cannot write basis elements. The Analyst's packet (built in `core/review.ts`) asks it, when a note is required, to return the drafted entries in its result; the coordinator proposes them through `decide --kind basis` (E14). UX J-08 says the entries "become examples"; the PRD says "tests or constraints". The UX Spec wording needs amending (Q10).
- **Review.** `core/review.ts` adds one rubric item when a note is required: for each entry check the four things in `threat-note.md`. The shipped resource carries the same checks for hosts that load it; the kernel rubric is the path that is certain to reach the Reviewer and the Analyst, because they cannot load skills.
- **Late trait (E8).** If the diff reveals a trait after the basis was confirmed, the requirement appears at the next check, and satisfying it is a basis revision. That conflicts in letter with `trait-detection.md` §5 item 8 ("does not by itself require a new basis confirmation"): the trait change itself does not force reconfirmation, but the note's tests and constraints are basis elements, so writing them does. **Any shape of the note has this cost wherever the items are examples**, because tests are examples. This is stated here and goes to the owner as Q7 with an amendment to item 8 and E22; the Tech Spec §5.3 ordering (note before baseline) also changes for a late trait.
- **Corrections (TN-13, E7).** The existing correction path lets the user lower a trait. For these four traits it removes a security control, so it is asked in chat as a risk acceptance (Q8). A correction remains `reported`: cooperative.

### 5.4 New reason codes

- `threat-note-open` (exit 0, a verdict reason): "A change with auth, persistence, personal-data or external-effects has no complete threat and data note, or a security item is neither a test nor a constraint".
- `threat-constraints-unchecked` (exit 0, a note): "Security items in the note are constraints that no check covers".

Both additive (TS §6.7). Each needs a test fixture because the coverage tool counts codes without one.

### 5.5 `INTENT.md` (Q9)

Adoption projects every element into `INTENT.md` (`core/intent-md.ts:65-81`). The note's abuse cases, protected objects and data-retention rules are the most sensitive text in a contract, and the file is committed and may be public. The recommended option (Q9 B) leaves tagged elements out of the projection with a render exclusion. The cost: a fresh clone has the tests but not the note text, because `.tenet/` is git-ignored. If Q9 A is chosen, the adoption preview names the number of security entries, a deletion in the file is handled by the existing diff-acceptance path (TS §7.8: "a block changed outside Tenet needs acceptance through a diff") and relaxes nothing until accepted (SEC-12), and a round-trip test is added. Whether state elements missing from the file survive a read-back is unverified (E15).

### 5.6 Proposed user-facing words (UX Spec owns the final text; backfill required)

- **Preview of the note**, in the basis preview: one sentence first ("This change touches sign-in, so the contract also needs a short security note: who acts, what is protected, what data is kept, and what a hostile user could try."), then the entries by section with plain numbers (UX-D7).
- **Actors and trust boundaries** are not "easy to change later". Proposed line: "I'm assuming these actors and boundaries; if they're wrong, the security tests below protect the wrong thing. Confirm or correct them." (UX §4.4 needs an exception for `actor` assumptions.)
- **Open items**, by number: "The security note has 2 open items: 1. 'only admins can export loans' has no test or constraint. 2. 'sessions expire' is only a review note. Add a test or make each a constraint. (`threat-note-open`)".
- **Constraints**: "3 security items are constraints; no check covers them, so the reviewer is asked to find where each is enforced. (`threat-constraints-unchecked`)".
- **Late trait**, in the "Change of direction" form (`ux-spec.md` §5.2): "This change now touches sign-in code. Changes: a security note is required. Affects: this work (it stays Standard); earlier reviews become stale because the basis changes. Unaffected: items, reservations, returns. 1. Write the note now (recommended) · 2. Narrow the change · 3. Cancel this work."
- **Lowering a trait**: "Marking this change as having no sign-in impact removes the security note requirement. Allow? Reply 'allow', or 'leave it'." (chat, TS §11.4).

## 6. State and compatibility

- **One new optional field**: `BasisElement.threat` (an enum of `actor`, `asset`, `data`, `abuse`) in `core/schemas.ts:57`; `BasisElementInput` gains it through its `pick` list (`core/schemas.ts:431-436`) and a refinement for the 300-character cap; `shaped()` in `core/basis-build.ts` copies it (today `shaped` copies by hand and drops unknown fields, so all three must change). `basisHashOf` hashes elements without `verifiedBy` (`core/basis-build.ts`), so the tag is part of the basis hash: adding or changing a tag changes the hash, which is the intended consequence of E8.
- **Migration (schema 1 to 2).** The field feeds the verdict, so it is a semantic field under `schema-migration.md` §18.1 (line 408): it needs a strict versioned decoder and an inventory entry, and a decoder check that a tagged element's kind is allowed for its tag. Schema 1 has no tags (E16). Rollback (§16.6) is refused after any post-upgrade mutating action, and a tag is written only by one (E17). Forgetting (§16.7) does not touch element text (E18). An older kernel refuses a newer document and does not strip the tag. Q2 asks whether it joins schema 2.
- **`INTENT.md` projection.** See §5.5 and Q9.
- **No change** to receipts, grants, the pipeline order, or the Reviewer result schema.
- **Consumers to cover:** `core/schemas.ts`, `core/basis-build.ts`, `decisions/basis.ts` (accepts the field through the schema; no new branch expected), `core/intent-md.ts` (Q9), `verbs/facts.ts` (compute and pass the status into the verdict input, beside the `elements:` line at `facts.ts:96`), `core/verdict.ts`, `core/review.ts` (rubric item, manifest listing, Analyst packet text), `core/risk.ts` (`laneFloor`, Q3 A), `core/traits.ts` (the shared helper), `inspect why` text, the contract preview wording (UX Spec owns layout), the `tenet-intake` skill, `tools/lint-skills.ts` closure (any skill text naming `threat` must parse), and the `INTENT.md` tests.

## 7. Does it fit central code, and what does it cost?

**The pure part does not touch central code. The wiring does not fit today** (central has 147 characters free against a proposed ceiling and is already over the approved one). Estimates, not measurements, scaled from measured modules (non-whitespace characters, the quality gate's counting): `core/impact.ts` 2,220, `core/handoff.ts` 1,334, `core/controls.ts` 2,187, `decisions/cleanup.ts` 1,039; the one-line `elements:` field pass in `verbs/facts.ts:96` is about 85.

| Piece | Where | Central? | Estimate (characters) |
|---|---|---|---|
| `threatNoteStatus` and the section/open/invalid/constraint computation | `core/threat.ts` (new, pure) | No budget matches | 1,400 to 2,200 (about `core/impact.ts` plus a link helper) |
| Shared effective-outcome helper | `core/traits.ts` | No | 150 to 300 |
| Copy the tag | `core/basis-build.ts` | No | 60 to 120 |
| Schema field, `pick` entry, 300-character refinement | `core/schemas.ts` (463 free) | Own owner | 150 to 250 |
| `judgeThreatNote` (two reasons) | `core/verdict.ts` (4,731 free) | Own owner | 350 to 600 |
| Rubric item, manifest listing, Analyst packet text | `core/review.ts` (3,179 free) | Own owner | 500 to 900 |
| `laneFloor` flag for a required note (Q3 A) | `core/risk.ts` (3,861 free) | Own owner | 100 to 200 |
| Pass the status into the verdict input | `verbs/facts.ts` | Yes | 150 to 300 |
| `inspect why` and preview text | `verbs/inspect.ts`, preview code | Yes | 150 to 400 |
| Reason codes | `core/reasons.ts` | No | 400 |

**Central total: about 300 to 700 characters**, 2 to 5 times the 147 free (the facts pass-through plus the preview text; the rest lands in files with their own owners). It lands in the same files and the same call sites as the QLT-11 wiring (the facts projection, decision-packet 4a-A), so the capacity request can be one request. Without QLT-11 wired, the central part has no input to read; do not build it first.

**Schema space.** This spec needs about 150 to 250 of the 463 free in `core/schemas.ts`. With the other two pending specs (workload about 320 to 420, diagnostics about 10) the three need about 480 to 680, which can exceed the free space. Schema 2 and QLT-11 trait state also draw on it. The owner sets the budget at the schema 2 re-baseline; this spec proposes no figure.

**Skill budgets.** The shipped `threat-note.md` is about 520 tokens. The lint has a budget only for `focused-review.md` (400); resources are otherwise unbudgeted and load on demand. `tenet-review`'s body is 824 of 4,500 tokens, so even an inline pointer fits. The loaded-token total (12,000) excludes `tenet-review`. `tools/lint-skills.ts` passes with the file present. The resource is not referenced from `SKILL.md`: referencing a note that manifests do not yet carry would name behavior that does not exist.

**About the shipped resource.** This spec "authorizes no implementation", yet commit `46e7d16` put the resource in the plugin payload (skill text is executable product behavior, `copilot-instructions.md`). It is inert because nothing references it. This revision corrects its link wording to the rule of TN-3 (an invariant is linked through a child example) and re-reads it against the recommended shape. It stays **unreferenced and unsigned**. Its text assumes a manifest whose basis includes a note and tagged elements, which no manifest carries today, so it must not be referenced from a skill until Q1 is answered and the wiring exists. A release that ships it must disclose the changed payload content (LFC-02). It is held in place rather than removed because removing it changes `tools/payload-files.json` for no behavioral gain; the owner may prefer to hold it back (Q1).

## 8. Alternatives considered

| Option | What it does | Notes |
|---|---|---|
| A. Tagged basis elements; the note is a derived view (recommended) | As §5. | Smallest schema (one optional enum plus a refinement). Security items become real requirements: locked tests, durable intent, normal verdict checks. Cost: the note's narrative form is derived, an actor entry rides as a confirmed assumption, an invariant is linked only through child examples, and `INTENT.md` projection needs a decision (Q9). |
| B. A separate record `work.basis.threat` with explicit `{ item, link }` pairs | An explicit note with entries and links to element IDs. | Matches the PRD wording most literally and gives "unlinked item" a direct meaning, and it could sit outside the basis hash. It costs about 300 more schema characters and a validator in `decisions/basis.ts` (central), creates two places that must agree (the note and the elements), and does not remove the late-trait cost: the note's tests are still basis examples (§5.3, Q7). |
| C. A free-text note inside `design` (4,000 characters) | No schema. | Rejected: the kernel cannot check links in prose, and QLT-13 says the items must not remain "review notes". |
| D. A review-time check only (no recorded note) | Reviewer asks for the note. | Rejected: the PRD says Tenet records the note; a reviewer-only check records nothing and depends on a model. |

**Recommendation: A**, by the repository rule "the least code that solves the problem". If the owner prefers the PRD's wording literally, B is the alternative and §5.1's link rule becomes a field on the item instead of the item's kind.

## 9. Owner questions

**Q1. Note shape (and the shipped resource).** A (tagged elements, recommended), B (separate record), C and D rejected above. Also: keep `threat-note.md` in the payload as an unreferenced, unsigned file (recommended: inert, and removing it saves nothing), or hold it back until the shape is chosen.

**Q2. Schema 2.** Does the new optional `BasisElement.threat` join the schema 2 design with trait state? A. Yes (recommended; one more field in a migration already being designed). B. Wait for a later schema and ship only the pure core and the resource.

**Q3. Lane for a `persistence`-only change.** Today it can stay Quick, which has no note step. A. Add a floor: a required note sets the lane floor to Standard (recommended; touches `core/risk.ts`, 3,861 free). B. Record the note in Quick too (extends the Quick lane's steps, TS §5.3). C. Accept that a Quick persistence change has no note and narrow the claim for it.

**Q4. Where the drafting guidance lives.** `tenet-intake` (recommended; room for it), or a coordinator edit with a matching removal elsewhere (the coordinator is at its limit). The Deep path adds Analyst packet text in `core/review.ts`.

**Q5. What an `unknown` trait requires.** This draft requires the note (TD-6 conservatism), which can ask for a note on a change that does not touch the area. Alternative: require it only for `present`, and disclose `unknown` without the note. Recommended: require for `unknown` until QLT-11 shows how often `unknown` occurs.

**Q6. Central capacity.** §7 needs decision-packet decision 1 together with the QLT-11 wiring, or an offsetting removal.

**Q7. The late-trait conflict with `trait-detection.md` §5 item 8 and E22.** A trait first seen in the diff forces a basis revision when the note's tests and constraints are added. A. Amend item 8 and E22 to say: a trait-state change does not by itself require reconfirmation, but satisfying a required threat note is an ordinary basis revision with its normal consequences (recommended; it states what any shape of the note costs). B. Keep item 8 as written and make the note a record outside the basis hash, with its tests registered outside the basis (a new mechanism; larger; the tests would be unlocked and unlisted among acceptance obligations). The Tech Spec §5.3 ordering for a late trait changes under either.

**Q8. Lowering a security trait.** Is a correction that lowers `present` or `unknown` to `not-indicated` for one of the four traits a risk acceptance asked in chat (TS §11.4)? A. Yes (recommended: it removes a security control and the correction is otherwise a model-reachable `reported` call). B. Routine, like any other correction, with the weakness disclosed. Either way the capture is `reported` and the claim is cooperative.

**Q9. `INTENT.md` and threat entries.** A. Project them like other elements; the adoption preview names the count; deletion follows the diff-acceptance path. B. Do not project `threat`-tagged elements (recommended: abuse cases and protected-object text may be public in a committed file; cost: a fresh clone lacks the note text, though the tests remain). Either way the read-back behavior is tested first (E15).

**Q10. UX Spec amendments.** Approve changing UX J-08 ("items become examples" to "become tests or constraints"), §4.4 (actor assumptions are not "easy to change later"), and adding the late-trait and open-item wording of §5.6. The UX Spec owns the text; this is a spec amendment that needs the owner.

## 10. Risks and assumptions

- **R1. Quality of entries.** The kernel checks the kind of each entry, not its meaning. A vacuous invariant with a weak test satisfies the link rule, and a constraint satisfies it with no check at all (TN-11). The resource and rubric item ask the Reviewer to read the test and find the constraint's enforcement; nothing proves they do. This is cooperative and unobserved on a native host.
- **R2. `INTENT.md` round trip.** See §5.5, Q9 and E15. Needs a red-first test and may need a projection change (`core/intent-md.ts`).
- **R3. Actor entries as assumptions.** An unconfirmed assumption blocks the verdict (`assumption-unresolved`), which makes the actor section something the user must confirm. This is intended, and adds one confirmation to the existing basis preview, not one more question.
- **R4. Trait detection under-detects.** If QLT-11 misses `auth` behavior implemented by indirection, no note is required. The note's existence rests on trait evidence (`trait-detection.md` §7).
- **R5. Resource reach.** Agents that cannot load skills may never read `threat-note.md`. The kernel rubric item is the reliable path; the resource is for hosts that do load it (unobserved).
- **R6. Late note.** A trait discovered after review costs a basis revision and a review round (E8, Q7). Accepted.
- **R7. Reuse across contracts.** Answered from the code (§2): a basis cannot cite earlier elements as its own, so each contract writes a short note about its own change, while earlier entries remain as locked regression tests (project traits keep regression obligations, `trait-detection.md` TD-5).
- **R8. Weakening by correction.** Even with TN-13, a model can ask the question and the user's chat reply is `reported`. The note requirement is a cooperative control against a cooperative removal.
- **Assumptions.** Each of the four traits has a stable `R1Trait` id (it does: `core/traits.ts`); `persistence` raises no dimension today (`core/risk.ts`, `changeTraitRaises`); the lint's "claims enforcement" and "unscoped claim" word filters apply to the resource (it passes).

## 11. Acceptance criteria and gates

Before implementation: a second independent review with dispositions (§12 is the author's pass and the first review's record); owner answers Q1 to Q4, Q6 to Q10; owner sign-off on this spec; QLT-11 implemented and its migration gate passed (this spec is not implementable earlier); capacity decision. Implementation is red-first with E1 to E18, using wired trait state. Done when: all pass; `npm run ci` passes; the built bundle is driven on a scratch repository with a change touching an auth path and a repository file, observing `threat-note-open`, supplying the note through `decide --kind basis`, and observing the reason clear; the equipment-loan fixture of E4 produces the expected sections; `[QLT-13]` is then added to the E1 to E11 titles and R1 mapping is rechecked. Update `trait-detection.md` TD-10, E20 and (per Q7) §5 item 8 and E22; Tech Spec §§5.3 and 8.3 and Appendix C, §6.2 (a row for `core/threat`); the UX Spec per Q10; and PRD wording only for what changes. Host behavior stays "unobserved".

## 12. Review pass and dispositions

### 12.1 Author's pass (2026-11-03, before the independent review)

Method: re-read QLT-13 ("For changes with `auth`, `persistence`, `personal-data` or `external-effects` traits, Tenet shall record a short threat and data note whose security items become tests or constraints"), PRD §5.16 (four bullets and "become tests or constraints, not just review notes"), and `trait-detection.md` TD-10 and E20 against §§3 to 5. This was a self-review, not an independent review.

| # | Finding | Disposition |
|---|---|---|
| 1 | The first draft recorded the note in prose and linked items by convention. | Fixed: the entries are basis elements (§5.1). |
| 2 | "Record" a note: a derived view stores nothing. | Accepted and stated: the elements are the record, in project intent. Option B (explicit record) is listed (Q1). |
| 3 | `judgeElement` treats a `constraint` as needing no verification. | Revised: TN-11 and `threat-constraints-unchecked` make the limit visible (review T2). |
| 4 | Lane gap: `persistence` raises no dimension. | Open: Q3; E12 now states the recommended behavior. |
| 5 | "Short" had no bound. | Fixed: 12 entries, 300 characters each (TN-2); the numbers are proposals. |
| 6 | `unknown` traits: the PRD says the note is for changes "with" the traits. | Open: Q5. |
| 7 | Project traits must not require a note. | Fixed: TN-1. |
| 8 | Composition: four notes for four traits would be wasteful. | Fixed: TN-6 and E3. |
| 9 | Change traits are known only after the candidate diff exists. | Revised: `undetermined` when unassessed, TN-14, and the late-trait consequence and its conflict with `trait-detection.md` §5 item 8 (Q7). |
| 10 | The resource was written for a separate note record. | Revised: link wording corrected to TN-3 (§7). |
| 11 | The Reviewer and Analyst cannot load skills. | Open as unobserved (R5); the kernel rubric item is the reliable path; Deep drafting specified (§5.3). |
| 12 | A byte-for-byte text test of the resource would only prove the sentence exists. | Accepted: no such test and no tag (§4 preamble). |
| 13 | The `INTENT.md` projection may drop an unknown field. | Revised: §5.5, Q9, E15. |
| 14 | QLT-13 maps to AC-20 only. | No change; out of scope. |
| 15 | The note requirement text in TS §5.3 appears only in Standard's row; Deep inherits it. | Confirmed by reading §5.3; no change. |
| 16 | Elements are project-level and durable, so a second contract meets the same requirement. | Answered from the code: R7. |

### 12.2 Independent review (2026-11-03)

[reviews/trait-threat-data-review.md](reviews/trait-threat-data-review.md): 15 findings (0 Blocker, 9 Major, 6 Minor). Every finding has a disposition in the table appended to that file. This revision changes §1, TN-3 to TN-14, E1 to E18, §5.1 to §5.6, §6, §7, §9 (Q1 and Q4 revised; Q7 to Q10 added) and §10. A second independent review of this revision is required.
