# Tenet experience specification

> Level L2 · Version 0.11 · Status: **draft, awaiting the Owner's approval** · Implements [prd.md](prd.md) · Mechanisms: [tech-spec.md](tech-spec.md) and [its onboarding part](tech-spec/onboarding.md) · Budget: 6,000 tokens · Previous version: `archive/specs/ux-spec.md@0.10.md` · Release labels follow [contracts §8](tech-spec/contracts.md#8-commands)

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
Install Tenet with `npm install --global @vedprakash-m/tenet@0.1.0-alpha.0`, run `tenet init --yes` and show me what it wrote.
Then run `tenet onboard`, follow the draft-specs skill, ask me the questions only I can answer,
and open one pull request named "Set up Tenet" with the setup files and the drafted specifications.
```

Commands always name a release, never a branch; each release on GitHub lists `SHA256SUMS`, and the npm package carries provenance. `tenet doctor` shows your version and whether its files match. Nothing is installed by piping a script into a shell.

## Part 1: start here

### 1A. An existing repository

**Step 1 · You (or your agent): run `init`.** About 2 minutes. First it shows what it found and what it will do, and asks once:

```text
$ tenet init
Found: GitHub · npm test (vitest) · npm run lint · CODEOWNERS (3 owners)
       README.md, docs/architecture.md (14 months old), 2 ADRs · Claude Code (skills, MCP)
Will write: tenet.yaml (9 lines; its test check adds JUnit output) · tenet.lock · .github/workflows/tenet.yml
Will edit:  AGENTS.md (a marked block) · .mcp.json (one entry)
Will never read: .env*, credentials, vendor/
Level: observe (nothing blocks). Continue? [Y/n]
✓ Set up · next: tenet onboard drafts your specifications (about 15 minutes of agent time)
```

Every file is listed before it is written, and recorded so `tenet remove` can undo exactly this (Part 4).

**Step 2 · Your agent: draft your specifications.** `tenet onboard` builds an inventory of your project (modules, interfaces, configuration, tests, docs and their age, owners) and hands it to your agent with the `draft-specs` skill. Before drafting, your agent asks you what code can't tell it: what the project is for, who it serves, what it must never do, what matters most. It then drafts five views of your project (vision, requirements, design, experience, plan), as one `tenet/intent.md` for a small project or separate documents for a larger one, and opens one onboarding pull request with the setup files. Nothing in it is in force yet.

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
  Requirements   14 · 9 observed (7 proven by existing tests), 3 documented, 2 inferred   9 min
  Design          8 · all observed                                              6 min
  Experience     undecided: no user-facing docs found · needs you               1 min
  Plan            4 open issues proposed as next work · nothing committed        3 min
→ run tenet bless in your terminal, or edit the files in this pull request first
```

```text
$ tenet bless
Who is blessing? 1. ved  2. priya > 1
Conflict 1 of 1: README says "retried twice"; src/retry.ts:42 and its test retry once.
  1. Retry once is intended (fix the README)  2. Retry twice is intended (the code is a defect)  3. Decide later
> 1
Vision (3 min) · bless / edit / reject / later? bless
Requirements (9 min) · 2 inferred statements must be edited first → opened in your editor
...
✓ 4 sections blessed · 1 for later · README fix added to this pull request · merge when ready
```

Only a person blesses, and only by an explicit act: `tenet bless` in a terminal, or a review action on the pull request from alpha.1. Merging setup files or saying nothing never blesses anything. In the first release a blessing shows who gave it but can't prove it (`self-recorded`); from alpha.1 a review makes it forge-recorded, and from alpha.2 it is signed. Once blessed, a section's text stays in force until you bless a new version: if someone edits it, the edit waits for your blessing; if the code it cites changes, you're asked to review. You can bless some sections now and the rest later; a section left for later stays a draft. Agents treat blessed sections as the source of truth and drafts as hints only. Merge the pull request: proof cards start on the next one.

**Step 4 · You: ask your agent for the next change you needed anyway.** "Fix checkout retries per C-1." Your agent gets the blessed sections that apply (Part 5), writes the code and a test, and opens a pull request listing what it must prove:

```markdown
Checkout retry · Implements: C-1
- [AB-41-1] one retry after a timeout, never two
- [AB-41-2] no retry when the authority check fails
```

*Tenet* posts the proof card as a check on the pull request and updates it on every push:

```markdown
### Tenet proof · 9b41d0 (merge candidate) · advisory
✓ AB-41-1 · test passed on this commit · checkout.retry.test.ts › one retry after timeout
! AB-41-2 · unproven · no test tagged [AB-41-2]
✓ no weakening detected (no tests deleted or skipped) · ✓ no protected files touched
Specs: C-1 (blessed) · Would have blocked: AB-41-2 unproven
```

**Step 5 · You: review and merge** with your forge's normal approve button. That is your first governed change.

*Only want to try proof cards first?* Skip step 2 and merge the setup alone; cards then read "advisory · intent not yet blessed". Run `tenet onboard` whenever you're ready.

### 1B. A new project

**Step 1 · You: create the repository and run `init`.** (From the template, skip to step 3.) `init` asks what you are building and what kind of project it is (service, library, data pipeline, infrastructure, ML system, other), and writes `tenet/intent.md` from that kind's template.

**Step 2 · You: commit the files to the main branch.** There is nothing to review yet.

**Step 3 · You and your agent: write the intent first.** "Run tenet onboard and draft our specifications; ask me what you need." With no code yet, your agent interviews you using the questions for your project's kind, drafts the five views, and opens a pull request. You run `tenet bless`. Your first governed change is the specification itself.

**Step 4 · Your agent: build the first slice.** "Build C-1 and C-2." The pull request also adds the test command to `tenet.yaml`; the card runs it labelled "proposed check · approve tenet.yaml to pin" and asks for your approval, because policy is a protected file. You approve and merge.

## Part 2: the daily loop

**A change.** Ask your agent as you would anyway. It lists acceptance items and tags their tests with the same IDs; `tenet fix` adds missing IDs and links. You never type an ID.

| Card line | Means |
|---|---|
| `test passed on this commit` | A test tagged for this item ran on the exact commit named in the card |
| `failed as expected on the base` | The same test fails without the change (careful and deep lanes) |
| `unproven` | Nothing shows this item holds yet |
| `no weakening detected` | The diff deletes or skips no tests; it doesn't prove every rewrite is equivalent |
| `Specs` | Requirements this change touches, and whether they are blessed |
| `Would have blocked` | What a rule would stop if you turned it on |
| `advisory` | CI produced this without signing it (verified work signs it) |

Editing the acceptance list in the pull request makes the card re-check. Pull requests from forks get the same card as a job summary, because their token can't post a check.

**Review and merge.** Your forge's normal approve button. Working alone, you accept your own changes, labelled `self-accepted`.

**See where things are.** In the first release `tenet board` shows your specifications: what waits for your blessing, what was edited or had its cited code change since you blessed it (the blessed text still applies), and spec debt. Pull requests, decisions and what is blocked join it in alpha.1, with a page view (`tenet board --open`).

```text
$ tenet board
checkout · main 9f3c2e1 · level observe
Waiting for your blessing (2)
  Experience · undecided since onboarding
  Requirements › C-4 · sources changed: src/retry.ts changed after you blessed it; the blessed text still applies
Spec debt (1)
  docs/architecture.md refers to a removed module
```

**Change a specification.** When your agent finds a spec wrong, it proposes the change in the same pull request; the card shows it first and asks whoever must approve it. Approving the review approves it (alpha.1; before then, `tenet bless`).

## Part 3: when you want more

**Turn on rules (alpha.1).** `tenet rules` shows, per rule, what it would have blocked and how often findings were marked not useful (`/tenet not-useful`). `tenet rules enforce tests-not-weakened` makes one block; `tenet level protect` turns on the rules that level recommends.

**Decisions (alpha.1).** Approve the review, or reply `/tenet pick 2` to a decision with options. A reply counts for the commit the latest card showed; if commits landed after that card, you're asked to look again.

**Careful and deep work (0.1.0).** By policy, risky changes (authentication, data, payments) go to the careful or deep lane. Your agent runs `tenet new feature "<title>"`, tests are written by a separate agent, and you approve one definition. Accepting a known shortfall is a waiver with a reason and an expiry.

**Stuck work.** After repeated failures, or when work and a spec disagree, your agent stops and Tenet asks one question: "C-3 says 'never retry', C-1 says 'retry once' · 1. Stop 2. C-3 wins 3. C-1 wins 4. Talk it through".

**Verified work (alpha.2; `assure` in 0.1.x).** `tenet level verify` lists what it needs: a way for CI to sign its proof (automatic on public repositories; one CI secret otherwise), merging that requires the Tenet check (a branch rule; paid plans for private repositories), and an account for your agents. Cards then read `verified on CI`: the record can't be forged or altered; whether the checks were the right ones is still shown under "why". `assure` adds security-key decisions for policy and vision changes, and an external holdout.

## Part 4: keeping Tenet current

```text
$ npm install --global @vedprakash-m/tenet@0.1.0-alpha.1     # the new version; or let your dependency bot bump it
$ tenet upgrade
Tenet 0.1.2 → 0.1.3 · 1 rule clarified, no change for you · new rule tests-not-weakened, starting in observe
✓ tenet.lock updated · AGENTS.md block and skills regenerated · tenet check passes · commit these 3 files
```

An upgrade never changes your level or turns a new rule beyond `observe`; a change to authority, permissions or evidence requirements waits for your decision. If the package and the lock disagree, `tenet check` says "run tenet upgrade". To go back, install the previous version and run `upgrade` again. From M4, CI opens the upgrade pull request on a schedule.

**Remove.** `tenet remove` deletes exactly what `init` recorded: the files it created, the blocks it added to existing files, and its host entries. Your specifications and records stay. If a branch rule requires the Tenet check, it tells you to remove that rule too.

## Part 5: the agent's side

The `AGENTS.md` block (under 1,500 tokens) is a short map: where the specifications are, which the agent may change (builders change none above L3, and propose a change instead), how to get context, what a pull request must list, what never to do, how to stop.

```text
$ tenet context --paths src/retry.ts        # agents usually call this through MCP
Blessed: C-1 (cites src/retry.ts:40-48; sources changed since blessing, the blessed text still applies, payments can change it) · C-2 (cites src/retry.ts:51)
Draft (hint only): Experience
Index of other requirements: 12 titles · lane quick · rules: tests-not-weakened (advise)
```

Context is chosen by the paths a task touches (through each requirement's citations), the IDs it names, and an index the agent scans itself; Tenet says why it chose each section.

| Host can | What you get |
|---|---|
| Open pull requests | Proof cards (any engine) |
| Read `AGENTS.md` | The map and the rules |
| Load skills | `draft-specs`, work a change, review with findings |
| Use MCP | `context`, `check`, `status` and proposals as tools |
| Enforce writes (a host binding, 0.1.x) | Protected files refused before they are written |

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
✗ Gateway dispatch can't merge yet: AB-41-2 has no test that fails without the fix
  why: a fix is proven by a test that fails before it (R-172, enforced in the careful lane)
→ add a test tagged [AB-41-2], or ask for a waiver
```

### The full board (alpha.1)

`tenet board --all` and the page view add: decisions and reviews waiting; conflicts; every change by phase with its next actor, evidence, strength and cost; campaigns; per area its owner, waivers, promises and health (0.1.x); flow with sample sizes; outcomes; each specification's version, state and budget; escalations and recent ledger entries. Every view states what it was computed from.

### Wording

| Use | Not |
|---|---|
| specification, spec; spec change; draft, blessed, edited, sources changed | doc, requirements file; approved draft, stale |
| bless (a person makes a section the source of truth) | accept, sign off, ratify (for sections) |
| change, pull request, packet (careful and deep work) | ticket, story |
| proven on this commit; verified change; accepted; delivered | done, completed, shipped |
| the Owner, decision-maker | the user, the human, the admin |
| waiting for you; stop and escalate | pending approval; fail, abort |
| level: observe, protect, verify, assure; lanes: express, quick, careful, deep; work type: explore | mode, tier, profile; standard lane |
| proof card | report, receipt |
| enforced, detected, advisory | secure, guaranteed, safe |
| waiver (an accepted shortfall, with expiry) | exception, bypass |
| promise; health indicator; campaign; lease | legacy requirement; quality score; batch; lock |
| standard, pack; factory only for a running system | framework, methodology |
