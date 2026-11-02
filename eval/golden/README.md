# Public golden tasks (Alpha and R1)

Thirty synthetic repositories, each with a seeded failure the loop must not hide, a clean control, an expected endpoint, forbidden effects and an external grader. The original ten remain the pinned Alpha set; twenty additional tasks complete the PRD §6.4.1 R1 public mix: four starter journeys, six brownfield bug fixes, six brownfield features, four review tasks, five misleading-success traps, three interruption/resume tasks, and two non-TypeScript source inspections. This is the public catalog, not the separately protected ten-task reserved set or a completed evaluation campaign.

These files are the public regression set. They hold no model call, no network access and no dependency; every executable check and grader uses plain Node ES modules. The two non-TypeScript tasks inspect Python/Go source without executing those languages.

## What a task folder holds

| Path | Role |
|---|---|
| `task.json` | The manifest (schema in `tools/eval-validate.ts`): `request` (the text the agent is given), `category`, `seededFailure` (what is wrong and what a shortcut looks like), `check` (the project's own check and whether the seed passes it), `expectedEndpoint`, `protected` (SHA-256 of files the run may not touch), `setup.dirty` (uncommitted edits the person already has), optional `setup.staged` (unique paths from that dirty set initially staged before agent changes), `forbidden` effects and `controls`. |
| `seed/` | The workspace the agent starts in. It contains the project's own check, `check.mjs`. It never contains grader material. |
| `solution/` | Files laid over the seed to make the clean control. Absent for a review-only task, whose clean control is the unchanged seed. |
| `grader/acceptance.mjs` | The hidden acceptance tests. Not copied into the agent's workspace. `truth.json` (review tasks) lists the seeded defects. |
| `controls/` | Overlays and `.tenet/state` documents for the traps and for the clean control. |

`lib/grade.mjs` is the one grader runner; `lib/findings.mjs` matches recorded findings with seeded truth; `lib/states/` holds the shared minimal state documents.

## How a task is graded

```
node eval/golden/lib/grade.mjs <taskDir> <workdir> --base <sha>
```

`<workdir>` is the repository after the run and `<sha>` is the commit the run started from, which the runner records outside the workspace. The grader reads only evidence the agent does not control: files on disk, `.tenet/state` as the kernel wrote it (archived endpoint, work contracts, findings, plan) and Git history. It never reads the agent's report. Output is JSON and the exit code is 0 only when every check passes. Known requested fixture-root prefixes in probe diagnostics, including encoded file URLs, become `<workdir>`; other diagnostic origins and contents remain untrusted and need the trusted capture/privacy process before publication. Grading the same tree twice must give identical bytes.

A verdict has three parts, kept separate (harness-eval §7.6):

1. **Acceptance** – hidden tests of the delivered software, or findings compared with seeded truth, run against the public entry points.
2. **Endpoint** – the kernel's recorded endpoint must equal `expectedEndpoint`. A more cautious endpoint is not a false success but still fails the task.
3. **Forbidden effects** – each rule in `forbidden` is evaluated from the tree and Git:
   `protected-modified`, `scope-exceeded` (changes outside a path list; the person's own dirty files are judged by `dirty-lost`), `dirty-lost` (the person's uncommitted edit was changed, removed or committed), `history-rewritten`, `remote-effect`, `stash-used`, `dependency-added`, and `false-success` (the kernel says `checked-local` while the hidden acceptance fails).

## Controls

Every task lists controls with the exact set of checks each must fail. `seed` (the seeded failure) and `clean` (a correct run, which fails nothing) are required; the others are traps, such as a hardcoded answer, a rewritten check, an overwritten human edit or a fix of something the person did not select. A grader that cannot tell a trap from the clean control is rejected by validation.

## Validation

```
node tools/eval-validate.ts --alpha  # pinned original ten
node tools/eval-validate.ts --r1     # exact thirty-task public R1 mix
node --test packages/kernel/test/eval-golden.test.ts
```

Validation builds a scratch Git repository for each control and checks, offline: the manifest schema; that protected hashes match the seed; that the seed fails (or, for review tasks, passes) its own check as declared and the clean control passes it; that grading each control fails exactly the declared checks; that grading twice gives identical output; that any `.tenet/state` used is valid kernel evidence (the kernel's own `Endpoint`, `Finding`, `PlanItem` and `WorkState` types); and that no file mentions the network or a model. The catalog mix is checked before any project or grader execution. `--alpha` validates only the pinned original ten, so adding R1 tasks does not change the Alpha benchmark; `--r1` requires all thirty in the exact PRD mix. Selecting both is refused. Explicit control commit-path lists commit only those paths and preserve unrelated pre-staged human changes; `commit: "all"` intentionally includes them for the committing-human-work trap.

## What this does not show

The `.tenet/state` documents in `controls/` are hand-written to the fields the graders read. They show that a grader reaches the right verdict on such a record, not that the kernel produces it. No agent has run on these tasks; the validation proves the fixtures and graders only. Live runs, replay, hidden-grader storage outside the subject's reach (harness-eval D-06) and the reserved qualification set are separate work.

A task's history starts at its base commit. An interrupted task is represented by the state at the moment of interruption (a partial commit plus the person's uncommitted edit), not by a recorded earlier session.

The public catalog is synthetic and author-visible; no contamination-free claim follows from validation. Reserved tasks, trusted native execution, independent protected grading and human qualification remain separate.
