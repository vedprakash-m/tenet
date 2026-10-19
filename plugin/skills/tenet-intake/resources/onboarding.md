# Starting a project with Tenet

Five habits shape every start: state assumptions and list readings (never pick silently); prefer the simplest thing that works; change only what the task needs; turn the goal into checks that can pass or fail; say what else a change touches before making it. Both flows below apply them. Ask only for decisions the repository cannot answer.

## Which flow
Run `tenet inspect doctor` first. It is read-only and reports the stack, test runner, package manager, commit hooks and whether the folder is a Git repository. An empty folder, or one with only a README or license, is greenfield. Anything with source is brownfield, even if small.

## Greenfield (an empty folder)
1. **Understand.** Purpose and users, scope and non-goals, the core flows, data, failure modes, quality bar, constraints. Answer from the request first; ask only what is missing. A one-clause answer on purpose, users or a non-goal gets one concrete follow-up, never a second round.
2. **Offer readings.** If the request supports several products or stacks, give at most three with a recommendation and what each costs to change later. If it is a TypeScript web or API app, the recommendation is the starter (`tenet-starter-ts-web-api`); otherwise say Tenet can plan and review but not yet build and check that stack.
3. **Plan in vertical slices.** Each step is runnable and says how it is checked. The first step is the smallest thing a user can try. List the steps; do not detail distant ones.
4. **One kickoff card**, one reply: Git (start a repository; recommended), the plan and its first step, the two or three choices that change the first step (recommended first), what "done" means for step 1 as examples, and the starter's protected paths. "Ok" accepts exactly the picks shown.
5. **Scaffold, check, commit** as its own contract (see the starter skill), then offer the instruction-file draft (`resources/conventions-draft.md`) as a preview. Step 1 is the next contract.

## Brownfield (existing code)
1. **Read before asking.** Source layout, README, existing instruction files, test and lint setup, scripts, CI, recent commits. Search yourself; never ask what the repository answers. Say what you found in three or four lines, including what you could not determine.
2. **Respect it.** Extend the existing patterns, even where you would choose differently. Do not convert the project to the starter and do not add files it does not need. Unrelated uncommitted files are left alone; an overlapping one is the kernel's question.
3. **Say what Tenet can do here.** Take the level from `open` and state it once. If tests cannot run (dependencies missing, runner unsupported), say what is missing and what still works.
4. **Characterize before changing.** For code the task touches, write preservation tests that pass today, so a regression has somewhere to show. Record existing failures as "fails before and after", not as yours.
5. **Impact first.** In the kickoff, name what the change touches beyond the file it edits: callers, stored data, rendered text, tests, configuration, scripts that parse output. If the answer is more than the task needs, propose the smaller change.
6. **Instruction file.** If the loaded file has no content of its own, offer the draft once, filled from what you read (commands, layout, rules the repository already checks), not from guesses. If it has content, add nothing.
7. **Then the task** follows the normal lanes. Keep the first change small; a first success on a small slice builds the evidence the next one needs.
