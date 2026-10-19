---
name: tenet-intake
description: Turn a request into an acceptance basis: clarify, write examples and a design sketch, then record them with the kernel.
---
# Intake: the acceptance basis

Use when `next` says `basis`, `plan` or `decision`. Look facts up in the repository first; ask only for decisions.

## Draft the basis
Write down, in the user's words where possible:
1. **Requirements** the change must meet, one sentence each.
2. **Examples** under each requirement: concrete input and expected result. Include at least one boundary or negative case per new requirement. Mark each example's test file and whether it should fail today (`expect: fail`, a distinguishing red) or already pass (`expect: pass`, a preservation or boundary case).
3. **Invariants** the change must not break.
4. **Constraints**, **assumptions** (say "for now, X (easy to change later)"), and **deferred** choices.
5. A **design sketch** for Standard and Deep when the change adds a module, changes an exported type or signature, touches persistence or shared policy, or crosses a module boundary: where the behavior belongs, what changes, the call path, what is reused. 1,500 characters; skip it for obvious bug fixes and behavior-preserving refactors.

Every element has an `origin`: `request` only when it is literally in the user's own words, otherwise `tenet`. Never mark an inferred case as `request`. If the sketch commits to behavior, data, access, compatibility or an interface others consume, set `designCommitment` true.

## Record it
`tenet decide basis --h <handle>` with this JSON on stdin:
`{"propose": {"outcome": "...", "scopePaths": ["src/a.ts"], "design": "...", "designCommitment": false, "elements": [{"ref": "r1", "kind": "requirement", "origin": "request", "text": "..."}, {"ref": "e1", "kind": "example", "origin": "request", "of": "r1", "text": "...", "testFile": "src/a.test.ts", "test": "distinguishing", "expect": "fail"}]}}`

- Exit 0: the basis is recorded; follow `next`.
- Exit 3 with a `basis-confirm` question: show the kickoff with your additions labeled "(added)" and ask once. On "ok" send the identical proposal again with `--answer basis-confirm=confirm`; to change something, revise and propose again.
- A bug fix, a refactor, selected review fixes and requests that state their own boundaries have no additions, so there is no stop.

## Before drafting
State your assumptions. If the request has several readings, list them with a recommendation instead of choosing silently. If a simpler approach than the one asked for exists, say so. For a change to existing code, name what else it touches (callers, stored data, rendered text, tests) in the kickoff.

## New project
After purpose, users, scope and constraints, if the project's instruction file has no content of its own, offer the draft in `resources/conventions-draft.md` once, as a preview. Record the project's checks (test command, thresholds) and its authoritative documents there so later work starts with them.

## Rules
- A thin answer on purpose, users or a non-goal gets one concrete follow-up before a plan is drafted, never a second round.
- Plan steps are vertical slices: each runnable, independently checkable, and says how it is checked. Resolve the biggest uncertainty first.
- A change of direction is a delta: what changes, what it affects, what is unaffected; then the choices.
- An out-of-scope improvement you notice is named as "noticed, not changed".
