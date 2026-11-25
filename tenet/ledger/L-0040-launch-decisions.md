---
id: L-0040
kind: decision
date: 2026-11-25
packet: CP-0059
title: "Launch on engineering readiness; the alpha.0 milestone publishes as 0.1.0; live evaluation with Claude Code and Copilot"
---
# L-0040 · Launch decisions

## Context

The alpha.0 milestone's features are built and reviewed, and the 13 scenarios pass. plan.md §1 and DEC-57 let the evidence track gate *announcing* a release: two outside maintainers completing setup unaided, and a scored live-agent onboarding evaluation. The Owner wants to announce that people can download, onboard and use Tenet as soon as it works, without calling it an alpha or a preview.

## Decision or event

1. **Launch on engineering readiness.** The release is tagged and announced when these hold:
   - the `remove` safety fixes from review r24 are merged and re-checked
   - the release workflow passes the same tarball on Linux, Windows and macOS
   - publishing works

   Outside-maintainer sessions, the scored live evaluation and blessing this repository's own specifications (CP-0057) follow after launch, as evidence rather than gates. This overrides DEC-57's announcing gate for this release only.
2. **The alpha.0 milestone publishes as version `0.1.0`.**
   - The plan's milestone names stay as labels.
   - Published versions follow their own sequence: alpha.0 → `0.1.0`, alpha.1 → `0.2.0`, alpha.2 → `0.3.0`, the milestone the plan calls "0.1.0" → `0.4.0`, its point releases → `0.4.x`.
   - npm's `latest` tag points at each release.
   - The version bump, starter example and docs are updated at the release cut, after the last fix merges.
3. **The live onboarding evaluation runs now, in parallel, with two real agents:** Claude Code and GitHub Copilot CLI.
   - Each runs as a fresh, unattended session in throwaway copies of the fixture repositories outside this repository, with the Owner's permission.
   - Each sees only the fixture repository and the onboarding assignment.
   - The Owner scores recall and invented statements.

## Evidence

The Owner's answers of 2026-11-25. [audit-r20.md](../packets/release-0.1.0-alpha.0/audit-r20.md) and [review-r24.md](../packets/CP-0010-tenet-init/evidence/review-r24.md) list what remained.

## Consequences

- The release is tagged `v0.1.0`.
- The post-launch evidence (live evaluation scores, outside-maintainer sessions, CP-0054 and CP-0057) is tracked in the release packet and reported when it lands.
- A failure found after launch is fixed in a point release.
