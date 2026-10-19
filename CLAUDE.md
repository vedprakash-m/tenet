# Working on Tenet

Tenet is built from three canonical specs (`specs/PRD.md`, `specs/tech-spec.md`, `specs/ux-spec.md`) and sequenced by `specs/plan.md`. The plan is the progress record: update it, with evidence, before ending a turn that changed what is true.

## Behavioral guidelines
1. **Think before coding.** State assumptions. If several readings exist, present them. If a simpler approach exists, say so and push back. If something is unclear, stop and ask.
2. **Simplicity first.** The least code that solves the problem. No abstraction for a single use, no flexibility nobody asked for, no handling of impossible cases. Would a senior engineer call it overcomplicated? Then simplify. Every complexity must earn its keep.
3. **Surgical changes.** Touch only what the task needs; match the surrounding style. Remove what your change made unused; mention other dead code, do not delete it. Every changed line traces to the request.
4. **Goal-driven execution.** Turn each task into verifiable goals before starting, state the plan with its checks, and loop until the checks pass.

## Impact before change
Before a change that touches shared behavior (the pipeline, the state document, a verb's output, the skills' closed vocabularies), analyze what else moves: callers, stored records, rendered text, tests, the plan. Say what will change and the side effects. Work inside `specs/plan.md` needs no further approval; a decision the plan does not settle, or a spec amendment, goes to the user first, with alternatives and a recommendation.

## Gates (all must pass before work is called done)
- `npm run ci`: typecheck, `lint-arch`, `lint-skills`, `coverage` (traceability), build (bundle within budget), all tests.
- Test-first for behavior: a failing test, then the code. Real processes, real Git, real signals where the behavior is about them.
- Tag the test that proves a PRD requirement with `[REQ-ID]` in its title (`tools/coverage.ts`).
- Never mark something `✅` in the plan without a commit hash or CI run. Local-only evidence stays `◐`.

## Lifecycle for a feature
1. Spec or plan change, approved. 2. Failing tests. 3. Implementation. 4. `npm run ci`. 5. Backfill the canonical spec if a rule or component was added (record gaps in plan §12.3). 6. Update the plan. 7. Commit only when asked: code and tests first, then spec and plan updates.

## Honesty
Never claim more than the evidence shows. Host behavior (VS Code, Copilot, subagents, approvals) is unobserved until a spike records it; say "unobserved", not "should work".

## Writing
Say what you mean in literal words. No metaphor or flourish where a plain phrase exists ("a setting worth changing", not "a dial worth turning"). Prose that performs makes the reader work and drags in connotations nobody chose. This applies to code comments, skills, specs and replies.

## Secrets
Never commit credentials or `.env*`. Tenet's own state (`.tenet/`) is git-ignored and never edited by hand.
