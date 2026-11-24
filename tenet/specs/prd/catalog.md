---
tenet:
  spec: 1
  doc: prd
  level: L1
  version: "0.14"
  owner: ved
  drafted_from: faef0d63fe5f2361ce37c2e2f6c610f364ba9e32
sections:
  _preamble:
    state: draft
    digest: sha256:aa1573c68c8bde6ab9e0876b14811ab99cd80f011261444d788b92eee7bf952f
    flags: []
  claims:
    state: draft
    digest: sha256:569049264ee6e6bca03e8f40837a4938d5e1b60876507b3891c0cc5e37999a47
    flags: []
  evidence:
    state: draft
    digest: sha256:19cecddfa74a46c964b2bd2622076369b42fc83f5bec8ba7f1588afa1e226066
    flags: []
  decisions:
    state: draft
    digest: sha256:d3c828cb26338d3b1b6ee1c4a274dbc8a34b5dab59dfd4273363e7ddc0c5e83b
    flags: []
  work-items-subjects-and-policy:
    state: draft
    digest: sha256:5da2ebe176f966de7374b07a9d889af44c9d791a7ddab74403215a351a1feb9e
    flags: []
  factory-definition-and-execution:
    state: draft
    digest: sha256:d1ee0b34be61ec50fef6d24d92c219c2e6e2137dba09835422e6abe4aea6f395
    flags: []
  views-and-measurement:
    state: draft
    digest: sha256:e0d0ac5e7b9b40c02d3edea473d7cafe0637430614a0a4031bb691db7b544fa9
    flags: []
  ideas-not-scheduled:
    state: draft
    digest: sha256:7f004a1dcd70be1090df556179da928f7e5113743d7918808d554bdddad50601
    flags: []
---
# Tenet catalog: standard claims, evidence, decisions and features

> [PRD](../prd.md) · Budget: 7,000 tokens · Prior: `archive/specs/prd/catalog.md@0.13.md`

**Context card.** Beyond PRD §4.0–§4.1, packs make selected primitive types or views normative. Types: claim type, evidence kind, evidence field, decision name, decision rule, subject kind, policy feature, work-item type, event data, view, binding, conformance. Never reuse IDs. Kernel guarantees apply. Until the pilot checklist holds, add only ideas (DEC-38).

## Claims

|ID|Entry|Type|Rule|Serves|Release|Origin|Cites|
|---|---|---|---|---|---|---|---|
|R-171|Acceptance item|claim type|Declares claim class (functional, compatibility, non-functional, health, safety-security, outcome), method, pass rule and case IDs; the template has a worked example and asks which requirement a property captures and what would make it true but wrong|V-P2, V-V5|0.1.0|asked||
|R-111|Independent acceptance tests|claim type|In the careful lane (from 0.1.0), acceptance tests are written by a run other than the builder's before Build and pinned in the approved subject; the Owner approves the acceptance items in plain words and is not asked to read the tests, whose adequacy comes from distinguishing evidence and review; in the quick lane the builder may write them, and the board says so|V-P2, V-V1|0.1.0|asked||
|R-170|Continuing promise|claim type|Closing a packet turns its preservation items into blessed continuing claims whose proving cases are protected (R-103); a change touching their paths, or the dependencies their area declares, must keep their evidence fresh; a promise is **defeated** (R-187) by a later failing observation, escaped defect, incident or failed audit on its scope until new evidence or a decision restores it|V-P9, V-M10|0.1.x|asked||
|R-103|Protected surfaces|claim type|**Trust surface** (policy, the verifier workflow, permissions, factory definition): an `approve` of `change-policy` (`person-present` at `assure`, `forge-verified` otherwise); unwaivable. **Weakening evidence** (tests deleted or skipped, assertions removed, thresholds lowered, proving cases retired, theorem statements or axiom allowlists changed): an `approve` by the owner of what is weakened; replacing a proving case with an equivalent passing one is `forge-verified`. **Mechanics** (scripts, compiler, linter and test configuration, lockfiles, new tests): normal review, with a warning on the proof card when the change weakens a check. **Blessing records** (blessed copies and blessing fields): require the section owner's blessing under R-223 and have a separate tier|V-B2, V-P9, V-B10|0.1.0|asked||
|R-146|Change size|claim type|Each lane caps files and lines; a larger change is split or raised|V-P5|0.1.0|asked||
|R-175|Health indicator|claim type|Declared, tool-neutral indicators per area (complexity, duplication, architecture violations, dead code and stale flags, type coverage, suite time and flake rate, docs referring to missing code) may not worsen beyond tolerance on the touched scope versus the target's baseline without a forge-verified `waive` (`accept-health-regression`); improvements on main raise the baseline; adoption records existing problems as the baseline|V-P9, V-M10|0.1.x|asked||
|R-176|Architecture rule|claim type|Layers, forbidden dependencies and cycles as pinned checks with fix hints, counted as health indicators|V-P9|0.1.x|asked||
|R-143|Area readiness|claim type|On an `area` subject: the environment reproduces, pinned checks exist and are fast and stable, an owner is known, the protected paths are in place and health is holding; each lane names the readiness it needs; a declining area loses express and quick lanes for new work (work in flight keeps its lane until its next gate); intake records a disposition (admitted, linked, deferred, rejected, already resolved)|V-P5, V-V7|0.1.x|asked||
|R-154|Outcome|claim type|Statuses `recovered`, `partial`, `no-change`, `insufficient-exposure`, `unknown`, scoped to a region or cohort; evidence available at decision time is kept apart from later evidence|V-V5|0.1.0 (vocabulary); M2|asked||
|R-187|Defeater|claim type|A continuing claim moves to `defeated` when later evidence on its scope contradicts it; the board shows it and the claim blocks gates that rely on it until restored|V-P9, V-V5|0.1.x|asked||

## Evidence

|ID|Entry|Type|Rule|Serves|Release|Origin|Cites|
|---|---|---|---|---|---|---|---|
|R-174|Methods|evidence field|Methods: static, health-ratchet, unit, integration, contract, e2e, property, fuzz, mutation, differential, simulation, model-check, proof, benchmark, holdout, visual-runtime, review, production-observation. Methods are **never ranked globally**: a pack lists which satisfy each claim class and lane. Formal evidence states what it covers: trials, bounded (a timeout is unknown) or proved, and `correspondence` to the implementation (`none`, `sampled`, `proved`); a proof with no correspondence is labelled "proved in model"|V-V4, V-P12|0.1.0; M2|asked||
|R-172|Distinguishing evidence|evidence field|Required in the careful and deep lanes for defect fixes and changes to existing behavior: mapped cases rerun on the base must fail with the expected failure. For new capability, failing on the base because the tested symbol or route is missing counts, or mapped execution plus a no-weakening check. Advisory in quick. A harness failure is inconclusive; an item whose tests pass on the base proves nothing|V-P2|0.1.0|asked||
|R-188|Stable case IDs|evidence field|Acceptance items and promises map to tests by a tag in the test name (`[AB-1]`, `[R-12]`, or `tenet_AB_1` where a name cannot hold brackets; `AB`, `CF`, `Q` and `V` are reserved prefixes) or a report property (JUnit `tenet.case`, CTRF `extra.tenet_cases`), never by runner-generated names; an acceptance tag counts for a pull request only on lines it adds|V-P2|0.1.0|asked||
|R-173|Baseline-relative measurement|evidence field|`baseline_value`, `rule` (gte, lte, no-regression, max-delta, relative-pct), `scope` and optional `confidence`; benchmarks report samples, never a single run|V-P9, V-M5|0.1.0|asked||
|R-150|Dimensions and fix hints|evidence field|Checks declare their dimension; reports may carry `rule_id`, `path` and a fix hint for the `fix` loop|V-P2|0.1.x|asked||
|R-151|Mutation evidence|evidence field|Eligible, generated, executed, killed, survived, invalid, equivalent, timed-out and excluded counts; `catching_tests` states its unit; lanes may require a threshold on changed lines at M2|V-P2, V-M5|0.1.x; M2|asked||
|R-179|Proof evidence|evidence kind|Prover and version, theorem hash matching the approved definition, obligations discharged, `correspondence`, and an audit: no escape hatches, axioms within the allowlist, no new unsafe code or bypasses|V-P2, V-B7|name 0.1.0; M2|asked||
|R-180|Simulation and differential evidence|evidence kind|Seed, fault profile, steps, properties and replay command; or reference, generator, cases and divergences; seeds replay deterministically|V-P2|names 0.1.0; M2|asked||
|R-130|Visual and runtime evidence|evidence kind|Screenshots, recordings and traces recorded by hash as attestations; a pack may require them for user-facing changes|V-V5, V-P2|0.1.x|asked||
|R-152|Merge-queue evidence|evidence field|Alpha.1 records the queue candidate as an observation. Alpha.2 verifies the exact candidate. In 0.1.x the full evidence covers the candidate, the checks run and the environment, alongside R-153 quarantine. Release and observation keep their own verdicts|V-P2|alpha.1 (record), alpha.2 (verify); 0.1.x (full)|asked||
|R-156|Input provenance|evidence field|Every assignment input carries source, trust and hash (used by R-105)|V-P11|0.1.0|asked||
|R-163|Twins|evidence field|Twins declare version, known differences, last fidelity check and how long it stays valid; simulated evidence names its twin and is marked `stale-twin` and downgraded after expiry|V-P11, V-V5|M2|asked||
|R-182|Selective execution|evidence field|Eligible, selected and skipped tests are recorded; a mapped proving case may be skipped only with a recorded impact result showing it unaffected; a periodic full run reports what selection missed|V-P2, V-B8|M2|asked||
|R-177|Check lifecycle|claim type|Findings can be marked "not useful" from 0.1.0, and a check above its budget (default 10%) is flagged for demotion; each pinned check names an owner (0.1.x); at M2 a known-bad fixture it must keep failing and retirement when cost exceeds benefit|V-P7, V-P2, V-B10|0.1.0; 0.1.x; M2|asked||
|R-148|Reviewer metrics|view|Precision, missed defects, false blockers, abstentions and consistency by class; a second model family confirms material findings where available|V-P2, V-M2|M2|asked||
|R-183|Maintainability audit|evidence kind|Audits ask whether a maintainer would merge as is, with three reasons|V-M2, V-M10|M2|asked||
|R-126|Sampled scoring|evidence kind|A random sample of runs and changes graded against declared criteria; failures become proposed packets|V-V7, V-M2|M2|asked||
|R-127|Comparison|evidence kind|Two to six configurations on the same pinned tasks; hard failures beside averages; population disclosed|V-P9, V-V7|M2|asked||

## Decisions

|ID|Entry|Type|Rule|Serves|Release|Origin|Cites|
|---|---|---|---|---|---|---|---|
|R-090|Approval staleness|decision rule|An `approve` is fresh only while its subject is current|V-P2|0.1.0|asked||
|R-108|Decision rights and delegation|decision name|Several decision-makers with roles and keys; delegation with expiry|V-V1|0.1.0; 0.1.x|asked||
|R-123|Channels|decision rule|Requests on the pull request (0.1.0), chat and trackers (M2); an answer counts at the strength its channel proves|V-V8, V-P12|0.1.0; M2|asked||
|R-145|Approvals by risk|policy feature|0, 0, 1, 2 human decisions for express, quick, careful, deep; protected changes `forge-verified` (`person-present` at `assure`); projects may only tighten|V-P7, V-B2|0.1.x|asked||
|R-141|Campaign approval|decision name|One decision covers child packets inside the campaign's declared scope; each child is still verified|V-V7, V-B2|0.1.x|asked||
|R-153|Quarantine|decision name|Waives a flaky check; the claims it covered are re-checked and need substitute evidence, a limited exception or a narrower endpoint; the board shows time uncovered and the restoring owner|V-P2, V-B3|0.1.x|asked||
|R-147|Review queue and class approval|view; decision name|A review queue with age and limits (0.1.x); approving a class of low-risk changes under policy (M2)|V-M6|0.1.x; M2|asked||
|R-121|Factory changes|work-item type|A `factory` packet states its purpose: improvement (needs R-127), mandatory replacement, containment (immediate, reviewed afterwards) or restoration|V-P9, V-B2|0.1.x; M2|asked||
|R-160|Hotfix and heal|decision name|A signed override, a pinned smoke check and an automatic reconciliation packet due within 48 hours; a `heal` loop for main-line or guardrail failures|V-V5, V-P6|M2|asked||

## Work items, subjects and policy

|ID|Entry|Type|Rule|Serves|Release|Origin|Cites|
|---|---|---|---|---|---|---|---|
|R-091|Packet identity|work-item type|`packet.yaml` holds only identity; everything else is events|V-P10|0.1.0|asked||
|R-186|Pull-request native|work-item type|In the `minimal` pack the pull request is the work item, identified as `pr-<number>`: its description holds intent and acceptance items (quick changes need no packet folder; the recorder keeps their state under `works/pr-<number>/` on the records ref); a draft is Define, ready for review is Verify, merge is Integrate. Careful and deep work, or work off the forge, also gets a packet folder. Spec deltas may ride in the same pull request. In the careful lane the one human act is approving the definition; merge is allowed by policy once claims hold; `tenet move` is needed only for loop-backs and work off the forge|V-P7, V-V1, V-B10|0.1.0|asked||
|R-213|Spec change|work-item type|Deltas per document (added, modified, removed, with IDs) shown at the top of the pull request that carries them, either alongside code or in a `spec` work item of its own; Integrate merges them and bumps each document's version; a deep-lane spec change also records the reason in the ledger|V-P18, V-P9|0.1.0|asked||
|R-142|Work types|policy feature|Pack-declared work types (feature, defect, debt, spec, migration-target, and `explore`, which has no claims and cannot merge as production; investigation and incident at M2), each with its loop, evidence, outcome unit and quality floor|V-V7, V-M7|0.1.0; M2|asked||
|R-092|Express lane|policy feature|Granted by CI (the recorder, labelled advisory below `verify`; the attest job from `verify`) within size, denied paths and per-area daily limits; configuration, data and flag changes with runtime effect are never express by default; ends at `checked` before merge|V-P7, V-P2|0.1.x|asked||
|R-140|Campaign|work-item type|One intent over a target-set snapshot, with counts of automated, manual, unresolved and excluded targets and a stop threshold; waves and automatic halt at M2|V-V7|0.1.x; M2|asked||
|R-144|Areas|policy feature|Paths mapped to owners, decision rights and work-in-progress limits; read from CODEOWNERS when not declared|V-V1, V-V2|0.1.x|asked||
|R-157|Scoped rules|policy feature|Directory-scoped rule files attached to assignments whose paths match|V-P7|0.1.x|asked||
|R-149|Circuit breakers|policy feature|Change failure, revert rate or a leading indicator (health fall, duplication or churn spike) past a threshold switches express off and raises lanes until a decision restores them|V-M5, V-P12|M2|asked||
|R-161|Cleanup campaigns|work-item type|Prioritized by hotspot, including dead-code and stale-flag pruning, within a capacity share; each declares a preservation claim, a reason, a stop condition and an owner who may decline cosmetic work; sampled later|V-P7, V-P9|M2|asked||
|R-129|Governed knowledge|work-item type|Learned conventions are proposed as changes to `AGENTS.md`, skills or knowledge records, never written silently|V-P10, V-P7|M2|asked||
|R-181|Configuration, data and flags|subject kind|Same risk and rollout rules as code|V-V5, V-B6|names 0.1.0; 0.1.x; M2|asked||
|R-212|Specification section|subject kind|A level-2 section of a specification (ALG-02), a `section` subject with its `level`. Its state (`draft`, `blessed`, `rejected`, `deferred`), the digest and text it was blessed with, its flags (`edited`, `sources-changed`), the strength its blessing was recorded at (`self`, `forge`, `signed`) and the revision its citations were checked at live in the document's front matter (tech-spec/contracts.md). The last blessed text stays in force until a successor is blessed; rejecting or deferring an edit keeps it|V-P18, V-P2|0.1.0|asked||
|R-165|Platform objects|subject kind|Changes inside platforms (pipelines, ontology or schema objects, dashboards), with branch semantics from the binding|V-P4|M2|asked||
|R-167|Scale tiers|binding|Git event files; git with compaction and the evidence store; an external append-only store under the same schemas|V-B9, V-H5|definitions 0.1.0; M3–M4|asked||

## Factory definition and execution

|ID|Entry|Type|Rule|Serves|Release|Origin|Cites|
|---|---|---|---|---|---|---|---|
|R-120|Factory definition|policy feature|Workers, triggers, environments, identities, routing, channels, scorers and comparison suites in `factory.yaml`; validated and recorded on every run; executed by engines and platforms|V-V7, V-P9|0.1.x; M2|asked||
|R-125|Routing|policy feature|Work routed to models and harnesses by lane, role or complexity; recorded per run|V-V7, V-M7|0.1.x; M3|asked||
|R-122|Triggers|binding|Forge events, schedules and signed webhooks create intake packets with source and event identity; duplicates are linked|V-V5, V-P11|M2|asked||
|R-162|Tool registry|policy feature|Tools with owner, scopes, side-effect class and default-off status, granted by ID and narrowed per assignment|V-P11, V-B2|M2; M3|asked||
|R-166|Context providers|binding|Budgeted, provenance-tagged context added to assignments; Tenet never builds it|V-P4|M3|asked||
|R-128|Hand-off|event data|A local session takes and returns a packet's lease; executors recheck authority and lease generation before consequential effects|V-V8, V-P11|M3|asked||
|R-158|Session links and steering|event data|`session_url`, `preview_url`, `run.steered` and subrun summaries|V-V8, V-P11|0.1.x|asked||
|R-131|Platform mappings|conformance|Published mappings from Warp Factories and a Symphony-style dispatcher, with a worked conformance claim|V-V4, V-H5|0.1.x|asked||

## Views and measurement

|ID|Entry|Type|Rule|Serves|Release|Origin|Cites|
|---|---|---|---|---|---|---|---|
|R-159|Attribution|view|Who selected, authored, reviewed, authorized and released each change, and whether a person edited it; feeds autonomy share|V-M9, V-V4|0.1.x|asked||
|R-155|Funnels and cost per outcome|view|Attempted, built, verified, accepted, shipped and influenced per work type; cost per outcome unit|V-M7, V-M4|0.1.x; M2|asked||
|R-178|Durability|view|Lines rewritten or reverted within 30 days, by agent definition and work type|V-M10, V-M5|0.1.x|asked||
|R-184|Cost of the next change|view|Similar tasks in the same area compared over time; sampled next-change exercises|V-M10, V-M7|M2|asked||
|R-164|Durable summaries|view|A decision summary survives the expiry of its telemetry; what can no longer be re-checked is shown|V-B3|M2|asked||
|R-185|Evaluator self-verification|conformance|Property tests of the evaluator over generated event histories (0.1.0); bounded model checking (M2); proofs optional later|V-P9, V-H3|0.1.0; M2|asked||

## Ideas (not scheduled)

|ID|Entry|Type|Rule|Serves|Release|Origin|Cites|
|---|---|---|---|---|---|---|---|
|R-190|Semantic authorization|policy feature|Whether an action fits the authorized intent, scope and subject, recorded as evidence from an outside judge|V-P1|idea|asked||
|R-191|Dissent and appeal|decision rule|A recorded minority view on a decision, and a route to reconsider it|V-V1|idea|asked||
|R-192|Fleet view|view|Active runs, session links, frozen state, factory-definition digest, spend against budget|V-V7|idea|asked||
|R-193|Agent interoperability mappings|binding|Tool scopes per agent and a mapping to published agent-card formats|V-P4|idea|asked||
|R-194|Assurance profiles|policy feature|Per domain (parser, migration, authorization, distributed system) the required method mix|V-P2|idea|asked||
|R-195|Visibility classes|policy feature|Evidence and decisions public in the repository or held by reference elsewhere|V-B5|idea|asked||
|R-196|Assurance-case export|binding|Claims, arguments (gate rule IDs) and evidence exported in an assurance-case format|V-P4|idea|asked||
|R-226|Scope drift|rule|Files changed outside the paths the task was assigned, shown as advisory findings ("touch only what the task needs")|V-P5|idea|documented|doc: tenet/ledger/L-0028-working-practices-ship-with-tenet.md#decision-or-event|
|R-227|Changed-line coverage|claim type|A measurement of test coverage over the lines a change adds or modifies, against the project's threshold|V-P2|idea|documented|doc: tenet/ledger/L-0028-working-practices-ship-with-tenet.md#decision-or-event|
|R-228|Acceptance by a person (UAT)|claim type|In the careful lane, a person confirms the change works as intended, attaching artifacts (screenshots, a rendered report) as attestation evidence|V-P1, V-V5|idea|documented|doc: tenet/ledger/L-0028-working-practices-ship-with-tenet.md#decision-or-event|
|R-229|Changelog updated|claim type|A change of a declared kind updates the changelog with a dated entry|V-B3|idea|documented|doc: tenet/ledger/L-0028-working-practices-ship-with-tenet.md#decision-or-event|
|R-230|No secrets or ignored files committed|claim type|The change adds no file matching secret patterns or the project's ignore rules, checked before merge|V-B5|idea|documented|doc: tenet/ledger/L-0028-working-practices-ship-with-tenet.md#decision-or-event|
|R-197|Waiver budget|policy feature|Open waivers per area past a threshold raise lanes, like a circuit breaker|V-P9|idea|asked||
|R-198|Native provenance import|binding|Forge and agent provenance (artifact attestations, agent session logs, bot-authored pull requests) recorded as evidence with its source and strength|V-P4, V-P2|idea|asked||
|R-199|Setup from GitHub|binding|A workflow that runs `init` and opens the onboarding pull request from the forge, with nothing installed locally|V-V3|idea|asked||
