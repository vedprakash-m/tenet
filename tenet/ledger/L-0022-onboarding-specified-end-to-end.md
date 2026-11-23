---
id: L-0022
kind: decision
date: 2026-11-23
packet: CP-0001
title: "Onboarding specified end to end; releases promise only what they ship"
---
# L-0022 · Onboarding specified end to end; releases promise only what they ship

## Context

A review round (four reviews) walked the first week as a user. The central promise, that Tenet drafts a project's specifications from its code and docs at high quality and a person carefully blesses them before they become truth, had no contract: drafting was an optional later step limited to `intent.md`, confirmed "by exception", with no states, no quality checks and no review experience. The reviews also found install and first-contact failures:
- `npx github:` installs the default branch and builds on the user's machine, leaving no `tenet` command
- a false no-Node claim
- no per-test reports in most repositories
- comment permissions and forks

They also found releases promising features that arrive later, stale text in the tech spec (§12, trailers, the `protected` default, `bots` at init, "observed"), a conflict between R-208 and R-209 on L2 approval, unreachable gate rows, acceptance text not bound to evidence, and a SemVer ordering problem (`0.1.0-alpha` sorts before `alpha.0`).

## Decision or event

The Owner approved the synthesis and its four recommendations:
1. One onboarding pull request carries setup and drafts.
2. All five logical views are always drafted, sized to the project.
3. A dedicated packet.
4. The npm package `@vedprakash-m/tenet`.

1. **Onboarding (R-223, DEC-44; tech-spec/onboarding.md; CP-0048).**
   - Preflight, then a deterministic inventory.
   - The user's agent, through the `draft-specs` skill, asks the Owner what only they can answer, then drafts vision, requirements, design, experience and plan for the chosen scope: one `intent.md` or separate documents.
   - Each requirement carries an origin (`observed`, `documented`, `asked`, `inferred`) and a citation that `tenet check` verifies. Conflicts are listed, never resolved by the agent.
   - Sections are `draft`, `blessed`, `rejected`, `deferred` or `stale`. Only a person blesses, through `tenet bless` in a terminal or, from alpha.1, a review action. `tenet context` treats drafts as hints.
   - Drafter and spec-reviewer agent cards. An evaluation suite with planted conflicts and a fresh-session test.
   - New metric V-M12 (faithful onboarding). V-V3 is split into a first useful finding and a blessed baseline. UX-14: drafts are never truth.
2. **Install (R-221, DEC-45).**
   - npm `@vedprakash-m/tenet` from alpha.0, with prebuilt packages on releases.
   - Pinned commands. A global or dev-dependency install so `tenet` persists; MCP entries run the pinned package.
   - An honest Node requirement. A setup workflow with nothing local is an `idea` (R-199).
3. **First contact and proof.**
   - Preflight lists every write and edit, and records an install manifest. `tenet remove` ships in alpha.0.
   - Existing CI test reports are reused, or the reporter setting proposed.
   - The proof card is a check-run summary that states each item's method, binds the acceptance text's digest, finds weakening from the diff, runs three built-in rules, labels proposed checks and fork pull requests, and reads "intent not yet blessed" before a baseline exists.
   - Host capability levels (R-222).
4. **Rules and releases.**
   - One approval table per level and section (R-208, R-209).
   - Gate verdict and next action computed separately.
   - Replies bind the commit the latest card showed (no ten-minute window).
   - First-policy rule for proposed checks.
   - alpha.0's board shows specifications only.
   - The verify release is renamed `0.1.0-alpha.2`.
   - Stale text fixed.
5. **Rollover.** PRD §4.5 moved to `prd/tooling.md` §3; the tech spec's onboarding and install moved to `tech-spec/onboarding.md`.

## Evidence

Reviews and synthesis of 2026-11-23; the npm package-spec documentation (git references resolve to the default branch); Semantic Versioning 2.0.0 precedence; a 2026 study finding generated context files did not raise task success.

## Consequences

Vision v0.10; PRD, catalog and tooling v0.10; tech spec v0.9 with its onboarding part; UX spec v0.10; plan v0.10; README rewritten. The first release must pass the onboarding evaluation suite and a fresh-session test before outside maintainers try it.
