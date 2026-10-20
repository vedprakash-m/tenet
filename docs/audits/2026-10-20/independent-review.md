# Independent review of the Tenet implementation, 2026-10-20

Read this with the earlier [audit](../2026-10-19/report.md) and [completion plan](../2026-10-19/completion-plan.md). This review does not repeat their findings; it measures the code as it stands, checks the claims made about it, and adds what they missed.

## 1. Scope, method and limits

**Reviewed:** the working tree at about 12:50 PDT on 2026-10-20 (HEAD `5a022e3` plus about 107 uncommitted files, 77 modified and 30 new, before this review's own two). **Method:** ran `npm run ci` and the built-bundle UAT; measured size, complexity, duplication, dead exports, test density and traceability tags with scripts (kept in the session scratchpad, not in the repository); read the plan, the changelog, the specification diff and the largest functions; probed the built bundle with hostile input.

**Limits, stated plainly:**
- **I am not independent of this code.** I wrote a large part of it in earlier turns of this session (settings, adoption, plan, grant, dependency, redaction, coverage tags). Findings about that part are marked *(mine)*.
- Another agent is editing the same tree right now (files changed at 12:43). One test failed during the review; it may be that agent's work in progress. I did not edit any file it owns.
- I read the code selectively (the hotspots by size and complexity, the recovery path, the tags). I did not re-read every line of the 7,579.
- Nothing here was observed on the real host. Host runs are paused (see §6, decision 1).

## 2. How far along it is

| Measure | Value | Source |
|---|---|---|
| Source size | 7,579 lines in `packages/kernel/src` (5,751 at HEAD, +32% in one day; 460 KB, +24%) | `wc`, `git show HEAD` |
| Tests | 536 (535 pass, 1 fails now), 50 files, about 3 minutes | `npm run ci` |
| Verbs / decision kinds | 12 of 13 specified verbs (`publish` stays unavailable by design) / 20 kinds | registry |
| Reason codes | 104 defined, 70 referenced by a fixture | `coverage` |
| Bundle | 676 KB of 750 KB | `build` |
| Plan checklist | 70 of 168 items done (42%): Day-1 77%, M0 94%, Alpha 13%, Beta 0%, R1 0%, Phases 0–1 unchecked | `plan.md` |
| Requirements with a T1 tag (Musts) | M0 30/34, Alpha (cumulative) 74/100, Beta 85/158, R1 86/181 | `coverage --milestone` |
| Same, after removing tags that do not prove the requirement (§4.3) | about 68/100 for Alpha | this review |
| Observed on the real host | 0 of 34 M0 Musts qualified; two standard-lane runs in VS Code (SP-01/02/08 partly observed) | plan §4.1 |
| Built-bundle UAT | the 29 scenarios in `uat-remediation.mjs` run clean on Node 26 (I did not run Node 22.12) | run here |

**Honest summary.** Phase 2 (M0 walking skeleton) is nearly built and well tested at T1. Alpha is a third built, by breadth (most decision kinds exist) rather than depth. Beta and R1 have not started. The largest unfinished risks are not code volume: they are the unobserved host behavior (reviewer isolation, approvals) and the growth in complexity described next.

## 3. What is pending

By the completion plan's stages, with my sizing (estimates, not commitments; one engineer):

| Stage | What remains | Rough size |
|---|---|---|
| C0 integrity | The listed open slices: record-content adoption and backup reconfirmation, branch/init/shadow races, remaining crash points, input identity for declared outputs, Git configuration consent, policy/authority/risk consumers, semantic review coverage, milestone-aware gates | 1–2 weeks, **if each slice is bounded against a requirement (§5.1)** |
| C1 M0 host qualification | SP-08 (reviewer isolation and tools, `usages`, parallel and dead children, native questions), SP-01 long command and uninstall, SP-02 storage and instruction files, SP-06/SP-10 dispositions, SP-12; owners named | 1 week of host work plus owner time; blocked on authorization |
| C2 build-and-check path | TypeScript and ESLint normalization in kernel receipts, Playwright/axe, npm install recovery, the starter's feature layer and a real journey | 2–3 weeks |
| C3 intent/configuration | Re-projection when the intent changes, reverse parse of edited blocks, MADR files, charter, the unbuilt settings consumers (`branching: current`, exclusions, required checks, commands), `lesson` | 1–2 weeks |
| C4 Alpha | Analyst agent, Deep evidence, scoped review and "fix findings N and M", kernel-built reading guide, T2 replay, 10 golden tasks, 6 UX sessions | 3–4 weeks |
| C5 Beta, C6 R1 | As in plan §8–§9 | 8–12 weeks, mostly measurement and people |

Of the 17 Alpha-or-earlier Musts still unmapped, 8 are unbuilt kernel behavior (readiness states INS-04, a boundary-example check INT-15, checkpoints WRK-10, scoped "fix findings N and M" RES-06, execution envelopes SEC-04, charter QLT-09, result fields AGT-05, the Analyst AGT-03) and 9 need people, a host or release work (INT-03, RSC-01 to RSC-03, QLT-01, QLT-12, ENG-02, ENG-04, ENG-10). TDD-03 and EVD-13 show as mapped only because of the mis-tags in §4.3, so the true unmapped count is 19.

## 4. Gaps and mistakes, ranked

### 4.1 Complexity has outrun the stated preferences (high)

`.github/copilot-instructions.md` asks for the least code that solves the problem, no handling of cases that cannot happen, and surgical change. In one day the source grew 32% while the checklist moved little. Measured:

- **Very large functions.** 40 of 991 functions are 60 lines or longer or have cyclomatic complexity of 20 or more. The worst: `recover` (verbs/recover.ts) 236 lines, complexity 97, nesting 11; `check.run` 198 lines, complexity 124; `open.run` 166, 80; `basis.run` 137; `pipeline.mutate` 100, complexity 91; `quarantine` 107; `stopWork` 93; `startCommit` 89 with 7 parameters. These are the places defects will hide, and they cannot be reviewed as a unit.
- **Long lines evade the size gate.** 331 source lines exceed 160 characters and 127 exceed 200 (maximum 333). The file-length cap (250) and the line budget count lines, so packing logic into wide lines passes both. The other agent's own fix was to add a 340-character width cap, which still permits it.
- **The line budget is over its decision and the gate does not say so.** Pipeline plus verbs plus decisions is 3,540 lines against the owner's 3,000. `coverage` only reports a module when it is more than 25% over (3,750), so this is silent. The same 25% slack applies to `core/schemas` (438 vs 400) and others.
- **Hardening that exceeds the requirement it serves.** Examples: journalled index-lock ownership with inode checks and directory fsync, an inode-bound quarantine bootstrap journal capped at 10,000 entries and 2 MB, hard-link publication with temporary-file identity checks. Each answers a real counterexample from the audit, but several guard races between processes that the product's own single-owner design already excludes. Under "no handling of cases that cannot happen" each needs a one-line justification naming the requirement and the failure it prevents; I found none recorded in the code or the specification.
- **Specification as implementation log.** `tech-spec.md` gained about 60 lines of mechanism detail (byte caps, inode rules, journal formats). Per the instructions a specification amendment goes to the owner first, with alternatives. I found no recorded owner decision for these. At minimum they belong in code comments or a separate implementation note, so the specification stays a statement of intent and contract.

### 4.2 Process and integrity (high)

- **One uncommitted diff of about 107 files** across kernel, specifications, plan, changelog and 30 new test and fixture files. It cannot be reviewed as one change, cannot be bisected, and would be lost by a bad checkout. The lifecycle asks for code and tests first, then specification, plan and changelog, and a commit only when asked. It needs the owner to ask for commits, in slices (§5.2).
- **Two writers on one tree.** Two agents editing the same files will overwrite each other. This review could not safely continue implementation in shared files for that reason.
- **Host policy conflict.** The plan says the owner deferred host runs on 2026-10-20 and "SP-12 remains unapproved". I was told to run SP-12 earlier in this session. Both cannot hold. I paused: the spike profile is still signed in, a VS Code run is waiting on a prompt, and the MCP prototype exists only in the session scratchpad.

### 4.3 Traceability overstates coverage (medium)

The `[ID]` tag in a test title is the only link between a requirement and its proof, and nothing checks it. I read the requirement text for each of the 84 tags in use. Tags that do not prove their requirement:

| Tag | Requirement | Tagged tests actually show |
|---|---|---|
| TDD-03 (5 tests) | test-alongside with a negative control | support-input invalidation and red invalidation |
| EVD-13 | dedicated test database, verified server | refusal of the unbuilt committed-tree stage |
| SEC-15 | ask on unknown network/credential exposure of a check | branch-creation and integration hook admission |
| WRK-07 | promotion of a prototype with a shortcut inventory | refusal of specialized profiles |
| LFC-04, CON-05, CON-11 | migration preview, conflicting-record diagnosis, relocation | quarantine and accounting recovery; related but not the requirement |

Several tags I added are partial and say so in the plan (REV-03, GIT-12, INT-06, NFR-03, LRN-01), but a partial tag still counts as mapped. The report's "74 of 100" should be read as about 68. **Fix:** a reviewed list of tag-to-test proofs with a one-line reason, checked by the tool, and tags that mean "partial" reported separately.

### 4.4 Correctness defects found

- **Redaction was quadratic on ordinary-looking input** *(mine, SEC-11)*. 200 KB of `a.a.a.` took 10.7 s; `ab-ab-` 7.8 s; repeated `api_key` 4.5 s. Redaction runs on every response, every stored failure message and every quote and request, so a long dotted path in test output would stall the kernel. Bounded the patterns and added a timing test (`core/redact.ts`, `redact.test.ts`; failing test first, 7 pass). Not committed.
- **One test fails in the working tree:** `audit-regressions` "invalidates review when newly declared reviewPaths are absent from the review manifest" expects `finish` to ask about an unexplained file and gets success. It was last edited at 12:43, together with `verbs/manifest.ts`; probably in progress.
- **Tag misuse and unused code:** `tsc --noUnusedLocals` flags 4 unused declarations (one in production code, `adapters/quarantine-fs.ts`); `isReasonCode` and `IntegrateDone` are unused outside tests.

### 4.5 Documentation and hygiene (medium)

- `specs/plan.md` is 812 lines; 54 lines exceed 600 characters and the longest is 1,988. Status paragraphs read as logs, not tables, so the dashboard cannot be skimmed. Several entries repeat the same test counts.
- `CHANGELOG.md` entries are long dense paragraphs; the lifecycle asks for what changed, modified files and tests.
- `docs/audits/` adds 147 KB (the requirement ledger alone is 62 KB) to the repository. It is useful working material; decide whether it is product documentation or an archive (`.archive/` is the ignored place for that).
- The CI "minimum Node" step runs only `inspect help`. The scenario-level run on Node 22.12 that the changelog cites is manual.
- The built bundle (`plugin/kernel/`) is ignored, so a clone is not installable until built. That is fine until the release chain exists; it should be said in the README.

### 4.6 What is good

Architecture rules hold (`lint-arch` clean, pure core, six ports, one pipeline). Duplication in source is near zero. Tests are dense (3.4 assertions per test on average; every file but one above 1.5), use real Git, processes and signals for the risky boundaries, and the suite is deterministic apart from the one starter flake the other agent noted. The earlier audit's counterexamples became regression tests. No `any` outside two justified places. The UAT runs on the built bundle.

## 5. Plan to finish, efficiently

The aim is fewer moving parts, not more. Order matters.

### 5.1 Rule for all further hardening
Before adding a safeguard, write in the slice's test title or comment the requirement ID, the failure it prevents and the evidence that the failure can happen in the product's own flow. If it cannot be stated in two lines, refuse the unsupported case with a clear reason instead of building the machinery. The plan's own cut list already permits this.

### 5.2 Stabilize (first, 1–2 days)
1. Agree who owns the tree. No two writers.
2. Get the uncommitted diff reviewed and committed in about eight slices (state and store; pipeline and ownership; Git and index; project files; receipts and proof; policy and authority; review and focused pass; docs), each code and tests first, then specification, plan and changelog, each with the privacy check. Commit only on the owner's request.
3. Move the mechanism detail out of `tech-spec.md` into an implementation note, or get the owner's recorded approval for each amendment.

### 5.3 Add the quality gates that would have caught this (about 1 day)
A ratchet, not a rewrite: record today's offenders in a baseline file and fail on any new offender or any growth. Rules: function length ≤ 80, complexity ≤ 25, nesting ≤ 5, line width ≤ 140, budget enforced at 100% (not 125%), tag-proof list checked. This keeps CI green today and makes each refactor permanent. Do this after step 5.2 so it does not break the other agent's loop mid-edit.

### 5.4 Refactor the hotspots under the existing tests (2–3 days)
In this order, each behavior-preserving, tests unchanged: `recover` into one reconciler per effect, owned by the module that owns the effect; `check` into prepare, run and finalize helpers; `open` (claiming, reconciliation, admission); `pipeline.mutate`; `basis.run`; `stopWork`; `startCommit`. Target: no function over 80 lines, no line over 140. Wide lines get reformatted in the same pass.

### 5.5 Finish C0 under rule 5.1 (1–2 weeks)
Take the open C0 slices in the other agent's order, each with its requirement and failure stated first. Cut or refuse what cannot be justified.

### 5.6 Qualify M0 on the host (1 week plus owner time; needs authorization)
SP-08 first (isolation and tools), then SP-01/02, SP-06/10 dispositions, then SP-12. Observations so far suggest the command line needs 1–2 prompts per task with a session allow, and the TS §4.6 approval rule as written misses any request text containing `( ) < >` and cannot name the kernel path. That is evidence to weigh, not a measurement.

### 5.7 Alpha, Beta, R1
As in the completion plan (C2 to C6), with the Analyst agent, golden tasks and UX sessions started early because they depend on people, not code.

## 6. Decisions needed from the owner (one at a time)

1. **Host runs and SP-12:** is the October 20 deferral in force (the plan says yes), or do my earlier instructions stand? Until answered I run nothing on the host and will sign the spike profile out.
2. **Who owns the working tree**, and may the uncommitted diff be committed in slices?
3. **Spec amendments:** approve, move or reject the mechanism text added to `tech-spec.md`.
4. **Budget:** re-baseline to the real size (about 3,550) or bring the code back to 3,000 through §5.4.
5. **Quality gate thresholds** in §5.3.
