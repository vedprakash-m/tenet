---
tenet: {spec: 1, doc: ux-spec, level: L2, version: "0.13", owner: ved}
sections:
  _preamble: {state: draft, digest: sha256:caefd4ed3b03bc8a46272886e7afaaad147177db6fd59c206aef7b3732d130b4, flags: []}
  part-0-get-tenet: {state: draft, digest: sha256:9b8dd29eadb5615e6764c5318068b20bfba80cf70c8681989f48f5a563831728, flags: []}
  part-1-start-here: {state: draft, digest: sha256:e8e663bd3c11f9c9383c8ee838ff3a20f0ce4e0add41510117c7384e7e864b1b, flags: []}
  part-2-the-daily-loop: {state: draft, digest: sha256:a032dea20e6dab7c1507f20efe84724c80b52bdae538dadba6246d3aceba4984, flags: []}
  part-3-when-you-want-more: {state: draft, digest: sha256:4ef2b427a1050bb147af23731961557ebda8825815b7076fcf57146bf045a75a, flags: []}
  part-4-keeping-tenet-current: {state: draft, digest: sha256:18b766dd5353867e0413ef076f4fcf8191d39eb8568a58019fb59c6cc791a66a, flags: []}
  part-5-the-agents-side: {state: draft, digest: sha256:2806567daf1eff601904629e0e24acfda02c989737b19320424a9799443e774d, flags: []}
  part-6-reference: {state: draft, digest: sha256:bc0bbbdc46af8aaa669aaa0c90676ff5b558f4643e1e2e906990475c83c65988, flags: []}
---
# Tenet experience specification

> L2 · Version 0.13 · Draft · [PRD](prd.md) · [Tech spec](tech-spec.md) and [onboarding](tech-spec/onboarding.md) · Budget: 6,000 tokens · Previous: `archive/specs/ux-spec.md@0.12.md` · Release labels follow [contracts §8](tech-spec/contracts.md#8-commands)

**Context card.** Get Tenet (Part 0), follow a repository to blessed specs (Part 1), and use the daily loop (Part 2). Parts 3–6 cover optional controls, upkeep, agent and reference. Unlabelled features ship in 0.1.0-alpha.0.

**Who acts.** You are the Owner or decision-maker. Your agent drafts. Tenet is the local CLI and CI workflow; it never calls a model.

## Part 0: get Tenet

No account/service/server. Tenet is a command, CI workflow and repository files. Home: [github.com/vedprakash-m/tenet](https://github.com/vedprakash-m/tenet).

**What you need.** Git, GitHub Actions and Node 22 or later wherever Tenet or your agent runs. Standalone downloads arrive in 0.1.x.

| Way in | Do this |
|---|---|
| **Your coding agent (recommended)** | Open it in your repository and paste the prompt below. It installs Tenet, drafts your specifications and opens one pull request for you to review |
| The command | `npm install --global @vedprakash-m/tenet@0.1.0-alpha.0`, then `tenet init` in your repository (in a Node project you may instead run `npm install --save-dev @vedprakash-m/tenet@0.1.0-alpha.0` and use `npx tenet init`) |
| A new project on GitHub | **Use this template** on [vedprakash-m/tenet-starter](https://github.com/vedprakash-m/tenet-starter), clone it, and continue at 1B step 3 |

```text
Install Tenet with `npm install --global @vedprakash-m/tenet@0.1.0-alpha.0` (if that fails on permissions, use
`npx -y @vedprakash-m/tenet@0.1.0-alpha.0` wherever I say `tenet`), run `tenet init --yes` and show me what it wrote.
Then run `tenet onboard`, follow the draft-specs skill, ask me the questions only I can answer,
and open one pull request named "Set up Tenet" with the setup files and the drafted specifications.
```

Commands name releases, never branches. Releases list `SHA256SUMS`; npm packages carry provenance. `tenet doctor` checks version and files. Tenet does not install by piping a script into a shell.

## Part 1: start here

### 1A. An existing repository

**Step 1 · You (or your agent): run `init`.** About 2 minutes. First it shows what it found and what it will do, and asks once:

```text
$ tenet init
Found: GitHub · vitest, run by your CI job "test" · CODEOWNERS (3 owners)
       README.md, docs/architecture.md (14 months old), 2 ADRs · Claude Code (skills, MCP)
Will write: tenet.yaml (9 lines) · tenet.lock · .github/workflows/tenet.yml (posts the card)
Will edit:  .github/workflows/ci.yml (one Tenet step) · AGENTS.md · .github/pull_request_template.md ·
            .gitignore · .gitattributes · .mcp.json (marked blocks or one entry)
Will never read: .env*, credentials, vendor/
Level: observe (nothing blocks). Continue? [Y/n]
✓ Set up
First findings: docs/architecture.md links 2 missing files · 3 skipped tests
→ next: tenet onboard drafts your specifications (about 15 minutes of agent time)
```

Every file is listed and recorded; `tenet remove` can undo it (Part 4). With no detected runner, `init` asks *"What command runs your tests? (blank to skip)"* interactively; `--yes` writes no test check and explains how to add one in `tenet.yaml`.

**Step 2 · Draft.** `tenet onboard` inventories modules, interfaces, configuration, tests, docs, ages and owners; `draft-specs` drafts from it. It asks purpose, users, never-do rules and priorities. It drafts vision, requirements, design, experience and plan by codebase part; small projects use `tenet/intent.md`, larger projects use separate documents, and setup stays unblessed.

Each statement names origin: *observed* means cite file and lines, or the test; *documented* means cite the section; *asked* records your answer; *inferred* is flagged. Conflicts stay conflicts; “undecided, needs you” names missing answers. Drafting uses your agent/model; `--inventory-only` stops before drafting.

**Step 3 · You: read and bless.** Commit drafts, run `tenet onboard --card` and paste it into the setup pull request if used. CI cards start after setup merges.

> **Proposal · CP-0066 AB-A8–A10.** Onboarding card wording and next steps.

```markdown
### Tenet onboarding · drafted from 7c3e1a · nothing is in force until you bless it
Read: README.md, docs/architecture.md, 2 ADRs, 214 source files, 88 test files, 0 instruction files · Skipped: .env*, vendored files
✓ 41 citations resolve (file and lines exist)
Conflicts (settle these first)
  ! CF-1 README says "retried twice"; src/retry.ts:42 and its test retry once. Which is intended?
Open questions (1)
  ! Q-1 Which retry failures should we show to the shopper?
Sections (about 22 minutes)
  Vision · 6 statements · 5 asked, 1 documented · 3 min
  Requirements · 14 statements · 3 documented, 9 observed, 2 inferred · 9 min
  Design · 8 statements · 8 observed · 6 min
  Experience · 1 statement · 1 unlabelled · 1 min
  Plan · 4 statements · 4 asked · 3 min
Updated the draft revision in:
  tenet/vision.md
  tenet/specs/prd.md
Commit these files with the setup changes.
→ Commit your changes, then rerun tenet onboard --card.
```

The card lists any files it stamped on this run. It omits the conflicts and open-questions headings when their lists are empty. Its last line uses the first matching state below.

| Local state | Last line |
|---|---|
| Changes to commit with `--pr 12` | `→ Commit your changes, then rerun tenet onboard --card --pr 12.` |
| Changes to commit | `→ Commit your changes, then rerun tenet onboard --card.` |
| Clean tree with `--pr 12` | `→ gh pr checkout 12, then tenet bless in your terminal (or edit the files first)` |
| Clean branch without an upstream | `→ Push this branch to set its upstream, or run tenet bless locally.` |
| Clean branch with an upstream, without a supplied pull request number | `→ Open a pull request, or run tenet bless locally.` |
| Detached HEAD with a clean tree, without a supplied pull request number | `→ Switch to a branch before opening a pull request, or run tenet bless locally.` |

For partially resolved citations, the count of citations that resolve comes first, then `! <count> of <total> citations need attention` and the findings. Tenet uses the supplied pull request number and local Git state.

> **Proposal · CP-0066 AB-A1–A5.** Blessing session.

```text
$ tenet bless
Who is blessing? 1. ved (Enter) >
Conflict CF-1: README says "retried twice"; src/retry.ts:42 and its test retry once.
  1. Retry once is intended
  2. Retry twice
  3. Decide later
> 1
Does this choice contradict a drafted statement? Enter one of R-1, or type no > no
Vision (3 min) · bless / edit / reject / defer? bless
Question Q-1: Which retry failures should we show to the shopper?
  1. Answer
  2. Not a blocker
  3. Skip section
> 3
Skipping Requirements · open items: Q-1
...
Blessed 4 of 5 sections
→ git add -- "tenet" && git commit -m "Bless specifications"
```

Only a person blesses explicitly, via `tenet bless` or review from alpha.1. Merge or silence never blesses. A conflict answer is recorded; your agent fixes the README normally. Alpha.0 records the person without proof and lists changed blessings and committers. Alpha.1 adds review attribution and alpha.2 signing. Blessing sets truth; correctness remains your judgment. A blessed section stays binding until replacement is blessed. Cited code changes show a diff for confirmation. Bless piecemeal; unblessed sections are hints. Merge setup for proof cards.

**Step 4 · You: ask your agent for the next change you needed anyway.** "Fix checkout retries per C-1." Your agent gets the blessed sections that apply (Part 5), writes the code and a test, and opens a pull request listing what it must prove:

```markdown
Fix checkout retries.

## Acceptance
Implements: C-1
- [AB-1] one retry after a timeout, never two
- [AB-2] no retry when the authority check fails
```

*Tenet* posts and updates the proof card on the pull request:

```markdown
### Tenet proof · 9b41d0 (merge candidate) · advisory
Your intent this change touches
  C-1 blessed · "A payment that times out is retried once, never twice" · implements · 2 tagged tests passed
  C-4 blessed · may be affected (same area)
Acceptance
  ✓ AB-1 · test passed on this commit · written in this change · checkout.retry.test.ts › [AB-1] one retry after timeout
  ! AB-2 · no test · nothing tagged [AB-2]
Tests 214 passed · ✓ no weakening detected by these checks · ✓ no protected files touched
Would have blocked: AB-2 has no test
```

**Step 5 · You: review and merge** with the forge's normal approve button. This is your first governed change.

*Only trying proof cards?* Skip step 2 and merge setup alone. Cards read "advisory · intent not yet blessed". Run `tenet onboard` later.

### 1B. A new project

**Step 1 · Create and run `init`.** From the template, skip to step 3. `init` asks purpose and kind (service, library, data pipeline, infrastructure, ML system, other), then writes `tenet/intent.md`.

**Step 2 · You: commit to main.** Nothing needs review.

**Step 3 · Write the intent.** "Run tenet onboard and draft our specifications; ask me what you need." The agent interviews, drafts five views and opens a pull request. Run `tenet bless`; this first change is the specification.

**Step 4 · Build the first slice.** "Build C-1 and C-2." The pull request adds the test command to `tenet.yaml`; the card labels it "proposed check · approve tenet.yaml to pin" because policy is protected. You approve and merge.

## Part 2: the daily loop

**A change.** Ask normally. The agent numbers acceptance items (`AB-1`, `AB-2`) and tags tests; you never type an ID. Descriptions name missing items.

| Card line | Means |
|---|---|
| `Your intent this change touches` | Blessed requirements it implements, whose cited code it changes, or that sit in the same area (may be affected) |
| `test passed on this commit` | Every test tagged for this item ran and passed on the exact commit named in the card |
| `written in this change` | Those tests came with the change itself: judge whether they really show the item (`tag added here` means an existing test was newly tagged) |
| `coverage not confirmed` | Tagged results passed, but Tenet couldn't match them to every tagged test |
| `failed as expected on the base` | The same test fails without the change (careful and deep lanes) |
| `not run` | Tests are tagged for this item, but not all of them ran |
| `no test` | Nothing is tagged for this item |
| `no weakening detected` | The diff deletes or skips no tests by these checks; it doesn't prove every rewrite is equivalent |
| `Would have blocked` | What a rule would stop if you turned it on |
| `advisory` | CI produced this without signing it (verified work signs it) |

Editing a description re-checks the card without rerunning tests. Fork pull requests get the same card. A tagged test counts only if this pull request added it. Run `tenet verify --local` before pushing.

**Review and merge.** Use the forge's approve button. Working alone, accept your changes; the board marks `self-accepted` (alpha.1).

**See where things are.** In 0.1.0, `tenet board` shows waiting blessings, edits, cited sources changed since blessing (blessed text still applies), and spec debt. Alpha.1 adds pull requests, decisions, blockers and `tenet board --open`.

> **Proposal · CP-0066 AB-A11.** Group visible sections by file. The header names the checked-out branch and commit. Nonempty status counts share one line. Under a section with open items, show `    Open conflicts: CF-1, CF-2` and `    Open questions: Q-1` when applicable.

```text
$ tenet board
checkout · main 9f3c2e1 · level observe
Waiting for your blessing (1) · Sources changed (1)
tenet/specs/prd.md
  Requirements › C-4 · src/retry.ts changed after you blessed it; the blessed text still applies
tenet/specs/ux-spec.md
  Experience · undecided since onboarding
Spec debt (1)
  Design cites src/legacy/queue.ts, which no longer exists
```

**Change a specification.** When an agent finds a wrong spec, it proposes the change in the same pull request; the card shows touched requirements and asks approvers (alpha.1 via review; before then, `tenet bless`).

## Part 3: when you want more

**Turn on rules (alpha.1).** `tenet rules` shows possible blocks and `/tenet not-useful` rates. `tenet rules enforce tests-not-weakened` blocks that rule; `tenet level protect` enables protect defaults. At `protect`, rules stop honest mistakes and workflow edits flag the card; `verify` adds full enforcement.

**Decisions (alpha.1).** Approve the review or reply `/tenet pick 2`. Replies bind the latest card's commit, acceptance list and blessed text; changes ask you again.

**Careful and deep work (0.1.0).** Policy routes risky changes (for example authentication, data, payments) to careful or deep lanes. Run `tenet new feature "<title>"` and `tenet-runner start <id>`: shaper drafts and stops for approval; test writer adds tests, builder satisfies them, judge reviews, and PR opens with its card. Or use `tenet_next`. Shortfalls need a dated waiver with reason.

**Stuck work.** After repeated failures (three in a row by default), or when work and spec disagree, the agent stops and Tenet asks: "C-3 says 'never retry', C-1 says 'retry once' · 1. Stop 2. C-3 wins 3. C-1 wins 4. Talk it through".

**Verified work (alpha.2; `assure` in 0.1.x).** `tenet level verify` needs CI signing (automatic publicly; one secret otherwise), Tenet in branch protection (paid for private repos), and an agent account. Cards read `verified on CI`; "why" shows check adequacy. `assure` adds key decisions and an external holdout.

## Part 4: keeping Tenet current

```text
$ npm install --global @vedprakash-m/tenet@0.1.0-alpha.1     # the new version; or let your dependency bot bump it
$ tenet upgrade
Tenet 0.1.0-alpha.0 → 0.1.0-alpha.1 · 1 rule clarified, no change for you · new rule stop-threshold, starting in observe
✓ tenet.lock updated · AGENTS.md block, workflows and skills regenerated · tenet check passes · commit these files
```

An upgrade never changes level or turns a rule beyond `observe`; authority, permissions or evidence changes wait for decision. If the package and lock disagree, `tenet check` says "run tenet upgrade". To go back, install the previous version and run `upgrade`. From M4, CI opens the scheduled upgrade pull request.

**Remove.** `tenet remove` deletes exactly what `init` recorded: created files, added blocks and host entries. Specifications and records stay. If branch protection requires Tenet, it tells you to remove that rule.

## Part 5: the agent's side

The [`AGENTS.md` block](tech-spec/agents.md) is under 1,500 tokens. It locates specs and explains context, pull requests, rules, prohibitions and stopping. Builders only propose changes above L3.

```text
$ tenet context --paths src/retry.ts --include-drafts   # agents usually call this through MCP
Blessed: C-1 (cites src/retry.ts:40-48; sources changed since blessing, the blessed text still applies, payments can change it) · C-2 (cites src/retry.ts:51)
Draft (hint only): Experience
Global: C-9 never store card numbers · index of other requirements: 12 titles · omitted: none
Rules: tests-not-weakened (advise)
```

Context always starts with global rules. It then uses named IDs and path matches (citations and `applies_to`) and an index; Tenet says why sections were chosen and what was omitted.

| Host can | What you get |
|---|---|
| Open pull requests | Proof cards |
| Read `AGENTS.md` | Map and rules |
| Load skills | `draft-specs`, `work-a-change`, `review-with-findings` |
| Use MCP | `context`, `check`, `status`, proposals |
| Enforce writes (0.1.x) | Refuse protected writes |
| Run headless | Runner chains agents to approvals; factories use the adapter |

`init` shows what it detected for your host.

## Part 6: reference

### Principles

| UX ID | Principle | In practice |
|---|---|---|
| UX-1 | **Say truth, act** | Fact, next step |
| UX-2 | **Plain words** | "stale" not "invalidated"; "waiting" not "pending action" |
| UX-3 | **One answer everywhere** | Terminal, `--json`, card and `board.json` carry the same facts |
| UX-4 | **Quiet when fine** | One success line; detail on failure or verbose |
| UX-5 | **No surprises** | List and record writes for removal |
| UX-6 | **Time is scarcest** | Conflicts/inferred first; reading times |
| UX-7 | **Never overstate** | Name method; "why" names basis |
| UX-8 | **User words** | Specs, acceptance, approvals; kernel terms stay in docs |
| UX-9 | **Tool records bookkeeping** | No typed IDs/digests/trailers/status |
| UX-10 | **Advise before blocking** | Block only after project enables rule |
| UX-11 | **Weight follows stakes** | Typo: one PR; migration: full ladder |
| UX-12 | **Value in ten minutes** | First finding in ten minutes, tested each release |
| UX-13 | **Refusals teach** | Fact, reason, fix, rule ID last |
| UX-14 | **Drafts are never truth** | Not in force until blessed |

### How output looks

- `✓` pass, `✗` fail, `!` warning, `→` next (`ok`, `FAIL`, `warn`, `->` with `NO_COLOR`); colour never carries meaning alone; width at least 60.
- One badge per result: `verified on CI`, `advisory`, `self-accepted`, `intent not yet blessed`, `tentative`. Under "why"/`--verbose`: `[enforced]`, `[detected]`, `[advisory]`; proof (`person present`, `forge-verified`, `key`, `channel`) and source (`by builder`, `independent`).
- Forward-slash paths; ages `6h`, `1d`; local times, UTC in JSON. No terminal/`--yes` prompts; `tenet bless` refuses because blessing needs a person.

```text
✗ Gateway dispatch can't merge yet: AB-2 has no test that fails without the fix
  why: a fix needs a test that distinguishes the base from the change (R-172, enforced in the careful lane)
→ add a test tagged [AB-2], or ask for a waiver
```

### The full board (alpha.1)

`tenet board --all` and the page view add decisions, reviews, conflicts, changes with next actor/evidence/strength/cost, campaigns, area owner/waivers/promises/health (0.1.x), flow samples, outcomes, spec version/state/budget, escalations and ledger entries. Views state source.

### Wording

| Use | Not |
|---|---|
| specification/spec/spec change/draft/blessed/edited/sources changed | doc/requirements file/approved draft/stale |
| bless (person makes section authoritative) | accept/sign off/ratify |
| change/pull request/packet | ticket/story |
| test passed/verified/accepted/delivered | done/completed/shipped/proven |
| Owner/decision-maker | user/human/admin |
| waiting for you; stop and escalate | pending approval/fail/abort |
| level: observe/protect/verify/assure; lanes: express/quick/careful/deep; work: explore | mode/tier/profile; standard lane |
| proof card | report/receipt |
| enforced/detected/advisory | secure/guaranteed/safe |
| waiver (shortfall with expiry) | exception/bypass |
| promise/health/campaign/lease | legacy requirement/quality score/batch/lock |
| standard/pack; factory for running system | framework/methodology |
