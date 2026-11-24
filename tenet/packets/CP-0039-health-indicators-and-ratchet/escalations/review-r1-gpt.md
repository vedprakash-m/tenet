# CP-0039 independent definition review · round 1 (GPT)

Reviewed `shape/cp-0039` at `a2b91a8` against `origin/main` at `a64fdf2`. This is a definition review. Examples below describe the fixtures the definition should make possible. File and line references to `definition.md` and `evidence/research-code-health.md` are to the shaping branch.

## Blocking findings

### F1 · blocker — Automatic tightening has no authorized write or ordering protocol

**Definition §3, lines 24 and 30; §8, line 75:** “On `main` matching `(tool, tool_version, config_digest)`: `scalar` updates **only if improved**; `finding_set` prunes resolved fingerprints” and “Baseline + workflows in `protect`”; “Confirm recorder auto-tightening `.tenet/health-baseline.json` on `main` (avoiding `protect` friction), advising only on PRs.”

`protect` requires `change-policy` for file changes. The recorder currently writes evidence and board records. The definition neither authorizes receipt-driven updates to a protected file nor explains when a new baseline becomes authoritative for an already-open PR. An older main run can also arrive after a newer one and tighten against a result main no longer holds. Treating any missing finding as resolved lets partial or failed reports prune the baseline. An incomplete run could therefore remove legitimate allowances until a policy-authorized correction. Sources: `tech-spec.md:145,155`, `ci.md:159–167,179–185`, `kernel.md:36–40`, PRD R-103/R-175 (`prd/catalog.md:14,16`), and `research-code-health.md:31–35,61`.

**Accept:** Define one authoritative baseline location, the identity and completeness of admissible main measurements, who can write, and when a target evaluation picks up the result. If using a tracked file, propose the exact Owner-approved exception for authenticated, monotonic tightening, or route writes through `change-policy` and reconcile that choice with automatic tightening. A trusted records store is another option if its revision and digest bind each evaluation and the reviewable export has clear precedence. Handle first adoption, config resets, declined/waived runs, missing samples, partial scopes, concurrent writers, stale reruns, and idempotence. Add goldens for main runs arriving in reverse order, partial report, malicious baseline edit, and an in-flight PR when tightening lands. Show that waiving a regression cannot widen the baseline or erase that debt.

### F2 · blocker — Health provenance and missing evidence can turn “unknown” into “holding”

**Definition §3, lines 29–30; AB-3/AB-7, lines 38, 42:** “Each `measurement` records `{tool, tool_version, config_digest}` + `report_sha256`” and “configs from `base`; **tamper check** flags PR edits to tests (`ALG-09`), configs/`inputs`, baseline, workflows, or added suppressions”; “CI `measurement` only, never `self`.”

The report is data from the checked change. CI origin and a report hash do not show that the pinned tool ran using the target's complete effective configuration. A changed tool entry point, plugin, script, ignore input, dependency or report producer can make a valid-looking report omit findings. The definition also has no outcome table for absent, malformed, partial, incomplete-scope, failed, or mismatched reports. An empty finding list and an unreadable check must have different outcomes. The proposed `ci.md:48` field additions alone do not meet evidence binding. Sources: PRD R-100/R-110 (`prd/tooling.md:101–102`), `ci.md:43–45,173–185,229–245`, `kernel.md:36–40`, `evidence.md:12`, `research-code-health.md:53–55,63,75–77`. [ImpossibleBench §§4–5](https://arxiv.org/html/2510.20270v1)

**Accept:** Bind the trusted receipt to the tested commit, target revision, check identity and pinned executable/config/input digests, report digest, adapter version and measured scope. Define how the trusted runner or verifier establishes these fields, which inputs may come from the subject, and what is merely a tamper observation. Put tamper classes through R-103's trust/weakening/mechanics paths. A required control whose provenance or completeness cannot be established follows CI §10 at `verify`/`assure`, with an explicit missing reason and no tightening. Document the remaining limit for checks that execute subject code. Include fixtures for a valid empty report with demonstrated coverage, a missing or truncated report, and a changed declared versus undeclared checker input. A report with the wrong subject or pinned input digest must be inadmissible.

### F3 · blocker — Scalar comparisons can use different populations

**Definition §3, lines 23–26; AB-4, line 39:** “`scalar` (`value`, `unit`, `direction: up|down`, `aggregation: touched_lines|area|sampled_runs`, `min_changed_lines?`, `samples`)” and “`scalar` updates **only if improved**”; “`scalar` `{kind: absolute|relative-pct, value}`.”

A persisted area score of 80% and a PR score of 100% for a two-file slice do not show improvement. Neither do scores for two different slices, or for changed files present on only one side. The contract also cannot distinguish 5 percentage points from 5% relative, does not define relative tolerance at a zero baseline, and does not require a common denominator or unit. One implementation could ratchet after a single slice and then block unrelated work. Sources: R-175 (`prd/catalog.md:16`), `evidence.md:12`, ALG-06 (`algorithms.md:98–104`), `research-code-health.md:35,61`.

**Accept:** For every supported aggregation specify the population and baseline source, the projection on both revisions, direction, value/denominator and units, exact comparison and rounding. A touched-slice metric needs comparable base and tested evidence or a defined stable area fallback. An area baseline must not tighten from a favorable PR slice. Specify equality at tolerance, zero or empty denominators, deleted/added units, non-finite values and incompatible reports. Keep sampled/advisory metrics out of automatic authoritative tightening unless the sampling rule defines a comparable improvement. Add worked up/down, absolute/relative, zero-base and mixed-area cases.

### F4 · blocker — Finding identity and touched scope can both lose real regressions

**Definition §3, lines 23–25 and 29; AB-2/AB-5, lines 37, 40:** “`fingerprints[]`: `sha256:` over `(rule_id, file, normalized_symbol, snippet_hash)`”; “Checks `touched_lines` hunks, `touched_files` new fingerprints, or `area`”; “shift-proof fingerprints.”

Two violations in one symbol can share all four components. A set can then treat a second occurrence as existing debt. A rename changes the path in the hash, so a rename can also make old debt look new while an edit can move a fresh violation outside a reported location. The proposed diff command does not specify how comparisons handle old- versus new-side intervals, file deletions, pure renames, rename ambiguity across scopes, or ambiguous or unlocated findings. A deletion that breaks an unchanged document reference needs an attributable observation even though it has no added-side hunk at the reference. Sources: R-175/R-176 (`prd/catalog.md:16–17`), ALG-06 area rule (`algorithms.md:95–97`), ALG-14 old-side mapping (`algorithms.md:186–194`), `research-code-health.md:35,61,65`.

**Accept:** Specify the pinned comparison commits for merge-candidate and head-only evaluations, canonical fingerprint bytes and missing fields, occurrence counts or a deterministic one-to-one matching rule, old/new path mapping and rename tie/failure behavior, and line/range, file and area attribution including deletions and locationless findings. Define a path protocol that survives quoting, unusual filenames and platform conventions. For ambiguity, name when the evaluator falls back to a fully measured area and when it says unknown. Test duplicate occurrences, line shift, pure rename, rename plus a genuinely new sibling, cross-area move, deletion-only ref break, unknown area and an advanced target on a head-only run. Verify that touched-file analysis does not confuse changed line numbers with newly introduced findings.

### F5 · blocker — The default small-change exemption makes an applicable rule disappear

**Definition §3, line 26; AB-5, line 40; §8, line 77:** “Ratios default `min_changed_lines: 20` (`not-applicable` below)” and “`<20` lines `not-applicable`.”

The rule applies the floor to every ratio, including area-level metrics. A sequence of under-20-line changes could indefinitely worsen an enforced R-175 indicator without crossing its tolerance, finding a waiver, or even reporting a regression. The cited vendor precedent is an exemption for particular PR metrics, and R-227 is still an idea. There is also no defined counting unit or aggregate safeguard. Sources: R-175/R-227 (`prd/catalog.md:16,115`), `research-code-health.md:31–33,61,65`. [SonarQube quality gates](https://docs.sonarsource.com/sonarqube-server/quality-standards-administration/managing-quality-gates/introduction-to-quality-gates)

**Accept:** Remove the universal default exemption from enforced ratios. Permit low-sample labeling in advisory results while retaining the observation. If a narrower blocking-rule exemption is intended, specify which indicator and denominator it affects, how cumulative deterioration is detected, and the exact Owner-approved R-175 policy text. Cover a one-line materially adverse area change and a sequence of small changes that worsens the same scope.

### F6 · blocker — Pinned architecture rules lack a reliable input and unit of attribution

**Definition §3, lines 23, 25; AB-8, line 43:** “Architecture (`R-176`: layers, imports, cycles), lint/type/dead-code, broken doc refs use `finding_set` on `measurement`”; “for unsplit rules (cycles, imports, duration, flake)”; “new edge fails `enforce`, baselined free.”

An edge is not necessarily a violation. A new edge can close a cycle through multiple areas, and a detector can report a pre-existing cycle from a different starting node or merge it with another cycle. A path-and-snippet fingerprint does not establish which violations are old or which areas are affected. Generic findings also need a required pin and fix hint. Sources: R-176 (`prd/catalog.md:17`), pinned check subject (`tech-spec.md:92`), ALG-06 applicability (`algorithms.md:95–97`), `research-code-health.md:11,22,61`.

**Accept:** Define a tool-neutral pinned architecture report contract with stable rule, nodes, directed edges or equivalent violation identity, measurement scope/completeness and fix hint. Specify whether affected areas are derived from newly invalid edges, canonical cycle membership, or another deterministic rule, and how external/unknown nodes and partial graphs behave. Add a passed fixture for a new allowed edge, a regression for a cross-area cycle introduced by one edge, and an unchanged baseline for reordering an existing cycle. If an adapter cannot supply sufficient identity or scope, it may report diagnostics with an explicit limitation.

### F7 · blocker — Policy defaults, promotion, and tightening do not resolve to one mode

**Definition §3, lines 26, 28; AB-1, line 36; §5, line 51:** “new indicators start `mode: observe` until `change-policy` promotion”; “Sampled metrics (duration, flake) record `samples` + `quarantined` count and cap at `advise`”; “`health-ratchet` … `observe | advise | enforce | enforce`”; “Config validates `health`, merges tightly.”

At `verify`, a newly declared indicator has both an `observe` and an `enforce` instruction. It is unclear whether a mode cap may suppress an otherwise required rule, whether `mode: enforce` in a PR is a promotion, or whether a policy layer may change kind, polarity, scope, tolerance unit or owning check. ALG-06's smallest comparable tolerance does not compare 2 items to 2% or detect a widened exemption. Sources: R-214/R-215 (`prd/tooling.md:89–90`), `tech-spec.md:152–168,172,181`, ALG-06 (`algorithms.md:94–104`).

**Accept:** Provide a precedence table for adoption level, pack/area/project rules, creation state, promotion decision and non-enforceable metrics, including which inputs are target-pinned. Distinguish the rule default from an indicator's eligibility for enforcement. Define incompatible fields and what counts as tightening (including a scope narrowing, sample-floor increase, unit change or indicator removal). Cover new-at-verify, approved promotion, target/PR mismatch, noisy metric capped at advise and mixed tolerance kinds. If a deliberately advisory metric cannot satisfy a lane's required claim, the policy must say so rather than granting credit.

### F8 · blocker — Health waiver expiry and authority do not fit the decision contract yet

**Definition §3, line 27; AB-6, line 41; §5, line 54:** “`forge-verified` (`person-present` at `assure`), non-author”; “**mandatory `expires_at`** (UTC RFC 3339, default **30d**, capped by `waiver_max_days`)”; “expiry re-surfaces decline on `board`”; “require `reason` + `expires_at` (30d) on `accept-health-regression`.”

The shared decision model uses `expiry` and retains historical decisions. The definition never maps its new field to the signed decision, selects the start of the 30-day window, or identifies what a fresh post-expiry evaluation can block. A per-evaluation waiver cannot simply be replayed as authority for other changes. Non-author account comparison alone is also weaker than checking the actor who caused the regression and their agent. CI §6 currently lists `forge-verified` for this waive at all levels. An assure-only strengthening needs an explicit approved rule or a declared policy option. Sources: R-175 and R-143 (`prd/catalog.md:16,18`), R-203 (`prd.md:85`), `tech-spec.md:64`, `ci.md:194–211`, `kernel.md:34,46–50,54–62`. The research treats expiring waivers as a local convention (`research-code-health.md:33,77`).

**Accept:** Reuse `expiry` and the existing bound request/replay machinery, with exact issuer time, deadline inclusivity and cap. Identify who may waive each scope, apply R-203 to authors and agents acting for them, and resolve the intended strength at each level without inventing a second decision channel. Record the active claim/exception on current health and readiness after expiry without rewriting the old decision or retroactively unmerging a PR. Include same-account/agent, wrong-claim or evaluation, trust-surface, exact-expiry and replay-after-expiry fixtures.

### F9 · blocker — The durability acceptance item has no measurable outcome

**Definition §2, line 17 and AB-10, line 45:** “`R-178` 30-day durability”; “`R-178` 30-day durability view & 60k-char card rendering match goldens.”

R-178 requires lines rewritten or reverted, grouped by agent definition and work type. There is no numerator, line lineage rule, time window anchor, attribution join, or distinction between mature cohorts and recently merged work. An implementer can pass a small golden with raw churn and deliver neither required grouping nor the line-level outcome. This also needs a defined result when history or attribution is missing. Sources: R-178 (`prd/catalog.md:98`), CP-0039 (`plan/0.1.x.md:25`), and tech spec metrics (`tech-spec.md:224`).

**Accept:** Define which integration revisions and lines enter the cohort, a pinned evaluation time/window and merge model, rename/move/deletion/revert semantics, counting a line only once, and how immutable evidence supplies agent definition and work type (including human, mixed and unknown attribution). Show sample size and incomplete-history or provisional cohorts separately. Split durability from card formatting in the acceptance items. Add deterministic fixtures for a revert, a rename, multiple rewrites of one line, a squash or merge, an immature cohort and missing attribution.

## Other findings

### F10 · should — Collect feedback without treating waivers as false blocks or making quick changes do extra work

**Definition §3, line 28; AB-9, line 44; §7, line 66:** “`/tenet not-useful <finding>` + waivers >10% or >2 false blocks/100 flag demotion”; “`"not useful"` rate (`>10%`), waiver/false-block rate (`>2/100`).”

An intentional, authorized regression can be both a correct refusal and a valid waive. Counting it as noise makes an agent's repeated waivers a way to get a useful rule flagged. Marks on retries can also multiply noise. The 10% budget needs a denominator. Exactly two false blocks per 100 meets neither the vision's strict under-two goal nor the definition's greater-than-two demotion trigger. Those are distinct decisions and should be labeled that way. The proposed owner field attaches to indicators while R-177 applies to pinned checks. Sources: R-177 (`prd/catalog.md:39`), R-216 (`prd/tooling.md:91`), `vision.md:79`, `kernel.md:66–68`, `ci.md:208`.

**Accept:** Name the per-check owner, with resolved owners visible per indicator. Define unique eligible changes/findings, retry deduplication, attribution and reporting window, and track feedback, approved waives, overrides and independently adjudicated false blocks in separate counters. Demotion is a retrospective flag, not a mode transition. Report samples and require no routine quick-lane input. Cover a correct waived refusal, repeated comments, zero denominators, exactly two false blocks, and automatic finding owner routing.

### F11 · should — Separate the interoperable core, optional adapters and scope-freeze work

**Definition §2, lines 18–19; §3, line 29; §6, lines 60–62:** “`R-151` mutation ingestion (Stryker schema)” and “`R-227` changed-line coverage (`idea`, prepared by `ALG-15` + LCOV/Cobertura”; “`checks.<name>.format`: `tenet-health-json` … `sarif`, `lcov`, `cobertura`”; “Biome `noExcessiveCognitiveComplexity` `info`.”

The named report formats can be adapters while the core stays tool-neutral. The boundary is unclear in AB-3. CI §3 sets bundle intake bounds (`ci.md:139–144`). AB-3 needs to say which limits apply to the whole bundle and which apply to an individual report. LCOV and Cobertura do not intrinsically supply Tenet's required provenance tuple, and the definition should distinguish area trend ingestion from changed-line coverage execution. The latter is an idea and CP-0036 owns mutation. R-151 also requires the `catching_tests` unit, which the scope sentence omits. The dogfooding suggestions are repository practice pending the Owner's decision. Sources: R-003 (`prd/tooling.md:26`), R-151/R-174/R-227 (`prd/catalog.md:26,31,115`), DEC-38 (`prd/decisions.md:46`, `plan.md:55`), `plan/0.1.x.md:22,25`, L-0038 consequences, `research-code-health.md:65–71`.

**Accept:** Require a versioned normalized input and a trusted receipt wrapper for adapters that lack provenance fields. Mark emitter/tool names and dogfooding as non-normative. State whether LCOV/Cobertura are only area adapters or deferred with the changed-line claim, and remove any AB that implements that idea in CP-0039. State CP-0036's handoff as the nine counts and unit, and preserve R-174's pack-selected methods. Identify which detection remains unavailable with only the generic adapter. No JavaScript suppression syntax is a requirement for other stacks.

### F12 · should — Card ordering and overflow need to preserve actionable summaries

**Definition §3, line 30; AB-10, line 45:** “`Health: N holding · M improved · K regressed`”; “blocking health/tamper untrimmed at 60k chars; hidden if unconfigured”; “60k-char card rendering match goldens.”

An unbounded number of high-severity findings can exceed the forge budget even before other essential sections. Different renderers can also make missing results disappear into the totals. CI already describes a full record plus a short pointer when essential lines cannot fit, and the budget is shared when several PRs have one head. Sources: `ci.md:151`, contracts §5 (`contracts.md:84`), `tech-spec.md:221`, `research-code-health.md:39,61`.

**Accept:** Specify status totals (including unknown, not applicable and waived), formatting, ordering, and a bounded summary with a durable link to the full card on overflow. Keep the real conclusion and blocking reason visible even with multiple cards sharing a head. Add no-health-config, all-unknown, at-limit, over-limit and shared-head fixtures.

### F13 · nit — Scope the empirical claims to their studies

**Definition §1, line 11:** “offline dashboards go unread (~0% fix rate vs ~70% on diffs)” and “agents game mutable graders (30%–76% cheating).”

Those figures describe particular deployment and evaluation conditions. The Meta comparison concerns how findings were delivered, rather than measuring whether dashboards were read. RE-Bench and ImpossibleBench study different tasks and setups. They justify protecting the check surface without giving Tenet a predicted failure rate. Sources: `research-code-health.md:39,51–53`. [Meta static analysis study](https://discovery.ucl.ac.uk/id/eprint/10084236/), [METR](https://metr.org/blog/2025-06-05-recent-reward-hacking/), [ImpossibleBench](https://arxiv.org/html/2510.20270v1)

**Accept:** Attribute the fix rates to Meta's offline lists versus review comments, and present the model numbers as separate examples from stress tests. Preserve the product implication that evaluation inputs and evidence must be protected.

VERDICT: BLOCKING 9
