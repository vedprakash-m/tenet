---
id: L-0001
kind: decision
date: 2026-11-22
packet: null
title: "Tenet names the standard; the VS Code implementation becomes Tenet for Copilot"
---
# L-0001 · Tenet names the standard; the VS Code implementation becomes Tenet for Copilot

## Context

A tool-neutral process for governed, spec-driven software factories grew inside the Torus project (`specs/process.md`). The Owner's earlier VS Code implementation already carried the name Tenet.

## Decision or event

The name Tenet moves to the standard. The existing implementation is renamed Tenet for Copilot (`tenet-copilot`) and will declare conformance like any other implementation. "Factory" is reserved for a running system, never for the standard itself.

## Evidence

Alternatives weighed: Throughline, Krama, Vidhi, Pramana, Sutra, Meridian. Tenet reads as "a principle held to", fits the Owner's naming taste, and is short enough for a CLI.

## Consequences

Namespace check is required before publishing (CP-0002). The GitHub repository rename is an outward action for the Owner. Torus references to the old path need updating.
