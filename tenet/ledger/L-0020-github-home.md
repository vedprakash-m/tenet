---
id: L-0020
kind: decision
date: 2026-11-23
packet: CP-0002
title: "Tenet's home is github.com/vedprakash-m/tenet"
---
# L-0020 · Tenet's home is github.com/vedprakash-m/tenet

## Context

The ways in to Tenet (L-0019) used a placeholder for the GitHub owner, pending CP-0002.

## Decision or event

The Owner set Tenet's home: `https://github.com/vedprakash-m/tenet`, with the template repository `vedprakash-m/tenet-starter`. Until the npm package name is chosen (OQ-01), the default command is `npx github:vedprakash-m/tenet init`, and the agent prompt uses it.

## Evidence

The Owner's instruction of 2026-11-23.

## Consequences

The UX specification, README, tech spec and plan name the home. CP-0002 still decides the npm name and the schema host.
