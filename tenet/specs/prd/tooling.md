---
tenet:
  spec: 1
  doc: prd
  level: L1
  version: "0.13"
  owner: ved
  drafted_from: faef0d63fe5f2361ce37c2e2f6c610f364ba9e32
sections:
  _preamble:
    state: draft
    digest: sha256:42404fc7e4d68ab40aa9760d7df61b06cfe733a6ca780f4b4200260c08feaa1f
    flags: []
  0-work-views-and-operations:
    state: draft
    digest: sha256:d031f453896a91e514097b46ba6365d9919ff3f873a7d2de194c7f78c6bd2959
    flags: []
  1-standard-kit-install-and-upgrade:
    state: draft
    digest: sha256:939251ef7581b189f96223484842b4df91443b96d7fbf182a2b66f27a647cdc0
    flags: []
  2-agents-execution-conformance-and-quality:
    state: draft
    digest: sha256:a82bde20825da741253ea4a1820e81f15c33c2c91456ae1385406b89ac8f581f
    flags: []
  3-adoption-and-friction:
    state: draft
    digest: sha256:7584cfa57f3eb61e8b998f812558c3c11e6dfe85b53c882894516af08703e676
    flags: []
  4-trust-and-verification:
    state: draft
    digest: sha256:d980a1f5e06c6afbd143a963eff1a7a0adf75e7f191899174525b05310b56178
    flags: []
---
# Tenet requirements: work, views, kit, agents and conformance

> L1 · Version 0.13 · Draft · [PRD](../prd.md) · Budget: 7,000 tokens · Moved from PRD §4.3–§4.4 (L-0014, L-0016) · Previous: `archive/specs/prd/tooling.md@0.12.md`

**Context card.** Work and views, the standard and kit, agents and bindings, conformance, adoption (§3), and trust (§4). Columns and guarantees follow [PRD §4](../prd.md#4-requirements), which retains the spec process and kernel.

## 0. Work, views and operations

|ID|Requirement|Serves|Release|Guarantee|Origin|Cites|
|---|---|---|---|---|---|---|
|R-032|`tenet board` reduces events, pull-request state and evidence for a named as-of time into a versioned `board.json` (refs read, phases on a shared vocabulary, dependencies, typed next actions with the command and an optional `dispatch` payload, optional `active_runs`) and `now.md`; the default view is what waits for you, what is blocked and what changed since you looked; a single-file HTML viewer ships with it; generated views are never committed; a fixture gallery ships for UI builders|V-V2|0.1.0|—|asked||
|R-035|`tenet close` computes the endpoint and writes a ledger entry; from 0.1.x it turns the packet's preservation items into continuing promises with their proving cases|V-P2, V-P9|0.1.0; 0.1.x|enforced*|asked||
|R-037|**Leases** (exclusive work locks, optionally over `paths`) are advisory in a working copy and exclusive only where an engine provides an atomic update; strength is shown; resuming an interrupted station is idempotent|V-P5, V-P12|0.1.0; M3|advisory|asked||
|R-038|Hooks catch violations early; CI reruns the same checks|V-P2|0.1.0|detected|asked||
|R-072|`tenet metrics` computes vision and diagnostic metrics with units, sample sizes and bounds|V-M3, V-M4|M2|—|asked||
|R-073|The board shows flow from 0.1.0: verified changes per week by lane, lead time (median, 85th percentile), work in progress, decision wait, cost per outcome with its source and status (known, estimated or unavailable), autonomy share beside escapes|V-V2, V-M3, V-M4, V-M7, V-M9|0.1.0|—|asked||
|R-074|`tenet audit sample` draws a random sample of verified changes for independent rerun or review and reports the rate with its bound|V-M2|M2|—|asked||
|R-075|The decision-reconstruction exercise is a published procedure run in every pilot|V-M1|M0; 0.1.x|—|asked||

## 1. Standard, kit, install and upgrade

|ID|Requirement|Serves|Release|Guarantee|Origin|Cites|
|---|---|---|---|---|---|---|
|R-001|A normative kernel (Part I) of at most 8,000 tokens; reference packs and practices (Part II) are non-normative|V-P4, V-P7|M0|—|asked||
|R-002|Every kernel "must" rule has a rule ID: provisional from 0.1.0, stable from 1.0|V-V4|0.1.0; M4|—|asked||
|R-003|The standard names no tool, model or vendor as a requirement|V-P4, V-B1|M0|—|asked||
|R-004|Each release has a changelog and its migrations|V-V3, V-B6|0.1.0|—|asked||
|R-005|A rule or field is deprecated for one minor version before removal|V-B6|0.1.0|—|asked||
|R-007|Conformance classes (published with the kit at M4; release fixtures from alpha.0): producer, evaluator, executor, renderer, project, each at `minimal` (R-205) or `full` level; catalog entries become normative for a project once its pack declares them, and are tested for that claim|V-V4|0.1.0|—|asked||
|R-009|The kernel is checked against four reference cases: a library with unobservable installs, a regional rollback, a migration with a point of no return, an ML change with no code change|V-V5, V-P4|M0|—|asked||
|R-010|JSON Schemas with fixtures for the seven primitives, the work item, policy, lock, pack, agent, loop, assignment, result, criteria and board|V-V4, V-P2|0.1.0|—|asked||
|R-012|Reference agent cards: **drafter** (read-only; drafts specifications from the inventory; never blesses) and **spec reviewer** (checks drafts for invented or uncited statements) in 0.1.0-alpha.0; **shaper** (writes a work item's definition and acceptance items from blessed context), **test writer** (writes the independent tests the careful lane pins, from the definition alone, as a definition distinct from the builder's), **builder** and **judge** in 0.1.0; verifier in 0.1.x; planner with the standard pack; Part II gives examples of a spec gardener and specialist critics (security, architecture, test oracle)|V-V1, V-P2|0.1.0; 0.1.x; M2|—|asked||
|R-013|One judge protocol; criteria as structured data; critics differ by criteria and required inputs|V-P2|0.1.0|—|asked||
|R-014|Loops `station` and `fix` (0.1.0); `triage`, `upgrade`, `qualify` later; tunable by narrowing|V-P4|0.1.0|—|asked||
|R-015|A reviewer that passes the 5-case activation test is **advisory**; satisfying an enforced gate needs the larger risk-tiered suite (M2); smoke suites at M3; qualification at M5|V-P2, V-H4|0.1.0; M2; M5|enforced|asked||
|R-016|Packs are data: `minimal` (intake, define, build, verify, integrate, close) by default, **pull-request native** (catalog R-186), with lanes `express` (0.1.x), `quick`, `careful` and `deep`; `explore` is a work type, not a lane; `software-standard` at M2. Each pack lists its standard claims, selectors, work types and methods, and maps its stations onto a shared phase vocabulary (discover, define, build, verify, release, operate, learn) that every board and UI uses; a short pack-authoring contract says how|V-P7|0.1.0; M2|—|asked||
|R-017|A skills library in the open agent-skills format; project skills pinned by hash|V-P4, V-V1|0.1.0|detected|asked||
|R-018|Agents change state only through commands that write events|V-P10|0.1.0|detected|asked||
|R-020|`tenet init` starts a project at the `observe` level. First a **preflight**: what it found (forge, CI, test commands and their report format, owners, docs, agent hosts and their capability level), what it will write (every repository and host file, and edits to existing files as marked blocks) and what it will never read. In an existing repository it adds Tenet's step to the CI job that already runs the tests only when that job writes a supported test report or the user accepts a marked edit adding the reporter setting; otherwise it writes Tenet's own test workflow with the setup steps it detected, and says why; in a new project it asks what is being built and its kind. It reports first findings (tech-spec/onboarding.md §1), records an install manifest, says what to do next, and never reports a missing trust assumption as a failure|V-V3, V-P7, V-B10|0.1.0|—|asked||
|R-221|**Getting Tenet takes one step.** The npm package `@vedprakash-m/tenet` (command `tenet`) from 0.1.0-alpha.0, published with provenance under the `next` tag until 0.1.0; each GitHub release also carries the prebuilt package and checksums. Documented commands always name a version (`npm install --global @vedprakash-m/tenet@<version>`, `npx -y @vedprakash-m/tenet@<version>`), never a branch. A global install puts `tenet` on the path; a dev-dependency install is run as `npx tenet`; MCP entries run the pinned package, so they work either way. A template repository starts new projects; standalone downloads arrive in 0.1.x. No account, and nothing is installed by piping a script into a shell|V-V3, V-B10|0.1.0; 0.1.x|—|asked||
|R-021|Existing repositories are onboarded through R-223: existing documents become `draft` sources, never truth until blessed; an agent drafts the five views from them and from the code|V-V3|0.1.0|—|asked||
|R-022|`init` and `import` are idempotent; `--force` replaces files that differ, each listed first|V-B6|0.1.0|—|asked||
|R-023|Every file written by `init`, `import` or `upgrade` is listed in the output and recorded in the install manifest|V-B3|0.1.0|—|asked||
|R-024|Base footprint: `tenet.yaml`, `tenet.lock`, an `AGENTS.md` block, the CI workflow when chosen, and the host's skill files; the kit is loaded from the pinned package (`init --vendor` copies it for offline use); other integrations offered one by one|V-V3, V-P7|0.1.0|—|asked||
|R-025|`tenet remove` (0.1.0-alpha.0) uses the install manifest to delete only what Tenet created and the blocks and keys it added (ALG-12), keeps specifications, records and any value the user changed after install, and reminds the user to remove the branch rule if the Tenet status was made required; `tenet eject` (M2) also handles packets and history|V-V3, V-B6|0.1.0; M2|—|asked||
|R-026|`tenet doctor` reports kit integrity, hand-edited generated files and the latest trust observation, offline|V-B6, V-B8|0.1.0|—|asked||
|R-027|Behavior found at adoption has origin `observed` and stays `draft` until a person blesses its section|V-B7|0.1.0|—|asked||
|R-028|Records from other tools enter as packets keeping a reference to their source|V-P4|0.1.x|—|asked||
|R-050|The lock records version and integrity; the kit is verified against it wherever it is loaded from; edits to a vendored kit fail `tenet check`|V-V3, V-B6|0.1.0|enforced*|asked||
|R-051|`tenet upgrade` updates the lock to the installed version, regenerates the `AGENTS.md` block and skills, lists what changed for this project and runs `tenet check`; it never changes the level or starts a new rule beyond `observe` (0.1.0). From M4 it also stages migrations, swaps atomically and resumes or rolls back when interrupted|V-V3, V-B6|0.1.0; M4|—|asked||
|R-052|Upgrades classify themselves from structured fields; below 1.0 every minor needs review|V-B6|M4|enforced*|asked||
|R-053|Overlays may only narrow|V-B2|0.1.0|detected|asked||
|R-054|`tenet check` reports a package version that differs from the lock (0.1.0-alpha.0); a scheduled CI job opens the upgrade pull request (M4)|V-V3|0.1.0; M4|—|asked||
|R-055|A changed reference agent stays inactive until it requalifies|V-H4|M5|enforced|asked||

## 2. Agents, execution, conformance and quality

|ID|Requirement|Serves|Release|Guarantee|Origin|Cites|
|---|---|---|---|---|---|---|
|R-040|`tenet agent check` validates definitions, skills, rosters and generated files; widening fails|V-B2|0.1.0|detected|asked||
|R-041|Engine adapters implement an open contract: start, status, cancel, usage and workspaces (0.1.0, used by the reference runner); compile, suspend and resume, next work (M3)|V-P4|0.1.0; M3|—|asked||
|R-042|`--target agents-md` (0.1.0) and host targets (0.1.x, M3) declare per capability whether the host enforces it|V-P4, V-P12|0.1.0; 0.1.x; M3|as declared|asked||
|R-043|Running a step writes the assignment, invokes the adapter and records the run: the reference runner (0.1.0); `tenet run` for external engines (M3)|V-H2|0.1.0; M3|—|asked||
|R-224|**Reference runner.** An optional package, `@vedprakash-m/tenet-runner`, executes the shipped loops through the user's own agent host: it reads the next action, works each item in its own worktree, starts the step's agent card through a host adapter, returns the result through `tenet result`, opens the pull request with the forge tool the user has, and stops at every human gate and stop threshold. It never calls a model itself and never produces evidence (that comes only from CI). It is minimal by design: one repository, no scheduler, daemon, dashboard or fleet; external factories use the same adapter contract|V-V3, V-P4, V-P7|0.1.0|as the host declares|asked||
|R-044|Loops are checked statically: rounds only rise within a cap; inspection follows creation; refusals outrank convergence; human gates list stop first|V-P2, V-P6|0.1.0|enforced|asked||
|R-045|`tenet freeze` / `thaw`; revoking in-flight authority is separate and recorded|V-B2|M3|—|asked||
|R-046|Critics run after deterministic checks where the lane calls for them; findings are introduced, exposed, inherited or uncertain, and count only once substantiated; invalid findings make a review incomplete, which never converges|V-P2|0.1.0|enforced|asked||
|R-047|Runs record independence facts; packets record who wrote their tests|V-P2|0.1.0|detected|asked||
|R-206|**Agent card.** One definition format (schema in CP-0004). Required: name, role, purpose, inputs (spec levels and sections), outputs (result schema). Optional: tools and side effects, `acts_as`, sponsor, stop rules, evaluation suite. Reviewers add criteria, independence, a finding schema and `abstain_when`. Bindings compile cards to host formats. A card is a subject; its qualification is a continuing claim on (definition, model, harness, toolset, task class), so changing any of them makes it stale; promotion and retirement are decisions|V-P2, V-P11, V-H4|0.1.0 (card); M5 (qualification)|detected|asked||
|R-225|**Working practices.** The `AGENTS.md` block carries short default working rules (state assumptions and ask; the smallest change that meets the acceptance items; touch only what the task needs and match the existing style; say how each step will be checked; plain words), which a project replaces or turns off in `tenet.yaml`. Onboarding treats existing instruction files (`copilot-instructions.md`, `CLAUDE.md`, editor rules) as sources: their project rules become cited `scope: global` requirements and their working rules a design section, blessed like any other text. `init` adds a pointer block to `.github/copilot-instructions.md` where it exists. The rules that can be checked are ideas R-226 to R-230|V-P7, V-P18|0.1.0|advisory (depends on the host)|documented|doc: tenet/ledger/L-0028-working-practices-ship-with-tenet.md#decision-or-event|
|R-048|The package exports an SDK with the CLI's functions, and a JSON file contract for writing evidence, results and decision requests that engines can use without the SDK|V-V4|0.1.0|—|asked||
|R-049|A local MCP server (newline-delimited JSON-RPC 2.0 over stdio, no network, at the protocol revision pinned in tech-spec/contracts.md) offers the tools `tenet_context`, `tenet_check`, `tenet_status`, `tenet_next` and `tenet_propose` (which writes only to `.tenet/proposals/`), with the schemas in tech-spec/contracts.md; with skills it is the main way agents use Tenet|V-V4, V-B10|0.1.0|—|asked||
|R-060|`tenet-conformance.yaml` declares version, classes, packs, mode and guarantee levels|V-V4|M4|—|asked||
|R-061|`tenet conform` runs the tests for each declared claim|V-V4|M4|—|asked||
|R-062|Implementations are tested on their outputs, not their source|V-P4|M4|—|asked||
|R-063|Fixtures cover positive, refusal, overlapping, concurrent, late-arriving and interrupted cases|V-H3|0.1.0; M4|—|asked||
|R-064|An independent reader written from the kernel text alone reaches the same decisions|V-H3, V-V4|0.1.x|—|asked||
|R-070|`tenet agent qualify` scores an adapter-run suite deterministically|V-H4|M5|—|asked||
|R-071|`tenet agent promote` stages versions only when thresholds hold|V-H4|M5|—|asked||
|R-081|Every command runs on Windows, macOS and Linux with Node 22+; a CI action needs no local install, and standalone binaries ship from 0.1.x|V-V3|0.1.0; 0.1.x|—|asked||
|R-082|`board` and `check` within 3 s warm and 10 s cold for 500 packets, 10,000 event files and 5,000 commits|V-V2|0.1.0; M2|—|asked||
|R-083|Every error leads with plain words (what happened, why the rule exists, the fix or `tenet fix`), then the file and rule ID|V-V1, V-B10|0.1.0|—|asked||
|R-084|Every command supports `--json` with the same facts|V-V4|0.1.0|—|asked||

## 3. Adoption and friction

|ID|Requirement|Serves|Release|Guarantee|Origin|Cites|
|---|---|---|---|---|---|---|
|R-214|**One adoption setting.** `level` is `observe` (default: nothing blocks, self-acceptance allowed and labelled, no keys, bots or CI setup beyond one workflow), `protect` (rules the Owner turned on block; this is **detected**, because a pull request can change the workflow that checks it; native reviews), `verify` (signed evidence, merging requires its status, forge decisions count) or `assure` (person-present decisions, external holdout, strict separation of duties, vision ratified twice). Features such as campaigns or a factory definition are turned on separately|V-P7, V-V3, V-B10|0.1.0 (observe, protect); alpha.2 (verify); 0.1.x (assure)|—|documented|doc: tenet/ledger/L-0016-practicality-round-applied.md#decision-or-event|
|R-215|**Rule modes.** Every rule runs in `observe`, `advise` or `enforce`; the level sets defaults and `tenet.yaml` may override one rule; the board and proof card show what would have been blocked; promoting a rule is a decision|V-P7, V-P12|0.1.0|—|documented|doc: tenet/ledger/L-0016-practicality-round-applied.md#decision-or-event|
|R-216|**Friction budget.** Tenet records refusals, overrides, waivers and "not useful" marks per rule and the human minutes Tenet takes (V-M11: from the bless log, decision timestamps and timed pilot sessions); a rule above its budget (default: over 10% not useful, or over 2 false blocks per 100 changes) is flagged for demotion at the release retrospective|V-B10, V-P7|0.1.0|—|asked||
|R-217|**Safe failure.** When a control cannot run (CI unavailable, keys missing, review unobservable, check timed out), the result says so. At `observe` and `protect` it is advisory and nothing blocks. At `verify` and `assure` it fails closed for every change: the forge conclusion is `failure`, never `neutral` (DEC-53); an override is a waiver recorded as `accepted-without-verification`, never `verified`. Nothing silently passes|V-B8, V-P12|0.1.0|detected|asked||
|R-218|**Proof card.** Every pull request gets one summary, opening with **the blessed requirements the change touches** (named in `Implements:`, cited code changed, or the same area, ALG-14), each with its text and the results of its requirement-tagged tests. Then each acceptance item with how many of its tagged tests passed, failed, were skipped or did not run on the tested commit, and whether those tests were written in this change; test totals and failing tests; tests deleted, skipped or weakened (ALG-09, "not checked" for languages it cannot read); protected files touched and blessings changed; spec deltas; what would have been blocked. Each line states its method and coverage ("test passed on this commit", "N tagged results passed; coverage not confirmed" where a runner cannot match results to tagged tests, "failed as expected on the base", "no weakening detected by these checks"); results say "passed", never "proven". The card binds an **evaluation** (commit, acceptance block, implemented requirements' blessed text, policy); changing any of them re-evaluates. A **test job** that holds no write token runs the checks named in `tenet.yaml` (in Tenet's workflow with its setup steps, or as a step in a project CI job that already writes a supported report) and uploads a bundle; a **recorder** that runs from the default branch and never runs the change builds the card, posts the check run `Tenet` (forks included) and keeps unsigned results on the records ref; from alpha.2 the recorder signs (the attest job). In alpha.0 it evaluates the five alpha.0 rules of the registry for "would have blocked". Before a baseline is blessed it reads "advisory · intent not yet blessed"; with no acceptance block it still shows touched requirements, tests and weakening|V-V1, V-P2, V-M1|0.1.0|advisory; enforced* at verify|documented|doc: tenet/ledger/L-0024-one-ci-shape-and-intent-on-the-card.md#decision-or-event|
|R-219|**Tenet does the bookkeeping.** IDs, links, status and events are generated; people never type an ID or digest. `tenet fix` repairs mechanical problems in local files (IDs, links, front matter); it never edits a pull request: agents number acceptance items (`AB-1`, `AB-2`) when they write the description, and the proof card reports any missing. Hooks warn and CI enforces; every refusal leads with plain words and one sentence on why the rule exists|V-B10, V-V1|0.1.0|—|documented|doc: tenet/ledger/L-0016-practicality-round-applied.md#decision-or-event|
|R-222|**Host capability levels.** Each agent host is described by what it can do with Tenet: passive (its pull requests get proof cards), instructions (`AGENTS.md`), skills, MCP, or enforced (a host binding restricts protected writes); `init` shows the level it detected and lists every host file it writes|V-P12, V-B8|0.1.0|—|asked||

## 4. Trust and verification

|ID|Requirement|Serves|Release|Guarantee|Origin|Cites|
|---|---|---|---|---|---|---|
|R-100|**Two-job verifier** (from `verify`; below it the same test job and recorder produce advisory receipts without signing): a check job runs pinned checks with no credentials, no write access, network denied by default, an environment-variable allowlist, no cache shared with the attest job and a recorded runner image; it detects checks that edit tracked files, passes only on exit code 0 with a valid report, and writes its bundle outside the working tree; an attest job never runs the change, parses the bundle as data, checks protected claims, replays events and **signs each evidence record with an identity only the protected job holds** (method chosen by CP-0040: a public signing service for public repositories, or a key held by the protected job), so a record cannot be forged or altered wherever it is stored (it does not by itself prove the check was right); a store only that job can write is the fallback. Tenet ships one hardened reference workflow|V-P2, V-B7|0.1.0|enforced*|asked||
|R-110|The attest job observes the trust properties: **T1** the verifier runs from a protected source; **T2** evidence carries a signature only that job can make; **T3** decisions reserved to people carry proof an agent cannot produce; **T4** agents never hold decision-makers' credentials (declared in the policy and spot-checked: agent commits from declared bot identities, no decision from the account whose agent session opened the pull request; it supports enforced* only where a host binding attests it). Separately it observes whether merging requires the Tenet status (`unavailable` on forge plans without merge protection). `enforced*` counts as enforced only while a fresh observation holds|V-P12, V-B8|0.1.0|—|asked||
|R-104|`holdout.mode` is `external` (outside the build repository) or `in-repo` (always advisory)|V-P11, V-P12|0.1.0 (declared); M2|advisory; enforced* if external|asked||
|R-105|A run with both untrusted input and sensitive data gets no network and may change only its worktree; assignment inputs carry source, trust and hash, and the evaluator refuses an assignment that combines all three properties|V-P11, V-B5|0.1.0|advisory (declared); as the host enforces|asked||
|R-106|A **red-team suite** runs in CI: forged evidence; policy or protected files edited on a branch; code under test faking reports or reading credentials; impersonated, replayed, channel-only or agent-answered decisions, **including an agent using the Owner's forge session** and **an approval edited after recording**; cache poisoning or artifact injection between the two jobs; hand-written or conflicting moves; squash merges; holdout reads; prompt injection; **skipped mapped cases, inserted skips, special-cased or deleted tests, substituted reports, planted test hooks**; harness-failed baselines; broken promises and hiding quarantines (0.1.x); proof escape hatches (M2). The list matches the guarantee table|V-M2, V-H1|0.1.0|—|asked||
|R-107|Run records keep summaries, hashes and costs, not transcripts, unless opted in; secrets are never written|V-B5|0.1.0|detected|asked||
|R-080|Tenet's tooling never calls a model. Its only network use: fetching a package; reading a configured issue source; fetching verification keys when the user asks; `board --fetch` reading the records ref; in CI, the recorder (which never runs the change; below `verify` its token can write the whole repository, so its records are labelled detected) reading pull-request data, reviews and comments, downloading the test job's bundle, posting the proof card and decision requests and writing the records ref; and from `verify` the attest job reading forge protection and signing keys and writing the evidence store. The test job makes no Tenet network call beyond the project's own setup steps|V-B4, V-B5|0.1.0|enforced|asked||
