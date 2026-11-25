# Tenet

**Keep coding agents aligned with the intent you approved.**

[![npm version](https://img.shields.io/npm/v/%40vedprakash-m%2Ftenet)](https://www.npmjs.com/package/@vedprakash-m/tenet)
[![CI](https://github.com/vedprakash-m/tenet/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/vedprakash-m/tenet/actions/workflows/ci.yml)
[![Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Agents write code faster than people can check it, and intent drifts between the request and the pull request.
Tenet gives your agents specifications you approve and shows what each change proves.
It never calls a model and works with the coding agent you already use.

## Quick start

You need Node.js 22+ and Git. Start in a Git repository with at least one commit.

~~~sh
npm install --global @vedprakash-m/tenet
tenet init
tenet onboard
~~~

Read the files listed by `init` before you confirm. Tenet starts in `observe`, so its advisory rules leave the merge decision to you.

Give `.tenet/onboard/assignment.json` to your agent. Ask it to follow the installed `draft-specs` skill and draft your specifications. Review and commit the draft, then run this in your terminal:

~~~sh
tenet onboard --card
tenet bless
~~~

Commit your blessing and merge the setup on GitHub. On your next pull request, look for the proof card produced by the GitHub Actions workflows that `init` sets up. See [Getting started][start] for empty repositories, agent drafting and setup review.

If your network blocks Tenet's npm lookup after installation, use `tenet init --offline`. For a one-off command without a global install, use `npx -y @vedprakash-m/tenet` in place of `tenet`. npm and npx need network access to fetch uncached packages.

## What you get

- **Blessed specifications** your agents can work from, with the last approved text kept in force while you review edits.
- **A proof card on pull requests** once your GitHub Actions setup is merged. It names the tested commit, relevant requirements and available test evidence.
- **Agent context** through AGENTS.md, installed skills, or a local MCP server.
- **Specification checks and a board** for broken citations, unblessed drafts and changed sources.
- **Managed setup and removal** with a record of the files Tenet changed. `tenet remove` keeps your specifications and records.

### Example proof card

~~~text
Tenet proof · 9b41d0 (merge candidate) · advisory
Your intent this change touches
  R-1 blessed · "A payment that times out is retried once."
Acceptance
  ✓ AB-1 · test passed on this commit · one retry after timeout
  ! AB-2 · no test · nothing tagged [AB-2]
Tests 214 passed · ✓ no weakening detected by these checks
~~~

## How it works

~~~mermaid
flowchart LR
    A[Code and docs] --> B[Your agent drafts]
    B --> C[You bless]
    C --> D[Agents use blessed text]
    D --> E[Proof card on the pull request]
~~~

## Commands

| Command | What it does |
|---|---|
| `tenet init` | Shows the setup plan and installs the repository files you approve. |
| `tenet onboard` | Builds an inventory and gives your agent a drafting assignment. Add `--card` after committing the draft. |
| `tenet bless` | Reviews and approves sections in your terminal. |
| `tenet check` | Checks specification structure, citations and integrity. |
| `tenet board` | Shows drafts, edits, changed sources and specification debt. |
| `tenet context` / `tenet mcp` | Selects relevant context or serves it through local MCP. |
| `tenet verify` | Runs the CI steps that collect test evidence and record the proof card. |
| `tenet upgrade` | Refreshes the lock and managed setup for the installed version. |
| `tenet remove` | Removes managed setup and generated working files. |
| `tenet doctor` | Checks required tools, the lock and the configured workflows. |

## Works with

- Claude Code, GitHub Copilot, and other agents that read AGENTS.md, load skills or connect to MCP.
- GitHub Actions for proof cards. Local specification commands also work without GitHub.
- Windows, macOS and Linux with Node.js and Git.

## Roadmap

- **0.2.0** · Rules, pull-request decisions and the full board.
- **0.3.0** · Signed evidence and a hardened CI verifier.
- **0.4.0** · Reference agents, independent tests for careful changes and a minimal runner.

## Learn more

[Getting started][start] · [Commands][commands] · [Concepts][concepts] · [FAQ][faq] · [Specifications][specs] · [Report a problem][issues]

Code is licensed under [Apache-2.0](LICENSE). The standard and documentation are licensed under [CC BY 4.0][license-docs].

[start]: https://github.com/vedprakash-m/tenet/blob/main/docs/getting-started.md
[commands]: https://github.com/vedprakash-m/tenet/blob/main/docs/commands.md
[concepts]: https://github.com/vedprakash-m/tenet/blob/main/docs/concepts.md
[faq]: https://github.com/vedprakash-m/tenet/blob/main/docs/faq.md
[specs]: https://github.com/vedprakash-m/tenet/tree/main/tenet/specs
[issues]: https://github.com/vedprakash-m/tenet/issues
[license-docs]: https://github.com/vedprakash-m/tenet/blob/main/LICENSE-docs
