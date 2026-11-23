# Tenet experience specification

> Level L2 · Version 0.5 · Status: **draft, awaiting the Owner's approval** · Implements [prd.md](prd.md) · Mechanisms: [tech-spec.md](tech-spec.md) · Budget: 10,000 tokens

**Context card.** How Tenet speaks to people, agents and dashboards. Every view answers the same questions about a change: what it is, what is proven and how strongly, what is unknown, what it cost, and who may act next.

## 1. Principles

| ID | Principle | In practice |
|---|---|---|
| UX-1 | **Say what is true, then what to do** | Every result states the fact; every refusal ends with the next command and who can run it |
| UX-2 | **Plain words** | "stale" not "invalidated"; "waiting for you" not "pending Owner action" |
| UX-3 | **One answer for people, agents and dashboards** | Human output, `--json` and `board.json` carry the same facts |
| UX-4 | **Quiet when fine** | A passing command prints one line; detail on failure or with `--verbose` |
| UX-5 | **No surprises in the repository** | Every write is listed; optional integrations are offered one by one |
| UX-6 | **People's time is the scarcest resource** | Decisions sit in one queue with subject, options, recommendation and deadline |
| UX-7 | **Never overstate** | Every claim shows its strength and, where it matters, the assumptions behind it |

## 2. Output conventions

- **Symbols:** `✓` pass, `✗` fail, `!` warning, `·` separator, `→` next action; `ok`, `FAIL`, `warn`, `|`, `->` without UTF-8 or with `NO_COLOR`.
- **Colour** never carries meaning alone. **Width** wraps at the terminal, minimum 60 columns; IDs are never truncated.
- **Paths** are relative with forward slashes. **Times**: ages as `6h`, `1d`; absolute times local for people, UTC in JSON.
- **Strength tags:** `[enforced]`, `[enforced if: <assumption>]`, `[detected]`, `[advisory]`; decisions add their proof: `[person present]`, `[forge-verified]`, `[key]` or `[channel]`; formal evidence adds its strength: `[trials]`, `[bounded]`, `[proved in model]`, `[matches model: sampled | proved]`, `[observed]`.
- **Non-interactive:** with no terminal or with `--yes`, commands never prompt.

### 2.1 A successful command

```text
$ tenet move CP-7f3a2q verify
✓ CP-7f3a2q build → verify · 5 of 5 tasks done · CI will verify on push
```

### 2.2 A refused move

```text
$ tenet move CP-7f3a2q integrate
✗ CP-7f3a2q cannot leave verify: 2 of 4 conditions unmet

  ✓ lint            pass · fresh · CI
  ✓ types           pass · fresh · CI
  ✗ unit            stale · code changed since 09:12 (5b77a0 → 8c01d2)
  ✗ unit baseline   no distinguishing result for R-112

→ push the branch; the CI verifier reruns unit on the new code
→ quick local look (advisory only): tenet receipt CP-7f3a2q --check unit
```

### 2.3 Errors

What failed, where, and a fix that never discards unrelated work.

```text
✗ tenet/packets/CP-7f3a2q-gateway-dispatch/events/01JDX4….json TN-EV-2 an existing event was modified
  Field data.to changed from "build" to "verify".
→ Restore only this file: git restore --source=HEAD -- tenet/packets/CP-7f3a2q-gateway-dispatch/events/01JDX4….json
  Then record the move you meant: tenet move CP-7f3a2q verify
```

## 3. Onboarding

### 3.1 `tenet init`

```text
$ npx tenet init
Tenet 0.1.0 · the decision and evidence layer for software factories

1. Project name [torus]:
2. Decision-maker id and name [ved · Ved]:
3. Lifecycle pack (minimal / path) [minimal]:
4. Which commands does CI run for your checks?
   unit: command [npm test]   report file (JUnit or CTRF) [reports/junit.xml]:
   lint: command [npm run lint]   report file [none]:
   Add another? [n]:

Base files (always):
  tenet.yaml · tenet.lock · .tenet/kit/ (52 files) · AGENTS.md (block added)
  tenet/vision.md · tenet/specs/ (4 templates) · tenet/packets/CP-k2m9qd-adopt-tenet/

Optional integrations:
  a. CI verifier workflow (two jobs)          needed for verified work           [Y/n]
  b. Decisions on pull requests (forge-verified)   uses ved's GitHub account; needs two-factor authentication  [Y/n]
     ✓ github:ved listed for owner ved · organization enforces two-factor authentication
  c. Security key for policy decisions            needed only for change-policy, widen-permission, amend-vision  [y/N]
  d. Git hooks                                     early warnings                      [Y/n]

✓ Tenet initialized · pack minimal

Readiness
  ✓ ready for advisory work
  ✗ ready for verified work, missing:
     · protect the evidence store and require the "tenet attest" status (a GitHub ruleset; the steps are in docs/verified-setup.md)
     · first CI run, which records whether these protections hold
→ tenet doctor shows this list at any time
→ first change: tenet new feature "<title>"
```

Without a security key, everyday decisions still count (`[forge-verified]`); `init` says: "Changes to policy, permissions or the vision will wait until you add a security key." Without either, decisions are recorded as `[key]` and count as advisory.

### 3.2 `tenet adopt` (0.1.x)

```text
Existing files kept as they are: README.md, src/ (214 files), tests/ (88 files)
AGENTS.md has no Tenet block → block appended at the end

Imported 12 open issues as packets at intake (each keeps a link to its issue).
Discovery packet written for your coding agent:
  tenet/packets/CP-q8w2ex-discover-existing-behavior/
  It proposes a vision draft, reported capabilities and possible contradictions for you to confirm.
  Nothing it finds is marked built.

✓ Tenet adopted. Nothing in your code changed.
```

### 3.3 Express (0.1.x)

```text
$ git commit -m "Fix typo in retry log message" -m "Tenet-Express: Fix retry log typo"
$ git push origin tenet/fix-retry-typo
# CI attest job:
✓ express granted CP-3nd8vk · 1 file, 2 lines · unit pass · checked
# after the pull request merges, the main-branch run:
✓ CP-3nd8vk integrated · closed (integrated)
```

```text
! CP-3nd8vk express not granted: touches src/auth/ (denied path) → quick packet at define
```

## 4. The board

`board.json` is the read model; `now.md` renders it; any dashboard reads the same file and must show the same facts. Sections, top to bottom:

1. **Waiting for you**: the decision queue (§5), oldest first, past-deadline items marked `!`; then the **review queue** with age against its limit.
2. **Conflicts**: packets with incompatible concurrent moves and the decision that resolves them.
3. **Floor**: one table per phase of the pack (phases come from `board.json`), each row with alias, title, station, status, branch, age, next actor, evidence (`3/4 fresh`), replay label, strength and cost. Rows stack below 80 columns.
4. **Campaigns**: each with its denominator and counts (automated, manual, unresolved, excluded), failure clusters and cost per target.
5. **Areas, promises and health**: per area, its owner, work in progress, readiness gaps, quarantined checks with their expiry, and four answers: which promises (built requirements) apply, which have lost their evidence, what changed since the health baseline, and who owns the response. A required failure stays visible even when every other check passes.
6. **Flow**: verified changes per week by lane (express separate), lead time median and 85th percentile, work in progress against limits, decision wait, cost per outcome with its source, autonomy share beside escapes; each with its sample size.
7. **Outcomes**: observed outcome status per region or cohort (`recovered`, `partial`, `no-change`, `insufficient-exposure`, `unknown`).
8. **Vision scorecard**: horizons and the nine headline metrics; "not measured yet" where it applies.
9. **Escalations**, **recently closed** (7 days), **ledger index** (last 10).

Every view carries `as of 2026-11-22 14:05 · main 9f3c2e1 · 4 packet branches · evidence 51d0aa7`. The trust line sits under the title: `trust assumptions observed 2d ago: all hold` or `not observed: CI guarantees shown as detected`.

### 4.1 A floor row

```text
CP-7f3a2q  Gateway dispatch with authority recheck  verify · active · tenet/CP-7f3a2q-gateway-dispatch · 1d
           next: CI verifier (unit stale) · evidence 3/4 · justified · [enforced] · $4.10 measured
```

A move made without the evidence its gate needs shows `pending evidence` until CI records it, or `unjustified` (red) if the gate cannot hold.

## 5. Decisions

### 5.1 A decision request

```markdown
### ! D-4h7xa2 · CP-7f3a2q Checkout retry · approve-definition · waiting 3d (deadline today)
Subject: definition file-set 6c1e…  (R-118 changed: one retry, not two; pinned tests 2 files)
Proven: nothing yet (define) · Unknown: whether mobile clients retry on their own
Options:
  1. Stop: nothing is approved; the packet waits
  2. Approve as shaped (recommended: within appetite, no L1 change)
  3. Return with a smaller scope (4 h, without jitter): back to define for a new approval
  4. Return to define with a question
Who may decide: owner, product · Default at deadline: stop
→ tenet decide D-4h7xa2 --choice 2
```

If the definition changes after approval, the board shows `approval stale (definition changed)` and a new request appears.

### 5.2 Answering

```text
On the pull request, ved comments `/tenet decide D-4h7xa2 2` (or approves the review that carries the request):
✓ D-4h7xa2 approve as shaped · ved [forge-verified] · recorded by the attest job

From a terminal, a signed decision is also accepted:
$ tenet decide D-4h7xa2 --choice 2
✓ D-4h7xa2 approve as shaped · signed by ved [key] · committed 1 file · counts once forge-verified or signed with a security key
```

```text
! D-7c0mq1 change-policy signed with an ordinary key [key] · recorded as advisory
  Policy changes need a person-present decision (security key); this packet waits until one is made.
```

### 5.3 A health regression

```markdown
### D-2kq8vn · CP-7f3a2q · accept-health-regression · area payments
Indicator: duplication on touched files · baseline 1.2% → 1.9% · tolerance +0.3%
Reason given: temporary copy during migration; removal tracked by CP-9xw3ra
Options: 1. Stop  2. Accept until CP-9xw3ra closes  3. Return to build
```

### 5.4 Human gates in a loop

A loop that reaches a human gate writes a decision request and stops; nothing waits on a terminal.

```text
CP-7f3a2q · verify · review round 3 of 3 · not converged
  Open: 0 blockers · 2 majors · 3 minors    Bar for standard: 0 blockers, ≤1 major

  F-7f3a2q-04 major  src/gateway/dispatch.ts:88   retry ignores the authority recheck
  F-7f3a2q-06 major  omission: R-118 boundary     no example for budget = 0

Options (D-9p1rz4):
  1. Stop                     nothing is approved; the packet waits
  2. Revise                   2 more rounds; the round count keeps rising
  3. Accept with findings     no blocker is open; give a risk reason for each major
  4. Amend the baseline       opens a spec packet; this packet waits for it
→ tenet decide D-9p1rz4 --choice 3 --risk F-7f3a2q-04="…" --risk F-7f3a2q-06="…"
```

The default is always stop. Option 3 is unavailable while a blocker is open, while the review is `incomplete`, or when the protected set changed, and says why. A review that is `incomplete` shows its invalid findings and asks for a new round or a person's adjudication.

## 6. Upgrade pull request (M4)

```markdown
## Tenet 0.3.0 → 0.4.0 · needs review (minor below 1.0)

**What changes for this project**
- 2 optional schema fields; 1 rule clarified (TN-EV-4, no behavior change for you)
- Reference agent `judge` 0.3.1 → 0.4.0: instructions only; inactive until it passes its activation test here
- Regenerated: AGENTS.md block

**Checks** ✓ conformance · ✓ tenet check · ✓ overlays still narrow

**Why this waits:** below 1.0 every minor version is reviewed.
```

## 7. Agent-facing experience

The generated `AGENTS.md` block (under 1,500 tokens) says, in order: what Tenet is in one paragraph; where the rules and records are; how to find an assignment and which skill to load; the commands an agent may run; that agents propose and Tenet applies, and that rules come from the target branch; what never to do; how to stop and escalate.

- Skills are short (under 1,500 tokens each) and loaded only when an assignment calls for them.
- Assignments point to sections and stay within the context budget.
- Every refusal prints the rule ID and next command.
- The board never echoes an agent's claim as fact: "agent reports done" is shown apart from "checked", and `tests by builder` is shown where it applies.

## 8. Wording

| Use | Not |
|---|---|
| change, packet | ticket, story; a task is part of a packet |
| verified change (endpoint ≥ checked) | done, completed, shipped |
| accepted (a person accepted it); delivered (an outcome was observed) | used loosely for verified |
| the Owner, decision-maker | the user, the human, the admin |
| stale, pending evidence, unjustified | expired, invalid |
| waiting for you | pending approval |
| stop and escalate | fail, abort |
| enforced, detected, advisory; person present, forge-verified, key, channel | secure, guaranteed, safe |
| campaign (one intent, many targets) | batch, bulk job |
| promise, obligation (a built requirement that must keep holding) | legacy requirement |
| health indicator, ratchet | quality score |
| standard, pack | framework, methodology |
| factory | only for a running system, never for Tenet itself |
