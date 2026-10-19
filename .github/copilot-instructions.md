# Instructions for working on Tenet

Tenet is a governed engineering loop for Copilot: a small deterministic kernel (`packages/kernel`) that records what is true, a plugin (`plugin/`) of agents, commands and skills that does the work, and a starter recipe. Three specs say what it is: `specs/PRD.md` (meaning), `specs/tech-spec.md` (mechanism), `specs/ux-spec.md` (wording). `specs/plan.md` sequences the work and is the progress record. If code, plan and a spec disagree, the spec wins; fix the plan or the code, and log a spec defect in plan §12.3.

## How to work
1. **Think before coding.** State assumptions. If a request has several readings, list them with a recommendation; do not pick silently. If a simpler approach exists, say so and push back. If something is unclear, stop and ask.
2. **Simplicity first.** The least code that solves the problem. No speculative features, no abstraction for one use, no handling of cases that cannot happen. Every complexity must earn its keep.
3. **Surgical changes.** Touch only what the task needs and match the surrounding style. Remove what your own change made unused; mention other dead code, do not delete it. Every changed line traces to the request.
4. **Goal-driven.** Turn a task into checks that can pass or fail, state them with the plan, and loop until they pass. Weak success criteria mean the goal is not yet clear.

## Impact before change
This is infrastructure other people's work will rely on. Before changing shared behavior (the pipeline, the state document, a verb's output, a reason code, a skill's closed vocabulary), work out what else moves: callers, stored records, rendered text, tests, the plan, the specs. Say what changes and its side effects. Work inside `specs/plan.md` needs no further approval. A decision the plan does not settle, or a spec amendment, goes to the owner first with alternatives and a recommendation, one decision at a time.

## Architecture rules (checked by `npm run lint`)
- `core/` is pure: no I/O, no adapter imports. Side effects sit behind six ports (store, git, runner, host, clock, random). Only adapters, `wire.ts` and `main.ts` touch the filesystem, processes or network.
- One pipeline (`pipeline.ts`) runs every verb: lock, recovery, envelope, effects, publish, external jobs. Front-ends hold no verdict, authority or budget logic.
- Only `core/verdict.ts` produces an endpoint; only `core/budget.ts` changes a counter. Binding facts (endpoint, receipts, counters, ownership) are written only by the kernel; agents explain, they never relabel.
- No `vm`, worker threads, `eval`, computed `import()`, client sockets, or remote Git commands in M0.
- Never claim more than the evidence shows. A response is never older than the facts it reports.

## Testing and gates
- Test-first for behavior. Use real processes, real Git and real signals when the behavior is about them (lock races, kills at each effect step, index preservation).
- Tag the test that proves a PRD requirement with `[REQ-ID]` in its title; `tools/coverage.ts` reads the tags.
- `npm run ci` runs typecheck, `lint-arch`, `lint-skills`, `coverage`, the bundle build (within its size budget) and every test. All of it passes before work is called done. Tests never depend on the developer's Git configuration or on host credentials.
- Node 24+ runs the TypeScript directly; the shipped bundle must run on Node 22.12+.

## Plan and honesty
- Update `specs/plan.md` before ending a turn that changed what is true: dashboard, checkboxes, and a §13 entry when something milestone-relevant moved.
- Use its five-state vocabulary exactly. `✅` needs a commit hash or CI run; local-only evidence stays `◐`. `🔬` needs a dated observation on the real host.
- Host behavior (VS Code, Copilot, subagents, approvals) is unobserved until a spike records it. Say "unobserved", never "should work". Each spike needs separate authorization.
- When you find a spec defect, record it in §12.3; if it touches a never-waivable requirement (PRD §4.7), raise it immediately.

## Feature lifecycle
1. Plan or spec change, approved. 2. Failing tests. 3. Implementation. 4. `npm run ci`. 5. Backfill the canonical specs if a rule or component was added. 6. Update the plan. 7. Commit only when asked: code and tests first, then spec and plan updates. Never commit credentials or `.env*`; `.tenet/` is git-ignored and never edited by hand.

## Skills and plugin text
Skill and agent text is executable product behavior. Keep it within the token budgets, name only verbs, flags, decision kinds, reason codes and actions that exist, and state a control only as strongly as its mechanism class allows. `tools/lint-skills.ts` checks this; it checks structure, not meaning, so read what you wrote.

## Writing
Say what you mean in literal words. Where a plain phrase exists, use it instead of a metaphor or flourish ("a setting worth changing", not "a dial worth turning"). Prose that performs makes the reader work and brings connotations nobody chose. This applies to code comments, skills, specs, commit messages and replies.
