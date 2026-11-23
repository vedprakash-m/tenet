# Tenet plan

> Level L2 · Version 0.14 · Status: **draft, awaiting the Owner's approval** · Implements [prd.md](prd.md) §6 · Every item below is a packet in `tenet/packets/` · Budget: 6,000 tokens · Previous version: `archive/specs/plan.md@0.13.md` · Release parts: [alpha.0](plan/alpha.0.md) and [alpha.0b](plan/alpha.0b.md), [alpha.1](plan/alpha.1.md), [alpha.2](plan/alpha.2.md), [0.1.0](plan/0.1.0.md), [0.1.x](plan/0.1.x.md)

**Context card.** Two tracks (DEC-57). The **build track** runs without calendar waits: M0 runs the spikes in parallel on day 1, writes the kernel and **every** release's contracts, tries them on a medium-effort model, then building proceeds wave after wave, gated only by automatic checks. The **evidence track** (interviews, outside maintainers, dogfooding, pilots) runs alongside and never blocks building; it gates only announcing a release and claiming a horizon. Releases are published as snapshots when their build gate is green. M1 ships in four releases, all on one CI shape: a test job and a recorder (DEC-48).
- **alpha.0, intent and proof:** install from npm; onboarding that drafts specifications your agent grounds in your code and you bless; agent context; an advisory proof card that opens with the blessed requirements a change touches; a board of specifications. Nothing blocks.
- **alpha.1, protect:** rules the Owner turns on block honest mistakes; decisions on pull requests.
- **alpha.2, verify:** a sealed test job and signed records that cannot be forged.
- **0.1.0:** the careful lane, reference agents, work commands and a minimal reference runner that chains them through your own agent tool.

**§0 says where the work stands and what to do next; keep it current.** This file holds order and gates. Each release part holds a **build contract** per packet (§4), so a builder never decides who decides, what stays binding, what counts as evidence or what the user sees.

## 0. Status and next actions

Updated 2026-11-23 by the M0 session (L-0029, L-0030).

| Item | State | Next action and who |
|---|---|---|
| Fast-track plan (v0.14, L-0029) | done | — |
| CP-0041 Spike C | **done** (L-0030) | — |
| CP-0056 Spike D | **done**: adapters `claude-code`, `copilot-cli`, `command` | — |
| CP-0040 Spike B | **done** on one account, GitHub Free (L-0030) | deferred by the Owner to before alpha.2: fork pull request from a second account; `neutral` vs `failure` under a required check |
| CP-0017 Spike A | partly done (L-0030) | deferred by the Owner to before alpha.1: a security-key signature; replies and spot checks run in alpha.1 |
| CP-0002 licence and schema host | **decided** (L-0031): Apache-2.0 code, CC BY 4.0 text, `$id` on GitHub Pages | publish the schemas to GitHub Pages at the first release (CI §9) |
| CP-0015 kernel and every contract | **next** | a capable model: Part I of `kit/TENET.md`; all eight fields for every alpha.1, alpha.2 and 0.1.0 packet; the R-009 cases; freeze |
| CP-0058 medium-model trial | after CP-0015 | a capable model runs it with two medium-model sessions and scores them |
| CP-0001 ratify | after CP-0058 | the Owner, one sitting |
| CP-0003 bootstrap, then waves A0-1 onward | after CP-0001 and CP-0002 | medium-effort models, each from its build contract; a capable model reviews each; the Owner approves per wave |
| Sandbox | `vedprakash-m/tenet-sandbox` (private) exists | used by CP-0051 and later proving |

## 1. Milestones

| ID | Release | Packets | Build gate (automatic; publishes the snapshot) | Status |
|---|---|---|---|---|
| M0 | — | CP-0001–0003, CP-0015, CP-0017, CP-0040, CP-0041, CP-0056, CP-0058 | The ready-for-pilot checklist holds; the Owner signs `vision.md` v1 and approves the specifications, at named versions and digests | in progress |
| M1 | 0.1.0-alpha.0 | CP-0004, CP-0005, CP-0006, CP-0009, CP-0010, CP-0012, CP-0018, CP-0044, CP-0045, CP-0048, CP-0051, CP-0052, CP-0053, CP-0054, CP-0057 | First findings in ≤10 minutes on the fixture repositories; the onboarding evaluation (≥90% kept and recalled, none invented, ALG-13) and the scenario suite pass; the fresh-session check passes; the packed artifact installs and runs both UX Part 1 journeys on three platforms; this repository passes its own `tenet check` | not started |
| M1 | 0.1.0-alpha.1 | CP-0049, CP-0007, CP-0050, CP-0019, CP-0008 | A **backtest** over 100 past pull requests (this repository, Torus and one public repository) shows under 2 false blocks per 100 and under 2 minutes of record overhead per change; alpha.0 golden records still read | not started |
| M1 | 0.1.0-alpha.2 | CP-0042, CP-0046, CP-0021 | Red-team cases pass at their levels; the sandbox repository runs the signed path end to end, including CI §10's `failure` outcomes | not started |
| M1 | 0.1.0 | CP-0022, CP-0056, CP-0020, CP-0055, CP-0013, CP-0014, CP-0024 | Quick start passes on three platforms; the reference runner takes a careful change to a pull request in the sandbox repository, stopping only for the approval, with two host adapters (or one plus `command`); both jobs run on a real repository | not started |
| M1 | 0.1.x | See [plan/0.1.x.md](plan/0.1.x.md) | Each point release: its packets' proving and the red-team suite | not started |

**Evidence track** (never blocks building; gates announcement and horizon claims):

| Evidence | Gates | Owner |
|---|---|---|
| Two outside maintainers complete both journeys unaided (CP-0016) | announcing alpha.0 | the Owner |
| This repository closes ≥3 verified changes | announcing alpha.2 | the Owner |
| This repository and Torus each close ≥5 verified changes, ≥2 careful (CP-0014) | announcing 0.1.0 | the Owner |
| Interviews, the decision-reconstruction exercise, Torus baselines (CP-0016) | V-H1 and the M2 entry | the Owner |
| The external pilot and V-H1's thresholds (CP-0023) | claiming V-H1 | the Owner |

**Scope freeze** (DEC-38). Until the checklist below holds, no new catalog entries or packets are added except splits of existing packets; new ideas become `idea` rows. Every M0 packet has a time box in hours; it is a limit, not a duration: running over it means stop and escalate. Until alpha.0, this repository keeps packets light and hand-writes `now.md`.

**Ready-for-pilot checklist.**
1. The four spike results are in the ledger (L-0030), and the specifications are updated to match; the Owner-only checks listed in §0 are done or accepted as open.
2. The kernel (Part I) is written within 8,000 tokens and cross-checked against the specifications; `kit/TENET.md`'s old text is archived.
3. Every change from L-0013 to L-0030 is applied.
4. The contracts for **every** release (the tech-spec parts and all release parts, all eight fields) are frozen.
5. **Medium-model trial (CP-0058):** in a scratch repository, two fresh sessions of a medium-effort model each build CP-0018 and CP-0044's pure functions (`parseDoc`, `parseRequirement`, `sectionDigest`, `resolveCitations`, `flags`) from their contracts alone, against stubs of CP-0005's exports. A scorer who did not run them logs every rule they had to invent; each is fixed in the specification, and the trial repeats until nothing is invented.
6. `blocked_by` in every `packet.yaml` matches §2, with no cycles (checked by script).
7. Every example in the README, UX spec and tech-spec parts (YAML, cards, acceptance blocks, tags, commands) parses under the contracts, checked by a scratch script that becomes `npm run check:examples` in CP-0003.
8. The red-team list matches the guarantee table.

Then reviews are of running software.

**Stop or change course.**
- If alpha.0 doesn't cut Owner minutes per agent pull request, or outside maintainers can't adopt it unaided: narrow the first adopter or the entry point.
- If CP-0040 finds no working signature or protected store: fall back to a separate evidence repository, labelled detected.
- If CP-0040 rejects the `workflow_run` recorder: one job posts the card and writes records only on `push` (ci.md).
- If record overhead stays above 2 minutes per quick change: re-slice.
- If pilots fall short on kept, recall or invented commitments: draft only observed and documented statements until the evaluation suite passes.

Every release ends with a retrospective that removes any rule whose cost exceeds its benefit.

## 2. Waves

Packets in one wave can be built side by side; each needs every earlier wave it names. `blocked_by` in each `packet.yaml` is the authoritative copy of this table.

| Wave | Packets | Needs |
|---|---|---|
| M0-1 | CP-0017, CP-0040, CP-0041, CP-0056, CP-0002, all at once; CP-0016 runs on the evidence track | — |
| M0-2 | CP-0015 kernel and every contract | CP-0017, CP-0040, CP-0041, CP-0056 |
| M0-3 | CP-0058 medium-model trial | CP-0015 |
| M0-4 | CP-0001 ratify | CP-0058 |
| M0-5 | CP-0003 bootstrap (may start while the trial runs) | CP-0001, CP-0002 |
| A0-1 | CP-0004 schemas · CP-0005 CLI and packaging | CP-0003 |
| A0-2 | CP-0012 kit content · CP-0006 policy · CP-0018 reports and acceptance | CP-0004 (CP-0006 also CP-0005; CP-0018: CP-0005 only) |
| A0-3 | CP-0044 specification formats, after the full CP-0044 trial (§4) | CP-0006 |
| A0-4 | CP-0009 check · CP-0045 context and MCP · CP-0053 specification board | CP-0044 (CP-0053 also CP-0018) |
| A0-5 | CP-0048 onboarding inventory · CP-0051 test job, recorder and card · CP-0054 this repository's specifications, prepared | CP-0048: CP-0009, CP-0012, CP-0018; CP-0051: CP-0006, CP-0009, CP-0018; CP-0054: CP-0009 |
| A0-6 | CP-0010 init, upgrade, remove | CP-0045, CP-0048, CP-0051 |
| A0-7 | CP-0052 blessing, evaluation and scenarios | CP-0010 |
| A0-8 | CP-0057 this repository's specifications, blessed → alpha.0 release | CP-0052, CP-0054 (the release also needs CP-0053) |
| A1 | CP-0049 → CP-0007 → CP-0050 → CP-0019 and CP-0008 | alpha.0 |
| A2 | CP-0042 → CP-0046 → CP-0021 | alpha.1 |
| GA | CP-0022 → CP-0020 → CP-0055 → CP-0013 → CP-0024 (CP-0014 runs on the evidence track) | alpha.2 |

## 3. M0 packets

### CP-0017, CP-0040, CP-0041, CP-0056 · experiment · Four feasibility spikes (first, at once)

Each is Quick, limited to **4 hours** of work, and run by a capable model. Each runs on the sandbox repository (`vedprakash-m/tenet-sandbox`) or locally on Windows, macOS and Linux, and ends in L-0030 naming what worked, what needs the Owner, and the specification changes. Spike D (CP-0056) moved here from GA so nothing later waits on it. **Stop rule:** if a hypothesis fails, record the fallback and its guarantee level; never extend the box.

- **CP-0017 · Spike A: identity and decisions.** Run on the first adopter's real setup.
  1. Presence can be read from a security-key `ssh-keygen -Y` signature, and signed decisions survive squash, rebase and a shallow clone.
  2. The recorder reads a native review approval and a `/tenet pick` reply bound to the evaluation the latest card showed. A reply after the commit, the acceptance block or an implemented requirement changed is refused.
  3. A pull request opened by the Owner's account can't be approved by it; one opened by a bot can.
  4. An agent using the Owner's session to reply `/tenet approve` is caught by the spot checks.
  5. A decision request's identity (its question, options and the evaluation shown) survives two pending requests and a late reply.

  *Fallback:* forge decisions are shown as detected.
- **CP-0040 · Spike B: the CI shape, signed evidence and records.**
  1. The rendered workflows, as published, run: the test job and `workflow_run` recorder work on a private repository, a fork pull request, two pull requests sharing a head, a same-commit description edit, a closed unmerged pull request, a retried run that changes result, and an older run finishing last; at `verify`, branch protection keeps a merge blocked on every `failure` of ci.md §10. Deliver the **event table**: for each event, the trigger, actor, token permissions, writer, record, idempotency key, retry and degraded result.
  2. The existing-CI step works on a console-only job (with the reporter edit), a service job and a two-shard matrix; artifacts from `tenet-bundle/` upload and merge.
  3. Signing: an Ed25519 key in a CI secret (`node:crypto`) for private repositories, and a public signing service for public ones, are confirmed as defaults or replaced.
  4. Five concurrent writers to the records ref and the evidence ref lose nothing.
  5. A sealed test job with network denied and no shared cache can't poison the attest job.
  6. Find which plans can require the status.

  *Fallback:* one job writing records on `push`; a store only the attest job can write.
- **CP-0041 · Spike C: events, reports and performance.**
  1. Events with `prev` arrays reduce identically in every arrival order (ALG-05).
  2. 10,000 event files reduce within R-082 on Windows.
  3. The ALG-08 readers and case matching handle real `node:test`, vitest, jest, pytest and Go reports, including retries, entities, parameterized tests, a declaration missing from discovery, a missing shard and a teardown failure.

  *Fallback:* compaction (tier 2) from 0.1.0.

### CP-0015 · spec · Kernel and contract freeze

- **Lane:** careful · **Needs:** CP-0017, CP-0040, CP-0041, CP-0056 · **Limit:** 12 hours · run by a capable model.
- **Do:**
  1. Write Part I of `kit/TENET.md` from the spike results in at most 8,000 tokens, rules in prose with provisional IDs: the spec process (PRD §4.0), then the kernel (tech spec §3–§7). Archive the old text.
  2. Update the specifications with the spike results, including CP-0040's event table in ci.md.
  3. Write all eight fields for every alpha.1, alpha.2 and 0.1.0 packet, covering the lists those parts carry, then freeze every contract (checklist item 4); CP-0058 then tries them.
  4. Write the four reference cases (R-009: a library with unobservable installs, a regional rollback, a migration with a point of no return, an ML change with no code change) with their expected decisions, and run them through Part I.
  5. Migrate this repository's `tenet.yaml` to the current schema, with the Owner's approval.
  6. Fix the kit defects:
     - correct the Spotify precedent from its source
     - remove the local govaut path
     - add `agent` as an escalation level
     - add the `factory` packet type
- **Done when:** Part I is within budget with IDs on every "must"; a cross-check table shows Part I and the specifications agree; the four reference cases give their expected decisions.

### CP-0058 · experiment · Medium-model trial

- **Needs:** CP-0015 · **Limit:** 6 hours · **Do:** checklist item 5. **Done when:** two fresh sessions invent nothing and their machine results match byte for byte; the scorer's log is in the ledger.

### CP-0016 · experiment · Problem validation and baselines (alongside M1)

- **Do:**
  - Run 5 interviews with maintainers who delegate real changes to agents, at least one outside application code. Cover:
    - where their intent lives, how it reaches their agents and how stale it gets
    - whether they would bless a machine-drafted specification and how long they would read it
  - Run the **decision-reconstruction exercise** (R-075).
  - Replay 10 Torus changes for baselines; record Torus's health indicators.
  - Recruit the external pilot (OQ-05), and two maintainers unrelated to the steward for the alpha.0 gate.
  - Run the alpha.0 sessions on the release candidate: both UX Part 1 journeys, observed without coaching, recording minutes, commands, blockers and completion; a participant who can't finish blocks the release.
- **Kill or pivot:** if there is no meaningful time or correctness gap, narrow the first adopter or entry point before 0.1.x.
- **Done when:** a ledger entry records findings, baselines and the pilot.

### CP-0001, CP-0002, CP-0003

- **CP-0001 Ratify** (deep, needs CP-0058): the Owner signs the vision v1 and approves the specifications and Part I at named versions and digests, in one sitting with a second read before signing. Signing twice on separate days stays a product feature for adopters at `assure`.
- **CP-0002 Namespace and licence** (quick):
  - Already settled: GitHub home `github.com/vedprakash-m/tenet` and template `vedprakash-m/tenet-starter` (L-0020); npm package `@vedprakash-m/tenet` (L-0022).
  - Decided (L-0031): Apache-2.0 for code, CC BY 4.0 for text (`LICENSE`, `LICENSE-docs`); schema IDs under `https://vedprakash-m.github.io/tenet/schemas/<minor>/`.
- **CP-0003 Bootstrap** (quick, needs CP-0001, CP-0002):
  - `package.json` with the six runtime dependencies, npm workspaces `[".", "runner"]`
  - `tsconfig.json`: `NodeNext`, `ES2023`, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noEmitOnError`
  - Biome for `npm run lint`; `node:test`
  - `test/architecture.test.ts` (the TS §1 import table and dependency list)
  - `npm run check:examples`
  - the licence; CI on three platforms; hooks
  - the sandbox repository `vedprakash-m/tenet-sandbox`

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

Alpha.0 contracts are complete now. CP-0015 writes the rest for every later release before building starts, so no release waits on a design stop; **no packet is dispatched to a builder without all eight**. **Reviews and approvals:** a capable model reviews each packet against its contract as soon as it is built; the Owner approves once per wave, as a batch. Two trials guard the freezes:
- In M0, CP-0058 tries the alpha.0 contracts on stubs.
- Before A0-3, a full CP-0044 trial runs on the real codebase.
- Before alpha.1 is frozen, an **evaluator trial**: two fresh sessions get the same history (a description edit, an expired waiver, a missing tagged test, a policy change) and must produce byte-identical verdicts, dispositions and next actions.

A missing product decision goes back to its owner, never to the builder. Each later part lists what its contracts must cover (L-0027).

## 5. After 0.1.x

| Milestone | Entry conditions |
|---|---|
| M2 (0.2.0) | V-H1 met against its thresholds; the standard pack's stations and the release and operate phases specified; H2's population of transitions and its reconciliation with forge, CI and deployment histories defined before the baseline is taken; one data or infrastructure pilot |
| M3 (0.3.0) | Two engines chosen (OQ-07); engine adapter contract frozen; leases exclusive on one engine |
| M4 (1.0.0) | Two independent implementations agree on every kernel fixture; upgrade migrations specified with H3's denominator (failed and abandoned upgrades counted); the open proposal process drafted |
| M5 (1.x) | Qualification suites for core and reviewer roles; staged release of agents specified; H4's comparison set (task class, model, harness, tools, attempts, cost status) defined before its baseline |
| After 1.0 | V-H5 tracked: implementations from outside the steward, at one conformance level, and subscribing projects |
