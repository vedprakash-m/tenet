# Tenet technical specification: what agents are given

> Level L2 · Version 0.12 · Part of [tech-spec.md](../tech-spec.md) · Status: **draft, awaiting the Owner's approval** · Budget: 6,000 tokens · Added in L-0024 · Previous version: `archive/specs/tech-spec/agents.md@0.11.md`

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
- Has a `## Acceptance` section: an `Implements: {prefix}-12, {prefix}-14` line, then
  one line per item, `- [AB-1] what must hold`. Number items from 1 in each pull
  request. (A packet keeps this block in its `definition.md`.)
- Tags each test that shows an item: {tagging line for the detected runner}.
  A test that should keep proving a requirement also carries `[{prefix}-12]`.
- Never deletes, skips or weakens a test to make a check pass. If a test is wrong,
  explain why in the pull request.

Specifications:
- To change {L0–L2 documents}, edit the specification file in this pull request
  and say why. The edit is a proposal: the blessed text stays in force until its
  owner blesses the change. Never bless.
- A change to `tenet.yaml` (for example a new check) is also a proposal: make it
  in this pull request and say why; it counts once the Owner approves it.
- Never edit `{records}/blessed/`, blessing fields in front matter, `tenet.lock`
  or Tenet's workflows.

Working rules:
{working rules}

Stop and write your question in the pull request when a requirement conflicts
with the task, the same check fails three times, or passing would need a changed
test, acceptance item or specification.
<!-- tenet:end -->
```

**Working rules** (R-225). `{working rules}` is the text of `kit/practices/default.md`, unless `tenet.yaml` sets `agents.working_rules: off`, or a path to the project's own file (at most 400 tokens). The default:

```markdown
- State your assumptions. If the task can be read more than one way, say so and ask; don't choose silently.
- Make the smallest change that meets the acceptance items. No features, options or abstractions nobody asked for.
- Touch only what the task needs. Match the existing style. Don't tidy unrelated code; mention it instead.
- Remove only what your own change made unused.
- Before you start, say how each step will be checked; finish only when it is.
- Write plain words: say what you mean, without flourish.
```

These depend on the agent following them; the ones that can be checked are catalog ideas R-226 to R-230.

**Agent card shape** (tooling R-206), YAML front matter of `kit/agents/<name>.md`, with `kit/agents/drafter.md` as the reference:
- **Required:** `name`, `version`, `role`, `kind` (`creator` or `critic`), `purpose`, `inputs` `{spec_levels, sections, artifacts}`, `outputs` `{result_schema, writes}` (`writes` for creators only; a critic returns findings and writes no files).
- **Optional:** `tools[]`, `side_effects` `{filesystem, git, network}`, `paths` `{write, deny_read, deny_write}`, `acts_as`, `sponsor`, `stop_rules[]`, `eval_suite`.
- **Critics add:** `criteria`, `independence`, `finding_schema`, `abstain_when`.

## 2. Skills

Each skill is a `SKILL.md` in the open agent-skills format, under 2,000 tokens, with these steps.

**`tenet-draft-specs`** (onboarding):
1. Run `tenet onboard` and read `.tenet/onboard/assignment.json`.
2. Ask the Owner the interview questions for the project's kind (at most 10, grouped). Record the answers in `.tenet/onboard/interview.json`.
3. For each drafting unit in the assignment, in order:
   - read its slice of the inventory and its files
   - draft its sections into the output paths (onboarding §1); write nowhere else
   - cite every `observed` or `documented` statement (contracts §3)
   - mark never-dos `scope: global`
   - give prose sections `applies_to`
   - list disagreements as `CF-` items
   - write "undecided, needs the Owner" where nothing tells you
   - from existing instruction files (inventory kind `instructions`): turn project rules into requirements (`documented`, `scope: global`, citing the file) and working rules into a `Working rules` design section, without copying anything that is a secret or a personal detail
4. Run `tenet fix`, then `tenet check`, and fix every citation finding.
5. Self-check: list each statement its citation does not support, then correct it or mark it `inferred`. This is labelled a self-check; an independent review is a separate `spec-reviewer` assignment.
6. Commit the draft, run `tenet onboard --card` (which records `drafted_at_rev`), and open one pull request, "Set up Tenet", with the card as its description. Never bless and never resolve a conflict.

**`tenet-work-a-change`:**
1. Get context (step 1 of the block).
2. If the host can, open a draft pull request early; otherwise write the description at the end.
3. Write `## Acceptance`.
4. Write the code and the tagged tests.
5. Run the checks in `tenet.yaml` locally and `tenet check`.
6. Where the specification is wrong, edit it in the same pull request and say why (the block's "Specifications").
7. Follow the stop rules.

**`tenet-review-with-findings`:**
- Read the proof card first.
- Compare the touched requirements' blessed text with the change.
- Report each finding as `introduced`, `exposed`, `inherited` or `uncertain`, with a location or a reproduction (evidence.md §1, `review`).
- Never approve work you wrote.

## 3. Tagging tests

A tag is the item or requirement ID in brackets in the test's name. Where a name cannot hold brackets, use `tenet_` with underscores: `tenet_AB_1` means `AB-1`, and `tenet_R_12` means `R-12`. A JUnit `tenet.case` property also works.

| Runner | Example |
|---|---|
| vitest, jest, node:test, mocha | `it("[AB-1] retries once after a timeout", …)` |
| pytest | `def test_retries_once_tenet_AB_1():`, or `record_property("tenet.case", "AB-1")` in the test body |
| Go | `t.Run("[AB-1] retries once", …)` (reported as `TestRetry/[AB-1]_retries_once`) |
| JUnit 5 with Maven or Gradle | `@Test` then `void retriesOnce_tenet_AB_1()` |
| Rust | `#[test]` then `fn retries_once_tenet_AB_1()` |
| Anything else | `tenet_<ID with underscores>` in the name, or the `tenet.case` property |

An acceptance tag counts for a pull request only on lines that pull request adds (ALG-08). A requirement tag counts wherever it is.

## 4. Skills from 0.1.0

- **`write-a-definition`** (shaper):
  1. Get context for the paths the request names.
  2. Write `definition.md`: the intent in the requester's words; each acceptance item with its claim class, method, pass rule and test IDs.
  3. For each item, ask which blessed requirement it captures and what would make it true but wrong.
  4. Edit any specification the work changes, in the same branch, saying why.
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
| `limits` | `{rounds}` (default 5; `tenet.yaml` may lower it) and `{steps}`, a total cap (default 40). A loop ends at agreement (no blocking critic finding) or `limits.rounds` |
| `steps[]` | In order; each has an `id` and a `kind` |

| Step kind | Fields | Does |
|---|---|---|
| `agent` | `card`, `inputs`, `outputs`, `tools?` (`read-only` for critics), `lanes?` | Writes an assignment (`tenet assign`), runs the card through the host or engine, accepts its result (`tenet result`) |
| `script` | `run`: a `tenet` command, never free shell | For example `verify --run-checks` or `record --pin-tests` |
| `human_gate` | `decision`, `options`: an ordered list of `{option, goto}`, with `stop` first | Posts a decision request; resolves through `tenet decide` or a forge reply |
| `set` | `set`: counters (`rounds: +1`); `then` | Counters only rise |
| `route` | `on`: a target for each of the three outcomes `advance`, `refuse`, `human-gate`, each a target or `{if, goto, else}` on counters | Evaluates the gate (ALG-07) and moves on its **disposition**: a refusal that only advises counts as `advance`, so observing never sends work back |

A route maps `records` and `advises` to `advance`. For `blocks`, use the first enforcing match by ALG-07 row order, then claim ID order inside row 8. The overall verdict and display lead remain ALG-07 results. A request for a human decision maps to `human-gate`, another refusal to `refuse`. A required input or receipt that has not arrived leaves the step waiting without spending another attempt. An explicit human step still requires its own decision. A repeat after the round or step cap escalates without invoking a host.

**Inputs and outputs:**
- Inputs: `intake`, `context`, `definition`, `assignment`, `result`, `card`, `findings`, `tests`
- Outputs: `definition`, `tests`, `result`, `findings`

**Targets:** a step `id`, `fix:<step id>`, `done` (the station's exit claims are evaluated and the work moves) or `stop` (`tenet escalate` writes the report). `fix:<id>` adds one to `rounds`, reruns that creating agent step with the findings (and, from a human gate, the person's comment), and continues from the step after it.

**Assignment:** `{work, station, step, attempt, card, inputs: [{name, source, trust, hash}], allowed_paths, budget_tokens, deadline}`. **Result:** `{work, step, attempt, assignment_digest, outputs, evidence?, proposed_events}`. Tenet appends events only after the gate accepts them (R-018).

**Pinned tests.** `record --pin-tests` consumes the accepted test-writer assignment and approved definition. The record names work, assignment and attempt, writer actor and card digest, definition digest, baseline subject, mapped cases, baseline failure ID and sorted test paths with content digests. A harness failure is inconclusive. A changed approved definition or test content invalidates its pin. Refresh only through the independent test-writer path before the builder begins. Pin provenance and CI evidence remain separate.

**Static checks** (`tenet check --pack`): every creating step is followed by an inspection; counters only rise within `limits`; every route covers all three outcomes and every target exists; every `fix:<id>` names an earlier creating agent step; human gates list `stop` first; `read-only` cards hold no write tools; critics inspecting implementation or test results run after the corresponding scripts. Definition review precedes test creation.

**Worked loops** (the `minimal` pack, careful lane):

```yaml
loop: define                      # kit/loops/define.yaml
kind: station
applies: {station: define, lanes: [careful, deep]}
limits: {rounds: 5}
steps:
  - {id: shape, kind: agent, card: shaper, inputs: [intake, context], outputs: [definition]}
  - {id: review, kind: agent, card: spec-reviewer, inputs: [definition, context], outputs: [findings], tools: read-only}
  - {id: next, kind: route, on: {refuse: {if: "rounds < limits.rounds", goto: "fix:shape", else: approve}, advance: approve, human-gate: approve}}
  - {id: approve, kind: human_gate, decision: approve-definition, options: [{option: stop, goto: stop}, {option: revise, goto: "fix:shape"}, {option: approve, goto: tests}]}
  - {id: tests, kind: agent, card: test-writer, inputs: [definition], outputs: [tests]}
  - {id: pin, kind: script, run: record --pin-tests}
  - {id: exit, kind: route, on: {advance: done, refuse: stop, human-gate: approve}}
```

```yaml
loop: build                       # kit/loops/build.yaml
kind: station
applies: {station: build, lanes: [quick, careful, deep]}
limits: {rounds: 5}
steps:
  - {id: work, kind: agent, card: builder, inputs: [assignment, context, tests], outputs: [result]}
  - {id: checks, kind: script, run: verify --run-checks --local}   # writes a local advisory card for the judge
  - {id: inspect, kind: agent, card: judge, inputs: [result, card], outputs: [findings], tools: read-only, lanes: [careful, deep]}
  - {id: next, kind: route, on: {advance: done, human-gate: decide, refuse: {if: "rounds < limits.rounds", goto: "fix:work", else: decide}}}
  - {id: decide, kind: human_gate, decision: accept-findings, options: [{option: stop, goto: stop}, {option: revise, goto: "fix:work"}, {option: accept-with-findings, goto: done}]}
```

`verify --run-checks --local` runs the checks in the worktree and writes `.tenet/runs/<work>/card.json` (provenance `local`, badge advisory) for the judge; the station's exit uses the CI card. The executor publishes the accepted candidate before waiting for that card. The Verify loop matches the work, tested revision and evaluation before requesting its exit. A missing result waits and a failed result follows its applicable blocking action. In host-driven mode the card's skill reads its step from the assignment, and the person or the engine starts the next agent from `tenet_next`. Engines compile the same file (M3).

## 6. Adapters and the reference runner (0.1.0)

**Adapter contract** (the 0.1.0 slice of R-041). An adapter is a module of the runner package exporting:

| Function | Returns |
|---|---|
| `capabilities()` | `{headless, structured_output, usage, cost, path_restriction, network_restriction, cancel}`, each `enforced`, `declared` or `none` |
| `start({attempt, workdir, card, skill, assignment_path, budget_tokens, timeout_minutes})` | `{run_id, process_identity}`; launches the host non-interactively with the card's instructions and skill, pointed at the assignment |
| `status(run_id)` | `{state: running \| done \| failed \| cancelled, exit_code?, usage?: {input_tokens, output_tokens, cost: {amount, unit, status}}}` |
| `cancel(run_id)` | requests cancellation of the recorded process tree and returns whether termination was confirmed |
| `result(run_id)` | `{outputs, summary}`: summaries and hashes, never transcripts unless opted in (R-107) |

**Adapters in 0.1.0:**
- `command`: runs a configured executable and argument list with `{card}`, `{skill}` and `{assignment}` placeholders, using literal substitution without shell parsing
- `claude-code` and `copilot-cli`, the two Spike D qualified (L-0030):
  - Claude Code runs `claude -p … --output-format json --permission-mode acceptEdits --allowedTools …` with `--max-budget-usd` when an explicit USD budget is available; its result reports `total_cost_usd` (cost `known`, unit USD).
  - Copilot CLI runs `copilot -p … --allow-tool … --output-format json -s`; its JSON lines end in a `result` event with `exitCode`, files changed and `premiumRequests` (cost `known`, unit `premium-request`). It loads the user's own MCP servers unless told not to, so the adapter turns them off or reports isolation `none`.
  - Neither confines writes to `allowed_paths`, so `path_restriction` is `declared`.
  - Codex and Gemini command-line tools were not installed and remain untested.

External engines implement the same contract.

**Runner** (`tenet-runner start <work> [--adapter <name>] [--until approval|pull-request|done] [--parallel <n>]`):
1. On `start` for a new item, establish its **draft pull request** before the definition approval (`gh pr create --draft`). If the forge requires an ahead commit, first publish the accepted initial work or shaper definition. Publish the accepted definition revision before asking for approval, and bind the approval to the definition digest. Then read the next action (`tenet_next`). If a person acts next, print the decision request and poll every 30 s, or exit under `--until`.
2. **Agent step:**
   - take a lease on the work item (30 minutes, renewed on every poll), with the attempt ID and process ID in `.tenet/runs/<work>/runner.json`
   - create or reuse the worktree `.tenet/runs/<work>/worktree/` on its branch
   - `tenet assign` writes the assignment
   - adapter `start` runs the step's card and skill
   - poll `status` every 10 s until the run ends or its timeout or budget is reached
   - submit the outputs through `tenet result` for validation. Publish only accepted output. Commit accepted outputs with the trailer `Tenet-Agent: <card>`
3. **Script step:** run the named `tenet` command in the worktree.
4. **After producing the accepted candidate:** push the branch before the CI wait. Mark the pull request ready when the loop requests it with the forge's own command-line tool (`gh`). The runner never reads or stores credentials.
5. Wait for the card, then return to step 1.
6. A stop threshold or `limits.steps` stops the run and calls `tenet escalate`.

Every step records `run.started` and `run.ended` with the actor chain (runner → adapter → card), usage and cost status. **Limits:** one repository; no scheduler or daemon (it runs while the command runs, locally or in a CI job); at most `--parallel` items (default 1), each in its own worktree, one active attempt per work item within the same local repository when its atomic reservation is available. Cross-clone ownership is advisory under R-037. **Trust:** the runner is an executor only. Evidence comes from CI, and the card treats the runner like any host. `tenet-runner doctor` prints each adapter's capability table and recommends running agents under a `bots[]` identity (trust assumption 4).

**Spawning:** adapters start hosts with an argument array, never through a shell, and set `MSYS_NO_PATHCONV=1` on Windows. In Spike A, Git Bash turned `/tenet approve` into a file path before it was posted.

### Durable attempts and recovery

Persist a work, station, step and attempt key in the runner journal along with the assignment digest, lease generation, process identity, expected revision and external receipts. Keep the journal outside the worktree so it survives replacement. Reserve the item locally before dispatch. Renew the recorded lease as described above. Recheck authority and the lease generation before accepting a result, pushing or changing a PR. A replaced attempt cannot submit a result.

| Point | Recovery |
|---|---|
| Assignment | Reuse the exact stored assignment for the attempt. Reassess when its inputs change. |
| Process start | Record launch intent first. Require the persisted run ID to resolve through the adapter after a runner restart. If the launch acknowledgement was lost, reconcile by attempt key against a durable process or result receipt. Ambiguous launch waits for reconciliation without dispatching another attempt. |
| Result or commit | Verify output hashes and lease. Reuse the accepted receipt and commit for that attempt. Preserve a dirty or ambiguous worktree. |
| Push | Persist intended revision before pushing. Read back remote state after an interruption. Reconcile an unexpected revision before continuing. |
| Draft or ready PR | Match repository, head and target or use the recorded PR ID. Reuse a unique matching result. Wait if the association is ambiguous. |
| Human approval | Poll the exact request. Persist its receipt before continuing. An expired or changed request remains pending. |

`status <work>` reports phase, attempt and recovery action. `stop <work>` cancels the recorded process tree after validating process identity. Use a process group on POSIX and the recorded tree on Windows. Confirm termination before starting a replacement. Preserve uncommitted work. An uncertain stop stays visible. Host logs remain local and are omitted from run records. `doctor` reports the installed adapter version and measured capabilities.

If only one named adapter qualifies, that adapter plus the command adapter can satisfy plan §1. If no named adapter qualifies, the command adapter remains available for development and the release gate stays open for the Owner. Report inaccessible cost or containment explicitly instead of inferring it.

**Package:** `runner/` in this repository, published as `@vedprakash-m/tenet-runner` at the same version as `@vedprakash-m/tenet`, depending only on it and Node built-ins.
