# Specification: Declared Check Outputs (EVD-09, slice 2 of evidence-classification.md)

> Status: Reviewed 2026-10-24 (fresh-context subagent: 12 findings, 2 blockers, 7 majors; dispositions in §12). **§13 (v2) supersedes §3 to §11 where they differ**; the draft's option A is withdrawn. Awaiting owner decisions (§14). No code before sign-off. Date: 2026-10-24 | Decision owner: @vedprakash-m.
> Parent: [evidence-classification.md](evidence-classification.md) §15 item 4. Sources: PRD EVD-09, EVD-03, EVD-10, EVD-11; tech-spec §8.8 ("outside identities: declared outputs of a check"), §9.x drift rule ("the inventory is taken before and after every check, excluding declared outputs").

## 1. Outcome

A check that legitimately writes to a file (a snapshot, a generated fixture, a cache, a database file, an output folder) does not make its own result inconclusive and does not make the evidence stale, while any other change to a relevant input still does. A declaration can never hide a change to code, a test, a configuration, a lock, a support file or a path the contract is changing.

**Verification:** real Git repositories and real test processes; compare receipts, endpoints and attribution with the examples in §5.

## 2. Current state (inspected 2026-10-24)

- The candidate identity is `Inventory.digest`, computed by `GitCli.digestOf(entries)` (`adapters/git-cli.ts:422`) as one line per entry: path, mode and blob. A file the exclusion policy forbids scanning contributes only its stat.
- `inventory(exclude, declaredInputs)` takes an `exclude` list (prefix match, removes a path from `entries`, `status` and the digest). Every candidate-identity caller passes `[]`: `gather` (`verbs/facts.ts:41`), `worldDigest` (`facts.ts:32`), `digestAfter` (`verbs/check-rerun.ts:22`). Other callers (`pipeline-mutate.ts:93`, `open-new.ts:104`, `review.ts:20`, `recover-effects.ts:88,100`, git-cli internals) read the status list or compare unrelated snapshots.
- Ignored files are outside the inventory unless declared as inputs, so a check that writes only to ignored paths already works. The gap is a check that writes a **tracked or untracked-and-unignored** file.
- `attribute()` (`core/attribution.ts:25`) treats a changed path as Tenet's only if declared, or explained by `gather`'s `explained` (test files and vetted recipe files); otherwise it is `unexplained` and the user is asked.
- `classify()` (`adapters/node-ts.ts:71`) returns `test`, `config` or `source`; every other file, including data such as `.json`, is `source`. It cannot tell code from data.
- `Obligation` has `support` and `testFile` but no outputs; `BasisElementInput` has `support` (max 20) but no outputs.

## 3. Requirements

| ID | Requirement |
|---|---|
| DO-1 | An acceptance example may declare `outputs`: at most 20 patterns, each at most 200 characters, with `*`, `**` and `?`. |
| DO-2 | A path matching a declared output contributes only its path (not its content) to the candidate identity digest, in every call that computes candidate identity. Its entry stays in `entries` and `status` with its real blob. |
| DO-3 | A declaration is refused when the basis is recorded, and a matching path is refused at every check, if it is a code file (`.ts .tsx .js .jsx .mjs .cjs .mts .cts`), a test or config per `classify`, a locked test, a support file, a protected path, an excluded path, inside the contract's scope, in `touched` or `keepOut`, or already dirty when the contract started. |
| DO-4 | A changed output is recorded on the receipt as `mutated: [{path, before, after}]` (blob ids, at most 20) and raises one attention item for the reviewer. |
| DO-5 | A changed output is explained for attribution (never `unexplained`, never a human edit) and enters the review paths; whether it is committed is decision D2. |
| DO-6 | A path that matches an output pattern but is also edited by a human before the run (dirty at start) is refused by DO-3, so a human edit cannot be absorbed. |
| DO-7 | The same function supplies the output patterns to every identity caller, so call identity, check input identity and post-run comparison agree. |

## 4. Design

- `core/obligations.ts` gains `declaredOutputs(obligations)` beside `declaredInputs`, and `outputMatcher(patterns)` using the existing `glob`.
- `GitCli.inventory(exclude, declaredInputs, volatile = [])` takes the matcher's patterns; `digestOf` writes `path\t~` for a matching entry. Nothing else about the inventory changes.
- `gather`, `worldDigest` and `digestAfter` pass `declaredOutputs(...)`. A test asserts the three agree on a fixture.
- `check` computes `mutated` from the inventory before and after the run (blob per matching path), and refuses a run whose matching paths violate DO-3 before launching anything.
- `gather`'s `explained` includes paths matching the outputs of the contract's obligations.
- Basis validation (`decisions/basis.ts`) applies the literal-path part of DO-3 at record time.

## 5. Examples (test ownership)

| # | Example | Test file |
|---|---|---|
| E1 | A test rewrites a tracked `fixtures/golden.json` and declares `fixtures/golden.json`: the run stays valid, `mutated` lists it, the reviewer sees one attention item, no `unexplained` question is asked. | `evidence-outputs.test.ts` |
| E2 | The same write, undeclared: `inconclusive`, `concurrent-edit` (unchanged behavior). | `evidence-outputs.test.ts` |
| E3 | A declaration `src/**` or `src/greet.ts` is refused at record time. | `evidence-outputs.test.ts` |
| E4 | A declaration `fixtures/*.json` is accepted; a later check in which `fixtures/helper.ts` matches nothing but `fixtures/x.ts` would (an edited code file under a glob that was meant for data) refuses the check before launching. | `evidence-outputs.test.ts` |
| E5 | A human edits `fixtures/golden.json` before the run, then the run mutates it: refused by DO-6; nothing is absorbed. | `evidence-outputs.test.ts` |
| E6 | A declared output that is a support file or a locked test is refused. | `evidence-outputs.test.ts` |
| E7 | `gather`, `worldDigest` and `digestAfter` return the same candidate identity for a fixture with a declared mutated output, and a different one when a non-output file changes. | `evidence-outputs.test.ts` |
| E8 | The unchanged inventory callers (status listing, review paths) still show the output as modified. | `evidence-outputs.test.ts` |
| E9 | A declared output written by a rerun (slice 1) does not make the rerun `concurrent-edit`. | `evidence-outputs.test.ts` |
| E10 | A glob that matched no code file at declaration time but matches one created later is refused at the next check. | `evidence-outputs.test.ts` |

## 6. State and contract changes

- `BasisElementInput.outputs?: string[]` (max 20 items, 200 characters) and `Obligation.outputs?: string[]`; both schemas are non-strict, so older readers ignore the field.
- `Receipt.mutated?: Array<{ path: string; before: string; after: string }>` (max 20).
- Candidate identity changes only for contracts that declare outputs; contracts without outputs keep today's digest, so no stored receipt goes stale beyond the slice-1 adapter bump.
- `inventory` gains an optional third parameter on the Git port.

## 7. Alternatives

| Option | For | Against |
|---|---|---|
| A. Digest-only exclusion of content (recommended) | Keeps `entries`, `status`, locks, attribution and commits intact; small change in one function and its callers | Cooperative: a declaration is only as honest as its author, guarded by DO-3 and a reviewer item |
| B. Remove outputs from the inventory (the `exclude` list) | One existing parameter | Loses the file from `status`, lock hashes, review paths and commits; a hidden edit is never seen (rejected in the evidence review, finding 8) |
| C. Require outputs to be Git-ignored | No new mechanism; the digest already skips ignored files | Cannot express a tracked fixture that tests legitimately rewrite; documentation alone |

**Recommendation: A, with C as the documented first choice** (an ignored output needs no declaration).

## 8. Risks

- A declaration is cooperative: a model could declare a data file that code reads, hiding a behavior change. DO-3's refusal list, the receipt's `mutated` record and the reviewer item are the guards; this is a disclosed limit, not a sandbox.
- Every candidate-identity caller must pass the same patterns (DO-7); a missed caller makes identities flap to `stale`.
- `classify` cannot tell data from code, so DO-3 uses an explicit code-extension list that must be maintained.

## 9. Assumptions

- Tests that mutate tracked fixtures are uncommon; most users will use ignored paths (option C).
- Glob matching with the existing `glob` helper is adequate for outputs.

## 10. Acceptance criteria

1. E1 to E10 pass on real repositories and real test processes.
2. Declaring an output never changes the identity of a contract that declares none.
3. No path that classifies as code, test or config, or that the contract changes, can be absorbed by a declaration (property test over generated paths and patterns).
4. `npm run ci` passes within module budgets (increase logged or raised); built-CLI scratch run; plan, changelog, TS §8.8 backfill.

## 11. Decisions for the owner

- **D1.** Option A (recommended) with option C documented first, or option C only (no new mechanism, document that tests must write ignored paths).
- **D2.** A changed declared output: committed with the contract's files (recommended: it is part of the checked candidate, and the reviewer sees it), left uncommitted for the user, or refused until the user decides.

## 12. Independent review: findings and dispositions (2026-10-24)

Reviewer: a fresh-context subagent, read only. I re-checked the load-bearing claims: `lastCheck.candidate` ignores any file the digest skips and `changedSinceCheck` looks only at touched files (`commit.ts:51`, `attribution.ts:47`); `verdictInput` rebuilds `reviewFiles` from a post-run gather (`facts.ts:103`); tech-spec line 1248 says the inventory is taken "minus declared outputs". Section 2's claims were all true; its one wrong aside is that `.json` always classifies as source (`package.json` and `tsconfig*.json` are config).

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | Blocker | `path\t~` keeps the path in the digest, so creating or deleting an output (a cache, a new snapshot) still flips the digest and the run is `concurrent-edit`. | **Accepted.** Matching entries are omitted from the digest entirely (§13). Create and delete examples added. |
| 2 | Blocker | The content of a declared output after the last passing check is bound nowhere; D2 would commit an output edited after the check. | **Accepted; avoided.** v2 supports only paths that are **untracked at HEAD**, which are never Tenet's files, never committed and never in `tenetPaths`; nothing to bind. Tracked-fixture mutation is deferred (§13). |
| 3 | Major | A mutated or new output makes the review stale (review files are pre-run, the verdict re-gathers post-run). | **Accepted; avoided.** Untracked outputs are not in `reviewPaths`, so no review file list changes. |
| 4 | Major | DO-3 is incomplete: `glob` is unanchored (`*.json` matches `package.json`, `*` matches everything); the code-extension deny-list misses many languages and importable JSON; scope, touched and keep-out are empty at record time; "support" must name `CONFIG_INPUTS`, `baselineInputs` and `lock.supportInputs`. | **Accepted.** v2 uses an allow-list of data extensions, rejects patterns without a literal leading directory, refuses `node_modules`, `.git` and lockfiles, checks scope, touched and keep-out at every check, and discloses that an importable data file remains a cooperative limit. |
| 5 | Major | Treating an output as explained has side effects (`implementationExists`, baseline contamination, `scopedTo` attention, `recipeOnly`). | **Accepted; avoided.** v2 never makes a tracked file "explained"; omitted untracked paths never reach attribution. |
| 6 | Major | D2 would commit caches and untracked files, and leaving them uncommitted breaks `committedTreeChecked`. | **Accepted; avoided.** Omitted paths are not in `inv.status`, so `committedTreeChecked` is unaffected and nothing is committed. |
| 7 | Major | DO-6 only checks dirty-at-start; a human edit after `open` is absorbed. | **Accepted; avoided.** A path that is tracked at HEAD is refused at every check, and an untracked path that a human created is not Tenet's to hide: v2 refuses an output that already exists untracked at the start of the contract. |
| 8 | Major | The draft keeps outputs in the inventory, contradicting tech-spec lines 1248 and 1271 ("minus declared outputs"), and calls it a backfill. | **Accepted.** v2 omits outputs from the inventory as the technical specification says, so it **follows** the canonical text. Supporting tracked outputs would be an amendment and is deferred for an owner decision. |
| 9 | Major | `worldDigest` is call identity, not candidate identity; dropping outputs from it can replay a stale response. | **Accepted.** `worldDigest` is unchanged; the output patterns reach `gather` and `digestAfter` only. |
| 10 | Major | The `mutated` plumbing is under-specified (digest returns a string only; every receipt would carry it; attention id and carry-over). | **Accepted.** v2 returns the changed output names from the post-run comparison, records them once on the run's limitations, and uses an attention id from the path only. |
| 11 | Minor | Examples weak; missing create, delete, edit after check, bare `*`, importable JSON, `.snap`, commit contents, untracked output directory. | **Accepted.** §13 lists them. The property test uses `fast-check` in `evidence-outputs.test.ts`. |
| 12 | Minor | No size estimate; ceilings are tight. | **Accepted.** Estimate in §13; any increase above 1% is raised for decision. |

**EVD-09 verdict from the review:** option A as drafted does not meet "outputs shall not invalidate" without findings 1, 2, 3 and 7 fixed, and does not meet "unexpected changes shall" without the allow-list.

## 13. Revised scope, v2 (supersedes §3 to §11 where they differ)

**What changes.** Option A is withdrawn. v2 is the smallest change that satisfies the technical specification as written ("the inventory is taken ... excluding declared outputs") and is safe for the rest of the system:

1. **Declared outputs are untracked paths.** `outputs: string[]` (max 20 patterns, 200 characters) on an acceptance example, copied to its obligation. A pattern is accepted only if it has a literal leading directory (`coverage/**`, `.cache/*`, `out/report.json`), no wildcard first segment, and every file it can match has an allow-listed data extension (`.json .snap .txt .csv .log .db .sqlite .png .html .xml .lcov`) or is under a literal directory; it never matches `node_modules`, `.git`, a lockfile, a test or config per `classify`, a locked or support file, `CONFIG_INPUTS`, or a path in scope, `touched` or `keepOut`.
2. **Omitted from the inventory.** Matching untracked paths are skipped by `GitCli.inventory` (a third parameter, `volatile`) exactly as the existing `exclude` skips them: no entry, no status row, no digest line. Creation, deletion and rewrite of an output therefore change nothing Tenet compares. `gather` and `digestAfter` pass the patterns; `worldDigest` does not.
3. **Refused when not untracked.** At every check, a path that matches a pattern but is tracked at HEAD, or existed untracked at the start of the contract, refuses the check before it launches (`capability-missing`, naming the path and recommending `.gitignore`).
4. **Visible.** The post-run comparison names the changed output paths; they are written once on the run's limitations ("outputs changed during the run: ...", at most 5 names), and an attention item (id from the path only) tells the reviewer a declared output exists.
5. **Better diagnostics for what is not supported.** When a run is `concurrent-edit`, the receipt limitation names up to 5 paths that changed during the run, so a test that rewrites a tracked fixture says which file and the remedy (write to an ignored or untracked path and declare it, or keep the fixture out of the check). This is cheap and applies to every `concurrent-edit`.

**Not in v2 (deferred, owner decision):** a tracked fixture that a test legitimately rewrites. Supporting it needs a design for review binding, `lastCheck` output blobs, attribution and commit semantics (findings 2, 3, 5, 6) and an amendment to the technical specification. Until then the PRD's "declared fixture mutations ... shall not invalidate evidence" is met for untracked outputs, caches and ignored paths, and **not** for tracked fixtures; EVD-09 stays `◐`.

**Examples (all in `evidence-outputs.test.ts`, real Git and real test processes).** E1 a test creates `coverage/summary.json` (untracked, declared): the run stays valid, no question, not committed, the reviewer sees the attention item. E2 the same without a declaration: `concurrent-edit`, naming the file. E3 the output is rewritten on a later run and a rerun (slice 1): still valid. E4 the output is deleted between runs: still valid. E5 `src/**`, `*`, `*.json`, `**/*.json`, `node_modules/**`, a lockfile and a test file pattern are refused at record time. E6 a pattern that later matches a code file or a tracked file refuses the check before launch. E7 an output that already existed untracked at the start of the contract is refused. E8 a tracked fixture rewritten by a test is `concurrent-edit` and names the file. E9 `gather` and `digestAfter` agree; `worldDigest` is unchanged. E10 a property test over generated patterns and paths: no pattern the validator accepts can match a code, test, config, tracked, locked or support path. E11 a declared output directory with 600 files does not slow the inventory beyond the existing bound and is not committed.

**Schema and budget.** `BasisElementInput.outputs?` and `Obligation.outputs?` (non-strict, so an older reader ignores them; re-saving by an older kernel would drop them, which only removes the declaration). No `Receipt` field, no adapter bump, no stale receipts. Estimated growth: about 25 lines in `pipeline + verbs + decisions`, 10 in `git-cli` and 15 in `core`; any increase above 1% is raised for decision. The bundle has room (about 767,700 of 819,200 bytes).

**Acceptance (v2).** E1 to E11 pass; a contract declaring no outputs keeps its identity byte for byte; `npm run ci` within budgets; built-CLI scratch run; plan, changelog and TS §9.x note ("outputs are untracked paths") backfilled. EVD-09 is recorded as partly met.

## 14. Decisions for the owner (review applied)

- **D1.** Approve v2 (untracked outputs omitted from the inventory; tracked fixtures deferred, with named-file diagnostics) as slice 2. Alternatives: (a) full tracked-output support, which needs a separate design and a technical-specification amendment first; (b) option C only (document that checks must write ignored paths; add the named-file diagnostic, no declaration).
- **D2.** Accept that EVD-09 stays `◐` after v2, with tracked-fixture mutation recorded as open rather than waived.
