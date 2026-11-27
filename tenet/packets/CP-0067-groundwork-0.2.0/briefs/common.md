# CP-0067 briefs · common to every track

You are one of four model tracks preparing Tenet **0.2.0**. In the plan it's the milestone **0.1.0-alpha.1 (protect)**; [L-0040](../../../ledger/L-0040-launch-decisions.md) maps that milestone to the published version 0.2.0. A coordinator session reviews and merges your work. The Owner is Ved (they/them).

**This round produces reports and proposals, not code.** No file in `src/`, `kit/`, `test/` or `pkg/` changes. CP-0049 stays blocked until CP-0057 closes.

## Read first

1. `AGENTS.md` at the repository root.
2. [definition.md](../definition.md): the work table, acceptance AC-1 to AC-4, and what's out of scope.
3. Your own brief in this folder, and only the specification sections it names.
4. The build contracts: [plan/alpha.1.md](../../../specs/plan/alpha.1.md), and plan [§4](../../../specs/plan.md#4-build-contract) for the eight fields every contract must have.

## Never read

- Anything under `Q:\Ved\Pers\torus*`. It's a private project; a separate dogfood run is using it right now.
- `tenet/holdout/`.

## Working setup

- Work only in your own track folder, `Q:\Ved\Pers\tenet-track<N>`. Never work in `Q:\Ved\Pers\tenet`.
- Start:
  - `git fetch origin && git switch -c cp-0067/<slug> origin/main`
  - then `npm ci && npm run build`.
  - If PR #62, which adds this packet, isn't merged yet, read this folder with `git show origin/cp-0067/packet:<path>`. Don't merge that branch into yours.
- Identity, set locally: `git config user.name "Ved Mishra"` and `git config user.email vedprakash.m@me.com`. Never use any other email.
- Your pull request adds **only** the files your brief names.
- Before pushing, all three of these must pass:
  - `npm run lint`
  - `npm test`
  - `node dist/cli.js check`, whose two existing budget warnings are fine.
- Push, then open a pull request against `main` titled `CP-0067 track <N>: <topic>`. Don't merge it. CI must pass on Linux, Windows and macOS; fix your own failures.

## How to judge a contract

Use these verdicts and no others:

| Verdict | Meaning |
|---|---|
| **ready** | A builder could build it from the text alone, with no guessing |
| **gap** | Something is missing or ambiguous, so a builder would have to invent a rule |
| **stale** | It points to a section, file, function, field, error code or name that no longer exists, or that now says something else |
| **conflict** | Two sources (the contract, a spec, the code, an independent case) disagree |

Rules for evidence:
- Every verdict other than **ready** cites evidence as `path:line`. Open each reference; never assume it says what the contract claims.
- Quote at most two lines of a source, and only when the exact words matter.
- When a fix is needed, write the **proposed replacement text** in full, ready to paste into the spec. Don't edit the spec yourself.
- Never choose an answer that only the Owner can decide. List it under **Owner decisions**, with options, your recommendation and one line on why.

## Writing

Use plain words, as UX spec §8 asks. Use short sentences and tables, with no marketing and no filler. Refer to the Owner as "the Owner" or "Ved".

## Report back

When the pull request is green, end your session with this block. The Owner pastes it to the coordinator.

```
Track <N> · CP-0067 <topic> · PR #<n> · head <sha>
Files: <paths added or changed>
Verdicts: <packet: ready / ready after fixes / not ready · counts of gap, stale, conflict>
Owner decisions: <count, and one line each>
Not done / risks: <list, or none>
```
