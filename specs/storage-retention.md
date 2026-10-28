# Specification: Bounded Storage and Eviction (CON-08, RC1 R07)

> Status: Reviewed 2026-10-24 (fresh-context subagent, 10 findings, dispositions in §11). Owner approved D1 to D3 on the draft; **§12 (v2) supersedes §3 to §6 where they differ** and narrows scope. Owner selected the PRD eviction order on 2026-10-26 (§13); remaining deferred mechanisms still require design/review/sign-off.
> Date: 2026-10-24 | Decision owner: @vedprakash-m | Canonical sources: PRD §4.4.3, §5.15 (CON-08, AC-19); tech-spec §7.6, §7.2.

## 1. Outcome

A long-lived project keeps `.tenet/` within its budget and the run files within theirs, while every record that carries authority, evidence a live contract relies on, or an unresolved effect is kept. If the protected data alone exceeds the ceiling, calls that add data stop with `storage-protected-full` and say what is protected. Nothing is evicted silently: each eviction is reported once, in words, at the call that did it.

**Verification:** build `.tenet/` fixtures (small, large, long-history) with a real store; run `open` and `finish`; compare sizes, retained records and the report. Pass means the budget holds, every protected class is byte-identical before and after, and an interrupted eviction recovers.

## 2. Current state (inspected 2026-10-24)

- The journal (`.tenet/log`) is append-only with four record kinds (`intent`, `result`, `call`, `accounting`), each bounded to 50 MB; nothing is ever removed from it. `state.archive` holds one line per finished contract with a `blob` reference; blobs under `.tenet/blobs/` are content-addressed and are never removed.
- `storage-protected-full` exists only for the per-record bound. There is no aggregate measure, no admission rule for snapshots by size at the store, and no eviction.
- Run files outside the project are swept after 24 hours (`sweepTemp`); per-project and per-machine caps (200 MB, 1 GB) are not enforced.

## 3. Requirements

| ID | Requirement | Source |
|---|---|---|
| SR-1 | Measure `.tenet/` (state, prev, log, blobs, quarantine) and run files; a call that would add data first checks the ceiling (50 MB; 5 MB reserve for state writes). | TS §7.6, AC-19 |
| SR-2 | Evict eligible classes in the order and under the conditions in PRD §5.15; the narrower implemented reduction/run-cleanup scope does not establish complete aggregate eviction. | PRD §5.15; owner ordering decision, §13 |
| SR-3 | Never evict: an active or parked contract, a grant, an unresolved effect intent, an open finding, a lock, ownership, a blob a retained record references, accepted intent, an active lesson, unintegrated work. | PRD §5.15, CON-08 |
| SR-4 | Accounting survives compaction: a monthly summary keeps the `accounting` high-water marks that recovery uses (`workSeq`, `generationSeq`), so recovery after compaction gives the same budgets. | TS §7.2, R04 |
| SR-5 | Eviction is a recorded effect (intent, act, result) and is safe to interrupt at every step; a rerun finishes or repeats it without losing a protected record. | CON-12 |
| SR-6 | Run directories past 200 MB per project or 1 GB per machine are removed oldest first, except those of live runs and live reservations. Expired raw output makes later claims say "historical; raw output unavailable". | TS §7.6 |
| SR-7 | If protected data alone exceeds the ceiling, data-adding calls return `storage-protected-full` naming the largest protected classes; read-only calls and `stop` still work. | TS §7.6 |

## 4. Behavior as examples (test ownership)

| # | Example | Test file |
|---|---|---|
| E1 | A journal with 10,000 old `call` records and one unresolved intent: after `finish`, old calls are summarized by month, the unresolved intent and its neighbours are untouched, size falls under the ceiling. | `storage-eviction.test.ts` |
| E2 | Recovery after compaction yields the same per-work budgets as before (SR-4). | `storage-eviction.test.ts` |
| E3 | A process killed at each of the eviction steps (before intent, after intent, mid-rewrite, after result): the next call completes or repeats it; no protected record is lost. | `crash-eviction.ts` driven by `storage-eviction.test.ts` |
| E4 | A parked contract and a live reservation are never compacted however old (SR-3). | `storage-eviction.test.ts` |
| E5 | Protected data alone at 51 MB: `open` of a new contract returns `storage-protected-full` with the largest classes; `stop` and `inspect` still work. | `storage-eviction.test.ts` |
| E6 | A prototype snapshot over 20 MB is refused with `snapshot-too-large` and an offer of `git init`; one under it is admitted. | `prototype.test.ts` (extend) |
| E7 | Run files: two projects over the per-machine cap lose the oldest first; a live run's directory stays. | `store-boundary.test.ts` (extend) |
| E8 | An eviction is reported once, in one sentence, naming what was compacted and what was kept. | `storage-eviction.test.ts` |

## 5. State and contract changes

- New journal record kind `summary` (`period: "YYYY-MM"`, per-verb call counts, exit histogram, accounting high-water marks, count of replaced records). `LogRecord` gains the kind; older kernels refuse it as unsupported, so this is a **schema-affecting change** and needs the `migration-needs-approval` path of TS §7.7 once that exists, or a documented one-way rule until then (see decision D1).
- `state.archive` entries gain an optional `compacted: true`; the blob they reference is removed only when no retained record references it.
- No change to contracts, grants, receipts, locks or ownership.

## 6. Alternatives considered

| Option | For | Against |
|---|---|---|
| A. In-place journal rewrite (write a new file, rename) | One file; simple reads | Rewrite of up to 50 MB inside `open`/`finish` strains the 300 ms bound; needs the effect protocol around the rename |
| B. Segmented journal (`log`, `log.<month>`), compact whole segments | Eviction is a rename or delete of one old segment; reads of recent history stay cheap; interruption leaves whole segments | Changes the journal layout and its readers; more files to admit |
| C. Never compact; only warn | No risk to evidence | Fails CON-08 and AC-19 |

**Recommendation: B.** It keeps the 300 ms bound honest (no large rewrite), makes SR-5 simple (a segment is either present or gone, and a summary is written before the segment is removed), and keeps unresolved intents in the live segment. Cost: one layout change, covered by SR-4's recovery test.

## 7. Risks

- The journal is what recovery and accounting trust; a compaction bug would lose evidence. Mitigation: E2 and E3 first, summary written and fsynced before any removal, protected-record scan before and after in tests.
- The 300 ms bound may not hold for very large journals; mitigation: segment deletion only, never a rewrite of the live segment.
- Older kernels cannot read `summary` records (D1).

## 8. Assumptions

- Per-record bound (50 MB) and the existing journal validation stay as they are.
- Users do not need call-level history older than 90 days; the PRD already says so.
- File times are trustworthy enough to age run directories (the sweep already depends on them).

## 9. Acceptance criteria

1. E1 to E8 pass on a real store with real processes for the kill cases.
2. A frozen long-history fixture (tags: large, long) stays under 50 MB after `finish`, with protected classes byte-identical.
3. `npm run ci` passes with no module budget exceeded beyond the owner's pre-approval.
4. Built-bundle scratch run on Node 26.3.0 and 22.12.0 shows an eviction report and a clean recovery after a kill.

## 10. Decisions for the owner (one at a time)

- **D1.** The `summary` record changes the journal's accepted shapes. Accept option B with a one-way change now (recommended: this is pre-release, no installed base), or wait for the schema-migration slice?
- **D2.** Segment size: one segment per calendar month (recommended; matches the "monthly summaries" wording) or per size?
- **D3.** Confirm that the per-machine run-file cap is enforced lazily at the next kernel call (as the spec says) rather than by a background process (Tenet installs no service).

## 11. Independent review: findings and dispositions (2026-10-24)

Reviewer: a fresh-context subagent with read-only access (not the author). All ten findings were checked against the code and accepted unless stated.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | Blocker | PRD §5.15's eviction order (superseded raw output; accepted-work artifacts >30 d; traces >90 d to summaries; archived contracts) differs from TS §7.6's (snapshots; journal >90 d; archived contracts). | **Accepted; ordering policy resolved 2026-10-26.** Owner selected PRD §5.15; TS §7.6 is aligned under §13. v2 reduction/run cleanup does not complete aggregate ordering, snapshot/archive design or protected retention. |
| 2 | Blocker | Snapshots are commits in the shadow repository at `.tenet/git`, not `.tenet/blobs`; `state.archive` is written by no code. | **Accepted.** Snapshot eviction, archive compaction, superseded raw output and accepted-work artifacts are **deferred** until their mechanism is designed (shadow-repo pruning is a Git operation). SR-3 now names blobs referenced by journal intents. |
| 3 | Major | SR-4 aims at the wrong risk: recovery reads only checkpoints newer than `state.revision`; the tail near `state.prev` matters. | **Accepted.** New rule: no `accounting` record at or above the older of `state` and `state.prev` revisions is ever removed. |
| 4 | Major | Whole-segment deletion cannot keep intent/result pairing. | **Accepted; avoided.** v2 does not segment. Removal is per record: an intent without a result is never removed, and a pair is removed only when both records are old. |
| 5 | Major | Interruption cases incomplete; summary double-counting; no home for eviction's own records. | **Accepted.** v2 writes summaries first with `from` = hash of the journal they were computed from; a rerun on the same input does not add twice. The journal is replaced by write-temp, fsync, rename. Eviction writes no intent/result of its own: it is a pure function of the journal, idempotent by construction. |
| 6 | Major | 300 ms bound and whole-journal read paths unaddressed. | **Accepted.** Reads already cover the whole journal; compaction runs only past a size threshold, once per overage, and a latency test on a 10,000-record fixture is added. The bound is asserted, not assumed. |
| 7 | Major | A new journal record kind is a one-way format change with hidden costs. | **Accepted; avoided.** Summaries live in a separate `.tenet/summaries.json`; `log` keeps its closed schema, so no journal format change and D1's one-way rule is not needed. |
| 8 | Major | Run-file caps unbacked; mtime of a folder is not use; cross-workspace deletion needs authority. | **Accepted.** The per-project cap uses newest-file time. The per-machine cap is **deferred** (it needs an authority decision; `decide cleanup --target machine` exists as the explicit path). D3 is therefore moot. |
| 9 | Minor | Missing protected classes; clock skew; `stop` writes data. | **Accepted.** SR-3 adds `state.prev`, `marker`, `summaries.json`; ages use the older of `now` and the newest record's time; `stop` is served from the 5 MB reserve. |
| 10 | Minor | Examples thin; E5 fixture not constructible at 50 MB; lifecycle items missing. | **Accepted.** v2 tests use a store option for small ceilings; torn-tail, summary-failure and reserve cases are added; plan, changelog and `.gitignore` audit are in the finish steps. |

## 12. Revised scope, v2 (supersedes §3, §5 and §6 where they differ)

**In scope.**
- **V1. Measure and admit.** `evict` measures `.tenet/` (everything inside) and run files; limits are store options (50 MB and 5 MB reserve; 200 MB per-project run files) so tests can use small ones. If protected data alone exceeds the ceiling after eviction, `open` returns `storage-protected-full` naming the largest classes; `stop` and read-only views still work.
- **V2. Journal reduction.** When `log` exceeds a threshold (default 5 MB), at `open` and `finish`: records older than 90 days (cutoff = the older of now and the newest record's time, minus 90 days) are removed and counted into `summaries.json` by month (calls per verb, exit histogram, intents, results, accounting). Never removed: an intent without a result, a pair with either side newer than the cutoff, any `accounting` record with revision at or above the older of `state` and `state.prev`, or anything unparseable (the journal is then left untouched).
- **V3. Run-file cap.** Over 200 MB, the oldest run folders, manifests and review folders (by newest file time) are removed except live runs and live reservations.
- **V4. Reporting.** One sentence in the response's completed effects naming what was reduced and what is kept.

**Deferred (design/review/sign-off or separate authority needed).** Snapshot (shadow-repo) pruning, archived-contract compaction, superseded raw output, accepted-work artifacts older than 30 days, and per-machine run-file cap. The PRD/TS ordering policy is resolved in §13, not left open.

**Safety argument.** Reduction is a pure function of the journal text; summaries are written before the journal is replaced and carry the input hash; the journal replacement is a rename. A crash leaves either the old journal (rerun is safe: same input hash, no double count) or the new one. Recovery after reduction yields the same budgets because every record recovery reads is protected.

**Acceptance (v2).** E1 (adapted to per-record removal), E2 (recovery equality), E3 (kill after summaries write; after journal rename), E4 (parked and unresolved untouched), E5 (small-ceiling `storage-protected-full`; `stop` still works), E7 (project run-file cap), E8 (report once), plus: torn tail in the live journal, idempotent rerun without double count, clock-skew guard, and a 10,000-record latency check. Journal schema and marker schema are unchanged.

## 13. Owner Ordering Decision (2026-10-26)

The owner selected **retain PRD §5.15's eviction order and align tech-spec §7.6**, rather than amend the PRD or defer the policy. This resolves finding 1's ordering choice only. Protection and admission rules remain binding; an age or size threshold never permits eviction of protected records.

No aggregate eviction, snapshot pruning, archive format, protected-retention implementation, new cleanup authority or budget increase is approved by this decision. Specify the remaining eligible-class mechanisms and recovery/reference protections, disposition independent review, and obtain implementation sign-off before code. Existing bounded journal reduction and project run cleanup remain partial safeguards, not CON-08/AC-19 completion.
