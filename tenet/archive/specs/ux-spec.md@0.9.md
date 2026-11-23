# Tenet experience specification

> Level L2 · Version 0.9 · Status: **draft, awaiting the Owner's approval** · Implements [prd.md](prd.md) · Mechanisms: [tech-spec.md](tech-spec.md) · Budget: 6,000 tokens · Previous version: `archive/specs/ux-spec.md@0.7.md` (0.8 was an unreleased draft; rewritten as a journey in L-0017 to L-0019)

**Context card.** What using Tenet is like. **Start with Part 0** (get Tenet), then **Part 1:** pick your starting point, an existing repository or a new project, and follow its steps in order. Both paths end at the same daily loop (Part 2). Part 3 is what you add when you choose to; Part 4 is keeping Tenet current; Part 5 is the agent's side; Part 6 is the reference every screen follows. Releases are noted where a step arrives after the first release (0.1.0-alpha.0).

**Who acts.** *You* are the Owner (or anyone with decision rights). *Your agent* is the coding agent you already use. *Tenet* is the command line on your machine and the workflow it adds to CI. Every step says which of them acts.

## Part 0: get Tenet

There is nothing to sign up for: no account, no service, no server. Tenet is a command and a CI workflow, and it lives in your repository. Its home is [github.com/vedprakash-m/tenet](https://github.com/vedprakash-m/tenet); the npm package name is still open (OQ-01).

**What you need.** Git, and a GitHub repository with Actions enabled (other forges follow the same contract later). For the command: Node 22 or later. Without Node, use the agent route below or, from 0.1.x, a standalone download.

**Pick one way in.** Each takes about a minute.

| You have | Do this |
|---|---|
| A coding agent (the easiest way) | Open it in your repository and paste the prompt below |
| Node 22 | In your repository: `npx github:vedprakash-m/tenet init` (once the npm package is published: `npx tenet init`) |
| A new project on GitHub | On [github.com/vedprakash-m/tenet-starter](https://github.com/vedprakash-m/tenet-starter), click **Use this template**; clone the new repository and continue at 1B step 3 |
| No Node (0.1.x) | Download `tenet` for your system from [the releases page](https://github.com/vedprakash-m/tenet/releases) and run `tenet init` |

The prompt for your agent:

```text
Set up Tenet in this repository: run `npx github:vedprakash-m/tenet init --yes`, show me the files it wrote and why,
then open a pull request named "Add Tenet" with only those files.
```

**Installing from GitHub.** `npx github:vedprakash-m/tenet` runs the latest release tag; add `#v0.1.0-alpha.0` to pin one. npm builds it the first time, which takes about a minute. Once the npm package is published, `npx tenet init` does the same faster.

**Checking what you got.** Every GitHub release lists `SHA256SUMS`, and the npm package carries provenance linking it to that release's build. `tenet doctor` shows the version you have and whether its files match. Tenet never asks you to pipe a script into a shell.

**The GitHub page.** The repository's first screen holds only: what Tenet is, in one sentence; the four ways in above; the files Tenet adds to a repository; how to remove it. Everything else sits below it.

## Part 1: start here

### 1A. An existing repository

**Step 1 · You: run `init` in the repository.** About 3 minutes.

```text
$ cd checkout
$ npx github:vedprakash-m/tenet init
Found: GitHub · npm test (JUnit) · npm run lint · CODEOWNERS (3 owners) · README.md, docs/architecture.md, 2 ADRs
Tenet will write 4 files and link your existing docs as specifications (nothing is copied):
  tenet.yaml (9 lines) · tenet.lock · AGENTS.md (block added) · .github/workflows/tenet.yml
Level: observe (nothing blocks). Continue? [Y/n]
✓ Tenet is set up · next: put these files in a pull request and merge it
```

| File | Why it is there |
|---|---|
| `tenet.yaml` | Your level, who decides, which commands run your checks |
| `tenet.lock` | The exact Tenet version, so CI and every machine agree |
| `AGENTS.md` (a block added) | Tells your agents how to work with Tenet |
| `.github/workflows/tenet.yml` | Posts a proof card on every pull request |

Your agent's skills and the local MCP server entry go wherever its host keeps them. Running `init` again changes nothing.

**Step 2 · You: merge the setup.** About 2 minutes.

```text
$ git switch -c add-tenet
$ git add tenet.yaml tenet.lock AGENTS.md .github/workflows/tenet.yml
$ git commit -m "Add Tenet" && git push -u origin add-tenet
```

Open the pull request and merge it as usual (or ask your agent to). Nothing in your code changed. From now on every pull request gets a proof card.

**Step 3 · You: ask your agent for the next change you needed anyway.** "Fix checkout retries: one retry after a timeout, never two." *Your agent* asks Tenet what applies (Part 5), writes the code and a test, and opens a pull request that lists what it must prove:

```markdown
Checkout retry
Acceptance:
- [AB-1] one retry after a timeout, never two
- [AB-2] no retry when the authority check fails
```

*Tenet* posts the proof card when CI finishes, and updates it on every push:

```markdown
### Tenet proof · 7c3e1a · advisory
✓ AB-1 proven · checkout.retry.test.ts › one retry after timeout (fails without the fix)
! AB-2 unproven · no test tagged [AB-2]
✓ no tests deleted or skipped · ✓ no protected files touched
Would have blocked: AB-2 unproven (careful lane)
```

**Step 4 · You: review and merge with your forge's normal review button.** That is your first governed change. Nothing was blocked; the card told you AB-2 had no test, so you could ask for one before merging.

**Step 5 · You, when you're ready: write intent down.** "Draft `tenet/intent.md` from our README and docs." *Your agent* opens a pull request that changes only that file, with requirements it inferred from code marked `reported`. *Tenet's* card shows "Spec change · needs your approval · 12 requirements, 9 reported from code". You correct and approve. From then on agents get those requirements as context, and each change shows which ones it touches.

Continue with Part 2.

### 1B. A new project

**Step 1 · You: create the repository and run `init`.** About 3 minutes. (If you used the template in Part 0, skip to step 3.)

```text
$ mkdir checkout && cd checkout && git init
  (create the GitHub repository and connect it, your usual way)
$ npx github:vedprakash-m/tenet init
New project. What are you building? one-step checkout for returning customers
Kind (service · library · data pipeline · infrastructure · ML system · other) [service]:
Tenet will write 5 files: tenet.yaml · tenet.lock · AGENTS.md · tenet/intent.md (a template with your purpose) · .github/workflows/tenet.yml
Level: observe (nothing blocks). Continue? [Y/n]
✓ Tenet is set up · next: commit these files, then write the intent with your agent
```

**Step 2 · You: commit the files straight to the main branch.** There is nothing to review yet.

**Step 3 · You and your agent: write the intent first.** "Read `tenet/intent.md` and draft the requirements for the first version. Ask me what you need to know." *Your agent* asks you a few questions and opens a pull request that changes only the intent:

```markdown
# Intent · checkout
Purpose: returning customers pay in one step.
Users: shoppers, support staff.
Never: store card numbers.
## Requirements
- C-1 A payment that times out is retried once, never twice.
- C-2 No retry when the authority check fails.
```

*Tenet's* card: "Spec change · needs your approval · 6 requirements added". You read, correct and approve. Your first governed change is the specification itself.

**Step 4 · Your agent: build the first slice.** "Build C-1 and C-2." *Your agent* sets up the project, a test runner and the first feature, and adds the test command to `tenet.yaml`. The card shows the acceptance items proven, and "tenet.yaml changed: test command added · needs your approval", because policy is a protected file. You approve and merge.

**Step 5 · From here, every change follows the daily loop (Part 2).** When `intent.md` outgrows its budget or gains more owners, `tenet split` proposes separate documents: a vision, product requirements, technical and experience specifications, a plan.

### What you have after either path

Every pull request has a proof card; your agents get the specifications that apply to their task; `tenet board` shows where everything is; nothing blocks until you choose.

## Part 2: the daily loop

**A change.** You ask your agent as you would anyway, naming a requirement if you like ("per C-1"). It lists acceptance items in the pull request and tags their tests with the same IDs. You never type IDs: `tenet fix` adds missing ones.

| Card line | Means |
|---|---|
| `✓ proven` | A test for this item ran on this exact commit and passed, and fails without the change where that matters |
| `! unproven` | Nothing shows this item holds yet |
| Tests deleted or skipped | Whether the change weakened existing checks |
| Specs | The requirements and spec sections this change touches |
| Would have blocked | What a rule would stop if you turned it on (Part 3) |
| `advisory` | CI produced this without signing it; verified work (Part 3) makes it `verified on CI` |

**Review and merge.** Use your forge's normal approve button; Tenet adds no command. Working alone, you accept your own changes, and the board labels them `self-accepted`.

**See where things are.**

```text
$ tenet board
checkout · as of 14:05 · main 9f3c2e1 · level observe
Waiting for you (1)
  ! Checkout retry · approve the definition · 3d, due today → #41
Blocked (1)
  Gateway dispatch · AB-2 has no test · next: the builder agent
Changed since you looked (2)
  ✓ Fix typo in retry log · merged · proven
  ! Docs refer to a removed function · spec debt
→ everything: tenet board --all, or tenet board --open for the page view
```

**Change a specification.** When your agent finds a spec wrong or missing, it proposes the change in the same pull request, and the card shows it first: "Spec change · needs ved's approval · C-1 modified: 'retried twice' → 'retried once, never twice'". Approving the review approves it. A typo or broken link labelled `clarification` needs only review.

## Part 3: when you want more

**Turn on rules (alpha.1).** After a few weeks the board shows what each rule would have done; you enforce the ones that earned it.

```text
$ tenet rules
Rule                  Mode     Last 30 days
tests-not-weakened    advise   would have blocked 2 · marked not useful 0
acceptance-proven     advise   would have blocked 5 · marked not useful 1
→ tenet rules enforce tests-not-weakened
```

An enforced rule fails the pull request's Tenet status and says why (Part 6). Reply `/tenet not-useful` to a finding you disagree with; a rule with too many such marks is flagged for review. `tenet level protect` turns on the rules that level recommends.

**Careful and deep work.** By policy, risky paths and changes (authentication, data, payments) go to the careful or deep lane. Your agent runs `tenet new feature "<title>"`, which adds a short definition beside the pull request, and you get one decision:

```markdown
### ! Checkout retry · approve the definition · waiting 3d (due today)
Changes: C-1 one retry, not two · acceptance AB-1, AB-2 · tests written by a separate agent
Unknown: whether mobile clients retry on their own
Options: 1. Stop (nothing approved)  2. Approve (recommended: within scope)  3. Smaller scope  4. Ask a question
→ approve the review, or reply /tenet pick 2
```

The default at the deadline is stop. If the definition changes after you approve, the request comes back. A reply that arrives within 10 minutes of new commits isn't counted, and you're asked to look again. Accepting a known shortfall is a waiver: it names a reason and an expiry, and the account whose change caused it can't grant it.

**Stuck work.** After repeated failures, or when work and a spec disagree, your agent stops and Tenet raises one question: "Gateway dispatch · stuck after 3 sessions · C-3 says 'never retry', C-1 says 'retry once' · 1. Stop 2. C-3 wins 3. C-1 wins 4. Talk it through".

**Verified work (alpha; `assure` in 0.1.x).**

```text
$ tenet level verify
To verify, Tenet needs:
  ✓ the CI workflow (installed)
  ✗ a way for CI to sign its proof: automatic on public repositories; one CI secret otherwise → tenet doctor shows the steps
  ✗ merging to require the "tenet" status: a branch rule (paid plans for private repositories)
  ! your agents push as ved: give them their own account so your approvals count fully
Until these hold, cards stay "advisory".
```

Verified cards read `verified on CI`, and "why" lists what that rests on and its limits. `assure` adds security-key decisions for policy and vision changes, and an external holdout.

## Part 4: keeping Tenet current

**Update.** About a minute.

```text
$ npx github:vedprakash-m/tenet upgrade      # takes the latest release and updates the lock
Tenet 0.1.2 → 0.1.3
  · 1 rule clarified, no change in behavior for you
  · new rule tests-not-weakened, starting in observe
  · AGENTS.md block and skills regenerated
✓ tenet.lock updated · tenet check passes · commit these 3 files
```

An upgrade never changes your level and never turns a new rule beyond `observe`. A change to authority, permissions or evidence requirements waits for your decision; below 1.0 every minor version waits for review. If you added Tenet as a dev dependency, a dependency bot may bump it; `tenet check` then says "run tenet upgrade". To go back, install the previous version and run `upgrade` again. From M4, CI opens the upgrade pull request on a schedule ("Tenet 0.3.0 → 0.4.0 · needs review · what changes for this project") and runs migrations.

**Remove.** Delete the files `init` listed; your specifications, records and code stay yours. From M2, `tenet eject` does this for you.

## Part 5: the agent's side

The `AGENTS.md` block (under 1,500 tokens) says what Tenet is; where the specifications are and which the agent may change (builders change none above L3, and propose a change instead); how to get context; what to put in a pull request; what never to do; how to stop and escalate.

```text
$ tenet context "fix checkout retries"       # agents usually call this through MCP
Applies: C-1 (tenet/intent.md) · lane quick · rules: tests-not-weakened (advise)
In the pull request: list acceptance items as [AB-n] and tag their tests with the same IDs
Do not change: tenet/intent.md (propose a spec change), tenet.yaml
```

- Skills (under 1,500 tokens each) load only when a task calls for them; context comes in sections, within budget.
- Every refusal gives the reason, the fix and the rule ID.
- The board never shows an agent's statement as fact: "agent reports done" is kept apart from "proven".

## Part 6: reference

### Principles

| ID | Principle | In practice |
|---|---|---|
| UX-1 | **Say what is true, then what to do** | Every result states the fact; every refusal ends with the next step and who can take it |
| UX-2 | **Plain words** | "stale" not "invalidated"; "waiting for you" not "pending Owner action" |
| UX-3 | **One answer everywhere** | Terminal output, `--json`, the proof card and `board.json` carry the same facts |
| UX-4 | **Quiet when fine** | A passing command prints one line; detail on failure or with `--verbose` |
| UX-5 | **No surprises in the repository** | Every write is listed before it happens |
| UX-6 | **People's time is the scarcest resource** | Decisions sit in one queue with options, a recommendation and a deadline |
| UX-7 | **Never overstate** | Every result shows how strongly it holds; "why" shows what that rests on |
| UX-8 | **Users see their own words** | Acceptance items, promises, approvals, waivers; kernel terms stay in implementer docs |
| UX-9 | **The tool does the bookkeeping** | People never type IDs, digests, trailers or status |
| UX-10 | **Advise before blocking** | A rule blocks only after the project turns it on |
| UX-11 | **Weight follows stakes** | A typo needs only its pull request; a migration gets the full ladder |
| UX-12 | **Value in ten minutes** | From the GitHub page, each way in reaches a first useful result in ten minutes, tested every release |
| UX-13 | **Every refusal teaches** | The fact, one sentence on why the rule exists, the fix; the rule ID last |

### How output looks

- `✓` pass, `✗` fail, `!` warning, `→` next step; `ok`, `FAIL`, `warn`, `->` without UTF-8 or with `NO_COLOR`. Colour never carries meaning alone; lines wrap at the terminal, minimum 60 columns.
- One badge per result: `verified on CI`, `advisory`, `self-accepted`, `tentative` (evidence not yet arrived). Under "why" and with `--verbose`: `[enforced]`, `[detected]`, `[advisory]`; decision proof (`person present`, `forge-verified · 2FA enforced`, `key`, `channel`); who produced evidence (`by builder`, `independent`); formal strength (`trials`, `bounded`, `proved in model`).
- Paths are relative with forward slashes; ages read `6h`, `1d`; times are local for people and UTC in JSON. With no terminal or `--yes`, nothing prompts.

A refusal, once a rule is enforced (at `observe` and `advise` the same check prints `! would have blocked`):

```text
✗ Gateway dispatch can't merge yet: AB-2 has no test that fails without the fix
  why: a fix is proven by a test that fails before it (R-172, enforced in the careful lane)
→ add a test tagged [AB-2], or ask for a waiver
```

An error, with a fix that never discards unrelated work:

```text
✗ an existing record was edited: tenet/packets/CP-7f3a2q-gateway-dispatch/events/01JDX4….json
  why: records are append-only, so history can be trusted (TN-EV-2)
→ tenet fix restores it and records the move you meant
```

### The full board

`tenet board --all` and the page view add, in order:
- decisions and reviews waiting, with their age
- conflicts and the decision that settles them
- every change by phase, with its next actor, evidence, strength and cost
- campaigns with their counts
- per area: its owner, open waivers, quarantined checks, promises still holding and health against its baseline (0.1.x)
- flow: verified changes per week by lane, lead time, decision wait, cost with its source, autonomy beside escapes, each with its sample size
- outcomes
- each specification with its version, open changes, coverage and budget
- escalations, recently closed work and the latest ledger entries

Every view states what it was computed from: `as of 14:05 · main 9f3c2e1 · 4 branches`.

### Wording

| Use | Not |
|---|---|
| specification, spec; spec change | doc, requirements file; doc update |
| change, pull request, packet (careful and deep work) | ticket, story |
| proven, verified change; accepted (a person accepted it); delivered (an outcome was observed) | done, completed, shipped |
| the Owner, decision-maker | the user, the human, the admin |
| stale, tentative, unjustified, defeated | expired, invalid, pending |
| waiting for you; stop and escalate | pending approval; fail, abort |
| level: observe, protect, verify, assure; lanes: explore, quick, careful, deep | mode, tier, profile; standard lane |
| proof card | report, receipt |
| enforced, detected, advisory | secure, guaranteed, safe |
| waiver (an accepted shortfall, with expiry) | exception, bypass |
| promise (a built requirement that must keep holding); health indicator | legacy requirement; quality score |
| campaign (one intent, many targets); lease (exclusive hold on a change) | batch, bulk job; claim, lock |
| standard, pack; factory only for a running system | framework, methodology |
