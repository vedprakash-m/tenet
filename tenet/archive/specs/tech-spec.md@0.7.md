# Tenet technical specification

> Level L2 · Version 0.7 · Status: **draft, awaiting the Owner's approval** · Implements [prd.md](prd.md) and its [catalog](prd/catalog.md) · Rules: [kit/TENET.md](../../kit/TENET.md) · Sections marked `<!-- provisional -->` are intended invariants: they need the Owner to change, and become `<!-- provisional -->` once the spikes (CP-0017, CP-0040, CP-0041) and the first implementation confirm them · Budget: 12,000 tokens · Previous version: `archive/specs/tech-spec.md@0.6.md`

**Context card.** Tenet is a spec process (§6.3) made checkable by seven record types and one container (§3) and one gate rule (§4). Every feature in the catalog is a standard type of one of them, declared by a pack (§6). The CLI and SDK append events, the CI verifier produces evidence (§7), and every view is a reduction over events (§8). Policy always comes from the target line and is judged against the snapshot recorded at decision time. Every rule states its guarantee and the trust assumptions behind it.

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

**Runtime.** <!-- provisional --> TypeScript compiled to ESM, Node 22 LTS or later, no native modules; runtime dependencies limited to `yaml`, `ajv`, `ajv-formats`, `commander`, `picomatch` (adding one needs a spec packet); `git` 2.40+ and OpenSSH 8.9+.

**Scale tiers** (catalog R-167): tier 1 event files in git (about 50 changes a week); tier 2 git with closed packets compacted into one `events.jsonl` each and evidence on the evidence store (about 1,000 a week); tier 3 an external append-only store under the same schemas and replay rules (M3–M4). Revisions are content-addressed IDs, so a non-git history can supply equivalent evidence.

## 2. Repository and package

<!-- provisional --> **The folder that ships is the folder that is vendored.** `kit/` becomes `kit/` in the package and `.tenet/kit/` in a project, file for file.

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

<!-- provisional --> These are the only normative record types. All are YAML or JSON validated by `kit/schemas/`; timestamps are UTC RFC 3339 with seconds; hashes are full and algorithm-tagged.

| Primitive | Shape | Notes |
|---|---|---|
| **Subject** | `{kind, digest, base?}` | `git-tree`: tree SHA of code paths (everything tracked except the records folder, `.tenet/build/` and generated views) plus each check's declared inputs (check definition, runner image, lockfile), computed with a temporary index. `file-set`: SHA-256 over sorted `path\0blob-sha`; a specification document is a `file-set` with its `level` (catalog R-212). `area`: a named path set from the policy, digested with its paths' tree. Further kinds are pack data (artifact, deployment, config, data, flag, platform object, multi-repo, agent definition). Bookkeeping never changes a `git-tree` subject |
| **Actor** | `{id, kind: person \| agent \| service, roles, keys, chain?}` | People and keys are listed in the policy; runs record the chain initiator → agent → subagent → tool with scope and expiry |
| **Claim** | `{id, type, selector: {station?, lane?, work_type?, paths?, areas?}, class, methods[], pass_rule, lifetime: packet \| continuing, owner, waivable, state?}` | `type` names a catalog entry. `methods`: any one satisfies; separate claims are all required. `pass_rule`: binary, baseline-relative (`{rule, tolerance}`) or probabilistic (`{rate, runs}`). `state` for continuing claims: `held`, `stale`, `defeated` (0.1.x) |
| **Evidence** | `{id, subject, claims, kind, method, cases: {expected, executed, passed, skipped}, result, strength: {provenance, independence}, producer, inputs, valid_until?, payload, identity}` | `result`: pass, fail, inconclusive, skipped, unknown. `producer`: `{source: ci \| local, verifier version, policy revision, workflow run}`. `inputs`: digests of runner image, lockfile and check definition. `identity`: the producing job's proof (§7.3). Payloads by kind in §3.1 |
| **Decision** | `{id, kind: approve \| waive \| choose \| delegate \| resolve, subject, target, scope, expiry?, reason, risk_reasons?, actor, proof: {strength, via, policy_revision}, sig?}` | `target` is the claim, request, right or conflict it acts on. Every named decision in the catalog (change-policy, accept-findings, quarantine-check, accept-health-regression, retire-obligation, campaign approval…) is one of the five kinds with a `name` |
| **Event** | `{id: ULID, prev, type, work, time, by, data, sig?}` | One immutable file per event; §5 |
| **Policy** | `tenet.yaml`, the lock, packs and the optional `factory.yaml` | Read from the target line; §6 |

A **work item** (packet) is the one container: `packets/<alias>-<slug>/` holds `packet.yaml` (identity only: alias, ULID, title, type, work type, parent campaign if any, created), `definition.md` (intent and its claims), `tasks.yaml`, `log.md`, `events/` and `escalations/`. Dependencies (`depends_on`) are `work.changed` data. A campaign is a work item with children.

**Minimal valid records** (R-205): Subject `{kind, digest}`; Actor `{id, kind}`; Claim `{id, type, selector}`; Evidence `{subject, claims, method, result, producer}`; Decision `{kind, subject, target, actor, proof}`; Event `{id, prev, type, work}`; Policy `{standard, pack}`. Every other field is optional with a stated default.

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

**Methods** (catalog R-174) are never ranked globally; a pack lists which satisfy each claim class and lane. Formal evidence states its coverage (trials, bounded, proved) and `correspondence` (`none`, `sampled`, `proved`). A distinguishing check's baseline must fail with the expected `failure_id`; a harness failure is inconclusive. **Case IDs** come from a tag in the test name (`[AB-1]`) or a report property (JUnit `tenet.case`, CTRF `extra.tenet_cases`).

**Strength** (R-034) is compared per axis, each ordered: provenance `local < ci < ci-observed`; independence `self < same-definition < different-definition < different-model-family < person`. `self` never satisfies a claim. Policy sets the minimum per axis by claim class and lane (`strength` in §6.1); defaults: `ci-observed` and `same-definition` for quick, `different-definition` for acceptance items in standard.

### 3.2 Other records

| Record | Is |
|---|---|
| Lease | `lease.*` events, optionally over `paths` |
| Task completion | `work.changed` with the task ID |
| Stop | a `gate` event with `stop: {threshold, value}` |
| Escalation | a work item in `blocked` plus `decision.requested`; the report lives in `escalations/` |
| Run, steering | `run.started`, `run.steered`, `run.ended`; usage and cost are evidence about the actor |
| Assignment | a view of policy and the applicable claims, written for an actor |
| Result | evidence (`kind: review` or `check`) or a proposed `claim.stated` |
| Agent definition | a subject; qualification is a continuing claim on (definition, model, harness, toolset, task class) |
| Pinned check | a subject; its known-bad fixture is a continuing claim on it (R-177) |
| Ledger entry | a readable view of decision and close events |

## 4. The gate rule

<!-- provisional --> **A transition of a work item is allowed when every claim the policy makes applicable to its subject at that station is satisfied or waived.**

- **Satisfied:** fresh evidence (same subject digest) using one of the claim's methods, at or above the policy's minimum on every strength axis, whose mapped cases executed and passed, with a passing pass rule; or, for an **approval claim** (such as the definition approval), a fresh `approve` at the proof table's strength.
- **Waived:** a fresh `waive` of that claim at the proof table's strength, within its scope and unexpired, by an actor other than the one whose change broke it; unwaivable claims cannot be waived.
- **Applicable:** every claim whose selector matches the work item (pack claims, area policy, the packet's acceptance items) and every continuing claim whose paths, or whose area's declared dependencies, the change touches (the whole area when none are declared). Merging only tightens: the most restrictive method set, strength minimum and pass rule win. A selector that cannot be evaluated (unknown area, missing input) refuses with `TN-GATE-UNKNOWN` and names what is missing.

Precedence when several refusals apply, first match wins for the **verdict**, and the **recovery** always applies:

| Order | Condition | Verdict | Recovery |
|---|---|---|---|
| 1 | Frozen | Refuse | — |
| 2 | Work item in conflict | Refuse | `resolve` request |
| 3 | A protected-paths claim is unsatisfied | Human gate; waiving findings unavailable | `approve change-policy` request |
| 4 | Any other applicable claim unsatisfied and unwaived | Refuse; name each claim | Stop recorded in the gate event if the threshold is met |
| 5 | Review incomplete or `requires_human` | Human gate | — |
| 6 | Stop threshold met | Refuse | Stop recorded; escalation |
| 7 | All satisfied or waived | Advance | — |
| 8 | Rounds remain | Revise | — |
| 9 | Otherwise | Human gate (exhausted) | — |

Every evaluation appends a `gate` event recording the verdict, the **argument** (for each claim, the pack rule ID and the evidence or decision that satisfied it) and the **snapshot** used: policy revision, evidence-store revision, trust observation. The rule's own level: detected when only a host evaluates it locally, enforced* through CI replay and the required status (§7.5). Replay re-evaluates against that snapshot; `tenet board --reevaluate` (M2) shows what today's policy would say, separately.

## 5. Events, reduction and replay

<!-- provisional --> Events are the source of truth. File: `packets/<alias>/events/<id>.json` (project events under `events/<yyyy-mm>/`).

| Type | Kind | Data |
|---|---|---|
| `work.created`, `work.changed`, `work.moved`, `work.status`, `work.closed` | state | Identity; lane, risk, priority, appetite, title, tasks done, `depends_on`; `station` (moved) and holding status `active`, `waiting`, `blocked`, `parked` (status) as separate fields; endpoint |
| `claim.stated` | state | A claim added, replaced or retired (retiring a continuing claim needs a decision) |
| `evidence.recorded` | note | Pointer to an evidence record on the evidence store, or a local advisory record |
| `decision.requested`, `decision.made` | note; state when it unblocks | Request; answer with proof. Answers read from forge reviews or comments are written by the attest job to the evidence store at `decisions/<id>.json`, with the review URL and a hash of its content |
| `run.started`, `run.steered`, `run.ended` | note | Actor chain, environment, usage and cost with source, subrun summaries, session links |
| `gate` | note | Verdict, argument, snapshot; `stop` when a threshold is met |
| `lease.taken`, `lease.released` | note | Expiry, strength, optional `paths` |

`prev` is the latest event of the work item the writer had seen. Reduction is topological, ties by `id`. Two incompatible **state** events that are not causally ordered put the work item in `conflict` until a `resolve` decision names the one to keep; note events never conflict. The attest job **replays** every changed work item and labels each state event `justified`, `pending-evidence` or `unjustified` (the last fails the job). A pending move is **tentative**: the board shows it so, no later gate counts it, and it becomes `unjustified` after `replay.pending_hours` (default 24). Resuming an interrupted station reads the latest events and runs and never repeats a recorded step. In pull-request native mode the attest job records forge state (ready for review, merged, closed) as signed `work.moved` and `work.closed` events on the evidence store; agents call `tenet move` only for loop-backs and work off the forge. A modified or deleted event, or a reused ID with different content, is a `tenet check` error. A git-ignored cache may speed reductions but never changes a result.

## 6. Policy

### 6.1 `tenet.yaml` (governance plane)

| Field | Default | Meaning |
|---|---|---|
| `standard`, `kit_path`, `paths.records` | `~<minor>`, `.tenet/kit`, `tenet` | Accepted version range; kit and records locations |
| `specs` | the ladder in §6.3 | Documents per level, their owners and budgets; projects may add documents, never loosen a level |
| `pack` | `minimal` | Lifecycle pack or a path to one |
| `owners[]`, `bots[]` | — | `{id, name, roles, keys: [{public_key, added, revoked?}], forge_accounts}`; `id` is the signing principal. `bots`: the forge identities agents act as (trust assumption 4) |
| `decision_rights`, `proof` | pack defaults | Who may decide what; the proof table (§7.4) |
| `approvals` | `{express: 0, quick: 0, standard: 1, deep: 2, protected: person-present}` | Human decisions by lane (catalog R-145) |
| `strength` | pack defaults | Minimum `{provenance, independence}` per claim class and lane (§3.1) |
| `replay.pending_hours` | 24 | How long a move may stay tentative |
| `checks` | — | `{<name>: {run, report: junit \| ctrf \| sarif \| none, report_path, inputs, owner, timeout_minutes}}`; the only commands evidence may come from |
| `lane_checks`, `size_limits`, `express` | pack defaults | Required checks per lane; change-size claims; express limits |
| `protect` | pack defaults | Extra protected paths and keys |
| `health` | none | `{indicators: {<name>: {check, metric, rule, tolerance, scope, area}}}` |
| `areas` | from CODEOWNERS | `{<name>: {paths, owners, decision_rights, wip}}`; when absent, each CODEOWNERS entry is an area with its owners |
| `board.refs`, `trust`, `holdout`, `context_budgets` | §8, §7, R-104, §9 | Board inputs; evidence ref and forge; holdout mode; budgets |

`init` writes at most 15 lines (`standard`, `owners`, `bots`, `checks`, where `run` may name an existing script); everything else defaults. Unknown keys fail validation except `x-` keys. Packet branches are `tenet/<alias>-<slug>`.

### 6.2 Packs

A pack (`kit/packs/<name>/pack.yaml`) declares phases and stations, lanes, its claims with selectors, accepted methods per claim class, work types, decision defaults, loops and roles. **Pack-authoring contract:** every station names its exit claims; every claim has a selector, methods and a pass rule; every human gate names its decision and strength; a pack validates against `kit/schemas/pack.json` and passes `tenet check --pack`. Projects may only tighten it.

**The `minimal` pack.** <!-- provisional --> Stations `intake → define → build → verify → integrate → close`; loop-backs `verify → build`, `integrate → build`. **Pull-request native** (catalog R-186): `tenet new` creates the branch `tenet/<alias>-<slug>` and the packet folder and prints the command that opens the draft pull request (Tenet makes no network call, R-080; a host binding or engine may open it); a draft is Define, ready for review is Verify, merge is Integrate. Human touches: quick 0 (or 1 where policy requires), standard 1 (the definition approval, of acceptance items in plain words; merge is allowed by policy once claims hold, and the ruleset requires the attest status, not a review), deep 2.

| Station exit | Claims applied (quick / standard) |
|---|---|
| intake | type and title set; no open duplicate |
| define | definition sections present; acceptance items with class, method, pass rule and case IDs; standard: pinned independent tests and a fresh `approve` of the definition |
| build | every task done; change size; protected paths |
| verify | every lane check; every acceptance item; distinguishing evidence for every behavior-changing item (both lanes); health indicators and continuing promises in scope (0.1.x); review converged where the lane requires a critic (advisory in 0.1.0) |
| integrate | all of verify, on the integrated subject (merge-queue candidate where used) |
| close | endpoint computed; preservation items become continuing promises (0.1.x) |

Express (0.1.x) is a lane granted by the attest job (catalog R-092). Endpoints: `checked`, `integrated`, `implemented-unverified`, `cancelled`, `superseded`; release endpoints with the standard pack.

### 6.3 The spec ladder

<!-- provisional --> The default ladder (R-207), relative to the records folder:

| Level | Documents | Changed by | Approved by |
|---|---|---|---|
| L0 | `vision.md` | decision-makers only | `amend-vision`, `person-present`, twice on separate days |
| L1 | `specs/prd.md` and its parts, the adopted standard with `tenet.yaml` | a `spec` packet | `approve-spec-change`, `forge-verified` |
| L2 | `specs/tech-spec.md`, `specs/ux-spec.md`, `specs/plan.md` | a `spec` packet | `<!-- provisional -->` or `<!-- invariant -->` sections as L1; others by a converged review with passing checks, decision-makers notified |
| L3 | `packets/<alias>-<slug>/` | shaping and planning agents | review; `approve-definition` in the standard and deep lanes |
| L4 | code and tests | builders | the gate rule |

A spec packet's `definition.md` has a `## Deltas` section: per document, the IDs added, modified and removed, with the new text. Integrate applies them, bumps each document's version and checks budgets (§9). `tenet check` enforces R-209 and R-210 on every commit: trailers (`Tenet-Amendment`, `Tenet-Clarification`, `Tenet-Task`, `Tenet-Req`); no commit from a build run touches L0–L2; IDs unique and resolved; every requirement has a status and `serves`; every packet `serves` and `implements`; every active vision item is covered or marked not yet in scope; `vision.md` matches its latest ratified amendment. A commit that only clarifies (typos, links, contradictions with no behavior change) carries `Tenet-Clarification` and needs no packet.

### 6.4 `factory.yaml` (execution plane, optional)

Workers (role, agent definition, model or harness, skills, tool grants), routing, environments (image, setup, network allowlist, secrets per worker; services, twins and observability from M2), identities, channels, triggers (M2), scorers and comparison suites (M2), critic model families and the engine adapter. Protected; recorded on every run; executed by engines and platforms.

## 7. Verification and authority

### 7.1 Policy from the target

<!-- provisional --> Both CI jobs read the policy, lock, kit, checks and Tenet version from the target line, never from the change; the workflow installs the version the target's lock names.

### 7.2 Two jobs

| Job | Does |
|---|---|
| `tenet verify --run-checks` (no credentials, read-only, network denied by default, environment-variable allowlist, no cache shared with the attest job, runner image recorded) | Runs pinned checks; computes the subject before and after each (changed tracked files make a check inconclusive); passes only on exit code 0 with a valid report; writes a bundle outside the working tree |
| `tenet verify --attest` (never runs the change, restores no cache) | Recomputes the subject; accepts bundles only from the same workflow run and parses them as data; evaluates protected paths against the target; replays events; signs evidence and observations and writes them to the evidence store; records forge state changes; posts commit status and decision requests on the pull request; reads forge-verified approvals and writes them to the evidence store; observes trust assumptions; verifies merge-queue candidates; on main publishes `board.json` |

**Honest limit.** A check that runs the change's code can be subverted by that code. The two jobs keep that code away from credentials, policy and the evidence store; independent tests, distinguishing evidence, review and external holdout cover the rest.

**Reference workflow.** Tenet ships one hardened workflow file: two jobs, minimal explicit permissions, triggered so it runs from the target line. Editing it is `change-policy`. GitHub specifics in §7 are the reference binding; the kernel names only the properties (signed provenance, merge requires status, attributable decisions).

### 7.3 Evidence store

Each evidence record carries the attest job's **identity proof**: on GitHub, an OIDC token requested with the record's digest as its audience (useless to any other service), whose claims name the workflow file and the ref it ran from. A record is accepted only when the token's signature verifies against the forge's published keys and the workflow and ref are the target's protected verifier. Records live at `refs/tenet/evidence` under `<subject-digest>/<id>.json` (fetch, rebuild and retry on concurrent writes); because they are signed, being able to write the ref is not enough to forge one. The attest job verifies records at ingest and publishes the result with `board.json`; outside CI, `tenet board` verifies against keys the user fetched (`tenet doctor --fetch-keys`) and otherwise labels evidence `verified in CI`. CP-0040 tests this, including the claims under the chosen trigger and key rotation; if it fails, the fallback is a store only the attest job can write (a protected `tenet-evidence` branch or a separate repository). Fork pull requests get a status only; the main-line run records evidence after merge.

### 7.4 Decisions and proof

| Decision (name → kind) | Required strength |
|---|---|
| `change-policy` (approve), `widen-permission` (approve), `amend-vision` (approve, twice), `release` in the deep lane (approve) | `person-present` |
| `approve-spec-change` (approve), `approve-definition` (approve), `accept-findings` (waive), `accept-risk` (waive), `override` (waive), `quarantine-check` (waive), `accept-health-regression` (waive), `replace-proving-case` (approve), `retire-obligation` (approve, by the promise's owner), `release` (approve), campaign approval (approve), `resolve-conflict` (resolve), `delegate` (delegate) | `forge-verified` |

`forge-verified` means **attributable to the decision-maker's forge account**: an approving review whose commit is the current subject (the primary path), or a `/tenet decide D-<id> <choice> @<digest prefix>` comment whose prefix matches the current subject (requests include copy-ready lines), by an account listed in `owners[].forge_accounts`, recorded by the attest job. The attest job records the two-factor status as `enforced`, `not-enforced` or `unobservable` (personal repositories; a token without the needed scope) and shows it with the strength. A pull-request author cannot approve their own pull request on most forges, so in the standard lane agents open pull requests as a `bots[]` identity, or the decision-maker uses the comment form. The attest job flags a decision by an account on a pull request authored by that account's agent session; unless a host binding attests that agents run without decision-makers' credentials (trust assumption 4), `forge-verified` counts as detected, not enforced*. `person-present`: an `ssh-keygen -Y` signature over the canonical decision by a security key whose presence can be read from the signature (CP-0017); key type alone never proves presence. `key` and `channel` answers are recorded and count as advisory. Decisions are fresh only while their subject is current; an option that changes scope carries the replacement digest or returns to Define. Revoking a key is a policy change; earlier signatures stay valid.

### 7.5 Trust observations and guarantee levels

The attest job observes trust assumptions 1–3: protected workflow source; evidence verifying against that source's identity; merging requires its status (recorded as `unavailable` on forge plans without merge protection). Assumption 4 is declared in the policy and spot-checked (agent commits and pull requests come from `bots[]` identities; no listed owner account acts on a pull request its agent session opened); it supports enforced* only where a host binding's capability table attests credential separation. `enforced*` counts as enforced while the latest observation is under 7 days old and the observed assumptions hold; otherwise as detected. `tenet doctor` reads it offline.

| Rule | Mode A (deterministic engine) | Mode B (host-driven) with CI |
|---|---|---|
| Gate holds before advancing | enforced | detected locally; enforced* by replay and required status |
| Evidence not from the claimant | enforced* | enforced* |
| Code under test cannot fake its check | not guaranteed | not guaranteed |
| Decisions made by a person | at the proof-table strength | at the proof-table strength; `forge-verified` enforced* only under assumption 4; `key`, `channel` advisory |
| Protected paths unchanged | enforced* | enforced* |
| Holdout hidden | enforced* if external | enforced* if external; advisory in-repo |
| Agent tools, paths, network | as the adapter declares | as the host binding declares |

## 8. Views

All views are reductions over events, evidence and policy for a named as-of time ("known in the refs read").

- **`board.json`** (`schema_version` 1; `tenet board --since <rev>` returns only changed items): `{schema_version, as_of, read: {main, branches, evidence}, pack: {phases}, items: [{alias, title, lane, station, status, branch, age, depends_on, replay (`justified`, `tentative`, `unjustified`), lease, next_actions: [{who, action, reason, command}], claims: {applicable, satisfied, waived, unsatisfied}, guarantee, cost: {amount, source}}], decision_queue, review_queue, campaigns, areas: [{name, owner, promises: {held, stale, defeated, missing}, health: [{indicator, value, baseline, trend}], readiness, quarantined, waivers: {open, oldest, expiring}}], conflicts, flow, escalations}`. `now.md` renders it; nothing generated is committed. A **fixture gallery** (`pkg/conformance/boards/`) holds boards for tentative moves, conflicts, waivers, defeated promises and stale trust, so UI builders can work without running Tenet.
- **Flow and metrics.** Unit of delivery: the **verified change** (endpoint ≥ `checked`). Headline: lead time (median, 85th percentile, hours), verified changes per week by lane, lane mix against its target (default ≥70% quick or express), decision wait, cost per outcome unit with source, autonomy share beside escapes, kept promises and changeability. Attribution: `selected_by`, `authored_by`, `reviewed_by`, `authorized_by`, `released_by`, `human_edited`. Diagnostics: cycle time, flow efficiency, work in progress, funnels per work type, audited defect rate with bound, change failure and rework, durability, health trends and hotspots, check noise and run time, stuck-work recovery, time to first verified change, upgrade friction, conformance coverage, reviewer escape and false-blocker rates. Rules: sample sizes always, zeros with their bound, express separate, never rank people or agents by throughput.
- **Readiness** (`tenet doctor --readiness`, 0.1.x): per area, the readiness claim and what is missing.

## 9. Context budgets and rollover

<!-- provisional --> Budgets are estimated tokens (characters ÷ 4): vision 4,000; PRD 9,000; catalog and each other PRD part 7,000; tech spec 12,000; UX spec 6,000; plan 6,000; kernel Part I 8,000; `definition.md` 3,000; `AGENTS.md` 3,000 (block 1,500); assignment 20,000 per model family; `now.md` 6,000. `tenet check` warns at 90% and errors at 100%; files under `archive/` are exempt. **Rollover:** archive the file unchanged to `archive/<path>@<version>.md`, then compact (keep a context card, everything open, one line per built or retired item with the obligations it imposes) or split an area over 40% into its own file with a moved-table; every ID and anchor must still resolve.

## 10. Commands

Global: `--json`, `--cwd`, `--quiet`, `--verbose`, `--offline`. Exit codes 0 success, 1 gate or check failed, 2 usage, 3 environment, 4 policy refusal.

| Release | Commands |
|---|---|
| 0.1.0 | `init`; `new` (branch and folder; prints the draft pull request command); `move`; `status`; `task done`; `close`; `resume`; `receipt` (local, advisory); `verify --run-checks` / `--attest`; `decide`; `resolve`; `board`; `check`; `doctor`; `lease` / `release`; `assign`, `result`, `inspect`, `record`; `agent check`; `skill list`; `build --target agents-md` |
| 0.1.x | `adopt`; `new --express`; `escalate`; `delegate`; `campaign new` / `status`; `doctor --readiness`; `quarantine`; `factory check`; `build --target claude-code` |
| M2 and later | `metrics`, `audit sample`, `compact`, `eject`, `factory compare`, `board --reevaluate` (M2); `run`, `freeze`, `thaw`, `revoke`, `mcp`, `next` (M3); `upgrade`, `conform` (M4); `agent qualify`, `promote`, `scorecard` (M5) |

`tenet check` covers structure, schemas, links, and the spec ladder's change control and traceability (§6.3), plus: kit integrity, generated drift, overlay narrowing, roster bound, separation of duties, deprecated use, L0–L2 trailers, event immutability, budgets, pinned skills, replay labels, alias uniqueness. Output: `<file>:<line> <rule-id> <message> → <fix>`.

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

`pkg/conformance/` holds fixtures (inputs, expected decisions, events, board facts) for positive, refusal, overlapping selectors, unknown applicability, concurrent, late-arriving and interrupted cases; `red-team/` holds the R-106 cases with their declared levels; `reference/` holds the four R-009 cases. An independent reader (0.1.x) is written from the kernel text alone. **The evaluator is verified in stages** (catalog R-185): property tests over generated event histories in 0.1.0 (same verdict in any arrival order; evidence for one subject never satisfies another; late evidence never justifies an earlier decision; a waive never hides a claim outside its scope; a tentative move never satisfies a later gate; merging policies never loosens a claim), bounded model checking at M2, proofs optional later. Non-normative mappings (Part II): evidence to in-toto statements and SLSA summaries, events to CDEvents and CloudEvents, runs to OpenTelemetry GenAI spans.

## 14. Security

| Threat | Control | Level |
|---|---|---|
| Policy rewritten on the branch | Policy from the target; protected workflow source | enforced* |
| Forged or stolen evidence | Two jobs; evidence signed with the protected workflow's identity (fallback: a store only the attest job writes) | enforced* |
| Cache poisoning or artifact injection between jobs | No shared cache; bundle parsed as data; hardened reference workflow; red-team cases | enforced* |
| Code under test faking its result | Independent pinned tests, distinguishing evidence, review, external holdout | mitigated |
| Gaming the checks (inserted skips, special-cased or deleted tests, substituted reports, planted test hooks) | Protected paths; case manifests (zero executed is inconclusive); report parsed from the check job only; red-team cases | enforced* for protected files; detected otherwise |
| Agent using the Owner's key or forge session | Trust assumption 4 observed; `bots[]` identities; digest-bound comments; `person-present` for policy, permission, vision and deep-lane release | enforced* where a host binding attests separation; else detected |
| Hand-written or concurrent moves | `prev` chain, replay, conflict | enforced* |
| Earlier promises silently dropped | Continuing claims; protected proving cases; defeaters (0.1.x) | enforced* |
| Holdout leakage | External holdout | enforced* if external |
| Prompt injection | Rule of Two; trust-tagged inputs; read-only intake | as the host declares |
| Proof cheating | Theorem hash match, axiom allowlist, escape-hatch audit (M2) | enforced* |
| Malicious skill | Pinned by hash; reviewed in an agent packet | detected |

## 15. Testing

Unit tests per module; property tests of the evaluator (§13); golden boards byte-identical across platforms; end to end with a real git history and a real GitHub repository for the two-job workflow (0.1.0 release gate) plus a simulated CI; the red-team suite in CI; Windows, macOS and Linux; the R-082 workload including 10,000 event files on Windows; dogfooding from 0.1.0.
