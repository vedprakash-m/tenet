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
- **AC-C2:** **`remove` deletes every piece of generated working state under `.tenet/`** and lists each removed file. It keeps `.tenet/onboard/interview.json`, lists it in `kept` with the reason `"Owner interview answers"`, and prints the matching human line because that file holds the Owner's answers rather than generated state (Owner decision, 2026-11-27). The FAQ and `commands.md` match.
- **AC-C3:** **Without a terminal, `init` names itself:** *"`tenet init` needs an interactive terminal to confirm its plan. Run it in a terminal, or pass `--yes` to accept the plan."* No command shows another command's message.
- **AC-C4:** **`init`'s plan gives a short purpose for every path it writes**, not only for host files.

### D · Docs and defaults (R2-02, R2-12, R2-08)

- **AC-D1:** **Windows checksum command.** README and Getting started show a PowerShell line next to `sha256sum -c SHA256SUMS`: `Get-FileHash` comparing against `SHA256SUMS`.
- **AC-D2:** **Interview questions are shipped.** The skill, or the assignment, includes the interview questions it refers to for each `project_kind`, at most 10 per kind, plus the generic set.
- **AC-D3:** **Archive folders are excluded by default** (OD-14 B). Onboarding excludes `.archive/`, `archive/` and `old/` at any depth, lists them under "skipped" with reason `"archive"`, and prints how to include them again.

### E · Round 1 items deferred "for 0.1.2" (L-0041, now 0.2.0)

F-05, F-16, F-18, F-22, F-24 to F-28, F-31, F-33, F-57 and F-06's reordering. The coordinator gives each item a synthetic description when it is assigned.

## Independent scenarios

These are written from this definition, before the builder starts or apart from it, in `pkg/conformance/scenarios/`, with a row in [INDEPENDENT.md](../../../pkg/conformance/INDEPENDENT.md):

- `s17-draft-without-front-matter`: draft, `check`, `fix`, card, bless (AC-A1 to A5);
- `s18-invented-front-matter-shape`: a list `sections` and a string `tenet`; every command gives the same `TN-SCHEMA` (AC-A1, A4);
- `s19-non-test-exit-not-skip`: AC-B2;
- `s20-first-setup-protected-files`: AC-B1.

## Done when

- Every acceptance item has tagged tests that pass on all three platforms.
- The scenarios and the packed-tarball journey pass.
- The changes are in the 0.2.0 release notes.
