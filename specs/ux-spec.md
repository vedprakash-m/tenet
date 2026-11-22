# Tenet experience specification

> Level L2 · Version 0.1 · Status: **draft, awaiting the Owner's approval** · Implements [prd.md](prd.md) · Mechanisms: [tech-spec.md](tech-spec.md)

## 1. Principles

| ID | Principle | In practice |
|---|---|---|
| UX-1 | **Say what is true, then what to do** | Every result line states the fact; every failure ends with the next command |
| UX-2 | **Plain words** | "stale" not "invalidated"; "waiting for you" not "pending Owner action" |
| UX-3 | **The same answer for people and agents** | Human output and `--json` carry the same facts; nothing is only in one |
| UX-4 | **Quiet when fine** | A passing command prints one line; detail appears only on failure or with `--verbose` |
| UX-5 | **No surprises in the repository** | Every write is listed; nothing outside generated blocks is changed without being named first |
| UX-6 | **The Owner's time is the scarcest resource** | Owner decisions are collected in one queue, each with options and a recommended choice |

## 2. Output conventions

- **Symbols:** `✓` pass, `✗` fail, `!` warning, `·` separator, `→` next action. With `NO_COLOR` or a non-UTF-8 terminal: `ok`, `FAIL`, `warn`, `|`, `->`.
- **Colour:** green pass, red fail, yellow warning, dim for detail. Meaning never depends on colour alone.
- **Width:** wraps at the terminal width, minimum 60 columns; tables truncate titles with `…`, never IDs.
- **Paths:** relative to the project root, with forward slashes on every platform.
- **Times:** ages as `6h`, `1d`, `2w`; absolute times in the Owner's local time zone in human output and UTC in JSON.

### 2.1 A successful command

```text
$ tenet move CP-0042 verify
✓ CP-0042 build → verify · 5 of 5 tasks done · 7 commits
```

### 2.2 A refused move

```text
$ tenet move CP-0042 review
✗ CP-0042 cannot leave verify: 2 of 4 conditions unmet

  ✓ lint            pass · fresh
  ✓ types           pass · fresh
  ✗ unit            stale · candidate changed since 09:12 (5b77a0 → 8c01d2)
  ✗ acceptance-basis no receipt

→ tenet receipt CP-0042 --check unit -- npm test
→ tenet receipt CP-0042 --check acceptance-basis -- npm run test:acceptance
```

### 2.3 Errors

Every error has three parts: what failed, where, and the fix.

```text
✗ packets/CP-0042-gateway-dispatch/packet.yaml:14 TN-4-4 history was edited, not appended
  Line 14 changed from "to: build" to "to: verify".
→ Restore the line with `git checkout -- packets/CP-0042-gateway-dispatch/packet.yaml` and use `tenet move`.
```

## 3. Onboarding

### 3.1 `tenet init`

Six questions, each with a default in brackets; `--yes` accepts all defaults.

```text
$ npx tenet init
Tenet 0.1.0 · a standard for governed, spec-driven software factories

1. Project name [torus]:
2. Owner (a name, not an email) [Ved]:
3. Does this project deploy something that runs? (y/n) [y]:
4. Default lane for new work (quick/standard/deep) [standard]:
5. Which agent host will you use first? (none/claude-code/copilot/conductor) [none]:
6. Keep Tenet updated automatically? (renovate/dependabot/no) [renovate]:

Writing 23 files:
  tenet.yaml · tenet.lock · .tenet/kit/ (61 files) · vision.md · specs/ (5 files)
  AGENTS.md (new) · CLAUDE.md (import line added) · .githooks/ (2) · .github/workflows/tenet.yml
  renovate.json · packets/CP-0001-adopt-tenet/

✓ Tenet initialized at adoption step 1 (packets and board)

Next:
  1. Write your vision:      open vision.md (about 30 minutes; the template asks the questions)
  2. Add your first change:  tenet new feature "<title>"
  3. See the floor:          tenet board
```

### 3.2 `tenet adopt`

As `init`, plus:

```text
Existing files kept as they are: README.md, src/ (214 files), tests/ (88 files)
Skipped (already exists): AGENTS.md has no Tenet block → block appended at the end

Drafted for you to correct and sign:
  vision.md        from README.md headings "Why", "Goals"      ! unsigned draft
  specs/prd.md     4 sections from docs/, all requirements marked built and unmapped

Imported 12 open issues as packets at intake: CP-0002 … CP-0013

✓ Tenet adopted at step 1. Nothing in your code changed.
→ Read vision.md and correct it; it is the one document only you can own.
```

## 4. The board

`now.md` is the Owner's home page. Order, top to bottom:

1. **Waiting for you** (the Owner queue): each item with the question, its options, a recommended option, and its age. Items older than `owner_queue_alert_days` are marked `!`.
2. **Floor:** the board text block (standard §7.1).
3. **Vision scorecard:** each horizon and metric with current value, target and trend arrow.
4. **Escalations:** open, with level and age.
5. **Flow:** throughput, lead time by lane, flow efficiency, first-pass yield.
6. **Recently closed:** last 7 days with endpoints.
7. **Ledger index:** last 10 entries.

### 4.1 Owner queue item

```markdown
### ! CP-0016 · Commit · Gateway retry budget · waiting 3d
Appetite 6 agent-hours · Standard · serves V-M7 · definition ready (8 of 8)
Options:
  A. Commit as shaped (recommended: within appetite, no L1 change)
  B. Commit with a smaller appetite (4 h): drop the jitter requirement R-118
  C. Return to Shape with a question
→ tenet move CP-0016 design            (A)
→ tenet move CP-0016 shape --reason "…" (C)
```

### 4.2 `now.html`

A single static file, no scripts required to read it, the same sections as `now.md`. Columns stack below 600 px wide so the floor reads on a phone. Light and dark themes follow the system setting.

## 5. Human gates

When a loop reaches a human gate, `tenet` writes an Owner queue item and, in an interactive terminal, prompts:

```text
CP-0042 · review · round 3 of 3 · not converged
  Open: 0 blockers · 2 majors · 3 minors    Bar for Standard: 0 blockers, ≤1 major

  F-0042-04 major  src/gateway/dispatch.ts:88  retry ignores the authority recheck
  F-0042-06 major  tests/gateway/…:12          no boundary example for budget = 0

Choose:
  1. Stop                     nothing is approved; the packet waits
  2. Revise                   up to 3 more rounds against the same baseline
  3. Accept with findings     only minors and notes may remain open; majors need a reason each
  4. Amend the baseline       opens a spec packet; this packet waits for it
[1]:
```

The default is always Stop. Option 3 is disabled while a blocker is open and says why.

## 6. Upgrade pull request

The CI check writes the pull request body:

```markdown
## Tenet 0.3.0 → 0.4.0 · auto

**What changes for this project**
- 2 schema fields added (optional): `packet.yaml` `intent_kind`; `tenet.yaml` `heartbeat_minutes`
- 1 rule clarified: TN-6-2 receipts with zero tests are inconclusive (no behavior change for you)
- Reference agent `judge` 3.1.0 → 3.2.0: instructions only; tools and paths unchanged
- Regenerated: AGENTS.md block, .claude/agents/judge.md

**Checks**
✓ conformance step 1–3 · ✓ tenet check · ✓ overlays still narrow

**Why this can merge automatically:** minor version; no permission, gate or severity change.
Packet: CP-0051 · Changelog: <link>
```

For `owner-review` and `major`, the heading says so and a section **Needs your decision** lists each item with its consequence.

## 7. Agent-facing experience

Agents read the same files people read. The generated `AGENTS.md` block tells an agent, in this order: what Tenet is in one paragraph; where the rules are (`.tenet/kit/standard/TENET.md`); how to find its assignment; the commands it may run; what it must never do; how to stop and escalate. Under 60 lines.

Every command that refuses an agent prints the rule ID, so the agent can read the rule rather than retry.

## 8. Wording

| Use | Not |
|---|---|
| change, packet (in technical text) | ticket, story, task (a task is part of a packet) |
| the Owner | the user, the human, the admin |
| stale | expired, invalid |
| waiting for you | pending approval |
| stop and escalate | fail, abort |
| checked, delivered (endpoint names) | done, complete |
| standard | framework, methodology |
| factory | (only for a running system, never for Tenet itself) |
