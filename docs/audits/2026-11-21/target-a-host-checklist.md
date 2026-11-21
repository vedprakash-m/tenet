# Target A host checklist

This checklist prepares the owner-run evidence for `specs/re-plan.md` H1 and
H2. It is not an observation and does not qualify Tenet or the host.

Use a throwaway project with synthetic data and no credentials. Record:

1. date and operator;
2. VS Code, Copilot extension, Node.js, Git, macOS and model versions;
3. plugin source commit and bundle SHA-256;
4. the exact command or host action;
5. the exact visible result, including failures and approvals;
6. one status: `observed`, `not observed` (reason), or `documented only`; and
7. the product claim the result permits. Do not turn a deterministic test or
   documentation into host evidence.

## Prepare

1. Use the `tenet-spike` VS Code profile.
2. Run `npm run build` in this checkout and record the source commit and
   `plugin/kernel/tenet.mjs` SHA-256.
3. Point that profile at this checkout's `plugin/` directory.
4. Create a throwaway TypeScript/Vitest project outside this repository.
5. Put synthetic conflicts, instruction files and review changes in that
   throwaway project only.

## H1 - SP-08, SP-01 and SP-02

### SP-08: delegation and native tools

Record one result for each:

- A Reviewer starts in fresh context, receives only its declared tools and can
  read the kernel manifest.
- The reviewer can search inside the assigned workspace and reports its
  `usages`; record the visible dispatch metadata.
- Two read-only children run in parallel on the same revision.
- A blocked, failed, cancelled and dead child each returns a usable explicit
  state without granting more authority.
- Native `askQuestions` and `todos` behave as documented inside a child.
- Nested delegation by a child is denied by the host or visibly unavailable;
  if it is cooperative only, record that the product cannot enforce it.
- Dispatch, task creation, review, interruption, pause, resume, cancellation,
  and completion remain distinguishable through the host lifecycle events.
- A child can read an admitted manifest outside the workspace, or report that
  it cannot.
- Compare the observed tool list and context behavior with the Reviewer's
  declared restrictions. Do not infer enforcement from instructions alone.

### SP-01: install and invocation

Record:

- the complete plugin enable path and the actual skill file path visible before
  a skill loads;
- `/tenet help`, one task through `finish`, and cold-start behavior;
- a terminal command that remains active for 15 minutes and completes through
  the host without a test-runner timeout;
- one denied terminal execution: record the host explanation, whether the
  kernel stayed unrun, and whether any project file or `.tenet/` state changed;
- plugin enable, disable and uninstall, including whether the kernel still
  runs from a snapshot copy; and
- whether Node.js is found and executed without additional owner setup.

### SP-02: storage and loading

Record:

- whether the plugin, terminal and any available MCP tool can write the user
  directory, `${PLUGIN_DATA}` and the OS temp directory;
- which instruction file loads when both `AGENTS.md` and
  `.github/copilot-instructions.md` exist;
- whether `.tenet/` is excluded from host indexing or search, using one
  synthetic unique token outside normal source;
- the actual host tokenizer or estimator result on a bounded packet, compared
  with Tenet's estimate. Use the canonical 15% pass threshold; if the
  tokenizer is unavailable, record `not observed` rather than estimating it;
  and
- where skills, user settings and workspace state load and persist, whether
  they survive disable/restart/uninstall, and the exact persistent plugin data
  path. Delete only the throwaway project's synthetic state during cleanup.

## H2 - SP-12

There is no MCP prototype in this checkout. Record MCP as `not measured` and
keep the command-line front-end as the shipped front-end for target A.

Run three representative Standard tasks with five repetitions each through
the command-line front-end:

1. an existing TypeScript bug with a dirty unrelated file;
2. a small feature requiring one new acceptance example; and
3. a review followed by one selected fix.

For every repetition, record:

- native approval count, repeated approvals, and approval-mode visibility;
- whether routine and authority choices use native elicitation or chat;
- coordinator retyping of reviewer or analyst output;
- AI credits or usage if the host exposes them, otherwise `unknown`;
- legibility of the question, result and next action;
- heredoc/stdin and negative auto-approval matching behavior; and
- whether an ended turn changed Autopilot behavior.

Do not pool unlike tasks. Preserve all 15 raw counts and report per-task and
overall medians. A source pass, one favorable run or an undocumented host
setting is not a front-end qualification.

## Record

After execution, create separate dated audit notes:

- `docs/audits/YYYY-MM-DD/host-spikes-h1.md`
- `docs/audits/YYYY-MM-DD/host-spikes-h2.md`

Each note must include the tuple, preparation identity, raw steps, exact
failures, unknowns, permitted claims and follow-up work. Then update the
evidence ledger and `specs/re-plan.md`; do not change `not-qualified` to
`qualified` without a passing campaign manifest on one frozen tuple and
artifact.

## Target A dogfood

After H1 and H2, run one of Tenet's own small next changes through the
installed plugin on the owner Mac. Record the request, tuple, plugin snapshot
identity, kernel verdict, checks, reviewer result, interruption/recovery
outcome and any disagreement between the host UI and kernel records.
