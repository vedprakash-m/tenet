---
id: L-0024
kind: decision
date: 2026-11-23
packet: CP-0001
title: "One CI shape, intent on the card, and honest result classes"
---
# L-0024 · One CI shape, intent on the card, and honest result classes

## Context

Round 12 (four reviews) asked whether the v0.11 specifications, built exactly as written, would work on real repositories and deliver the vision. They agreed the vision needs no change. They also agreed that alpha.0 as specified would fail in practice:
- Blessed state relied on a commit that squash merges remove from fresh clones.
- The proof job had no way to set up dependencies, toolchains or services.
- Acceptance IDs needed the pull-request number before the pull request existed.
- An item could be reported as "proven" when a required test never ran.
- The acceptance digest left out `Implements:`.
- The gate's first-match rule could hide an enforced failure behind an advisory one.
- Open pull requests could not be recorded.
- The card never showed which blessed requirements a change touched.

The reviews also found ordering bugs in the plan:
- the M0 trial needed code that doesn't exist in M0
- CP-0010 and CP-0052 depended on each other the wrong way
- the GA proving order was reversed
- the release procedure published before testing

## Decision or event

The Owner asked for every good recommendation to be adopted using best judgement. Sixteen decisions were taken (DEC-48 to DEC-50):

- **D15 Squash-safe citations:** content anchors set at blessing; `fix` re-anchors moved lines; `bless` can confirm `sources-changed` with one key.
- **D16 Acceptance IDs within the pull request:** `AB-1`, stored as `pr-<n>/AB-1`. A tag counts only on lines the pull request adds; requirement tags give lasting traceability.
- **D17 Tests that didn't run are shown:** expected and executed counts per item; results `passed`, `failed`, `not run`, `no test`, never "proven".
- **D18 One evaluation identity:** commit, acceptance block including `Implements:`, the implemented requirements' blessed text, and policy. Replies bind it.
- **D19 One CI shape from alpha.0:** a test job with no write token (Tenet's workflow with setup, or a step in the project's existing CI job) and a recorder that never runs the change. `verify` adds sealing and signing. The fallback is one job.
- **D20 The card leads with the blessed requirements a change touches** (ALG-14). It also shows test totals and "written in this change", and works without an acceptance block.
- **D21 Independence** means who wrote the check, compared with who wrote the change.
- **D22 The gate evaluates every claim and rule;** any enforced refusal blocks. `stop-threshold` and `review-converged` are added to the registry.
- **D23 Blessings can't be quietly lost or faked:** copy integrity; rejecting an edit keeps the blessed text; Unicode slugs; renames carried by `fix`; blessings changed shown on the card; protected defaults.
- **D24 Context never silently drops a rule:** global rules first in a reserved share; `applies_to` for prose; omitted IDs listed.
- **D25 Four result classes:** checked by Tenet, for you to judge, depends on your agent or host, not done by Tenet. `protect` is labelled detected.
- **D26 Agent instructions are contract:** the `AGENTS.md` block, skill steps and tagging recipes (new part `tech-spec/agents.md`).
- **D27 An exact MCP binding:** pinned revision, notifications, ping, result envelopes, tested with a real client on Windows.
- **D28 Exact weakening checks:** anchored patterns, name-based comparison, a note for consolidation, "not checked" per language.
- **D29 Measures that can be taken:** a committed bless log, cost status, first findings defined, timed sessions for V-M11.
- **D30 Robust install:** a pending manifest, installed values kept, user edits preserved, `.gitignore` and pull-request template blocks, the unborn `HEAD` message, a fallback when global npm install fails.

**New parts:**
- `tech-spec/ci.md`: the CI shape, running checks, workflows, the records ref, verification, decisions, trust, safe failure and release, moved from tech spec §7.2–§7.6 and contracts §7.
- `tech-spec/agents.md`.
- `prd/decisions.md`: PRD §7–§9, moved under the rollover rule.

**Plan v0.12:**
- **Waves:** CP-0018 moves to A0-2; CP-0044 no longer needs CP-0012; CP-0010 comes before CP-0052; the release needs CP-0052, CP-0053 and CP-0054.
- **New split:** CP-0054 converts this repository's specifications.
- **Trials:** the M0 trial runs on stubbed dependencies, a full CP-0044 trial comes before A0-3, and an evaluator trial comes before alpha.1 is frozen.
- **No dispatch** without all eight contract fields.
- **Suites:** an alpha.0 scenario suite and executable README and UX examples.
- **Release:** pack once, test, publish the same bytes.
- **M0 decisions:** CP-0002 settles the licence and schema host before bootstrap; CP-0015 migrates this repository's `tenet.yaml` with the Owner's approval.
- **Escalation and stop thresholds** move to CP-0020; `agent check` moves to CP-0022.
- **Pilots:** CP-0023 judges V-H1 against its thresholds; later milestones define their horizon's population before taking a baseline.

**Not adopted, or reduced:**
- logical section IDs with redirects (renames only)
- an import-graph index (a same-area fallback instead)
- field-test designs for H2–H4 now (recorded as entry conditions)
- a blanket ban on words (narrowed to "proven")

## Evidence

The four reviews and the synthesis in the session of 2026-11-23. The reviewers' factual claims were checked against the repository before the synthesis.

## Consequences

- The vision is unchanged.
- PRD, catalog and tooling move to v0.12, with a new decisions part.
- The tech spec moves to v0.11, with contracts, algorithms and onboarding at v0.11 and new CI and agents parts.
- The UX spec and plan move to v0.12, and the plan parts are updated.
- One new packet (CP-0054). Dependencies are updated in every affected `packet.yaml`.
- Alpha.0 gains a recorder workflow and a scenario suite, and loses later rework: alpha.1 and alpha.2 reuse the same CI shape.
