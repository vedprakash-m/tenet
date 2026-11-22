# Tenet product requirements

> Level L1 · Version 0.1 · Status: **draft, awaiting the Owner's approval** · Serves [vision.md](../vision.md) · Normative standard: [standard/TENET.md](../standard/TENET.md)

## 1. Scope

**Tenet is a standard for governed, spec-driven software factories, and the minimum tooling that lets a project adopt it, enforce it and stay current with it.** This document covers what is built and the next milestones. It does not restate the standard; it specifies the deliverables that carry it.

| In scope | Out of scope |
|---|---|
| The normative standard and its versioning | A hosted service, dashboard or account system |
| The kit: schemas, templates, reference agent definitions, criteria, loop definitions, evaluation suites | Running models; the CLI never calls one |
| A deterministic CLI that installs, enforces, records, reports, upgrades and compiles | An orchestration engine of its own |
| Compilers from loop and agent definitions to engines and hosts | Host-specific products (those are implementations, such as Tenet for Copilot) |
| A conformance kit for projects and implementations | Certifying third parties |
| Documentation sufficient to adopt by hand | Paid support, training, marketplace |

**Relationship to other repositories.** Tenet for Copilot (`tenet-copilot`) is an implementation that will declare conformance; it is not changed by this project. govaut supplied the agent-governance patterns and the reference loop shape. Torus is the first subscribing project after this repository itself.

## 2. Users

| Persona | Needs | Primary deliverables |
|---|---|---|
| **Owner** (one person running a project with agents) | Adopt in an afternoon; see the floor; decide only what needs them; never hand-merge standard updates | CLI, kit, board, upgrade flow |
| **Agent** (a model working inside a host or engine) | An unambiguous assignment, the rules for its station, a way to record results that the tooling accepts or refuses | Agent definitions, assignment and result contracts, CLI |
| **Implementer** (builds a product on the standard) | A precise standard, stable schemas, a conformance kit, a versioning promise | Standard, schemas, conformance kit |
| **Steward** (maintains the standard) | Propose, test and release changes to the standard safely | This repository run under its own rules |

## 3. Deliverables

| ID | Deliverable | Ships as | Milestone |
|---|---|---|---|
| D1 | **Normative standard** (`standard/TENET.md`) with stable rule IDs from 1.0 | File in the package; rendered on the documentation site | M0 draft; 1.0 at M4 |
| D2 | **Kit**: schemas, templates, reference agent definitions, judge protocol, criteria, loop definitions, reference evaluation suites | Files in the package, vendored into `.tenet/kit/` | M1 |
| D3 | **CLI** `tenet` | The same npm package, run with `npx` | M1 onward |
| D4 | **Loop compiler** to Conductor workflows | `tenet build --target conductor` | M3 |
| D5 | **Host compilers** to Claude Code and Copilot agent files, skills, commands and hooks | `tenet build --target claude-code` / `copilot` | M3 |
| D6 | **Conformance kit** for projects and implementations | `tenet conform` and test fixtures in the package | M4 |
| D7 | **Documentation**: quick start, adoption guide, reference | Markdown in the repository; static site at M4 | M1 onward |

## 4. Requirements

Status values: `proposed` (in this draft), `approved` (the Owner approved this document), `built` (proving cases pass in CI). Every requirement `serves` vision items. Rule IDs for the standard are assigned before 1.0 (PQ-07).

### 4.1 Standard

| ID | Requirement | Serves | Milestone | Status |
|---|---|---|---|---|
| R-001 | The standard is one Markdown document with numbered sections, published with a semantic version | V-P4, V-V4 | M0 | proposed |
| R-002 | Every normative statement uses "must", "must not" or "may" in its final wording, and carries a stable rule ID (`TN-<section>-<n>`) from 1.0 | V-V4, V-M6 | M4 | proposed |
| R-003 | The standard names no tool, model or vendor as a requirement; examples and mappings are marked non-normative | V-P4, V-B1 | M0 | proposed |
| R-004 | Each release has a changelog entry listing added, changed, deprecated and removed rules, and the migrations it ships | V-V3, V-B6 | M1 | proposed |
| R-005 | A rule or schema field is deprecated for at least one minor version before removal | V-B6 | M1 | proposed |

### 4.2 Kit

| ID | Requirement | Serves | Milestone | Status |
|---|---|---|---|---|
| R-010 | JSON Schemas (draft 2020-12) exist for `packet.yaml`, agent-definition front matter, `tenet.yaml`, `tenet.lock`, receipts, run records, assignments, results, ledger-entry front matter and `tenet-conformance.yaml` | V-V4, V-P2 | M1 | proposed |
| R-011 | A template exists for every document type the standard defines: vision, PRD, tech spec, UX spec, plan, packet files, escalation, ledger entry, holdout scenario, agent definition | V-V3, V-P7 | M1 | proposed |
| R-012 | Reference agent definitions exist for every role in the standard roster, following the fixed anatomy, each with `status: draft` until qualified | V-V1, V-P3 | M1 | proposed |
| R-013 | One shared judge protocol and one criteria file per specialist critic are shipped; critics differ only by criteria | V-P3 | M1 | proposed |
| R-014 | The station loop ships as one engine-neutral loop definition using only the step kinds `agent`, `script`, `human_gate`, `set`, `route` | V-P4, V-H2 | M1 | proposed |
| R-015 | A reference evaluation suite of at least 5 cases ships for the builder, the judge and the verifier | V-H4 | M5 | proposed |

### 4.3 CLI: install and adopt

| ID | Requirement | Serves | Milestone | Status |
|---|---|---|---|---|
| R-020 | `tenet init` creates a conforming skeleton in an empty or new repository: profile, lock, vendored kit, document templates, generated `AGENTS.md` block, hooks, CI check, update-bot configuration | V-V3 | M1 | proposed |
| R-021 | `tenet adopt` adds the same files to an existing repository without modifying any existing file outside generated blocks, and imports open issues as Intake packets when an issue source is configured | V-V3, V-P7 | M1 | proposed |
| R-022 | `init` and `adopt` are idempotent: a second run changes nothing and says so | V-B6 | M1 | proposed |
| R-023 | Every file written by `init`, `adopt` or `upgrade` is listed in the command's output and in the resulting `ops` packet | V-B3 | M1 | proposed |

### 4.4 CLI: work and evidence

| ID | Requirement | Serves | Milestone | Status |
|---|---|---|---|---|
| R-030 | `tenet new <type> "<title>"` creates a packet folder at Intake with the next free ID | V-P5 | M1 | proposed |
| R-031 | `tenet move <packet> <station>` changes stage only by appending a history entry, and refuses a move whose gate fails, naming each failing condition | V-P2, V-H2 | M1 (state only); M2 (gates) | proposed |
| R-032 | `tenet board` regenerates `now.md` (and `now.html`) from packet records alone, deterministically: the same records give byte-identical output | V-V2 | M1 | proposed |
| R-033 | `tenet check` (alias `speccheck`) runs the traceability and anti-drift checks of the standard and exits non-zero on any error | V-P2, V-M2 | M1 (structure); M2 (evidence) | proposed |
| R-034 | `tenet receipt` records a check run as a receipt bound to the candidate (base commit and content digest); freshness is computed, never stored | V-P2 | M2 | proposed |
| R-035 | `tenet close <packet>` computes the endpoint from receipts and findings by the standard's endpoint rules and writes a ledger entry | V-P2, V-M2 | M2 | proposed |
| R-036 | `tenet escalate <packet>` moves a packet to `blocked` and writes an escalation from the template; the stop rule in the profile triggers it automatically on the next `move` or `receipt` | V-P6, V-M9 | M2 | proposed |
| R-037 | `tenet claim` / `release` give exclusive claims with expiry, so two sessions cannot work the same packet or task | V-P5 | M2 | proposed |
| R-038 | Git hooks enforce the anti-drift rules; the same checks run in CI so a skipped hook is caught | V-P2, V-B2 | M2 | proposed |

### 4.5 CLI: agents and execution

| ID | Requirement | Serves | Milestone | Status |
|---|---|---|---|---|
| R-040 | `tenet agent check` validates every agent definition, roster binding and generated file; a definition that widens the permissions of the one it extends fails | V-B2, V-M7 | M3 | proposed |
| R-041 | `tenet build --target conductor` compiles loop definitions to Conductor workflow YAML that runs the station loop with no hand edits | V-H2 | M3 | proposed |
| R-042 | `tenet build --target claude-code` and `--target copilot` compile agent definitions to host agent files, a loop skill, commands and permission settings; every generated file states its execution mode | V-P4 | M3 | proposed |
| R-043 | `tenet run <packet>` writes the assignment, claims the packet, invokes the configured engine command, and writes the run record and receipts when it ends | V-H2, V-M7 | M3 | proposed |
| R-044 | The loop definition is checked statically: every `agent` step is followed by an inspection step, every loop has a round cap, every `human_gate` lists stop first | V-P3, V-P6 | M3 | proposed |
| R-045 | `tenet freeze` / `thaw` stop and resume new runs fleet-wide or per agent | V-B2 | M3 | proposed |

### 4.6 Subscription and upgrade

| ID | Requirement | Serves | Milestone | Status |
|---|---|---|---|---|
| R-050 | `tenet.lock` records the standard version, the package integrity hash and a hash per vendored file; `tenet check` fails on any local edit under `.tenet/kit/` | V-V3, V-B6 | M1 | proposed |
| R-051 | `tenet upgrade [version]` replaces the vendored kit, runs shipped migrations in order, regenerates targets and generated blocks, validates overlays, and opens an `ops` packet listing every change | V-V3, V-M5 | M4 | proposed |
| R-052 | The upgrade classifies itself as auto-mergeable only when the version change is patch or minor **and** no change widens an agent permission, adds or alters a gate, or changes a critic's severity rules | V-B6, V-B2 | M4 | proposed |
| R-053 | Overlays may only narrow: an override's tools, paths, network and budget must be subsets of the definition it extends | V-B2 | M3 | proposed |
| R-054 | `tenet init` writes a Renovate configuration (and a Dependabot alternative) that groups Tenet updates and runs `tenet upgrade` in the update pull request | V-M5 | M4 | proposed |
| R-055 | A changed reference agent definition is marked for requalification in the project and cannot reach `full` until it passes on the project's model and host | V-H4 | M5 | proposed |

### 4.7 Conformance

| ID | Requirement | Serves | Milestone | Status |
|---|---|---|---|---|
| R-060 | `tenet-conformance.yaml` declares the standard version, adoption steps, stations implemented and execution mode | V-V4, V-M8 | M4 | proposed |
| R-061 | `tenet conform` runs the conformance tests for each declared claim and reports pass or fail per rule ID | V-M6 | M4 | proposed |
| R-062 | An implementation's conformance is tested on its own outputs (records and files it produces), not on its source code | V-P4 | M4 | proposed |

### 4.8 Workforce and learning

| ID | Requirement | Serves | Milestone | Status |
|---|---|---|---|---|
| R-070 | `tenet agent qualify` runs an agent's evaluation suite for a (definition version, model, host) tuple and records the result | V-H4 | M5 | proposed |
| R-071 | `tenet agent promote` moves a version through shadow, canary and full only when the profile's thresholds are met | V-H4 | M5 | proposed |
| R-072 | `tenet agent scorecard` and `tenet metrics` compute the standard's metrics from records alone | V-M1, V-M4 | M5 | proposed |

### 4.9 Quality attributes

| ID | Requirement | Serves | Milestone | Status |
|---|---|---|---|---|
| R-080 | The CLI never calls a model and makes no network request except `upgrade` fetching the package and `adopt` reading a configured issue source | V-B4, V-B5 | M1 | proposed |
| R-081 | Every command runs on Windows, macOS and Linux with Node 22 LTS or later | V-V3 | M1 | proposed |
| R-082 | `tenet board` and `tenet check` finish in under 3 seconds for 500 packets on a typical laptop | V-V2 | M2 | proposed |
| R-083 | Every error names the file, the rule and the fix | V-V1 | M1 | proposed |
| R-084 | Every command supports `--json` output for agents and CI | V-V1 | M1 | proposed |

## 5. Versioning and release policy

| Change | Version | Subscriber effect |
|---|---|---|
| Wording, clarification, bug fix in the CLI | Patch | Auto-merge after conformance check |
| New optional capability; a stricter check existing conforming projects already pass | Minor | Auto-merge after conformance check |
| Changed schema, removed rule, new required gate, any change to authority or permissions | Major | Waits for the Owner |

Pre-1.0 releases (0.x) treat a minor bump as major for auto-merge purposes. A release is cut only from a packet that has closed `released`.

## 6. Milestones

| ID | Name | Delivers | Gate | Horizon |
|---|---|---|---|---|
| M0 | Foundation | This repository: vision, specs, draft standard, kit drafts; namespace decision | Owner signs the vision and approves the specs | — |
| M1 | Usable by hand | D2 kit; CLI `init`, `adopt`, `new`, `move` (state only), `status`, `board`, `check` (structure); D7 quick start | This repository and Torus run ≥5 packets each with the CLI | V-H1 |
| M2 | Enforced | Gates, receipts, close, escalate, claim, hooks, CI check | 30 days in two projects with ≥95% of transitions gated | V-H2 |
| M3 | Governed agents | Agent check and build, loop compiler, host compilers, run, freeze | One packet per lane runs end to end on Conductor; one on a host target | V-H2 |
| M4 | Subscribed | Upgrade, migrations, update-bot integration, conformance kit, 1.0 with rule IDs | 3 consecutive releases reach 3 projects with median ≤5 Owner minutes | V-H3 |
| M5 | Managed workforce | Qualification, staged release, scorecards, metrics, experiments | V-H4 criteria | V-H4 |

## 7. Decisions

| ID | Decision | Why |
|---|---|---|
| DEC-01 | Tenet is the standard; the VS Code implementation is renamed Tenet for Copilot | The name reads as "a principle held to"; the standard outlives any one host |
| DEC-02 | One npm package holds both the kit and the CLI | One version to pin, one update to receive; `npx` needs no global install |
| DEC-03 | The kit is vendored into the project, read-only, with hashes in a lock file | Agents and hosts read local files; upgrades are reviewable diffs; offline works |
| DEC-04 | Projects customize by overlays that may only narrow | Upgrades never conflict with local edits; permissions cannot drift wider |
| DEC-05 | Loops are defined engine-neutrally and compiled; Conductor is the first target | An executable loop must target an engine; compiling keeps the standard neutral and reuses govaut's proven shape |
| DEC-06 | The CLI is deterministic and never calls a model | Enforcement that a model can talk its way past is not enforcement |
| DEC-07 | TypeScript on Node 22 | Same runtime as the hosts and Tenet for Copilot; `npx` distribution; one language for CLI and compilers |
| DEC-08 | This repository dogfoods the standard from M0 | The standard's first critic is its own steward |

## 8. Risks

| ID | Risk | Mitigation |
|---|---|---|
| RK-01 | The standard grows too large to adopt | Adoption steps; each M milestone must keep step 1 under half a day (measured on Torus) |
| RK-02 | Host or engine features change faster than the compilers | Targets are generated and versioned; a target that falls behind is marked unsupported, never half-working |
| RK-03 | Auto-merged updates break a project | Conformance check gates the merge; auto-merge only for patch and minor; permission and gate changes always wait |
| RK-04 | The name `tenet` is taken on npm or trademarked in software | Namespace check in M0 (CP-0002); scoped package as fallback |
| RK-05 | Mode B (host-driven) gives weaker guarantees than users assume | Every generated target states its mode; the board shows the mode per packet |
| RK-06 | One Owner is the only steward | The standard governs itself; decisions live in the ledger so a second steward can join |

## 9. Open questions

| ID | Question | Needed by |
|---|---|---|
| OQ-01 | Package name: unscoped `tenet` or a scoped name | M1 |
| OQ-02 | Whether `now.html` is generated in M1 or deferred to M2 | M1 |
| OQ-03 | Which issue sources `adopt` reads first (GitHub only, or also local Markdown lists) | M1 |
| OQ-04 | Whether the conformance kit is a separate package for implementers who do not want the CLI | M4 |
| OQ-05 | License for the standard text versus the code (for example CC BY 4.0 and MIT) | M1 |
