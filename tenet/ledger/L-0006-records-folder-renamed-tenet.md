---
id: L-0006
kind: decision
date: 2026-11-22
packet: CP-0001
title: "The default records folder is tenet/, not factory/"
---
# L-0006 · The default records folder is tenet/, not factory/

## Context

L-0005 named the records folder `factory/`. The Owner pointed out that the folder is not the factory. It holds what the factory reads and writes: intent (vision, specs), work (packets) and history (ledger, runs, holdout). The standard itself says Tenet is a standard, not a factory (§18). The default name is dropped into every subscribing repository, so it also must not collide with folders projects already have.

## Decision or event

The default records folder is `tenet/` (`paths.records: tenet`). The standard keeps calling it "the records folder". Hidden `.tenet/` belongs to the tool (vendored kit, overlays, generated targets); visible `tenet/` belongs to the project. This repository's records moved from `factory/` to `tenet/`.

Alternatives considered: `records/` (plain, but collides in applications with a records domain), `specs/` (inaccurate for packets, ledger and runs, and commonly taken), `work/`, `project/`, `governance/` (vague or likely to collide).

## Evidence

A visible, tool-named folder for specs and changes is an established pattern in spec-driven tools (for example OpenSpec's `openspec/`). A tool-named folder cannot collide with a project's own folders.

## Consequences

Supersedes item 3 of L-0005 for the folder name only. Standard §3.1, §16, §18.2, §18.7; tech spec §1, §2, §4.1; UX spec §3; plan T-0006.4; defaults; `tenet.yaml`; `README.md`; `AGENTS.md`.
