# Tenet

**Spec-driven development for software factories. Agents build what you meant, and you can see that they did.**

Tenet sets up your repository so that your coding agents work from specifications you have read and blessed, and every pull request shows what is proven on that exact commit. It drafts those specifications from your own code and docs, through the agent you already use. Nothing blocks your work until you choose. Underneath is an open standard, so any factory engine, tool or dashboard can work with the same records.

> **Status: design (M0). Nothing is published yet.** The steps below describe the first release, 0.1.0-alpha.0, as specified in the [experience specification](tenet/specs/ux-spec.md).

## Get started

You need Git, a GitHub repository with Actions enabled, and Node 22 or later where the command or your agent runs. There is no account and no service.

**Recommended: let your coding agent do it.** Open your agent in the repository and paste:

```text
Install Tenet with `npm install --global @vedprakash-m/tenet@0.1.0-alpha.0`, run `tenet init --yes` and show me what it wrote.
Then run `tenet onboard`, follow the draft-specs skill, ask me the questions only I can answer,
and open one pull request named "Set up Tenet" with the setup files and the drafted specifications.
```

Your agent installs Tenet, reads your code and docs, asks you what code can't tell it (purpose, users, what must never happen), and opens one pull request. Statements drawn from code or docs cite their source, your answers and the agent's guesses are labelled, and the conflicts it detects are listed for you to settle. Run `tenet bless` to read and approve each section; **nothing drafted is in force until you bless it.** Merge, and every later pull request gets a proof card.

**Other ways in:**
- Run the commands yourself: `npm install --global @vedprakash-m/tenet@0.1.0-alpha.0`, then `tenet init` and `tenet onboard`.
- New project: **Use this template** on [vedprakash-m/tenet-starter](https://github.com/vedprakash-m/tenet-starter).

Step-by-step walkthroughs for an [existing repository or a new project](tenet/specs/ux-spec.md#part-1-start-here).

**What Tenet changes in your repository:** it adds `tenet.yaml` (about 9 lines), `tenet.lock` and a CI workflow; it adds a marked block to `AGENTS.md` and, where needed, a test-reporter setting and your agent host's MCP entry; onboarding adds your specifications. `init` lists every change before making it. **To remove Tenet,** run `tenet remove`: it undoes exactly what `init` recorded and keeps your specifications.

---

## What you get

| Part | What it does | Release |
|---|---|---|
| **Onboarding** | Your agent drafts your vision, requirements, design, experience and plan from your code and docs, with source-backed statements cited and detected conflicts listed; you bless it section by section, and blessed text stays in force until you bless a change | 0.1.0-alpha.0 |
| **Proof card** | On every pull request from the repository (forks get it as a job summary): which acceptance items passed a test on that exact commit, which are unproven, and whether tests were deleted or skipped | 0.1.0-alpha.0 |
| **Agent context** | Your agents get only the blessed specifications their task touches, through `AGENTS.md`, skills or a local MCP server | 0.1.0-alpha.0 |
| **`tenet` command** | `init`, `onboard`, `bless`, `context`, `check`, `fix`, `board` (specifications until alpha.1), `upgrade`, `remove` | 0.1.0-alpha.0 |
| **Rules and decisions** | Rules first show what they *would have* blocked; you turn on the ones that earned it. Decisions use your forge's normal review | 0.1.0-alpha.1 |
| **Signed verification** | Evidence signed by a protected CI job, so the record cannot be forged or altered (it does not prove the checks were the right ones) | 0.1.0-alpha.2 |
| **Reference agents and careful lane** | Agent cards for builder and judge roles; tests written by a separate agent for risky changes | 0.1.0 |
| **Factory definition** | Declares your factory (workers, models, routing, environments) so it can be validated, recorded and compared | 0.1.x |

## Works with what you have

| Your agent or engine can | What you get |
|---|---|
| Open pull requests | Proof cards, with no integration |
| Read `AGENTS.md` | The map of your specifications and the rules |
| Load skills | Onboarding, working a change, reviewing with findings |
| Use MCP | `context`, `check` and `status` as tools |
| Restrict file writes (a host binding, 0.1.x) | Protected files refused before they are written |

Tenet never calls a model, so any model works. Engines can also write evidence through a JSON file contract; engine adapters that let Tenet dispatch work arrive in 0.3. GitHub is the first forge supported. Any dashboard can read `board.json`.

## Why Tenet

A **software factory** is the system through which people and AI agents turn intent into running software: the agents that write, test and review code, the engines that run them, the checks that judge their work, and the people who decide. Factories now produce code faster than anyone can check it. Agents report work as finished when it isn't. Intent drifts between the request, the specification, the code, the checks and the release, and every factory product grades its own gates in its own format.

- **Specifications are the source of truth.** From the vision down to each change, each with an owner. When code shows a specification is wrong, the fix is proposed in the same pull request, never silently worked around.
- **Proof, not claims.** Each change lists what it must prove, and each line of the proof card says how it was shown.
- **Autonomy earned on evidence.** People decide intent and exceptions; agents do bounded work; strictness grows only where it has paid for itself.
- **One form across tools.** Agent definitions, lifecycles, evidence and decisions are written down the same way whatever produces them, so factories can be declared and compared.

## From one developer to a fleet

| Stage | What Tenet adds |
|---|---|
| One developer, one agent | Blessed specifications agents work from; proof on every pull request |
| A team with several agents | Owners per area; rules that block when the team chooses; decisions where people already work |
| A factory with many agents and engines | A declared factory definition; agents qualified for their roles; signed evidence; cost per outcome |
| A fleet across many repositories | Campaigns that apply one intent across many targets, with an honest count of what was automated, done by hand or left unresolved |

## Roadmap

| Release | Delivers |
|---|---|
| 0.1.0-alpha.0 | Intent and proof: install, onboarding and blessing, agent context, the proof card, `check`, `fix`, `upgrade`, `remove` |
| 0.1.0-alpha.1 | Protect: rules you turn on, decisions on pull requests, the full board |
| 0.1.0-alpha.2 | Verify: signed evidence and a hardened CI verifier |
| 0.1.0 | Careful lane with independent tests, reference agents, the quick start |
| 0.1.x | Security-key decisions, kept promises and code health, campaigns, the factory definition, standalone downloads, an external pilot |
| 0.2–0.3 | The full lifecycle from discovery through operation; engine adapters |
| 1.0 | Stable rule IDs, a conformance kit for implementations and factory platforms, automatic upgrades, an open proposal process |

Details are in the [plan](tenet/specs/plan.md).

## Read further

| Document | What it covers |
|---|---|
| [Experience specification](tenet/specs/ux-spec.md) | What using Tenet is like, step by step. **Start here** |
| [Vision](tenet/vision.md) | Why Tenet exists, its principles and how success is measured |
| [Product requirements](tenet/specs/prd.md) | Requirements, with the [catalog](tenet/specs/prd/catalog.md) and [tooling](tenet/specs/prd/tooling.md) parts |
| [Technical specification](tenet/specs/tech-spec.md) | Architecture, formats, commands and the trust model, with its [onboarding part](tenet/specs/tech-spec/onboarding.md) |
| [Plan](tenet/specs/plan.md) | Milestones and work packets |
| [Ledger](tenet/ledger/) | Every decision, with its reasons |
| [The standard](kit/TENET.md) | Being rewritten as a small kernel (CP-0015); until then the specifications above take precedence |

This repository is developed under its own standard: [tenet/now.md](tenet/now.md) shows where every change is.

## Project

- **Maintainer:** Ved ([@vedprakash-m](https://github.com/vedprakash-m)). The standard moves to an open proposal process with more than one steward before 1.0.
- **Contributing:** see [AGENTS.md](AGENTS.md) for how work flows in this repository.
- **License:** to be chosen before 0.1.0 (open question OQ-04).
- **Related:** Tenet for Copilot (`tenet-copilot`), a VS Code implementation of the standard.
