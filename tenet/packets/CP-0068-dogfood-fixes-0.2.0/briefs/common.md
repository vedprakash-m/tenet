# CP-0068 briefs · common to every track

You are one of four model tracks fixing what the second dogfood run found. These fixes ship in **0.2.0**; there is no 0.1.2 ([L-0042](../../../ledger/L-0042-second-dogfood-rolls-into-0.2.0.md)). A coordinator session reviews and merges. The Owner is Ved (they/them).

## Read first

1. `AGENTS.md` at the repository root.
2. [definition.md](../definition.md): the groups, the acceptance items (AC-…), and the link to **CP-0066's rules for every group**. Those rules bind you here unchanged.
3. Your own brief in this folder, and only the specification sections it names.

## The source project is private

Never read anything under `Q:\Ved\Pers\torus*`. Every repro, fixture and test is synthetic. Entry IDs (R2-nn) are the only link to the source project.

## Working setup

- Work only in your own track folder, `Q:\Ved\Pers\tenet-track<N>`.
- Start:
  - `git fetch origin && git switch -c cp-0068/<group>-<slug> origin/main`
  - then `npm ci && npm run build`.
  - If these briefs aren't on `main` yet, read them with `git show origin/cp-0068/briefs:<path>`. Don't merge that branch into yours.
- Identity, set locally: `git config user.name "Ved Mishra"` and `git config user.email vedprakash.m@me.com`.
- **Reproduce first** with a synthetic case. If a finding doesn't reproduce, or its cause is different, say so in your report.
- **Tag every test** with its acceptance ID and its entry ID, for example `test("[AC-A2] [R2-13] fix writes front matter for an intent draft", …)`.
- **Never weaken, skip or delete a test.** Never edit `pkg/conformance/**` cases written by others. If one contradicts an acceptance item, stop and report; don't choose.
- **Spec changes** ride in the same pull request, marked **proposal** in the body. This includes new error codes or messages: add them to the contracts and messages specification, not only to `src/core/messages.ts`.
- **Before pushing:** `npm run lint`, `npm test` and `node dist/cli.js check` all pass.
- Open one pull request per group, titled `CP-0068 <group>: …`. CI must pass on Linux, Windows and macOS. Don't merge.

## Report back

```
Track <N> · CP-0068 <group> · PR #<n> · head <sha>
AC items: <id: done / not reproduced / blocked, with test names>
Spec proposals: <files and sections, or none>
Independent cases touched: none (or: which ones disagreed, and why)
Not done / risks: <list>
```
