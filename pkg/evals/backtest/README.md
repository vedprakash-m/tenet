# Tenet backtest cohort

This directory contains the frozen backtest data collection for the Owner's decisions in
`tenet/ledger/L-0033-backtest-cohort.md` and `tenet/packets/CP-0016-problem-validation-and-baselines/evidence/backtest-method.md`.

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

The cohort is frozen only after the Owner confirms Torus, including its repository location.
Torus is currently recorded as pending in `cohort.yaml`.
