---
id: L-0030
kind: review
date: 2026-11-23
packet: CP-0015
title: "M0 spike results: what worked, what needs the Owner, what changed"
---
# L-0030 · M0 spike results

## Context

The fast-track plan (L-0029) runs all four spikes at once on day 1. They were run on this Windows machine (Node 24, git 2.56, OpenSSH 10.6, Python 3.12) and on a new private sandbox repository, `vedprakash-m/tenet-sandbox`, on the Owner's GitHub account (GitHub Free). The evidence (scripts, real reports, workflow files, host outputs, with personal paths redacted) is in each packet's `evidence/` folder.

## Decision or event

### CP-0041 · Spike C: events, reports and performance — **done**

| Hypothesis | Result |
|---|---|
| Events with `prev` arrays reduce identically in every arrival order | **Holds.** 2,000 random orders of a history with a conflict and an orphan gave one result; the same with a `resolve` delivered twice |
| 10,000 event files reduce within R-082 on Windows | **Holds only through git.** Reading 10,000 files from disk took 5.1–5.8 s warm (over the 3 s target); one `git cat-file --batch` read took 0.8 s; reduction itself took 20–33 ms. Specification changed (tech spec §5) |
| Readers handle real node:test, vitest, jest and pytest reports | **Hold, with format quirks recorded** (evidence.md §2): node:test's non-standard `<undefined>` wrapper and absolute paths; vitest hides retries and reports teardown as an extra case; pytest attaches teardown errors to the last case; jest reports teardown only at file level; entities decode correctly |
| Results can be matched to tagged declarations | **Holds**, once title placeholders (`%i`, `${x}`) match any text and pytest's `[…]` suffix is dropped (ALG-08 changed). A tagged declaration missing from the run was detected as `not run`; `[UTF-8]` was ignored; `tenet_AB_6` inside a longer name matched |
| Go reports | **Not tested:** Go isn't installed here. Left to CP-0018's fixtures |

### CP-0040 · Spike B: the CI shape and records — **done for one account on GitHub Free; three items need the Owner**

| Hypothesis | Result |
|---|---|
| Published workflows parse and run | **Holds once quoted.** My own first sandbox workflow failed on an unquoted `:` inside `run:`; this is the case `check:examples` exists for |
| A test job with a matrix uploads distinct bundles; the recorder (`workflow_run`) downloads them | **Holds**, with one real failure: one of two artifacts hit `503 Egress is over the account limit` and the prototype posted a card from half the results. The recorder now lists expected bundles and refuses partial results (ci.md §3) |
| `workflow_run` identifies a same-repository pull request | **Holds** (`pull_requests: [1]`); for a push, listing open pull requests by head finds none, as expected |
| The recorder posts the check run `Tenet` on the head and writes `refs/tenet/records` with plumbing | **Holds** with `contents: write` and `checks: write` from the default branch |
| `pull_request_target: edited` re-evaluates without rerunning tests | **Holds**, reusing the latest test run's bundles |
| Five concurrent writers lose no record | **Holds:** 5 of 5 kept; one writer needed 4 attempts, so retries rise to 8 (ci.md §4) |
| Dot-folder artifacts are skipped | **Partly false:** a hidden folder named directly as `path` uploads; hidden files inside folders are skipped. `tenet-bundle/` stays |
| Merging can require the Tenet status | **Not on this plan:** on GitHub Free, a private repository refuses both branch protection and rulesets ("Upgrade to GitHub Pro or make this repository public"). `merge requires status` is `unavailable` there |
| Ed25519 signing with `node:crypto`, a key in a secret, the public half pinned | **Holds:** sign and verify work; a tampered record fails. Confirmed as the private-repository default |
| An account can't approve its own pull request | **Holds** (GitHub refuses) |
| **Needs the Owner** | Fork pull requests (needs a second account); `neutral` against `failure` under a required check (needs Pro or a public repository); a sealed job with network denied (alpha.2) |

**Event table (observed so far):**

| Event | Trigger | Token | Writer | Record | Degraded result |
|---|---|---|---|---|---|
| Push or pull request with tests | `pull_request`, `push` | `contents: read` | test job | bundle artifact per job | upload fails, so the recorder reports "not checked" |
| Tests completed | `workflow_run` | `contents`, `checks: write`; `actions: read` | recorder | check run; `proof-<pr>-<run>-<attempt>` | an artifact is unavailable, so the card says "not checked: N of M" |
| Description edited | `pull_request_target: edited` | as above | recorder | check run; `proof-<pr>-<run>-e` | no test run yet, so the card says "waiting for tests" |
| Forks, reviews, replies, closing, `merge_group` | — | — | — | — | to be observed (the Owner; alpha.1 and alpha.2) |

### CP-0056 · Spike D: headless agent hosts — **done**

| Host | Headless | Result and cost | Isolation |
|---|---|---|---|
| Claude Code 2.1.330 | `claude -p … --output-format json --permission-mode acceptEdits --allowedTools …`, `--max-budget-usd` | 19 s for one trivial step; `total_cost_usd` reported (0.16 USD), token usage | tools restricted by flag; paths not confined |
| Copilot CLI 1.0.114 | `copilot -p … --allow-tool … --output-format json -s` | 42 s; a JSON-lines stream ending in `result` with `exitCode`, files changed, `premiumRequests: 1` | loads the user's own MCP servers by default; paths not confined |
| Codex, Gemini CLIs | not installed | — | — |

**Decision:** the two 0.1.0 adapters are `claude-code` and `copilot-cli`, plus `command`. Hosts are spawned with an argument array and `MSYS_NO_PATHCONV=1` (agents.md §6).

### CP-0017 · Spike A: identity and decisions — **partly done; the rest needs the Owner**

| Hypothesis | Result |
|---|---|
| `ssh-keygen -Y` sign and verify work | **Holds** on Windows (OpenSSH 10.6) with an Ed25519 key and the `tenet-decision` namespace |
| Presence can be read from a security-key signature | **Needs the Owner's security key** (an `sk-` key) |
| Replies bind to the evaluation; spot checks catch an agent using the Owner's session | **Alpha.1 work**; to be run with the recorder's review and comment triggers |
| Windows shells mangle slash commands | **Found:** Git Bash rewrote `/tenet approve` into `C:/Program Files/Git/tenet approve` before posting it |

### Other findings
- **Windows line endings:** with `core.autocrlf=true` and `core.safecrlf=true`, `git add` refused LF files. `init` now writes a `.gitattributes` block marking Tenet's files `text eol=lf` (contracts §10).

## Evidence

The scripts, reports and outputs in the `evidence/` folders of CP-0041, CP-0040, CP-0056 and CP-0017. The sandbox's workflow runs and records ref are in `vedprakash-m/tenet-sandbox`.

## Consequences

- **Specification changes:**
  - **ci.md:** observed facts, partial-bundle refusal, eight retries
  - **evidence.md** (new, split from contracts §6 and §12 under the rollover rule)
  - **algorithms ALG-08:** placeholders and pytest parameter suffixes
  - **tech spec §5:** events read through git
  - **contracts §10:** a `.gitattributes` block
  - **agents.md §6:** the chosen adapters and spawn rules
  - **plan:** CP-0055's adapters fixed
- **Owner's items:**
  - security-key presence
  - fork pull requests from a second account
  - `neutral` against `failure` under a required check (a public repository or Pro)
- **Next:** CP-0015 can start; CP-0002 (licence) waits on the Owner.
