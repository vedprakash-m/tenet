---
id: L-0003
kind: decision
date: 2026-11-22
packet: null
title: "Loops are engine-neutral definitions compiled to engines; Conductor first"
---
# L-0003 · Loops are engine-neutral definitions compiled to engines; Conductor first

## Context

An executable loop must target an engine. govaut already runs its engineering loop as Conductor YAML generated from a script.

## Decision or event

Tenet ships loops in a small engine-neutral format with five step kinds (agent, script, human_gate, set, route) and compiles them: Conductor first (mode A, strong guarantees), then host targets for Claude Code and Copilot (mode B, the CLI refuses moves whose gates fail). Implementations with their own kernel are mode C. Every target states its mode.

## Evidence

govaut's `workflows/engineering-loop.yaml` (assign, create, inspect, judge, record, decide, human gate) maps one to one onto the five step kinds.

## Consequences

PRD DEC-05; standard §18.5; tech spec §10–11.
