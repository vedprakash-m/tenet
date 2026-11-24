# Tenet

**Spec-driven development for software factories. Agents build what you meant, and you can see that they did.**

Tenet gives coding agents specifications you have read and blessed. With Tenet's GitHub Actions workflows configured, pull requests can show which blessed requirements they touch, which tagged tests passed on the tested commit, and what remains unchecked. The agent you already use can draft specifications from your code and docs. Underneath is an open standard, so any factory engine, tool or dashboard can work with the same records.

> **Status: alpha.0 in preparation.** Build a local package from this checkout to try the commands below. The [experience specification](tenet/specs/ux-spec.md) describes the full release journey.

## Get started

You need Git and Node.js 22 or later. From a checkout of the Tenet source, build and install the local package.

```sh
npm ci
npm pack
npm install --global ./vedprakash-m-tenet-0.1.0-alpha.0.tgz
```

Open a terminal in the Git repository you want to onboard. It needs at least one commit.

```sh
tenet --version
tenet --help
tenet onboard --inventory-only
```

Onboarding runs with defaults in a repository without `tenet.yaml`. The command writes an inventory and a drafting assignment under `.tenet/onboard/`. Give your coding agent `.tenet/onboard/assignment.json` to draft specifications. Tenet does not call a model.

In a repository configured for Tenet, use `tenet bless` to review and approve sections before their drafts take effect. Run `tenet check` to check the specifications and `tenet board` to see their status. `init`, `upgrade`, `remove` and `doctor` are part of the planned install flow. CI and agent-host setup are still release work.

---

## What you get

| Part | What it does | Release |
|---|---|---|
| **Onboarding** | Your agent drafts your vision, requirements, design, experience and plan from your code and docs, with source-backed statements cited and detected conflicts listed; you bless it section by section, and blessed text stays in force until you bless a change | 0.1.0-alpha.0 |
| **Proof card** | On every pull request, forks included: the blessed requirements the change touches, which acceptance items had their tagged tests pass on that exact commit (and whether those tests came with the change), and whether tests were deleted or skipped | 0.1.0-alpha.0 |
| **Agent context** | Your agents get only the blessed specifications their task touches, through `AGENTS.md`, skills or a local MCP server, plus short working rules you can replace; onboarding turns your existing `copilot-instructions.md` or `CLAUDE.md` rules into blessed specifications | 0.1.0-alpha.0 |
| **`tenet` command** | This checkout includes `onboard`, `bless`, `context`, `mcp`, `check`, `fix`, `split`, `verify` and `board` (specifications until alpha.1). Install and maintenance commands are planned for the release. | 0.1.0-alpha.0 |
| **Rules and decisions** | Rules first show what they *would have* blocked; you turn on the ones that earned it. Decisions use your forge's normal review | 0.1.0-alpha.1 |
| **Signed verification** | Evidence signed by a protected CI job, so the record cannot be forged or altered (it does not prove the checks were the right ones) | 0.1.0-alpha.2 |
| **Reference agents and careful lane** | Agent cards for the shaper (definitions), test writer (independent tests), builder and judge; for risky changes, tests are written by a separate agent and pinned before the build; an optional minimal runner chains them through your own agent tool | 0.1.0 |
| **Factory definition** | Declares your factory (workers, models, routing, environments) so it can be validated, recorded and compared | 0.1.x |

## Works with what you have

| Your agent or engine can | What you get |
|---|---|
| Open pull requests | Proof cards when the repository runs Tenet’s GitHub Actions workflows |
| Read `AGENTS.md` | The map of your specifications and the rules |
| Load skills | Onboarding, working a change, reviewing with findings |
| Use MCP | `context`, `check` and `status` as tools |
| Restrict file writes (a host binding, 0.1.x) | Protected files refused before they are written |
| Run headless (Tenet's runner, a headless agent host and `gh`) | Tenet's runner chains the shipped agents through it, up to your approvals (0.1.0); bigger factories plug in the same way |

Tenet never calls a model, so it works with whatever model your agent uses; context and skills need an agent that reads `AGENTS.md`, skills or MCP, and the onboarding evaluation names the agents it was tested with. Engines can also write evidence through a JSON file contract; engine adapters that let Tenet dispatch work arrive in 0.3. GitHub is the first supported forge. Any dashboard can use the board's JSON output. Tenet's records are tool-neutral. The alpha.0 release targets an end-to-end GitHub flow with the agent hosts named in its onboarding evaluation.

## Why Tenet

A **software factory** is the system through which people and AI agents turn intent into running software: the agents that write, test and review code, the engines that run them, the checks that judge their work, and the people who decide. Factories now produce code faster than anyone can check it. Agents report work as finished when it isn't. Intent drifts between the request, the specification, the code, the checks and the release, and every factory product grades its own gates in its own format.

- **Specifications are the source of truth.** From the vision down to each change, each with an owner. When code shows a specification is wrong, the fix is proposed in the same pull request, never silently worked around.
- **Proof, not claims.** Each change lists what it must prove, and each line of the proof card says how it was shown.
- **Autonomy earned on evidence.** People decide intent and exceptions; agents do bounded work; strictness grows only where it has paid for itself.
- **Honest about what it knows.** Every result says whether Tenet checked it, you must judge it, or it depends on your agent; nothing says "proven" that wasn't.
- **One form across tools.** Agent definitions, lifecycles, evidence and decisions are written down the same way whatever produces them, so factories can be declared and compared.

## From one developer to a fleet

| Stage | What Tenet adds |
|---|---|
| One developer, one agent | Blessed specifications agents work from; proof on every pull request |
| A team with several agents | Owners per area; rules that block when the team chooses; decisions where people already work |
| A factory with many agents and engines | A declared factory definition; agents qualified for their roles; signed evidence; cost per outcome |
| A fleet across many repositories | Campaigns your engines run across many targets, declared and recorded by Tenet, with an honest count of what was automated, done by hand or left unresolved |

## Roadmap

| Release | Delivers |
|---|---|
| 0.1.0-alpha.0 | Intent and proof: install, onboarding and blessing, agent context, the proof card, `check`, `fix`, `upgrade`, `remove` |
| 0.1.0-alpha.1 | Protect: rules you turn on (they stop honest mistakes; enforcement arrives with verify), decisions on pull requests, the full board |
| 0.1.0-alpha.2 | Verify: signed evidence and a hardened CI verifier |
| 0.1.0 | Careful lane with independent tests, reference agents, a minimal runner that works out of the box, the quick start |
| 0.1.x | Security-key decisions, kept promises and code health, campaigns, the factory definition, standalone downloads, an external pilot |
| 0.2–0.3 | The full lifecycle from discovery through operation; engine adapters |
| 1.0 | Stable rule IDs, a conformance kit for implementations and factory platforms, automatic upgrades, an open proposal process |

Details are in the [plan](tenet/specs/plan.md).

## Read further

| Document | What it covers |
|---|---|
| [Experience specification](tenet/specs/ux-spec.md) | What using Tenet is like, step by step. **Start here** |
| [Vision](tenet/vision.md) | Why Tenet exists, its principles and how success is measured |
| [Product requirements](tenet/specs/prd.md) | Requirements, with the [catalog](tenet/specs/prd/catalog.md), [tooling](tenet/specs/prd/tooling.md) and [decisions](tenet/specs/prd/decisions.md) parts |
| [Technical specification](tenet/specs/tech-spec.md) | Architecture, formats, commands and the trust model, with its [contracts](tenet/specs/tech-spec/contracts.md), [algorithms](tenet/specs/tech-spec/algorithms.md), [CI](tenet/specs/tech-spec/ci.md), [agents](tenet/specs/tech-spec/agents.md) and [onboarding](tenet/specs/tech-spec/onboarding.md) parts |
| [Plan](tenet/specs/plan.md) | Milestones and work packets |
| [Ledger](tenet/ledger/) | Every decision, with its reasons |
| [The standard](kit/TENET.md) | Being rewritten as a small kernel (CP-0015); until then the specifications above take precedence |

This repository is developed under its own standard: [tenet/now.md](tenet/now.md) shows where every change is.

## Project

- **Maintainer:** Ved ([@vedprakash-m](https://github.com/vedprakash-m)). The standard moves to an open proposal process with more than one steward before 1.0.
- **Contributing:** see [AGENTS.md](AGENTS.md) for how work flows in this repository.
- **License:** code under [Apache-2.0](LICENSE); the standard and documentation text under [CC BY 4.0](LICENSE-docs) (L-0031).
- **Related:** Tenet for Copilot (`tenet-copilot`), a VS Code implementation of the standard.
