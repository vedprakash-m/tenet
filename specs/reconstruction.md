# Specification: Reconstruction after Loss, Clone or Move (CON-07, CON-11)

> Status: Reviewed 2026-10-24 (fresh-context subagent: 13 findings, 2 blockers; every load-bearing claim re-checked in code; dispositions in §11). **§12 (v2) supersedes §3 to §10 where they differ.** Awaiting owner decisions (§13). No code before sign-off. Date: 2026-10-24 | Decision owner: @vedprakash-m.
> Sources: PRD CON-07, CON-11, CON-03, CON-06, §5.6, §5.14 (continuity matrix), §7.1; tech-spec §7.5 (quarantine), §7.8 (intent file), §7.9 (identifiers, test tags), §9.7 (locks), §15.3 (reconstruction row); ux-spec "Local records missing (CON-07)" row (line 603).

## 1. Outcome

When `.tenet/` is gone (deleted, or never present in a fresh clone of a project Tenet worked in), the next `open` shows what the repository still remembers (the project's purpose, requirements, decisions, plan, the tests that carry example tags, the work labels already used) and asks one question. If the user accepts, Tenet starts from that meaning with **no** grant, consent, passing receipt, trust entry or open contract carried over. Nothing is guessed: a fact the repository cannot show is reported as not recovered.

**Verification:** a scratch Git repository driven through a real Tenet loop (adopt intent, commit work with trailers, lock a test), then `rm -r .tenet` and a fresh clone; compare the `open` response, the stored state and `inspect` output with the examples in §4.

## 2. Current state (inspected 2026-10-24)

- With no state, `open` builds `emptyState` (`verbs/open.ts:40`, `core/state.ts:30`) and `ensureMarker` mints a new workspace ID and tag (`adapters/store-fs.ts:346`). Nothing reads the repository for prior Tenet records. CON-07 is **unbuilt**; plan line 480 lists it as an unchecked item.
- **Intent file.** `core/intent-md.ts` can parse the managed markers (`parseBlocks`, line 19) and write blocks (`renderIntent`, line 57; `projectIntent`, line 81). There is no inverse: block text is not parsed back into elements. The rendering omits `origin`, `verifiedBy`, `testFile`, `support` and a plan item's `elementIds` and `work`, so those cannot be recovered from the file.
- **Decision records.** `decide decision-record` stores a record in `state.project.intent.records` and shows it as a block in `INTENT.md` (`decisions/decision-record.ts`). No `docs/decisions/` MADR files are written by any code (plan RC2 lists MADR files as unbuilt), so today the only source of decisions is the `DEC-` blocks.
- **Trailers.** `commit` writes `Tenet-Work: W-NNNN` and optionally `Tenet-Req: …` (`verbs/commit.ts:184`). The only reader is `workCommits(label)`, one label at a time (`adapters/git-cli.ts:876`, `ports/types.ts:114`), used by undo (`verbs/undo.ts:26`). Nothing lists the labels in history.
- **Test tags.** The built convention is the example ID in square brackets in a test title, e.g. `[EX-006-5ze.1]` (`core/receipts.ts:48`, `matches = test.includes('[tag]')`). The technical specification says `// @tenet EX-012-q7k.1` (§7.9 line 949, §15.3 line 1721) and `core/residue.ts:8` repeats "`@tenet` tags"; **no code reads or writes `@tenet`.** This is a spec/code disagreement (to be logged in plan §12.3).
- **Locks.** `state.locks` entries are created only by `applyLocks` when an acceptance test goes red to green on a candidate (`verbs/check-evidence.ts:184`); each has `obligation`, `hash`, `anchor`, `supportInputs`. Lost with `.tenet/`.
- **Quarantine and moves.** A copied `.tenet/` (new inode) or one without a valid marker is quarantined as inert data (`adapters/store-fs.ts:224`, `decisions/quarantine.ts`; tests in `quarantine.test.ts`). A same-filesystem move keeps the inode (`quarantine.test.ts:95`, tagged `[CON-11]`). A branch mismatch stops `check`/`commit`/`finish` with `stale-session` (`pipeline-mutate.ts:75-79`). No grant is keyed by path (grants bind `factsHash(scope)`, `verbs/open-new.ts`). So the CON-11 behaviors for copy, move and branch exist but are covered by one test; the **clone** row of PRD §5.14 is the CON-07 path and is unbuilt.
- **Label reuse hazard.** After state loss the first new contract is `W-0001` again (`verbs/open-new.ts:108`, `workSeq` starts at 0). `undo` collects every commit whose trailer is `Tenet-Work: W-0001` (`git-cli.ts:878`), which would include old commits of a *different*, lost contract, and reverts them all (`verbs/undo.ts:26-40`). TS §7.9 says "labels may repeat after state loss"; the consequence for undo is not stated.

## 3. Requirements

| ID | Requirement | Source |
|---|---|---|
| RC-1 | At `open` with no state document and a repository footprint (a valid `INTENT.md` block, a `Tenet-Work` trailer, or a tagged test), Tenet computes a read-only **reconstruction preview** and asks one question. Without a footprint, nothing changes from today. | CON-07 |
| RC-2 | Sources, in this order of trust: `INTENT.md` managed blocks of the checked-out branch; decision-record files in `docs/decisions/` if present; example tags in tracked test files; `Tenet-Work`/`Tenet-Req` trailers in the last 500 commits of the current history. The quarantine directory and any remnant of `.tenet/` are never a source. | TS §15.3, §7.5 |
| RC-3 | Nothing recovered is authority or evidence: no grant, consent, receipt, trust entry, open contract or `adoption: adopted`. Recovered text is data (SEC-02). | CON-07, CON-06, SEC-12 |
| RC-4 | Recovered intent elements and plan items are created with provenance (`reconstructed`), and the preview names what could not be recovered (verification links, plan-item element links, support files, budgets, grants, results). | CON-07 |
| RC-5 | `workSeq` is set to the highest `W-NNNN` found in trailers, so a new label never repeats an old one and undo cannot select an old contract's commits. | CON-12, CON-07 |
| RC-6 | Lock proposals: a tagged test file that exists at HEAD with the same content as in the newest `Tenet-Work` commit that touched it becomes one proposed lock (whole file, anchored to that commit). Files changed since are listed, not proposed. A lock restricts only and implies no pass. | EVD-10, §9.7 |
| RC-7 | The single question binds the exact preview (hash). Acceptance publishes in one transaction and writes nothing to the project or Git. Declining keeps the fresh start; the repository is not read again for this purpose. | CON-07, CON-09 |
| RC-8 | Ask only consequential unknowns: malformed or duplicate markers (stop, `intent-markers-invalid`); conflicting IDs; a shallow clone's truncated history. Everything else is a reported limit, not a question. | CON-07 |
| RC-9 | Quarantine first: while a `quarantine-review` question is pending, the reconstruction question is not shown. Reconstruction never uses quarantined bytes. | CON-06 |
| RC-10 | Read-only calls (`inspect`) never reconstruct or write; `inspect --view status` says that reconstruction is available. | CON-09 |
| RC-11 | CON-11 matrix: for each PRD §5.14 row for clone, relocation, branch switch and loss, a test shows what is kept and that no authority transfers. | CON-11 |

## 4. Behavior as examples (test ownership)

| # | Example | Test file |
|---|---|---|
| E1 | Scratch repo: adopted intent with 2 requirements, 1 decision, 3 plan items; `rm -r .tenet`; `open` returns exit 3 with `reconstruction-review`, listing the counts and the limits; state contains no grant, consent, receipt, trust entry or contract beyond the new one. | `reconstruction.test.ts` [CON-07] |
| E2 | Accept: `project.intent` holds the recovered elements with `reconstructed` provenance; `adoption.intent` is `undecided`; `INTENT.md` is byte-identical; repeating `open` shows no second question. | same |
| E3 | Decline: fresh start, no intent recovered, no repeat of the question on the next `open`. | same |
| E4 | Trailers `W-0003`, `W-0007` in history: new contract is `W-0008`; `undo` of it names only its own commits. | same, `undo.test.ts` |
| E5 | Shallow clone: preview says history is truncated and labels may be incomplete; question asks to continue (consequential). | same |
| E6 | Fresh clone of the adopted repo (never had `.tenet/`): same preview as E1; no work contracts, no receipts, no locks unless E7. | same [CON-11] |
| E7 | Tagged test unchanged since its Tenet commit: one lock proposal listed; after acceptance `state.locks` holds it, `anchor.commit` is that commit, `supportInputs` is `{}` and the preview says support files are unknown. Edit the test first: listed as "changed since", not locked. | same |
| E8 | Duplicate `tenet:begin` marker: `open` stops with `intent-markers-invalid`; nothing reconstructed. | same |
| E9 | A copied `.tenet/` and a lost-state repo in one project: quarantine question first; after it, the reconstruction question; quarantined bytes never appear in the preview. | `quarantine.test.ts`, `reconstruction.test.ts` |
| E10 | `inspect --view status` on a footprint repo writes nothing and mentions reconstruction. | `reconstruction.test.ts` [CON-09] |
| E11 | Matrix tests for relocation (same filesystem), branch switch to a branch with a different `INTENT.md`, and loss-with-no-adoption (message says records are lost). | `reconstruction.test.ts` [CON-11] |

## 5. State and contract changes

- `State.project.reconstructed?: { at, sources: { intentHash: string | null, decisionFiles: number, tags: number, trailers: number }, scanned: number, truncated: boolean, notRecovered: string[] }` (new optional field; absent in existing documents).
- Elements and plan items recovered get `origin: "tenet"` and are listed in `reconstructed.elementIds` (D4).
- New pending question `reconstruction-review` (chat), bound to `factsHash` of the preview; answered through `decide adopt --target reconstruction` (the quarantine pattern).
- New ports: `git.history(limit)` returns `{ labels: string[], reqs: string[], scanned, shallow }`; `git.taggedTests()` returns tracked test paths with example tags and their blob and newest Tenet commit. Both read-only.
- New pure module `core/reconstruct.ts` (parse blocks to elements, merge, preview, hash). No change to `verdict.ts`/`budget.ts`.
- New reason code (note): `reconstructed-from-repository`.
- Schema: one optional field on `project`; D-5 of `schema-migration.md` applies (back-fill silently).

## 6. Alternatives considered

| Option | Behavior | For | Against |
|---|---|---|---|
| A. Status quo | Fresh start; document that `.tenet/` loss loses everything | no code | fails CON-07; the label-reuse undo hazard stays |
| B. Silent restore | Rebuild at `open`, no question | no friction | writes meaning the user never saw; PRD §5.6/CON-06 forbid |
| C. Preview plus one question (this draft) | Read-only preview at `open`; accept publishes inert records | meets CON-07 and the UX row; bounded writes | new ports, parser, question |
| D. Committed manifest | Tenet commits a machine-readable record of IDs and links so restoration is lossless | recovers verification links, plan links | a new shared file (PRD §3.2 amendment); more repo noise |
| E. On request only | Reconstruct only when the user asks (`decide adopt --target reconstruction`) | no new open-time cost | user must know it exists; the lost-state label hazard stays unless RC-5 runs anyway |

**Recommendation: C**, with RC-5 (label high-water) running in every case where trailers exist, because it prevents a wrong undo.

## 7. Risks

- Lossy parse: block text is rendered prose; a parse that misreads a block misstates the project. Mitigation: only blocks whose re-rendering equals the file text are recovered; others are listed as "not recovered".
- A user edit to a block (legitimate) is read as intent; it was a human edit, and the preview says the file is the source.
- A trailer can be forged in a commit message. Trailers only raise `workSeq` and propose locks the user confirms; they carry no authority.
- Large histories: bounded by 500 commits and a 300 ms budget; truncation is reported.
- Budget: new code lands in `verbs` and `decisions` (ceiling enforced by `tools/lint-quality.ts`); the owner pre-approved increments under 1%.

## 8. Assumptions

- A1: `INTENT.md` blocks are the intended primary source (PRD §5.14 "recovered from repository if adopted").
- A2: Tenet's own trailer format will not change.
- A3: Test authors use `[EX-…]` titles because the intake skill tells the coordinator to (plan 2026-10-20 entry).
- A4: Users accept `origin: tenet` provenance for recovered elements.

## 9. Acceptance criteria

All in §4, plus: `npm run ci` green; the built bundle passes a scratch UAT of E1, E2, E6, E7; `lint-skills` passes for any skill text added; no network or host run.

## 10. Decisions for the owner (one at a time)

- **D1.** Approach C (recommended), D or E?
- **D2.** Lock proposals in this slice (recommended: yes, behind the same question) or list them only?
- **D3.** Tag grammar: scan `[EX-…]` in titles as built (recommended) and amend TS §7.9/§9.2/§15.3 and `residue.ts`; or implement `// @tenet`?
- **D4.** Provenance of recovered elements: `origin: "tenet"` plus the `reconstructed` list (recommended), or add a third origin value?
- **D5.** MADR files: scan `docs/decisions/` only when they exist (recommended), parsing added with RC2.
- **D6.** History window: 500 commits (spec) or all reachable, bounded by time?

## 11. Independent review: findings and dispositions (2026-10-24)

A fresh-context read-only subagent checked every §2 claim and the design. §2 holds except the claims noted. Load-bearing claims were re-verified by the author in code.

| # | Sev | Finding | Verified | Disposition |
|---|---|---|---|---|
| 1 | Blocker | `acquire()` creates `.tenet/` and the marker for every mutating verb before `open` runs (`store-fs.ts:204-208`), so an absent `.tenet/` is never quarantined, and "no state document" is false after the first open publishes. `read()` has three cases: marker only (null), `state.prev` only (recovered state), corrupt with no prev (throws) (`store-fs.ts:183-200`). | yes | **Accepted.** v2 defines the trigger as `read()` returning null and `project.reconstruction` unset, persists the outcome, and leaves the other two cases to the existing recovery and refusal (CON-05). RC-1, RC-9, E12-E13. |
| 2 | Blocker | Declining does not remove the label hazard, so RC-5 contradicts RC-7/E3. Root cause is `planUndo`: it only requires the work's own commits to be among the matches, so extra commits with the same trailer are reverted (`undo.ts:29-31`, `git-cli.ts:878`). Forged trailers, merged branches and two clones reach the same state. | yes | **Accepted.** Split out as **slice 0**: `undo` refuses with `undo-conflict` when a matching commit is not one of `w.git.commits`. Independent of reconstruction, ships first, logged in plan §12.3. RC-5 stays as a convenience (labels seeded from all refs) and no longer depends on the answer. |
| 3 | Major | Element-ID sequences restart too (`highestSeq`, three allocators: `basis-build.ts:48`, `decision-record.ts:26`, `plan.ts:24`). The pending question must fence dependent mutations or `basis` would build on empty intent. | yes | **Accepted.** The question fences `basis`, `plan`, `overview` and `decision-record` like `quarantine-review`. After a decline an allocated ID may equal a block ID in `INTENT.md`; `projectIntent` treats it as a human-edited block and keeps it (reported), so nothing is overwritten. Accepted as a documented limit (D5 offers seeding the allocators instead). |
| 4 | Major | Recovered plan states (`done`, `accepted`) assert completion no receipt supports; `origin: "tenet"` is loaded. | partly: `basis.ts:32,77,118,172` read `origin` of proposal elements only, not stored intent | **Accepted.** All recovered plan items are `proposed`; elements get `verifiedBy: []`. Provenance is the `reconstructed` list; implementation must prove with a test that no code reads `origin` of stored intent for a decision (D4). |
| 5 | Major | Lock proposals over-claim: red-to-green was never observed after loss; `Lock.obligation` is required and no obligation exists; locks create `changedLocks` blockers (`facts.ts:99`) in every contract containing the anchor. | yes | **Accepted: locks are out of this slice.** The preview lists tagged test files as "not locked; their red-to-green proof is gone". D2 default becomes list-only. PRD/TS "propose the lock manifest" stays open with this reason. |
| 6 | Major | The question asks for consent to content the user has not seen; after one answer the text becomes `project.intent`. | yes | **Accepted.** The question shows the recovered text (bounded) and `inspect --view reconstruction` shows all of it; the question binds the hash of the full content; a changed `INTENT.md` or history before the answer invalidates it and asks again. Options: "Use these records" / "Start fresh". |
| 7 | Major | A broken marker made `open` fail, but elsewhere it is only a note (`reconcile.ts:48`); shallow history is a limit, not a question. | yes | **Accepted.** A broken `INTENT.md` skips reconstruction with the existing `intent-markers-invalid` note and a fresh start; no question. Shallow history is a reported limit. The only question is the one consent question. "Conflicting IDs" dropped (no example). |
| 8 | Major | Parsing: kind must come from the ID prefix; examples and invariants nest under a requirement; multi-line text cannot round-trip; no inverse of `renderIntent` exists, so the slice is mostly a new parser. | yes | **Accepted.** v2 recovers only blocks whose re-render equals the file text; others are listed as not recovered. Size is stated honestly (a new `core/reconstruct.ts`, about 150 lines, plus tests); the budget claim is removed and the owner is asked (D6). |
| 9 | Minor | PRD §5.14 rows "clone without shared adoption" and "adoption declined then lost" need a defined meaning of adopted; no trust entry means later `INTENT.md` edits are not tracked until adoption; `written = {}` at adoption; `tenet.policy.json` restrictions already apply; work status is not rebuilt. | yes | **Accepted.** "Adopted" = a valid, block-bearing `INTENT.md`. E2 states the adoption consequences. Work status is deliberately not rebuilt: a trailer proves a commit, not an outcome. |
| 10 | Minor | Missing cases: non-Git and shadow mode, detached or unborn HEAD, two simultaneous opens, crash during accept, stale handles, a surviving `.tenet/log` that is ignored, forged huge labels, unused `Tenet-Req`. | yes | **Accepted** as RC-10, RC-11 and E14-E18. `Tenet-Req` dropped. Labels above 99,999 are ignored. |
| 11 | Minor | Requirements without tests (RC-4, RC-11), hostile-trailer test missing. | yes | **Accepted**; every v2 requirement has an example. |
| 12 | Minor | Architecture: reason code needs a registry entry and exit; schema stays 1 (optional field in a strict `State`; marker requires schema equality). | yes | **Accepted.** `reconstructed-from-repository` is registered as a note, exit 0; the field is optional, no schema bump. |
| 13 | Minor | Alternative E was a strawman; the status quo plus the undo guard deserves a fair row; D (committed manifest) rejection thin; D3 should list `residue.ts:8` and the PRD wording; D6 moot. | yes | **Accepted.** §12.4 rewrites the alternatives; D3 lists the files; the 500-commit window is dropped in favor of an unbounded trailer search. |

## 12. Revised scope, v2 (supersedes §3 to §10 where they differ)

### 12.1 Slices

- **Slice 0 (a defect, ships first, needs no reconstruction):** `undo` refuses when a commit matching the label's trailer is not one of the work's own commits. Test in `undo.test.ts` with a repeated label (two contracts, one label, as after state loss, a forged trailer, a merged branch). Reason `undo-conflict`, no new code.
- **Slice 1 (CON-07):** reconstruct intent and label high-water, inert, behind one informed question.
- **Slice 2 (CON-11):** the §5.14 matrix as tests, plus clone behavior from slice 1. No new mechanism.
- **Not in this feature:** locks, tagged-test recovery, MADR files, work-status rebuild, policy and charter re-adoption (they stay as today: policy restrictions apply unadopted, the charter is read-only).

### 12.2 Requirements

| ID | Requirement |
|---|---|
| R0 | Slice 0 above. Source: CON-12, CON-07. |
| R1 | **Trigger.** On a mutating `open`, if `store.read()` returns null (no readable `state` and no `state.prev`) and `project.reconstruction` is unset, compute the preview. Cases with `state.prev` or an unreadable state keep their existing behavior (backup recovery; `unsupported-record` refusal). The first published state records `project.reconstruction`: `offered`, then `accepted` or `declined`. Non-Git and shadow-repository projects have no trailers: the preview still works from `INTENT.md`. |
| R2 | **Sources.** `INTENT.md` managed blocks of the checked-out branch (all that re-render identically), and `Tenet-Work` trailers across all refs (unbounded `git log --grep`, labels above 99,999 ignored). Nothing else; `.tenet/` remnants, the quarantine directory and `.tenet/log` are never read. |
| R3 | **Inert.** No grant, consent, receipt, lock, trust entry, open contract, budget or `adopted` state is created. Plan items become `proposed`, elements get `verifiedBy: []`, the counters start at zero. |
| R4 | **Provenance and limits.** `project.reconstruction.elementIds` lists recovered IDs and `notRecovered` names what the file could not give (verification links, plan links, support files, results, budgets) and any block skipped. |
| R5 | **Labels.** `workSeq` starts at the highest `W-NNNN` found, whatever the answer, so the new contract is not `W-0001`. (Slice 0 makes this a convenience, not a safety property.) |
| R6 | **Informed consent.** One question `reconstruction-review` (chat) shows the counts, the first items verbatim and the limits; `inspect --view reconstruction` shows everything read-only. Options "Use these records" / "Start fresh". It binds the hash of the full recovered content; a changed file or history makes an answer stale and the question is asked again. |
| R7 | **Fence.** While pending, `basis`, `plan`, `overview` and `decision-record` return the question. Stop and abandon stay available. Quarantine goes first: while `quarantine-review` is pending the reconstruction question is not shown, and it is shown at the next `open` after that answer. |
| R8 | **Writes.** Accept is one state publish; nothing is written to the project or Git. A crash leaves the old or the new state. Decline records `declined` and recovers no intent. |
| R9 | **Broken input.** Unbalanced, duplicate or malformed markers: no reconstruction, the existing `intent-markers-invalid` note, fresh start, no question. Shallow history: a reported limit. |
| R10 | **Read-only views.** `inspect` never reconstructs or writes; `inspect --view status` names that a reconstruction is available. |
| R11 | **CON-11 matrix.** Tests for relocation, branch switch, clone with and without adopted intent, and loss with and without adoption show what is kept and that no authority transfers. |

### 12.3 Examples (test ownership)

E1 preview after `rm -r .tenet` (exit 3, text shown, nothing written); E2 accept (intent present, `adoption.intent` undecided, `INTENT.md` byte-identical, no trust entry, so later edits to blocks are noticed only after `decide adopt`, where unrecovered blocks count as human-edited); E3 decline, not asked again; E4 trailers `W-0003`, `W-0007` give `W-0008` (also after decline); E5 plan item `done` in the file returns `proposed`; E6 fresh clone equals E1; E7 hand-edited block that no longer re-renders is listed as not recovered; E8 hostile `Tenet-Work: W-99999999999` ignored; E9 broken marker: note, fresh start, no question; E10 quarantine first, reconstruction at the following open, quarantined bytes never shown; E11 `inspect --view reconstruction` writes nothing; E12 `state.prev` only: recovered backup, no reconstruction; E13 unreadable state: refusal, no reconstruction; E14 non-Git folder with `INTENT.md`: preview works, no trailers; E15 two simultaneous opens: one question; E16 SIGKILL during accept: old or new state, never half; E17 file changes between preview and answer: stale, asked again; E18 CON-11 matrix; E19 slice 0 undo guard. Files: `reconstruction.test.ts` (new), `undo.test.ts`, `quarantine.test.ts`, `store.test.ts`.

### 12.4 State, ports, alternatives

- State: optional `project.reconstruction: { status: "offered" | "accepted" | "declined", at, sources: { intentHash | null, trailers }, labelHighWater, elementIds, notRecovered }`. Pending question `reconstruction-review`. New reason note `reconstructed-from-repository` (exit 0). New port method `git.workLabels()` (all refs, read-only). New pure `core/reconstruct.ts`. Schema stays 1.
- Impact: `open.ts` `begin()` (trigger, label seed), `decisions/adopt.ts` (new target `reconstruction`), `pipeline-render.ts` (question surface), `verbs/inspect.ts` (view), `undo.ts` (slice 0). Rendered text: one new question and one note. Skill text: one routing line; no new decision kind.
- Alternatives: **A** status quo plus slice 0 and documentation (cheapest; leaves CON-07 unmet and loses intent); **B** silent restore (rejected: unseen content becomes accepted facts, CON-06); **C** informed question with inert records (recommended); **D** committed manifest of IDs and links (lossless, but a new shared file needing a PRD §3.2 change and still unseen-content consent); **E** on request only (`decide adopt --target reconstruction` without an open-time offer; cheaper, hidden). **Recommendation: slice 0 now, then C.**

## 13. Decisions for the owner (review applied, one at a time)

- **D1.** Ship slice 0 (undo guard) first and independently? Recommend yes.
- **D2.** Approach C (recommended) or A, D, E for CON-07; locks out of this slice (recommended) with "propose the lock manifest" left open?
- **D3.** Tag grammar defect: amend TS §7.9, §9.2, §15.3, `core/residue.ts:8` and the PRD wording to `[EX-…]` in test titles as built (recommended), or implement `// @tenet`? (No effect on this slice, which does not read tags.)
- **D4.** Provenance: `origin: "tenet"` plus the `reconstructed` list (recommended; needs a test that stored intent's `origin` is not read), or a new origin value in both schema enums?
- **D5.** ID collision after a decline: accept the documented limit (recommended) or seed the three allocators from `INTENT.md`?
- **D6.** Size and budget: the parser is new code in `core/` plus about 60 lines in `verbs`/`decisions`; approve a recorded increment, or defer CON-07 until the budget allows?
