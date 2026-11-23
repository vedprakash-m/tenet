---
id: L-0021
kind: decision
date: 2026-11-23
packet: CP-0001
title: "Tenet is positioned as a ready-to-use system built on a standard"
---
# L-0021 · Tenet is positioned as a ready-to-use system built on a standard

## Context

The README and the PRD led with "the spec-driven standard for software factories". The Owner asked why anyone would download a standard alone. Tenet is meant to be a solution used as-is with any software factory and any model or coding agent.

## Decision or event

1. Tenet is described first as a **ready-to-use spec-driven development system for software factories**, with the open standard underneath for those building compatible tools (DEC-43; PRD §1).
2. The README opens with what you get (the command, the CI workflow, agent integration, specification templates, rules and decisions, signed verification, reference agents, the factory definition, the standard) and when each arrives, then with what it works with.
3. The boundary is stated plainly. From the first release it works as-is with any coding agent (through the `AGENTS.md` block, skills or the local MCP server) and any model, since it never calls one. Any engine that opens pull requests gets proof cards with no integration, and engines can write evidence through the JSON file contract. Engine adapters that let Tenet dispatch work arrive in 0.3. Tenet does not run agents or host anything.

## Evidence

The Owner's question of 2026-11-23; PRD D1–D7 and tooling R-041, R-042, R-048 and R-049.

## Consequences

Descriptions of Tenet lead with what a user can install and use, and mention the standard as the foundation.
