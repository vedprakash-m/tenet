---
id: L-0002
kind: decision
date: 2026-11-22
packet: null
title: "One npm package holds the kit and a deterministic CLI; projects vendor the kit read-only"
---
# L-0002 · One npm package holds the kit and a deterministic CLI; projects vendor the kit read-only

## Context

Subscribing projects must receive improvements to the standard without manual upgrade work, while agents and hosts need the rules as local files.

## Decision or event

The standard ships as one versioned npm package containing the kit (standard, schemas, templates, reference agents, criteria, loops, evaluation suites, migrations, conformance tests) and the `tenet` CLI. Projects vendor the kit into `.tenet/kit/` with hashes in `tenet.lock`, customize only through overlays that may only narrow, and receive updates through an update bot plus `tenet upgrade`. Patch and minor updates auto-merge after the conformance check; major updates and any permission, gate or severity change wait for the Owner.

## Evidence

Same pattern as lock files and vendored configuration in mature ecosystems; overlays that only narrow avoid merge conflicts and permission drift.

## Consequences

PRD DEC-02, DEC-03, DEC-04; standard §18; tech spec §12.
