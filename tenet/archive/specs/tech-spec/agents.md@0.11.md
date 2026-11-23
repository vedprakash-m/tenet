# Tenet technical specification: what agents are given

> Level L2 · Version 0.11 · Part of [tech-spec.md](../tech-spec.md) · Status: **draft, awaiting the Owner's approval** · Budget: 6,000 tokens · Added in L-0024

**Context card.** The instructions that make agents use Tenet are part of the contract, because the product depends on them: the `AGENTS.md` block, the three alpha.0 skills, and how to tag tests in each runner. CP-0012 ships these texts, CP-0010 installs them, and CP-0052's fresh-session check tests them. Hosts are described in [contracts §10](contracts.md#10-install-manifest-and-hosts); context selection is ALG-10. §5 is the loop contract that drives agents from 0.1.0, and §6 the adapters and the reference runner that execute it (R-224).

## 1. The `AGENTS.md` block

At most 1,500 tokens. `init` and `upgrade` fill the braces from policy and the detected runner.

```markdown
<!-- tenet:begin v{version} -->
## Working with Tenet

This repository's intent lives in specifications: {documents with their levels}.
Blessed text is the source of truth. Drafts are hints only.

Before you change code:
1. Get context for the paths you will touch: the MCP tool `tenet_context`, or
   `tenet context --paths <paths>`. Read every blessed requirement it returns,
   including the global rules. If it lists omitted IDs, ask for them by ID.
2. A requirement flagged `edited` or `sources-changed` still applies as blessed.
   Say so in your pull request if your change depends on it.

Every pull request:
- Has a `## Acceptance` section: an `Implements: R-12, R-14` line, then one line
  per item, `- [AB-1] what must hold`. Number items from 1 in each pull request.
- Tags each test that shows an item: {tagging line for the detected runner}.
  A test that should keep proving a requirement also carries `[R-12]`.
- Never deletes, skips or weakens a test to make a check pass. If a test is wrong,
  explain why in the pull request.

Specifications:
- Do not change {L0–L2 documents} except by proposing the change in this pull
  request under `## Spec change`, naming the IDs. Never bless.
- Never edit `{records}/blessed/`, blessing fields in front matter, `tenet.yaml`,
  `tenet.lock` or Tenet's workflows.

Stop and write your question in the pull request when a requirement conflicts
with the task, the same check fails three times, or passing would need a changed
test, acceptance item or specification.
<!-- tenet:end -->
```

## 2. Skills

Each skill is a `SKILL.md` in the open agent-skills format, under 2,000 tokens, with these steps.

**`draft-specs`** (onboarding):
1. Run `tenet onboard` and read `.tenet/onboard/assignment.json`.
2. Ask the Owner the interview questions for the project's kind (at most 10, grouped). Record the answers in `.tenet/onboard/interview.json`.
3. For each drafting unit in the assignment, in order:
   - read its slice of the inventory and its files
   - draft its sections into the output paths (onboarding §1)
   - cite every `observed` or `documented` statement (contracts §3)
   - mark never-dos `scope: global`
   - give prose sections `applies_to`
   - list disagreements as `CF-` items
   - write "undecided, needs the Owner" where nothing tells you
4. Run `tenet fix`, then `tenet check`, and fix every citation finding.
5. Review pass as the spec reviewer: list each statement its citation does not support, then correct it or mark it `inferred`.
6. Run `tenet onboard --card` and open one pull request, "Set up Tenet", with the card as its description. Never bless and never resolve a conflict.

**`work-a-change`:**
1. Get context (step 1 of the block).
2. If the host can, open a draft pull request early; otherwise write the description at the end.
3. Write `## Acceptance`.
4. Write the code and the tagged tests.
5. Run the checks in `tenet.yaml` locally and `tenet check`.
6. Propose spec deltas where the specification is wrong.
7. Follow the stop rules.

**`review-with-findings`:**
- Read the proof card first.
- Compare the touched requirements' blessed text with the change.
- Report each finding as `introduced`, `exposed`, `inherited` or `uncertain`, with a location or a reproduction (contracts §12, `review`).
- Never approve work you wrote.

## 3. Tagging tests

A tag is the item or requirement ID in brackets in the test's name. Where a name cannot hold brackets, use `tenet_` with underscores: `tenet_AB_1` means `AB-1`, and `tenet_R_12` means `R-12`. A JUnit `tenet.case` property also works.

| Runner | Example |
|---|---|
| vitest, jest, node:test, mocha | `it("[AB-1] retries once after a timeout", …)` |
| pytest | `def test_retries_once_tenet_AB_1():`, or `record_property("tenet.case", "AB-1")` |
| Go | `t.Run("[AB-1] retries once", …)` (reported as `TestRetry/[AB-1]_retries_once`) |
| JUnit 5 with Maven or Gradle | `void retriesOnce_tenet_AB_1()` |
| Anything else | `tenet_<ID with underscores>` in the name, or the `tenet.case` property |

An acceptance tag counts for a pull request only on lines that pull request adds (ALG-08). A requirement tag counts wherever it is.

## 4. Skills from 0.1.0

- **`write-a-definition`** (shaper):
  1. Get context for the paths the request names.
  2. Write `definition.md`: the intent in the requester's words; each acceptance item with its claim class, method, pass rule and test IDs.
  3. For each item, ask which blessed requirement it captures and what would make it true but wrong.
  4. Put spec deltas under `## Spec change`.
  5. Run `tenet check`.
- **`write-independent-tests`** (test writer):
  1. Read only the approved definition and the public interfaces it names, never the builder's work.
  2. Write a failing test per item, tagged with its ID.
  3. Run them to confirm they fail on the current code, or fail because the tested symbol is missing.
  4. Hand them to `record --pin-tests`.

## 5. Loops

A loop is data in `kit/loops/<name>.yaml` (schema `kit/schemas/loop.json`, CP-0049). The pack names one **station loop** per station and lane (`define`, `build`, `verify`); they share the **fix loop**. Projects may only narrow a loop: fewer rounds, more checks, stricter cards.

| Field | Meaning |
|---|---|
| `loop`, `kind` | Name; `station` or `fix` |
| `applies` | `{station, lanes}` |
| `limits` | `{rounds}` (default 2; `tenet.yaml` may lower it) and `{steps}`, a total cap (default 20) |
| `steps[]` | In order; each has an `id` and a `kind` |

| Step kind | Fields | Does |
|---|---|---|
| `agent` | `card`, `inputs`, `outputs`, `tools?` (`read-only` for critics), `lanes?` | Writes an assignment (`tenet assign`), runs the card through the host or engine, accepts its result (`tenet result`) |
| `script` | `run`: a `tenet` command, never free shell | For example `verify --run-checks` or `record --pin-tests` |
| `human_gate` | `decision`, `options`: a map from option to target, with `stop` first | Posts a decision request; resolves through `tenet decide` or a forge reply |
| `set` | `set`: counters (`rounds: +1`); `then` | Counters only rise |
| `route` | `on`: a map from the gate's verdict (`advance`, `refuse`, `human-gate`) to a target, or `{if, goto, else}` on counters | Evaluates the gate (ALG-07) and moves |

**Inputs and outputs:**
- Inputs: `intake`, `context`, `definition`, `assignment`, `result`, `card`, `findings`, `tests`
- Outputs: `definition`, `tests`, `result`, `findings`

**Targets:** a step `id`, `fix`, `done` (the station's exit claims are evaluated and the work moves) or `stop` (`tenet escalate` writes the report). The fix loop adds one to `rounds`, reruns the calling agent step with the findings, and returns to the step after it.

**Assignment:** `{work, station, step, card, inputs: [{name, source, trust, hash}], allowed_paths, budget_tokens, deadline}`. **Result:** `{work, step, outputs, evidence?, proposed_events}`. Tenet appends events only after the gate accepts them (R-018).

**Static checks** (`tenet check --pack`): every creating step is followed by an inspection; counters only rise within `limits`; every route target exists; human gates list `stop` first; `read-only` cards hold no write tools; critics run after scripts.

**Worked loops** (the `minimal` pack, careful lane):

```yaml
loop: define                      # kit/loops/define.yaml
kind: station
applies: {station: define, lanes: [careful, deep]}
limits: {rounds: 2}
steps:
  - {id: shape, kind: agent, card: shaper, inputs: [intake, context], outputs: [definition]}
  - {id: review, kind: agent, card: spec-reviewer, inputs: [definition, context], outputs: [findings], tools: read-only}
  - {id: next, kind: route, on: {refuse: {if: "rounds < limits.rounds", goto: fix, else: approve}, advance: approve}}
  - {id: approve, kind: human_gate, decision: approve-definition, options: {stop: stop, revise: fix, approve: tests}}
  - {id: tests, kind: agent, card: test-writer, inputs: [definition], outputs: [tests]}
  - {id: pin, kind: script, run: record --pin-tests}
  - {id: exit, kind: route, on: {advance: done, refuse: stop, human-gate: approve}}
```

```yaml
loop: build                       # kit/loops/build.yaml
kind: station
applies: {station: build, lanes: [quick, careful, deep]}
limits: {rounds: 2}
steps:
  - {id: work, kind: agent, card: builder, inputs: [assignment, context, tests], outputs: [result]}
  - {id: checks, kind: script, run: verify --run-checks}
  - {id: inspect, kind: agent, card: judge, inputs: [result, card], outputs: [findings], tools: read-only, lanes: [careful, deep]}
  - {id: next, kind: route, on: {advance: done, human-gate: decide, refuse: {if: "rounds < limits.rounds", goto: fix, else: decide}}}
  - {id: decide, kind: human_gate, decision: accept-findings, options: {stop: stop, revise: fix, accept-with-findings: done}}
```

In host-driven mode the card's skill reads its step from the assignment, and the person or the engine starts the next agent from `tenet_next`. Engines compile the same file (M3).

## 6. Adapters and the reference runner (0.1.0)

**Adapter contract** (the 0.1.0 slice of R-041). An adapter is a module of the runner package exporting:

| Function | Returns |
|---|---|
| `capabilities()` | `{headless, structured_output, usage, cost, path_restriction, network_restriction, cancel}`, each `enforced`, `declared` or `none` |
| `start({workdir, card, skill, assignment_path, budget_tokens, timeout_minutes})` | `{run_id}`; launches the host non-interactively with the card's instructions and skill, pointed at the assignment |
| `status(run_id)` | `{state: running \| done \| failed \| cancelled, exit_code?, usage?: {input_tokens, output_tokens, cost: {amount, unit, status}}}` |
| `cancel(run_id)` | stops the run and its child processes |
| `result(run_id)` | `{outputs, summary}`: summaries and hashes, never transcripts unless opted in (R-107) |

**Adapters in 0.1.0:**
- `command`: runs a configured command line with `{card}`, `{skill}` and `{assignment}` placeholders, so any host with a headless mode works
- the two host adapters spike CP-0056 selects from Claude Code, Codex, Copilot and Gemini command-line tools

External engines implement the same contract.

**Runner** (`tenet-runner start <work> [--adapter <name>] [--until approval|pull-request|done] [--parallel <n>]`):
1. Read the work item's next action (`tenet_next`). If a person acts next, print the decision request and wait, or exit under `--until`.
2. **Agent step:**
   - take a lease on the work item
   - create or reuse the worktree `.tenet/runs/<work>/` on its branch
   - `tenet assign` writes the assignment
   - adapter `start` runs the step's card and skill
   - poll `status` every 10 s until the run ends or its timeout or budget is reached
   - `tenet result` returns the outputs; Tenet accepts or refuses them
3. **Script step:** run the named `tenet` command in the worktree.
4. **After build:** push the branch and open or update the pull request with the forge's own command-line tool (`gh`). The runner never reads or stores credentials.
5. Wait for the card, then return to step 1.
6. A stop threshold or `limits.steps` stops the run and calls `tenet escalate`.

Every step records `run.started` and `run.ended` with the actor chain (runner → adapter → card), usage and cost status. **Limits:** one repository; no scheduler or daemon (it runs while the command runs, locally or in a CI job); at most `--parallel` items (default 1), each in its own worktree, never two runs on one item. **Trust:** the runner is an executor only. Evidence comes from CI, and the card treats the runner like any host. `tenet-runner doctor` prints each adapter's capability table and recommends running agents under a `bots[]` identity (trust assumption 4).

**Package:** `runner/` in this repository, published as `@vedprakash-m/tenet-runner` at the same version as `@vedprakash-m/tenet`, depending only on it and Node built-ins.
