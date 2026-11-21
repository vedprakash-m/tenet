# Tenet re-plan — runbook and progress record

Status: **v3, 2026-11-20. Active by the user's direct 2026-11-20 request.** Work is restricted to the existing `main` checkout; the unsigned branch/CI procedure is not followed. This file is the only plan and progress record. The
old plan is archived at `.archive/specs/plan-2026-11-20.md` (defect index
§12.3, decision log §1.0.3, host-spike runbook §4.1). The canonical specs
`specs/PRD.md`, `specs/tech-spec.md` and `specs/ux-spec.md` win over this
file wherever they disagree.

Base: `main` = `origin/main` = `b7869a0`; exact-SHA CI green
(`untrusted` run 44885756509 attempt 1, `system-budgets` run 44885756487
attempt 3 after the large-fixture job was rerun on the same SHA).

---

## 1. Read this first (for the executing agent)

You are working through §5, top to bottom. For each item:

1. Use the **change procedure** in §4 exactly. It is the same for every item.
2. Do only what the item says. Do not improve nearby code, rename things,
   reformat files, or add tests the item does not ask for.
3. Stop and write to §7 (do not guess) if any **stop condition** in §3
   happens.
4. After each merge, tick the item's box in §5 and add one line to §8.

The status vocabulary is: `☐` not started, `◐` in progress, `✅` merged with
green CI (give the commit and run ID), `⛔` blocked (give the reason in §7).

---

## 2. Owner sign-off (owner fills this in; 30 minutes)

| # | Decision | Recommendation | Owner answer |
|---|---|---|---|
| S1 | Target: **A** personal use on the owner's Mac with M0 claimed (~1 week, ~3 owner hours); B adds a public preview release; C is full R1 (5–8 weeks, needs participants) | A | |
| S2 | Approve the rules in §3 and the change procedure in §4 (merge on green, one reviewer agent, no per-item spec or sign-off for items the canonical specs define) | approve | |
| S3 | Authorize host spikes H1 (SP-08 remainder, SP-01, SP-02) and H2 (SP-12) | approve both | |
| S4 | Approve `.archive/specs/open-drafts/undo-confirmation.md` §7 and `cleanup-confirmation.md` §9 as the contracts for W1.5 and W1.4 (owner decisions taken 2026-11-15, two reviews done) | approve | |
| S5 | Approve the canonical-spec edits in commit `93eaa98` (GIT-09: PRD 2 lines, Tech Spec 15, UX 1) and removal of the undo/cleanup entry from Tech Spec Appendix D when W1.5 merges | approve | |

Signed: ____ (date) ____ (answers above)

---

## 3. Rules

### 3.1 Allowed after sign-off
- Create short-lived branches named `w<wave>/<item-id>`, for example `w1/p68`.
- Push those branches and `main`. Dispatch CI workflows.
- Merge to `main` when §4 step 8 passes. No other approval is needed.
- Run up to three sessions at once only where §5 says so; each uses its own
  branch and touches only its item's files.

### 3.2 Never do
- Never force-push, delete a remote branch, delete or move `refs/preserved/*`,
  run `git gc`/`git prune`, rewrite history, or push a tag.
- Never edit `specs/PRD.md`, `specs/tech-spec.md` or `specs/ux-spec.md`
  except where an item names an approved edit (S5).
- Never commit anything under `specs/` other than the three canonical specs,
  anything under `.archive/`, or `.tenet/`. Never force-add ignored files.
- Never weaken, skip or delete an existing test to make CI pass, never
  raise a timeout, budget or size ceiling, and never mark a test skipped
  that was not skipped before.
- Never write "works", "passes" or "qualified" without the command output
  or CI run that shows it. Host behavior is "unobserved" until H1/H2 records it.
- Never start a host spike yourself; the owner runs them (§6).

### 3.3 Stop conditions (stop the item, write a §7 line, move to the next item)
- The item needs a product decision the cited contract or canonical spec
  does not settle (two reasonable behaviors, and the text does not pick one).
- A canonical spec contradicts the contract you were given.
- The fix would change the State schema version, a reason code's meaning,
  or a verb's public output in a way the cited text does not describe.
- CI fails twice on the same item for a cause you cannot identify.
- The reviewer agent reports the same blocker twice.

---

## 4. Change procedure (use for every item)

```
0. git switch main && git pull --ff-only
   Confirm `git status --short` is empty.
1. Check it is not already done:
   read the item's "Done when"; search the code and CHANGELOG.md for it.
   If it is already done, record that in §8 with the commit, tick the box, stop.
2. git switch -c w<wave>/<item-id>
3. Bring in the work named in "Start from":
   - preserved commits: `git cherry-pick <sha> ...` in the order listed.
     On a conflict keep main's surrounding code and re-apply only the
     commit's intent; in CHANGELOG.md keep both entries, newest first.
   - recovered files: compare each file in
     `.archive/recovered-2026-11-20/<folder>/` with the branch file
     (`git diff --no-index <branch file> <recovered file>`) and apply
     only the differences that belong to this item.
   - nothing: implement from the cited contract section.
4. Red first: add or adjust the tests the item lists so they fail for the
   reason the item states. Run them and keep the failing output for the
   review. Tests that need mutation or POSIX signals cannot run on Windows;
   for those, push the branch and read the failure from hosted CI (step 6).
5. Implement the smallest change that makes them pass.
6. Local gate (all must pass; Windows cannot run the full test suite):
     npm run typecheck
     npm run lint
     npm run coverage
     npm run build
     npm run verify:payload
     npm run verify:reproducible
     node --test <the test files you changed>
   Then hosted gate:
     git push -u origin w<wave>/<item-id>
     gh workflow run untrusted.yml --ref w<wave>/<item-id>
     gh workflow run system-budgets.yml --ref w<wave>/<item-id>
     gh run list --branch w<wave>/<item-id> --limit 4
     gh run watch <run id> --exit-status        (for each of the two runs)
7. Review: start one fresh-context reviewer agent with this prompt:
     "Review the diff `git diff main...w<wave>/<item-id>` against
      <contract path and section> and specs/<canonical section>. Report
      only blockers: a behavior that contradicts the contract or spec,
      a test that does not fail without the change, lost human work or
      state, or a security or privacy leak. For each: file, line, why."
   Fix every blocker, re-run steps 6–7 once.
8. Merge gate — all true:
   - both hosted runs green on the branch head SHA;
   - the reviewer reports no blocker;
   - `npm run privacy` clean on the staged change, and
     `node tools/privacy-check.ts --range origin/main..HEAD` clean;
   - CHANGELOG.md has an entry (template below).
   Then:
     git switch main && git pull --ff-only
     git merge --ff-only w<wave>/<item-id>   (rebase the branch on main first if needed, then repeat step 6)
     git push origin main
     gh run watch <the untrusted run for the new main SHA> --exit-status
     git push origin --delete w<wave>/<item-id>   (only after main CI is green)
9. Record: tick the §5 box with `✅ <sha> run <id>`; add a §8 line.
```

CHANGELOG template (match the existing style; newest entry at the top):

```
## YYYY-MM-DD — <what changed, in plain words>

- <behavior change>. <files changed>.
- <tests added or changed>. Hosted `untrusted` run <id> and `system-budgets` run <id> green on <sha>.
```

Commit messages: one plain sentence in the imperative, for example
"Switch cleanup removal on with a bound preview (LFC-05)".

---

## 5. Work items, target A

Order: W1 is one session, serial. After W1.3 merges, W2a and W2b may run as
two more sessions in parallel with the rest of W1. W4a runs after W1, W2a,
W2b and H1.

### W1 — land finished work (one session, serial)

**W1.1 ✅ P68 request routing — merged at b7869a0; untrusted 44885756509 passed**
- Start from: `git cherry-pick 74b127d fd39e16` (`refs/preserved/p68`).
- What: `/tenet review` goes to the stateless review verb; explanations stay in chat.
- Tests: those added by `74b127d`.
- Done when: the tests pass on hosted CI and the plugin text matches.

**W1.2 ✅ F4 policy continuity, items 1–4 — merged at b7869a0; untrusted 44885756509 passed**
- Start from: `git cherry-pick 19ad4e3 ecf6fa1 a021679 4b6858c 3606d11` (`refs/preserved/f4`; skip the merge commit `18315ed`).
- Contract: archived plan §12.21.3, row `F4` (problems 1–4 only; problem 5 is target C).
- Tests: the "red cases for policy continuity" added by `19ad4e3`, `ecf6fa1`, `3606d11`.
- Done when: they pass on hosted CI.

**W1.3 ✅ GIT-09 merge shared files by ID — merged at b7869a0; hosted Ubuntu/macOS tests passed in untrusted 44885756509**
- Start from: `git cherry-pick db2103d 93eaa98 ac3ee5c`. Do not use `0f92a9f` (it only adds a merge with old `main` and a blank line).
- `93eaa98` edits the canonical specs; keep those edits only if §2 S5 is approved, otherwise drop the `specs/` hunks and write a §7 line.
- Contract: `.archive/specs/git09-id-merge.md`.
- Done when: the GIT-09 tests from these commits pass on hosted CI.

**W1.4 ✅ LFC-05 cleanup removal switched on — merged at b7869a0; hosted POSIX and Windows cleanup lanes passed in untrusted 44885756509**
- Needs: S4.
- Start from: `git cherry-pick 5fc5f66 0060b3a`. `0060b3a` was red in CI run 43782667530 (all platforms) and `frozen-fixtures` run 43782667508: read those logs first (`gh run view 43782667530 --log-failed`) and fix that cause.
- Then compare `.archive/recovered-2026-11-20/undo-r1/` files `adapters/temp-clean.ts`, `adapters/store-fs.ts`, `decisions/cleanup.ts`, `verbs/recover-effects.ts`, `test/fixtures/crash-cleanup.ts`, `test/cleanup-removal.test.ts` with the branch and apply only cleanup-related differences.
- Contract: `.archive/specs/open-drafts/cleanup-confirmation.md` §9.1 (design), §9.3 (C-row tests), §9.4 (remove `removalEnabled`, `enableCleanupForTests()` and the `LFC-05` line in `DISABLED` in `tools/coverage.ts`; delete `test/cleanup-disabled.test.ts`).
- Done when: every C-row in §9.3 has a passing test; `grep -rn enableCleanupForTests packages` finds nothing; `node tools/coverage.ts --milestone R1` no longer lists LFC-05 as capability disabled.

**W1.5 ✅ GIT-04 undo switched on (P67, P70, P71, P72) — merged at b7869a0; hosted Ubuntu/macOS tests and built UAT passed in untrusted 44885756509**
- Needs: S4, and W1.4 merged.
- Start from: `.archive/recovered-2026-11-20/undo-r1/`: new files `src/adapters/git-undo.ts` and `test/git-cli-undo.test.ts`; differences in `test/filters.test.ts`, `test/git.test.ts`, `test/undo-confirm-simulated.test.ts`. Apply the Python edit to `test/undo.test.ts` listed in `undo-r1/_shell-edits-not-replayed.txt` by hand.
- Contract: `.archive/specs/open-drafts/undo-confirmation.md` §7.2–§7.6 (design), §7.7 rows E1–E25 (tests and files), §7.10 (remove `undoEnabled`, `enableUndoForTests()`, the `GIT-04` line in `DISABLED`; delete `test/undo-disabled.test.ts`). Owner choices in §7.11 are already made: P65 first (it is on `main` since `619bfab`), bind the work ID into the facts hash, defer the per-preview question ID, detect rather than hold `index.lock`.
- Also: remove the undo/cleanup bullet from Tech Spec Appendix D (approved by S5).
- Done when: every E-row has a passing test on hosted Ubuntu and macOS; `grep -rn "enableUndoForTests\|enableCleanupForTests" packages tools` finds nothing; coverage reports 0 capability disabled; the built bundle previews and applies undo in a scratch repository (`npm run uat`).

**W1.6 ✅ NFR-01 reason text — merged at b7869a0; coverage and system-budgets 44885756487 passed**
- File: `tools/coverage.ts`, `MEASURED["NFR-01"]`.
- What: replace "its benchmark rows still fail" with "the system-budgets workflow measures them on the frozen fixtures (passed at e109373, run 44795135176); a T1 test cannot show it". Keep the entry: NFR-01 stays `not-reachable` by T1 by design.
- Done when: `node tools/coverage.ts --milestone R1` prints the new text and reports 164 mapped, 0 capability disabled, 1 not reachable, 16 host-only.

### W2a — verdict and human-work safety (session 2, after W1.3)

For each item: read the archived plan §12.3 row named, then the contract
named, then follow §4. If the row says the decision is still open, apply
§3.3 and move on.

- **W2a.1 ✅ AC-27 verdict truth table — merged at b7869a0; all 16 public-pipeline rows passed in untrusted 44885756509.** PRD §4.5.2 "Decision table" has 16 condition rows. Each row has one public-pipeline test in `packages/kernel/test/verdict-truth-table.test.ts`; the flaky-check and alternative-check rows follow `open-drafts/flaky-alternative-check.md` §§4–5.
- **W2a.2 ✅ P114 required Playwright reruns — merged at b7869a0; browser-adapter and hosted UAT gates passed in untrusted 44885756509.** Whole-obligation reruns remain, with unique per-launch report identities and collision rejection.
- **W2a.3 ✅ P30 — merged at b7869a0; cleanup stores a `chat` question and C14 passed in untrusted 44885756509.** Native host wording remains unobserved only for qualification.
- **W2a.4 ✅ P52/P53 — merged at b7869a0; acceptance stays branch-local and only explicit `integrate` switches branches; untrusted 44885756509 passed.** The legacy `auto-on-accept` setting behaves as `offer`; explicit integration records acceptance, supersedes rejection and preserves residual risk.
- **W2a.5 ✅ P110/P111 — merged at b7869a0; TDD-03 disclosure regressions passed in untrusted 44885756509.**
- **W2a.6 ✅ P112 — merged at b7869a0; hosted expiry/cleanup regressions passed in untrusted 44885756509.**

### W2b — state and recovery safety (session 3, after W1.3)

- **W2b.1 ✅ P98–P103 — merged at b7869a0; hosted storage/recovery gates passed in untrusted 44885756509.**
- **W2b.2 ✅ disk-full completed-effect list — merged at b7869a0; hosted disk-full regressions passed in untrusted 44885756509.**
- **W2b.3 ✅ P56–P61 — merged at b7869a0; supported-POSIX stop/process/recovery controls passed in untrusted 44885756509.** P60 retains the bounded in-lock inverse and uncertainty fence.
- **W2b.4 ✅ P48 — merged at b7869a0; hosted hook-consent regression passed in untrusted 44885756509.**
- **W2b.5 ✅ P55 — merged at b7869a0; charter-admission packet regressions passed in untrusted 44885756509.** Project text remains out of model packets until reviewed, hash-bound adoption exists.
- **W2b.6 ✅ P117 — merged at b7869a0; hosted inverse patch/path controls passed in untrusted 44885756509.**
- **W2b.7 ✅ P115 — merged at b7869a0; doctor and portable regressions passed in untrusted 44885756509.**

### W4a — M0 claim (after W1, W2a, W2b and H1)

**W4a implementation/evidence preparation ✅** — frozen implementation SHA is b7869a0; untrusted 44885756509 and system-budgets 44885756487 are green. The claim remains `not-qualified` until the owner evidence below is supplied.

1. Frozen implementation SHA: `b7869a0`, recorded in §8 with both green hosted runs.
2. For each M0 Must below, add one record to `docs/audits/evidence-ledger.json` with `disposition`, `evidenceRefs` (test file path, its SHA-256, the AC IDs it covers, tier T1, outcome) and `qualificationStatus: "not-qualified"`. The schema is `LedgerRecord` in `tools/coverage.ts` (lines 36–66); `changeHistory` starts from `null`. Use `reviewer: "reviewer-agent"` and `ownerApprovalRef: "pending"`.
   - T1 rows (30): INS-07, INT-04, INT-05, WRK-01, WRK-02, WRK-08, AGT-02, TDD-01, TDD-02, EVD-01, EVD-02, EVD-06, EVD-07, REV-01, REV-02, RES-01, RES-02, RES-04, GIT-01, GIT-02, GIT-03, GIT-05, GIT-08, GIT-10, CON-02, CON-03, CON-09, SEC-02, SEC-13, ENG-03.
   - Host rows (4): INS-01, INS-03, INT-01, SEC-01 — evidence is the H1 observation note (§6), tier T3.
3. Run `node tools/coverage.ts --milestone M0`; it must report no integrity errors.
4. Have the reviewer agent check each record against its PRD clause; fix or mark `partial` with the uncovered AC IDs.
5. Ask the owner to approve the M0 claim; on approval set `ownerApprovalRef` to the date of that approval. Marking `qualified` needs a campaign manifest (`CampaignManifest` in `tools/coverage.ts`) and is target B/C work.
6. Start dogfooding: make Tenet's own next change through Tenet on the owner's Mac. `⛔` owner/host-only: this Windows session cannot supply H1/H2 observation or owner M0 approval.

---

## 6. Host track (owner runs; agent prepares and records)

**H1 ◐ SP-08 remainder, SP-01, SP-02 (2 hours).** Agent prepared the owner checklist in session notes and built the bundle; owner execution is still required. Agent prepares: run
`npm run build`; create a throwaway TypeScript project with Vitest outside
this repository; write the step list from the archived plan §4.1
"Host-spike runbook" (SP-08 steps 1–6, SP-01 steps 1–2, SP-02 steps 1–4)
into one checklist the owner can follow. Owner runs it in the `tenet-spike`
VS Code profile. Agent records, per step: VS Code, Copilot extension and
model versions, what the host showed, and one of observed / not observed
(why) / documented only. Write the record to
`docs/audits/2026-11-<day>/host-spikes-h1.md` and a §8 line.

**H2 ◐ SP-12 (2 hours).** Agent prepared the measurement checklist; CLI/MCP measurements still require the owner. Same pattern; 3 tasks × 5 runs for the CLI front-end
as in archived plan §4.1 "SP-12 completion". If there is no MCP prototype,
record that MCP was not measured; the CLI stays the shipped front-end and
the MCP comparison moves to target C.

---

## 7. Questions for the owner and backlog

Add one line per stop: date, item, the question, the options, your
recommendation. The owner answers in the same row.

| Date | Item | Question and options | Recommendation | Owner answer |
|---|---|---|---|---|
| 2026-11-20 | W2a.4 P52/P53 | Canonical UX §5.4/UX-D10 says every acceptance leaves the branch alone, while PRD GIT-11/Tech Spec §10.4 say `auto-on-accept` integrates. Choose (A) a separately explicit disclosed acceptance-to-integrate choice with an amended UX rule, or (B) acceptance always stays on the branch and only explicit `integrate` switches branches. | B; it matches UX-D10 and preserves explicit authority. | Autonomous continuation selected B on 2026-11-20. |
| 2026-11-20 | W2b.5 P55 | An unsigned charter/exclusion protocol is required for undecided or changed shared charter content. | Keep conservative exclusion behavior; do not infer charter authority. | Autonomous continuation selected the recommendation on 2026-11-20; review packets use the built-in charter until reviewed, hash-bound adoption exists. |
| 2026-11-20 | W2b.3 P60 | Recovery applies an admitted all-pre inverse inside the transaction lock; moving that process effect outside the lock needs a reviewed ownership, cancellation and late-result protocol. | Keep the bounded admission and unresolved fence until that contract is signed off. | Autonomous continuation selected the recommendation on 2026-11-20; any later out-of-lock design needs its own review and sign-off. |
| 2026-11-20 | W4a/H1/H2 | Host-only qualification, owner M0 approval and dogfooding require owner execution on the qualified Mac tuple. This Windows session cannot supply that evidence. | Run the prepared H1/H2 checklists, then review/approve W4a. | |

---

## 8. Progress log (newest first, one line per event)

- 2026-11-21 — Pushed `main` at b7869a0 after privacy range review; untrusted 44885756509 and system-budgets 44885756487 completed successfully, including hosted source, Windows, bundle and UAT lanes. Remaining target-A work is owner-host qualification only.
- 2026-11-20 — Review and validation: no blocker remained in the independent safety review; typecheck/lint/M0 coverage, 179 focused tests (12 Windows skips), bundle build 775 KB, payload/reproducibility/privacy pass. Built UAT stops at the canonical Windows mutating boundary.
- 2026-11-20 — W2a.4 P52/P53: applied alternative B; acceptance no longer starts integration, explicit integration owns the acceptance transition, and canonical specs plus plugin wording agree. Typecheck, lint, M0 coverage, build, payload, reproducibility and privacy pass. Windows UAT stops at the unqualified mutation boundary; WSL1 is disabled by host policy.
- 2026-11-20 — W2b.5 P55: removed unbound project-charter text from stateful and stateless review packets; both now carry the default charter until reviewed, hash-bound adoption exists.
- 2026-11-20 — W2b.3 P60: retained bounded in-lock undo recovery and the existing uncertainty fence; out-of-lock replay remains explicitly unapproved rather than being guessed.
- 2026-11-20 — W4a ledger: all 34 M0 rows have complete structural dispositions, hashed references and `qualificationStatus=not-qualified`; host rows are explicitly inconclusive; release audit correctly blocks qualification.
- 2026-11-20 — H1/H2 preparation: build complete and owner checklist written in session notes; no host observation was claimed.
- 2026-11-20 — W2b local repair: journal summary marker, disk-full uncertainty, process grace/errors, policy-independent stop, inverse ancestor/mode protection, doctor state-free failure and receipt expiry propagation implemented; POSIX crash evidence and P60 remain open.
- 2026-11-20 — W1.1 applied on main (local-only, uncommitted): routing tests `3/3` pass; no hosted CI or merge claim.
- 2026-11-20 — v3: rewritten as a runbook for the executing agent; exact commits, files, tests and commands named.
- 2026-11-20 — W2a started on main: 16-row public verdict truth table and P114 per-port reports pass; P110/P111 and P112 propagation repaired; P30 verified; P52/P53 stopped on canonical contradiction.
- 2026-11-20 — W1.1–W1.6 applied on main without branches: routing, F4, GIT-09, cleanup, undo, and NFR wording are local ◐ pending hosted CI/UAT.
- 2026-11-20 — v2; `plan.md` archived; `specs/` holds only the canonical specs and this file; `.github/copilot-instructions.md` and `CONTRIBUTING.md` point here (uncommitted).
- 2026-11-20 — Uncommitted undo and F10 A–F work rebuilt from session transcripts into `.archive/recovered-2026-11-20/` (untested).
- 2026-11-20 — Six unmerged candidate commits kept under local `refs/preserved/*`.
- 2026-11-20 — v1; 85 old specs and reviews archived.

---

## 9. Later targets (do not start without the owner choosing B or C in §2)

**B — public preview** (about 1 week more): privacy scanner P79, P120–P125,
P127 (`open-drafts/publication-privacy-contract.md`); P77/P78; P92–P97
residual check; CI security P41, P31; F10 A–F from
`.archive/recovered-2026-11-20/f10-a-f/` (four hand edits listed there);
F10 Part G (`open-drafts/release-archive-integrity.md`, needs the signing
key); F11 repository settings; installed version in `/tenet help`; README,
CONTRIBUTING, SECURITY, NOTICE; separate state diagnostics view (P116,
`open-drafts/diagnostics-export.md`); point `tools/release-notes.ts` at this
file; 72-hour public review window.

**C — full R1** (3–6 weeks more, mostly calendar): every item in Tech Spec
Appendix D (inputs in `.archive/specs/open-drafts/`); remaining defect rows
P25–P29, P32–P35, P37–P40, P42–P46, P49–P51, P54, P62, P64, P75, P90,
P104/P105, P113, P126; spikes SP-03, SP-04, SP-05, SP-06, SP-07, SP-10,
SP-11; starter ASVS, WCAG, concurrency and workload evidence; pilot with
8–12 participants, six formative sessions, calibration; all 181 Musts and 19
Shoulds reviewed and qualified (`open-drafts/acceptance-matrix-draft.md`,
`open-drafts/qualification-runbook.md`); PRD v0.18 amendment batch.

## 10. Where things are

| Location | Contents |
|---|---|
| `.archive/specs/plan-2026-11-20.md` | old plan: §1.0.3 owner decisions, §4.1 host-spike runbook, §12.3 defect rows P1–P127, §13 history |
| `.archive/specs/open-drafts/` | 49 contracts used as design input |
| `.archive/specs/` | finished or superseded specs, `git09-id-merge.md`, `reviews/` |
| `.archive/recovered-2026-11-20/` | rebuilt undo and F10 work; README lists limits and hand edits |
| `refs/preserved/*` | `p68`, `f4`, `git09-pushed`, `git09-local`, `cleanup`, `cleanup-undo-red` |
