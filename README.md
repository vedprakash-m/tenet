# Tenet

**Turn high-level human intent into delivered, maintained and evolving software through a governed, continuously improving engineering practice.**

Tenet brings together engineering best practices, personalized guidance, specialized agents, model flexibility and project governance. Its aim is to reduce the effort of coordinating AI-assisted development while keeping consequential decisions and permissions under human control.

## Tenet for Copilot

The planned first deliverable is a native Copilot plugin, not a new IDE, coding runtime or autonomous worker service. It will build on the host's existing chat, agents, models and tools to support a complete development loop:

- Clarify the problem, desired outcomes and constraints before implementation.
- Preserve project intent and decisions across successive changes.
- Apply proportionate design, implementation, review and verification practices.
- Connect completion claims to observed evidence and surface missing checks.
- Improve shared workflows through bounded, measured evaluation.

Projects should remain ordinary software projects that can be maintained without Tenet. The longer-term vision extends beyond Copilot, but support for other tools and workloads is not yet established.

## Status

**Early implementation (M0).** The deterministic kernel, the plugin payload (agents, commands and skills) and their tests exist in this repository. Nothing has been run inside VS Code Copilot yet, so installing the plugin, dispatching the reviewer and the approval behavior are untested on the real host, and the starter template does not exist. Capabilities and benefits described here are intended outcomes, not shipped features or demonstrated results. [specs/plan.md](specs/plan.md) is the honest, current record of what is built and what has been observed.

## Development

Node 24 or newer runs the TypeScript sources directly; the shipped kernel is one bundled file that runs on Node 22.12+.

```bash
npm ci
npm run ci     # typecheck, architecture and skill lints, traceability, bundle, all tests
```

## Layout

- `packages/kernel/src` is the kernel: a pure `core/`, six ports, one `pipeline.ts` for every verb, and the adapters behind the ports.
- `plugin/` is what ships: the coordinator and reviewer agents, two commands, four skills, and (after `npm run build`) the bundled kernel.
- `tools/` holds the build, the architecture and skill lints, and the requirement-to-fixture traceability report.

## Documentation

See the [Product Requirements Document](specs/PRD.md) for the vision, intended users, release scope, requirements and acceptance criteria.
