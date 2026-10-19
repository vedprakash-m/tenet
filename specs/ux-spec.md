# Tenet - UX Specification

> v0.5 | October 18, 2026 | Draft for review | Implements [PRD v0.17](PRD.md) with [Tech Spec v1.3](tech-spec.md)

## 0. About this document

### 0.1 Purpose, precedence and scope

This specification defines **how Tenet feels and reads**: the interaction model, the four recurring shapes, wording, journeys, configuration, recovery, accessibility and how the experience is qualified. It answers the UX obligations of PRD Section 11.4.

**Precedence:** the PRD owns semantics; the tech spec owns mechanisms. This document owns wording, layout, interaction order and command syntax, and **never changes semantics**: no wording may make a claim stronger, a gate weaker or an authority broader than the kernel records. Experience needs that require a mechanism change are listed in §15.2.

**Scope:** R1 is qualified for the technical builder on the PRD Section 2.2 tuple. Later personas and software families (§2.2, §11) constrain R1 choices so they are not foreclosed, but are not R1 obligations.

### 0.2 Conventions

- **Rules are normative; examples are illustrative.** Example copy is tuned in formative sessions (§14) but must obey every rule here; an example that contradicts a rule is a defect.
- **Limits are defaults, not caps on truth.** Line, option and entry counts shape ordinary output; material information is never hidden to fit one.
- **Define once, cite by section:** `§n` is this document, "TS §n" the tech spec, "PRD Section n" the PRD. Personas use they/them.
- **Examples of chat output are shown as quoted Markdown,** the way they render (§4.5).

### 0.3 Where each part lives at runtime

Skill budgets are tight (TS §5.1), so each rule ships in one place:

| Content | Ships in |
|---|---|
| Inspect-versus-act rules, steering, the four shapes, headline wording, voice | `tenet` agent body and `tenet` skill |
| Kickoff for Standard and Deep, the stop rule, impact questions, plan framing | `tenet-intake` |
| Style deltas (Guided, Concise), the Guided app launch | `guided.md`, `concise.md` |
| Dirty-tree, integration, undo and PR wording | `git.md` |
| Spoken settings, setup | `config.md`, `setup.md` |
| Recovery wording (§10) | `continuity.md` |

---

## 1. The experience contract

### 1.1 Promise

> Describe what you want. Tenet shows what "done" will mean in your own examples, does proportionate engineering, and leaves you with a result you can try, read quickly and trust, plus one clear next step. The project stays an ordinary repository you can maintain without Tenet.

**First value:** about five minutes from install to a real task, and a useful result (a checked change, a review, a plan, a diagnosis or a justified "no change needed") in a provisional median of fifteen minutes on a ready project (PRD Section 1.6), with **no setup unrelated to the task**.

### 1.2 Six questions a user can always answer

From the screen, or one "status" away: (1) Did Tenet understand what I want? (2) Is it respecting my project, my edits and my earlier decisions? (3) Is it working, waiting for me, or stopped? (4) What has actually been shown to work? (5) What is uncertain, missing or not claimed? (6) How do I steer, interrupt, undo, resume or leave?

### 1.3 Principles

| # | Principle | Rules out |
|---|---|---|
| P1 | **One teammate, one door:** `/tenet <anything>`; one voice even when specialists ran | Mode menus, agent rosters |
| P2 | **Carry out authorized routine work; ask only when the user must decide** (INT-03) | Intake forms, "OK to proceed?", questions about implementation detail |
| P3 | **Necessary questions are not friction:** authority, material changes and consequential ambiguity are always asked | Optimizing safety questions away |
| P4 | **Claim, then evidence:** the first line says what is true; the next say how to try it, what ran, what is not claimed | "Done!", confidence without evidence |
| P5 | **Never surprise the working tree** | Silent staging, tidying, committing |
| P6 | **Depth follows the change, not the person** (PRD Section 3.6) | Lighter checks for experts |
| P7 | **Same truth in every voice:** style changes words, never rigor | A weaker "simple mode" |
| P8 | **Quiet unless something changed;** inspecting never starts work | Narrating every step |
| P9 | **Cheap to read:** every Standard result says where to look and why | Unguided diffs; unread code |
| P10 | **Language is the control surface;** files are for seeing and diffing, never required to proceed | Editing JSON to make progress |

### 1.4 What we will not build in R1

A dashboard, panel, kanban or agent graph; a model picker or credit meter; an onboarding wizard or tour; streaks, celebrations or confidence percentages; auto-continue or auto-accept; a separate product for bugs, features, other languages or infrastructure. If users lose track of the latest result, the remedy is "show that again" (§7), not a panel (UX-D11).

---

## 2. Users

### 2.1 R1 personas

| Persona | Trying to | Optimize | Must still see |
|---|---|---|---|
| **Maya, technical builder** (primary) | Build and evolve several local projects without re-coordinating process | Time to a tryable result; respect for conventions; a short reading list | The headline, its scope and limits |
| **Sam, maintainer** | Fix or extend code they did not write today, often with a dirty tree | Reproduction before repair; untouched personal edits; honest pre-existing failures | What was left alone; what was pre-existing |
| **Riley, reviewer** (individual use) | Get a consistent critique, then fix only selected findings | Zero project writes during review; findings worth acting on; PR briefs | That review is not a checked build |
| **Jordan, contributor** | Improve a recipe, skill or adapter safely | Clear contracts and conformance fixtures | The provenance of what they ship |

Tenet never asks "what kind of user are you?"; it infers the job from the request and adapts to the user's words. Circumstances matter more than titles (familiar or unfamiliar repository, clear or exploratory request, valuable data, external effects, tight allowance, access needs) and are handled by existing mechanisms: lanes, traits, envelopes, resource mode and style.

### 2.2 Designed for later

**Casey** (less-technical builder) and **Lee** (learner) arrive in R1.1: Guided wording is written now and never assumes Git, terminal or test literacy without explaining it. **Morgan** (library or CLI author) and **Priya** (Python) need ecosystem-neutral status words (`unit`, `lint`, `types`, not tool names) outside receipts. Data, ML and infrastructure (R2), teams and enterprise policy (Later) reuse the same shapes; reading guides and PR briefs are written for someone who was not in the conversation.

---

## 3. Interaction model

### 3.1 The host is the interface

| Surface | Tenet uses it for | Tenet does not |
|---|---|---|
| Chat | The four shapes (§5) | Log every kernel call |
| Native question picker | Routine choices (`channel: native`, TS §6.6) | Authority or risk acceptance (§5.2) |
| Todo list | Mirrors the next steps in plain words | Hold the plan or imply permission |
| Editor, diff, Accessible View | Everything the reading guide links to | A second diff viewer |
| Terminal approval | Host gate for kernel calls (TS §4.6) | A Tenet-branded dialog |
| Edit checkpoints, browser | Undo within a chat; showing the running app | Replace them |

### 3.2 Commands: one to learn

Users learn **`/tenet <anything>`**. Everything else is words after it: "status", "why …", "review …", "setup", "help", "feedback". The host also lists `/tenet-review`, the same read-only review, so it is visible in the slash menu (UX-D5).

| Request | Does | Writes to the project |
|---|---|---|
| A task ("add…", "fix…", "plan…", "prototype…") | Starts or continues work; Tenet picks the profile from the words | Only when implementation or durable memory needs it |
| "review …" | Read-only review | Never, including `.tenet/` and Git objects (CON-09) |
| "status", "why …", "help", or `/tenet` alone | Answers and stops | Never |
| "setup", "feedback" | A preview first | Only after consent; feedback only to a chosen path |

**Write promises are literal.** "Don't change anything" and "just explain" never create `.tenet/`; the answer stays in chat, and if checks are needed Tenet offers an investigation. "Plan only" means no source changes, and the reply says plans are kept in Tenet's local records. From a non-agent chat mode: "Switch this chat to Agent, then send it again", with the request kept.

### 3.3 Inspect versus act

The most important safety-for-ease rule: **asking never starts work.**

| User says | Meaning | Tenet |
|---|---|---|
| "status", "where are we?" while idle | Tell me what is known | Reads state, reports uncertainty; never repairs, takes ownership or resumes |
| "status", "how's it going?" during active work | A progress question | Answers in one or two lines and carries on with the authorized work |
| "what's next?" | Recommend | Proposes the next step or plan item; does not start it |
| "continue", "go on" | Act | Reconciles, asks only what's needed, resumes bounded authorized work; never authorizes anything remote or destructive |
| "show that again", "what was the result?" | Re-show | Shows the last report as it was, plus one line if anything has changed since ("web/dashboard/Reminders.tsx has changed since this result"); never claims fresher evidence than exists, and runs nothing |

### 3.4 What the user steers and what Tenet reports

**Four dials, spoken:** style ("explain more", "be brief"; default Balanced), check-ins ("only interrupt for decisions", "show each phase"; default milestones), depth ("be more careful" raises the lane; it never goes below the floor) and resource use ("prefer fewer optional agent runs"; Conserve). **Two actions after a result:** accept and integrate (§5.4). **Reported, never set:** the assistance level (§4.3) and the headline (§4.2).

Invariants from PRD Section 3.6 hold everywhere: explaining more never adds agents; Conserve never removes required review; Concise never skips evidence; "ask less" is never permission; accepting never turns missing checks into passing ones.

---

## 4. Content

### 4.1 Three truth rules (replacing word lists)

1. **State only what the evidence supports,** in its scope: "the reservation journey passed its checks", never "it works".
2. **Name scope and material limits** in the same breath as the claim.
3. **No filler, exaggeration or ritual:** no congratulation, no "certainly", no apology loops. Satisfaction comes from clear closure: "The export now keeps quoted newlines; the reproduction and required checks pass."

Unscoped overclaims never appear: production-ready, secure, 100%, fully tested, "done" without a headline. "Software factory" is the concept, not user language.

### 4.2 Headlines (UX-D2)

The headline is a plain phrase plus the exact endpoint term in code font (Guided omits the term; "why" always shows it). The phrase names the **activity**, and scope is part of it whenever the result is not a clean commit (TS §8.3). These strings are the kernel's `Result.label` (A3, A10).

| Endpoint | Headline by situation |
|---|---|
| `checked-local` | **Checked locally** (`checked-local`), committed on `<branch>` · **…, uncommitted** (as you asked) · **…with your uncommitted edits present; committed without them** (the commit alone was not re-checked) |
| `implemented-unverified` | Evidence missing or declined: **Built, not fully checked** (`implemented-unverified`), followed by what passed and what is missing or declined · A required check actually failed: **Built, a check fails** (`implemented-unverified`), naming the failing check in the same breath: "Built, a check fails: the dashboard journey (Reminders.tsx:41, timeout waiting for the toast)" |
| `prototype` | **Prototype, not checked** (`prototype`) |
| `findings-only` | **Review complete, no project changes** · **Plan ready, no source changes** · **Investigation complete** (`findings-only`) |
| `blocked` | **Can't continue** (`blocked`): the one missing prerequisite and one safe next step |

A demo, mock, screenshot or focused test never receives a headline. Partial work names the increment: "Reservations (step 2 of 4): Checked locally …". Provenance is noted, not mixed into the verdict: "(built with a community recipe)".

### 4.3 What Tenet can do here, in words (INS-12)

Said once, in the kickoff:

| Level | Say |
|---|---|
| L4 | "I'll build and check this locally" (one clause, folded into the kickoff) |
| L3 | "I can make this change; this setup isn't one I can fully check (<reason>)", for example an experimental runner or JavaScript-only project |
| L2 | "I can plan this. To build it, <readiness step> first", or "Planning only, as you asked" |
| L1 | "I can read and review this project; I can't build or check <stack> yet" |
| L0 | "I can't work here because <boundary>", plus what still works and who can change it |
| No Node.js | "Advisory review only: Tenet's helper needs Node 22.12+", with the official installer link |

### 4.4 Words for internal ideas

| Internal | User sees |
|---|---|
| Lanes | "Quick" is never named; "Standard" and "Deep" appear with a one-clause reason |
| `subagent-fresh` review | "an automated reviewer" (named once per report), then "the reviewer" |
| Assumption | "for now, <assumption> (easy to change later)" |
| Marker, attention item | "a shortcut", for example "`as any` at loans.ts:41" |
| Capture `reported`, `usage: unknown`, handles, reservations, receipt IDs | Only in "why" and diagnostics; usage once per contract (§9) |

**IDs (UX-D7):** chat uses plain numbers for examples, findings and plan items ("fix 1 and 3"); a number stays bound to its review or plan, so "fix 2" never refers to something renumbered. Stable IDs (`W-0007`, `REQ-012-q7k`) appear in files, test tags, commits, status details and "why".

### 4.5 Rendering in a narrow chat pane

- **Cards are Markdown,** never code blocks: bold labels, short lines, real file links (`loans/service.ts:40` opens the file). Code blocks are only for commands to copy.
- **Choices are numbered,** with "(recommended)" as a word; in pickers they are real controls. Every choice also works as a typed reply. No ●/○ glyphs, no color-only or position-only meaning; ✓ and ✗ only reinforce "passed" and "failed".
- **Lead line first;** at most one table per message, at most 4 columns.
- **Reason codes** follow the human sentence in code font, so they stay searchable: "Shortcut needs your decision (`marker-unaccepted`): …".

### 4.6 Styles

| Style | First green |
|---|---|
| Guided | "All three examples now pass: someone two days late sees a reminder, someone due today doesn't, and returning the item clears it. Next I'll run the project's full checks, then an automated reviewer will look over the change." |
| Balanced | "The examples pass. Full checks and the automated review are next." |
| Concise | "Examples pass · full checks + review next" |

**Style test:** a Concise reader can still state the headline, its scope and any open risk. Style removes explanation, never options, limits or warnings.

---

## 5. The four shapes

Users learn four shapes once (UX-D14). Every message is one of them.

### 5.1 Kickoff

**When:** the first reply to a task. **Anatomy:** what Tenet will do and can do here · examples (Standard, Deep) · what it won't touch, when there is a real boundary · what it needs from the user, if anything (the stop).

**Quick variant: no preview, one line, then the work** (intent first; reproduction and cause are claims, so they appear once true):

> Small, contained fix. I'll reproduce it, then repair it with the project's existing tools. Your 2 edited files stay out of this.

**Standard and Deep variant (the contract preview, WRK-01).** About 8 lines when nothing needs deciding:
- **Outcome**, in one sentence.
- **Examples**, each marked *new* (should fail before the change) or *keep* (should stay as it is). Tenet's additions are labeled "(added)".
- **Never:** invariants.
- **Design:** the sketch, one or two lines, when structural (TS §8.7); Guided gives one plain sentence with "show design".
- **Won't touch:** only an actual boundary (protected paths, stated non-goals).
- **Checks:** one line, plus anything below "Checked locally" ("this setup can't run the browser journey").

**The stop rule (UX-D1).** The kickoff waits for a reply only when Tenet added something the user did not say: an example, an assumption, or a sketch commitment on behavior, data, access, compatibility or an interface others consume (TS §8.7, `basis-confirm`). Because INT-15 adds at least one boundary or negative case for each new requirement, **a new requirement normally stops once** — this is deliberate, not a gap: the kernel never classifies whether an addition merely restates the user's own words (A13, rejected), so any Tenet-written case gets the stop, always as light as possible:

> **Overdue reminders** · Standard: this changes what the dashboard shows.
> **Outcome:** borrowers overdue by more than a day see a reminder.
> **Examples:** 1. Overdue 2 days → reminder shown (new) · 2. Due today → no reminder (keep, added) · 3. Returned late → reminder cleared (new, added)
> **Never:** a reminder shows another borrower's name.
> **Design:** extend the loans service; one place computes "overdue"; no email yet.
> **Checks:** unit and integration, the dashboard journey, lint, types.
> Examples 2 and 3 are my additions. Reply "ok", or tell me what to change. "Make it smaller" splits it into steps.

When everything came from the request (selected review fixes, refactors, requests that state their own boundaries), the kickoff shows the same lines and ends: "Writing the example tests first. Reply if this isn't right." Each kernel call is preceded by a check for new user messages (TS §5.2), so a typed reply is seen before the next kernel call, including before product code is written. The host's Stop control is different: it cancels the turn rather than delivering a message, so it is offered only to halt, never as a way to adjust (§10).

**Front-loaded consents (UX-D16).** Anything the kernel can already determine at `open` is asked in the kickoff, in one grouped question, never invented later: Git initialization in a non-Git folder (GIT-01; its own explicit, numbered choice, never folded into a picked-for-you "ok" — recommended), filter consent for this configuration (known from the dirty-tree inventory), a network envelope, a dirty file that already overlaps a scope the kickoff names. **Commit-hook consent is different:** hooks are only inspected right before the first commit, so a Quick fix or a clear Standard task is never stopped early just to ask about them; it is asked once, immediately before that commit, and remembered by the hook configuration's hash so the same project is never asked twice. A scope overlap discovered only once work is underway is asked the same way, in the Question shape, the moment it is found — never invented at kickoff when it isn't yet knowable. "Ok" to a kickoff accepts exactly the recommended picks shown as their own visible lines (including a Git choice); it accepts nothing that wasn't shown.

**New project.** The kickoff carries the plan and the first step's choices in one card, with Git initialization as its own visible, numbered pick (GIT-01: offered, never assumed), answered with one reply:

> I'll build this as a small TypeScript web app on your machine.
> **Version control:** 1. Start Git here, so every commit is a checkpoint you can review or undo (recommended) · 2. No Git: a prototype, not a checked result
> **Plan:** 1. See what's available · 2. Reserve items · 3. Returns · 4. Reminders. Step 1 first; each step is runnable before the next.
> **Two choices for step 1** (my picks first): 1. Who sees who borrowed what? Only you (recommended) / everyone signed in. 2. …
> **Step 1 is done when:** a borrower sees what's available, never other people's names (added).
> **Screen:** a list of equipment, each with "available" or "on loan". Reserve and return arrive in later steps.
> Reply "ok" to accept my picks (including Git), or change anything — for example "2 for version control".

The screen line (UX-D9) is one sentence, or at most a 6-line text sketch preceded by that sentence, included only for new screens and never offered as a separate question. Each increment's screen shows only what that increment can do; a control for a later step never appears early. Guided style explains Git once: "Git keeps a history of every change, so anything I do can be reviewed and reversed."

**Deep variant.** Adds the reason and the expected effort in words, never currency (RES-09): "Deep: this changes the schema and who can see loans. Expect about 4 automated review and analysis sessions and the full checks twice." If the model configuration has not been evaluated for Deep: "This model configuration hasn't been evaluated for Deep work. Continue with that limitation, or pause?" (RSC-08; no model menu, no suggestion to switch).

**Lane rises mid-task.** A short kickoff, not the full preview: "This also changes how sessions are stored, so I'm treating it as Standard. One new example: a signed-out session can't be reused (added). Reply 'ok' and I'll continue from here; nothing done so far is lost."

### 5.2 Question

**When:** only when an answer changes the next action, the authority or the claim. **Anatomy:** one line of context · numbered choices, recommended first, each with its consequence and how hard it is to change later · free text always accepted. Usually at most 3 per group; a fourth material question is never hidden to fit.

**Channel by consequence, not by label** (TS §11.4, SEC-13):

| Consequence | Examples | Channel |
|---|---|---|
| Routine clarification or consent with no outside effect | A product rule, a commit-hook consent, a recovery fact ("has the other chat stopped?") | Native picker |
| Authority or risk | Widening scope; protected paths; push or PR; delete, reset or undo; accepting a shortcut or residual risk; an envelope that may send project content out | **Plain chat; Tenet ends its turn** |

Authority questions end with a short, concrete reply cue (Autopilot can answer pickers, so authority is never a picker; the reason is in "why authority"):

> May I change server/auth/session.ts for this password-reset fix? It applies to this work only. Reply "allow for this work", or "leave it unchanged".

**Rules:**
- Search before asking; never ask what the repository, lockfile or history answers.
- **Implementation detail is never a question.** A newly found code path that the agreed outcome requires is explained and included ("Mobile checkout uses the same discount rule, so it gets the same change"). Ask only when the discovery changes behavior, compatibility, data exposure, a protected path or authority.
- **A shortcut Tenet can avoid, it removes.** Acceptance is asked, in chat, only when a shortcut is genuinely needed (TS §8.7).
- Apply partial answers to independent work; a bare "yes" after several questions applies only where it is unambiguous.
- Silence, timeouts and pre-selected options are never consent. Reconfirm only when the facts changed, and say what changed: "You allowed pushing 4e1c2a9; the branch now points to 9b07d1e. Push the new commit?"
- Never ask about distant plan items before they matter; never ask a routine final approval (RES-03).
- High-risk domains get one standing line in the result: "These are software checks, not a clinical, financial or safety sign-off" (SEC-16).

**Variants:**
- **Change of direction (INT-08):** a delta, never a rerun of intake. "You want admins emailed about overdue items. Changes: a new external effect and one new example. Affects: this work (it becomes Standard) and the Reminders step. Unaffected: items, reservations, returns. 1. Add to this work (recommended) · 2. A later step · 3. Cancel this work."
- **Surprise that changes behavior:** Expected · Found · Why it matters, then choices.
- **Overlapping dirty file:** see J-03b.

### 5.3 Check-in

**When:** per the check-ins dial: *minimal* (decisions and end); *milestones*, the default (first green, review done, end; TS §6.6) — the kickoff reply itself already confirms the basis, so a check-in never repeats "basis settled"; *each phase*. **Anatomy:** one line, what finished and what's next. A check-in never asks unless a question is due.
- A planned failing test is progress: "Example 1 fails before the change, as it should."
- A long check gets one line when it starts ("Running the full checks; about 4 minutes last time"), with no progress percentages.
- **Before a host approval,** Tenet says what the user is about to approve, worded so it holds whether or not the host actually prompts (approval mode is not observable to the kernel): "Committing the fix now; approve in VS Code if it asks." The approval prompt then makes sense when it appears, a pause is clearly the host waiting and not Tenet stalling, and the line stays true unchanged under an auto-approve rule, where no prompt appears at all.
- The research model is mentioned in the check-in the first time research runs: "Looking up how sessions are stored, with a cheaper read-only model; say 'use my model for research' to change." (PA-6)
- Tenet never answers host pauses such as "Continue to iterate?" (WRK-10).

### 5.4 Report

Every report uses one anatomy: **headline · evidence · read or limits · next.** Result, findings, status, why and recovery are variants.

**Result.** Evidence spends lines on exceptions, not successes; when all passed, it is one line:

> **Overdue reminders: Checked locally** (`checked-local`), committed on tenet/w-0007.
> **Try it:** npm run dev, sign in with the development account printed at startup, open the Dashboard (local only, not a shared machine).
> **Evidence:** example 1 failed before and passes now; all 148 tests, lint, types and the dashboard journey pass; an automated reviewer passed the change (1 major finding fixed).
> **Limits:** "overdue" uses the server's timezone, as you chose.
> **Read first:** [0007.sql](server/db/migrations/0007.sql): persistence change, read before accepting · [service.ts:40](server/loans/service.ts): the overdue rule · +1 more
> Say "integrate" to merge into main, or "accept" to keep it on tenet/w-0007.

- **Try it (RES-05, RES-08):** in Guided style, Tenet offers to start the app (under the host's consent), confirms the URL responds, says where the development credentials are (local only, not a shared machine) and how to stop the app, and gives one domain task to try. The running demo is never presented as test evidence, and verification databases stay separate from development data. For a library, CLI or back-end change with nothing to open, the line is **Use it:** a command or call to run instead, and it is omitted entirely when nothing is user-facing.
- **Reading guide (TS §8.3):** Standard and Deep; in Quick only when a shortcut, persistence or auth file, or an unpredicted path changed (UX-D8). **Three entries, then "+N more"**, ordered: what needs judgment (findings, shortcuts, unplanned paths, and `auth`, `persistence` or `external-effects` changes marked "read before accepting", which are never collapsed); then the main path in the order the sketch listed; then tests by example. Each entry says what to look at. It is guidance from records, never a claim that anyone read the code.
- **Not shown unless abnormal:** environment variables passed or dropped, containment, usage. They live in "why".
- **Increment versus plan:** an increment names its step ("step 2 of 4"). The last step closes the plan once, stated as what the current candidate just passed, not a replay of each step's separate history: "All 4 planned steps are built; this candidate passed the required checks, including the browse, reserve, return and remind journey end to end. Say 'what's next' for anything beyond this plan." Asked about one earlier step directly, Tenet says whether that step's own result still holds: "Reservations last checked at commit 9f1c2; nothing since has touched it" or "touched by the Reminders change; recheck before relying on it alone" — the same freshness rule as "evidence out of date" (§10).
- **Incomplete:** "Overdue reminders: Built, not fully checked. Passed: the examples, unit and integration tests, lint, types. Missing: the dashboard journey (Playwright's browser isn't installed). Fix: 'install the browser' (I'll preview the download first), then 'check again'." When a required check actually failed rather than being missing, the headline says so instead (§4.2): "Overdue reminders: Built, a check fails. Passed: the examples, unit tests, lint, types. Failing: the dashboard journey (Reminders.tsx:41, timeout waiting for the toast)."

**Accept and integrate (UX-D10).** A clean result never asks for acceptance; its next action names both verbs so neither "ok" nor "accept" is ambiguous (§7.2). "Integrate" records acceptance and integrates in one step (after the conflict prediction and branch-switch note, J-06). "Accept" or "looks good" records acceptance and keeps the work on its branch: "Accepted on tenet/w-0007. Say 'integrate' any time." Acceptance after a preview, wireframe or plan applies only to that artifact. Nothing remote ever follows from an acceptance phrase. **The `integration` setting changes what the next action says, never what "accept" does:** at `offer` (default) the result asks as above; at `auto-on-accept` it states the consequence before it happens, "Accepting this will also integrate it into main, following your project's setting. Say 'accept' to do both, or 'keep it on the branch' to accept only."; at `never` the integrate mention is omitted and only "accept" is offered.

**One offer per report (UX-D15).** The next action already covers integrate when relevant, so integrate is never repeated as a separate offer. Besides the next action, at most one offer: adopt shared files (first checked result only, never deferred past it) · the approval rule tip, shown the moment a second routine Tenet approval lands in the same session, ahead of anything else queued ("Approving routine Tenet steps one by one? Say 'reduce approvals' for a safe one-line rule.") · share unshared project settings (batched) · an evidence-backed lesson. An offer is visible without needing a reply; a decline is remembered. The one-time controls note ("How I keep this honest: say 'why controls'") is a footer on the first report in a project, not part of the queue.

**Findings.** Material findings get substance at once, so they can be prioritized without asking:

> **Review complete, no project changes** (`findings-only`) · 14 files at abc123 · nothing written, no project checks or scripts run.
> **1. Blocker:** password changes leave existing sessions active. A stolen session stays usable after a reset. Fix: revoke sessions on password change and test the old cookie. [auth/session.ts:88](auth/session.ts)
> **2. Major:** a test "rejects expired token" asserts nothing, so it can't fail. [auth.test.ts:120](auth.test.ts)
> **3. Minor:** duplicates the helper in lib/validate.ts. [auth/validate.ts:5](auth/validate.ts)
> **Coverage:** 14 changed and 9 related files read; 2 callers sampled.
> Say "fix 1 and 2", "explain 3" or "PR brief".

Questions and optional ideas are listed separately; a partial review says "partial" in its headline; "no material findings in what I read" never implies a checked build. If unconsented Git filters were configured, the header adds "uncommitted edits weren't read (filters need your consent)" (TS §9.4). "Fix 1 and 2" scopes a contract to exactly those findings (RES-06), at whatever lane their risk requires, and repeats the others as still open.

**Status.** Answers the six questions in about 6 lines, and never starts work. While work is active, it reports progress and keeps going — never a resume prompt, since nothing is paused (§3.3):

> **Overdue reminders** · checking now (attempt 2 of 3); I'll report when it finishes.
> **Plan:** ✓ items · ✓ reservations · now reminders · next returns.
> **Open:** 1 major finding so far: overdue count off by one ([service.ts:61](server/loans/service.ts)).

While parked, it names what's out of date and offers to resume:

> **Overdue reminders** · paused before review (attempt 2 checked).
> **Plan:** ✓ items · ✓ reservations · now reminders · next returns.
> **Out of date:** the dashboard journey (you edited Reminders.tsx).
> **Next:** check again, then review. Say "continue" to resume.

Budgets and agent counts appear only at 80% of a limit or in "why budget". After context compaction, Tenet recovers its state silently (TS §5.2); status is shown only when asked.

**Why.** At most 10 lines: the effective value · where it came from · what overrides it · what it does not do · how to change it. Topics: headline (every reason a stronger one wasn't reached), lane, level, a setting, a control ("I detect changes to locked tests; I can't prevent them"), **a control's assurance** ("Checked locally: receipted checks and an independent reviewer, no protected CI yet" — TS §0.7, EVD-07), authority, model, cost.

**Recovery.** The same anatomy with "Paused" or "Can't continue" as the headline:

> **Paused: Copilot reported a usage limit.**
> **Kept:** the last recorded checkpoint (attempt 2 checked; review not started). Anything changed since will be inspected before resuming.
> **Not done:** no retry, no other model, no new paid capacity started on your behalf.
> **Next:** say "continue" in any chat later; counters and evidence are kept.

Section 10 lists the situations.

---

## 6. Journeys

Each journey uses the shapes above; only what is specific is stated. Verification scenarios are in §14.2.

### J-01 Install and first value

1. **Before install,** the README states what Tenet adds; prerequisites (VS Code with Copilot agent mode, Node 22.12+ or 24, Git); qualified versus experimental environments; that it runs locally and does not deploy in R1; that it ships helpers and, once qualified, observer hooks; the Autopilot limit on answers; how to verify the publisher; how to remove it. Plus three starter requests: a new app, a bug fix, a review.
2. **Install** through the host's plugin flow, with no cloning, JSON editing, API keys or extra runtime.
3. **The first message is a real task.** Readiness covers only that task: a review needs no test tools, and an explanation needs no Git.
4. **Missing prerequisite:** name it, link the official installer, offer what works now; never install machine prerequisites: "I can review this project now. To build and check I need Node 22.12+ (you have 20.11): install it from nodejs.org, then say 'check readiness'. Want a review meanwhile?"
5. **Value**, then the first report's footer and its one offer (§5.4). Setup stays optional.

### J-02 New project

Request → kickoff with the plan and choices (§5.1, one reply) → scaffold verified and committed → milestones → result with "Try it" and the adoption offer: "Save the app's purpose, plan and decisions as files in the project, so the next change starts with them? (preview first)". If a remote exists, the preview says adopted files become ordinary repository content its readers can see; a decline is remembered. "What's next?" proposes step 2 and nothing is re-asked. Alternatives: "no Git" leads to a prototype (J-09) or a read-only plan; stopping halfway is J-05a.

**A thin first answer gets one real follow-up, not a silent pass.** If your reply to "who sees what" or a non-goal is a half-sentence, the kickoff asks one concrete follow-up on that point before drafting the plan — never a second round on the same question, and never on anything you already answered substantively.

**The kickoff also carries two more proposals, shown, not asked as separate questions:** a starter-specific protected-paths default — "I'll protect `platform/auth`, `platform/session` and `migrations/` by default; say 'skip that' to leave nothing protected" — and, only when the instruction file the host loads has no content of your own in it yet, a short draft of general conventions to adopt into it (stack choices, naming, where things live), previewed the same way as everything else Tenet ever writes. Neither repeats once declined or once real content already exists.

### J-03a Bug, Quick

One-line kickoff stating intent (§5.1) → repair, checks and a focused pass → result, with the dirty-tree caveat in Limits rather than crowding the headline:

> **CSV newlines: Checked locally** (`checked-local`), alongside your 2 uncommitted files.
> **Evidence:** the reproduction failed before and passes now; all 412 tests, lint and types pass; focused review found nothing.
> **Limits:** committed on tenet/w-0021 without your 2 files; the commit alone wasn't re-checked.
> **Unchanged and outside this fix:** 2 flaky e2e tests in upload.spec.ts.
> Say "integrate" to merge into main, or "accept" to keep it on tenet/w-0021.

If the fix truly needs a shortcut, one chat question at the end asks to accept it. If the bug turns out to touch auth or persistence, the lane rises with a short kickoff (§5.1).

### J-03b Feature in an existing codebase, Standard

1. **Respect first:** "This project already has reservation validation and a shared date parser; I'll extend those." Designated planning documents are reused (INT-13); no `INTENT.md` is pushed.
2. **Unrelated dirty files** are left alone without a question. An **overlapping** one is a kickoff question, kept to three choices per the question rule (§5.2) — "don't commit" (UX-D4) already covers editing in place without committing either set, as a standing word for the whole task, so it is never a fourth menu item here:

   > loans/service.ts has your uncommitted edits, and I need to change it too.
   > 1. Wait while you commit or set aside your edits yourself, then say "continue" (recommended: keeps your work and mine separate)
   > 2. Include your edits in this work (they'll be committed together)
   > 3. Leave that file out (the change may be incomplete)
   > (Say "don't commit" instead, at any point, to have me edit alongside your changes without committing either set.)

3. Preservation tests capture current behavior ("current invoice totals are captured in 4 tests"), then the kickoff and build.
4. **Pre-existing failures** get an honest line: "Fails before and after my change: dates.test.ts (pre-existing, excluded)", or "Couldn't tell (your starting edits changed since)".
5. The reading guide includes consumers symbol search misses (a cron script parsing a field, a stored column).

### J-03c Behavior-preserving refactor

Quick or Standard by risk: name what must not change → preservation tests that pass today → refactor → recheck → result says what became simpler and what stayed the same ("one validation path instead of three; public API unchanged"). No artificial failing test (TDD-05, TDD-06).

### J-04 Review, then selected fixes

Resolve the scope (a document, uncommitted changes, a branch against its base, files) and state it with the revision → findings report (§5.4) → follow-ups: "explain 3", "PR brief", "fix 1 and 2", or "finding 2 is wrong because …" (a dispute is recorded with the user's evidence and either withdrawn or decided by the user, never silently dropped; TS §8.4). "Run the tests too" offers an investigation: "That writes Tenet's local records, not your source."

### J-05a Continue after an interruption

"Continue" (not "status") resumes. When nothing changed, one line: "Back on Overdue reminders, paused Tuesday before review. Nothing changed; continuing." When something changed:

> **Back on Overdue reminders** (paused Tuesday before review).
> **Changed:** you edited web/dashboard/Reminders.tsx; main moved 6 commits.
> **So:** the dashboard checks are out of date and the review must run.
> Keep your Reminders.tsx edits in this work? 1. Yes · 2. No, leave them out

The takeover question ("The earlier chat was mid-implementation. Has it stopped?") appears only if that chat may still be working, and is never decided by a timer. Settled decisions return from records, so nothing is re-asked.

### J-05b Refine, pivot or reject an interpretation

| Change | Experience |
|---|---|
| Presentation ("be brief") | Applied at once, for this task |
| Refinement within the agreed outcome | Applied; mentioned in the next check-in |
| Material change (behavior, data, access, compatibility, authority) | Change-of-direction question (§5.2) |
| Rejected screen sketch | The agreed behavior stays; only the screen is redrawn |
| Internal implementation adjustment | No question unless a sketch commitment changes |
| An unrelated improvement noticed | Noted as "noticed, not changed" (QLT-10) |
| A second task while one is active | "That's separate: add it as a later step, or switch to it now (this one pauses)?" |
| A side question ("what does this function do?") | Answered; the work continues |
| "This is taking too long" | The real levers: make it smaller · fewer optional agent runs · pause with the handoff |
| "Fix all of these" after a review | Findings become **one contract** covering the whole accepted set (RES-06), splitting into plan steps only if the combined scope exceeds one increment — never one contract per finding |
| "Fix all of these" naming independent, unrelated asks | A bounded batch: every item's kickoff and consent gathered into **one combined kickoff** before the first starts, then run in turn to one combined report |

A basis change after checks passed says exactly what is out of date ("the review must run again; the tests still count"). A bug in Tenet's earlier work is linked to the example it contradicts, reproduced and fixed: "Example 3 should have caught this; I've added the missing case."

### J-06 Integrate, hand off, publish, undo, don't commit

- **Integrate:** Tenet predicts conflicts before anything moves; the integration question itself says "this switches your editor to main". On "integrate" it merges, rechecks the combined result when main moved, and reports where the work now is. Branch cleanup is an offer, never a prompt.
- **PR brief:** problem and outcome, important choices, validation, compatibility or data effects, open findings and limits; no chat transcript, private intent or credentials. **Push or open a PR** is an authority question bound to the remote, branch and exact commit, with the brief shown first: "Reply 'push' or 'cancel'." A PR is not a deployment; remote merges stay with the user.
- **Undo** follows §7.2: a preview of the inverse against current state, naming later edits it would touch and saying databases and external effects are not undone, then confirm, apply, check and report. An overlap stops with the conflict shown; there is no partial undo.
- **"Don't commit"** (UX-D4) is honored for the task: the headline says uncommitted, undo is limited to the diff and editor checkpoints, and "commit it" commits later.

### J-07 Update or leave

- **Update:** "Tenet updated since this work started; your work and evidence are intact." Any state migration is previewed (LFC-04).
- **Leave:** "help uninstall" lists what remains (`.tenet/`; adopted files, which are the user's documents and stay; test tags and trailers; the user directory; run directories) and offers two previewed cleanups, this project and this machine. Tenet installs no service; known leftover test processes are checked and named before removal rather than promised away.

### J-08 Deep change

Deep kickoff (§5.1) → an architecture pass drafts the sketch, decision record and architecture note; a security pass drafts a short threat and data note whose items become examples → "Before migrating, I'll back up the database and test the restore" → the result's reading guide leads with the migration, the policy and the restore test.

### J-09 Prototype, then promote

"Just sketch it quickly" → "Prototype, not checked: I'll keep snapshots so you can undo source changes; the result won't claim checks." The kickoff states the purpose, the synthetic-data boundary, local exposure and the known shortcuts. A prototype is never offered as a way around failed checks. The result offers to keep exploring, discard, or "make it real": Git, the gaps as proposed requirements, preservation tests, safeguards, a fresh review, and the headline the evidence supports.

### J-10 Plan or investigate without building

- **Plan:** existing intent → the outcome and uncertainties → at most 3 approaches → a recommendation → vertical steps, each with how it is checked → decisions that can wait → what would change the recommendation → stop. Headline: "Plan ready, no source changes."
- **Investigate:** the question → evidence (`path:line`, or a command and its output) → observations separated from hypotheses and unknowns → the next discriminating step → stop.
- A justified "no change needed" is a successful outcome.

### J-11 Add a dependency

> Adding date-fns 4.1.0 (no other packages) · published 5 months ago · MIT · no install scripts. Within your dependency policy. Install? 1. Install (recommended) · 2. Choose another · 3. Skip

A failed rule names the rule and the value ("published 2 days ago; your policy needs 14"). A package the agent installed outside Tenet is verified afterwards, and the result says its install scripts may already have run.

### J-12 Repeated failure and limits

> **I've stopped retrying: the same failure twice.**
> **Failure:** loans.test.ts, overdue 2 days: expected 1 reminder, got 0.
> **Likely cause:** both attempts assumed UTC dates; the test uses local midnight.
> 1. Run one diagnostic check of that assumption (recommended) · 2. Pause with the handoff · 3. Explain the evidence

Changing an example is a change of direction (§5.2) or a test-defect disposition, never an escape from a failing implementation. At an attempt limit, the report shows what passed, what still fails, the diagnosis and one bounded proposal, asked in chat.

### J-13 Recipe upgrade

"Upgrade the starter" → template changes grouped by purpose; files that conflict with the user's changes listed separately; the accepted set applied and checked together as one contract at the lane its risk requires (TS §12.9). An unsupported old version gets the template diff as guidance.

---

## 7. Steering

### 7.1 Vocabulary

Anything new from the user is handled before the next step (TS §5.2).

| User says | Tenet |
|---|---|
| "status", "what's next?", "continue", "show that again" | Per §3.3 |
| "pause", "stop" | Pauses at the next safe boundary and saves the handoff: "Paused after the check. Say 'continue' any time." |
| "cancel" | Stops owned processes; no implicit rollback; reports what remains |
| "undo that" | Per §7.2 |
| "skip the tests" / "skip the review" | Proceeds, with the weaker headline stated once: "The result will say 'Built, not fully checked: tests declined'." |
| "be brief", "explain more", "only interrupt for decisions" | Changes this task; "always …" makes it durable (§8.2) |
| "fix 1 and 3", "fix all of these" | A scoped contract; a batch (J-05b) |
| "make it smaller" | Splits into plan steps |
| "why …?" | Why report |
| "accept", "looks good", "integrate" | Per §5.4 |
| "don't commit" | Honored for this task |
| "forget that" | Previewed forgetting across every copy Tenet controls |
| "reduce approvals" | Shows the one-line auto-approve rule to paste (TS §4.6) |

### 7.2 Ambiguous words resolve to the safe meaning

| Word | Safe meaning | Ask only when |
|---|---|---|
| "stop" | Pause (keeps everything) | Never; "cancel" is its own word |
| "undo" | Mid-task or uncommitted: the editor's checkpoints for the last edit. After a commit: the work's inverse. After a setting change: restore that setting's previous value | Two meanings apply ("the last edit, or the whole change?") |
| "yes", "ok" | Only the question just asked; never several at once unless unambiguous | Several questions were open |
| "ok" after a result | Acceptance only; never integration or anything remote | — |
| "do it" after a plan | Start the next step, not all of them | — |
| "continue" | Resume bounded Tenet work; never answers a host prompt | — |

---

## 8. Configuration

### 8.1 Principles

- **Spoken first:** each of the 12 catalog settings (PRD Section 7.3) can be changed in words.
- **Temporary unless said otherwise** (PRD Section 7.5): "be brief" applies to this task; "always …" or "… in this project" persists without re-asking (CFG-07), showing the interpreted scope.
- **Visible and reversible:** every durable change says where it went and how to undo it; "what have I set?" lists every setting with its source; "why <setting>" explains one (CFG-04).
- **Never shared by accident:** personal preferences never reach shared files (CFG-08).

### 8.2 Where a durable setting is saved (UX-D3)

| Said with "always" | Saved to | Reply |
|---|---|---|
| Style, check-ins, resource use | For the user, in every project (or this project if they say "here") | "Saved for you in every project. Undo: 'undo that setting'." |
| Commands, protected paths, required checks, exclusions, dependency policy, default lane (never below the floor), branching, integration | This project, only on this machine; applied at once | "Saved for this project (only on your machine)." Sharing is offered later in the report queue, batched (§5.4) |
| A person edits an adopted `tenet.policy.json` | The file | Tightening applies at once; loosening and new commands need acceptance of the diff (PRD Section 7.5) |

Interpretation guards:
- "Use pnpm here" in an npm project explains the mismatch and never converts the lockfile.
- "Never touch migrations/" reads back as "Changes to migrations/ need your permission for each piece of work".
- A restriction change states its effect on work in flight: "This applies from the next step; this branch already edited a migration, so I'll ask before committing it."
- An unknown restriction key names the nearest valid one ("`protected_path` isn't a setting; did you mean `protected_paths`?", `restriction-key-unknown`).

### 8.3 Setup is a gap list

"Setup" shows only what blocks or would improve this project, then one picker of what to change:

> **Setup for this project**
> **Blocking:** Playwright's browser isn't installed (needed for UI journeys).
> **Approvals:** say "reduce approvals" for a safe one-line rule.
> **Only on your machine:** protected migrations/ (share?).
> **Shared files:** not adopted (preview?).
> What would you like to change? 1. Install the browser · 2. Show the approval rule · 3. Share settings · 4. Show all settings

"Show all settings" lists the rest with their sources. Setup is optional, never required before a task, and writes only after a preview. `tenet.policy.json` carries a `$schema`, so the editor autocompletes and flags typos (A6); "why <key>" shows a ready-to-paste example.

### 8.4 Lessons and reset

- An explicit "always" correction applies now and persists. Inferred lessons are proposed only with evidence, at most one per contract, through the offer queue.
- "What do you remember about this project?" lists lessons, preferences and decisions with provenance; each can be changed or forgotten after a preview.
- "Reset my settings" previews exactly what is removed. Accepted intent, decisions and restrictions from shared files are never removed by a preference reset.

---

## 9. Trust, privacy and resources

- **Precise claims instead of reassurance:** "Git gives this project source checkpoints and an undo path; it doesn't reverse database or external effects." "Tenet excludes .env.local from what it sends to the model and from exports; checks that declare it can still use it locally." "The full required checks passed for this candidate."
- **Autopilot:** the README and "why authority" say Tenet cannot tell a person's answers from automatic ones under Autopilot.
- **Previews** before anything leaves the project's control: adoption, exports, feedback and remote actions show their content and destination.
- **Suspected exposure:** say what was detected and where it went: "A token-like string appeared in output sent to the model. If it's a real credential, rotate it; I removed my copies and can't remove copies elsewhere." (PRD Section 5.17)
- **Resources:** effort in words for Deep work; one 80% notice; usage "unknown, see your Copilot usage dashboard" once per contract; no currency, overage, account or model-switch suggestions (RSC-03). "Prefer fewer optional agent runs?" is asked only in a Deep kickoff, where it matters.

---

## 10. Recovery situations

All use the Recovery report (§5.4): name the file, command or policy, never "an error occurred", and always offer a safe way forward, even "stop here; nothing was changed". Every option offered has a defined mechanism.

| Situation | Core message | Options |
|---|---|---|
| Missing tool | "To run the dashboard journey I need Playwright's browser." | Install (download previewed) · skip it (weaker headline) |
| Readiness needed | "Dependencies aren't installed, so I can plan but not build." | Install them (previewed) · plan only |
| Unsupported stack or policy | Per §4.3 | What still works · who can change it |
| Mid-rebase (`repo-state-readonly`) | "Git is mid-rebase, so I'm read-only until that's resolved." | Finish or abort the rebase yourself, then say "continue" · review only |
| Detached HEAD (`repo-state-readonly`) | "This checkout has no branch (detached HEAD), so I'm read-only." | Create a branch here · review only |
| No Git identity (`git-identity-missing`) | "Checked locally, uncommitted: Git needs your name and email to commit." | The `git config` command · "commit it" afterwards |
| Too many untracked files (`inventory-too-large`) | "42,000 untracked files in data/ are too many to scan safely." | Add data/ to .gitignore (the fix that actually shrinks the inventory) · narrow the scope to exclude data/ |
| Basis too large (`narrow-increment`) | "These examples are too large for one independent review." | Make it smaller |
| Change Tenet can't explain | "billing.ts changed after my last check, and I didn't change it." | It's mine: keep it out of Tenet's commit · include it in this work · show the change |
| Another chat owns the work | "Overdue reminders is active in another chat." | Open that chat and say "continue" there · wait (pause it from there) |
| The user pressed the host's Stop control | "Stopped. The last finished step is kept." | "continue" reconciles what actually happened before going on · look first |
| Uncertain effect after a crash | "A commit may have happened when VS Code closed. I checked: it did." Or "I can't tell; here's what I see." | Keep · undo · look myself |
| Interrupted lock repair (`lock-recovery-needed`) | "An earlier Tenet call stopped while recovering its lock; nothing is running now." | Repair and continue |
| Hook staged extra files | "Your pre-commit hook added package-lock.json to my commit." | Keep it · move the branch back after you review |
| Hook or signing failed | "Your pre-commit hook failed (lint-staged exit 1); the work is checked but uncommitted." | Show output · fix and retry · leave uncommitted |
| Undo overlaps later edits | "Undoing would overwrite your later change in lines 40–52." | Show the overlap · cancel |
| Integration conflict | "Merging into main would conflict in 2 files." | Resolve with me · rebase this work · leave it |
| Evidence out of date | "You changed Reminders.tsx after the last check, so those results no longer count." | Check again |
| Test changed after its red (`red-invalidated`) | "The test for example 1 changed after its first run, so the before-and-after proof was reset." | Re-run the proof · the reviewer judges it a test fix |
| Locked test edited | "The test for example 2 changed without a recorded reason." | Revert it · it's a test defect (the reviewer decides) · the requirement changed (a change of direction) |
| Review partial or unavailable | "The reviewer couldn't reach 3 files", or "the automated reviewer didn't return" | Review those (one more session) · make it smaller · pause; never a weaker review silently |
| Same failure twice, budget reached, host limit | J-12; §5.4 recovery example | — |
| Shared policy changed (`policy-change-needs-acceptance`) | "A pulled change loosens protected_paths in tenet.policy.json." | Accept the change · keep the previous rules (tightening alone applies with a one-line note) |
| Intent markers damaged (`intent-markers-invalid`) | "INTENT.md has an unbalanced tenet:begin/end marker around REQ-012-q7k at line 41, so I can't tell what's mine to update." | Show the exact lines · restore the marker boundary (previewed) · treat the section as the user's own text from here |
| Local records missing (CON-07) | "Tenet's local records aren't here (fresh clone or deleted). I recovered the plan, requirements and 6 locked test paths from the repository; no old approvals or results are assumed." | Review and re-adopt · start fresh |
| Copied or untrusted `.tenet/` | "I found Tenet records I didn't create; I've set them aside and started fresh." | Review them · keep the fresh start |
| Damaged records | "My records were damaged; I restored the previous version. Permissions are suspended until needed." | Each permission is asked again only for a concrete action |
| Index left alone (`index-sync-needed`) | "Committed. Another tool was using Git's index, so I left it alone: 3 files still show their old version as staged." | "sync my index" (rechecks first) |
| No temporary space (`run-dir-unavailable`) | "I can't write temporary check files, so checks can't run." | How to fix · review only |
| Deploy requested | "I don't deploy in this version." | A hardening list · a PR brief |

---

## 11. Coverage

| Project in R1 | Experience |
|---|---|
| New TypeScript web or API (starter); existing TypeScript on a supported stack | Full loop, Checked locally |
| JavaScript-only, unsupported runner or version, experimental monorepo | Implementation available; "this setup isn't one I can fully check" (L3) |
| Missing dependencies, or plan only | A plan, with the readiness step |
| Other languages | Review, explain and plan (Python implementation in R1.1) |
| Non-Git folder | Git initialized (with consent), or a prototype |

Software families keep the same shapes; only the examples change: API calls with responses and errors; library or CLI calls with outputs, exit codes and a semver note ("this changes a public signature"); data runs with seeds ("I did not reproduce the run"); infrastructure plans ("not applied", with apply as a separate explicit word); regulated domains with the standing software-only line. Lifecycle stages beyond R1 (delivery, operation, software retirement) answer with what Tenet will not do and offer a review or a plan. Nothing unsupported is a dead end.

---

## 12. The experience of the generated software

The starter's critical journeys (sign in, browse, reserve, return, admin overview) meet the same standard (QLT-01, QLT-03, QLT-14). `journeys.json` defines for each: actor and goal, entry, preconditions, main path, validation and boundary cases, loading, empty and failed states, denied access, conflicts, recovery and observable success.

The starter demonstrates:
- **Navigation:** discoverable navigation and one obvious primary action per screen.
- **Forms:** inline validation on blur and on submit; input kept after errors; no duplicate submissions.
- **States:** empty data is distinguished from failed loading; loading preserves orientation; network failures can be retried.
- **Errors:** explained in domain words with recovery ("Someone reserved Microscope A for Tuesday a moment ago. Next free: Thursday.").
- **Changes:** success is confirmed by a fresh read; pending changes and stale data are shown; destructive actions confirm with consequences or offer undo.
- **Security and access:** server-side authorization, never hidden buttons; keyboard-complete; focus to the heading on navigation, to the error summary on failure, and back to the trigger after dialogs; `aria-live` status (TS §12.6).
- **Design:** an existing design system is reused, never added for appearance.

The **screen-reader check** applies whenever a critical journey changes, in any lane (TS §9.2), as one question after the final check: "Automated accessibility checks passed. Run the 3-step VoiceOver check in docs/a11y-checks.md? 1. Skip for now (the result will say 'accessibility: automated checks only') · 2. I ran it and it passed · 3. I found an issue". Quality claims name the journeys and workload evaluated.

---

## 13. Accessibility and localization

### 13.1 Tenet's own interactions (Alpha entry criterion)

Behavioral requirements, each tested with VoiceOver and keyboard only on the tuple (PRD Section 6.8):
- Words carry every meaning; cards are Markdown with headings and lists, so screen readers can jump between findings and examples.
- Every picker choice also works as a typed number or word; a question can be revised or partly answered in free text; authority replies are short enough to speak.
- The latest result is always reachable with "show that again".
- No focus stealing; long checks announce their start and end only.
- Diffs are inspected through the host's accessible diff viewer and Accessible View, which Tenet links to and never replaces.
- Text sketches are preceded by a one-sentence summary; screenshots are never the only evidence.
- Guided style doubles as a cognitive-load aid, never a "simple mode".

### 13.2 Localization

- Tenet's interaction language is English in R1, independent of the app's language.
- Dates in consequential examples are unambiguous ("Tue Oct 14, 2 days ago").
- Time zones are explicit decisions wherever behavior depends on them, with a daylight-saving example when relevant.
- Numbers and currency follow the user's locale in prose and stay raw in code and receipts.

---

## 14. Qualification

### 14.1 Measures

PRD Section 1.6 targets, all provisional:

| Measure | Target |
|---|---|
| Install to engaged; first useful outcome (median, ready fixture) | ≤ 5 min; ≤ 15 min |
| Seeded consequential misreadings caught before building (AC-24) | ≥ 70% |
| Active human minutes per accepted outcome versus a competent native baseline (AC-12) | ≥ 30% fewer |
| Resume; unnecessary repeated questions (AC-08) | ≤ 2 min; 0 |
| Duplicate approvals; Tenet-caused host prompts per Standard task (AC-21, SP-12) | 0; ≤ 3 |
| User turns per clear Standard task | ≤ 2 (the request plus one reply) |
| Stops before building | ≤ 1; 0 only when the request has no new requirement at all (a bug fix, a refactor, selected review fixes) — a new requirement always stops once, by design (A13, rejected) |
| Mid-flow interruptions from predictable consents | 0 |
| Offers per report | ≤ 1 |
| Avoidable questions about implementation detail | 0 |
| Extra turns needed to understand a major finding | 0 |
| Time to locate the latest result | Tracked |
| Comprehension: states what was checked, what wasn't, and the risk (research sessions only, never a product quiz) | ≥ 80% |
| Style parity: Concise readers as accurate as Balanced readers | Equal |

Metrics are frozen before qualification. Necessary decisions are never optimized away to improve a number.

### 14.2 Session scenarios

Observe complete sessions with people who have never seen Tenet, know or don't know the repository, use assistive technology, misread an example, decline a recommendation, stop halfway, or need recovery. Each scenario must show:

| Scenario | Must show |
|---|---|
| Clear small fix | One-line kickoff, no questions, result |
| Ambiguous feature | The misreading caught at the one stop |
| Fully specified request | Kickoff shown, no stop |
| New project | One kickoff reply before building |
| Overlapping dirty file | One specific question; personal edits protected |
| Review, then selected fixes | Zero project writes during review; only the selected scope changes |
| "Don't change anything" | No `.tenet/` created |
| Plan only | "Plan ready, no source changes"; never "nothing changed" while records were written |
| Unsupported stack; experimental JavaScript | An honest boundary and a useful alternative; no unsupported checked claim |
| Declined test | Weaker headline, stated once; passing evidence still visible |
| A routine extra code path | No needless scope question |
| An avoidable shortcut | Removed, no question |
| Status while parked; status while working | No resume or ownership; no needless "continue" prompt |
| "Be brief," then another project | No unintended durable change |
| "Looks good" after a sketch | No integration |
| Cancel mid-check; uncertain commit after a crash | No false completion or implicit rollback; reconciled before any retry |
| Index warning, then new staging | The suggested recovery preserves the new staging |
| Overlapping undo | No partial reversal |
| More than three consequential reading entries | None hidden; "+N more" counted |
| Lost local state | No invented evidence or carried-over permission |
| Budget exhausted | A bounded proposal and a usable handoff |
| Screen-reader recovery | The user understands the state and completes the next action |

The first prototype runs six sessions: a clear bug fix; an ambiguous new feature; a review followed by selected fixes; an interrupted task with conflicting human edits; a temporary preference change; a status question during active work.

### 14.3 Research data (PRD Section 6.7)

The consent form, written with the evaluation owner, states:
- what is recorded (timings, kernel call logs and, only on synthetic fixtures in capture mode, redacted inputs and outputs; TS §17.4);
- where it is stored, who can access it, and the retention period (PRD Section 6.7: deleted 90 days after analysis unless the participant separately agrees to longer);
- how to withdraw: delete a local bundle before upload, or request removal by participant ID afterwards.

Product use never implies research consent, and raw recordings are never published.

---

## 15. Decisions and alignment

### 15.1 Decisions

| ID | Decision | Choice | By |
|---|---|---|---|
| UX-D1 | When the kickoff stops | Only for Tenet's additions; new requirements therefore stop once (INT-15), as a one-word reply | Owner |
| UX-D2 | Headline wording | Plain activity-aware phrase plus the exact endpoint term | Owner |
| UX-D3 | Where durable settings go | By kind; project facts on this machine first, shared later on request; plain phrases are temporary | Owner (scope clarified per PRD Section 7.5) |
| UX-D4 | "Don't commit" | Honored per task | Owner |
| UX-D13 | Index staging guarantee | Exact, under Git's own lock | Owner |
| UX-D5 | Commands | Teach `/tenet`; `/tenet-review` stays visible in the menu | Spec |
| UX-D6, D7 | Symbols and IDs | Words and numbered choices; plain numbers in chat, stable IDs in files and "why" | Spec |
| UX-D8 | Reading guide in Quick | Only for a shortcut, persistence or auth file, or an unplanned path | Spec |
| UX-D9 | Screens | A one-sentence or ≤ 6-line text sketch inside the kickoff for new screens; never a separate offer | Spec |
| UX-D10 | Accept and integrate | "Integrate" accepts and integrates; "accept" keeps the branch; the next action names both so neither is ambiguous; clean results never ask for acceptance; the `integration` setting changes only what is said, never what "accept" does | Spec |
| UX-D11 | Panel | None; "show that again" first | Spec |
| UX-D12 | Voice | One teammate; "automated reviewer" named once | Spec |
| UX-D14 | Shapes | Four: kickoff, question, check-in, report | Spec |
| UX-D15 | Offers | At most one per report, besides the next action; integrate is never repeated as an offer; the approval tip is trigger-based (second routine approval), ahead of the rest of the queue | Spec |
| UX-D16 | Consents | Predictable ones asked at kickoff; hook consent is asked once before the first commit, not invented at kickoff, since hooks are only known then | Spec |
| UX-D17 | `blocked` headline | "Can't continue" | Spec |
| UX-D18 | Shortcuts | Removed when avoidable; acceptance asked in chat as risk acceptance | Spec |

### 15.2 Alignment items

| ID | Change | Where | Status |
|---|---|---|---|
| A1–A6 | No-commit flag; basis origin and confirmation; result labels; durable-setting homes; atomic index sync; policy schema | TS §6.5, TS §7.2, TS §7.8, TS §8.3, TS §8.5, TS §8.7, TS §10.3 | Adopted in v1.0 |
| A7 | Spoken settings are temporary unless said with "always" or "in this project"; `resource_mode` is not presentation; the `lane` setting is a default that never goes below the floor | TS §8.5 | Adopted in v1.0 |
| A8 | A status question during active work is answered and the authorized work continues; idle status never resumes | TS §5.2 agent body | Adopted in v1.0 |
| A9 | Accepting a shortcut is risk acceptance, asked in chat | TS §8.7, TS §11.4 | Adopted in v1.0 |
| A10 | `Result.label` follows §4.2 (activity-aware findings-only, "Built, not fully checked", "Built, a check fails", "Can't continue", the dirty-tree wording in Limits, not the headline) | TS §8.3 | Adopted in v1.0 |
| A11 | The tech spec references the written UX Spec (§0.1, Appendix B) | TS §0.1, Appendix B | Adopted in v1.0 |
| A12 | `Result`'s `integration` field and next-action line read the `integration` setting (`offer` / `auto-on-accept` / `never`, GIT-11) so the result never asks a question "accept" can't answer, and a silent branch switch never follows acceptance | TS §8.3, TS §10.4 | Adopted in v1.0 |
| A13 | Rejected: do not classify a boundary or negative case as `origin: request` unless the user's own words state it. The kernel does not interpret the sketch (§8.7); a "direct logical complement" classifier would be exactly that interpretation, and is how a seeded misreading would ship silently. The one-word "ok" stop (UX-D1) is the mitigation, not a gap to close — see §14.1 and §5.1 | — | Rejected |

Not adopted, to keep complexity down: committing the user's own dirty edits as a separate commit on their behalf (PRD Section 5.12 permits it, but it needs a new commit path; "wait while you commit" covers it); an auto-integrate offer after repeated integrations (integrating in one word already removes the turn).

---

## 16. Traceability

**PRD Section 11.4 UX obligations:**
- accessibility: §13.1, §12;
- localization: §13.2;
- command syntax and wording: §3.2, §4;
- contract and result presentation: §5.1, §5.4;
- example confirmation: §5.1;
- risky choices: §5.2, J-06;
- findings and evidence inspection: §5.4;
- research data: §14.3.

| PRD area | Sections |
|---|---|
| Installation (INS) | 3.2, 4.3, J-01 |
| Intent and basis (INT) | 5.1, 5.2, J-02, J-05b, J-10 |
| Work and steering (WRK) | 3.3, 5.3, 7, J-12 |
| Review (REV) | 5.4, J-04 |
| Results (RES) | 4.2, 5.4 |
| Git (GIT) | 5.1, J-03b, J-06 |
| Continuity (CON) | 3.3, J-05a, J-07, 10 |
| Security and privacy (SEC) | 5.2, 9, 10 |
| Configuration and learning (CFG, LRN) | 8 |
| Resources and models (RSC) | 5.1, 5.3, 9 |
| Generated software quality (QLT) | 12, J-08 |
| Experience qualification (PRD Sections 6.6–6.8) | 14 |
