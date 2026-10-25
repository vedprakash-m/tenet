<!-- DRAFT for owner review. MIT is selected; remaining contribution/sign-off and code-of-conduct decisions are still pending. -->
# Contributing

Tenet records what is true about engineering work, so changes to it are held to the same standard: nothing is called done on a claim alone. This file says how a change gets in. The project rules for people and agents are in [.github/copilot-instructions.md](.github/copilot-instructions.md); read that file first.

## Before you start

- **License:** Tenet and its own starter-template code use [MIT](LICENSE), selected by the owner on 2026-10-24. Contributions must be compatible with that license; incorporated third-party code retains its applicable licenses/notices. Remaining contribution and release-process decisions are not settled by license selection.
- **Code of conduct:** PLACEHOLDER-CODE-OF-CONDUCT. The release requires one (PRD OSS-01); it is not written yet.
- **Security problems** go to the channel in [SECURITY.md](SECURITY.md), not to a public issue.
- **Maintainers:** one person holds all maintainer roles today. There is no second maintainer, and independent review of consequential work is done by a fresh-context reviewer agent or by the owner (plan section 4.5).

## What the specs are

Three specs say what Tenet is, and a plan sequences the work:

| File | Owns |
|---|---|
| [specs/PRD.md](specs/PRD.md) | Meaning: what Tenet must do and why |
| [specs/tech-spec.md](specs/tech-spec.md) | Mechanism: how |
| [specs/ux-spec.md](specs/ux-spec.md) | Wording: what the user reads |
| [specs/plan.md](specs/plan.md) | Sequence and the progress record |

If code, plan and a spec disagree, the spec wins. Fix the plan or the code. A defect in a spec is logged in plan section 12.3 and not routed around.

## The lifecycle for a feature

Do the steps in order. Do not skip one.

1. **Spec.** Write `specs/<feature>.md`: requirements, behavior as examples with the test file for each, state or contract changes, alternatives considered with a recommendation, risks, assumptions, acceptance criteria. A step that the canonical specs already fully specify and the plan already sequences needs only its plan entry.
2. **Review.** An independent pass over the spec (a fresh-context reviewer, `/tenet-review`, or the owner). Every finding gets a disposition.
3. **Sign-off.** The owner approves. No implementation before this.
4. **Implement test-first.** A failing test, then the code, then the next test. Use real processes, real Git and real signals when the behavior is about them. Tag the test that proves a PRD requirement with `[REQ-ID]` in its title (`tools/coverage.ts` reads the tags).
5. **Validate.** `npm run ci` passes: typecheck, both lints, coverage, the bundle build within its size budget, and every test. Tests do not depend on your Git configuration or host credentials.
6. **Try it as a user would.** Build the bundle (`npm run build`) and drive `plugin/kernel/tenet.mjs` through the feature on a scratch repository. Compare with the spec's examples and write down what you saw and what you did not.
7. **Finalize.** Backfill the canonical specs if a rule or component was added. Move the feature spec to `.archive/specs/`. Add a dated entry to `CHANGELOG.md` (what changed, files, tests). Update `specs/plan.md`. Check `.gitignore`.
8. **Privacy check.** Run `npm run privacy` on the staged change; before a push also `node tools/privacy-check.ts --range @{u}..HEAD`. It looks for keys, tokens, credential assignments, personal paths and real addresses in added lines. It finds likely leaks and proves nothing; read the result. Never commit credentials or `.env*`. `.tenet/` is git-ignored and is never edited by hand.
9. **Commit and push when asked.** Code and tests first, then spec, plan and changelog. After a push, confirm CI passes before calling it done.

For a small fix that changes no shared behavior, the same rules apply on a smaller scale: a failing test, the fix, `npm run ci`, the privacy check.

## Working rules

1. **Think before coding.** State assumptions. If a request has several readings, list them with a recommendation. If a simpler approach exists, say so.
2. **Simplicity first.** The least code that solves the problem. No speculative features or abstraction for one use.
3. **Surgical changes.** Touch only what the task needs and match the surrounding style. Every changed line traces to the request.
4. **Goal-driven.** Turn a task into checks that can pass or fail, and loop until they pass.
5. **Impact before change.** Before changing shared behavior (the pipeline, the state document, a verb's output, a reason code, a skill's closed vocabulary), work out what else moves: callers, stored records, rendered text, tests, the plan and the specs.

## Architecture rules (checked by `npm run lint`)

- `core/` is pure: no I/O and no adapter imports. Side effects sit behind six ports (store, git, runner, host, clock, random). Only adapters, `wire.ts` and `main.ts` touch the filesystem, processes or network.
- One pipeline (`pipeline.ts`) runs every verb. Front-ends hold no verdict, authority or budget logic.
- Only `core/verdict.ts` produces an endpoint; only `core/budget.ts` changes a counter. Binding facts are written only by the kernel.
- No `vm`, worker threads, `eval`, computed `import()`, client sockets or remote Git commands.
- Never claim more than the evidence shows.

## Setup

Node 24 or newer runs the TypeScript sources directly. The shipped bundle must run on Node 22.12 or newer.

```bash
npm ci
npm run ci
```

`npm run ci` runs typecheck, `lint-arch`, `lint-skills`, the quality lint, coverage, the build and every test.

## Plugin text is product behavior

Skill and agent text is executable behavior. Keep it within the token budgets. Name only verbs, flags, decision kinds, reason codes and actions that exist. State a control only as strongly as its mechanism allows. `tools/lint-skills.ts` checks structure, not meaning, so read what you wrote.

## Claims about the host

Behavior of VS Code, Copilot, subagents and approvals is unobserved until a spike records it, and each spike needs the owner's separate authorization. Write "unobserved", never "should work". A requirement is marked implemented only with a commit or CI run, and observed only with a dated observation on the real host. The status words are defined in [specs/plan.md](specs/plan.md) section 0.1.

## Writing

Use literal words. Where a plain phrase exists, use it instead of a metaphor or flourish. This applies to code comments, skills, specs, commit messages and replies.

## Extensions

Recipes, roles and host bindings by outside contributors will follow a request-for-comments process with certification levels (experimental, community, official; PRD OSS-03). That process is not written yet, and such contributions cannot be accepted.
