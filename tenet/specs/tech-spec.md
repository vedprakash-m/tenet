# Tenet technical specification

> Level L2 · Version 0.6 · Status: **draft, awaiting the Owner's approval** · Implements [prd.md](prd.md) and its [catalog](prd/catalog.md) · Rules: [kit/TENET.md](../../kit/TENET.md) · Sections marked `<!-- invariant -->` need the Owner to change · Budget: 12,000 tokens · Previous version: `archive/specs/tech-spec.md@0.5.md`

**Context card.** Tenet is seven record types (§3) and one gate rule (§4). Every feature in the catalog is a standard type of one of them, declared by a pack (§6). The CLI and SDK append events, the CI verifier produces evidence (§7), and every view is a reduction over events (§8). Policy always comes from the target line and is judged against the snapshot recorded at decision time. Every rule states its guarantee and the trust assumptions behind it.

## 1. Architecture

The tooling reads and writes files and git: no server, no database, no model client. Record paths are relative to the records folder (`paths.records`, default `tenet/`).

| Module | Responsibility |
|---|---|
| `core/fs`, `core/yaml`, `core/schema`, `core/git`, `core/sign` | Atomic writes and path refusal; parsing; schema validation; batched git object reads; canonical JSON (RFC 8785) and `ssh-keygen -Y` signatures |
| `kernel/*` | The seven primitives, reduction, replay, conflicts and the gate rule |
| `packs` | Loading packs and their standard claims, work types, methods and stations |
| `verify` | The two CI jobs |
| `views` | Board, metrics, readiness |
| `compile`, `install`, `sdk`, `cli` | Bindings; init and lock; public API; commands |

**Runtime.** <!-- invariant --> TypeScript compiled to ESM, Node 22 LTS or later, no native modules; runtime dependencies limited to `yaml`, `ajv`, `ajv-formats`, `commander`, `picomatch` (adding one needs a spec packet); `git` 2.40+ and OpenSSH 8.9+.

**Scale tiers** (catalog R-167): tier 1 event files in git (about 50 changes a week); tier 2 git with closed packets compacted into one `events.jsonl` each and evidence on the evidence store (about 1,000 a week); tier 3 an external append-only store under the same schemas and replay rules (M3–M4). Revisions are content-addressed IDs, so a non-git history can supply equivalent evidence.

## 2. Repository and package

<!-- invariant --> **The folder that ships is the folder that is vendored.** `kit/` becomes `kit/` in the package and `.tenet/kit/` in a project, file for file.

```text
tenet/  README.md LICENSE CONTRIBUTING.md AGENTS.md CLAUDE.md package.json tsconfig.json tenet.yaml
  kit/   SHIPPED AND VENDORED: TENET.md, CHANGELOG.md, schemas/, defaults/, templates/, packs/,
         agents/, criteria/, skills/, loops/; kit.json generated at release
  pkg/   SHIPPED, NOT VENDORED: migrations/, conformance/ (red-team, reference cases), evals/, hosts/
  src/ test/ docs/ examples/minimal/
  tenet/ this repository's records (self-hosting: kit_path: kit, no lock)
```

Package: `"bin": {"tenet": "dist/cli.js"}`, `"exports": {".": "dist/sdk.js"}`, `"files": ["dist","kit","pkg"]`; published to npm with provenance, plus a kit archive with `SHA256SUMS`.

## 3. The seven primitives

<!-- invariant --> These are the only normative record types. All are YAML or JSON validated by `kit/schemas/`; timestamps are UTC RFC 3339 with seconds; hashes are full and algorithm-tagged.

| Primitive | Shape | Notes |
|---|---|---|
| **Subject** | `{kind, digest, base?}` | `git-tree`: tree SHA of code paths (everything tracked except the records folder, `.tenet/build/` and generated views) plus each check's declared inputs, computed with a temporary index. `file-set`: SHA-256 over sorted `path\0blob-sha`. Further kinds are pack data (artifact, deployment, config, data, flag, platform object, multi-repo). Bookkeeping never changes a `git-tree` subject |
| **Actor** | `{id, kind: person \| agent \| service, roles, keys, chain?}` | People and keys are listed in the policy; runs record the chain initiator → agent → subagent → tool with scope and expiry |
| **Claim** | `{id, type, scope, class, method, pass_rule, lifetime: packet \| continuing, owner}` | `type` names a catalog entry (acceptance item, continuing promise, protected paths, change size, health indicator, readiness, outcome…). `pass_rule`: binary, baseline-relative (`{rule, tolerance}`) or probabilistic (`{rate, runs}`) |
| **Evidence** | `{id, subject, claims, kind, dimension, method, cases: {expected, executed, passed, skipped}, result, strength, producer, payload}` | `result`: pass, fail, inconclusive, skipped, unknown. `producer`: `{source: ci \| local, verifier version, policy revision, workflow run}`. Payloads by kind in §3.1 |
| **Decision** | `{id, kind: approve \| waive \| choose \| delegate \| resolve, subject, target, scope, expiry?, reason, risk_reasons?, actor, proof: {strength, via, policy_revision}, sig?}` | `target` is the claim, request, right or conflict it acts on. Every named decision in the catalog (change-policy, accept-findings, quarantine-check, accept-health-regression, retire-obligation, campaign approval…) is one of the five kinds with a `name` |
| **Event** | `{id: ULID, prev, type, work, time, by, data, sig?}` | One immutable file per event; §5 |
| **Policy** | `tenet.yaml`, the lock, packs and the optional `factory.yaml` | Read from the target line; §6 |

A **work item** (packet) is the grouping record: `packets/<alias>-<slug>/` holds `packet.yaml` (identity only: alias, ULID, title, type, work type, parent campaign if any, created), `definition.md` (intent and its claims), `tasks.yaml`, `log.md`, `events/` and `escalations/`. A campaign is a work item with children.

### 3.1 Evidence kinds and completion

| Kind | Payload | Completes when |
|---|---|---|
| `check` | report digest, log hash, fix hints `[{rule_id, path, hint}]` | Its expected cases were discovered and run (zero discovered is inconclusive); a static method reports the scope it analyzed |
| `measurement` | `{metric, value, threshold, direction, samples, baseline_value, rule, scope, confidence}`; mutation counts (eligible, generated, executed, killed, survived, invalid, equivalent, timed out, excluded) | Samples meet the pass rule's minimum |
| `attestation` | Artifact hashes (screenshots, recordings, traces) | The attested artifact is present |
| `observation` | Outcome status (`recovered`, `partial`, `no-change`, `insufficient-exposure`, `unknown`), scope, window; trust observations | The window has closed or the exposure is sufficient |
| `review` | `{round, judge, model_family, status, findings, invalid, resolved, requires_human}`; each finding is `introduced`, `exposed`, `inherited` or `uncertain`, and `located` or `substantiated` | Every finding is located or moved to `invalid`, which makes the review `incomplete` |
| `proof` | `{prover, version, theorem_hash, obligations, audit: {escape_hatches, axioms_used, axioms_allowed, unsafe_added}}` | Every obligation is discharged, the audit is clean and `theorem_hash` matches the approved definition; a model-check timeout is `unknown` |
| `simulation` | `{seed, fault_profile, steps, properties, replay, twin?}` | The replay command reproduces the result |
| `differential` | `{reference, generator, cases, divergences}` | All cases ran |

**Methods** (catalog R-174): `static`, `health-ratchet`, `unit`, `integration`, `contract`, `e2e`, `property`, `fuzz`, `mutation`, `differential`, `simulation`, `model-check`, `proof`, `benchmark`, `holdout`, `visual-runtime`, `review`, `production-observation`. **Strengths**, never merged: generated trials < bounded model checking < machine-checked theorem; correspondence to the implementation is sampled or proved. A distinguishing check's baseline must fail with the expected `failure_id`; a harness failure is inconclusive.

## 4. The gate rule

<!-- invariant --> **A transition of a work item is allowed when every claim the policy makes applicable to its subject at that station is satisfied or waived.**

- **Satisfied:** fresh evidence (same subject digest) whose method the claim accepts, at the strength the policy requires for that claim class and lane, whose mapped cases executed and passed, with a passing pass rule.
- **Waived:** a fresh `waive` decision on that claim, at the proof strength the proof table requires, within its scope and expiry.
- **Applicable** is computed from the policy: the pack's claims for the station and lane; continuing claims whose scope includes the touched paths or area (earlier promises, protected paths, health indicators); the packet's own acceptance items.

Precedence when several refusals apply, first match wins for the **verdict**, and the **recovery** always applies:

| Order | Condition | Verdict | Recovery |
|---|---|---|---|
| 1 | Frozen | Refuse | — |
| 2 | Work item in conflict | Refuse | `resolve` request |
| 3 | A protected-paths claim is unsatisfied | Human gate; waiving findings unavailable | `approve change-policy` request |
| 4 | Any other applicable claim unsatisfied and unwaived | Refuse; name each claim | Stop event if the stop threshold is met |
| 5 | Review incomplete or `requires_human` | Human gate | — |
| 6 | Stop threshold met | Refuse | Stop event, escalation |
| 7 | All satisfied or waived | Advance | — |
| 8 | Rounds remain | Revise | — |
| 9 | Otherwise | Human gate (exhausted) | — |

Every evaluation appends a `gate` event recording the verdict and the **snapshot** used: policy revision, evidence-store revision, trust observation. Replay re-evaluates against that snapshot; `tenet board --reevaluate` (M2) shows what today's policy would say, separately.

## 5. Events, reduction and replay

<!-- invariant --> Events are the source of truth. File: `packets/<alias>/events/<id>.json` (project events under `events/<yyyy-mm>/`).

| Type | Kind | Data |
|---|---|---|
| `work.created`, `work.changed`, `work.moved`, `work.closed` | state | Identity; lane, risk, priority, appetite, title; station or holding status; endpoint |
| `claim.stated` | state | A claim added, replaced or retired (retiring a continuing claim needs a decision) |
| `evidence.recorded` | note | Pointer to an evidence record on the evidence store, or a local advisory record |
| `decision.requested`, `decision.made` | note; state when it unblocks | Request; answer with proof |
| `run.started`, `run.ended` | note | Actor chain, environment, usage and cost with source, subrun summaries, session links |
| `gate` | note | Verdict and snapshot |
| `lease.taken`, `lease.released` | note | Expiry, strength |

`prev` is the latest event of the work item the writer had seen. Reduction is topological, ties by `id`. Two incompatible **state** events that are not causally ordered put the work item in `conflict` until a `resolve` decision names the one to keep; note events never conflict. The attest job **replays** every changed work item and labels each state event `justified`, `pending-evidence` or `unjustified` (the last fails the job). A modified or deleted event, or a reused ID with different content, is a `tenet check` error. A git-ignored cache may speed reductions but never changes a result.

## 6. Policy

### 6.1 `tenet.yaml` (governance plane)

| Field | Default | Meaning |
|---|---|---|
| `standard`, `kit_path`, `paths.records` | `~<minor>`, `.tenet/kit`, `tenet` | Accepted version range; kit and records locations |
| `pack` | `minimal` | Lifecycle pack or a path to one |
| `owners[]` | — | `{id, name, roles, keys: [{public_key, added, revoked?}]}`; `id` is the signing principal |
| `decision_rights`, `proof` | pack defaults | Who may decide what; the proof table (§7.4) |
| `approvals` | `{express: 0, quick: 0, standard: 1, deep: 2, protected: person-present}` | Human decisions by lane (catalog R-145) |
| `checks` | — | `{<name>: {run, report: junit \| ctrf \| sarif \| none, report_path, inputs, owner, timeout_minutes}}`; the only commands evidence may come from |
| `lane_checks`, `size_limits`, `express` | pack defaults | Required checks per lane; change-size claims; express limits |
| `protect` | pack defaults | Extra protected paths and keys |
| `health` | none | `{indicators: {<name>: {check, metric, rule, tolerance, scope, area}}}` |
| `areas` | none | `{<name>: {paths, owners, decision_rights, wip}}` |
| `board.refs`, `trust`, `holdout`, `context_budgets` | §8, §7, R-104, §9 | Board inputs; evidence ref and forge; holdout mode; budgets |

Unknown keys fail validation except `x-` keys. Packet branches are `tenet/<alias>-<slug>`.

### 6.2 Packs

A pack (`kit/packs/<name>/pack.yaml`) declares phases and stations, lanes, which catalog claims apply at each station and lane, required methods per claim class (M2), work types, decision defaults, loops, roles, and the core obligations each station discharges. Projects may only tighten it.

**The `minimal` pack.** <!-- invariant --> Stations `intake → define → build → verify → integrate → close`; loop-backs `verify → build`, `integrate → build`.

| Station exit | Claims applied (quick / standard) |
|---|---|
| intake | type and title set; no open duplicate |
| define | definition sections present; acceptance items with class, method, pass rule and case IDs; standard: pinned independent tests and a fresh `approve` of the definition |
| build | every task done; change size; protected paths |
| verify | every lane check; every acceptance item; continuing promises and health indicators in scope; distinguishing evidence for behavior changes (standard; defects in quick); review converged where the lane requires a critic |
| integrate | all of verify, on the integrated subject (merge-queue candidate where used) |
| close | endpoint computed; preservation items become continuing promises |

Express (0.1.x) is a lane granted by the attest job (catalog R-092). Endpoints: `checked`, `integrated`, `implemented-unverified`, `cancelled`, `superseded`; release endpoints with the standard pack.

### 6.3 `factory.yaml` (execution plane, optional)

Workers (role, agent definition, model or harness, skills, tool grants), routing, environments (image, setup, network allowlist, secrets per worker; services, twins and observability from M2), identities, channels, triggers (M2), scorers and comparison suites (M2), critic model families and the engine adapter. Protected; recorded on every run; executed by engines and platforms.

## 7. Verification and authority

### 7.1 Policy from the target

<!-- invariant --> Both CI jobs read the policy, lock, kit, checks and Tenet version from the target line, never from the change; the workflow installs the version the target's lock names.

### 7.2 Two jobs

| Job | Does |
|---|---|
| `tenet verify --run-checks` (no secrets, read-only) | Runs pinned checks; computes the subject before and after each (changed tracked files make a check inconclusive); passes only on exit code 0 with a valid report; writes a bundle outside the working tree |
| `tenet verify --attest` (never runs the change) | Recomputes the subject; accepts bundles only from the same workflow run; evaluates protected paths against the target; replays events; writes evidence and observations to the evidence store; posts commit status and decision requests on the pull request; reads forge-verified approvals; verifies merge-queue candidates; on main publishes `board.json` |

**Honest limit.** A check that runs the change's code can be subverted by that code. The two jobs keep that code away from credentials, policy and the evidence store; independent tests, distinguishing evidence, review and external holdout cover the rest.

### 7.3 Evidence store

`refs/tenet/evidence` holds evidence records at `<subject-digest>/<id>.json`, appended only by the attest job (fetch, rebuild and retry on concurrent writes). CP-0017 must show a forge ruleset makes it writable only by that job; otherwise a protected `tenet-evidence` branch or separate repository is used under the same contract. Fork pull requests get a status only; the main-line run records evidence after merge.

### 7.4 Decisions and proof

| Decision (name → kind) | Required strength |
|---|---|
| `change-policy` (approve), `widen-permission` (approve), `amend-vision` (approve) | `person-present` |
| `approve-definition` (approve), `accept-findings` (waive), `accept-risk` (waive), `override` (waive), `quarantine-check` (waive), `accept-health-regression` (waive), `retire-obligation` (waive), `release` (approve), campaign approval (approve), `resolve-conflict` (resolve), `delegate` (delegate) | `forge-verified` |

`forge-verified`: an approving review or a `/tenet decide D-<id> <choice>` comment on the pull request by an account listed for the owner, in an organization that enforces two-factor authentication, covering the current subject, recorded by the attest job. `person-present`: an `ssh-keygen -Y` signature over the canonical decision by a security key whose presence can be read from the signature (CP-0017); key type alone never proves presence. `key` and `channel` answers are recorded and count as advisory. Decisions are fresh only while their subject is current; an option that changes scope carries the replacement digest or returns to Define. Revoking a key is a policy change; earlier signatures stay valid.

### 7.5 Trust observations and guarantee levels

The attest job records an observation of the trust assumptions (protected workflow source, evidence store written only by it, merging requires its status). `enforced*` counts as enforced while the latest observation is under 7 days old and all three hold; otherwise as detected. `tenet doctor` reads it offline.

| Rule | Mode A (deterministic engine) | Mode B (host-driven) with CI |
|---|---|---|
| Gate holds before advancing | enforced | detected locally; enforced* by replay and required status |
| Evidence not from the claimant | enforced* | enforced* |
| Code under test cannot fake its check | not guaranteed | not guaranteed |
| Decisions made by a person | at the proof-table strength | at the proof-table strength; `key`, `channel` advisory |
| Protected paths unchanged | enforced* | enforced* |
| Holdout hidden | enforced* if external | enforced* if external; advisory in-repo |
| Agent tools, paths, network | as the adapter declares | as the host binding declares |

## 8. Views

All views are reductions over events, evidence and policy for a named as-of time ("known in the refs read").

- **`board.json`**: `{as_of, read: {main, branches, evidence}, pack: {phases}, items: [{alias, title, lane, station, status, branch, age, replay, lease, next_actions: [{who, action, reason}], claims: {applicable, satisfied, waived, unsatisfied}, guarantee, cost: {amount, source}}], decision_queue, review_queue, campaigns, areas: [{name, owner, promises: {held, stale, missing}, health: [{indicator, value, baseline, trend}], readiness, quarantined}], conflicts, flow, escalations}`. `now.md` renders it; nothing generated is committed.
- **Flow and metrics.** Unit of delivery: the **verified change** (endpoint ≥ `checked`). Headline: lead time (median, 85th percentile, hours), verified changes per week by lane, decision wait, cost per outcome unit with source, autonomy share beside escapes, kept promises and changeability. Attribution: `selected_by`, `authored_by`, `reviewed_by`, `authorized_by`, `released_by`, `human_edited`. Diagnostics: cycle time, flow efficiency, work in progress, funnels per work type, audited defect rate with bound, change failure and rework, durability, health trends and hotspots, check noise and run time, stuck-work recovery, time to first verified change, upgrade friction, conformance coverage, reviewer escape and false-blocker rates. Rules: sample sizes always, zeros with their bound, express separate, never rank people or agents by throughput.
- **Readiness** (`tenet doctor --readiness`, 0.1.x): per area, the readiness claim and what is missing.

## 9. Context budgets and rollover

<!-- invariant --> Budgets are estimated tokens (characters ÷ 4): vision 4,000; PRD 9,000; catalog 7,000; tech spec 12,000; UX spec 6,000; plan 6,000; kernel Part I 8,000; `definition.md` 3,000; `AGENTS.md` 3,000 (block 1,500); assignment 20,000 per model family; `now.md` 6,000. `tenet check` warns at 90% and errors at 100%; files under `archive/` are exempt. **Rollover:** archive the file unchanged to `archive/<path>@<version>.md`, then compact (keep a context card, everything open, one line per built or retired item with the obligations it imposes) or split an area over 40% into its own file with a moved-table; every ID and anchor must still resolve.

## 10. Commands

Global: `--json`, `--cwd`, `--quiet`, `--verbose`, `--offline`. Exit codes 0 success, 1 gate or check failed, 2 usage, 3 environment, 4 policy refusal.

| Release | Commands |
|---|---|
| 0.1.0 | `init`; `new`; `move`; `status`; `task done`; `close`; `resume`; `receipt` (local, advisory); `verify --run-checks` / `--attest`; `decide`; `resolve`; `board`; `check`; `doctor`; `lease` / `release`; `assign`, `result`, `inspect`, `record`; `agent check`; `skill list`; `build --target agents-md` |
| 0.1.x | `adopt`; `new --express`; `escalate`; `delegate`; `campaign new` / `status`; `doctor --readiness`; `quarantine`; `factory check`; `build --target claude-code` |
| M2 and later | `metrics`, `audit sample`, `compact`, `eject`, `factory compare`, `board --reevaluate` (M2); `run`, `freeze`, `thaw`, `revoke`, `mcp`, `next` (M3); `upgrade`, `conform` (M4); `agent qualify`, `promote`, `scorecard` (M5) |

`tenet check` covers standard §10's checks plus: kit integrity, generated drift, overlay narrowing, roster bound, separation of duties, deprecated use, L0–L2 trailers, event immutability, budgets, pinned skills, replay labels, alias uniqueness. Output: `<file>:<line> <rule-id> <message> → <fix>`.

## 11. Loops and bindings

Loops (`kit/loops/<name>.yaml`) use five step kinds (`agent`, `script`, `human_gate`, `set`, `route`) and are compiled per station. 0.1.0 ships `station` and `fix` (capped at `limits.fix_rounds`, default 2). Static checks: creator steps followed by inspection; counters only increase within a total cap; routes follow §4; human gates list stop first and resolve through `tenet decide`; critics have no write tools and run after checks.

| Binding | Emits | Release |
|---|---|---|
| `agents-md` | `AGENTS.md` block and skills | 0.1.0 |
| `claude-code` | Agents, skills, managed settings keys, a pre-tool hook refusing protected writes | 0.1.x |
| Other hosts; engine adapters (`compile`, `start`, `status`, `cancel`, workspaces, usage, suspend and resume, `next`) | Per target | M3 |

Each binding publishes a per-capability enforcement table that feeds §7.5.

## 12. Install and upgrade

`init` copies the kit, writes the lock, records folder and `AGENTS.md` block, adds the evidence refspec, and offers each optional integration (two-job workflow, forge-verified decisions, a security key for policy decisions, hooks); it ends with a readiness report (advisory or verified, and what is missing). Integrity is checked by hash; files are not made read-only. **Upgrade** (M4): stage, migrate with a restricted file API, regenerate, swap atomically; classify from structured fields.

## 13. Conformance, red-team and self-verification

`pkg/conformance/` holds fixtures (inputs, expected decisions, events, board facts) for positive, refusal, overlapping, concurrent, late-arriving and interrupted cases; `red-team/` holds the R-106 cases with their declared levels; `reference/` holds the four R-009 cases. An independent reader (0.1.x) is written from the kernel text alone. **The evaluator is verified in stages** (catalog R-185): property tests over generated event histories in 0.1.0 (same verdict in any arrival order; evidence for one subject never satisfies another; late evidence never justifies an earlier decision; a waive never hides a claim outside its scope), bounded model checking at M2, proofs optional later. Non-normative mappings (Part II): evidence to in-toto statements and SLSA summaries, events to CDEvents and CloudEvents, runs to OpenTelemetry GenAI spans.

## 14. Security

| Threat | Control | Level |
|---|---|---|
| Policy rewritten on the branch | Policy from the target; protected workflow source | enforced* |
| Forged or stolen evidence | Two jobs; evidence store written only by the attest job | enforced* |
| Code under test faking its result | Independent pinned tests, distinguishing evidence, review, external holdout | mitigated |
| Agent using the Owner's key or session | Proof table: forge session with two-factor authentication, or a touch or PIN | at the required strength |
| Hand-written or concurrent moves | `prev` chain, replay, conflict | enforced* |
| Earlier promises silently dropped | Continuing claims; protected proving cases | enforced* |
| Holdout leakage | External holdout | enforced* if external |
| Prompt injection | Rule of Two; trust-tagged inputs; read-only intake | as the host declares |
| Proof cheating | Theorem hash match, axiom allowlist, escape-hatch audit (M2) | enforced* |
| Malicious skill | Pinned by hash; reviewed in an agent packet | detected |

## 15. Testing

Unit tests per module; property tests of the evaluator (§13); golden boards byte-identical across platforms; end to end with a real git history and a real GitHub repository for the two-job workflow (0.1.0 release gate) plus a simulated CI; the red-team suite in CI; Windows, macOS and Linux; the R-082 workload including 10,000 event files on Windows; dogfooding from 0.1.0.
