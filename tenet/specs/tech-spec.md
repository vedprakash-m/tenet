# Tenet technical specification

> Level L2 · Version 0.13 · Status: **draft, awaiting the Owner's approval** · Implements [prd.md](prd.md) and its parts · Parts: [kernel](tech-spec/kernel.md) (kernel algorithms and interfaces), [contracts](tech-spec/contracts.md) (formats and interfaces), [messages](tech-spec/messages.md) (error message and fix templates), [algorithms](tech-spec/algorithms.md), [CI and authority](tech-spec/ci.md), [agents](tech-spec/agents.md), [evidence](tech-spec/evidence.md), [onboarding](tech-spec/onboarding.md), [MCP](tech-spec/mcp.md), [health](tech-spec/health.md) · Normative until CP-0015 writes the kernel: this specification, its parts and the PRD; `kit/TENET.md` is superseded except where its banner says · Sections marked `<!-- provisional -->` are intended invariants: they need the Owner to change, and become `<!-- invariant -->` once the spikes (CP-0017, CP-0040, CP-0041) and the first implementation confirm them · Budget: 12,000 tokens · Previous version: `archive/specs/tech-spec.md@0.12.md`

**Context card.** Tenet is a spec process (§6.3) made checkable by seven record types and one container (§3) and one gate rule (§4). Every feature in the catalog is a standard type of one of them, declared by a pack (§6). The CLI and SDK append events, the CI verifier produces evidence (§7), and every view is a reduction over events (§8). How strict any of this is depends on the project's `level` and each rule's mode (§6.1). Policy always comes from the target line and is judged against the snapshot recorded at decision time. Every rule states its guarantee and the trust assumptions behind it.

## 1. Architecture

The tooling reads and writes files and git: no server, no database, no model client. Record paths are relative to the records folder (`paths.records`, default `tenet/`).

| Directory | Holds | May import |
|---|---|---|
| `src/types/` | TypeScript types generated from `kit/schemas/` | nothing |
| `src/core/` | `fs`, `yaml`, `schema`, `git`, `hash` (SHA-256, RFC 8785, ULID, alias), `output`, `clock`, `sign` | `types` |
| `src/policy/` | `tenet.yaml`, lock, kit, levels and rules, policy from the target | `types`, `core` |
| `src/specs/` | Parsing, sections and digests, citations, flags, deltas, `fix`, `split` | `types`, `core`, `policy` |
| `src/onboard/` | Preflight, inventory, drafting assignment, `bless`, refresh | `types`, `core`, `policy`, `specs`, `reports` |
| `src/context/` | Context selection and budgets | `types`, `core`, `policy`, `specs` |
| `src/reports/` | Test-report readers, the acceptance block, weakening | `types`, `core` |
| `src/kernel/` | Subjects, events, reduction, gate, replay, decisions (alpha.1) | `types`, `core`, `policy` |
| `src/verify/` | The test job, the recorder (the attest job from `verify`), the forge binding | all above except `install`, `mcp` |
| `src/views/` | Boards and their renderings | `types`, `core`, `policy`, `specs`, `reports`, `kernel` |
| `src/mcp/` | The local MCP server | `types`, `core`, `policy`, `specs`, `context`, `views` |
| `src/install/` | `init`, manifest, hosts, `upgrade`, `remove` | all above except `verify` |
| `src/commands/` | One file per command; `index.ts` lists them | all except `mcp` |
| `src/sdk.ts`, `src/cli.ts` | Public API; entry point | all |
| `runner/` (separate package) | The reference runner and its adapters (agents.md §6) | the published SDK only |

`test/architecture.test.ts` enforces this table and the runtime dependency list.

Every SDK function takes `{cwd, stdin, stdout, now}` so tests are deterministic.

**Runtime.** <!-- provisional --> TypeScript compiled to ESM, Node 22 LTS or later, no native modules; runtime dependencies limited to `yaml`, `ajv`, `ajv-formats`, `commander`, `picomatch`, `fast-xml-parser` (adding one needs a spec packet); `git` 2.40+ and OpenSSH 8.9+.

**Scale tiers** (catalog R-167): tier 1 event files in git (about 50 changes a week); tier 2 git with closed packets compacted into one `events.jsonl` each and evidence on the evidence store (about 1,000 a week); tier 3 an external append-only store under the same schemas and replay rules (M3–M4). Revisions are content-addressed IDs, so a non-git history can supply equivalent evidence.

## 2. Repository and package

<!-- provisional --> **The folder that ships is the folder that is loaded.** `kit/` is `kit/` in the package; a project loads it from the installed package and checks it against `tenet.lock`, or, with `init --vendor`, keeps a file-for-file copy in `.tenet/kit/`.

```text
tenet/  README.md LICENSE CONTRIBUTING.md AGENTS.md CLAUDE.md package.json tsconfig.json tenet.yaml
  kit/   SHIPPED AND VENDORED: TENET.md, CHANGELOG.md, schemas/, defaults/, templates/, packs/,
         agents/, criteria/, skills/, loops/, workflows/, hooks/, practices/; kit.json generated at release
  pkg/   SHIPPED, NOT VENDORED: migrations/, conformance/ (red-team, reference cases), hosts/;
         evals/ stays in the repository and is never published
  src/ test/ docs/ examples/minimal/
  runner/ the optional reference runner, published as @vedprakash-m/tenet-runner (agents.md §6)
  tenet/ this repository's records (self-hosting: kit_path: kit, no lock)
```

Package: `"bin": {"tenet": "dist/cli.js"}`, `"exports": {".": "./dist/sdk.js"}`, `"files": ["dist","kit","pkg/migrations","pkg/conformance","pkg/hosts"]` (the release asserts the tarball's file list); npm workspaces `[".", "runner"]`, released in lockstep; published to npm as `@vedprakash-m/tenet` with provenance from 0.1.0-alpha.0; each GitHub release also carries the prebuilt package (`.tgz`), a kit archive and `SHA256SUMS`, so nothing is built on a user's machine. Home: `github.com/vedprakash-m/tenet`. Documented commands always pin a release (`npx -y @vedprakash-m/tenet@<version>`), never a branch. Node projects add it as a dev dependency and others install it globally, so `tenet` stays on the path; MCP entries run the pinned package, so they work either way. A template repository, `vedprakash-m/tenet-starter`, holds a new project's starting files (`tenet.yaml`, `tenet.lock`, `AGENTS.md`, `tenet/intent.md`, the workflow). Standalone binaries are attached to each GitHub release from 0.1.x. The repository's README opens with the ways in from UX spec Part 0.

## 3. The seven primitives

<!-- provisional --> These are the only normative record types. All are YAML or JSON validated by `kit/schemas/`; timestamps are UTC RFC 3339 with seconds; hashes are full and algorithm-tagged.

| Primitive | Shape | Notes |
|---|---|---|
| **Subject** | `{kind, digest, base?}` | `git-tree`: the tree SHA of tracked code, excluding the records folder, `.tenet/` and generated views (ALG-01). Check inputs (definition, runner image, lockfile) are recorded on evidence, never in the subject, so every check and decision on one commit share it. `file-set`: SHA-256 over sorted `path\0blob-sha`. `section`: a level-2 section of a specification (ALG-02). `area`: a named path set from the policy. Further kinds are pack data (artifact, deployment, config, data, flag, platform object, multi-repo, agent definition) |
| **Actor** | `{id, kind: person \| agent \| service, roles, keys, chain?}` | People and keys are listed in the policy; runs record the chain initiator → agent → subagent → tool with scope and expiry |
| **Claim** | `{id, type, selector: {station?, lane?, work_type?, paths?, areas?}, class, methods[], pass_rule, lifetime: packet \| continuing, owner, waivable, state?}` | `type` names a catalog entry. `methods`: any one satisfies; separate claims are all required. `pass_rule`: binary, baseline-relative (`{rule, tolerance}`) or probabilistic (`{rate, runs}`). `state` for continuing claims: `held`, `stale`, `defeated` (0.1.x) |
| **Evidence** | `{id, subject, claims, kind, method, cases: {expected, executed, passed, skipped}, result, strength: {provenance, independence}, producer, inputs, valid_until?, payload, identity}` | `result`: pass, fail, inconclusive, skipped, unknown. `producer`: `{source: ci \| local, verifier version, policy revision, workflow run}`. `inputs`: digests of runner image, lockfile and check definition. `identity`: the producing job's proof ([ci.md §5](tech-spec/ci.md#5-verify-sealed-tests-and-signed-records-alpha2-on)). Payloads by kind in §3.1 |
| **Decision** | `{id, kind: approve \| waive \| choose \| delegate \| resolve, subject, target, scope, expiry?, reason, risk_reasons?, actor, proof: {strength, via, policy_revision}, sig?}` | `target` is the claim, request, right or conflict it acts on. Every named decision in the catalog (change-policy, accept-findings, quarantine-check, accept-health-regression, retire-obligation, campaign approval…) is one of the five kinds with a `name` |
| **Event** | `{id: ULID, prev: [ID], type, work, time, by, data, sig?}` | One immutable file per event. `prev` lists every event the writer saw as latest (empty when created; two or more for a `resolve`); §5 |
| **Policy** | `tenet.yaml`, the lock, packs and the optional `factory.yaml` | Read from the target line; §6 |

A **work item** (packet) is the one container: `packets/<alias>-<slug>/` holds `packet.yaml` (identity only: alias, ULID, title, type, work type, parent campaign if any, created), `definition.md` (intent and its claims), `tasks.yaml`, `log.md`, `events/` and `escalations/`. Dependencies (`depends_on`) are `work.changed` data. A campaign is a work item with children. A **quick change has no folder**: its pull request is the work item `pr-<number>`, its description holds intent and acceptance items (contracts §2), and the recorder keeps its state under `works/pr-<number>/` on the records ref. Event files that do exist are marked `linguist-generated` in `.gitattributes` so reviews collapse them.

**Minimal valid records** (R-205): Subject `{kind, digest}`; Actor `{id, kind}`; Claim `{id, type, selector}`; Evidence `{subject, claims, method, result, producer}`; Decision `{kind, subject, target, actor, proof}`; Event `{id, prev, type, work}`; Policy `{standard, pack}`. Every other field is optional with a stated default.

### 3.1 Evidence kinds and completion

Payloads and completion rules per kind (check, measurement, attestation, observation, review, proof, simulation, differential): [evidence.md §1](tech-spec/evidence.md#1-evidence-payloads).

**Methods** (catalog R-174) are never ranked globally; a pack lists which satisfy each claim class and lane. Formal evidence states its coverage (trials, bounded, proved) and `correspondence` (`none`, `sampled`, `proved`). A distinguishing check's baseline must fail with the expected `failure_id`; a harness failure is inconclusive. **Case IDs** come from a tag in the test name (`[AB-1]`, `[R-12]`, or `tenet_AB_1`) or a report property (JUnit `tenet.case`, CTRF `extra.tenet_cases`); ALG-08 says which tags count.

**Strength** (R-034) has two ordered axes. **Provenance** is who produced the evidence: `local < ci < ci-observed`. **Independence** is who wrote the check, compared with who wrote the change: `self` (the claimant's own run) `< same-definition` (CI ran a check written in the same change, or by the same agent definition) `< different-definition` (written or pinned by a separate agent, as in the careful lane; credited from the `Tenet-Agent` trailers the runner writes on each step's commit, never typed by people) `< different-model-family < person`. A missing value counts as the lowest; `self` never satisfies a claim. Methods are not ranked: a pack lists which are admissible for each claim class. Policy sets the minimum per axis by claim class and lane (`strength` in §6.1); defaults: `ci` and `same-definition` for quick, `different-definition` for acceptance items in the careful lane.

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

- **Satisfied:** fresh evidence (matching subject and applicable evaluation inputs, within its validity window, per kernel §2) using one of the claim's methods, at or above the policy's minimum on every strength axis, whose mapped cases executed and passed, with a passing pass rule; or, for an **approval claim** (such as the definition approval), a fresh `approve` at the proof table's strength.
- **Waived:** a fresh `waive` of that claim at the proof table's strength, within its scope and unexpired, by an actor other than the one whose change broke it; unwaivable claims cannot be waived.
- **Applicable:** every claim whose selector matches the work item (pack claims, area policy, the packet's acceptance items) and every continuing claim whose paths, or whose area's declared dependencies, the change touches (the whole area when none are declared). Merging only tightens: the most restrictive method set, strength minimum and pass rule win. A selector that cannot be evaluated (unknown area, missing input) refuses with `TN-GATE-UNKNOWN` and names what is missing.

Every applicable claim and every rule is evaluated; any refusal under an enforced rule blocks, whatever else also matched. The gate returns, separately: each claim's result; the **verdict** (refuse, human gate, advance); the rule modes applied; the actual **disposition** (blocks or not); the **next action** and who takes it; and a reason ID per result. Unknown applicability, frozen work, stop thresholds, advisory failures, approvals that do not replace evidence, and incompatible policies each have their own row. The full decision table and fixtures are [ALG-07](tech-spec/algorithms.md#alg-07). The same history and evaluation instant always yield the same result.

A refusal blocks only when the rule's mode is `enforce` (§6.1); in `observe` and `advise` the verdict is recorded and shown as "would have blocked". Every evaluation appends a `gate` event recording the verdict, the **argument** (for each claim, the pack rule ID and the evidence or decision that satisfied it) and the **snapshot** used: policy revision, evidence-store revision, trust observation. The rule's own level: detected when only a host evaluates it locally, enforced* through CI replay and the required status ([ci.md §7](tech-spec/ci.md#7-trust-observations-and-guarantee-levels)). Replay re-evaluates against that snapshot; `tenet board --reevaluate` (M2) shows what today's policy would say, separately.

## 5. Events, reduction and replay

<!-- provisional --> Events are the source of truth. File: `packets/<alias>/events/<id>.json` (project events under `events/<yyyy-mm>/`).

| Type | Kind | Data |
|---|---|---|
| `work.created`, `work.changed`, `work.moved`, `work.status`, `work.closed` | state | Identity; lane, risk, priority, appetite, title, tasks done, `depends_on`; `station` (moved) and holding status `active`, `waiting`, `blocked`, `parked` (status) as separate fields; endpoint |
| `claim.stated` | state | A claim added, replaced or retired (retiring a continuing claim needs a decision) |
| `evidence.recorded` | note | Pointer to an evidence record on the evidence store, or a local advisory record |
| `decision.requested`, `decision.made` | note; state when it unblocks | Request; answer with proof. Answers read from forge reviews or comments are written by the recorder to `decisions/<id>.json` (records ref from alpha.1; signed on the evidence store from alpha.2), with the review URL and a hash of its content |
| `run.started`, `run.steered`, `run.ended` | note | Actor chain, environment, usage and cost with source, subrun summaries, session links |
| `gate` | note | Verdict, argument, snapshot; `stop` when a threshold is met |
| `lease.taken`, `lease.released` | note | Expiry, strength, optional `paths` |

Reduction, the conflict table per event family and duplicate handling are [ALG-05](tech-spec/algorithms.md#alg-05): reduction is topological over `prev`, ties by `id`; two incompatible **state** events not causally ordered put the work item in `conflict` until a `resolve` (whose `prev` names both) keeps one; note events never conflict. Each `gate` event records `evaluated_at`; replay uses it, and evaluation "as of now" is a separate call. The attest job **replays** every changed work item and labels each state event `justified`, `pending-evidence` or `unjustified` (the last fails the job). A pending move is **tentative**: the board shows it so, no later gate counts it, and it becomes `unjustified` after `replay.pending_hours` (default 24). Resuming an interrupted station reads the latest events and runs and never repeats a recorded step. In pull-request native mode forge state (ready for review, merged, closed) becomes `work.moved` and `work.closed` events: recorded by the recorder on the records ref from alpha.1, signed by the attest job on the evidence store from alpha.2; agents call `tenet move` only for loop-backs and work off the forge. A modified or deleted event, or a reused ID with different content, is a `tenet check` error. Committed events are read through one `git cat-file --batch` process (10,000 events in 0.8 s on Windows, against 5.4 s through the file system in Spike C); only uncommitted events are read from files. A git-ignored cache may speed reductions but never changes a result.

## 6. Policy

### 6.1 `tenet.yaml` (governance plane)

| Field | Default | Meaning |
|---|---|---|
| `standard`, `kit_path`, `paths.records` | `~<minor>` (npm tilde range), `null` (load from the installed package), `tenet` | Accepted version range; a vendored kit's folder (`.tenet/kit` with `init --vendor`; `kit` when self-hosting); records location |
| `level` | `observe` | `observe`, `protect`, `verify` or `assure` (R-214); sets each rule's default mode, the proof table and which trust assumptions are required |
| `rules` | from `level` | `{<rule-id>: observe \| advise \| enforce}` overrides one rule of the registry below; promoting a rule is a decision |
| `specs` | the ladder in §6.3 | `{id_prefix: R, documents: [{path, level, owner?, budget?}]}`; projects may add documents, never loosen a level |
| `pack` | `minimal` | Lifecycle pack or a path to one |
| `owners[]`, `bots[]` | — | `{id, name, roles, keys: [{public_key, added, revoked?}], forge_accounts}`; `id` is the signing principal. `bots` (from `verify`): the forge identities agents act as (trust assumption 4) |
| `decision_rights`, `proof` | pack defaults | Who may decide what; the proof table ([ci.md §6](tech-spec/ci.md#6-decisions-and-proof)) |
| `approvals` | `{express: 0, quick: 0, careful: 1, deep: 2, protected: forge-verified}` (`person-present` at `assure`) | Human decisions by lane (catalog R-145) |
| `strength` | pack defaults | Minimum `{provenance, independence}` per claim class and lane (§3.1) |
| `replay.pending_hours` | 24 | How long a move may stay tentative |
| `checks` | — | `{<name>: {setup: [command], run, report: junit \| ctrf \| go-test-json \| jest-json \| tenet-health-json \| sarif \| lcov \| cobertura \| none, report_from: file \| stdout, report_path, inputs, tool?: {name, version, config_digest}, suppression_patterns?: [string], owner, timeout_minutes}}`; `run` calls the runner with its reporter flags (contracts §6); how they run: [ci.md §2](tech-spec/ci.md#2-running-checks); the only commands evidence may come from |
| `ci` | detected | `{mode: tenet-workflow \| existing-job, test_workflow}`: where the tests run ([ci.md §2](tech-spec/ci.md#2-running-checks)) |
| `stop` | `{failing_evaluations: 3}` | Stop thresholds (R-036) |
| `onboard` | — | `{exclude: [glob]}` (onboarding §1) |
| `agents` | `{working_rules: default}` | `default`, `off`, or a path to the project's own working rules (agents.md §1) |
| `lane_checks`, `size_limits`, `express` | pack defaults | Required checks per lane; change-size claims; express limits |
| `protect` | Tenet's workflows, `tenet.yaml`, `tenet.lock`, CODEOWNERS, `.gitattributes`, `.tenet/health-baseline.json` | Paths that change only with `change-policy` (`protected-surfaces`); projects may add. Blessed copies and blessing fields have their own tier: they change only together with a blessing by the section's owner (DEC-55) |
| `health` | none | `{baseline_path?, waiver_max_days?: 30, architecture?: {modules: {<id>: {paths, area?}}}, indicators: {<name>: {kind, check, metric, population?, direction?, rule_scope?, scope, area, max_new?, tolerance, owner?}}}` ([health.md](tech-spec/health.md)) |
| `areas` | from CODEOWNERS | `{<name>: {paths, owners, decision_rights, wip}}`; when absent, each CODEOWNERS entry is an area with its owners |
| `board.refs`, `trust`, `holdout`, `context_budgets` | §8, §7, R-104, §9 | Board inputs; evidence ref and forge; holdout mode; budgets |

**Rule registry and level defaults.** <!-- provisional -->

| Rule | Checks | From | observe | protect | verify | assure |
|---|---|---|---|---|---|---|
| `tests-not-weakened` | No test deleted or skipped (ALG-09) | alpha.0 | advise | enforce | enforce | enforce |
| `protected-surfaces` | Trust-surface files change only with `change-policy` | alpha.0 | advise | enforce | enforce | enforce |
| `acceptance-passed` | Every required acceptance item has a passing result on the tested commit | alpha.0 | advise | advise | enforce | enforce |
| `citations-valid` | Every citation resolves (ALG-04) | alpha.0 | advise | advise | enforce | enforce |
| `budget` | Documents within budget (§9) | alpha.0 | advise | advise | advise | enforce |
| `stop-threshold` | A stop threshold met (R-036) | alpha.1 | advise | enforce | enforce | enforce |
| `review-converged` | A required critic's review is complete | 0.1.0 | observe | advise | enforce | enforce |
| `spec-approval` | L0–L2 changes carry the approval §6.3 requires | alpha.1 | advise | enforce | enforce | enforce |
| `distinguishing-evidence` | Careful and deep: defect fixes fail on the base (R-172) | 0.1.0 | observe | advise | enforce | enforce |
| `signed-evidence` | Evidence signed by the attest job | alpha.2 | — | — | enforce | enforce |
| `person-present-policy` | Policy, permission and vision decisions by a security key | 0.1.x | — | — | — | enforce |
| `health-ratchet` | Touched-scope health does not regress beyond tolerance ([health.md](tech-spec/health.md)) | 0.1.x | observe | advise | enforce | enforce |

In alpha.0 every rule runs at most in `advise`, whatever the level, because rule modes arrive in alpha.1.

The alpha.0 schema accepts only the fields alpha.0 reads (`standard`, `kit_path`, `paths`, `level`, `rules`, `specs`, `owners`, `checks`, `ci`, `stop`, `onboard`, `agents`, `protect`, `areas`); every other field arrives, as a minor schema version, with the packet that reads it (`0.1.x` `CP-0039` adds `health`, `checks.<name>.tool`, `suppression_patterns`). `init` writes at most 15 lines (`standard`, `level`, `owners`, `checks`, where `run` may name an existing script and `report` its format); everything else defaults. Unknown keys fail validation except `x-` keys. Packet branches are `tenet/<alias>-<slug>`.

### 6.2 Packs

A pack (`kit/packs/<name>/pack.yaml`) declares phases and stations, lanes, its claims with selectors, accepted methods per claim class, work types, decision defaults, loops and roles. **Pack-authoring contract:** every station names its exit claims; every claim has a selector, methods and a pass rule; every human gate names its decision and strength; a pack validates against `kit/schemas/pack.json` and passes `tenet check --pack`. Projects may only tighten it. **Pack file shape (alpha.0):** `pack`, `version`, `description`, `phases[]`, `stations[]` of `{id, phase}`, `loop_backs[]` of `{from, to}`, `lanes[]`, `human_touches` (lane → count), `work_types[]`, and `rules_alpha0[]` of `{id, observe, protect, verify, assure}`; `kit/packs/minimal/pack.yaml` is the reference. Claims, methods, strengths and loops join with CP-0049 and CP-0050.

**The `minimal` pack.** <!-- provisional --> Stations `intake → define → build → verify → integrate → close` (phases: define, build, verify, release); loop-backs `verify → build`, `integrate → build`. **Pull-request native** (catalog R-186): a quick change needs nothing from Tenet but its pull request; for careful or deep work `tenet new` creates the branch `tenet/<alias>-<slug>` and the packet folder and prints the command that opens the draft pull request (Tenet makes no network call, R-080; a host binding or engine may open it). A draft is Define, ready for review is Verify, merge is Integrate. Lanes: `quick`, `careful`, `deep` (set by risk or policy) and `express` (0.1.x, granted by CI). `explore` is a work type: no claims, and it cannot merge as production. Human touches: quick 0 (or 1 where policy requires), careful 1 (the definition approval, of acceptance items in plain words; merge is allowed by policy once claims hold), deep 2.

| Station exit | Claims applied (quick / careful) |
|---|---|
| intake | type and title set; no open duplicate |
| define | definition sections present; acceptance items with class, method, pass rule and case IDs; careful: pinned independent tests and a fresh `approve` of the definition |
| build | every task done; change size; protected paths |
| verify | every lane check; every acceptance item; distinguishing evidence per catalog R-172 (careful and deep: defect fixes and changes to existing behavior; advisory in quick); health indicators and continuing promises in scope (0.1.x); review converged where the lane requires a critic (advisory in 0.1.0) |
| integrate | all of verify, on the integrated subject (merge-queue candidate where used) |
| close | endpoint computed; preservation items become continuing promises (0.1.x) |

Express (0.1.x) is a lane granted by the attest job (catalog R-092). Endpoints: `checked`, `integrated`, `implemented-unverified`, `cancelled`, `superseded`; release endpoints with the standard pack.

### 6.3 The spec ladder

<!-- provisional --> The default ladder (R-207), relative to the records folder:

| Level | Documents | Changed by | Approved by |
|---|---|---|---|
| L0 | `vision.md` | decision-makers only | `amend-vision`, ratified from version 1 (`person-present`, twice on separate days, at `assure`) |
| L1 | `specs/prd.md` and its parts, the adopted standard with `tenet.yaml` | deltas in a pull request | `approve-spec-change` by the section's owner, `forge-verified` |
| L2 | `specs/tech-spec.md`, `specs/ux-spec.md`, `specs/plan.md` | deltas in a pull request | Sections marked `<!-- provisional -->` or `<!-- invariant -->`: as L1. Other sections: review with passing checks, the owner notified |
| L3 | `packets/<alias>-<slug>/` or the pull request | shaping and planning agents | review; `approve-definition` in the careful and deep lanes |
| L4 | code and tests | builders | the gate rule |

A starter project has one `intent.md`; `tenet split` moves a section into its own document; `init` offers document sets per project type (service, library, data pipeline, infrastructure, ML system). Spec deltas (per document, the IDs added, modified and removed, with the new text) ride in the pull request that needs them, or in a `spec` work item; the proof card shows them after the touched requirements and the gate requires the approval this table sets for each section. A section's owner is the one named in its front matter, else the owners on the last CODEOWNERS line matching its document (GitHub's rule), else the Owner. A change touching sections with different owners needs each of them; one person may cover several where authorized; the card lists what is still pending. A clarification (a pull request labelled `clarification` with no change in meaning) needs only review; a pull request mixing levels needs the strictest approval it touches. `tenet bless` bumps a document's `version` when any of its sections' blessed text changes; budgets are checked by `check` (§9). `tenet check` enforces R-209 and R-210: no change to L0–L2 without the approval above; IDs unique and resolved; every requirement has an origin and `serves`; every citation resolves at its recorded revision; every pull request or work item names what it implements; every blessed vision item (`V-…`) is served by a blessed requirement (`serves: V-…`) or named (`\bV-…\b`) in a bullet or table row under a blessed `## Not yet in scope` section (else `TN-SPEC-UNCOVERED-VISION` on the vision item's file and line, with the following proposal); the vision in force is its blessed copy (ratification is blessing at the strength this table sets for L0). Commits need no trailers. **Living specifications** (R-220): the proof card lists affected requirements and sections; agents propose deltas in the same pull request; a `garden` loop declared in the pack proposes fixes for sections flagged `sources-changed` and requirements without proving cases; the board counts spec debt.

**Proposal · CP-0066 AB-A7 (§6.3 coverage).** For blessed vision items served by a draft requirement and awaiting its blessing, report a single `TN-SPEC-VISION-WAITS-FOR-PRD` warning with no file or line. The message is `N vision items wait for a blessed requirement; bless the PRD next` (singular `1 vision item waits`). This warning does not affect the exit code. Uncovered vision items without a serving draft requirement still get `TN-SPEC-UNCOVERED-VISION`.

### 6.4 `factory.yaml` (execution plane, optional)

Workers (role, agent definition, model or harness, skills, tool grants), routing, environments (image, setup, network allowlist, secrets per worker; services, twins and observability from M2), identities, channels, triggers (M2), scorers and comparison suites (M2), critic model families and the engine adapter. Protected; recorded on every run; executed by engines and platforms.

### 6.5 Onboarding and blessing

In [tech-spec/onboarding.md](tech-spec/onboarding.md) §1, split under the rollover rule (L-0022).

## 7. Verification and authority

Every release uses one CI shape (DEC-48): a **test job** that runs the change's code and holds no write token, and a **recorder** that never runs the change, posts the proof card and keeps the records; at `verify` the test job is sealed and the recorder signs (the **attest job**). Jobs, workflows, records, the evidence store, decisions, trust observations, safe failure and the release procedure: [tech-spec/ci.md](tech-spec/ci.md).

### 7.1 Policy from the target

<!-- provisional --> Both jobs read the policy, lock, kit, checks and Tenet version from the target line, never from the change; the workflows install the version the target's lock names. Below `verify` a pull request can still change the workflow that tests it, so the card states when it differs from the target's and blocking there is detected (DEC-49).

## 8. Views

All views are reductions over events, pull-request state, evidence and policy for a named as-of time ("known in the refs read").

- **Proof card** (R-218; model and order in contracts §5): a check run named `Tenet` on every pull request's head (forks included), updated in place, naming the commit it tested (the merge candidate, head and base when they differ) and its evaluation. It opens with the blessed requirements the change touches (ALG-14), then each acceptance item with its tagged tests' counts and method ("test passed on this commit", "failed as expected on the base" in careful and deep lanes, "not run", "no test") and whether the tests were written in this change; test totals; weakening ("no weakening detected by these checks", or "not checked" for unreadable languages); protected files and blessings changed; spec deltas; what the rules would have blocked; the badge (`verified on CI`, `advisory`, `intent not yet blessed`) and "why", each reason labelled with its result class (DEC-49). On the onboarding pull request `tenet onboard --card` renders the blessing checklist instead (UX spec Part 1).

- **`board.json`** (schema in [contracts §5](tech-spec/contracts.md#5-proof-card-and-board-models); `tenet board --since <rev>` returns only changed items). In 0.1.0-alpha.0, `tenet board` (CP-0053) reads only the repository: specifications, their states and flags, the blessing queue and spec debt; pull requests and decisions join from alpha.1 through the records ref. `now.md` and a single-file `now.html` render it, opening on **waiting for you, blocked, and changed since you looked**, with flow, areas, campaigns and audit detail one level down; generated views are never committed (this repository's hand-written `now.md` is an M0 exception until CP-0053). A **fixture gallery** (`pkg/conformance/boards/`) holds boards for tentative moves, conflicts, waivers, flags and stale trust.
- **Flow and metrics.** Unit of delivery: the **verified change**: endpoint `checked` or `integrated`, every applicable claim satisfied, none waived as `accepted-without-verification`. Headline: lead time (median, 85th percentile, hours), verified changes per week by lane, lane mix against its target (default ≥70% quick or express), decision wait, cost per outcome unit with source, autonomy share beside escapes, kept promises and changeability. Attribution: `selected_by`, `authored_by`, `reviewed_by`, `authorized_by`, `released_by`, `human_edited`. Diagnostics: cycle time, flow efficiency, work in progress, funnels per work type, audited defect rate with bound, change failure and rework, durability, health trends and hotspots, check noise and run time, stuck-work recovery, time to first verified change, upgrade friction, conformance coverage, reviewer escape and false-blocker rates. Rules: sample sizes always, zeros with their bound, express separate, never rank people or agents by throughput.
- **Readiness** (`tenet doctor --readiness`, 0.1.x): per area, the readiness claim and what is missing.

## 9. Context budgets and rollover

<!-- provisional --> Budgets are estimated tokens (`Math.ceil(characters / 4)` over LF text). **Proposal · CP-0066 AB-A6.** For specification budgets, count only the Markdown body in both the base and the current file, excluding YAML front matter. Budgets by document: vision 4,000; PRD 9,000; catalog and each other PRD part 7,000; tech spec 12,000; UX spec 6,000; plan and each plan or tech-spec part 6,000; kernel Part I 8,000; `definition.md` 3,000; `AGENTS.md` 3,000 (block 1,500); assignment 20,000 per model family; `now.md` 6,000. Local `tenet check` warns (`TN-BUDGET-WARN`, exit 0) when `tokens >= Math.ceil(limit * 0.9)` and suggests `tenet split`; `--ci --base <rev>` emits `TN-BUDGET` only when `head_tokens > limit` and (`base` lacked the file or `base_tokens <= limit`); files under `archive/` are exempt. **Rollover:** archive the file unchanged to `archive/<path>@<version>.md`, then compact (keep a context card, everything open, one line per built or retired item with the obligations it imposes) or split an area over 40% into its own file with a moved-table; every ID and anchor must still resolve.

## 10. Commands

Global: `--json`, `--cwd`, `--quiet`, `--verbose`, `--offline`. Exit codes 0 success, 1 gate or check failed, 2 usage, 3 environment, 4 policy refusal.

Every command, its release, inputs, writes, `--json` schema, exit codes and idempotence: [contracts §8](tech-spec/contracts.md#8-commands). The README and UX spec take their release labels from that table.

`tenet check` covers structure, schemas, links, and the spec ladder's change control and traceability (§6.3), plus: kit integrity, generated drift, overlay narrowing, roster bound, separation of duties, deprecated use, citations and section states, event immutability, budgets, pinned skills, replay labels, alias uniqueness. Output follows R-083: plain words first, then `why:` with the rule ID, then `→` the fix; `--json` carries `errors: [{code, severity, rule, file, line, message, fix}]`, and `check` returns `result: {findings, summary}` (contracts §8). Structural findings (schemas, parsing, front matter, blessed-copy integrity) always exit 1; a registry rule's finding exits 1 only when that rule is in `enforce`; `budget` errors only in CI, on a change that takes a document past 100% (contracts §13).

## 11. Loops and bindings

Loops (`kit/loops/<name>.yaml`) use five step kinds (`agent`, `script`, `human_gate`, `set`, `route`): a station loop per station and lane, sharing the `fix` loop (until agreement or `limits.rounds`, whichever comes first; default 5). Format, assignment and result records, static checks and the worked `define` and `build` loops: [agents.md §5](tech-spec/agents.md#5-loops). 0.1.0 ships the `minimal` pack's loops.

| Binding | Emits | Release |
|---|---|---|
| `agents-md` | `AGENTS.md` block, skills in the open agent-skills format for each host, and the MCP server entry | 0.1.0 |
| Reference runner (`tenet-runner`) | Executes the shipped loops through host adapters ([agents.md §6](tech-spec/agents.md#6-adapters-and-the-reference-runner-010)) | 0.1.0 |
| `claude-code` | Agents, skills, managed settings keys, a pre-tool hook refusing protected writes | 0.1.x |
| Other hosts; engine adapters (`compile`, `start`, `status`, `cancel`, workspaces, usage, suspend and resume, `next`) | Per target | M3 |

Each binding publishes a per-capability enforcement table that feeds [ci.md §7](tech-spec/ci.md#7-trust-observations-and-guarantee-levels).

## 12. Install and upgrade

In [tech-spec/onboarding.md](tech-spec/onboarding.md) §2.

## 13. Conformance, red-team and self-verification

`pkg/conformance/` holds fixtures (inputs, expected decisions, events, board facts) for positive, refusal, overlapping selectors, unknown applicability, concurrent, late-arriving and interrupted cases; `red-team/` holds the R-106 cases with their declared levels; `reference/` holds the four R-009 cases. An independent reader (0.1.x) is written from the kernel text alone. **The evaluator is verified in stages** (catalog R-185): property tests over generated event histories in 0.1.0 (same verdict in any arrival order; evidence for one subject never satisfies another; late evidence never justifies an earlier decision; a waive never hides a claim outside its scope; a tentative move never satisfies a later gate; merging policies never loosens a claim), bounded model checking at M2, proofs optional later. Non-normative mappings (Part II): evidence to in-toto statements and SLSA summaries, events to CDEvents and CloudEvents, runs to OpenTelemetry GenAI spans.

## 14. Security

The [red-team catalog](../../pkg/conformance/red-team/catalog.yaml) maps R-106 and the threats below to their adoption levels and proving packets. [CI §7](tech-spec/ci.md#7-trust-observations-and-guarantee-levels) sets the trust and binding conditions for the levels shown here. Below verify, the host-driven CI binding reports findings at advisory or detected strength. Required merge status and current trust are separate prerequisites for enforced merge protection.

| Threat | Control | Level |
|---|---|---|
| Policy rewritten on the branch | Policy from the target; protected workflow source | enforced* |
| Forged or stolen evidence | Two jobs; evidence signed with the protected workflow's identity (fallback: a store only the attest job writes) | enforced* |
| Cache poisoning or artifact injection between jobs | No shared cache; bundle parsed as data; hardened reference workflow; red-team cases | enforced* |
| Code under test faking its result | Independent pinned tests, distinguishing evidence, review, external holdout | Mitigated. The check job alone provides no general guarantee of report truth |
| Gaming the checks (inserted skips, special-cased or deleted tests, substituted reports, planted test hooks) | Protected paths; case manifests (zero executed is inconclusive); report parsed from the check job only; red-team cases | enforced* for protected files; detected otherwise |
| Agent using the Owner's key or forge session | T4 declared and spot-checked; `bots[]` identities; replies bound to the evaluation the latest card showed; `person-present` for policy, permission, vision and deep-lane release | enforced* where a host binding attests separation; else detected |
| Hand-written or concurrent moves | `prev` chain, replay, conflict | enforced* |
| Earlier promises silently dropped | Continuing claims; protected proving cases; defeaters (0.1.x) | enforced* |
| Holdout leakage | External holdout with demonstrated access isolation | In-repo advisory. External holdout can be enforced* when the binding prevents builder access |
| Prompt injection | Rule of Two; trust-tagged inputs; read-only intake | as the host declares |
| Proof cheating | Theorem hash match, axiom allowlist, escape-hatch audit (M2) | enforced* |
| Malicious skill | Pinned by hash; reviewed in an agent packet | detected |

## 15. Testing

Unit tests per module; `npm run check:examples` over every published example; property tests of the evaluator (§13); golden boards byte-identical across platforms; end to end with a real git history and a real GitHub repository (`vedprakash-m/tenet-sandbox`) for the test job and recorder from alpha.0 plus a simulated CI; the red-team suite in CI; Windows, macOS and Linux; the R-082 workload including 10,000 event files on Windows; dogfooding from 0.1.0.
