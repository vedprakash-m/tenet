---
id: L-0027
kind: decision
date: 2026-11-23
packet: CP-0001
title: "Last pass before build: tests matched to declarations, CI that works, fail-closed outcomes"
---
# L-0027 · Last pass before build: tests matched to declarations, CI that works, fail-closed outcomes

## Context

The final pre-build review (round 13, four reviews) found that the vision and architecture hold, but a faithful build of alpha.0 would still fail where intent, evidence, authority or execution changes hands:
- **Examples and grammar:**
  - the published workflows didn't parse
  - the underscore tag form failed its own examples
  - ordinary bracketed tokens such as `[UTF-8]` would read as tags
- **Test evidence:**
  - expected counts compared source declarations with runtime cases
  - "written in this change" was always true
- **CI transport:**
  - existing-CI mode couldn't produce reports
  - dot-folder and repeated-name artifacts broke uploads
  - fork pull requests were looked up and fetched wrongly
- **Outcomes:** a degraded control concluded `neutral`, which GitHub accepts as passing a required check.
- **Blessing:**
  - moving a citation edited blessed text
  - renaming a heading lost its blessing
  - the onboarding "kept" measure compared against the wrong commit
  - blessed paths were protected under `change-policy`
  - the `.gitignore` block hid a vendored kit
- **Plan:**
  - CP-0054 needed `tenet bless` before it existed
  - the import table forbade helpers two packets needed
  - the alpha.0 maintainer gate had no owner
  - CP-0015 was overloaded
  - this repository's AGENTS.md described the old process

## Decision or event

The Owner asked for every good recommendation to be adopted with best judgement. Decisions D31 to D48 of the round-13 synthesis were applied (DEC-53 to DEC-55).

**Proof and tests**
- **D31 Results matched to declarations:**
  - a case belongs to a tagged declaration by name; parameter instances, retries and shards roll up
  - `coverage: not-confirmed` replaces a false "every test ran"
  - per-runner declaration forms include `t.Run(`, `@Test` and `#[test]` on the line before, multi-line `it(` and `record_property`
- **D32 Authorship:** `written-here`, `tag-added-here` or `unknown`; independence is credited from generated `Tenet-Agent` trailers.
- **D33 Tag grammar:** tags are `AB-n` or the project prefix only; the underscore form is fixed; `AB`, `CF`, `Q` and `V` are reserved.
- **D34 One outcome table (CI §10):** at `verify` a required control that can't run concludes `failure`, never `neutral`.

**CI**
- **D35 Workflows:** quoted expressions, Node 22, `tenet-bundle/` outside dot-folders, per-job artifact names merged by the recorder, actions pinned by SHA, no event fields in `run:`.
- **D36 Existing-CI mode** only where the job writes a report, or the user accepts a marked reporter edit.
- **D37 Recorder binding:**
  - pull requests found for forks and shared heads
  - `refs/pull/<n>/*` fetches
  - runs keyed by attempt, with a forward-only `latest`
  - bundle limits; plumbing writes

**Blessing and specification files**
- **D38 Blessings survive change:** the digest covers the body only, with citation ranges normalized; the cited text is kept beside the copy; relocation only on a unique match; renames move the copy.
- **D39 Document fit:** per-section `level`; vision IDs `V-(?:[A-Z]+)?\d+`; table parsing that ignores extra columns; `drafted_at_rev`; `tenet.yaml` read from the working tree.
- **D40 Protection and `.gitignore`:** blessings get their own protection tier; the block keeps a vendored kit; the recorder's broad token is labelled below `verify`.
- **D41 One way to propose changes:** agents edit specification files and `tenet.yaml` in the pull request; drafter write paths; the drafter's self-check is labelled as one.

**Engineering basics and the plan**
- **D42 Pinned basics:** `tsconfig`, Biome, a pinned `gen:types` generator, npm workspaces, an architecture test, `test/helpers/`, and the `ReportParser`, `ForgeAdapter` and `HostDescriptor` seams.
- **D43 Determinism and speed:** `ls-tree -z` with byte ordering, CommonMark fences, batched git, Windows rename retries, bounded event reads.
- **D44 Plan fixes:** CP-0054 split into preparation and CP-0057 (blessing); CP-0018 added to CP-0048 and CP-0053; CP-0016 owns the unaided alpha.0 sessions; CP-0015 owns the R-009 cases and gets 5 days; the trial becomes CP-0058; one finding shape; the tarball's file list asserted.
- **D45 Later contracts:** the alpha.1, alpha.2 and 0.1.0 parts list what their contracts must cover (reducer table, evidence freshness with evaluation inputs, decision identity, the false-block measure, the `person-present` payload, `merge_group`, runner crash recovery, loop routes on disposition, explicit fix targets, ordered human-gate options).
- **D46 Executable examples:** `npm run check:examples`.
- **D47 Wording:** "recorded" and "forge-attributed" blessings; blessing sets authority, not truth; tool-neutral records; the core, the runner and host capabilities named apart; the README's first line.
- **D48 Context always completes:** an item asked for by ID always comes back whole; estimated tokens named as such.

**New plan part:** `plan/alpha.0b.md` (waves A0-5 to A0-8), split from `plan/alpha.0.md` under the rollover rule.

**Not adopted, or reduced:**
- a transaction journal with rollback: kept the pending manifest, adding path confinement and a re-check before each write
- a GitHub App for the recorder: labelled instead; signing is the boundary at `verify`
- a precedence table for every combination of concepts: the outcome table plus one badge instead
- benchmark profiles per operating system: one corpus with a recorded profile
- a central requirement-ID allocator: `fix` renumbers
- gate node types: CP-0016 owns the alpha.0 maintainer gate
- further packet splits: re-estimated when their contracts are written

## Evidence

The four reviews and the synthesis in the session of 2026-11-23. The reviewers' claims were checked against the repository; the workflow parse failures and the tag-grammar failure were reproduced.

## Consequences

- **Vision:** unchanged.
- **Versions:** PRD, catalog, tooling and decisions move to v0.13; the tech spec and its parts to v0.12; the UX spec and plan to v0.13, with the new part `alpha.0b`.
- **Packets:** two new ones (CP-0057, CP-0058), with dependencies updated.
- **This repository's AGENTS.md:** names the normative sources until CP-0015 and describes the build flow.
- **What's next:** after this round, specification reviews stop. The spikes and the medium-model trial run, then the build begins.
