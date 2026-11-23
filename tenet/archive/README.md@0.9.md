# Tenet

**Spec-driven development for software factories, ready to use with the coding agents you already have.**

Install Tenet in a repository and three things change. Your coding agents work from specifications you own. Every pull request shows what is proven on that exact commit. Autonomy grows only as evidence earns it. Tenet works as-is with any coding agent and any model, and alongside any factory engine that works through pull requests. Underneath is an open standard, so factory platforms and tools can build on the same rules.

> **Status: design (M0).** The specifications are drafted; no code is published yet. Everything below describes the first releases, as specified in [the experience specification](tenet/specs/ux-spec.md).

---

## What you get

| Part | What it does | From |
|---|---|---|
| **`tenet` command** | Sets up a repository in one step; gives agents the specifications that apply to their task (`tenet context`); checks and repairs records (`check`, `fix`); shows where every change is (`board`); keeps itself current (`upgrade`) | 0.1.0-alpha.0 |
| **CI workflow** | Posts a proof card on every pull request: which acceptance items are proven on that commit, which are not, and whether tests were weakened | 0.1.0-alpha.0 |
| **Agent integration** | An `AGENTS.md` block, skills and a local MCP server that any coding agent can use, with nothing to configure | 0.1.0-alpha.0 |
| **Specification templates** | A starter `intent.md` that grows into a vision, product requirements, technical and experience specifications and a plan, each with an owner | 0.1.0-alpha.0 |
| **Rules and decisions** | Rules you turn on when they have earned it; decisions on the pull request with the forge's normal approve button | 0.1.0-alpha.1 |
| **Signed verification** | Proof signed by a protected CI job, so agents cannot fake it | 0.1.0-alpha |
| **Reference agents** | Agent cards for builder and judge roles, then shaper, verifier and planner, compiled to your agent's own format | 0.1.0 |
| **Factory definition** | Declares your factory (workers, models, routing, environments) so it can be validated, recorded and compared | 0.1.x |
| **The standard** | The rules behind all of this, for anyone building a compatible factory, engine or dashboard | Draft now; 1.0 |

## Works with what you have

| You use | How Tenet fits |
|---|---|
| Any coding agent | It reads the `AGENTS.md` block, loads Tenet's skills, or calls the local MCP server; no plugin needed |
| Any model | Tenet never calls a model, so the choice is yours and can change at any time |
| A factory engine or orchestrator | If it opens pull requests, its work gets proof cards with no integration. It can also write evidence and results through a JSON file contract. Engine adapters that let Tenet dispatch work arrive in 0.3 |
| CI | Your existing test commands are the evidence; Tenet adds one workflow |
| A dashboard | It reads `board.json`, one versioned record of where every change is and who acts next |
| GitHub | First forge supported; others follow the same contract |

Tenet does not run agents, host anything or need an account. It is the layer your agents, engines and checks share: what to build, what proves it, and who decides.

## Why Tenet

A **software factory** is the system through which people and AI agents turn intent into running software: the agents that write, test and review code, the engines that run them, the checks that judge their work, and the people who decide. Factories now produce code faster than anyone can check it. Agents report work as finished when it isn't, and can game the checks that judge them. Intent drifts between the request, the specification, the code, the checks and the release. Every factory product also defines itself in its own format and grades its own gates.

Tenet fixes this in four ways:

- **Specifications are the source of truth.** A ladder of documents, from the vision down to each change, each with an owner. Agents receive only the parts that apply. When code shows a specification is wrong, the fix is proposed in the same pull request, never silently worked around.
- **Proof, not claims.** Each change lists what it must prove, and CI shows what is proven on the exact commit.
- **Autonomy earned on evidence.** People decide intent and exceptions; agents do bounded work. Rules first show what they *would have* blocked, and autonomy is withdrawn when evidence or trust degrades.
- **One form across tools.** Agent definitions, lifecycles, evidence and decisions are written down the same way whatever produces them, so factories can be declared and compared, and any tool can take part.

## From one developer to a fleet

The smallest software factory is one developer and one coding agent, and the first release is built for it: one command, nothing blocks, a proof card on every pull request. The same records carry you further without changing tools.

| Stage | What Tenet adds |
|---|---|
| One developer, one agent | Specifications agents work from; proof on every pull request |
| A team with several agents | Owners per area; rules that block when the team chooses; decisions where people already work |
| A factory with many agents and engines | A declared factory definition; agents qualified for their roles; signed evidence; cost per outcome; autonomy by readiness |
| A fleet across many repositories | Campaigns that apply one intent across many targets, with an honest count of what was automated, done by hand or left unresolved |

## Get started

You need Git and a GitHub repository with Actions enabled. The command line needs Node 22 or later; without Node, use the agent route.

### With your coding agent (easiest)

Open your agent in the repository and paste:

```text
Set up Tenet in this repository: run `npx github:vedprakash-m/tenet init --yes`, show me the files it wrote and why,
then open a pull request named "Add Tenet" with only those files.
```

Merge the pull request. From then on, every pull request gets a proof card.

### In an existing repository

```bash
npx github:vedprakash-m/tenet init      # detects your tests, owners and docs; asks one question
git switch -c add-tenet
git add tenet.yaml tenet.lock AGENTS.md .github/workflows/tenet.yml
git commit -m "Add Tenet" && git push -u origin add-tenet
```

Open and merge the pull request. Then ask your agent for the next change you needed anyway, and read the proof card it gets.

### In a new project

Click **Use this template** on [vedprakash-m/tenet-starter](https://github.com/vedprakash-m/tenet-starter), or run `npx github:vedprakash-m/tenet init` in a new repository; it asks what you are building. Then write the intent with your agent before any code: your first approved change is the specification itself.

Full walkthroughs for both paths: [experience specification, Part 1](tenet/specs/ux-spec.md#part-1-start-here).

## What you see

Your agent opens a pull request that lists its acceptance items. Tenet's CI workflow posts a proof card and updates it on every push:

```markdown
### Tenet proof · 7c3e1a · advisory
✓ AB-1 proven · checkout.retry.test.ts › one retry after timeout (fails without the fix)
! AB-2 unproven · no test tagged [AB-2]
✓ no tests deleted or skipped · ✓ no protected files touched
Specs: C-1 · Would have blocked: AB-2 unproven (careful lane)
```

You review and merge with your forge's normal approve button. `tenet board` shows what is waiting for you, what is blocked and what changed since you last looked.

## What Tenet adds to your repository

| File | Purpose |
|---|---|
| `tenet.yaml` | Your level, who decides, which commands run your checks (about 9 lines) |
| `tenet.lock` | The exact Tenet version, so every machine and CI agree |
| `AGENTS.md` | A block telling your agents how to work with Tenet |
| `.github/workflows/tenet.yml` | Posts the proof card on pull requests |
| `tenet/intent.md` | New projects only: the first specification |

To remove Tenet, delete these files. Your code, specifications and records stay yours.

## Grow when you are ready

| Level | What changes | What it needs |
|---|---|---|
| **observe** (default) | Proof cards and agent context; nothing blocks | Nothing beyond `init` |
| **protect** | The rules you choose block a merge | Nothing more |
| **verify** | Proof is signed by CI, so agents cannot fake it; merging requires it | A short checklist: signing, a branch rule, an account for your agents |
| **assure** | Security-key approvals for policy and vision changes; hidden test scenarios | A security key |

Specifications grow the same way. You start with one `intent.md`, and `tenet split` proposes a vision, product requirements, technical and experience specifications, and a plan once the project needs them.

## Roadmap

| Release | Delivers |
|---|---|
| 0.1.0-alpha.0 | Intent and proof: `init`, starter specifications, agent context through skills and a local MCP server, the proof card, `check`, `fix`, `upgrade` |
| 0.1.0-alpha.1 | Protect: rules you turn on, decisions on pull requests, the board |
| 0.1.0-alpha | Verify: signed evidence and a hardened CI verifier |
| 0.1.0 | Careful lane with independent tests, reference agents, the quick start |
| 0.1.x | The assure level, kept promises and code health, campaigns, the factory definition and mappings from factory platforms, an external pilot |
| 0.2–0.3 | The full lifecycle from discovery through operation; engine adapters, so the same work runs on two engines with the same decisions |
| 1.0 | Stable rule IDs, a conformance kit for implementations and factory platforms, automatic upgrades, an open proposal process |
| 1.x | Agents and the factory itself qualified, compared, released gradually and retired on evidence |

Details are in the [plan](tenet/specs/plan.md).

## Read further

| Document | What it covers |
|---|---|
| [Experience specification](tenet/specs/ux-spec.md) | What using Tenet is like, step by step. **Start here** |
| [Vision](tenet/vision.md) | Why Tenet exists, its principles, horizons and how success is measured |
| [Product requirements](tenet/specs/prd.md) | Requirements, with the [catalog](tenet/specs/prd/catalog.md) and [tooling](tenet/specs/prd/tooling.md) parts |
| [Technical specification](tenet/specs/tech-spec.md) | Architecture, file formats, commands and the trust model |
| [Plan](tenet/specs/plan.md) | Milestones and work packets |
| [Ledger](tenet/ledger/) | Every decision, with its reasons |
| [The standard](kit/TENET.md) | The normative text, being rewritten as a small kernel (CP-0015) |

This repository is developed under its own standard: its `tenet/` folder is laid out as in any project, and [tenet/now.md](tenet/now.md) shows where every change is.

## Project

- **Maintainer:** Ved ([@vedprakash-m](https://github.com/vedprakash-m)). The standard moves to an open proposal process with more than one steward before 1.0.
- **Contributing:** proposals arrive as change packets; see [AGENTS.md](AGENTS.md) for how work flows in this repository.
- **License:** to be chosen before 0.1.0 (open question OQ-04).
- **Related:** Tenet for Copilot (`tenet-copilot`), a VS Code implementation of the standard.
