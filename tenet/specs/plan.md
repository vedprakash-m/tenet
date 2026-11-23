# Tenet plan

> Level L2 · Version 0.11 · Status: **draft, awaiting the Owner's approval** · Implements [prd.md](prd.md) §6 · Every item below is a packet in `tenet/packets/` · Budget: 6,000 tokens · Previous version: `archive/specs/plan.md@0.10.md` · Release parts: [alpha.0](plan/alpha.0.md), [alpha.1](plan/alpha.1.md), [alpha.2](plan/alpha.2.md), [0.1.0](plan/0.1.0.md), [0.1.x](plan/0.1.x.md)

**Context card.** M0 runs three spikes, writes the kernel and freezes the alpha.0 contracts from what they show, tries those contracts on a medium-effort model, and stops paper review at the ready-for-pilot checklist. M1 ships in four releases, each usable on its own:
- **alpha.0, intent and proof:** install from npm, onboarding that drafts specifications your agent grounds in your code and you bless, agent context, an advisory proof card, a board of specifications; nothing blocks
- **alpha.1, protect:** rules the Owner turns on block; decisions on pull requests
- **alpha.2, verify:** signed evidence that cannot be forged
- **0.1.0:** the careful lane and reference agents

This file holds order and gates. Each release part holds a **build contract** per packet (§4), so a builder never decides who decides, what stays binding, what counts as evidence or what the user sees.

## 1. Milestones

| ID | Release | Packets | Release gate | Status |
|---|---|---|---|---|
| M0 | — | CP-0001–0003, CP-0015–0017, CP-0040, CP-0041 | The ready-for-pilot checklist holds; the Owner signs `vision.md` v1 and approves the specifications, at named versions and digests | in progress |
| M1 | 0.1.0-alpha.0 | CP-0004, CP-0005, CP-0006, CP-0009, CP-0010, CP-0012, CP-0018, CP-0044, CP-0045, CP-0048, CP-0051, CP-0052, CP-0053 | First useful finding in ≤10 minutes; a small project's baseline blessed in ≤30 minutes with ≥90% of drafted statements kept and recalled and none invented (ALG-13); the onboarding evaluation suite passes; a fresh agent session acts on the blessed intent; the packed artifact installs and runs both UX Part 1 paths on three platforms; two outside maintainers succeed without help | not started |
| M1 | 0.1.0-alpha.1 | CP-0049, CP-0007, CP-0050, CP-0019, CP-0008 | False blocks under 2 per 100 changes; record overhead under 2 minutes per change; alpha.0 records still read | not started |
| M1 | 0.1.0-alpha.2 | CP-0042, CP-0046, CP-0021 | This repository closes ≥3 verified changes on it; red-team cases pass at their levels | not started |
| M1 | 0.1.0 | CP-0022, CP-0020, CP-0013, CP-0014, CP-0024 | Quick start passes on three platforms; a real GitHub repository runs the two-job workflow; this repository and Torus each close ≥5 verified changes, at least 2 in the careful lane | not started |
| M1 | 0.1.x | See [plan/0.1.x.md](plan/0.1.x.md) | Each point release: its packets' proving and the red-team suite; V-H1 measured across them | not started |

**Scope freeze** (DEC-38). Until the checklist below holds, no new catalog entries or packets are added except splits of existing packets; new ideas become `idea` rows. Every M0 packet has a time box; running over it means stop and escalate. Until alpha.0, this repository keeps packets light and hand-writes `now.md`.

**Ready-for-pilot checklist.**
1. The three spike results are in the ledger, and the specifications are updated to match.
2. The kernel (Part I) is written within 8,000 tokens and cross-checked against the specifications; `kit/TENET.md`'s old text is archived.
3. Every change from L-0013 to L-0023 is applied.
4. The alpha.0 contracts (contracts.md, algorithms.md and the alpha.0 part) are frozen.
5. **Medium-model trial:** a medium-effort model builds CP-0044 from its contract alone. Every rule it had to invent is fixed in the specification, and the trial is repeated in a fresh session until nothing is invented.
6. `blocked_by` in every `packet.yaml` matches §2, with no cycles (checked by script).
7. The red-team list matches the guarantee table.
8. One three-change sequence has been run by hand on Torus.
9. The decision-reconstruction exercise has run with at least two maintainers.

Then reviews are of running software.

**Stop or change course.**
- If alpha.0 doesn't cut Owner minutes per agent pull request, or outside maintainers can't adopt it unaided: narrow the first adopter or the entry point.
- If CP-0040 finds no working signature or protected store: fall back to a separate evidence repository, labelled detected.
- If record overhead stays above 2 minutes per quick change: re-slice.
- If pilots fall short on kept, recall or invented commitments: draft only observed and documented statements until the evaluation suite passes.

Every release ends with a retrospective that removes any rule whose cost exceeds its benefit.

## 2. Waves

Packets in one wave can be built side by side; each needs every earlier wave it names. `blocked_by` in each `packet.yaml` is the authoritative copy of this table.

| Wave | Packets | Needs |
|---|---|---|
| M0-1 | CP-0017, CP-0040, CP-0041, CP-0002, CP-0016 (runs throughout) | — |
| M0-2 | CP-0015 kernel and contract freeze | CP-0017, CP-0040, CP-0041 |
| M0-3 | CP-0001 ratify | CP-0015 |
| M0-4 | CP-0003 bootstrap | CP-0001, CP-0002 |
| A0-1 | CP-0004 schemas · CP-0005 CLI and packaging | CP-0003 |
| A0-2 | CP-0012 kit content · CP-0006 policy | CP-0004; CP-0006 also CP-0005 |
| A0-3 | CP-0044 specification formats | CP-0006, CP-0012 |
| A0-4 | CP-0009 check · CP-0045 context and MCP · CP-0053 specification board · CP-0018 reports and acceptance | CP-0044 (CP-0018: CP-0005 only) |
| A0-5 | CP-0048 onboarding inventory · CP-0051 proof job | CP-0048: CP-0009, CP-0012; CP-0051: CP-0018, CP-0044 |
| A0-6 | CP-0052 blessing and evaluation | CP-0048 |
| A0-7 | CP-0010 init, upgrade, remove → alpha.0 release | CP-0045, CP-0051, CP-0052 |
| A1 | CP-0049 → CP-0007 → CP-0050 → CP-0019 and CP-0008 | alpha.0 |
| A2 | CP-0042 → CP-0046 → CP-0021 | alpha.1 |
| GA | CP-0022 → CP-0020 → CP-0013 and CP-0014 → CP-0024 | alpha.2 |

## 3. M0 packets

### CP-0017, CP-0040, CP-0041 · experiment · Three feasibility spikes (first, in parallel)

Each is Quick and time-boxed to **2 days**. Each runs on a real GitHub repository on Windows, macOS and Linux, and ends with a ledger entry naming what worked and the specification changes needed. **Stop rule:** if a hypothesis fails, record the fallback and its guarantee level; never extend the box.

- **CP-0017 · Spike A: identity and decisions.** Run on the first adopter's real setup.
  1. Presence can be read from a security-key `ssh-keygen -Y` signature, and signed decisions survive squash, rebase and a shallow clone.
  2. The proof job reads a native review approval and a `/tenet pick` reply bound to the commit the latest card showed. A reply after newer commits is refused. An edit to the acceptance block on the same commit makes the card re-check.
  3. A pull request opened by the Owner's account can't be approved by it; one opened by a bot can.
  4. An agent using the Owner's session to reply `/tenet approve` is caught by the spot checks.

  *Fallback:* forge decisions are shown as detected.
- **CP-0040 · Spike B: signed evidence and CI.**
  1. Compare the three signing options in tech spec §7.3 and pick a default for public and private repositories.
  2. Five concurrent writers to the records ref and the evidence ref lose nothing.
  3. The proof job's check run works with `checks: write`, and the job-summary fallback works for a fork.
  4. A check job with network denied and no shared cache can't poison the attest job.
  5. Find which plans can require the status.

  *Fallback:* a store only the attest job can write.
- **CP-0041 · Spike C: events, reports and performance.**
  1. Events with `prev` arrays reduce identically in every arrival order (ALG-05).
  2. 10,000 event files reduce within R-082 on Windows.
  3. The ALG-08 readers handle real `node:test`, vitest, jest, pytest and Go reports, including retries and entities.

  *Fallback:* compaction (tier 2) from 0.1.0.

### CP-0015 · spec · Kernel and contract freeze

- **Lane:** careful · **Needs:** CP-0017, CP-0040, CP-0041 · **Time box:** 3 days.
- **Do:**
  1. Write Part I of `kit/TENET.md` from the spike results in at most 8,000 tokens, rules in prose with provisional IDs: the spec process (PRD §4.0), then the kernel (tech spec §3–§7). Archive the old text.
  2. Update the specifications with the spike results.
  3. Freeze contracts.md, algorithms.md and plan/alpha.0.md.
  4. Run the medium-model trial (checklist item 5).
  5. Fix the kit defects:
     - correct the Spotify precedent from its source
     - remove the local govaut path
     - add `agent` as an escalation level
     - add the `factory` packet type
- **Done when:** Part I is within budget with IDs on every "must"; a cross-check table shows Part I and the specifications agree; the trial invents nothing.

### CP-0016 · experiment · Problem validation and baselines (alongside M1)

- **Do:**
  - Run 5 interviews with maintainers who delegate real changes to agents, at least one outside application code. Cover:
    - where their intent lives, how it reaches their agents and how stale it gets
    - whether they would bless a machine-drafted specification and how long they would read it
  - Run the **decision-reconstruction exercise** (R-075).
  - Replay 10 Torus changes for baselines; record Torus's health indicators.
  - Recruit the external pilot (OQ-05).
- **Kill or pivot:** if there is no meaningful time or correctness gap, narrow the first adopter or entry point before 0.1.x.
- **Done when:** a ledger entry records findings, baselines and the pilot.

### CP-0001, CP-0002, CP-0003

- **CP-0001 Ratify** (deep, needs CP-0015): the Owner signs the vision v1 twice, a day apart (this project runs its own vision at `assure`), and approves the specifications and Part I at named versions and digests.
- **CP-0002 Namespace** (quick):
  - Already settled: GitHub home `github.com/vedprakash-m/tenet` and template `vedprakash-m/tenet-starter` (L-0020); npm package `@vedprakash-m/tenet` (L-0022).
  - Still open: the schema host and the licence (OQ-04).
  - Ledger decision.
- **CP-0003 Bootstrap** (quick, needs CP-0001, CP-0002): `package.json`, strict ESM `tsconfig.json`, licence, `node:test`, CI on three platforms, hooks.

## 4. Build contract

Every packet entering build has, in its release part:

1. **Needs:** packets and the contract sections it relies on.
2. **Owns:** files and modules it creates or changes. Nothing else may be touched.
3. **Exports:** functions with signatures, commands, schemas, exit codes, `--json`.
4. **Behavior:** inputs, outputs, defaults, failures, retries, by reference to contracts and algorithms.
5. **Edge cases** it must handle.
6. **Out of scope.**
7. **Fixtures**, positive and negative, by name.
8. **Proving:** the exact command, and what must pass.

Alpha.0 contracts are complete now. Later releases have fields 1, 2 and 8, and the rest are written when the previous release ships.

## 5. After 0.1.x

| Milestone | Entry conditions |
|---|---|
| M2 (0.2.0) | V-H1 met; the standard pack's stations and the release and operate phases specified; one data or infrastructure pilot |
| M3 (0.3.0) | Two engines chosen (OQ-07); engine adapter contract frozen; leases exclusive on one engine |
| M4 (1.0.0) | Two independent implementations agree on every kernel fixture; upgrade migrations specified; the open proposal process drafted |
| M5 (1.x) | Qualification suites for core and reviewer roles; staged release of agents specified |
