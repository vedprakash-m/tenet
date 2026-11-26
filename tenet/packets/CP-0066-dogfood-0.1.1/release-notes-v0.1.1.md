# Tenet 0.1.1

This release fixes problems found by running Tenet 0.1.0 on a real project from install to the first proof card. Most changes make an existing step finish cleanly or say clearly what to do next.

## Upgrade

~~~sh
npm install --global @vedprakash-m/tenet@0.1.1
tenet upgrade
~~~

`tenet upgrade` moves generated workflows to the new triggers and rewrites anchor files without cited text. Commit the result in one pull request.

If your registry mirror doesn't have 0.1.1 yet, download `vedprakash-m-tenet-0.1.1.tgz` and `SHA256SUMS` from the GitHub release, check the digest, and run `npm install --global ./vedprakash-m-tenet-0.1.1.tgz`. Dependencies still come from your configured registry.

## What changed

- **Blessing can be finished.** "Decide later" on a conflict leaves only that section unblessed, and the session carries on. `bless` asks open questions before their section. Every session ends with "Blessed N of M sections".
- **Fewer false alarms from `check`.** Budgets count the section body only. A vision blessed before its requirements gives one grouped warning, not an error per item.
- **Agents get the right context.** `context --paths` ranks specific `applies_to` matches first, keeps large catch-all sections within the budget, and accepts commas or a repeated flag. `--include-drafts` returns draft text, marked as drafts.
- **Skills are easy to find.** Skills are named `tenet-*` everywhere. `init --host claude|cursor|copilot|vscode` adds that host's files.
- **Tests work from day one.** With no test runner found, `init` asks for your test command instead of writing `npm test`. `tenet verify --local` previews the proof card on your machine.
- **Workflows run once per pull request,** on pull requests and on pushes to the default branch.
- **Anchors no longer copy cited text.** They keep a hash, a line range and the blessed commit.
- **Clearer output.** Accurate offline messages, a one-line registry cause (full detail with `--verbose`), per-command help, shorter first findings, and no deprecation warning on Windows.

See [kit/CHANGELOG.md](../../../kit/CHANGELOG.md) for the full list.

## Limits in this release

The limits listed for 0.1.0 still apply: proof cards need the GitHub Actions workflows from `tenet init`, proof rules are advisory, and the CLI never calls a model.

Report problems in [GitHub Issues](https://github.com/vedprakash-m/tenet/issues) with your Tenet version, OS, command and exit code. Redact secrets and private repository content from any output you include.
