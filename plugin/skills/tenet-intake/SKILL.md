---
name: tenet-intake
description: "Turn a request into an acceptance basis: clarify, write examples and a design sketch, then record them with the kernel."
---
# Intake: the acceptance basis

Use when `next` says `basis`, `plan` or `decision`. Look facts up in the repository first; ask only for decisions.

## Draft the basis
Write down, in the user's words where possible:
1. **Requirements** the change must meet, one sentence each.
2. **Examples** under each requirement: concrete input and expected result. Include at least one boundary or negative case per new requirement. Mark each example's test file and whether it should fail today (`expect: fail`, a distinguishing red) or already pass (`expect: pass`, a preservation or boundary case). If `tenet decide basis` answers `boundary-example-missing`, add one as your own addition.
3. **Invariants** the change must not break.
4. **Constraints**, **assumptions** (say "for now, X (easy to change later)"), and **deferred** choices.
5. A **design sketch** for Standard and Deep when the change adds a module, changes an exported type or signature, touches persistence or shared policy, or crosses a module boundary: where the behavior belongs, what changes, the call path, what is reused. 1,500 characters; skip it for obvious bug fixes and behavior-preserving refactors.

Every element has an `origin`: `request` only when it is literally in the user's own words, otherwise `tenet`. Never mark an inferred case as `request`. If the sketch commits to behavior, data, access, compatibility or an interface others consume, set `designCommitment` true.

## Record it
`tenet decide basis --h <handle>` with this JSON on stdin:
`{"propose": {"outcome": "...", "scopePaths": ["src/a.ts"], "design": "...", "designCommitment": false, "elements": [{"ref": "r1", "kind": "requirement", "origin": "request", "text": "..."}, {"ref": "e1", "kind": "example", "origin": "request", "of": "r1", "text": "...", "testFile": "src/a.test.ts", "test": "distinguishing", "expect": "fail", "support": ["src/helpers.ts"]}]}}`

- `support` lists the helpers, fixtures and mocks the test depends on, locked with it along with the runner configuration — never the file you are about to implement or change; that file is expected to differ between baseline and candidate. `decide basis` refuses a `support` entry that also names a `scopePaths` path (`support-overlaps-scope`).
- When two or more examples share one `testFile`, name each test's own example id in its title (e.g. `it("[EX-006-5ze.1] greet() returns Hello, world!", ...)`, the id from `decide basis`'s response) so each is proved on its own assertions, not the whole file's aggregate result.
- Exit 0: the basis is recorded; follow `next`.
- Exit 3 with a `basis-confirm` question: show the kickoff with your additions labeled "(added)" and ask once. On "ok" send the identical proposal again with `--answer basis-confirm=confirm`; to change something, revise and propose again.
- A bug fix, a refactor, selected review fixes and requests that state their own boundaries have no additions, so there is no stop.

## Before drafting
State your assumptions. If the request has several readings, list them with a recommendation instead of choosing silently. If a simpler approach than the one asked for exists, say so. For a change to existing code, name what else it touches (callers, stored data, rendered text, tests) in the kickoff.

## Starting a project
For a new project or the first Standard-or-deeper change in code you have not worked in, follow `resources/onboarding.md`: run `tenet inspect doctor`, then the greenfield or brownfield flow. The instruction-file draft in `resources/conventions-draft.md` is offered once, as a preview, only when the loaded file has no content of its own.

## Rules
- A thin answer on purpose, users or a non-goal gets one concrete follow-up before a plan is drafted, never a second round.
- Plan steps are vertical slices: each runnable, independently checkable, and says how it is checked. Resolve the biggest uncertainty first.

## Record the overview and the plan
- `tenet decide overview --h <handle>` with `{"propose": {"purpose": "...", "users": "...", "preferences": [], "nonGoals": []}}`; name only the fields that changed.
- `tenet decide plan --h <handle>` with `{"propose": {"items": [{"ref": "a", "outcome": "...", "check": "how it is checked", "dependsOn": []}]}}`. It returns a `plan-confirm` question showing the numbered plan: show it, and on yes send the same proposal with `--answer plan-confirm=confirm`. To change a recorded plan, send the whole list again with `id` for each item you keep; an item you leave out is dropped.
- Work one item at a time: `tenet open feature --plan-item <id>`. `tenet inspect` shows the plan and which item is next; propose it, never start it unasked.
- A change of direction is a delta: what changes, what it affects, what is unaffected; then the choices.
- An out-of-scope improvement you notice is named as "noticed, not changed".
