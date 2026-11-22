# Tenet

**A standard for governed, spec-driven software factories.**

Agents now write much of the code. Tenet is the set of rules that lets an Owner hand the building to a fleet of agents and still know what is being built, why, how far it got, and what evidence supports every claim.

> Status: **0.1.0-draft (M0).** Nothing here is approved or published yet.

## What Tenet defines

- **Change packets** as the only unit of work, in three lanes (Quick, Standard, Deep) set by risk.
- **Thirteen stations in five phases**: Define (intake, triage, shape, commit), Construct (design, plan, build), Assure (verify, review, validate), Deliver (integrate, release, observe), then close.
- **Gates and evidence**: receipts tied to the exact candidate, computed freshness, findings with severity, endpoints chosen by rules rather than claimed.
- **A factory floor**: one generated board showing every packet, its stage, its blocker and what waits for the Owner.
- **An ownership gradient**: the Owner owns the vision; agents gain agency toward code; holdout scenarios stay hidden from builders.
- **Escalation**: a stop rule that raises stuck work to the lowest level that can answer it.
- **Agent management**: versioned agent definitions with least-privilege permissions, a shared judge protocol, qualification per model and host, staged release, scorecards and a kill switch.

Read the standard: [standard/TENET.md](standard/TENET.md).

## What ships (planned)

| Layer | What |
|---|---|
| Standard | `TENET.md`, versioned |
| Kit | Schemas, templates, reference agents, judge protocol and criteria, loop definitions, evaluation suites, migrations, conformance tests |
| CLI | `tenet`: init, adopt, new, move, board, check, receipt, close, escalate, build, run, upgrade, conform. Deterministic; never calls a model |
| Targets | Generated Conductor workflows and Claude Code / Copilot agent files |

All in one npm package (name pending). Projects vendor the kit read-only and receive updates through an update bot and `tenet upgrade`.

## Documents in this repository

| Document | What |
|---|---|
| [vision.md](vision.md) | Why Tenet exists, horizons and outcome metrics |
| [now.md](now.md) | The current factory floor |
| [specs/prd.md](specs/prd.md) | Deliverables and requirements |
| [specs/tech-spec.md](specs/tech-spec.md) | Architecture, file formats, commands |
| [specs/ux-spec.md](specs/ux-spec.md) | CLI output, board, onboarding, wording |
| [specs/plan.md](specs/plan.md) | Milestones and packets |
| [standard/](standard/) | The standard and its kit |
| [ledger/](ledger/) | Decisions and milestones |

## Related

- **Tenet for Copilot** (`tenet-copilot`): a VS Code implementation of the standard's kernel.
- **govaut**: source of the agent-governance patterns and the reference loop shape.
- **Torus**: the first project to subscribe.
