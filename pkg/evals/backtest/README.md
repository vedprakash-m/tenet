# Tenet backtest cohort

This directory contains the frozen backtest data collection for the Owner's decisions in
`tenet/ledger/L-0033-backtest-cohort.md` and `tenet/packets/CP-0016-problem-validation-and-baselines/evidence/backtest-method.md`.

The collection has two WebChat groups:

- **Agent:** every eligible WebChat pull request in the window whose author is the
  `Copilot` coding agent (`login: Copilot`, `type: Bot`).
- **Human:** every other eligible WebChat pull request, ranked by
  `sha256("tenet-backtest-2026-11-23:" + number)` in ascending order.

The final cohort contains all eligible tenet-copilot pull requests, all WebChat agent
pull requests, and enough top-ranked WebChat human pull requests to reach exactly 100
cases. The next 20 ranked human pull requests are reserves; they are used in order only
if a cohort case later proves unassessable.

## Rerun

Prerequisites: Node.js 22 and an authenticated GitHub CLI (`gh auth login`).

```sh
node pkg/evals/backtest/collect.mjs
node pkg/evals/backtest/collect.mjs --verify
```

Rerunning replaces the per-PR records and manifest in this directory. The GitHub API is read-only.

## Files

- `cohort.yaml` is the manifest: sources, windows, eligibility, ranking seed and ranked candidate list.
- `schema.json` describes the fields in each per-PR record.
- `prs/<owner>__<repo>__<number>.json` is one pull request snapshot.

## PR fields

- `repo`, `number`, `title`, and `body`: repository and pull request identity and text.
- `author`: author login, GitHub account type (`User` or `Bot`), and a best-effort
  `copilot_coding_agent` indicator based on the author identity and head branch.
- `created_at`, `merged_at`: pull request timestamps.
- `base`, `head`: base and head branch names.
- `base_sha`, `head_sha`, `merge_sha`: revision identities.
- `labels`: label names.
- `draft_history`: available `converted_to_draft` and `ready_for_review` timeline events.
- `commits`: SHA, first-line message, and author login or name.
- `files`: changed path and status, additions, deletions, and previous path where applicable.
- `reviews`: review state, author, and submission time.
- `check_runs`: check-run name, conclusion, and completion time on the head SHA.

The collection does not preserve patch text.

## Freeze status

The collection is frozen on `2026-11-23`. The freeze applies to the final 100-case cohort
and its 20 reserves. Torus has no cases because it has no git history yet and will become
a first adopter after alpha.0.
