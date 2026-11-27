# Track 3 · MAI Code 2 · Group C (upgrade, remove, messages), then D1 and D2

Read [common.md](common.md) first. Worktree: `Q:\Ved\Pers\tenet-track3`.

## Part 1 · Group C (branch `cp-0068/c-maintenance`)

### What was observed (synthetic)

1. **AC-C1 (R2-19).**
   - `init` wrote the managed `AGENTS.md` block. `onboard` then chose the one-file layout (`tenet/intent.md`).
   - Later, a same-version `tenet upgrade` printed `Tenet 0.1.1 → 0.1.1 · 1 managed path(s).` and rewrote that block: before the upgrade, it pointed agents at files the layout never produced.
   - CP-0066 AB-E1 promised that a same-version upgrade changes nothing, but its tests didn't cover a layout chosen after `init`.
2. **AC-C2 (R2-21).**
   - After `tenet remove`, `git status` showed `?? .tenet/onboard/`. The FAQ says `remove` clears generated working state.
   - The spec (`onboarding.md`, `remove`) lists `.tenet/onboard/inventory.json` and `assignment.json`, but **keeps `.tenet/onboard/interview.json`**. Find what was left, and why.
   - The definition asks for all generated working state to go. If that contradicts the spec's rule to keep `interview.json`, **stop and report**; don't choose. `interview.json` may hold the user's own answers.
3. **AC-C3 (R2-05).** `tenet init` without a TTY prints `TN-BLESS-NO-TTY`, *"Interactive terminal required to bless specifications."*:
   - `src/commands/init.ts`, about line 188;
   - `src/core/messages.ts`, about line 23.

   Give `init` its own code and message. Then check every command for the same kind of borrowed message.
4. **AC-C4 (R2-06).** The `init` plan prints one line, `Will create: <11 paths>`, with no purpose for each file.
   - CP-0066 AB-B4 added purposes for host files only.
   - Code: `src/install/preflight.ts` and `src/install/writes.ts`.
   - Spec: the init plan in `ux-spec.md` Part 1 and `onboarding.md`.

### Code to start from

`src/install/` (`upgrade.ts`, `remove.ts`, `hosts.ts`, `writes.ts`, `manifest.ts`), `src/onboard/inventory.ts` and `src/onboard/assignment.ts` (where the layout is chosen), and `src/commands/init.ts`.

## Part 2 · D1 and D2 (branch `cp-0068/d-docs`)

- **AC-D1 (R2-02).** On Windows PowerShell, `sha256sum -c SHA256SUMS` fails with *"The term 'sha256sum' is not recognized…"*. Add a PowerShell line next to it in `README.md` and `docs/getting-started.md`: `Get-FileHash` on the tarball, compared against its line in `SHA256SUMS`. Test the line on Windows.
- **AC-D2 (R2-12).** `kit/skills/draft-specs/SKILL.md` says *"Ask the Owner the interview questions for assignment.project_kind (at most 10 questions…)"*, but the kit has no question list.
  - Add one per `project_kind` (`cli`, `service`, `library`, `data`, `infrastructure`, `application`) plus the generic set, at most 10 each, where the skill or the assignment can reach them.
  - Spec: `tenet/specs/tech-spec/agents.md` and `onboarding.md` (assignment).

- **AC-D3 (R2-08).** The Owner decided this one as OD-14, option B, in [L-0043](../../../ledger/L-0043-owner-decisions-0.2.0.md).
  - Onboarding leaves out `.archive/`, `archive/` and `old/` at any depth by default.
  - It lists them under *skipped* with reason `"archive"`, and prints the one line to put in `onboard.exclude` (a negated pattern) to include them again.
  - The existing archive hint goes away once the default covers it.
  - Spec: `onboarding.md` (skip reasons) and `docs/getting-started.md`.
