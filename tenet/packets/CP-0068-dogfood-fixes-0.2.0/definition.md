---
packet: CP-0068
version: 1
---
# CP-0068 · 0.2.0 fixes from the second dogfood

> Scope proposed on 2026-11-26. These fixes ship in 0.2.0, and there is no 0.1.2 ([L-0042](../../ledger/L-0042-second-dogfood-rolls-into-0.2.0.md)). Scope approved by the Owner on 2026-11-26. The Owner decided AC-B1 and AC-D3 as OD-13 A and OD-14 B ([L-0043](../../ledger/L-0043-owner-decisions-0.2.0.md)). AC-B1's spec text is still a proposal for blessing.

## Why

A medium model ran 0.1.1 on a private existing project as a new user, blind to the first run. It found that an agent following the drafting skill can produce a specification that `check` and `fix` accept, which `onboard --card` then rejects. Once front matter is added by hand, `bless` accepts it and then fails internally on every section. As a result, nothing can be blessed. The run also found two checks that would become false blocks once 0.2.0's rules can block, plus problems in `upgrade` and `remove` and gaps in the docs.

**The source project is private.** No text, file names, terms or evidence from it go into this repository. Every repro, fixture and test here is synthetic, and entry IDs (R2-nn) are the only link. CP-0066's rules for every group apply here unchanged ([CP-0066 definition](../CP-0066-dogfood-0.1.1/definition.md#rules-for-every-group)). Branches are named `cp-0068/<group>-<slug>`.

## Groups and acceptance

### A · Specification front matter is checked and written in one place (R2-13, R2-16)

- **AC-A1:** **One validator for specification front matter.** `check`, `fix`, `onboard --card`, `bless` and `board` all use it, so for the same file they give the same verdict.
  - A draft at the assignment's output path that has no front matter, or the wrong shape, is an error in `check`. It is never skipped silently.
  - The error names the JSON pointer it failed on, for example `/sections` must be a map.
  - `board` never says "No specifications found" while that draft exists.
- **AC-A2:** **`tenet fix` writes front matter** for a draft at the assignment's output path that has none: the `tenet` block, and a `sections` map with each section as `draft` and its digest.
  - It keeps every valid field that is already there.
  - It reports a shape it can't repair, naming the pointer.
  - After `fix`, `onboard --card` accepts the file.
- **AC-A3:** **The `draft-specs` skill** tells the agent not to write front matter by hand, and to run `tenet fix` to add it. The skill's steps, run in order on a synthetic project, give a draft that `check`, `onboard --card` and `bless` all accept.
- **AC-A4:** **`bless` checks the front matter before its first question.**
  - A wrong shape stops the session with `TN-SCHEMA`, the pointer and the next step. Never `TN-INTERNAL`.
  - It never asks questions it can't save.
- **AC-A5:** **The next step in every front-matter error works.** Following it, with no other change, makes the command pass. Shown by a scenario.

### B · Checks that would become false blocks in 0.2.0 (R2-15, R2-18, R2-09)

- **AC-B1:** **First-time setup isn't flagged.** When the base commit has no Tenet setup (no `tenet.yaml`), the pull request that adds it isn't flagged for changing Tenet's own protected files. The card shows one note instead: *"First-time setup: protected Tenet files are expected in this pull request."* The exemption covers only paths that `init`'s manifest lists; any other protected path is still flagged. Every later pull request is checked as today.
  - This is a **specification proposal**: it changes what `protect` means for the first pull request.
- **AC-B2:** **"Skip added" counts only real test skips.** Weakening detection reports `skip-added` only for skip constructs inside test files, as classified by the configured checks or by conventional test paths.
  - A process exit in code that isn't a test, such as `sys.exit(1)` or `process.exit(1)`, is never a skip.
  - Tests cover Python, JavaScript and Go.
- **AC-B3:** **Dead paths are only things that look like paths.** The inventory's `dead-path` reports only references that look like repository paths.
  - Inline code that is an identifier is never a dead path: for example `@Name.member`, `module.func()` or `EventName`. Neither is a URL.
  - The count on the *First findings* line uses the same rule.

### C · Upgrade, remove and messages (R2-19, R2-21, R2-05, R2-06)

- **AC-C1:** **A same-version `upgrade` after onboarding changes nothing.** When onboarding picks a layout, the `AGENTS.md` block that `init` writes either already matches it or is updated by onboarding. This closes the case CP-0066 AB-E1 didn't cover.
- **AC-C2:** **`remove` deletes every piece of generated working state under `.tenet/`** and lists each removed file. It keeps `.tenet/onboard/interview.json`, lists it in `kept` with the reason `"owner-answers"`, and prints "Owner interview answers" because that file holds the Owner's answers rather than generated state (Owner decision, 2026-11-27). The FAQ and `commands.md` match.
- **AC-C3:** **Without a terminal, `init` names itself:** *"`tenet init` needs an interactive terminal to confirm its plan. Run it in a terminal, or pass `--yes` to accept the plan."* No command shows another command's message.
- **AC-C4:** **`init`'s plan gives a short purpose for every path it writes**, not only for host files.

### D · Docs and defaults (R2-02, R2-12, R2-08)

- **AC-D1:** **Windows checksum command.** README and Getting started show a PowerShell line next to `sha256sum -c SHA256SUMS`: `Get-FileHash` comparing against `SHA256SUMS`.
- **AC-D2:** **Interview questions are shipped.** The skill, or the assignment, includes the interview questions it refers to for each `project_kind`, at most 10 per kind, plus the generic set.
- **AC-D3:** **Archive folders are excluded by default** (OD-14 B). Onboarding excludes `.archive/`, `archive/` and `old/` at any depth, lists them under "skipped" with reason `"archive"`, and prints how to include them again.

### E · Round 1 items deferred "for 0.1.2" (L-0041, now 0.2.0)

F-05, F-16, F-18, F-22, F-24 to F-28, F-31, F-33, F-57 and F-06's reordering. The descriptions below are synthetic. Parts that later work already fixed are left out: the `AGENTS.md` half of F-16 (AC-C1), F-22's questions (AC-D2), F-28's budget warning (`TN-BUDGET-WARN`) and F-57's list of removed files (AC-C2). Items marked **proposal** change what a command promises, so their spec text needs the Owner's blessing.

**Install and command line**
- **AC-E1 (F-06):** **`init` checks the registry before it asks to continue.** The package-integrity lookup runs before the plan is confirmed. If it fails, the plan says so and offers the local-integrity choice (the same as `--offline`) instead of failing after the user agrees. The cause is one line; npm's full error appears only with `--verbose`. When npm's configured registry is not the public one, the plan says that Tenet checks the public registry on purpose, and why.
- **AC-E2 (F-57) · approved (L-0044):** **`remove` shows its plan and asks first,** as `init` does: *Will delete* and *Will keep*, each with its paths, then *Continue? [y/N]*. `--yes` skips the question. Without a terminal and without `--yes`, it stops with its own no-terminal message, which names `remove`. A file Tenet created whole (for example a pull-request template it added) is listed as *delete (Tenet created it)*; a file it only edited is listed as *remove the Tenet block*.
- **AC-E3 (F-05):** **`--version` and `--help` start fast.** They load no command module. A test proves this by checking which modules are loaded, not by timing. Every help description follows one style: a sentence that starts with a capital letter and has no final period.

**Onboarding layout and units**
- **AC-E4 (F-16) · approved (L-0044):** **Documentation counts toward the layout.** The layout is `separate` when source lines reach 20,000, owner areas reach 4, or the repository's documentation (`doc` and `adr` files in the inventory) reaches 12,000 estimated tokens (characters ÷ 4). Tenet's own records are not project documentation: exclude the policy's records folder and the specification documents (Owner decision, 2026-11-27). 12,000 is the largest default document budget, so such documentation can't fit one document. The human output says why: *"Layout: one-file (because …). Use `--layout separate` to change it."*
- **AC-E5 (F-18):** **A `separate` layout always covers the documentation.** Documentation outside every code unit goes in a `docs` unit, so no unit list leaves out where the intent is written. The human output lists each unit with its paths.

**Drafting skill and kit**
- **AC-E6 (F-22, the rest):** **Shipped kit files cite only shipped files.** No file under `kit/` points an agent at Tenet's own unshipped specifications (such as `contracts.md` or `onboarding.md`). Each one points at the shipped templates instead. A test checks every file under `kit/`.
- **AC-E7 (F-24):** **One owner for the setup commit.** The drafting skill's last step doesn't commit or open a pull request unless the user asked the agent to. It tells the user the draft is ready and gives the next commands, which match the README and *Getting started*.

**Specification checks and `fix`**
- **AC-E8 (F-25):** **Metadata keys are read only from the trailing `{…}` block.** Prose such as *"Out of scope: …"* or *"scope: …"* before the block is never `TN-SPEC-REQ-META`. When a real metadata error is found, the message names the token that caused it.
- **AC-E9 (F-26):** **Completeness checklists aren't requirements.** `- [ ]` and `- [x]` lines under a *Completeness checklist* heading are never `TN-SPEC-MISSING-ID`, in any view, and `fix` never gives them IDs. A filled-in copy of every shipped template passes `check`.
- **AC-E10 (F-27):** **`fix` says what it changes and keeps the user's style.**
  - `--dry-run` prints one line for each change in each file, for example *"vision.md: add IDs to 5 statements; add section digests"*. `--diff` prints a unified diff.
  - Human output is text, never raw JSON; `--json` gives JSON.
  - Front matter keeps the YAML style it was written in (flow or block), and `fix` changes only the fields it has to.
- **AC-E11 (F-28) · approved (L-0044):** **Inferred statements are a warning.** `check` gives one warning for each file that has `origin: inferred` statements: *"<n> inferred statement(s) need review before blessing"*, with their IDs. It is a new code, added to the contracts and messages specification. The docs say plainly that a citation check confirms the cited lines exist, not that they support the statement.

**Onboarding card**
- **AC-E12 (F-31):** **The card's section list is grouped by document.** Each file's sections appear under its name. The preamble is shown as *intro*, and a completeness checklist as *checklist (<n> items)*. Neither counts toward unlabelled statements or the review-time estimate. A table with no IDs is shown as *table, no requirements*, not *0 statements*.
- **AC-E13 (F-33):** **The card says what the drafter could read.** `Read:` becomes `Available to the drafter:`, and the skipped files show a count for each reason. A separate `Cited:` line counts the files the draft actually cites.

## Independent scenarios

These are written from this definition, before the builder starts or apart from it, in `pkg/conformance/scenarios/`, with a row in [INDEPENDENT.md](../../../pkg/conformance/INDEPENDENT.md):

- `s17-draft-without-front-matter`: draft, `check`, `fix`, card, bless (AC-A1 to A5);
- `s18-invented-front-matter-shape`: a list `sections` and a string `tenet`; every command gives the same `TN-SCHEMA` (AC-A1, A4);
- `s19-non-test-exit-not-skip`: AC-B2;
- `s20-first-setup-protected-files`: AC-B1;
- `s21-docs-heavy-layout`: a repository with little code and a lot of documentation (AC-E4, AC-E5);
- `s22-spec-check-false-alarms`: prose with *scope:*, a filled-in template checklist and an inferred statement (AC-E8, AC-E9, AC-E11);
- `s23-remove-plan`: `remove` shows its plan, refuses without a terminal, and runs with `--yes` (AC-E2).

## Done when

- Every acceptance item has tagged tests that pass on all three platforms.
- The scenarios and the packed-tarball journey pass.
- The changes are in the 0.2.0 release notes.
