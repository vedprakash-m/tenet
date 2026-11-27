---
tenet: {spec: 1, doc: tech-spec, level: L2, version: "0.12", owner: ved}
sections:
  _preamble: {state: draft, digest: sha256:7d113e5be50da0b40316e223c71c43028b900679757986ea154af7af1e35241c, flags: []}
  1-the-agentsmd-block: {state: draft, digest: sha256:ddf223ae8f399877797fea51ab0dd55fa336ee16806f72e5e14295d38a04bdfc, flags: []}
  2-skills: {state: draft, digest: sha256:20287d61c9dbc4b4b96ba823ae54e498fa4c7377faf55b97b09cb143fbc2b9bf, flags: []}
  3-tagging-tests: {state: draft, digest: sha256:26cd385062914ff516f332c6758619e54cddbf01f33a3cf6f58a78d7c7c26c78, flags: []}
  4-skills-from-010: {state: draft, digest: sha256:64b3a968b15cc773e8a9988f4f3b698c8ec522cb95ac359531db5fdc0030da23, flags: []}
  5-loops: {state: draft, digest: sha256:af93e70a7f84b73dde49366e20eeacaf671f0f54f943c240684af6cf85a868e2, flags: []}
  6-adapters-and-the-reference-runner-010: {state: draft, digest: sha256:30fa2dc1a36f383e6250128c882bdc5e57ff5ade77d5cf6d3747ba3ff2f99c90, flags: []}
---
# Tenet technical specification: what agents are given
> L2 · Version 0.12 · Draft · [Tech spec](../tech-spec.md) · Budget: 6,000 tokens · L-0024 · Previous: `archive/specs/tech-spec/agents.md@0.11.md`

**Context card.** This contract covers the `AGENTS.md` block, three alpha.0 skills, and runner test tags. CP-0012 ships them, CP-0010 installs them, and CP-0052 tests a fresh session. See Contracts §10 for hosts, ALG-10 for context, §5 for 0.1.0 loops, and §6 for adapters and the reference runner (R-224).
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
**Required:** `name`, `version`, `role`, `kind` (`creator` or `critic`), `purpose`, `inputs` `{spec_levels, sections, artifacts}`, `outputs` `{result_schema, writes}` (`writes` for creators only; a critic returns findings and writes no files).
**Optional:** `tools[]`, `side_effects` `{filesystem, git, network}`, `paths` `{write, deny_read, deny_write}`, `acts_as`, `sponsor`, `stop_rules[]`, `eval_suite`.
- **Critics add:** `criteria`, `independence`, `finding_schema`, `abstain_when`.
## 2. Skills
Each skill is a `SKILL.md` in the open agent-skills format, under 2,000 tokens, with these steps.

**`tenet-draft-specs`** (onboarding):
1. Run `tenet onboard` and read `.tenet/onboard/assignment.json`.
2. Read the project-kind and generic interview questions from `assignment.questions` (at most 10 in each set, grouped without repetition, and no more than `question_limit` asked). Record the answers in `.tenet/onboard/interview.json`.
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
Tag the test name with the item or requirement ID in brackets. Where brackets are unavailable, use `tenet_AB_1` for `AB-1` or `tenet_R_12` for `R-12`. JUnit also accepts `tenet.case`.

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

A loop is data in `kit/loops/<name>.yaml` (`kit/schemas/loop.json` validates structure and `route.on` keys; graph checks stay in `check --pack`, CP-0049). The pack names one **station loop** per station and lane (`define`, `build`, `verify`); they share the **fix loop**. Projects may only narrow a loop: fewer rounds, more checks, stricter cards.

| Field | Meaning |
|---|---|
| `loop`, `kind` | Name; `station` or `fix` |
| `applies` | `{station, lanes}` |
| `limits` | `{rounds}` (default 5; `tenet.yaml` may lower it) and `{steps}`, a total cap (default 20, [L-0043](../../ledger/L-0043-owner-decisions-0.2.0.md) OD-2; a pack may set a higher cap). A loop ends at agreement (no blocking critic finding) or `limits.rounds` |
| `steps[]` | In order; each has an `id` and a `kind` |

| Step kind | Fields | Does |
|---|---|---|
| `agent` | `card`, `inputs`, `outputs`, `tools?` (`read-only` for critics), `lanes?` | Writes an assignment (`tenet assign`), runs the card through the host or engine, accepts its result (`tenet result`) |
| `script` | `run`: a `tenet` command, never free shell | For example `verify --run-checks` or `record --pin-tests` |
| `human_gate` | `decision`, `options`: an ordered list of `{option, goto}`, with `stop` first | Posts a decision request; resolves through `tenet decide` or a forge reply |
| `set` | `set`: counters (`rounds: +1`); `then` | Counters only rise |
| `route` | `on`: a target for each of the three outcomes `advance`, `refuse`, `human-gate`, each a target or `{if, goto, else}` on counters | Evaluates the gate (ALG-07) and moves on its **disposition**: a refusal that only advises counts as `advance`, so observing never sends work back |

Routes map `records` and `advises` to `advance`. For `blocks`, take the first enforcing ALG-07 row, then claim ID order in row 8. ALG-07 still sets the overall verdict and display lead. Decisions map to `human-gate`; other refusals to `refuse`. Missing inputs or receipts wait without another attempt. Explicit human steps need their own decision. Repeating beyond the round or step cap escalates before host invocation.

**Inputs and outputs:**
- Inputs: `intake`, `context`, `definition`, `assignment`, `result`, `card`, `findings`, `tests`
- Outputs: `definition`, `tests`, `result`, `findings`

**Targets:** a step `id`, `fix:<step id>`, `done` (the station's exit claims are evaluated and the work moves) or `stop` (`tenet escalate` writes the report). `fix:<id>` adds one to `rounds`, reruns that creating agent step with the findings (and, from a human gate, the person's comment), and continues from the step after it.

**Assignment:** `{work, station, step, attempt, card, inputs: [{name, source, trust, hash}], allowed_paths, budget_tokens, deadline}`. **Result:** `{work, step, attempt, assignment_digest, outputs, evidence?, proposed_events}`. Tenet appends events only after the gate accepts them (R-018).

**Pinned tests.** `record --pin-tests` takes the accepted test-writer assignment and approved definition. It records work, assignment, attempt, writer actor and card digest, definition digest, baseline subject, mapped cases, baseline failure ID and sorted test paths with content digests. Harness failure is inconclusive. Changed approved definition or test content invalidates the pin. Refresh only via the independent writer before build. Pin provenance and CI evidence stay separate.

**Static checks** (`tenet check --pack`): inspect after creation; counters only rise within limits. Routes cover all three outcomes and all targets exist. Each `fix:<id>` names an earlier creating step. Human gates list `stop` first; read-only cards have no write tools. Implementation or test critics run after the relevant scripts. Review definitions before creating tests.

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
The `command` adapter runs a configured executable and arguments, substituting `{card}`, `{skill}` and `{assignment}` literally without shell parsing.
- `claude-code` and `copilot-cli`, the two Spike D qualified (L-0030):
  - Claude Code runs `claude -p … --output-format json --permission-mode acceptEdits --allowedTools …` with `--max-budget-usd` when an explicit USD budget is available; its result reports `total_cost_usd` (cost `known`, unit USD).
  - Copilot CLI runs `copilot -p … --allow-tool … --output-format json -s`; its JSON lines end in a `result` event with `exitCode`, files changed and `premiumRequests` (cost `known`, unit `premium-request`). It loads the user's own MCP servers unless told not to, so the adapter turns them off or reports isolation `none`.
  - Neither confines writes to `allowed_paths`, so `path_restriction` is `declared`.
  - Codex and Gemini command-line tools were not installed and remain untested.

External engines implement the same contract.

**Runner** (`tenet-runner start <work> [--adapter <name>] [--until approval|pull-request|done] [--parallel <n>]`):
1. On `start` for new work, create a **draft PR** before definition approval (`gh pr create --draft`). If the forge needs an ahead commit, push the initial shaper work first. Push accepted definition edits before requesting approval (bound to definition digest), then read `tenet_next`. If a person acts next, print the request and poll every 30 s, or exit under `--until`.
2. **Agent step:**
   - lease the work item (30 min, renewed each poll) with attempt/PID in `.tenet/runs/<work>/runner.json`
   - create or reuse worktree `.tenet/runs/<work>/worktree/` on its branch
   - write assignment (`tenet assign`), start adapter, poll `status` every 10 s until done, timeout, or budget limit
   - submit outputs via `tenet result`, publish accepted output only, commit with `Tenet-Agent: <card>`
3. **Script step:** run the named `tenet` command in the worktree.
4. **After an accepted candidate:** push before waiting for CI; mark PR ready via `gh` when requested. Never read or store credentials.
5. Wait for the card, then return to step 1.
6. Stop thresholds or `limits.steps` halt execution and call `tenet escalate`.

Each step records `run.started`/`run.ended` with actor chain (runner → adapter → card), usage, and cost status. **Limits:** single repo, no daemon, up to `--parallel` items (default 1) in isolated worktrees, one active attempt per item (cross-clone ownership advisory, R-037). **Trust:** runner executes, CI supplies evidence, cards treat runner as a host; `tenet-runner doctor` prints adapter capabilities and recommends `bots[]` (T4).

**Spawning.** Adapters use argument arrays without a shell (`MSYS_NO_PATHCONV=1` on Windows so Git Bash passes `/tenet approve` literally).

### Durable attempts and recovery

Persist work, station, step, attempt key, assignment digest, lease generation, process ID, expected revision, and receipts outside the worktree so they survive replacement. Reserve locally and renew leases; recheck authority and lease generation before accepting results, pushing, or updating a PR (replaced attempts cannot submit).

| Point | Recovery |
|---|---|
| Assignment | Reuse the attempt's stored assignment; reassess when inputs change. |
| Process start | Persist launch intent first; resolve stored `run_id` via adapter after restart or reconcile via attempt key against durable process/result receipts. Ambiguous launch waits; never double-dispatch. |
| Result or commit | Verify output hashes and lease; reuse accepted receipt and commit. Keep dirty/ambiguous worktrees. |
| Push | Persist intended revision before push; read back remote state after interruption and reconcile before continuing. |
| Draft or ready PR | Match repo, head and target or recorded PR ID; reuse unique match; wait if ambiguous. |
| Human approval | Poll the exact request and persist its receipt; expired or changed requests remain pending. |

`status <work>` reports phase, attempt and recovery action. `stop <work>` cancels the recorded process tree after validating PID (process group on POSIX, tree on Windows), confirms exit before replacement, preserves uncommitted files, and keeps uncertain stops visible. Host logs stay local and never enter run records. `doctor` prints adapter version and measured capabilities.

One named qualifying adapter plus `command` satisfies plan §1 (if none qualifies, `command` supports development while the release gate stays open for the Owner). Report unavailable cost or containment.

**Package.** Publish `runner/` as `@vedprakash-m/tenet-runner` at the Tenet version, with only Tenet and Node built-ins as dependencies.
