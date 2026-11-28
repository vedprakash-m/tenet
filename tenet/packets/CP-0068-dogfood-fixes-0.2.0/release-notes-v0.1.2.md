# Tenet 0.1.2

This release fixes problems found by running Tenet 0.1.1 on a real project, and the items deferred from the first run. The biggest fix: blessing no longer fails when a draft's front matter is missing or made up.

## Upgrade

~~~sh
npm install --global @vedprakash-m/tenet@0.1.2
tenet upgrade
~~~

`tenet upgrade` rewrites the `AGENTS.md` block and updates the shipped skills. Commit the result in one pull request.

If your registry mirror doesn't have 0.1.2 yet, download `vedprakash-m-tenet-0.1.2.tgz` and `SHA256SUMS` from the GitHub release, check the digest, and run `npm install --global ./vedprakash-m-tenet-0.1.2.tgz`. On Windows, check it with `Get-FileHash` as Getting started shows.

## What changed

- **Front matter is handled for you.** `tenet fix` writes it, and every command checks it the same way. Errors name the failing field and the next step. `bless` checks it before asking anything.
- **Fewer false alarms.** The first Tenet pull request isn't flagged for Tenet's own files. Script exits aren't test skips. Prose such as "Out of scope:" and filled-in checklists no longer trip `check`. `dead-path` ignores names that aren't paths.
- **Onboarding fits documentation-heavy projects.** Documentation counts toward the layout, a `separate` layout has a `docs` unit, and `onboard` says why it chose the layout. Archive folders are skipped by default.
- **The card is easier to review.** Sections are grouped by file, and the card says what the drafter could read and what it cited.
- **Safer setup and removal.** `init` checks the registry before you confirm. `remove` shows its plan and asks first. Scripts need `--yes`.
- **The drafting skill stays in its lane.** It ships its interview questions, leaves front matter to `tenet fix`, and doesn't commit unless you ask.
- **`check` flags inferred statements** for review before blessing.

See [kit/CHANGELOG.md](../../../kit/CHANGELOG.md) for the full list.

## Limits in this release

The limits listed for 0.1.0 still apply: proof cards need the GitHub Actions workflows from `tenet init`, proof rules are advisory, and the CLI never calls a model. Scripts that run `tenet remove` without a terminal must now pass `--yes`.

Report problems in [GitHub Issues](https://github.com/vedprakash-m/tenet/issues) with your Tenet version, OS, command and exit code. Redact secrets and private repository content from any output you include.
