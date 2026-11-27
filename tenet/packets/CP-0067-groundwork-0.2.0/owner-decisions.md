# CP-0067 · Owner decisions for 0.2.0

> Collected by the coordinator on 2026-11-26 from the three readiness reports: [track 1](readiness-cp-0049-cp-0007.md) (T1), [track 2](independent-cases-alpha.1.md) (T2) and [track 3](readiness-cp-0050-cp-0019-cp-0008.md) (T3). Two items come from [CP-0068](../CP-0068-dogfood-fixes-0.2.0/definition.md). Overlapping questions are merged; the source IDs are listed so each one can be traced.
>
> **Answered 2026-11-26: the Owner accepted every recommendation ([L-0043](../../ledger/L-0043-owner-decisions-0.2.0.md)).**

## Summary

| ID | Question | Recommendation | Blocks |
|---|---|---|---|
| OD-1 | How legacy packets migrate | A · keep a compatibility snapshot; no made-up events | CP-0049 |
| OD-2 | Default loop step cap | A · 20 | CP-0049 |
| OD-3 | Old test fixtures | A · refresh them to 0.1.x formats first | CP-0007, CP-0050, CP-0008, the evaluator trial |
| OD-4 | `pointer` on findings | A · keep `finding.json` strict; fix the case | CP-0049 |
| OD-5 | An event whose parent is missing | A · warn and hold, as kernel §1 says | CP-0007 |
| OD-6 | Which digest identifies a commit's code | A · ALG-01's filtered SHA-256 | CP-0007 |
| OD-7 | Does replay enforce legal moves? | B · no; `move` and the gate do | CP-0007 |
| OD-8 | How forge events reach Tenet, and what they can move | A + A · one trigger table in CI §3; moves defined by the pack | CP-0007, CP-0019 |
| OD-9 | `blocking.rule` for gate rows 1–4 | A · `"always-enforce"` | CP-0050 |
| OD-10 | Board schema for 0.2.0 | A · extend `board.json` in CP-0008 | CP-0008 |
| OD-11 | What "flow" measures, and over what window | A · rolling 30 days, with sample sizes | CP-0008 |
| OD-12 | Campaigns on the full board | A · show recorded campaigns, read-only | CP-0008 |
| OD-13 | First setup pull request and protected files (CP-0068 AC-B1) | A · exempt it, narrowly | CP-0068 |
| OD-14 | Archive folders in onboarding (CP-0068 AC-D3) | B · excluded by default, listed as skipped | CP-0068 |

## Kernel schemas and migration (CP-0049)

### OD-1 · How legacy packets migrate (T1 D-1)

Some existing packets hold facts the new history can't express. CP-0066 and CP-0067 use values the old schema refuses, and two packets have a snapshot ahead of their recorded station.
- **A.** Keep a compatibility snapshot next to the migrated events, and invent no events.
- **B.** Repair the old records first, with history amendments you authorize, then require a clean conversion.

**Recommend A.** The records are kept as they are, and nothing gains authority it never had. B rewrites history to fit the new tool.

### OD-2 · Default loop step cap (T1 D-2)

`agents.md:142` says 40, but the CP-0049 contract and the settled round 10 answer say 20.
- **A.** 20: change `agents.md`.
- **B.** 40: change the contract and the case.

**Recommend A.** It's cheaper and safer by default, and a pack can still raise it.

### OD-3 · Old test fixtures (T2 D-5)

`events/p08`, `events/n06`, `full-board/p05` and `evaluator-trial/history.yaml` use record formats from before 0.1.0.
- **A.** Refresh them to what 0.1.0 and 0.1.1 actually write, and add the missing `evaluator-trial/` row to `INDEPENDENT.md`, before any build or the trial.
- **B.** Keep them, and add separate 0.1.x fixtures.

**Recommend A.** The plan requires the evaluator trial to match today's contracts before the 0.2.0 contracts are frozen. Track 2 makes the change, because it isn't a builder of these packets.

### OD-4 · `pointer` on findings (T2 D-1)

Case `kernel-schemas/n06` expects a `pointer` field that `kit/schemas/finding.json` doesn't allow.
- **A.** Keep `finding.json` strict and change the case. The pointer goes in the `TN-SCHEMA` message, as `messages.md:77` already says.
- **B.** Add an optional `pointer` to the schema and to contracts §5.

**Recommend A.** Every 0.1.x command already ships `finding.json`, so changing the case is the smaller change.

## Events and reduction (CP-0007)

### OD-5 · An event whose parent is missing (T1 D-3)

- **A.** Report a warning (`TN-EV-ORPHAN`) and hold the event and everything after it until the parent arrives, as `kernel.md:25` and ALG-05 already say. Bring the round 10 severity into line, and add a `check` assertion.
- **B.** Make it a structural error everywhere.
- **C.** Warn on a partial read, and error when the store is known to be complete.

**Recommend A.** A late parent already stops anything from moving forward, while B would fail every partial read.

### OD-6 · Which digest identifies a commit's code (T1 D-4)

TS §3 says "the tree SHA of tracked code, excluding the records folder, `.tenet/` and generated views". A native git tree ID can't leave out paths.
- **A.** ALG-01's filtered SHA-256. TS §3's provisional wording is corrected to match.
- **B.** Git's native tree ID, with a different set of exclusions.

**Recommend A.** It's the only option that keeps the promise that records and generated views never change the subject, and the independent case already uses it.

### OD-7 · Does replay enforce legal moves? (T2 D-2)

- **A.** `reduce()` rejects moves that aren't legal edges in the pack, and cases `p04` and `p05` are rewritten.
- **B.** `reduce()` follows cause only, while `tenet move` and the gate check legal edges. Kernel §1 and ALG-05 also say whether the `resolve` event becomes the conflict's head.

**Recommend B.** A forge state can jump (ready, draft) and history can be partial; replay must still work then. B also needs one more answer: **the `resolve` event becomes the conflict's head.** It's the latest event that has seen both branches.

### OD-8 · How forge events reach Tenet, and what they can move (T3 D-1, T1 D-5)

There are two linked questions.
1. **Transport.**
   - **A.** One table in CI §3 gives, for each event type (native review, reply comment, ready for review, converted to draft, closed), the trigger, the permissions, the key that makes a repeat delivery harmless, and the result when the event is degraded.
   - **B.** CP-0019 works out the triggers while it's being built.
2. **Effect.**
   - **A.** A forge event can move work only to a destination the selected pack defines as legal. Without one, it's recorded as an observation and moves nothing.
   - **B.** Fixed station targets.
   - **C.** It never moves state.

**Recommend A for both.** One table that can be audited, and no guessed transitions. The first event that creates a work stream needs a stated rule; recommend that **only a creation event starts a work item, and a forge event can't.** CP-0019 must still show the trigger and the trusted token working in `tenet-sandbox`.

## Gate (CP-0050)

### OD-9 · `blocking.rule` for gate rows 1–4 (T2 D-3)

ALG-07 rows 1 to 4 (frozen, conflict, unknown applicability, incompatible policy) block, but no rule produces them.
- **A.** Use the fixed string `"always-enforce"`, documented at `algorithms.md:154`.
- **B.** Use `null`, or a name per row.

**Recommend A.** The field stays a non-null string, the existing cases stand, and the row is still in `blocking.row`.

## Full board (CP-0008)

### OD-10 · Board schema for 0.2.0 (T2 D-4, T3 conflicts)

- **A.** CP-0008 extends `kit/schemas/board.json` and contracts §5:
  - new fields: `justified_station`, `tentative`, `self_accepted`, `flow`, `friction`, `conflicts: [{work, heads}]`, `findings`, `modes`, `since`;
  - three cases change: `full-board/p03`, `p05` and `p06`;
  - today's `board` output and `pkg/conformance/board/` stay valid.
- **B.** Keep the schema strict, and put the 0.2.0 fields under `x-` keys.

**Recommend A.** The 0.1.x schema left `flow: {}` and `conflicts: [string]` as placeholders for exactly this. `schema_version` stays 1, because the change only adds fields.

### OD-11 · What "flow" measures, and over what window (T3 D-2)

- **A.** A rolling 30-day window. Each metric is `{value, unit, sample_size}`, with explicit median and 85th-percentile objects.
- **B.** The whole history.

**Recommend A.** It matches R-216's rolling period, and a small sample is shown as small. No person is ranked.

### OD-12 · Campaigns on the full board (T3 D-3)

Contracts §5 and TS §8 list campaigns on the board, but CP-0008 puts campaigns out of scope.
- **A.** Show recorded campaigns read-only, as they are in the snapshot. Managing campaigns stays out of scope.
- **B.** Drop campaigns from 0.2.0's board, and remove them from contracts §5 and TS §8.

**Recommend A.** It's cheap, it resolves the conflict, and with no campaigns recorded the list is just empty.

## From the second dogfood (CP-0068)

### OD-13 · First setup pull request and protected files (AC-B1)

The pull request that adds Tenet is flagged because it changes Tenet's own protected files. Once rules can block, it would block the setup itself.
- **A.** Exempt it, narrowly. When the base commit has no `tenet.yaml`, protected-file changes become one note, *"First-time setup: protected Tenet files are expected."* This applies only to the files `init`'s manifest lists. Any other protected path is still flagged.
- **B.** Keep flagging it, and explain on the card that it's expected.

**Recommend A.** Before setup there's nothing to protect, and limiting it to the manifest keeps the exemption from covering unrelated files.

### OD-14 · Archive folders in onboarding (AC-D3)

- **A.** Keep today's behaviour: a hint, then the user adds `onboard.exclude`.
- **B.** Leave out common archive folders (`.archive/`, `archive/`, `old/`) by default. List them under "skipped", with the line to add to include them.
- **C.** Include them, but rank them below current files.

**Recommend B.** Archived versions made almost all of the first findings noise (1,225 of 1,226), and B still shows what was skipped and how to bring it back.
