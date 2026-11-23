# Tenet experience specification

> Level L2 · Version 0.13 · Status: **draft, awaiting the Owner's approval** · Implements [prd.md](prd.md) · Mechanisms: [tech-spec.md](tech-spec.md) and [its onboarding part](tech-spec/onboarding.md) · Budget: 6,000 tokens · Previous version: `archive/specs/ux-spec.md@0.12.md` · Release labels follow [contracts §8](tech-spec/contracts.md#8-commands)

**Context card.** What using Tenet is like. **Part 0:** get Tenet. **Part 1:** pick your starting point, an existing repository or a new project, and follow its steps. Both end with specifications you have read and blessed, and the same daily loop (Part 2). Part 3 is what you add when you choose to; Part 4 is keeping Tenet current; Part 5 is the agent's side; Part 6 is the reference. Every feature is labelled with the release it arrives in; unlabelled means the first release, 0.1.0-alpha.0.

**Who acts.** *You* are the Owner (or anyone with decision rights). *Your agent* is the coding agent you already use. *Tenet* is the command on your machine and the workflow it adds to CI. Tenet never calls a model: when something is drafted, your agent drafts it.

## Part 0: get Tenet

No account, no service, no server: Tenet is a command, a CI workflow and a few files in your repository. Home: [github.com/vedprakash-m/tenet](https://github.com/vedprakash-m/tenet).

**What you need.** Git; a GitHub repository with Actions enabled (other forges later); Node 22 or later wherever the command or your agent runs. Standalone downloads without Node arrive in 0.1.x.

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

Commands always name a release, never a branch; each release on GitHub lists `SHA256SUMS`, and the npm package carries provenance. `tenet doctor` shows your version and whether its files match. Nothing is installed by piping a script into a shell.

## Part 1: start here

### 1A. An existing repository

**Step 1 · You (or your agent): run `init`.** About 2 minutes. First it shows what it found and what it will do, and asks once:

```text
$ tenet init
Found: GitHub · vitest, run by your CI job "test" · CODEOWNERS (3 owners)
       README.md, docs/architecture.md (14 months old), 2 ADRs · Claude Code (skills, MCP)
Will write: tenet.yaml (9 lines) · tenet.lock · .github/workflows/tenet.yml (posts the card)
Will edit:  .github/workflows/ci.yml (one Tenet step after your tests) · AGENTS.md ·
            .github/pull_request_template.md · .gitignore · .mcp.json (marked blocks or one entry)
Will never read: .env*, credentials, vendor/
Level: observe (nothing blocks). Continue? [Y/n]
✓ Set up
First findings: docs/architecture.md links 2 missing files · 3 skipped tests
→ next: tenet onboard drafts your specifications (about 15 minutes of agent time)
```

Every file is listed before it is written, and recorded so `tenet remove` can undo exactly this (Part 4).

**Step 2 · Your agent: draft your specifications.** `tenet onboard` builds an inventory of your project (modules, interfaces, configuration, tests, docs and their age, owners) and hands it to your agent with the `draft-specs` skill. Before drafting, your agent asks you what code can't tell it: what the project is for, who it serves, what it must never do, what matters most. It then drafts five views of your project (vision, requirements, design, experience, plan), one part of the codebase at a time, as one `tenet/intent.md` for a small project or separate documents for a larger one, and opens one onboarding pull request with the setup files. Nothing in it is in force yet.

Every statement says where it came from: *observed* in code or tests (with the file and line, or the test), *documented* (with the doc section), *asked* (your answer) or *inferred* (flagged). Where sources disagree, the draft lists the conflict instead of choosing. Where nothing tells it, it writes "undecided, needs you". Drafting reads your code through your agent and its model provider; `tenet onboard --inventory-only` stops before that.

**Step 3 · You: read and bless.** `tenet onboard` writes this card into the onboarding pull request's description (CI cards start once the setup is merged):

```markdown
### Tenet onboarding · drafted from 7c3e1a · nothing is in force until you bless it
Read: README.md, docs/architecture.md, 2 ADRs, 214 source files, 88 tests · Skipped: .env*, vendor/
✓ all 41 citations checked against the code
Conflicts (settle these first)
  ! README says "retried twice"; src/retry.ts:42 and its test retry once. Which is intended?
Sections (about 25 minutes)
  Vision          6 statements · 5 asked, 1 documented                          3 min
  Requirements   14 · 9 observed (7 cite tests), 3 documented, 2 inferred     9 min
  Design          8 · all observed                                              6 min
  Experience     undecided: no user-facing docs found · needs you               1 min
  Plan            4 open issues proposed as next work · nothing committed        3 min
→ gh pr checkout 12, then tenet bless in your terminal (or edit the files first)
```

```text
$ tenet bless
Who is blessing? 1. ved  2. priya > 1
Conflict 1 of 1: README says "retried twice"; src/retry.ts:42 and its test retry once.
  1. Retry once is intended (the README is wrong)  2. Retry twice (the code is a defect)  3. Decide later
> 1
Vision (3 min) · bless / edit / reject / later? bless
Requirements (9 min) · 2 inferred statements must be edited first → opened in your editor
...
✓ 4 sections blessed · 1 for later
→ git add tenet/ && git commit -m "Bless specifications" && git push · then merge
```

Only a person blesses, and only by an explicit act: `tenet bless` in a terminal, or a review action on the pull request from alpha.1. Merging setup files or saying nothing never blesses anything. Settling a conflict records your answer; fixing the README is an ordinary change you ask your agent for. In the first release a blessing shows who gave it but can't prove it (a recorded blessing), so every card lists the blessings its pull request changes and who committed them; from alpha.1 a review makes it forge-attributed, and from alpha.2 it is signed. A blessing sets what is in force; whether it was the right intent stays your judgment. Once blessed, a section's text stays in force until you bless a new version: if someone edits it, the edit waits for your blessing; if the code it cites changes, you're asked to review, and `tenet bless` shows the change beside the text so you can confirm it with one key. You can bless some sections now and the rest later; a section left for later stays a draft. Agents treat blessed sections as the source of truth and drafts as hints only. Merge the pull request: proof cards start on the next one.

**Step 4 · You: ask your agent for the next change you needed anyway.** "Fix checkout retries per C-1." Your agent gets the blessed sections that apply (Part 5), writes the code and a test, and opens a pull request listing what it must prove:

```markdown
Fix checkout retries.

## Acceptance
Implements: C-1
- [AB-1] one retry after a timeout, never two
- [AB-2] no retry when the authority check fails
```

*Tenet* posts the proof card as a check on the pull request and updates it on every push:

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

**Step 5 · You: review and merge** with your forge's normal approve button. That is your first governed change.

*Only want to try proof cards first?* Skip step 2 and merge the setup alone; cards then read "advisory · intent not yet blessed". Run `tenet onboard` whenever you're ready.

### 1B. A new project

**Step 1 · You: create the repository and run `init`.** (From the template, skip to step 3.) `init` asks what you are building and what kind of project it is (service, library, data pipeline, infrastructure, ML system, other), and writes `tenet/intent.md` from that kind's template.

**Step 2 · You: commit the files to the main branch.** There is nothing to review yet.

**Step 3 · You and your agent: write the intent first.** "Run tenet onboard and draft our specifications; ask me what you need." With no code yet, your agent interviews you using the questions for your project's kind, drafts the five views, and opens a pull request. You run `tenet bless`. Your first governed change is the specification itself.

**Step 4 · Your agent: build the first slice.** "Build C-1 and C-2." The pull request also adds the test command to `tenet.yaml`; the card runs it labelled "proposed check · approve tenet.yaml to pin" and asks for your approval, because policy is a protected file. You approve and merge.

## Part 2: the daily loop

**A change.** Ask your agent as you would anyway. It numbers acceptance items (`AB-1`, `AB-2`) and tags their tests with the same IDs; you never type an ID. If you write a description yourself, the card says which items lack one.

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

Editing the description makes the card re-check without rerunning tests. Pull requests from forks get the same card. A tagged test counts only if this pull request added the tag, so an old test can't stand in for a new item.

**Review and merge.** Your forge's normal approve button. Working alone, you accept your own changes; the board shows them as `self-accepted` (alpha.1).

**See where things are.** In the first release `tenet board` shows your specifications: what waits for your blessing, what was edited or had its cited code change since you blessed it (the blessed text still applies), and spec debt. Pull requests, decisions and what is blocked join it in alpha.1, with a page view (`tenet board --open`).

```text
$ tenet board
checkout · main 9f3c2e1 · level observe
Waiting for your blessing (1)
  Experience · undecided since onboarding
Sources changed (1)
  Requirements › C-4 · src/retry.ts changed after you blessed it; the blessed text still applies
Spec debt (1)
  Design cites src/legacy/queue.ts, which no longer exists
```

**Change a specification.** When your agent finds a spec wrong, it proposes the change in the same pull request; the card shows it with the requirements it touches and asks whoever must approve it. Approving the review approves it (alpha.1; before then, `tenet bless`).

## Part 3: when you want more

**Turn on rules (alpha.1).** `tenet rules` shows, per rule, what it would have blocked and how often findings were marked not useful (`/tenet not-useful`). `tenet rules enforce tests-not-weakened` makes one block; `tenet level protect` turns on the rules that level recommends. At `protect` a rule stops honest mistakes; a pull request that changes Tenet's own workflow is flagged on the card, and full enforcement starts at `verify`.

**Decisions (alpha.1).** Approve the review, or reply `/tenet pick 2` to a decision with options. A reply counts for what the latest card showed (its commit, acceptance list and the blessed text it implements); if any of that changed, you're asked to look again.

**Careful and deep work (0.1.0).** By policy, risky changes (authentication, data, payments) go to the careful or deep lane. Run `tenet new feature "<title>"`, then `tenet-runner start <id>` (the optional runner, installed like Tenet): the shaper drafts the definition and stops for your one approval; a separate test writer writes the tests, the builder works until they pass, the judge reviews, and a pull request arrives with its card. Prefer your own agent or factory? It takes the same steps from `tenet_next`. Accepting a known shortfall is a waiver with a reason and an expiry.

**Stuck work.** After repeated failures (by default, a card failing three times in a row), or when work and a spec disagree, your agent stops and Tenet asks one question: "C-3 says 'never retry', C-1 says 'retry once' · 1. Stop 2. C-3 wins 3. C-1 wins 4. Talk it through".

**Verified work (alpha.2; `assure` in 0.1.x).** `tenet level verify` lists what it needs: a way for CI to sign its proof (automatic on public repositories; one CI secret otherwise), merging that requires the Tenet check (a branch rule; paid plans for private repositories), and an account for your agents. Cards then read `verified on CI`: the record can't be forged or altered; whether the checks were the right ones is still shown under "why". `assure` adds security-key decisions for policy and vision changes, and an external holdout.

## Part 4: keeping Tenet current

```text
$ npm install --global @vedprakash-m/tenet@0.1.0-alpha.1     # the new version; or let your dependency bot bump it
$ tenet upgrade
Tenet 0.1.0-alpha.0 → 0.1.0-alpha.1 · 1 rule clarified, no change for you · new rule stop-threshold, starting in observe
✓ tenet.lock updated · AGENTS.md block, workflows and skills regenerated · tenet check passes · commit these files
```

An upgrade never changes your level or turns a new rule beyond `observe`; a change to authority, permissions or evidence requirements waits for your decision. If the package and the lock disagree, `tenet check` says "run tenet upgrade". To go back, install the previous version and run `upgrade` again. From M4, CI opens the upgrade pull request on a schedule.

**Remove.** `tenet remove` deletes exactly what `init` recorded: the files it created, the blocks it added to existing files, and its host entries. Your specifications and records stay. If a branch rule requires the Tenet check, it tells you to remove that rule too.

## Part 5: the agent's side

The `AGENTS.md` block (under 1,500 tokens; its exact text is in [tech-spec/agents.md](tech-spec/agents.md)) is a short map: where the specifications are, which the agent may change (builders change none above L3, and propose a change instead), how to get context, what a pull request must list, working rules you can replace, what never to do, how to stop.

```text
$ tenet context --paths src/retry.ts --include-drafts   # agents usually call this through MCP
Blessed: C-1 (cites src/retry.ts:40-48; sources changed since blessing, the blessed text still applies, payments can change it) · C-2 (cites src/retry.ts:51)
Draft (hint only): Experience
Global: C-9 never store card numbers · index of other requirements: 12 titles · omitted: none
Rules: tests-not-weakened (advise)
```

Context always starts with your global rules, then what the task's paths touch (through citations and each section's `applies_to`) and the IDs it names, then an index the agent scans itself; Tenet says why it chose each section and lists anything it left out.

| Host can | What you get |
|---|---|
| Open pull requests | Proof cards (any engine) |
| Read `AGENTS.md` | The map and the rules |
| Load skills | `draft-specs`, work a change, review with findings |
| Use MCP | `context`, `check`, `status` and proposals as tools |
| Enforce writes (a host binding, 0.1.x) | Protected files refused before they are written |
| Run headless | Tenet's runner (0.1.0) chains the shipped agents through it, step by step, up to your approvals; a factory platform can do the same through the adapter contract |

`init` shows what it detected for your host.

## Part 6: reference

### Principles

| ID | Principle | In practice |
|---|---|---|
| UX-1 | **Say what is true, then what to do** | Every result states the fact and the next step |
| UX-2 | **Plain words** | "stale", not "invalidated"; "waiting for you", not "pending Owner action" |
| UX-3 | **One answer everywhere** | Terminal, `--json`, the card and `board.json` carry the same facts |
| UX-4 | **Quiet when fine** | One line on success; detail on failure or with `--verbose` |
| UX-5 | **No surprises in the repository** | Every write is listed before it happens, and recorded for removal |
| UX-6 | **People's time is the scarcest resource** | One queue; conflicts and inferred statements first; reading times shown |
| UX-7 | **Never overstate** | Every result names its method; "why" shows what it rests on |
| UX-8 | **Users see their own words** | Specifications, acceptance items, approvals; kernel terms stay in implementer docs |
| UX-9 | **The tool does the bookkeeping** | People never type IDs, digests, trailers or status |
| UX-10 | **Advise before blocking** | A rule blocks only after the project turns it on |
| UX-11 | **Weight follows stakes** | A typo needs only its pull request; a migration gets the full ladder |
| UX-12 | **Value in ten minutes** | A first useful finding within ten minutes, tested every release |
| UX-13 | **Every refusal teaches** | The fact, why the rule exists, the fix; the rule ID last |
| UX-14 | **Drafts are never truth** | Nothing drafted is in force until a person blesses it |

### How output looks

- `✓` pass, `✗` fail, `!` warning, `→` next step (`ok`, `FAIL`, `warn`, `->` with `NO_COLOR`); colour never carries meaning alone; minimum width 60 columns.
- One badge per result: `verified on CI`, `advisory`, `self-accepted`, `intent not yet blessed`, `tentative`. Under "why" and `--verbose`: `[enforced]`, `[detected]`, `[advisory]`; decision proof (`person present`, `forge-verified`, `key`, `channel`); who produced evidence (`by builder`, `independent`).
- Relative paths with forward slashes; ages as `6h`, `1d`; local times for people, UTC in JSON. With no terminal or `--yes`, nothing prompts, and `tenet bless` refuses: blessing needs a person.

```text
✗ Gateway dispatch can't merge yet: AB-2 has no test that fails without the fix
  why: a fix needs a test that distinguishes the base from the change (R-172, enforced in the careful lane)
→ add a test tagged [AB-2], or ask for a waiver
```

### The full board (alpha.1)

`tenet board --all` and the page view add: decisions and reviews waiting; conflicts; every change by phase with its next actor, evidence, strength and cost; campaigns; per area its owner, waivers, promises and health (0.1.x); flow with sample sizes; outcomes; each specification's version, state and budget; escalations and recent ledger entries. Every view states what it was computed from.

### Wording

| Use | Not |
|---|---|
| specification, spec; spec change; draft, blessed, edited, sources changed | doc, requirements file; approved draft, stale |
| bless (a person makes a section the source of truth) | accept, sign off, ratify (for sections) |
| change, pull request, packet (careful and deep work) | ticket, story |
| test passed on this commit; verified change; accepted; delivered | done, completed, shipped, proven |
| the Owner, decision-maker | the user, the human, the admin |
| waiting for you; stop and escalate | pending approval; fail, abort |
| level: observe, protect, verify, assure; lanes: express, quick, careful, deep; work type: explore | mode, tier, profile; standard lane |
| proof card | report, receipt |
| enforced, detected, advisory | secure, guaranteed, safe |
| waiver (an accepted shortfall, with expiry) | exception, bypass |
| promise; health indicator; campaign; lease | legacy requirement; quality score; batch; lock |
| standard, pack; factory only for a running system | framework, methodology |
