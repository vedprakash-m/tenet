# Feature spec: decision files, the hardening block and the prototype rules, and shared-file collisions (INT-09, QLT-17, WRK-06, GIT-09 part)

Status: **v2, after independent review** (2026-10-24). Not signed off; owner decisions in §12. Nothing here is implemented.
Canonical text: PRD INT-09, INT-10, INT-14, QLT-17, WRK-06, GIT-09, CON-01, §3.2, §3.7.3, §5.6; tech-spec §7.8, §7.9, §10.4; ux-spec UX-D15, J-09. If this file and a canonical spec disagree, the spec wins.

## 1. Outcome and scope

v1 covered five features in one change. The review (§11) showed they share little code and that two of them need decisions the plan does not settle. v2 delivers three slices in order; each is shippable and testable alone.

| Slice | Delivers | Requirement |
|---|---|---|
| **S1 Decision files** | One MADR file per decision, written at adoption and by `decide decision-record`; `open` reports files that appear, change or go missing; one command takes them in | INT-09, CON-01 |
| **S2 Hardening block and prototype rules** | A per-prototype block in `docs/hardening.md`; `open prototype` refuses personal data; `finish` names a missing gap record | QLT-17, WRK-06 |
| **S3a Collision detection** | Before `integrate` moves anything, same-ID different-content collisions in shared files are found, including the ones Git merges silently, and reported with the three texts | GIT-09 (detection and proposal text only) |

**Not in this spec, with the reason:**
- **GIT-09's applied resolution (S3b).** It needs a new way to build the merge commit and, for `INTENT.md`, a reverse parse that does not exist (plan §7.2). It is sequenced in §9 and is an owner decision (D7, D8). GIT-09 stays open after S3a; this spec does not claim otherwise.
- **`docs/architecture.md` blocks (INT-14, Should).** The coordinator drafts the text and the kernel only places it, the job S2 does for hardening. A generic `projectBlocks` is extracted in S2 (second consumer); a `decide architecture` verb is a later small step after S2 proves the shape.

## 2. Current state (verified in code, 2026-10-24)

- Adoption writes one file. `AdoptOp.file` is the literal `INTENT.md` (`decisions/adopt.ts:19-27`). `adopted()` writes the INTENT.md trust entry, adds the file to the contract's `vetted` and `touched`, and **always sets `adoption.intent = "adopted"`** (`adopt.ts:30-44`). `decideOn` asks once with `id "adopt-confirm"`, binds the answer to `factsHash` of the exact content, applies on a matching confirm, and on `decline` removes every `adopt-confirm` question (`adopt.ts:46-94`). The write is `tx.intent("adopt")`, `project.write`, `tx.result`, then the state publish (`adopt.ts:158-166`).
- Recovery: `SETTLE.adopt` compares the file hash with `op.after` and `op.before`; any other hash is `uncertain` (`verbs/recover-effects.ts:140-158`). `PUBLISH.adopt` replays the trust entry when `adoptionReplayNeeded` allows (`recover-effects.ts:206-211`, `core/state.ts:8-14`). `uncertain` fences every verb except `stop` (`pipeline-mutate.ts:158`).
- `trust` is a discriminated union on a literal `file`: the policy and `INTENT.md` (`core/schemas.ts:331-335`). `ADOPTED_FILES` already lists the architecture and hardening files for residue (`core/residue.ts:7`).
- Decision records live in state only. `DecisionRecord` has `quote` (required) and no file (`schemas.ts:75-80`). `decide decision-record` appends the record and an element, marks the superseded record `superseded`, increments the intent revision, and publishes (`decisions/decision-record.ts:15-33`). INTENT.md renders each as a full `DEC-…` block (`core/intent-md.ts:53-54,66-67`). Tech-spec §7.8's `docs/decisions/` file is not built.
- `reconcileShared(ports, state)` has no `tx`. The pipeline runs it on every mutating verb except `open` and `stop` (`pipeline-mutate.ts:160`); `open` calls it itself (`verbs/open.ts:61`). It reads `INTENT.md` and the policy and returns notes and at most one question (`verbs/reconcile.ts:20-52`). Judgements are `core/trust.ts:15-24` (policy) and `:33-41` (intent). Nothing reads `docs/decisions/`.
- `Project` has `read`, `hashes`, `write`, `writeNew`, `remove`, no directory listing (`ports/types.ts:234-245`). `read` and `hashes` **throw** on a symlink, a non-regular file, an excluded path (`adapters/project-fs.ts:21-34`).
- `docs/hardening.md` is prose in the starter template; the kernel never edits it. Promotion reads it by coordinator instruction (`plugin/skills/tenet/SKILL.md`, "Promoting a prototype").
- Verdict: `prototypeRequested && rank > 0` gives `prototype`; rank 0 (nothing built) stays `blocked` (`core/verdict.ts:214`; label `:242`). `TRAIT_RAISES` maps the `personal-data` trait to the sensitive-data dimension (`core/risk.ts:14`). `open` takes the assessment from input plus signals (`verbs/open-new.ts:82-93`). The no-Git choice already ends in a `KernelError` carrying a question (`open-new.ts:44-49`), a precedent for SF-10.
- Integration: any predicted conflict path stops with `integration-conflict` (`verbs/integrate.ts:76-77`); `predictConflicts` returns `supported: false` before Git 2.38 and `blockers` ignores that (`adapters/git-cli.ts:966-974`). The Git port can read blob ids (`blobsAt`) but not file content or directory listings at a tree-ish (`ports/types.ts`, `Git`).
- Shared IDs: `KIND_PREFIX` has `REQ EX INV CNS ASM DEC DEF` (`core/ids.ts:46`); tech-spec §7.9 omits `INV`.
- Not built and out of scope: re-projecting INTENT.md after the intent changes, the reverse parse, committing INTENT.md when its contract already finished (plan §7.2).

## 3. Requirements

**S1: decision files**
- SF-01 `renderDecisionFile(record)` and `parseDecisionFile(text)` are pure (`core/decision-file.ts`). Front matter holds exactly `id`, `status`, `date` (`YYYY-MM-DD`), `links` (tech-spec §7.8). Body sections: `# <title>`, `## Context and Problem Statement`, `## Considered Options`, `## Decision Outcome` (the decision, then `Supersedes <ID>` when set), `### Consequences`, `## Pros and Cons of the Options` (one `### <option>` per alternative, its reason as text).
- SF-02 Round trip: render then parse returns the record except `quote` (never written to a shared file; CFG-08) and the time of day (the file keeps the date; a parsed record gets `T00:00:00.000Z`). `parseDecisionFile` accepts LF or CRLF and returns `{ok:false, why}` for a missing or malformed id, status, date or required section; it never throws.
- SF-03 Status in a file is `accepted` or `superseded by <ID>` (MADR). State keeps `accepted | superseded`.
- SF-04 Path: `docs/decisions/NNNN-<id>-<slug>.md`. `NNNN` is the highest numeric prefix among the listed files plus one (4 digits). Slug: lowercase ASCII from the title, other runs become `-`, trimmed, at most 40 characters, `decision` when empty. The ID in the name must equal the front-matter ID; a file where they differ is invalid. Two branches may pick the same `NNNN` for different IDs; the paths differ and that is harmless. PRD §3.2 says names begin with the decision ID; tech-spec §7.8 (`NNNN-<id>-<slug>`) is the specified form and wins (logged, §11 item 12).
- SF-05 **First adoption.** `decide adopt --target shared` previews one list (the decision files, then `INTENT.md`, with the existing remote warning) and asks once, `id adopt-confirm-shared`, bound by `factsHash` to every path with its `before` and `after` hash. On confirm it writes the decision files in ascending `NNNN`, then `INTENT.md` last. `--target intent` and `--target policy` keep today's behavior. An omitted target stays an error (D4).
- SF-06 **Per-file effect and recovery.** Each file is its own `adopt` effect (`tx.intent`, write, `tx.result`). Immediately before each write the file is re-hashed; if it no longer equals the previewed `before`, nothing is written for it and the call stops with `intent-edited-outside` naming the file. `AdoptOp` gains `trust: "INTENT.md" | "docs/decisions"` and `member?: string` (a decision ID). `previousTrust` is the hash of the trust entry after the previous op of the same call, so replay is per file. `adoptionReplayNeeded` checks the member's hash when `member` is set. A kill leaves finished files finished and files not yet started unlogged; recovery settles the one in flight as today (`after`: adopt it; `before`: did not happen; any other hash: `uncertain`, as for INTENT.md today). Saying adopt again re-previews the remaining files, so the question is asked again with a smaller list; that is accepted.
- SF-07 **Trust.** One entry `{file: "docs/decisions", hash, adoptedAt, restrictions: {records: {<id>: {file, hash, status, body}}}}`. `body` is the hash of the file with the `status:` line removed, normalized like `blockHash` (CRLF, trailing blanks). The entry's `hash` is the hash of the sorted `id:hash` lines. `adopted()` sets `adoption.intent` only for the `INTENT.md` op (a decision file never flips the CON-01 flag alone).
- SF-08 **After adoption, `decide decision-record`** keeps its state change (record, element, revision, supersede) and publishes it first. The file is written afterward as an external job, the way `integrate` logs its intent in `run` and executes after the publish (`verbs/integrate.ts:166-181`): `tx.intent("adopt")` in `run`, the write with the SF-06 re-hash in the job, `tx.result` and the trust member in `finalize`. The file joins the contract's `touched` and `vetted` like `adopted()` does. No new question (D2). A kill between publish and write leaves state ahead of the file; recovery settles the logged op, and `open` reports `decision-file-stale` (SF-10). A repeated identical call still deduplicates against state (`decision-record.ts:23`), so no second ID or file appears.
- SF-09 **Supersede** is the same job with a second op: edit the old file's `status:` line to `superseded by <new id>`, every other byte unchanged. Allowed only when the old file is trusted, parses, has exactly the line `status: accepted`, and is not dirty in Git (inventory). Otherwise the edit is skipped and `decision-file-stale` is reported with next action `decide adopt --target decisions`. After the edit the member's `status` is updated; its `hash` is updated only if the file's `body` still equals the trusted `body`, so a person's added text stays reported as edited.
- SF-10 **`open` and every verb that runs `reconcileShared`** list `docs/decisions/` (new `Project.list(dir)`: regular files only, non-recursive, sorted, at most 200, each at most 64 KiB; every read inside a `try`). It never writes. Notes carry the path and, when valid, the ID; never the title or body (PRD §5.6 item 6):
  - `decision-found`: a valid file whose ID is not in state.
  - `decision-file-invalid`: unreadable, oversized, linked, malformed, a duplicate ID, or name and ID disagree.
  - `intent-edited-outside` (reused, file named): a trusted file whose `body` changed.
  - `decision-file-stale`: a state record with no file, or whose file status differs from state because Tenet's status edit was skipped. A file status that differs because a person or teammate changed it is `intent-edited-outside`, never overwritten (PRD §5.6 item 3).
- SF-11 **`decide adopt --target decisions`** (needs `adoption.intent = adopted`) previews two lists and asks once (`adopt-confirm-decisions`, bound to the hashes): *write* (stale or missing files, from state) and *take in* (found or edited files, from the file). Taking in sets a record from the parsed file with `quote: ""`, a `decision` element with `origin: "request"` and `verifiedBy.notApplicable` as `decision-record.ts:29`, `intent.revision + 1`, and the trust member. Imperative text in a file is data, not a command (PRD §5.6 item 6). A file that is invalid is listed and skipped.
- SF-12 Each new adopt question has its own id and `decideOn` removes only its own on decline (the existing `adopt-confirm` behavior is unchanged for `intent` and `policy`).
- SF-13 INTENT.md's `DEC` block becomes one line (`**DEC-… title** (status) docs/decisions/<file>`) when the intent is adopted, so the text is not kept twice. This is a change to `renderIntent` (§6).

**S2: hardening block and prototype**
- SF-20 `projectBlocks(existing, desired, written, header)` is extracted from `projectIntent` (`core/intent-md.ts:81`); INTENT.md and hardening use it. Behavior of `projectIntent` and its tests is unchanged.
- SF-21 `decide hardening {gaps}` (1–12 strings, each a single line of at most 200 characters, none containing `tenet:begin` or `tenet:end`) writes the block `<!-- tenet:begin HARDENING-<work id> -->` into `docs/hardening.md`, creating the file with a heading when it is absent and leaving every other byte when it exists. The block ID uses the work ID, so it is branch-safe and needs no new ID prefix (D6). Body: `**Prototype <label>: unhardened** (<date>)`, `- Data: synthetic or public data only`, then one `- Gap: …` line each.
- SF-22 It is an ordinary effect with the SF-06 re-hash. The contract stores `hardening: {block, hash}` of what Tenet wrote. A second call replaces the block only if the file's block still hashes to that value; otherwise it leaves it and returns `intent-edited-outside` naming the file. `open prototype` adds `docs/hardening.md` to the contract's scope paths, so the existing dirty-overlap handling covers a person's uncommitted edits there (to verify at implementation, §10). No trust entry and no adoption: the file is ordinary source (PRD §3.2) and a checked input (tech-spec §7.8), so the write is made before `check` and, like any edit, makes earlier receipts stale.
- SF-23 `open prototype` stops with `prototype-data-limit` (exit 3, a question: make it a checked change, or stop) when the sensitive-data dimension is High after `raise`. The kernel sees only the assessment and signals it is given; this is a declared limit with a refusal on the signals it can see, not a detection of real data, and every text says so.
- SF-24 `finish` on a `prototype` contract with no `hardening` field adds the note `hardening-gaps-missing` and the next action `decide hardening`. The endpoint is `prototype` when anything was built and stays `blocked` when nothing was (`verdict.ts:214`); it is never `checked-local` and the result never offers adoption (`finish.ts:79` already requires `checked-local`).

**S3a: collision detection (GIT-09, detection and proposal text)**
- SF-30 `Git` gains `mergeBase(a, b)`, `showAt(treeish, path)` and `filesAt(treeish, dir)` (read-only; `showAt` returns null when absent).
- SF-31 `integrate` runs the check in `blockers`, **before** the `integration-conflict` stop, only when the base tip is not the merge base (a fast-forward cannot collide), and independent of `predictConflicts` support, so it also runs on Git older than 2.38. With no merge base (shallow or unrelated history) the check is skipped and today's behavior stands; this is a stated gap.
- SF-32 Compared files: `INTENT.md`, `docs/architecture.md`, `docs/hardening.md` (blocks by ID) and `docs/decisions/*.md` (one item per file, by front-matter ID). A file whose markers do not parse at any of the three refs is skipped here; Git's own conflict then stands.
- SF-33 Collision kinds. **content**: the ID exists at the merge base and its text on the base tip and on the work tip both differ from the base text and from each other. **duplicate**: the ID is absent at the merge base and present on both tips with different text, in one file or in decision files with different names. A change on one side only is not a collision.
- SF-34 A collision stops `integrate` before the editor moves with `shared-id-collision` (exit 3): up to 8 items as `{kind, id, path(s)}` and, in `data.collisions`, each side's text (at most 2 KB each). Nothing is written and no effect is logged; saying integrate again re-runs the check, so it needs no binding to a moved tip. When ordinary conflict paths also exist they are listed after the collisions.
- SF-35 What it does **not** do (stated in the result): it proposes no merged text and applies nothing; the user or the coordinator resolves on the work branch and runs integrate again. GIT-09's "propose the merged content for confirmation" stays unmet until S3b.

## 4. Behavior as examples

| # | Example | Test file |
|---|---|---|
| E1 | A record renders and parses back to itself, including an apostrophe, a line that looks like a heading, an empty `consequences`, CRLF input and a 120-character title [INT-09] | `decision-file.test.ts` |
| E2 | Malformed id, mismatched name, missing section and a 1 MB file each give `ok:false` or a skipped file, never a throw [INT-09] | `decision-file.test.ts` |
| E3 | `adopt --target shared` with two records previews three files once with the remote warning; confirm writes `0001`, `0002`, then `INTENT.md`; trust has the `docs/decisions` entry with two members; `adoption.intent` is `adopted` only after `INTENT.md` [CON-01, INT-09] | `shared-adopt.test.ts` |
| E4 | A real kill after the first decision file: recovery completes it; adopt again previews only the rest and writes them; a repeat is a no-op (real processes, as `crash-adopt`) [CON-01] | `shared-adopt.test.ts` |
| E5 | A person edits `0002` between preview and confirm: nothing is written for it, `intent-edited-outside` names it, `0001` stays written [CON-01] | `shared-adopt.test.ts` |
| E6 | After adoption `decision-record` writes `0003-DEC-…-slug.md` without a question; a kill between publish and write leaves `decision-file-stale`; `adopt --target decisions` writes it; the repeat call makes no second ID [INT-09] | `decision-write.test.ts` |
| E7 | Supersede edits only the old `status:` line; a paragraph a person added survives byte for byte; the member keeps its old `hash` and the file is reported edited [INT-09] | `decision-write.test.ts` |
| E8 | The old file is dirty in Git: the edit is skipped, `decision-file-stale` is reported, the state's supersede stands [INT-09] | `decision-write.test.ts` |
| E9 | A teammate's file appears after a pull: `decision-found` with path and ID only (a title with an injected instruction never appears in any response); it is not in intent until `adopt --target decisions` takes it in with `quote: ""` [INT-09] | `decision-reconcile.test.ts` |
| E10 | A file status changed by a person is never rewritten by Tenet; `adopt --target decisions` shows it under *take in* [INT-09] | `decision-reconcile.test.ts` |
| E11 | One symlink and one oversized file in `docs/decisions/` give two `decision-file-invalid` notes and no thrown error; the other files are still judged [INT-09] | `decision-reconcile.test.ts` |
| E12 | `decide hardening` appends a `HARDENING-<work id>` block after the starter prose, creates the file when absent, replaces its own block on a second call, and leaves an edited block alone with `intent-edited-outside` [QLT-17, WRK-06] | `hardening-block.test.ts` |
| E13 | `open prototype` with the `personal-data` trait stops with `prototype-data-limit`; `open prototype` with synthetic data opens and lists `docs/hardening.md` in scope [WRK-06] | `prototype-gaps.test.ts` |
| E14 | `finish` of a prototype with no gap record returns `prototype`, the note `hardening-gaps-missing` and no adoption offer; with a record the note is absent [WRK-06] | `prototype-gaps.test.ts` |
| E15 | Two real branches each edit the same `REQ` block: `integrate` stops with `shared-id-collision` kind `content` and the three texts, before the editor moves [GIT-09] | `integrate-shared.test.ts` |
| E16 | Two branches add `DEC-004-abc` in files with different names and Git reports no conflict: kind `duplicate` is reported; integrate does not merge [GIT-09] | `integrate-shared.test.ts` |
| E17 | One side only changes a block: no collision, integrate proceeds as today; a fast-forward runs no extra Git calls; a shallow clone with no merge base falls back to today's behavior [GIT-09] | `integrate-shared.test.ts` |

## 5. State and contract changes

- `trust` union adds `docs/decisions` (SF-07). It stays discriminated: the key is the directory, not each file.
- `AdoptOp` adds `trust` and `member` (SF-06); `adoptionReplayNeeded` and `adopted()` change as stated. `SETTLE.adopt` and `PUBLISH.adopt` select the entry by `op.trust`.
- `WorkContract.hardening?: {block: string, hash: string}`.
- `Project.list(dir)`; `Git.mergeBase`, `showAt`, `filesAt`.
- New reason codes (each needs a fixture; `tools/coverage.ts`): `decision-found` (0), `decision-file-invalid` (0), `decision-file-stale` (0), `hardening-gaps-missing` (0), `prototype-data-limit` (3), `shared-id-collision` (3). `intent-edited-outside` is reused for other files; its text (`core/reasons.ts:116`) and tech-spec Appendix C change from "INTENT.md" to "a shared file".
- `SCHEMA_VERSION` stays 1 (D5). Effect: a kernel without this change that reads a state holding the new trust entry fails the strict parse and falls back silently to `state.prev` as a recovered state (`adapters/store-fs.ts:184-195`); a marker schema mismatch is the only case that reports `unsupported-record` (`store-fs.ts:215-222`). Recorded as a risk, not hidden.

## 6. Impact before change

| What moves | Effect |
|---|---|
| `renderIntent` DEC block (SF-13) | Block hashes in an already adopted INTENT.md differ: the DEC blocks read as Tenet-owned and changed, so they update on the next projection; no person-edited block is touched. `intent-md.test.ts` expectations change. |
| `adopted()` / `AdoptOp` / `adoptionReplayNeeded` | Used by `recover-effects.ts`, `adopt.test.ts` (including the `[CON-03]` replay test) and `fixtures/crash-adopt.ts`; each needs new cases; existing cases must pass unchanged. |
| `reconcileShared` | Runs on almost every call (§2): the directory read is bounded (200 files, 64 KiB) and never throws. It adds notes only, so `open` output grows by at most the notes. |
| `ADOPTED_FILES` / `inspect residue` | Unchanged list; `docs/decisions/` is added as a directory. |
| Skill and UX text | `plugin/skills/tenet/SKILL.md` (the adopt targets, "Promoting a prototype" now meets `HARDENING-…` blocks, which list gaps as lines) and ux-spec §3 "Shared files" and UX-D15 wording; `lint-skills` token budgets. |
| `config.ts` how-to text for `shared_memory` | Mentions the files adopted; update. |
| Tech-spec | §7.8 (decision-file format as built, trust entry, notes), §7.9 (`INV` missing from the prefix list; the hardening block ID), Appendix C (6 codes, one reworded), §10.4 (the pre-switch collision check). PRD §3.2 keeps "begins with the decision ID"; logged. |
| Bundle | Adds one pure module and three small verbs' worth of code; the budget is checked by `npm run ci`, not guessed. |
| Plan | §7.2 managed-block item, §7.4, GIT-09, INT-09, WRK-06, QLT-17 rows; the plan is updated at finalize, not now. |

## 7. Alternatives considered

1. **Per-file effect, one confirmation (chosen).** Reuses `SETTLE.adopt` and `PUBLISH.adopt` per file. A kill leaves finished files finished; the cost is a smaller re-preview after a partial run.
2. One multi-file effect: recovery would have to roll forward without the content, which the log should not hold, or roll back, which needs `before` content. Rejected.
3. Decision files written inside `run` before the publish (v1): a kill leaves the file with no state record, and the next call allocates a second ID. Rejected for the publish-first job order (SF-08).
4. Tenet silently reverts a file status to match state (v1): would undo a teammate's legitimate supersede and writes from `reconcileShared`, which has no `tx`. Rejected (SF-10).
5. One trust entry per decision file: needs a non-discriminated union and grows state with every decision. Rejected for the directory entry.
6. GIT-09 resolved in the merge commit with `merge --no-commit`: leaves `MERGE_HEAD`, which `probe()` reports as `repo-state-readonly` (`git-cli.ts:267-270`), and `reconcileIntegration` cannot see the resolved content (`git-cli.ts:1024-1036`). Rejected. The S3b candidate is a temporary index and `commit-tree`, logging the expected tree (§9, D7).
7. Keep decisions only as INTENT.md blocks: fails INT-09 and tech-spec §7.8.

**Recommendation:** the chosen ones above, delivered S1, S2, S3a.

## 8. Risks

- State is ahead of files after a kill (SF-08); the cost is one visible `decision-file-stale` and one command.
- Post-adoption writes carry text that may reach a public remote without a new preview (D2); the adoption preview warned once.
- The decision file is not yet committed when its contract already finished (plan §7.2 gap); the file shows as dirty, which is honest.
- The older-kernel behavior in §5; fine before a first release, not after.
- A person's edit racing the supersede edit is bounded by the re-hash, not removed: the window between re-hash and rename is small and the rename is atomic; a loss there is possible and is not claimed away.
- `uncertain` after a crash plus a concurrent human edit of the file in flight fences the project until `stop` (as for INTENT.md today); intended, and unchanged.
- S3a stops integration on a collision that a user could have resolved faster by hand; it adds the explanation, not the fix.

## 9. Sequence and follow-ups

1. S1, then S2 (extract `projectBlocks` here), then S3a. Each slice has its own `npm run ci` and UAT.
2. After S2: a small `decide architecture` verb on `projectBlocks` (INT-14), with a preview, if the owner wants it before R1.
3. S3b (apply a confirmed resolution) needs: the temporary-index merge commit in the adapter with the expected tree in the effect record; `reconcileIntegration` comparing that tree; for `INTENT.md` blocks, the reverse parse and re-projection (plan §7.2), because state lives in `.tenet/` and a merged block would otherwise read as an outside edit; a tech-spec §10.4 amendment; and a rule for "newer" (the work being integrated) and for re-suffixing test tags, which are locked and change-controlled (INT-06). It is a separate spec.

## 10. Assumptions and unobserved

- A kernel-added scope path is covered by `open`'s dirty-overlap handling (SF-22): **unverified**, must pass a test before the slice is called done.
- A non-Git prototype (shadow repository) has `docs/hardening.md` in its folder and snapshot; `Project.list` works there: **unverified**.
- Decision-file limits (200 files, 64 KiB) are a starting choice (D9).
- No host behavior is claimed. Nothing here needs a spike.
- Windows line endings and `autocrlf`: handled by normalization in `body`; tested with CRLF fixtures only, not on Windows.

## 11. Independent review (fresh-context subagent, read-only, 2026-10-24)

I checked the load-bearing claims in code: `reconcileShared` call sites (`pipeline-mutate.ts:160`, `open.ts:61`); `adopted()` setting the flag (`adopt.ts:41`); `MERGE_HEAD` making `probe()` unsafe (`git-cli.ts:265-270`); the silent fallback to `state.prev` (`store-fs.ts:184-195`); the throwing `project.read`/`hashes` (`project-fs.ts:21-34`); the verdict rank rule (`verdict.ts:214`); `KIND_PREFIX` (`ids.ts:46`). All held. The reviewer could not run builds; claims about `lint-skills` budgets and bundle headroom are unverified.

| # | Finding (short) | Sev | Disposition |
|---|---|---|---|
| 1 | Verdict cite wrong; rank 0 stays `blocked` | minor | **Accepted**; §2, SF-24 |
| 2–4 | `trust.ts`, `git-cli.ts`, `open-new.ts` line cites wrong | minor | **Accepted**; fixed in §2 |
| 5 | `open` does not run through the pipeline's reconcile; reconcile has no `tx` | major | **Accepted**; §2, SF-10 never writes |
| 6 | Other cites correct | — | Noted |
| 7 | `ARC`/`HRD` are new prefixes: amendment | major | **Accepted**: no new prefix (D6); architecture deferred; `INV` gap logged |
| 8 | "Reapply state's status" reverts teammate edits, writes without `tx` | blocker | **Accepted**; SF-10, alternative 4 |
| 9 | GIT-09 apply is a reconciliation engine beyond tech-spec §7.8/§10.4 | major | **Accepted**; applied resolution moved to S3b, D8 |
| 10 | `adopted()` flips the CON-01 flag; hardening is not adoption-gated | major | **Accepted**; SF-07 flag only for `INTENT.md`; hardening has no trust entry |
| 11 | "Finish cleanly" vs next action vs reason code | minor | **Accepted**; SF-24 says note plus next action, endpoint unchanged |
| 12 | PRD §3.2 says names begin with the ID | minor | **Accepted**; SF-04 notes tech-spec wins, logged |
| 13 | Crash after file write, before publish, loses the record and duplicates on retry | blocker | **Accepted**; SF-08 publish first, job writes, stale note, dedup |
| 14 | Per-file ops leave nothing to report for unstarted files; question hash changes | major | **Accepted**; SF-06 states it; `INTENT.md` last; E4 reworded |
| 15 | No compare before rename; recovery with a third hash fences | major | **Accepted**; SF-06 re-hash; `uncertain` kept deliberately (§8) |
| 16 | `adopt-confirm` id shared by many questions | major | **Accepted**; SF-05, SF-11, SF-12 own ids; decline removes its own |
| 17 | Per-file trust entries break the discriminated union and grow state | major | **Accepted**; SF-07 directory entry |
| 18 | "Schema stays 1" silently rolls an older kernel back | major | **Accepted in part**; behavior stated (§5), version kept (D5) |
| 19 | One hostile file in the directory breaks every call | major | **Accepted**; SF-10 try/limits, E11 |
| 20 | Notes must not carry titles; how a found file becomes state | major | **Accepted**; SF-10 notes, SF-11 |
| 21 | Round trip claim false for `supersedes`, date, slug | minor | **Accepted**; SF-01/02/04 |
| 22 | Body hash must normalize CRLF | minor | **Accepted**; SF-07 |
| 23 | Post-adoption writes have no preview | major | **Accepted as owner decision** D2 with the alternative |
| 24 | Hardening/architecture are checked inputs; when does the write happen; dirty file | major | **Accepted**; SF-22 (before `check`, scope path, dirty-overlap, unverified) |
| 25 | Name collision test undefined | minor | **Accepted**; E4-style case dropped; SF-04 says same `NNNN` is harmless |
| 26 | Detection unreachable behind the conflict stop; older Git; shallow | blocker | **Accepted**; SF-31 runs first, no `merge-tree` dependence, stated skip |
| 27 | `--no-commit` leaves `MERGE_HEAD`; recovery cannot verify content | blocker | **Accepted**; moved to S3b with the temporary-index design (alt. 6) |
| 28 | State is local; merged text has no home without a reverse parse | major | **Accepted**; the reason S3b is separate (§9) |
| 29 | Re-suffix of locked tests and trailers; "newer" undefined | major | **Accepted**; S3b prerequisites (§9) |
| 30 | Git cannot see same ID in different file names | minor | **Accepted**; SF-33 `duplicate`, E16 |
| 31 | Five features bundled | major | **Accepted**; v2 slices |
| 32 | Suggested order, no `projectBlocks` for one use | major | **Accepted**; S2 extracts it (second consumer); architecture deferred |
| 33 | Missing impact | minor | **Accepted**; §6 |
| 34 | "Same way as INTENT.md" overstated | major | **Accepted**; §1 no longer says it; differences are explicit |
| 35 | Binding to tips does not stop a moved base | minor | **Accepted**; S3a has no binding, re-runs each call (SF-34) |
| 36 | Duplicate `NNNN` possible | minor | **Accepted**; SF-04 |
| 37 | Replay needs per-file `previousTrust` | minor | **Accepted**; SF-06 |

Unverified by the reviewer and still open: plan §7.2's "not done" list was read from its summary; `lint-skills` and bundle headroom; `git merge --no-commit` behavior across Git versions (the S3b design avoids it); whether a no-Git prototype has the files available (§10).

## 12. Owner decisions (one at a time; recommendation first)

- **D1 Scope and order.** Deliver S1, S2, S3a in that order; defer applied GIT-09 (S3b) and architecture blocks. Recommend yes. Alternative: one large change as v1 had it (rejected by the review).
- **D2 Post-adoption decision files without a new question.** Recommend yes: `decide decision-record` already needs the user's own words, adoption consented to Tenet maintaining the files, and the result names the file written. Alternative: a preview and question per decision.
- **D3 Leave `quote` out of the shared file.** Recommend yes (the user's words stay in `.tenet/`, CFG-08). Alternative: include it.
- **D4 `adopt --target shared` is explicit; an omitted target stays an error.** Recommend yes (no change to today's call). Alternative: omitted means `shared`, which changes the CON-01 offer text and SKILL.md.
- **D5 Keep `SCHEMA_VERSION` 1 until the first release; the older-kernel fallback in §5 is accepted for now and must be revisited (bump and migrate) before R1 ships.** Alternative: bump now and write the first migration.
- **D6 Hardening block ID `HARDENING-<work id>`, no new §7.9 prefix; add `INV` to §7.9.** Alternative: add an `HRD` prefix (a spec amendment).
- **D7 S3b mechanism and order:** temporary index plus `commit-tree`, only after the reverse parse exists for `INTENT.md`; GIT-09 stays open after S3a. Recommend yes. Alternative: a text-only proposal forever (weaker than Git's own conflict view).
- **D8 Tech-spec §10.4 and §7.8 amendment** for S3b ("never a reconciliation engine" is limited to the trust path today). Ask at S3b, not now.
- **D9 Limits:** 200 decision files and 64 KiB each per call. Alternative: other numbers; a larger project needs an index file, which is a later design.

## 13. Acceptance criteria

- `npm run ci` passes, including coverage tags `[INT-09]`, `[CON-01]`, `[QLT-17]`, `[WRK-06]`, `[GIT-09]` on tests that prove them, and the six new reason codes with fixtures.
- E1–E17 pass; E4, E5, E15, E16 use real processes and real Git (kill at each step; two real branches).
- Built-bundle UAT on a scratch repository for E3, E6, E7, E12, E15; compare with the examples; record what was and was not observed. GIT-09 is reported as **partially met** (detection) after S3a.
- Privacy check as the lifecycle requires; no decision text appears in any note.
