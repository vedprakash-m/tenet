---
id: L-0005
kind: decision
date: 2026-11-22
packet: CP-0001
title: "Repository split into kit, pkg and factory; projects get three root files and two folders"
---
# L-0005 · Repository split into kit, pkg and factory; projects get three root files and two folders

## Context

The first draft mixed three things at the repository root: the product (standard, kit, CLI), this repository's own records, and the seed `process.md`. The kit was written in `standard/`, copied to `kit/` at release and vendored to `.tenet/kit/`, so the same files had three names. The standard asked projects for about fourteen top-level folders, some duplicating the vendored kit. The version was recorded in both `tenet.yaml` and `tenet.lock`, and the update path assumed Node.

## Decision or event

The Owner accepted the recommended layout while CP-0001 was still open, so the M0 drafts were revised in place:

1. `standard/` is renamed `kit/` and is vendored to `.tenet/kit/` file for file, with no copy step.
2. Content the CLI needs but agents never read (migrations, conformance, reference evaluation suites, host formats) lives in `pkg/`, ships in the package and is never vendored.
3. A project's records live in one records folder, `factory/` by default, set by `paths.records`. Overlays live in `.tenet/overlays/`. A project gains `tenet.yaml`, `tenet.lock`, an `AGENTS.md` block, `.tenet/` and the records folder, and nothing else.
4. This repository keeps its own records in `factory/`, the same shape as any project.
5. One npm package is kept (DEC-02); the kit is also released as a checksummed archive for implementations and projects without Node.
6. `tenet.yaml` holds the accepted version range; `tenet.lock` holds the exact version. The update bot reads `tenet.lock`, so any language works.
7. `.tenet/kit/` stays committed (DEC-03) and is marked as generated so reviews collapse it.
8. `process.md` is archived at `factory/design/origin/process.md` as the record of where the standard came from.
9. `tenet doctor` and `tenet eject` are added (PRD R-025, R-026, M2).

Git was initialized with the drafts as a baseline commit before the move.

## Evidence

The proposal and the Owner's acceptance in the M0 working session of 2026-11-22. Package-and-lock layouts, per-project dot-folders for tool state and vendored configuration are common in mature ecosystems.

## Consequences

Standard §3.1, §14.3, §14.6, §14.7, §16, §18.1–18.3, §18.7; tech spec §1–4, §8, §10–13; PRD D1–D3, R-024–R-026; plan CP-0003, CP-0006, CP-0010, M2, M4; UX spec §3 and the agent block. L-0002 still holds; its path `.tenet/kit/` is unchanged. L-0004 describes the layout as created and is not edited.
