---
id: L-0018
kind: decision
date: 2026-11-23
packet: CP-0001
title: "The experience starts from two explicit paths: an existing repository and a new project"
---
# L-0018 · The experience starts from two explicit paths: an existing repository and a new project

## Context

After the journey rewrite (L-0017), the Owner still could not tell what to do first, and then next, for an existing repository versus a new project. The journey described generic steps (install, set up, optional intent) without saying who acts or how the two situations differ.

## Decision or event

1. UX specification Part 1 is now "Start here", with two paths of five numbered steps each, every step labelled with who acts (you, your agent, Tenet):
   - **An existing repository:** run `init`; merge the four files it writes; ask the agent for a real change and read the proof card; merge it; later, have the agent draft `tenet/intent.md` from existing docs, with inferred requirements marked `reported`.
   - **A new project:** create the repository and run `init`, which asks what is being built and its kind and writes an intent template; commit to main; write the intent first with the agent and approve it as the first governed change; then build the first slice, approving the test command added to `tenet.yaml`.
2. Both paths end at the same daily loop (Part 2); everything optional moves to Part 3, keeping Tenet current to Part 4.
3. `tenet init` (R-020) asks two questions in a new project and writes the intent template; CP-0010 and CP-0013 prove both paths.

## Evidence

The Owner's reading of the UX specification after L-0017.

## Consequences

The quick start follows UX Part 1 exactly; any change to either path changes the quick start with it.
