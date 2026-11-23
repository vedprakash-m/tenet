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

Read the standard: [kit/TENET.md](kit/TENET.md).

## What ships (planned)

| Layer | What | Where in this repository |
|---|---|---|
| Standard and kit | `TENET.md`, schemas, templates, defaults, reference agents, judge protocol and criteria, loop definitions. Vendored into each project at `.tenet/kit/` | [kit/](kit/) |
| Package-only content | Migrations, conformance tests, reference evaluation suites, host formats. Used by the CLI, never vendored | [pkg/](pkg/) |
| CLI | `tenet`: init, adopt, new, move, board, check, doctor, receipt, close, escalate, build, run, upgrade, conform, eject. Deterministic; never calls a model | `src/` (from M1) |
| Targets | Generated Conductor workflows and Claude Code / Copilot agent files | Output of `tenet build` |

Everything ships as one npm package (name pending); the kit is also released as a checksummed archive for implementations and projects without Node.

## What it adds to your project

```text
tenet.yaml      your profile: how the process fits this project
tenet.lock      the exact version and file hashes (written by the CLI)
AGENTS.md       a generated block telling agents where the rules are
.tenet/         the vendored kit, your overlays, generated targets
tenet/          your records: vision, specs, packets, ledger, holdout, runs
```

Install with `npx <package> init` (or `adopt` for an existing codebase). Updates arrive as pull requests from an update bot that reads `tenet.lock`, so any language works. `tenet eject` removes everything except your profile and records.

## Documents in this repository

| Document | What |
|---|---|
| [tenet/vision.md](tenet/vision.md) | Why Tenet exists, horizons and outcome metrics |
| [tenet/now.md](tenet/now.md) | The current factory floor |
| [tenet/specs/prd.md](tenet/specs/prd.md) | Deliverables and requirements |
| [tenet/specs/tech-spec.md](tenet/specs/tech-spec.md) | Architecture, file formats, commands |
| [tenet/specs/ux-spec.md](tenet/specs/ux-spec.md) | CLI output, board, onboarding, wording |
| [tenet/specs/plan.md](tenet/specs/plan.md) | Milestones and packets |
| [tenet/ledger/](tenet/ledger/) | Decisions and milestones |
| [docs/](docs/) | User documentation (from M1) |

This repository runs under its own standard: `tenet/` here is laid out exactly as in any project.

## Related

- **Tenet for Copilot** (`tenet-copilot`): a VS Code implementation of the standard's kernel.
- **govaut**: source of the agent-governance patterns and the reference loop shape.
- **Torus**: the first project to subscribe.
