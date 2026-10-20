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

**Unfinished M0 and partial Alpha.** The kernel, plugin, starter template and deterministic tests exist. Two standard-lane loops ran in VS Code Copilot on October 19, 2026; host isolation, tool restrictions, approval behavior and the full qualified tuple remain unqualified. An implementation audit found integrity and human-work preservation defects; corrective work is in progress. Capabilities and benefits described here remain intended outcomes until their gates pass. [specs/plan.md](specs/plan.md) records implementation, local validation, host observations and the remaining work separately.

## Development

Node 24 or newer runs the TypeScript sources directly; the shipped kernel is one bundled file that runs on Node 22.12+.

```bash
npm ci
npm run ci     # typecheck, architecture and skill lints, traceability, bundle, all tests
```

## Layout

- `packages/kernel/src` is the kernel: a pure `core/`, one `pipeline.ts` for every verb, and the adapters behind the ports for the store, Git, the process runner, the Node/Vitest stack, the project folder, recipes, the clock and randomness.
- `plugin/` is the payload: the coordinator and reviewer agents, two commands, five skills, and (after `npm run build`) the bundled kernel.
- `tools/` holds the build, the architecture and skill lints, and the requirement-to-fixture traceability report.

## Documentation

See the [Product Requirements Document](specs/PRD.md) for the vision, intended users, release scope, requirements and acceptance criteria.
