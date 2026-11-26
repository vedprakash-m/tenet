# CP-0066 briefs · common to every track

You are one of four model tracks fixing Tenet for 0.1.1. A coordinator session reviews and merges your work; the Owner is Ved (they/them).

## Read first

1. `AGENTS.md` at the repository root.
2. [definition.md](../definition.md): the groups, acceptance items (AB-…) and **the rules for every group**. They bind you.
3. Your own brief in this folder, and only the specification sections it names.

## The source project is private

The findings come from a dogfood run on a private project. You don't get its files and must not look for them: never read anything under `Q:\Ved\Pers\torus*`. Each finding below is described in synthetic terms. Build your own synthetic repro.

## Working setup

- Worktree: your track folder only (`Q:\Ved\Pers\tenet-track<N>`). Never work in `Q:\Ved\Pers\tenet`.
- Start: `git fetch origin && git switch -c cp-0066/<group>-<slug> origin/main`, then `npm ci && npm run build`.
- Identity, set locally: `git config user.name "Ved Mishra"` and `git config user.email vedprakash.m@me.com`.
- Before pushing: `npm run lint` and `npm test` pass. Push, open a pull request against `main` titled `CP-0066 <group>: …`. The body lists each AB item with the tests that show it, any specification change marked **proposal**, and anything not reproduced.
- Don't merge. Watch CI; fix your own failures. CI must pass on Linux, Windows and macOS.

## Report back

When the pull request is green, end with a report the Owner can paste to the coordinator:

```
Track <N> · CP-0066 <group> · PR #<n> · head <sha>
AB items: <id: done / not reproduced / blocked, with test names>
Spec proposals: <files and sections, or none>
Independent cases touched: none (or: which ones disagreed, and why)
Not done / risks: <list>
```
