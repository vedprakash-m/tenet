# Tenet technical specification

> Level L2 · Version 0.10 · Status: **draft, awaiting the Owner's approval** · Implements [prd.md](prd.md) and its parts · Parts: [contracts](tech-spec/contracts.md) (formats, interfaces, CI), [algorithms](tech-spec/algorithms.md), [onboarding](tech-spec/onboarding.md) · Normative until CP-0015 writes the kernel: this specification, its parts and the PRD; `kit/TENET.md` is superseded except where its banner says · Sections marked `<!-- provisional -->` are intended invariants: they need the Owner to change, and become `<!-- invariant -->` once the spikes (CP-0017, CP-0040, CP-0041) and the first implementation confirm them · Budget: 12,000 tokens · Previous version: `archive/specs/tech-spec.md@0.9.md`

**Context card.** Tenet is a spec process (§6.3) made checkable by seven record types and one container (§3) and one gate rule (§4). Every feature in the catalog is a standard type of one of them, declared by a pack (§6). The CLI and SDK append events, the CI verifier produces evidence (§7), and every view is a reduction over events (§8). How strict any of this is depends on the project's `level` and each rule's mode (§6.1). Policy always comes from the target line and is judged against the snapshot recorded at decision time. Every rule states its guarantee and the trust assumptions behind it.

## 1. Architecture

The tooling reads and writes files and git: no server, no database, no model client. Record paths are relative to the records folder (`paths.records`, default `tenet/`).

| Directory | Holds | May import |
|---|---|---|
| `src/types/` | TypeScript types generated from `kit/schemas/` | nothing |
| `src/core/` | `fs`, `yaml`, `schema`, `git`, `hash` (SHA-256, RFC 8785, ULID, alias), `output`, `clock`, `sign` | `types` |
| `src/policy/` | `tenet.yaml`, lock, kit, levels and rules, policy from the target | `types`, `core` |
| `src/specs/` | Parsing, sections and digests, citations, flags, deltas, `fix`, `split` | `types`, `core`, `policy` |
| `src/onboard/` | Preflight, inventory, drafting assignment, `bless`, refresh | `types`, `core`, `policy`, `specs` |
| `src/context/` | Context selection and budgets | `types`, `core`, `policy`, `specs` |
| `src/reports/` | Test-report readers, the acceptance block, weakening | `types`, `core` |
| `src/kernel/` | Subjects, events, reduction, gate, replay, decisions (alpha.1) | `types`, `core`, `policy` |
| `src/verify/` | The proof job, check and attest jobs, the forge binding | all above except `install`, `mcp` |
| `src/views/` | Boards and their renderings | `types`, `core`, `policy`, `specs`, `kernel` |
| `src/mcp/` | The local MCP server | `types`, `core`, `policy`, `specs`, `context`, `views` |
| `src/install/` | `init`, manifest, hosts, `upgrade`, `remove` | all above except `verify` |
| `src/sdk.ts`, `src/cli.ts` | Public API; commands | all |

Every SDK function takes `{cwd, stdin, stdout, now}` so tests are deterministic.

**Runtime.** <!-- provisional --> TypeScript compiled to ESM, Node 22 LTS or later, no native modules; runtime dependencies limited to `yaml`, `ajv`, `ajv-formats`, `commander`, `picomatch`, `fast-xml-parser` (adding one needs a spec packet); `git` 2.40+ and OpenSSH 8.9+.

**Scale tiers** (catalog R-167): tier 1 event files in git (about 50 changes a week); tier 2 git with closed packets compacted into one `events.jsonl` each and evidence on the evidence store (about 1,000 a week); tier 3 an external append-only store under the same schemas and replay rules (M3–M4). Revisions are content-addressed IDs, so a non-git history can supply equivalent evidence.

## 2. Repository and package

<!-- provisional --> **The folder that ships is the folder that is loaded.** `kit/` is `kit/` in the package; a project loads it from the installed package and checks it against `tenet.lock`, or, with `init --vendor`, keeps a file-for-file copy in `.tenet/kit/`.

```text
tenet/  README.md LICENSE CONTRIBUTING.md AGENTS.md CLAUDE.md package.json tsconfig.json tenet.yaml
  kit/   SHIPPED AND VENDORED: TENET.md, CHANGELOG.md, schemas/, defaults/, templates/, packs/,
         agents/, criteria/, skills/, loops/; kit.json generated at release
  pkg/   SHIPPED, NOT VENDORED: migrations/, conformance/ (red-team, reference cases), evals/, hosts/
  src/ test/ docs/ examples/minimal/
  tenet/ this repository's records (self-hosting: kit_path: kit, no lock)
```

Package: `"bin": {"tenet": "dist/cli.js"}`, `"exports": {".": "./dist/sdk.js"}`, `"files": ["dist","kit","pkg"]`; published to npm as `@vedprakash-m/tenet` with provenance from 0.1.0-alpha.0; each GitHub release also carries the prebuilt package (`.tgz`), a kit archive and `SHA256SUMS`, so nothing is built on a user's machine. Home: `github.com/vedprakash-m/tenet`. Documented commands always pin a release (`npx -y @vedprakash-m/tenet@<version>`), never a branch. Node projects add it as a dev dependency and others install it globally, so `tenet` stays on the path; MCP entries run the pinned package, so they work either way. A template repository, `vedprakash-m/tenet-starter`, holds a new project's starting files (`tenet.yaml`, `tenet.lock`, `AGENTS.md`, `tenet/intent.md`, the workflow). Standalone binaries are attached to each GitHub release from 0.1.x. The repository's README opens with the ways in from UX spec Part 0.

## 3. The seven primitives

<!-- provisional --> These are the only normative record types. All are YAML or JSON validated by `kit/schemas/`; timestamps are UTC RFC 3339 with seconds; hashes are full and algorithm-tagged.

| Primitive | Shape | Notes |
|---|---|---|
| **Subject** | `{kind, digest, base?}` | `git-tree`: the tree SHA of tracked code, excluding the records folder, `.tenet/` and generated views (ALG-01). Check inputs (definition, runner image, lockfile) are recorded on evidence, never in the subject, so every check and decision on one commit share it. `file-set`: SHA-256 over sorted `path\0blob-sha`. `section`: a level-2 section of a specification (ALG-02). `area`: a named path set from the policy. Further kinds are pack data (artifact, deployment, config, data, flag, platform object, multi-repo, agent definition) |
| **Actor** | `{id, kind: person \| agent \| service, roles, keys, chain?}` | People and keys are listed in the policy; runs record the chain initiator → agent → subagent → tool with scope and expiry |
| **Claim** | `{id, type, selector: {station?, lane?, work_type?, paths?, areas?}, class, methods[], pass_rule, lifetime: packet \| continuing, owner, waivable, state?}` | `type` names a catalog entry. `methods`: any one satisfies; separate claims are all required. `pass_rule`: binary, baseline-relative (`{rule, tolerance}`) or probabilistic (`{rate, runs}`). `state` for continuing claims: `held`, `stale`, `defeated` (0.1.x) |
| **Evidence** | `{id, subject, claims, kind, method, cases: {expected, executed, passed, skipped}, result, strength: {provenance, independence}, producer, inputs, valid_until?, payload, identity}` | `result`: pass, fail, inconclusive, skipped, unknown. `producer`: `{source: ci \| local, verifier version, policy revision, workflow run}`. `inputs`: digests of runner image, lockfile and check definition. `identity`: the producing job's proof (§7.3). Payloads by kind in §3.1 |
| **Decision** | `{id, kind: approve \| waive \| choose \| delegate \| resolve, subject, target, scope, expiry?, reason, risk_reasons?, actor, proof: {strength, via, policy_revision}, sig?}` | `target` is the claim, request, right or conflict it acts on. Every named decision in the catalog (change-policy, accept-findings, quarantine-check, accept-health-regression, retire-obligation, campaign approval…) is one of the five kinds with a `name` |
| **Event** | `{id: ULID, prev: [ID], type, work, time, by, data, sig?}` | One immutable file per event. `prev` lists every event the writer saw as latest (empty when created; two or more for a `resolve`); §5 |
| **Policy** | `tenet.yaml`, the lock, packs and the optional `factory.yaml` | Read from the target line; §6 |

A **work item** (packet) is the one container: `packets/<alias>-<slug>/` holds `packet.yaml` (identity only: alias, ULID, title, type, work type, parent campaign if any, created), `definition.md` (intent and its claims), `tasks.yaml`, `log.md`, `events/` and `escalations/`. Dependencies (`depends_on`) are `work.changed` data. A campaign is a work item with children. A **quick change has no folder**: its pull request is the work item `pr-<number>`, its description holds intent and acceptance items (contracts §2), and the proof job records its state under `works/pr-<number>/` on the records ref. Event files that do exist are marked `linguist-generated` in `.gitattributes` so reviews collapse them.

**Minimal valid records** (R-205): Subject `{kind, digest}`; Actor `{id, kind}`; Claim `{id, type, selector}`; Evidence `{subject, claims, method, result, producer}`; Decision `{kind, subject, target, actor, proof}`; Event `{id, prev, type, work}`; Policy `{standard, pack}`. Every other field is optional with a stated default.

### 3.1 Evidence kinds and completion

Payloads and completion rules per kind (check, measurement, attestation, observation, review, proof, simulation, differential): [contracts §12](tech-spec/contracts.md#12-evidence-payloads).

**Methods** (catalog R-174) are never ranked globally; a pack lists which satisfy each claim class and lane. Formal evidence states its coverage (trials, bounded, proved) and `correspondence` (`none`, `sampled`, `proved`). A distinguishing check's baseline must fail with the expected `failure_id`; a harness failure is inconclusive. **Case IDs** come from a tag in the test name (`[AB-1]`) or a report property (JUnit `tenet.case`, CTRF `extra.tenet_cases`).

**Strength** (R-034) has two ordered axes: provenance `local < ci < ci-observed`; independence `self < same-definition < different-definition < different-model-family < person`. A missing value counts as the lowest; `self` never satisfies a claim. Methods are not ranked: a pack lists which are admissible for each claim class. Policy sets the minimum per axis by claim class and lane (`strength` in §6.1); defaults: `ci` and `same-definition` for quick, `different-definition` for acceptance items in the careful lane.

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

The gate returns, separately: each claim's result; the **verdict** (refuse, human gate, advance); the rule modes applied; the actual **disposition** (blocks or not); the **next action** and who takes it; and a reason ID per result. Unknown applicability, frozen work, stop thresholds, advisory failures, approvals that do not replace evidence, and incompatible policies each have their own row. The full decision table and fixtures are [ALG-07](tech-spec/algorithms.md#alg-07). The same history and evaluation instant always yield the same result.

A refusal blocks only when the rule's mode is `enforce` (§6.1); in `observe` and `advise` the verdict is recorded and shown as "would have blocked". Every evaluation appends a `gate` event recording the verdict, the **argument** (for each claim, the pack rule ID and the evidence or decision that satisfied it) and the **snapshot** used: policy revision, evidence-store revision, trust observation. The rule's own level: detected when only a host evaluates it locally, enforced* through CI replay and the required status (§7.5). Replay re-evaluates against that snapshot; `tenet board --reevaluate` (M2) shows what today's policy would say, separately.

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

Reduction, the conflict table per event family and duplicate handling are [ALG-05](tech-spec/algorithms.md#alg-05): reduction is topological over `prev`, ties by `id`; two incompatible **state** events not causally ordered put the work item in `conflict` until a `resolve` (whose `prev` names both) keeps one; note events never conflict. Each `gate` event records `evaluated_at`; replay uses it, and evaluation "as of now" is a separate call. The attest job **replays** every changed work item and labels each state event `justified`, `pending-evidence` or `unjustified` (the last fails the job). A pending move is **tentative**: the board shows it so, no later gate counts it, and it becomes `unjustified` after `replay.pending_hours` (default 24). Resuming an interrupted station reads the latest events and runs and never repeats a recorded step. In pull-request native mode forge state (ready for review, merged, closed) becomes `work.moved` and `work.closed` events: recorded by the proof job on the records ref from alpha.1, signed by the attest job on the evidence store from alpha.2; agents call `tenet move` only for loop-backs and work off the forge. A modified or deleted event, or a reused ID with different content, is a `tenet check` error. A git-ignored cache may speed reductions but never changes a result.

## 6. Policy

### 6.1 `tenet.yaml` (governance plane)

| Field | Default | Meaning |
|---|---|---|
| `standard`, `kit_path`, `paths.records` | `~<minor>` (npm tilde range), `null` (load from the installed package), `tenet` | Accepted version range; a vendored kit's folder (`.tenet/kit` with `init --vendor`; `kit` when self-hosting); records location |
| `level` | `observe` | `observe`, `protect`, `verify` or `assure` (R-214); sets each rule's default mode, the proof table and which trust assumptions are required |
| `rules` | from `level` | `{<rule-id>: observe \| advise \| enforce}` overrides one rule of the registry below; promoting a rule is a decision |
| `specs` | the ladder in §6.3 | Documents per level, their owners and budgets; projects may add documents, never loosen a level |
| `pack` | `minimal` | Lifecycle pack or a path to one |
| `owners[]`, `bots[]` | — | `{id, name, roles, keys: [{public_key, added, revoked?}], forge_accounts}`; `id` is the signing principal. `bots` (from `verify`): the forge identities agents act as (trust assumption 4) |
| `decision_rights`, `proof` | pack defaults | Who may decide what; the proof table (§7.4) |
| `approvals` | `{express: 0, quick: 0, careful: 1, deep: 2, protected: forge-verified}` (`person-present` at `assure`) | Human decisions by lane (catalog R-145) |
| `strength` | pack defaults | Minimum `{provenance, independence}` per claim class and lane (§3.1) |
| `replay.pending_hours` | 24 | How long a move may stay tentative |
| `checks` | — | `{<name>: {run, report: junit \| ctrf \| go-test-json \| jest-json \| none, report_path, inputs, owner, timeout_minutes}}`; `run` includes any reporter flags (contracts §6); the only commands evidence may come from |
| `lane_checks`, `size_limits`, `express` | pack defaults | Required checks per lane; change-size claims; express limits |
| `protect` | pack defaults | Extra protected paths and keys |
| `health` | none | `{indicators: {<name>: {check, metric, rule, tolerance, scope, area}}}` |
| `areas` | from CODEOWNERS | `{<name>: {paths, owners, decision_rights, wip}}`; when absent, each CODEOWNERS entry is an area with its owners |
| `board.refs`, `trust`, `holdout`, `context_budgets` | §8, §7, R-104, §9 | Board inputs; evidence ref and forge; holdout mode; budgets |

**Rule registry and level defaults.** <!-- provisional -->

| Rule | Checks | From | observe | protect | verify | assure |
|---|---|---|---|---|---|---|
| `tests-not-weakened` | No test deleted or skipped (ALG-09) | alpha.0 | advise | enforce | enforce | enforce |
| `protected-surfaces` | Trust-surface files change only with `change-policy` | alpha.0 | advise | enforce | enforce | enforce |
| `acceptance-proven` | Every acceptance item proven on the tested commit | alpha.0 | advise | advise | enforce | enforce |
| `citations-valid` | Every citation resolves (ALG-04) | alpha.0 | advise | advise | enforce | enforce |
| `budget` | Documents within budget (§9) | alpha.0 | advise | advise | advise | enforce |
| `spec-approval` | L0–L2 changes carry the approval §6.3 requires | alpha.1 | advise | enforce | enforce | enforce |
| `distinguishing-evidence` | Careful and deep: defect fixes fail on the base (R-172) | 0.1.0 | observe | advise | enforce | enforce |
| `signed-evidence` | Evidence signed by the attest job | alpha.2 | — | — | enforce | enforce |
| `person-present-policy` | Policy, permission and vision decisions by a security key | 0.1.x | — | — | — | enforce |

In alpha.0 every rule runs at most in `advise`, whatever the level, because rule modes arrive in alpha.1.

`init` writes at most 15 lines (`standard`, `level`, `owners`, `checks`, where `run` may name an existing script and `report` its format); everything else defaults. Unknown keys fail validation except `x-` keys. Packet branches are `tenet/<alias>-<slug>`.

### 6.2 Packs

A pack (`kit/packs/<name>/pack.yaml`) declares phases and stations, lanes, its claims with selectors, accepted methods per claim class, work types, decision defaults, loops and roles. **Pack-authoring contract:** every station names its exit claims; every claim has a selector, methods and a pass rule; every human gate names its decision and strength; a pack validates against `kit/schemas/pack.json` and passes `tenet check --pack`. Projects may only tighten it.

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

A starter project has one `intent.md`; `tenet split` moves a section into its own document; `init` offers document sets per project type (service, library, data pipeline, infrastructure, ML system). Spec deltas (per document, the IDs added, modified and removed, with the new text) ride in the pull request that needs them, or in a `spec` work item; the proof card shows them first and the gate requires the approval this table sets for each section. A section's owner is the one named in its front matter, else the owner of the longest matching CODEOWNERS path of its document, else the Owner. A change touching sections with different owners needs each of them; one person may cover several where authorized; the card lists what is still pending. A clarification (a pull request labelled `clarification` with no change in meaning) needs only review; a pull request mixing levels needs the strictest approval it touches. Integrate applies them, bumps versions and checks budgets (§9). `tenet check` enforces R-209 and R-210: no change to L0–L2 without the approval above; IDs unique and resolved; every requirement has an origin and `serves`; every citation resolves at its recorded revision; every pull request or work item names what it serves and implements; every active vision item is covered or marked not yet in scope; `vision.md` matches its latest ratified version. Commits need no trailers. **Living specifications** (R-220): the proof card lists affected requirements and sections; agents propose deltas in the same pull request; a `garden` loop declared in the pack proposes fixes for sections flagged `sources-changed` and requirements without proving cases; the board counts spec debt.

### 6.4 `factory.yaml` (execution plane, optional)

Workers (role, agent definition, model or harness, skills, tool grants), routing, environments (image, setup, network allowlist, secrets per worker; services, twins and observability from M2), identities, channels, triggers (M2), scorers and comparison suites (M2), critic model families and the engine adapter. Protected; recorded on every run; executed by engines and platforms.

### 6.5 Onboarding and blessing

In [tech-spec/onboarding.md](tech-spec/onboarding.md) §1, split under the rollover rule (L-0022).

## 7. Verification and authority

§7.1 always applies; §7.2–§7.5 apply from the `verify` level. Before it, the **proof job** runs the checks in ordinary CI, posts the proof card (§8) as advisory and keeps unsigned records on `refs/tenet/records`; which component does what in each release is [contracts §7](tech-spec/contracts.md#7-ci-and-ownership-by-release).

### 7.1 Policy from the target

<!-- provisional --> Both CI jobs read the policy, lock, kit, checks and Tenet version from the target line, never from the change; the workflow installs the version the target's lock names. **First policy:** at `observe` and `protect`, when a pull request adds a check the target does not have yet, the proof job may run it labelled "proposed check · approve tenet.yaml to pin"; at `verify` and `assure` an unpinned check never runs.

### 7.2 Two jobs

| Job | Does |
|---|---|
| `tenet verify --run-checks` (no credentials, read-only, network denied by default, environment-variable allowlist, no cache shared with the attest job, runner image recorded) | Runs pinned checks; computes the subject before and after each (changed tracked files make a check inconclusive); passes only on exit code 0 with a valid report; writes a bundle outside the working tree |
| `tenet verify --attest` (never runs the change, restores no cache) | Recomputes the subject; accepts bundles only from the same workflow run and parses them as data; evaluates protected paths against the target; replays events; signs evidence and observations and writes them to the evidence store; records forge state changes; posts commit status and decision requests on the pull request; reads forge-verified approvals and writes them to the evidence store; observes trust assumptions; verifies merge-queue candidates; on main publishes `board.json` |

**Honest limit.** A check that runs the change's code can be subverted by that code. The two jobs keep that code away from credentials, policy and the evidence store; independent tests, distinguishing evidence, review and external holdout cover the rest.

**Reference workflow.** Tenet ships one hardened workflow file: two jobs, minimal explicit permissions, triggered so it runs from the target line. Editing it is `change-policy`. GitHub specifics in §7 are the reference binding; the kernel names only the properties (signed provenance, merge requires status, attributable decisions).

### 7.3 Evidence store

Each evidence record carries a **signature only the protected attest job can make**, so it verifies wherever it is stored and for as long as it is kept. CP-0040 chooses the default per repository type among: (a) a public signing service with a transparency log (Sigstore; GitHub artifact attestations) for public repositories, or private ones where the forge offers it (on GitHub, Enterprise Cloud); public logs reveal the repository name, so private repositories never use them without consent (V-B5); (b) a signing key held as a secret only the protected workflow on the target branch can read, its public half pinned in `tenet.yaml`; (c) the forge's OIDC token with the record's digest as audience, verified when recorded, with the verification and the key it used kept on the board (short-lived tokens and rotating keys make later re-verification unreliable). Records live at `refs/tenet/evidence` under `<subject-digest>/<id>.json` (fetch, rebuild and retry on concurrent writes); being able to write the ref is not enough to forge one. If no option works, the fallback is a store only the attest job can write (a protected `tenet-evidence` branch or a separate repository). Fork pull requests get a status only; the main-line run records evidence after merge.

### 7.4 Decisions and proof

| Decision (name → kind) | Required strength |
|---|---|
| `change-policy` (approve), `widen-permission` (approve), `amend-vision` (approve), `release` in the deep lane (approve) | `person-present` at `assure`; `forge-verified` otherwise |
| `approve-spec-change` (approve), `approve-definition` (approve), `accept-findings` (waive), `accept-risk` (waive), `override` (waive), `quarantine-check` (waive), `accept-health-regression` (waive), `replace-proving-case` (approve), `retire-obligation` (approve, by the promise's owner), `release` (approve), campaign approval (approve), `resolve-conflict` (resolve), `delegate` (delegate) | `forge-verified` |

`forge-verified` means **attributable to the decision-maker's forge account**: a native approving review whose commit is the current subject (the primary path), or a reply (`/tenet approve`, `/tenet pick <n>`, `/tenet bless <section>`) that binds the commit the latest proof card showed and is refused only if commits landed after that card (an `@<digest>` suffix is optional, and required at `assure`), by an account listed in `owners[].forge_accounts`, recorded by the attest job. The attest job records the two-factor status as `enforced`, `not-enforced` or `unobservable` (personal repositories; a token without the needed scope) and shows it with the strength. A pull-request author cannot approve their own pull request on most forges, so from `verify` agents open pull requests as a `bots[]` identity, or the decision-maker uses the comment form; below `verify` the Owner may accept their own work, labelled `self-accepted`. The attest job flags a decision by an account on a pull request authored by that account's agent session; unless a host binding attests that agents run without decision-makers' credentials (trust assumption 4), `forge-verified` counts as detected, not enforced*. `person-present`: an `ssh-keygen -Y` signature over the canonical decision by a security key whose presence can be read from the signature (CP-0017); key type alone never proves presence. `key` and `channel` answers are recorded and count as advisory. Decisions are fresh only while their subject is current; an option that changes scope carries the replacement digest or returns to Define. Revoking a key is a policy change; earlier signatures stay valid.

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

### 7.6 Safe failure

| Control cannot run | `observe`, `protect` | `verify`, `assure` |
|---|---|---|
| CI unavailable or a check times out | Proof card says "not checked"; nothing blocks | Every change holds; an override is a waiver recorded as `accepted-without-verification`, never `verified` |
| Signature or verification key unavailable | Not applicable | Evidence shown as `unsigned`, counts as detected |
| Review or decision unobservable | Recorded as `unknown` | The decision is asked again |
| Policy or kit fails to load | Warning; previous policy used and named | The attest status fails with the reason |

Nothing silently passes: every degraded result is labelled on the proof card and the board.

## 8. Views

All views are reductions over events, pull-request state, evidence and policy for a named as-of time ("known in the refs read").

- **Proof card** (R-218; content model in contracts §5): a check run named `Tenet` per same-repository pull request (a job summary for forks), updated in place, naming the commit it tested (the merge candidate, head and base when they differ) and the acceptance text's digest. Each acceptance item states its method: "test passed on this commit", "failed as expected on the base" (careful and deep lanes), or unproven. Then: weakening found from the diff ("no weakening detected by these checks"); protected surfaces touched; spec deltas and affected sections; what the built-in rules would have blocked; the badge (`verified on CI`, `advisory`, `self-accepted`, `intent not yet blessed`) with "why". Test results come from the readers in contracts §6. Fork pull requests get a labelled status. On the onboarding pull request the card becomes the blessing checklist (UX spec Part 1).

- **`board.json`** (schema in [contracts §5](tech-spec/contracts.md#5-proof-card-and-board-models); `tenet board --since <rev>` returns only changed items). In 0.1.0-alpha.0, `tenet board` (CP-0053) reads only the repository: specifications, their states and flags, the blessing queue and spec debt; pull requests and decisions join from alpha.1 through the records ref. `now.md` and a single-file `now.html` render it, opening on **waiting for you, blocked, and changed since you looked**, with flow, areas, campaigns and audit detail one level down; generated views are never committed (this repository's hand-written `now.md` is an M0 exception until CP-0053). A **fixture gallery** (`pkg/conformance/boards/`) holds boards for tentative moves, conflicts, waivers, flags and stale trust.
- **Flow and metrics.** Unit of delivery: the **verified change**: endpoint `checked` or `integrated`, every applicable claim satisfied, none waived as `accepted-without-verification`. Headline: lead time (median, 85th percentile, hours), verified changes per week by lane, lane mix against its target (default ≥70% quick or express), decision wait, cost per outcome unit with source, autonomy share beside escapes, kept promises and changeability. Attribution: `selected_by`, `authored_by`, `reviewed_by`, `authorized_by`, `released_by`, `human_edited`. Diagnostics: cycle time, flow efficiency, work in progress, funnels per work type, audited defect rate with bound, change failure and rework, durability, health trends and hotspots, check noise and run time, stuck-work recovery, time to first verified change, upgrade friction, conformance coverage, reviewer escape and false-blocker rates. Rules: sample sizes always, zeros with their bound, express separate, never rank people or agents by throughput.
- **Readiness** (`tenet doctor --readiness`, 0.1.x): per area, the readiness claim and what is missing.

## 9. Context budgets and rollover

<!-- provisional --> Budgets are estimated tokens (characters ÷ 4): vision 4,000; PRD 9,000; catalog and each other PRD part 7,000; tech spec 12,000; UX spec 6,000; plan and each plan or tech-spec part 6,000; kernel Part I 8,000; `definition.md` 3,000; `AGENTS.md` 3,000 (block 1,500); assignment 20,000 per model family; `now.md` 6,000. `tenet check` warns at 90% and suggests `tenet split`; CI errors only on a change that takes a document past 100%; files under `archive/` are exempt. **Rollover:** archive the file unchanged to `archive/<path>@<version>.md`, then compact (keep a context card, everything open, one line per built or retired item with the obligations it imposes) or split an area over 40% into its own file with a moved-table; every ID and anchor must still resolve.

## 10. Commands

Global: `--json`, `--cwd`, `--quiet`, `--verbose`, `--offline`. Exit codes 0 success, 1 gate or check failed, 2 usage, 3 environment, 4 policy refusal.

Every command, its release, inputs, writes, `--json` schema, exit codes and idempotence: [contracts §8](tech-spec/contracts.md#8-commands). The README and UX spec take their release labels from that table.

`tenet check` covers structure, schemas, links, and the spec ladder's change control and traceability (§6.3), plus: kit integrity, generated drift, overlay narrowing, roster bound, separation of duties, deprecated use, citations and section states, event immutability, budgets, pinned skills, replay labels, alias uniqueness. Output follows R-083: plain words first, then `why:` with the rule ID, then `→` the fix; `--json` carries `{file, line, rule, message, fix}`.

## 11. Loops and bindings

Loops (`kit/loops/<name>.yaml`) use five step kinds (`agent`, `script`, `human_gate`, `set`, `route`) and are compiled per station. 0.1.0 ships `station` and `fix` (capped at `limits.fix_rounds`, default 2). Static checks: creator steps followed by inspection; counters only increase within a total cap; routes follow §4; human gates list stop first and resolve through `tenet decide`; critics have no write tools and run after checks.

| Binding | Emits | Release |
|---|---|---|
| `agents-md` | `AGENTS.md` block, skills in the open agent-skills format for each host, and the MCP server entry | 0.1.0 |
| `claude-code` | Agents, skills, managed settings keys, a pre-tool hook refusing protected writes | 0.1.x |
| Other hosts; engine adapters (`compile`, `start`, `status`, `cancel`, workspaces, usage, suspend and resume, `next`) | Per target | M3 |

Each binding publishes a per-capability enforcement table that feeds §7.5.

## 12. Install and upgrade

In [tech-spec/onboarding.md](tech-spec/onboarding.md) §2.

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
| Agent using the Owner's key or forge session | T4 declared and spot-checked; `bots[]` identities; replies bound to the latest card; `person-present` for policy, permission, vision and deep-lane release | enforced* where a host binding attests separation; else detected |
| Hand-written or concurrent moves | `prev` chain, replay, conflict | enforced* |
| Earlier promises silently dropped | Continuing claims; protected proving cases; defeaters (0.1.x) | enforced* |
| Holdout leakage | External holdout | enforced* if external |
| Prompt injection | Rule of Two; trust-tagged inputs; read-only intake | as the host declares |
| Proof cheating | Theorem hash match, axiom allowlist, escape-hatch audit (M2) | enforced* |
| Malicious skill | Pinned by hash; reviewed in an agent packet | detected |

## 15. Testing

Unit tests per module; property tests of the evaluator (§13); golden boards byte-identical across platforms; end to end with a real git history and a real GitHub repository for the two-job workflow (0.1.0 release gate) plus a simulated CI; the red-team suite in CI; Windows, macOS and Linux; the R-082 workload including 10,000 event files on Windows; dogfooding from 0.1.0.
