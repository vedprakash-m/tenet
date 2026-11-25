# Tenet

**Agents build what you meant, and you can see that they did.**

[![npm version](https://img.shields.io/npm/v/%40vedprakash-m%2Ftenet)](https://www.npmjs.com/package/@vedprakash-m/tenet)
[![CI](https://github.com/vedprakash-m/tenet/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/vedprakash-m/tenet/actions/workflows/ci.yml)
[![Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Tenet is an open standard and CLI for **spec-driven development with AI agents**, from one developer and one agent today to **governed software factories** tomorrow. It is the intent and proof layer between you and whatever agents write your code:

- **Your intent becomes specifications you approve:** drafted by your agent from your own code and docs, and read and blessed by you.
- **Your agents work from what you blessed,** not from guesses.
- **Every pull request proves itself against it.**

Tenet is not another coding agent. It never calls a model, works with the agent you already use, and is built on an open, tool-neutral standard.

## Where Tenet fits

| You already have | It answers | What's missing |
|---|---|---|
| A coding agent (Claude Code, Copilot, …) | *How do I write this code?* | Whether the result is what you meant |
| `AGENTS.md`, `CLAUDE.md`, instructions | *How should the agent behave?* | Nothing checks that it did |
| CI and tests | *Does the code run?* | Which intent each test proves, and whether a test was quietly weakened |
| A factory platform or orchestrator | *Which agent does which work, and when?* | A shared, checkable record of what was intended and what was proven |
| **Tenet** | ***Is this change what we agreed, and can it show it?*** | |

## What it looks like

On every pull request, Tenet posts a proof card, a plain summary of what the change touches and what it proved:

~~~text
Tenet proof · 9b41d0 (merge candidate) · advisory
Your intent this change touches
  R-1 blessed · "A payment that times out is retried once, never twice"
Acceptance
  ✓ AB-1 · test passed on this commit · one retry after timeout
  ! AB-2 · no test · nothing tagged [AB-2]
Tests 214 passed · ✓ no weakening detected by these checks
~~~

You see at a glance what the change promised, what was proven on the exact commit, and what still isn't covered. You don't have to read the code to learn that.

## Quick start

You need Node.js 22+ and Git, in a repository with at least one commit.

~~~sh
npm install --global @vedprakash-m/tenet
tenet init       # shows every file it will write, then asks; nothing ever blocks a merge in 0.1.0
tenet onboard    # takes stock of your project and prepares a drafting assignment
~~~

Then ask your coding agent:

> Use the `tenet-draft-specs` skill to draft this project's specifications from `.tenet/onboard/assignment.json`.

Your agent drafts your vision, requirements, design and plan, citing the file and line behind every statement and listing any conflicts it found. Commit the draft, then read and approve it:

~~~sh
tenet onboard --card   # summary of the draft for your pull request
tenet bless            # read and bless each section in your terminal
~~~

Merge the setup pull request. From your next pull request on, the proof card appears. [Getting started][start] walks through every step, including brand-new projects.

## How it works

~~~mermaid
flowchart LR
    A[Your code and docs] --> B[Your agent drafts specs]
    B --> C[You bless them]
    C --> D[Agents work from blessed specs]
    D --> E[Proof card on every pull request]
    E -.->|code shows a spec is wrong| B
~~~

- **Specifications are the source of truth.** Blessed text stays in force until you bless a change. Edits wait for your approval, and if cited code changes, Tenet asks you to confirm.
- **Proof, not claims.** Results come from tests that ran on the exact commit, tied to the requirements they prove, never from what an agent says it did.
- **Adopt in steps.** Tenet starts by observing and advising. Rules that block arrive in 0.2.0, and only the ones you turn on.
- **Open and neutral.** No vendor lock-in, no model calls. Tenet itself sends your code nowhere. Drafting happens with your own agent, and in CI Tenet reports only to your own GitHub repository.

## What you get in 0.1.0

- **Onboarding** for an existing repository or a new project, with source-cited drafts and conflicts listed, never silently resolved.
- **Blessing** in your terminal, section by section, with a log of who blessed what.
- **Agent context:** your agents get only the blessed specifications their task touches, through `AGENTS.md`, skills or a local MCP server.
- **Proof cards** on GitHub pull requests, including from forks: requirements touched, tests that passed on the tested commit, and deleted or skipped tests.
- **Checks and a board** for broken citations, unblessed drafts, changed sources and specification debt.
- **Clean setup and removal.** Every file Tenet writes is listed first and recorded, and `tenet remove` undoes exactly that while keeping your specifications.

## Commands

| Command | What it does |
|---|---|
| `tenet init` | Shows the setup plan and installs the files you approve |
| `tenet onboard` | Takes stock of your project and prepares the drafting assignment; `--card` summarizes the draft |
| `tenet bless` | Reads and blesses specification sections in your terminal |
| `tenet check` | Checks structure, citations and integrity |
| `tenet board` | Shows drafts, edits, changed sources and specification debt |
| `tenet context` · `tenet mcp` | Gives agents the relevant blessed context, directly or over local MCP |
| `tenet verify` | Runs in CI: collects test evidence and posts the proof card |
| `tenet upgrade` · `tenet remove` | Updates or cleanly removes Tenet's files |
| `tenet doctor` | Checks your tools, the lock and the workflows |

## Works with

- **Agents:** Claude Code, GitHub Copilot, and any agent that reads `AGENTS.md`, loads skills or connects to MCP.
- **Forge:** GitHub Actions for proof cards. Everything else works locally without GitHub.
- **Platforms:** Windows, macOS and Linux.

**Using GitHub Copilot?** [Tenet for GitHub Copilot](https://github.com/vedprakash-m/tenet-copilot), a full implementation inside VS Code and the GitHub Copilot app, is in progress.

**Behind a corporate network that blocks the npm registry?** Use `tenet init --offline`, and run `tenet upgrade` once you're online so GitHub proof cards can verify the package. To try Tenet without installing it globally, use `npx -y @vedprakash-m/tenet` in place of `tenet`.

## Roadmap

- **0.2.0 · Protect:** rules you turn on, decisions on pull requests, the full board.
- **0.3.0 · Verify:** signed evidence and a hardened CI verifier.
- **0.4.0 · Careful lane:** reference agents, independently written tests for risky changes, a minimal runner.

The longer arc runs from one developer and one agent to whole software factories: declared, measured and compared on the same open records. See the [vision][vision] and the [plan][plan].

## Learn more

[Getting started][start] · [Commands][commands] · [Concepts][concepts] · [FAQ][faq] · [Specifications][specs] · [Report a problem][issues]

Tenet is developed under its own standard: every change starts as a reviewed specification and is checked by independent conformance tests.

Code is licensed under [Apache-2.0](LICENSE). The standard and documentation are licensed under [CC BY 4.0][license-docs].

[start]: https://github.com/vedprakash-m/tenet/blob/main/docs/getting-started.md
[commands]: https://github.com/vedprakash-m/tenet/blob/main/docs/commands.md
[concepts]: https://github.com/vedprakash-m/tenet/blob/main/docs/concepts.md
[faq]: https://github.com/vedprakash-m/tenet/blob/main/docs/faq.md
[specs]: https://github.com/vedprakash-m/tenet/tree/main/tenet/specs
[vision]: https://github.com/vedprakash-m/tenet/blob/main/tenet/vision.md
[plan]: https://github.com/vedprakash-m/tenet/blob/main/tenet/specs/plan.md
[issues]: https://github.com/vedprakash-m/tenet/issues
[license-docs]: https://github.com/vedprakash-m/tenet/blob/main/LICENSE-docs
