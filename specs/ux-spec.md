# Tenet - UX Specification

> v0.1 | October 18, 2026 | Draft for review | Implements [PRD v0.16](PRD.md) with [Tech Spec v1.0](tech-spec.md)

## 0. About this document

### 0.1 Purpose, precedence and scope

This specification defines **how Tenet feels and reads**: the interaction model, the recurring patterns, the wording, the journeys, configuration, recovery, accessibility and how the experience is qualified. It answers the UX obligations of PRD Section 11.4.

**Precedence:** the PRD owns semantics (what "checked", "authorized" and "supported" mean); the tech spec owns mechanisms. This document owns wording, layout, interaction order and command syntax, and **never changes semantics**: no wording may make a claim stronger, a gate weaker or an authority broader than the kernel records. Where the experience needs a mechanism change, it is listed in §15.2 and stays inactive until the tech spec or PRD adopts it.

**Scope:** R1 is qualified for the technical builder on the PRD Section 2.2 tuple (local TypeScript web/API work in VS Code with Copilot). Later personas and software families (§2, §11) are designed for now, so R1 choices do not foreclose them, but they are not R1 obligations.

### 0.2 Conventions

- **Normative vs illustrative.** Rules, anatomies and size limits are normative. Text in example blocks is illustrative copy: the final strings are tuned in formative sessions (§14) within the rules.
- **Define once, cite by section.** `§n` is this document; "TS §n" is the tech spec; "PRD Section n" is the PRD.
- **Personas are illustrative people** and are referred to with they/them.
- **"Card"** means a predictable presentation pattern rendered with native host controls or ordinary chat text, never a custom UI component.

---

## 1. The experience contract

### 1.1 Promise

> Describe what you want. Tenet works out what "done" means in your own examples, does proportionate engineering, and leaves you with a result you can try, read quickly and trust, plus one clear next step. The project stays an ordinary repository you can maintain without Tenet.

**First value:** install to a real task in about five minutes; a useful result (a checked change, a review, a plan, a diagnosis, or a justified "no change needed") in about fifteen minutes on a ready project (PRD Section 1.6).

### 1.2 The six questions a user can always answer

At any moment, from what is on screen or one `status` away:
1. Did Tenet understand what I want?
2. Is it respecting my project, my edits and my earlier decisions?
3. Is it working, waiting for me, or stopped?
4. What has actually been demonstrated?
5. What is uncertain, missing or not claimed?
6. How do I steer, interrupt, undo, resume or leave?

### 1.3 Principles

| # | Principle | Consequence on screen | Rules out |
|---|---|---|---|
| P1 | **One teammate, one door** | `/tenet <anything>`; one voice, even when specialists ran | Mode menus, agent rosters, "which command?" |
| P2 | **Ask only what changes the next action** (INT-03) | Repository facts are looked up; questions carry a recommendation | Intake forms, "OK to proceed?", repeated questions |
| P3 | **Necessary questions are not friction** | Authority, material changes and consequential ambiguity are always asked | Optimizing safety questions away to look smooth |
| P4 | **Claim first, then proof** | The first line is what is true; then how to try it, what ran, what is not claimed | "Done!", confidence without evidence |
| P5 | **Never surprise the working tree** | Human edits are named and left alone | Silent staging, tidying, committing |
| P6 | **Proportionate by risk, not by person** | Depth follows the change (PRD Section 3.6) | Lighter checks for experts, heavier ones for novices |
| P7 | **Same truth, any voice** | Style changes words, never rigor or evidence | A "simple mode" with weaker standards |
| P8 | **Quiet unless something changed** | Milestone check-ins; status answers and stops | Narrating every kernel call |
| P9 | **Cheap to read** | Every Standard result says where to look | Unguided diffs; unread code |
| P10 | **Always recoverable** | Every stop says what is safe and what to do | Dead ends, stack traces |
| P11 | **Language is the control surface** | "Pause", "undo that", "fix 1 and 4", "always use pnpm here" | Editing JSON to make progress |
| P12 | **Honest about mechanisms and money** | "I recorded your answer"; usage unknown is said once | Implying enforcement or inventing costs |

### 1.4 What we will not build in R1

A dashboard or factory console; a Tenet panel; a kanban or agent graph; a model picker or credit meter; an onboarding wizard or tour; celebration, streaks or confidence percentages; auto-continue, auto-accept or auto-integrate unless the user set the matching preference; and a separate product for bugs, features, other languages or infrastructure. A panel is reconsidered only if formative sessions show users cannot find the latest result in the chat (§15.1, UX-D11).

---

## 2. Personas and circumstances

### 2.1 Personas

| Persona | Release | Trying to | Optimize | Must still see |
|---|---|---|---|---|
| **Maya, technical builder** (primary) | R1 | Build and evolve several local projects without re-coordinating process | Time to a tryable result; respect for conventions; a short reading list | The verdict, its scope and limits |
| **Sam, maintainer** | R1 | Fix or extend code they did not write today, often with a dirty tree | Reproduction before repair; untouched personal edits; honest pre-existing failures | What was left alone; what was pre-existing |
| **Riley, reviewer or lead** (individual use) | R1 | Get a consistent critique, then fix only selected findings | Zero writes during review; numbered findings; PR briefs | That review is not a checked build |
| **Jordan, Tenet contributor** | R1 | Improve a recipe, skill or adapter safely | Clear contracts and conformance fixtures | Certification level of what they ship |
| **Casey, less-technical builder** | R1.1 | Turn a concrete need into a small app and understand its limits | Domain language; a running screen; prerequisite guidance | What is local-only; when expert help is needed |
| **Lee, learner** | R1.1 | Build and understand why | Explanations of examples, tests and findings | The same verdict a maintainer gets |
| **Morgan, library or CLI author** | R1.1 | Keep a public API and exit codes stable | Examples as calls and outputs; compatibility | Semver consequences |
| **Priya, Python developer** | R1.1 | The same loop with pytest and ruff | Ecosystem-neutral wording | The assistance level until qualified |
| **Noah (data/ML), Omar (infrastructure)** | R2 | Reproducible pipelines; infrastructure changes planned before applied | Contracts, seeds, plans and diffs | What was not reproduced or applied |
| **A team; an enterprise developer** | Later | Shared intent; work inside organizational policy | Owner-based authority; no egress surprises | Who accepted what; which policy limits apply |

Tenet never asks "what kind of user are you?". It infers the job from the request and adapts through the user's own words ("explain more", "be brief").

### 2.2 Circumstances that shape the experience more than titles

Familiar or unfamiliar repository · clear or exploratory request · new or mature system · synthetic or valuable data · local or externally connected behavior · low-risk repair or consequential change · tight or comfortable model allowance · keyboard, screen-reader or other access needs. Each is handled by existing mechanisms (lanes, traits, envelopes, resource mode, style), never by persona modes.

### 2.3 Persona obligations on the R1 design

- **Maya, Sam:** Quick must feel quick (no preview, two messages); Standard must justify every stop.
- **Riley:** the zero-write boundary is the first line of every review (§5.8).
- **Jordan:** results produced through an experimental adapter or community recipe say so in the verdict line.
- **Casey, Lee (R1.1):** Guided wording is written now; no copy assumes Git, terminal or test literacy without explaining it.
- **Morgan, Priya:** status words stay ecosystem-neutral (`unit`, `lint`, `types`, not tool names) outside receipts.
- **Teams (Later):** reading guides and PR briefs are written for someone who was not in the conversation.

---

## 3. Interaction model

### 3.1 Surfaces: the host is the interface

| Surface | Owns | Tenet uses it for | Tenet does not |
|---|---|---|---|
| Chat | Narrative, authority, results | Engagement line, preview, questions in chat, check-ins, results, status | Log every kernel call |
| Native question picker | Routine choices | Choices marked `channel: native` (TS §6.6) | Authority questions (§5.3) |
| Todo list | The current next steps | Mirrors the kernel's `next` when it changes | Hold the plan or imply permission |
| Editor and diff | The code | Everything the reading guide points to, as clickable `path:line` | A second diff viewer |
| Terminal approval | Host gate | Routine kernel calls auto-approvable; consequential ones prompt (TS §4.6) | A Tenet-branded approval dialog |
| Edit checkpoints, browser | Host recovery and preview | Undo within a chat; showing the running app | Replace them |

### 3.2 Entry points and routing

| Command | Does | Writes to the project |
|---|---|---|
| `/tenet <request>` | Starts or continues work; Tenet picks the profile from the words | Only when implementation or durable memory is needed |
| `/tenet` alone, `/tenet status`, "where are we?" | Status, then stops | Never |
| `/tenet-review [scope]` (also accepted: `/tenet review [scope]`) | Read-only two-stage review | Never, including `.tenet/` and Git objects (CON-09) |
| `/tenet why [topic]` | Explains a verdict, lane, level, setting, control or cost | Never |
| `/tenet setup` | Readiness, preferences, approval snippet, adoption preview | Only after a preview and consent |
| `/tenet feedback` | Redacted preview of a report | Only to a path the user chooses |
| `/tenet help` | What works here, what doesn't, four example requests | Never |

**Routing rules:**
- Profiles (`feature`, `bug`, `refactor`, `investigate`, `prototype`, `plan`, `continue`, `fix`, `promote`, `recipe-upgrade`) are never shown as a menu; a user may override in the same sentence ("just look", "prototype it").
- **Write promises are literal:** "don't change anything", "just explain" and help never create `.tenet/`; the answer stays in chat and Tenet offers to start an `investigate` contract if checks are needed. "Plan only" means *no source changes*: plan items are recorded in `.tenet/`, and the reply says so.
- "What's next?" proposes the next plan item; it never silently starts it.
- From a non-agent chat mode, one line: "Switch this chat to Agent, then send it again", and the request is kept for reuse.

### 3.3 Dimensions as the user meets them

| Dimension | User expression | What it changes | Default |
|---|---|---|---|
| Style | "explain more", "be brief" | Words only | Balanced |
| Check-ins | "only interrupt me for decisions", "show each step" | When Tenet speaks between decisions | Milestones |
| Depth (lane) | Stated by Tenet with a one-clause reason; "be more careful" raises it | Process steps | By risk; floor enforced |
| Resource mode | "use fewer extra agents" | Optional dispatch and parallelism | Normal |
| Assistance level | Stated in words (§4.2) | What Tenet may attempt | By readiness |
| Verdict | The result headline (§4.1) | What Tenet may claim | By evidence |
| Owner acceptance | "looks good", "accept" | The user's judgment (separate from the verdict) | Pending |
| Integration | "integrate it", "push", "open a PR" | Where the change exists | Work branch |

Invariants from PRD Section 3.6 apply everywhere: explaining more never adds agents; Conserve never removes required review; Concise never skips evidence; "ask less" is never permission; accepting never turns missing checks into passing ones.

---

## 4. Vocabulary and content design

### 4.1 Verdict wording (UX-D2)

The headline is a plain phrase plus the exact endpoint term in code font, so it is readable and stays identical across styles and support threads. Guided style omits the code term; `/tenet why` always shows it. Scope is part of the headline whenever it is not a clean commit (TS §8.3). These strings are the kernel's `Result.label` (§15.2, A3).

| Endpoint | Headline | Must follow in the same card |
|---|---|---|
| `checked-local` | **Checked locally** (`checked-local`), committed on `<branch>` · or *(working tree, uncommitted)* · or *(working tree, includes your uncommitted edits)* | How to try it; limits |
| `implemented-unverified` | **Built, not checked** (`implemented-unverified`) | The missing, failed or declined evidence, as a list |
| `prototype` | **Prototype, not checked** (`prototype`) | How to try it; the hardening list |
| `findings-only` | **Review only, nothing changed** (`findings-only`) | The findings |
| `blocked` | **Stopped** (`blocked`) | The one missing prerequisite and one safe next step |

**Never used as a headline or claim:** done, finished, verified, working, tested, secure, production-ready, shipped, 100%, all good. A demo, mock, screenshot or focused test never receives a verdict headline. Results through an experimental adapter or community recipe add "(experimental adapter)" or "(community recipe)" to the headline.

### 4.2 Assistance levels in words

| Level | Say (once, in the engagement line) | Plus |
|---|---|---|
| L4 | Nothing, unless asked; work proceeds | — |
| L3 | "I can change this, but the checks I can run here don't support a checked result." | Which check is missing and how to enable it |
| L2 | "I can plan this here; implementing needs a readiness step first." | The readiness step |
| L1 | "I can read and review this project; I can't implement or check this stack yet." | Offer a review or a plan |
| L0 | "I can't work here because <boundary>." | What still works; who can change the boundary |
| No Node.js | "Advisory review only: Tenet's helper needs Node 22.12+." | The official installer link; review now |

### 4.3 Term map

| Internal | User sees | Never shown in the happy path |
|---|---|---|
| Lane Quick / Standard / Deep | "Quick fix" / "Standard" / "Deep (careful)" with one reason | "floor", "risk dimensions" |
| Capture `reported` | "I recorded your answer" | "you approved" |
| Independence `subagent-fresh` | "a fresh reviewer" | "subagent", "manifest" |
| Assumption | "for now, <assumption> (you can change this later)" | "ASM" alone |
| Attention item / marker | "a shortcut that needs a decision", e.g. "`as any` at loans.ts:41" | "attention item", "marker" |
| `usage: unknown` | "Copilot doesn't share usage with plugins; see your usage dashboard" (once per contract) | Credit or money estimates |
| Handle, generation, reservation, receipt ID, `factsHash` | Only in `/tenet why` and diagnostics | — |

### 4.4 Voice and form

- **Voice:** a calm senior colleague: direct, specific, never chirpy or alarmist. One voice even when specialists ran ("I asked a fresh reviewer").
- **Patterns:** outcome first ("Overdue reminders: Checked locally…"); cause in one line ("Cause: naive split at csv/writer.ts:41"); every option with its consequence and reversibility ("easy to change later"); limits as facts.
- **Numbers over adjectives:** "148 passed", "attempt 2 of 3".
- **Banned:** "Certainly", "great question", "simply", "just", "should work", "I verified" for anything not run, apology loops, "software factory" (concept word, not user language), model names as advice.
- **IDs (UX-D7):** the user's words come first; short IDs follow in Balanced and Concise ("Ana, overdue 2 days (EX-012.1)"); Guided hides them; `why` shows full IDs. Users refer to findings by number ("fix 1 and 4").
- **Formatting for a narrow chat pane:** lead line first; at most one table per message, at most 4 columns; tables with header rows; descriptive links (`loans/service.ts:40`, never "here"); code font for commands, paths and endpoint terms.
- **Symbols (UX-D6):** meaning is carried by words; ✓ and ✗ may reinforce "passed" and "failed"; no colored emoji, no color-only meaning, no information conveyed by position alone.
- **Reason codes** appear in code font after a three-part human message, so they stay searchable: *what happened · why it matters · what to do*.

> Shortcut needs a decision (`marker-unaccepted`): `loans.ts:41` adds `as any`, which bypasses type checking. Remove it, or say "accept the cast" to record an exception.

### 4.5 Styles: the same event in three voices

| Style | First green on overdue reminders |
|---|---|
| Guided | "Good news: all three examples now pass. Someone two days late sees a reminder, someone due today doesn't, and returning the item clears it. Next I'll run every test in the project to be sure nothing else broke, then ask a separate reviewer to check my work." |
| Balanced | "First green: examples 1–3 pass. Full suite and a fresh review next." |
| Concise | "Green 3/3 · suite + review next" |

**Style test:** a user who reads only the Concise version can still state the verdict, its scope and any open risk. Style may remove explanation, never options, limits or warnings.

---

## 5. Patterns

Each pattern has an anatomy, a size limit and a rule for when it appears. Limits are targets; a material limitation is never cut to fit.

### 5.1 Engagement line

**When:** the first reply to a request, once per contract. **Limit:** 1–2 lines.
**Anatomy:** what Tenet will do first · lane with a one-clause reason · assistance level if below L4 · anything it will leave alone.

```text
Standard: this changes how loans are stored. I'll confirm the behavior, then build on a branch.
Your 2 edited files (notes.md, .env.example) stay untouched.
```

### 5.2 Contract preview (Standard and Deep)

**When:** before Standard or Deep implementation; never in Quick (WRK-01). **Limit:** about 25 lines; details on request.
**Anatomy, in order:** title and lane · outcome · examples in the user's words, each with how it behaves today · invariants ("never …") · design sketch (when structural, TS §8.7) · scope · **won't touch** (always present) · checks · budget · expected verdict.

**Stop rule (UX-D1).** The preview **waits for confirmation only when Tenet added something the user did not say**: an inferred or extra example, an assumption, or a sketch commitment on behavior, data, access, compatibility or an interface others consume. It marks those additions ("Examples 2 and 3 are mine, not yours"). When the request settled everything, the preview is shown and work proceeds with "Say 'wait' to change anything"; the first step (writing acceptance tests) is cheap to redo. In both cases the examples are always *shown*, because hidden confirmation is how misreadings ship.

```text
Overdue reminders · Standard · branch tenet/w-0007-overdue-reminders
Outcome    Borrowers overdue by more than a day see a reminder on their dashboard.
Examples   1. Overdue 2 days → reminder shown               (fails today)
           2. Due today → no reminder                        (works today, must stay)   ← mine
           3. Returned late → reminder cleared                                         ← mine
Never      A reminder never shows another borrower's name.
Design     Extend loans/service (no new module): loans.overdueFor(userId).
           Path: GET /api/dashboard → dashboard route → loans.overdueFor → loans repo.
           "Overdue" is computed in one place. No scheduler or email yet (deferred).
Won't touch  server/auth, email, other borrowers' data
Checks     unit + integration, dashboard journey, lint, types · Budget: 3 attempts, 2 reviews
Expected   Checked locally
Examples 2 and 3 are mine. Looks right? [Confirm] [Edit examples] [Edit design] [Make it smaller]
```

**Rules:**
- Examples come first and say how each behaves today ("fails today", "works today, must stay"), never "distinguishing" or "preservation".
- **The sketch is confirmed with the examples, never separately.** Guided collapses it to one sentence ("I'll extend the existing loans code; nothing new") with "show design" for the rest. After confirmation, Tenet may refine internal detail without asking; a change to a sketch commitment asks (TS §8.7).
- **"Make it smaller"** splits the work into plan items. **"Edit …"** accepts free text.
- The envelope appears only when it involves network, data targets or credentials. Assumptions that matter appear as a separate decision (§5.3).
- **Text wireframe (UX-D9):** for a `ui` change in Standard or Deep, the preview offers one rough text wireframe ("Want a rough screen first?"); a one-sentence prose summary precedes the box drawing so screen readers can skip it. Skipping is one word. It is alignment, never evidence, and is not kept.

### 5.3 Questions

**When:** only when an answer changes the next action, the authority or the claim (INT-03). All questions due at one boundary arrive as one group of at most 3.

**Anatomy:** a short header · one question sentence · options with the recommendation first and marked · each option's consequence and how hard it is to change later · free text allowed where the real answer may not be listed · what the answer applies to.

```text
2 choices before I build reservations (recommended first):
1. Two people request the same item for overlapping days?
   ● Refuse the second and show the next free date   ○ Allow a waitlist
   Changes later: easy (one rule in one place)
2. Who can see borrower names?
   ● Only the admin   ○ Everyone signed in
   Changes later: moderate (affects privacy tests)
```

| Type | Example | Channel (TS §11.4) |
|---|---|---|
| Product clarification | Overlap rule; who sees names | Native picker |
| Example confirmation | §5.2 stop rule | Native picker or inline |
| Consent | Run commit hooks; filter consent; envelope with network | Native picker |
| Recovery | "Has the earlier chat stopped?" | Native picker, safe option first |
| Disposition | Accept a shortcut; accept a test-defect fix to a locked test | Native picker, batched |
| **Authority** | Widen scope, protected paths, push or PR, delete or reset, accept risk, owner acceptance at a gate | **Plain chat; Tenet ends its turn** |

**Authority questions** say "Reply in your own words; I won't continue until you do." Under Autopilot the host can answer pickers automatically, so authority is never a picker; the explanation is in `/tenet why authority`, not in the question.

**Rules:**
- Search before asking; never ask what the repository, lockfile or history answers.
- Never ask about distant plan items before their answers matter.
- Apply partial answers to independent work.
- Silence, timeouts and pre-selected options are never consent.
- Reconfirm only when the facts behind an answer changed, and say what changed: "You approved pushing 4e1c2a9; the branch now points to 9b07d1e. Push the new commit?"
- **High-risk domains** carry one standing line in the result: "These are software checks, not a clinical, financial or safety sign-off" (SEC-16).
- **No routine final approval** (RES-03).

### 5.4 Progress and check-ins

- **Todos** mirror the kernel's next steps in plain words ("Write the 3 example tests", "Fresh review"). They are not the plan and not permission.
- **Check-ins** follow the preference: *minimal* (decisions and end), *milestones* (basis settled · first red seen · first green · review done · end), *each phase* (every boundary). **Limit:** 1–2 lines; a check-in never asks unless a question is due.
- **Long checks** get one line when they start ("Running the full suite; about 4 minutes last time"); no percentage fiction. "Stopping…" is shown until a stop is observed.
- **A planned failing test is progress, not alarm:** "Example 1 fails on the current code, as it should."
- **Never answer host pauses** such as "Continue to iterate?" (WRK-10); Tenet's boundaries make resuming safe instead.

### 5.5 Result card

**When:** the end of work. **Limit:** about 10 lines; everything else via `status` and `why`.
**Anatomy, in order:** headline (§4.1) · try it (the demo path, RES-05) · checked · review · limits and not claimed · **read** (Standard and Deep) · next.

```text
Overdue reminders: Checked locally (`checked-local`), committed on tenet/w-0007.
Try it    npm run dev → sign in with the dev account printed at startup → Dashboard.
Checked   Example 1 failed before and passes now · examples 2–3 and the privacy rule pass
          Full suite 148 passed · lint and types clean · dashboard journey passed
Review    Fresh reviewer: behavior passed, structure passed (its judgment of this change)
          1 major finding fixed and re-verified · 1 minor deferred
Limits    "Overdue" uses the server's timezone (your earlier choice) · not claimed: production, email
Read      1. server/db/migrations/0007.sql      persistence change: read before accepting
          2. server/loans/service.ts:40–78     owns the overdue rule
          3. web/dashboard/Reminders.tsx       never shows other names
Next      Integrate into main? · "what's next?" → Returns
```

**Reading guide (TS §8.3).** Shown for Standard and Deep; in Quick only when a shortcut, persistence or auth file, or an unpredicted path changed (UX-D8). At most 5 entries, ordered:
1. what needs judgment: open or deferred findings, shortcuts with their dispositions, paths the plan did not predict ("not in the plan"), and paths with `auth`, `persistence` or `external-effects` traits ("read before accepting");
2. the main path in the sketch's call order (the coordinator lists `scope.paths` in call order, so the kernel's order matches);
3. tests, grouped by example.

It is guidance from recorded data, never a statement that anyone read the code.

**Incomplete results** are equally calm and specific:

```text
Overdue reminders: Built, not checked (`implemented-unverified`).
Why       The dashboard journey couldn't run: Playwright's browser isn't installed.
Checked   Examples 1–3 and the privacy rule pass (unit + integration) · lint, types clean
Fix       "install the browser" (one-time, about 150 MB), then "check again"
```

**After the result:** "looks good" or "accept" records owner acceptance and offers integration; integration happens only on "integrate" unless the `integration` setting is `auto-on-accept` (UX-D10). Nothing remote ever follows from an acceptance phrase.

### 5.6 Status

**When:** `/tenet status`, "where are we?", or after context compaction. **Limit:** about 12 lines. Never starts work.

```text
W-0007 Overdue reminders · Standard · checking (attempt 2 of 3)
Plan       ✓ Items · ✓ Reservations · now Reminders · next Returns
Evidence   unit passed (current) · dashboard journey out of date (you edited Reminders.tsx)
Findings   1 major open: overdue count off by one (loans/service.ts:61)
Budget     attempts 2/3 · reviews 0/2 · fresh agents 1/6 · Copilot usage: see your dashboard
Next       check again, then review
```

### 5.7 Why

`/tenet why <topic>` answers in at most 10 lines with **the effective value · where it came from · what overrides it · what it does not do · how to change it**. Topics: verdict (every reason a stronger headline was not reached), lane, level, a setting, a control ("I detect changes to locked tests; I can't prevent them"), authority, model, cost. It is the transparency valve that lets every other pattern stay short.

### 5.8 Findings

```text
Read-only review of 14 files at abc123 · nothing written · no commands run
1  blocker  Session not rotated after password change      auth/session.ts:88
2  major    No rate limit on /login                         routes/login.ts:12
3  major    Test "rejects expired token" asserts nothing    auth.test.ts:120
4  minor    Duplicates the helper in lib/validate.ts        auth/validate.ts:5
Coverage   14 changed + 9 related files read · 2 callers sampled (types prove the rest compile)
Say "fix 1 and 3", "explain 2" or "PR brief".
```

- Worst first; severity always as a word; one line per finding with a clickable location; "explain N" opens claim · trigger · consequence · evidence · suggested fix.
- Questions and optional improvements are listed separately from findings.
- Coverage is one honest line; a partial review says "partial" in its headline.
- **"Fix N and M"** opens a contract scoped to exactly those findings (RES-06); the others are repeated as still open, so they are never mistaken for fixed.

### 5.9 Exception and recovery card

Every abnormal state uses one shape. **Limit:** about 8 lines.

```text
What happened   Copilot reported a usage limit.
Safe            Everything up to the last check is saved (attempt 2 done; review not started).
Not done        I didn't retry, switch models or start anything paid.
Uncertain       Nothing.
Next            Continue later in any chat: "/tenet continue". Counters and evidence are kept.
```

Section 10 catalogs the states.

### 5.10 Impact card (intent changes)

When the user changes accepted behavior (INT-08), Tenet shows a **delta**, never a re-run of intake:

```text
You want admins emailed about overdue items.
Changes     A new external effect (email) · a new example · an external-effects check
Affects     This work (raises it to Standard: external effects) · plan item Reminders
Unaffected  Items, reservations, returns
Options     ● Add to this work   ○ New plan item for later   ○ Cancel this work
```

### 5.11 Budget and model notices

- **Deep preview (RES-09)** in words, never currency: "This is Deep: it changes the schema and who sees loans. Expect about 4 fresh-agent sessions and the full suite twice. Continue?"
- **Unqualified model for Deep (RSC-08):** "Your current model hasn't been evaluated for Deep work. Continue, or stop so you can switch?" No model menu.
- **Research economy model (PA-6):** before the first research dispatch, "Research uses a cheaper model qualified for read-only research. Say 'use my model for research' to change." Said once.
- **80% of a budget:** said once. **At the limit:** a recovery card with the diagnosis and a bounded proposal, never "continue indefinitely".

---

## 6. Journeys

Template for each journey: **actor and outcome · trigger · steps · decisions · artifacts the user sees · alternatives and interruptions · completion · verification scenario** (§14). PRD journey IDs are kept.

### J-01 Install and first value (R1)

- **Actor and outcome:** Maya, a first useful result with no setup.
- **Trigger:** discovers Tenet in a marketplace or README.
- **Steps:**
  1. **Before install,** the README says what Tenet adds, prerequisites (VS Code with Copilot agent mode, Node 22.12+ or 24, Git), qualified versus experimental environments, that it runs locally and does not deploy in R1, that it ships helpers and (once qualified) observer hooks, how to verify the publisher, and how to remove it. Three starter prompts: a new app, a bug fix, a read-only review.
  2. **Install** through the host's plugin flow; no cloning, JSON editing, API keys or extra runtime.
  3. **First message is a real task.** Readiness runs only for that task: a review needs no test tools; an explanation needs no Git.
  4. **Missing prerequisite:** name it, link the official installer, offer what works now; never install machine prerequisites.

     ```text
     I can review this project now. To build and check here I need Node 22.12+ (you have 20.11):
     nodejs.org or "brew install node@22", then say "check readiness". Want a review meanwhile?
     ```

  5. **Value:** a checked change, a review, a plan, a diagnosis or a justified no-change.
  6. **Afterwards, never before:** the adoption offer (J-02 step 8) and optional `/tenet setup`.
- **Completion:** first useful outcome without developer setup (PRD J-01).
- **Verification:** install-to-engaged and first-value timings; zero configuration before value.

### J-02 New project from an empty folder (R1)

- **Actor and outcome:** Maya (or Casey in R1.1), a running first increment.
- **Trigger:** `/tenet I lend out lab equipment… people should see what's available and I should know who has what.`
- **Steps:**
  1. **Engagement line:** "I can build and check here (TypeScript starter)." Existing files are never overwritten because the user said "new".
  2. **Git choice (native):** [Initialize Git (recommended: every step can be undone)] [Prototype without Git] [Read-only plan].
  3. **Framing:** Tenet drafts purpose, users and non-goals in two lines and asks only consequential product choices (at most 3; §5.3), never framework or folder questions unless the user imposed a constraint.
  4. **Plan:** 3–6 vertical slices named by what the user can try ("See what's available", not "Database schema"), each saying how it will be checked; "the first one is runnable before the next starts". Editable in words ("merge 3 and 4", "reminders later").
  5. **Optional text wireframe** for the first screen (§5.2).
  6. **Contract preview** for slice 1 (§5.2 stop rule).
  7. **Quiet build:** check-ins at milestones; scaffold verified and committed; tests red, then green; fresh review.
  8. **Result** with "Try it", the dev account note ("printed at startup; local use only; see docs/hardening.md"), and **one adoption offer**: "Save the app's purpose, plan and decisions as files in the project so the next change starts with them? [Preview]". A public remote is warned about in the preview; a decline is remembered.
  9. **Next:** "what's next?" previews slice 2; nothing is re-asked.
- **Alternatives:** the user picks Prototype (J-09); declines Git (read-only plan); stops halfway (J-05a).
- **Completion:** a real local journey works; no production or external identity setup (PRD J-02).
- **Verification:** seeded misreadings caught at the preview; no layer-shaped plans; at most 3 questions per card.

### J-03a Brownfield bug, Quick (R1)

- **Actor and outcome:** Sam, a fixed bug with proof and untouched personal edits.
- **Trigger:** `/tenet Bug: the CSV export drops rows whose notes contain a newline.`
- **Steps:**
  1. "Quick fix. Your 2 edited files (web/billing/*) stay out of this."
  2. **Reproduce:** "Reproduced: export.test.ts › notes with newline fails on main (2 of 3 rows)."
  3. **Cause in one line:** "csv/writer.ts:41 splits naively; using the csv-stringify already in the project. No API change."
  4. **Repair, check, focused pass:** silent unless something needs the user.
  5. **Result (Concise):**

     ```text
     Checked locally (`checked-local`) · tenet/w-0021-csv-newlines · 1 commit (your 2 files not included)
     Repro failed → passes · suite 412 passed · lint, types clean · focused review: no findings
     Pre-existing, unchanged: 2 flaky e2e tests in upload.spec.ts (outside this fix)
     Integrate into main?
     ```

  6. **Shortcuts:** if the fix added `// eslint-disable-next-line` or `as any`, one batched question at the end asks whether to accept it; a same-session pass cannot accept its own shortcut (TS §8.7).
- **Alternatives:** the bug turns out to touch auth or persistence, so the lane rises with the specific discovery stated ("this touches how sessions are stored, so I'm making it Standard").
- **Completion:** behavior and regressions demonstrated, or an explicitly incomplete result (PRD J-03).

### J-03b Brownfield feature, Standard (R1)

- **Actor and outcome:** Sam, an extension that respects the codebase.
- **Steps:**
  1. **Respect first:** "This project already has reservation validation and a shared date parser; I'll extend those." Existing planning documents are reused if the user designates them (INT-13); no `INTENT.md` is pushed on them.
  2. **Dirty files:** unrelated edits are left alone without a question; an overlapping file gets one specific question:

     ```text
     loans/service.ts has your edits and needs mine.
     ● Finish or set aside your edits first, then "continue" (keeps undo exact)
     ○ Include your edits in this work (they'll be committed together)
     ○ Leave that file out (the change may be incomplete)
     ```

  3. **Characterize, then preview:** "Captured current invoice-total behavior in 4 tests." Preview with the sketch (§5.2).
  4. **Surprises become mismatch cards,** never improvisation:

     ```text
     Something doesn't match the plan.
     Expected   Discounts are applied in billing/totals.ts
     Found      A second discount path in checkout/legacyCart.ts:210 (used by mobile)
     Matters    The new rule would apply on web but not mobile
     ● Include legacyCart.ts (recommended)   ○ Web only, recorded as a gap   ○ Stop here
     ```

  5. **Pre-existing failures** get their own honest line: "Fails before and after my change: dates.test.ts (pre-existing, excluded)", or "couldn't tell (your starting edits changed since)".
  6. **Result** with a reading guide that includes consumers symbol search misses (a cron script parsing a field, a stored column).
- **Completion and verification:** as J-03a, plus "unpredicted path" entries appear in the reading guide.

### J-03c Behavior-preserving refactor (R1)

Quick or Standard by risk. Steps: name what must not change (interfaces, behavior) → preservation tests that pass today → refactor → recheck → result says what became simpler ("one validation path instead of three; public API unchanged") and what stayed the same. No artificial failing test (TDD-05, TDD-06); no speculative architecture.

### J-04 Review, then selected fixes (R1)

- **Actor and outcome:** Riley, a trustworthy critique without side effects.
- **Steps:**
  1. Resolve scope (a document, uncommitted changes, a branch against its base, files) and state it with the revision.
  2. **Boundary first:** "Read-only review … nothing written · no commands run."
  3. Findings (§5.8) with coverage.
  4. Follow-ups: "explain 2"; "PR brief"; "fix 1 and 3" opens a Standard contract scoped to those findings and repeats the others as open; "run the tests too" offers an `investigate` contract ("this writes Tenet's local records, not your source").
- **Completion:** no files written during review; selected fixes need implementation authority (PRD J-04).
- **Verification:** filesystem watcher shows zero writes; unselected findings never change.

### J-05a Continue after an interruption (R1)

- **Trigger:** a new chat days later: `/tenet continue`, "what's next?", or `/tenet status`.
- **Steps:**
  1. **Resume card:**

     ```text
     Back on Overdue reminders (paused Tuesday before review).
     Kept       Accepted examples, decisions and passing checks up to Tuesday
     Changed    You edited web/dashboard/Reminders.tsx (not me) · main moved 6 commits
     So         Dashboard evidence is out of date; review must run
     Next       Keep your Reminders.tsx edits in this work? [Yes] [No, set them aside]
     ```

  2. **Takeover question only if the old chat may still be working:** "The earlier chat was mid-implementation. Has it stopped?" Never decided by a timer.
  3. **No repeated intake;** settled decisions return from records, not memory.
- **Completion:** scope, plan and evidence recovered; stale results and old approvals not reused blindly (PRD J-05).
- **Verification:** resume ≤ 2 minutes; zero unnecessary repeated questions (AC-08).

### J-05b Refine, pivot or reject an interpretation (R1)

| Change | Experience |
|---|---|
| Presentation ("be brief") | Applied at once |
| Refinement within the agreed outcome | Applied; mentioned in the next check-in |
| Material change (behavior, data, access, compatibility, authority) | Impact card (§5.10) |
| Rejected wireframe | Agreed behavior is kept; only the screen is redrawn |
| Internal implementation adjustment | No question unless it changes a sketch commitment |
| New findings mid-work | Noted; never silently added to scope ("noticed, not changed", QLT-10) |

A basis change after checks passed says exactly what is now out of date ("review must run again; tests still count").

### J-05c A bug in Tenet's own earlier work (R1)

"Reminders still show for returned items" → linked to the example it contradicts, reproduced as a failing test, fixed: "Example 3 should have caught this; I've added the missing case."

### J-06 Integrate, hand off, publish, undo (R1)

- **Integrate:** "Integrate into main?" → Tenet predicts conflicts before anything moves ("main has 6 new commits; merging is clean" or "would conflict in loans/service.ts: [Resolve with me] [Rebase this work] [Leave it]"), says "this switches your editor to main", integrates, rechecks the combined result when main moved, and reports where the work now is. Branch cleanup is offered, never automatic.
- **PR brief:** problem and outcome, important choices, validation, compatibility or data effects, open findings and limits; no chat transcript, private intent or credentials.
- **Push or open a PR** is an authority action in chat, bound to the remote, branch and exact commit, with the brief shown first. Remote merges always stay with the user. "A PR is not a deployment."
- **Undo:** "undo that" → preview of the inverse against current state, naming any later edits it would touch and saying that databases and external effects are not undone → confirm → apply → check → result.
- **Don't commit (UX-D4):** "don't commit" or "I'll commit myself" is honored for that task: the work stays uncommitted, the headline says "(working tree, uncommitted)", undo is limited to the diff and editor checkpoints, and "commit it" commits later.
- **Completion:** base branch contains the work; brief reflects contract, evidence and open findings (PRD J-06).

### J-07 Update or leave (R1)

- **Update:** the host's update flow. Mid-work: "Tenet updated since this work started; your work and evidence are intact." A state migration is previewed (LFC-04).
- **Leave:** `/tenet help uninstall` lists what remains: `.tenet/`, adopted files (kept: they are the user's documents), test tags and commit trailers, the user directory, run directories. Two previewed cleanups: **this project** and **this machine** (offered on uninstall). Nothing keeps running.

### J-08 Deep change: migration, access or compatibility (R1)

1. Lane rises with the specific reason; the Deep preview in words (§5.11); the unqualified-model notice if it applies.
2. **Architect pass** drafts the sketch, a decision record ("Store loans per borrower…") and the architecture update; **security pass** drafts a short threat and data note whose items become examples.
3. **Data safety is visible:** "Before migrating I'll back up the database and test the restore."
4. A changed critical screen asks **once**, after the final check, for the screen-reader check; declining narrows the accessibility claim with no repeated asking.
5. The reading guide puts the migration, policy and restore test first ("read before accepting").

### J-09 Prototype, then promote (R1)

1. "Just sketch it quickly" → "Prototype, not checked: I'll snapshot as I go so you can undo; the result won't claim checks." The preview states the purpose, the synthetic-data boundary, local exposure and known shortcuts. Prototype is never offered as a way around failed required checks.
2. **Result:** "Prototype, not checked (`prototype`). Try it: … Gaps recorded in docs/hardening.md (6 items)." Next actions: keep exploring, discard, or "make it real". Integrate, push and "productionize" are not offered by default.
3. **"Make it real"** (promote): Git is set up, gaps become proposed requirements, current behavior is captured in tests, missing safeguards get tests, a fresh review runs, and the result is whatever the evidence supports. "Production-ready" is never a rename.

### J-10 Plan or investigate without building (R1)

- **Plan:** read existing intent and constraints → name the outcome and uncertainties → compare at most 3 approaches → recommend the simplest sufficient one → ordered vertical slices with checks and dependencies → decisions that can wait → what evidence would change the recommendation → stop. "No source changes; the plan is kept in Tenet's local records."
- **Investigate:** state the question → inspect evidence → run only authorized diagnostics → separate observations (with `path:line` or `command → output`), hypotheses and unknowns → recommend the next discriminating step → stop. "Don't change anything" keeps everything in chat (§3.2).
- A justified "no change needed" is a successful outcome.

### J-11 Add a dependency (R1)

```text
Adding date-fns 4.1.0 (+0 transitive) · published 5 months ago · MIT · no install scripts
Within your dependency policy. Install? [Install] [Choose another] [Skip]
```

A failed rule names the rule and the value ("published 2 days ago; your policy needs 14"). An install the agent ran outside Tenet: "A package was installed outside Tenet; I verified it afterwards; its install scripts may already have run."

### J-12 Repeated failure and budget limits (R1)

```text
Stopping: the same failure twice.
Failure    loans.test.ts › overdue 2 days: expected 1 reminder, got 0
Premise    Both attempts assumed dates compare in UTC; the fixture uses local midnight
Next       ● Test that premise (one check)   ○ Change the example   ○ Stop here
```

At an attempt limit: what works, what still fails, the diagnosis, and one bounded proposal ("authorize one more attempt focused on the transaction boundary, or pause with the current handoff"), asked in chat.

### J-13 Recipe upgrade (R1)

"Upgrade the starter" → the template changes grouped by purpose (security headers, test runner, …), files that conflict with the user's changes listed separately, and the accepted set applied and checked together as one Standard contract (TS §12.9). An unsupported old version gets the template diff as guidance.

---

## 7. Steering vocabulary

Anything new from the user is handled **before** the next step (TS §5.2).

| User says | Tenet does | Reply |
|---|---|---|
| "status", "where are we?" | Status only | §5.6 |
| "pause", "park this" | Stops at the next safe boundary; saves the handoff | "Paused after the check. Resume any time." |
| "cancel" | Stops owned processes; no implicit rollback | Recovery card listing what remains |
| "undo that" | Previewed inverse (J-06) | Decision card |
| "skip the tests" | Proceeds to a weaker headline, said once | "OK. The result will say 'Built, not checked: tests declined'." |
| "be brief", "explain more", "only interrupt for decisions" | Changes style or check-ins; nothing invalidated | One-line confirmation |
| "always …" / "never …" | Saves a setting (§8.2) | Where it was saved and how to undo it |
| "fix 1 and 4" | Contract scoped to those findings | Preview or start |
| "make it smaller" | Splits into plan items | Plan |
| "why …?" | `why` | §5.7 |
| "looks good", "accept" | Records owner acceptance; offers integration | One line |
| "integrate it", "push", "open a PR" | Integration (J-06); authority in chat for remote actions | Decision card |
| "don't commit" | Honored for this task (UX-D4) | Headline shows uncommitted |
| "forget that" | Previewed forgetting across every copy Tenet controls | Decision card |
| "continue" | Resumes bounded remaining work; never authorizes unrelated remote or destructive actions | Resume card or check-in |

---

## 8. Configuration

### 8.1 Principles

- **Spoken first.** Every one of the 12 catalog settings (PRD Section 7.3) can be changed in words; nobody edits a file to proceed.
- **One home per setting, always visible.** Every saved change says where it went, and `/tenet why <setting>` shows the effective value, its source, what overrides it, what it cannot do, and how to reset it.
- **Diffable and recoverable.** Shared settings live in one readable file; personal settings never reach shared files (CFG-08); every change can be undone by saying so.
- **Explicit corrections are never re-asked** (CFG-07).

### 8.2 Where a spoken setting is saved (UX-D3)

| Kind | Examples | Saved to | Then |
|---|---|---|---|
| Presentation | style, check-ins, resource mode | **Personal**, all projects; this project only if the user says "here" | "Saved for you (all projects). Undo: 'back to balanced'." |
| Project fact | commands, protected paths, required checks, exclusions, dependency policy, lane floor, branching, integration | **This project, locally** (`.tenet/`), applied at once | If the shared policy file is adopted, one offer: "Share with the repo's tenet.policy.json? [Share] [Keep local]" |
| Shared commitment | Anything in an adopted `tenet.policy.json` edited by a person | The file; Tenet asks to accept changes it did not make (PRD Section 7.5) | Restrictions apply at once even before acceptance; loosening needs acceptance |

```text
User   never touch migrations/ without asking
Tenet  Saved for this project (local): migrations/ is now protected; edits need your OK each time.
       Share with your repo's tenet.policy.json? [Share] [Keep local] · Undo: "unprotect migrations".
```

Restriction changes (protected paths, exclusions, required checks, stricter dependency policy) state their effect on in-flight work: "This applies from the next step; the current branch already edited a migration, so I'll ask before committing it."

### 8.3 `/tenet setup`: a short checklist, not a settings app

```text
Setup for this project
Readiness      Node 22.14 ✓ · Git ✓ · Vitest ✓ · Playwright browser not installed  [install]
Style          Balanced (you)                                         [change]
Check-ins      Milestones (you)                                       [change]
Resources      Normal · "Is your plan's monthly allowance tight?"     [yes → Conserve]
Checks         unit, integration, lint, types (starter defaults)      [change]
Protected      migrations/, server/auth/ (this project, local)        [change] [share]
Approvals      Copy the auto-approve rule for routine Tenet calls     [show rule]
Shared files   Not adopted                                            [preview]
```

Setup is optional, never required before the first task, and writes only after a preview. The approval rule is shown for the user to paste, never written (TS §4.6).

### 8.4 Editing files directly

- `tenet.policy.json` ships with a published JSON Schema (`$schema`), so VS Code autocompletes keys and flags typos as the user types (§15.2, A6).
- An unknown or malformed restriction key stops dependent work with the nearest valid key named: "`protected_path` isn't a setting; did you mean `protected_paths`?" (`restriction-key-unknown`). Unknown personal preferences are reported once and ignored.
- Hand edits to adopted files are accepted through a diff the next time Tenet runs; tightening applies immediately.

### 8.5 Lessons and memory

- An explicit correction ("always use pnpm here") applies now and, when said with "always", persists. Inferred lessons are only proposed, with the evidence, at most one per contract, and only when they would have changed something.
- "What do you remember about this project?" lists lessons, preferences and decisions with provenance ("from your correction on Oct 12"); each can be changed or forgotten with a preview.
- Tenet prefers a reliable check over another instruction and never ends a task with a lesson prompt by habit.

### 8.6 Reset

"Reset my settings" previews exactly what will be removed and states what stays: accepted intent, decisions and restrictions from shared files are never removed by a preference reset.

---

## 9. Trust, privacy and resources

- **Controls disclosure, once per project and again only on change:** "Here's how I keep things honest: I run the checks and record the results; I record your answers as you gave them (I can't verify who typed them); I detect changes to locked tests but can't block commands." Detail is in `/tenet why controls`.
- **Autopilot:** the README states that Tenet cannot tell a person's answers from automatic ones under Autopilot; `/tenet why authority` repeats it.
- **Previews before anything leaves the project's control:** adoption (which files, who can read them, a public-remote warning), exports and feedback (the full redacted content and destination), remote actions (remote, branch, commit, content).
- **Exclusions in plain words:** "I won't read or send .env.local; checks that need it use it locally."
- **Suspected secret exposure:** "A token-like string appeared in output sent to the model; I removed my copies and can't remove copies elsewhere. Steps: …" (PRD Section 5.17).
- **Resources:** budgets in status; Deep previews in words; one 80% notice; `usage: unknown` with the dashboard pointer once per contract; no currency, overage suggestions, account switching or model nagging (RSC-03).

---

## 10. Exception and recovery catalog

All use §5.9. Copy names the file, command or policy, never "an error occurred", and always offers at least one way forward, even "stop here; nothing was changed".

| Situation | Message core | Options |
|---|---|---|
| Missing tool | "To run the dashboard journey I need Playwright's browser (about 150 MB)." | Install (consented) · skip it (weaker headline) |
| Readiness needed (L2) | "Dependencies aren't installed, so I can plan but not build." | Install them (previewed) · plan only |
| Unsupported stack (L1) | "I can review this Go service; I can't build or check Go yet." | Review · plan · explain what support would need |
| Policy denial (L0) | "Your organization's policy disables custom agents in this workspace." | What still works · who can change it |
| Dirty tree overlap | J-03b card | Finish first · include · leave out |
| Change Tenet can't explain | "billing.ts changed after my last check and I didn't do it." | It was me · it was the agent · show the change |
| Another chat owns the work | "Overdue reminders is active in another chat." | Switch to it · pause it · wait |
| Effect uncertain after a crash | "A commit may have happened when VS Code closed. I checked: it did." Or: "I can't tell; here's what I see." | Keep · undo · look myself |
| Hook staged extra files | "Your pre-commit hook added package-lock.json to my commit." | Keep it · move the branch back after you review |
| Hook or signing failed | "Your pre-commit hook failed (lint-staged exit 1); the work is checked but uncommitted." | Show output · fix and retry · leave uncommitted |
| Undo overlaps later edits | "Undoing would overwrite your later change in lines 40–52." | Show the overlap · undo the rest · cancel |
| Integration conflict | J-06 card | Resolve with me · rebase · leave unintegrated |
| Evidence out of date | "You changed Reminders.tsx after the last check, so those results no longer count." | Check again |
| Review partial | "The reviewer couldn't reach 3 files." | Review those (one more fresh agent) · make the work smaller |
| Same failure twice | J-12 card | Test the premise · change the example · stop |
| Budget reached | J-12 limit card | One bounded attempt (asked in chat) · stop honestly |
| Host usage limit | §5.9 example | Continue later |
| Locked test edited | "The test for example 2 changed without a recorded reason." | Revert it · it's a test defect (reviewer decides) · the requirement changed (you decide) |
| Shortcut needs a decision | §4.4 example | Remove it · accept with a reason |
| Corrupt state | "My records were damaged; I restored the previous version. Please reconfirm 2 permissions." | Reconfirm |
| Copied or untrusted `.tenet/` | "I found Tenet records I didn't create here; I've set them aside and started fresh." | Review them · keep the fresh start |
| Index left untouched (`index-sync-needed`) | "Committed. I left your index alone (another tool was using it): 3 files still show their old version as staged." | "sync my index" · `git restore --staged <paths>` |
| Run directory unavailable | "I can't write temporary check files (OS temp is read-only), so checks can't run." | How to fix · review only |
| Deploy requested (R1) | "I don't deploy in this version. I can prepare a hardening list and a PR brief." | Hardening list · PR brief |

---

## 11. Coverage across projects, families and lifecycle

### 11.1 Project types in R1

| Project | Experience |
|---|---|
| New TypeScript web or API (starter) | Full loop, Checked locally |
| Existing TypeScript or JavaScript on a supported stack | Full loop, Checked locally |
| TypeScript on an unsupported runner or version; experimental monorepo | Built, not checked, with the missing check named and a readiness task offered |
| Missing dependencies or plan-only | Plan, with the readiness step |
| Other languages | Review, explain and plan; implementation later (Python in R1.1) |
| Non-Git folder | Prototype, or initialize Git |

### 11.2 Software families: the grammar stays, the examples change

| Family | Examples look like | Extra line the user must see | Release |
|---|---|---|---|
| Web app | User journeys, roles, states | — | R1 |
| API or service | Requests, responses, errors, idempotency | Breaking-contract findings | R1 |
| Library or CLI | Calls with inputs and outputs; arguments, exit codes, streams | "This changes a public signature" | R1 brownfield; R1.1 recipe |
| Python | pytest cases in the project's style | The level until qualified | R1.1 |
| Data or ML | Input contracts, seeds, reruns, evaluation criteria | "I did not reproduce the run" unless it did | R2 |
| Infrastructure | The plan and the diff | "Not applied." Apply is a separate explicit word | R2 |
| Regulated domain | The same checks | "Software checks, not a domain sign-off" | Any |
| Team | The same contract | "Accepted by Ada on Tuesday" | Later |

### 11.3 Lifecycle

| Stage | Pattern | Release |
|---|---|---|
| Discover and frame | Intake questions, overview, non-goals | R1 |
| Explore | Investigate; prototype | R1 |
| Plan | Vertical slices with checks | R1 |
| Design | Sketch; Deep decision records and architecture notes | R1 |
| Build and verify | Preview, check-ins, result | R1 |
| Review | Findings | R1 |
| Integrate and hand off | Conflict-checked integration; PR brief | R1 |
| Evolve | Resume, impact card, bug against earlier work | R1 |
| Upgrade | Recipe upgrade; Tenet update | R1 |
| Deliver and operate | Delivery recipe and demo evidence; user-supplied operational evidence first | R1.1 and later |
| Retire | Uninstall residue; for software retirement, an inventory of data, consumers, credentials and irreversible effects as a plan | R1 (Tenet); later (software) |

An unsupported stage or family is never a dead end: Tenet says what remains useful (review, plan, readiness task).

---

## 12. The experience of the generated software

Tenet's workflow can be excellent while the app it builds frustrates people; the starter's journeys are specified to the same standard (QLT-01, QLT-03, QLT-14).

**For every critical journey** (sign in, browse, reserve, return, admin overview), `journeys.json` defines: actor and goal · entry point · preconditions · main path · validation and boundary cases · loading and empty states · denied access · conflicts and failures · recovery · observable success.

**Defaults the starter demonstrates:**
- Forms keep input after recoverable errors and block repeated submission.
- Errors explain what happened in domain words and how to recover ("Someone reserved Microscope A for Tuesday a moment ago. Next free: Thursday.").
- Empty states offer the next useful action ("No equipment yet. Add your first item.").
- Success is confirmed by a fresh read, not a toast alone; another user sees the updated availability.
- Authorization is enforced on the server; hidden buttons are never the control.
- Keyboard-complete; focus moves to the page heading on navigation and to the error summary on failure; `aria-live` status messages (TS §12.6).
- Reuse an existing design system where the project has one; never add one for appearance.
- Deletion and restoration are designed explicitly; migrations preserve data.

Quality claims name the journeys and workload evaluated, never the whole application.

---

## 13. Accessibility and localization

### 13.1 Tenet's own interactions (Alpha entry criterion)

- Words carry every meaning; symbols only reinforce; nothing relies on color or position.
- Tables are narrow with header rows; findings and examples are lists, so screen readers can jump between them.
- The important line comes first; long output is behind "show more".
- Links are descriptive; text wireframes are preceded by a one-sentence summary.
- Native pickers are real controls; every choice also works as a typed reply ("reply 1 or 2"); chat authority questions are short enough to answer by voice.
- No focus stealing for routine progress and no repeated announcements; screenshots are never the only evidence.
- Guided style doubles as a cognitive-load aid, not a "simple mode".
- Qualification includes VoiceOver with VS Code chat and keyboard-only sessions on the tuple (PRD Section 6.8).

### 13.2 Localization

- **Tenet's interaction language** is English in R1 and is independent of the generated app's language.
- **Dates** in consequential examples are unambiguous: absolute plus relative ("Tue Oct 14 (2 days ago)").
- **Time zones** are explicit wherever behavior depends on them, and become decisions, never assumptions taken from the developer's machine; daylight-saving boundaries get an example when relevant.
- **Numbers and currency** follow the user's locale in prose and stay raw in code and receipts.

---

## 14. Qualification and measurement

### 14.1 Targets (PRD Section 1.6, provisional)

| Target | Instrument |
|---|---|
| Install to engaged ≤ 5 min; first useful outcome ≤ 15 min median | Timed J-01 and J-02 sessions; log timestamps |
| ≥ 70% of seeded consequential misreadings caught before building | J-02 and J-03b with seeded examples (AC-24) |
| ≥ 30% fewer active human minutes per accepted outcome than a competent native baseline | Pilot with consented observation (AC-12) |
| Resume ≤ 2 min; 0 unnecessary repeated questions | J-05a; question-type rates |
| 0 duplicate approvals; ≤ 3 Tenet-caused host prompts per Standard task | AC-21; SP-12 |
| Comprehension ≥ 80% correct | After each result: "what was checked, what wasn't, what's the risk?" |
| Recovery success | Seeded interruptions, denials and missing tools |
| Reading guide usefulness | Did reviewers open the listed places; did they find seeded issues there; time to accept |
| Style parity | Concise readers state verdict, scope and risk as accurately as Balanced readers |

Metrics are frozen before qualification; necessary decisions are never "optimized away" to improve a number.

### 14.2 Session scenarios

Observe complete sessions with people who have never seen Tenet, know or don't know the repository, use assistive technology, misread an example, decline a recommendation, stop halfway, or need recovery rather than a successful build (PRD Section 6.8):

| Scenario | Must demonstrate |
|---|---|
| Clear small fix | No preview, no unnecessary questions |
| Ambiguous feature | The misreading is caught at the preview |
| Fully specified request | Preview shown, no extra stop (UX-D1) |
| Dirty tree | Personal edits protected; one specific question at most |
| Review, then selected fixes | Zero writes during review; only selected scope changes |
| "Don't change anything" | No `.tenet/` created |
| Unsupported stack | Honest boundary and a useful alternative |
| Declined test | Weaker headline, stated once, no nagging |
| Cancel mid-check | No false completion, no implicit rollback |
| Uncertain commit after a crash | Reconciled before any retry |
| Changed shared policy | Effect on the current action explained |
| Lost local state | No invented evidence or carried-over permission |
| Budget exhausted | Bounded proposal and a usable handoff |
| Screen-reader recovery | The user understands the state and completes the next action |

The first prototype exercises four end-to-end sessions: a clear bug fix, an ambiguous new feature, a review followed by selected fixes, and an interrupted task with conflicting human edits.

### 14.3 Research ethics

Pilot recordings and repositories need separate, specific consent, access control, retention limits and withdrawal handling; product use never implies research consent (PRD Section 6.7).

---

## 15. Decisions and alignment items

### 15.1 UX decisions

| ID | Decision | Choice | Decided by |
|---|---|---|---|
| UX-D1 | When the preview stops | Only when Tenet added something the user did not say; otherwise shown and proceeds | Owner, Oct 18 |
| UX-D2 | Verdict wording | Plain headline plus the exact endpoint term | Owner, Oct 18 |
| UX-D3 | Where spoken settings go | Routed by kind; project facts local first with a share offer | Owner, Oct 18 |
| UX-D4 | "Don't commit" | Honored per task; no persistent setting | Owner, Oct 18 |
| UX-D5 | Review entry point | `/tenet-review` (visible, zero-write) and `/tenet review` both accepted | Spec default |
| UX-D6 | Symbols | Words carry meaning; ✓ and ✗ optional; no colored emoji | Spec default |
| UX-D7 | IDs | Hidden in Guided; short IDs after the words in Balanced and Concise | Spec default |
| UX-D8 | Reading guide in Quick | Only when a shortcut, persistence or auth file, or an unpredicted path changed | Spec default |
| UX-D9 | Wireframes | Text only in R1; HTML in R1.1 with the browser tool | Spec default |
| UX-D10 | Acceptance versus integration | "Accept" records acceptance and offers integration; integration only on request or `auto-on-accept` | Spec default |
| UX-D11 | Tenet panel | None in R1; revisit only on evidence | Spec default |
| UX-D12 | Voice | One teammate voice, even when specialists ran | Spec default |
| UX-D13 | Index staging guarantee | Exact, through Git's own lock; untouched-and-reported fallback | Owner, Oct 18 |

### 15.2 Alignment items for the tech spec and PRD

All six items are adopted in tech spec v1.0 (the sections named).

| ID | Change | Where | Why |
|---|---|---|---|
| A1 | `finish --no-commit` for a per-task "don't commit" | TS §6.5, TS §10.3 | UX-D4 |
| A2 | Proposed basis elements carry `origin` (`request` or `tenet`); `decide {propose: basis}` returns a question when any element is Tenet's or the sketch adds a commitment, otherwise records the basis as confirmed from the request | TS §6.5, TS §7.2, TS §8.7 | Makes UX-D1 checkable rather than cooperative |
| A3 | `Result.label` uses the §4.1 strings | TS §8.3 | UX-D2 |
| A4 | Spoken-setting homes and the share offer | TS §8.5 | UX-D3 |
| A5 | Index sync under Git's own `index.lock` (copy, update with Git, atomic rename), so the PRD's exact preservation promise holds; a held lock or split index leaves the index untouched and reports the paths | TS §10.3 | Owner decision Oct 18 (UX-D13) |
| A6 | Publish `tenet.policy.schema.json` and reference it with `$schema` | TS §7.8 | §8.4 editor autocomplete and validation |

---

## 16. Traceability

**PRD Section 11.4 UX obligations:** accessibility (§13.1, §12); localization (§13.2); command syntax and wording (§3.2, §4); contract and result presentation (§5.2, §5.5); example confirmation (§5.2); risky choices (§5.3, J-06); findings and evidence inspection (§5.8, §5.7); research data (§14.3).

| PRD area | Sections |
|---|---|
| Entry and installation (INS) | 3.2, 4.2, J-01 |
| Intent and basis (INT) | 5.2, 5.3, 5.10, J-02, J-05b, J-10 |
| Work and steering (WRK) | 3.3, 5.4, 7, J-12 |
| Review (REV) | 5.8, J-04 |
| Results (RES) | 4.1, 5.5, 5.6, 5.11 |
| Git (GIT) | J-03b, J-06 |
| Continuity (CON) | 3.2, J-05a, J-07 |
| Security and privacy (SEC) | 5.3, 9, 10 |
| Configuration and learning (CFG, LRN) | 8 |
| Resources and models (RSC) | 5.11, 9 |
| Generated software quality (QLT) | 12, J-08 |
| Experience qualification (PRD Sections 6.6–6.8) | 14 |
