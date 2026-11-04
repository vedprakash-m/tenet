# Specification: Workload obligation, receipt and fitness trend (QLT-05)

> Status: **draft, unreviewed.** Written 2026-11-03 under the owner's blanket direction of that date to build candidates on an isolated branch. That direction is not a sign-off. This spec is not part of the canonical specs, changes no source, and authorizes no implementation. Open owner questions are in §9.
> Sources: PRD QLT-05, §5.16 (starter reference workload), §4.3 (`fitness-trend-degraded`), AC-19, AC-20; Tech Spec §§9.1, 9.2, 9.3, 9.6, 12.7, 8.7, 8.8, Appendix C; `docs/audits/2026-11-03/unmapped-musts.md` row QLT-05; `schema-migration.md` §16.7.

## 1. Outcome

A project that declares a reference workload and fitness functions gets them checked by the kernel, not only by a script the model runs. A Deep contract runs the workload as a required obligation and receives a receipt the kernel validated. The measurements are kept across contracts. When a fitness function worsens by its own declared threshold across its declared number of consecutive workload runs, the kernel raises an attention item that needs a disposition, and the verdict says so with `fitness-trend-degraded`. Reports of trends never claim that the whole application meets its workload.

Out of scope: choosing or changing the workload protocol or its numbers (PRD §5.16, provisional); reference-machine qualification (the receipt stays unqualified, as the harness already reports); the starter's admission-policy capacity problem (`admission-policy.md`, plan §12.16), which can make the reference run fail for reasons unrelated to this spec; performance of the kernel itself (NFR-01).

## 2. Current state (read from this tree, `34d6030`)

- `Obligation.kind` already allows `"workload"` (`core/schemas.ts:98`). Nothing creates, runs or judges one. `Receipt.kind` is a free string. The receipt shape has test counts and failures but no measurement fields.
- `fitness-trend-degraded` exists only as a reason code (`core/reasons.ts:26`). It has no producer (plan §13, 2026-11-03 audit entry).
- Every obligation in `work.obligations` must have a fresh passing receipt for the verdict to reach `checked-local` (`core/verdict.ts` `judgeObligation`). The `category` field (`release`, `affected`, and others) is stored but not read by the verdict or by `reconcile.ts`. So adding a workload obligation to every contract would block every contract; it must be added by lane.
- `receiptsOf` treats every non-static obligation as a test obligation run by the shared Vitest report (`verbs/check-evidence.ts`, `tests = run.toRun.filter((ob) => !isStatic(ob))`). A workload obligation needs its own routing, as the e2e obligation has (`kind: "static"`, `tool: "playwright"`, `verbs/check-execute.ts`).
- The workload harness exists only in the loan-desk golden fixture (`test/fixtures/golden-tasks/loan-desk/workload/*.txt`, `docs/workload.md.txt`). It prints one JSON report on stdout; fields include `mode`, `referencePass`, `reasons`, `protocol.minimumSamples`, `operations.<op>.successful.{samples,p50,p95,p99}`, `metrics.peakRssBytes`, `metrics.eventLoopP95Ms`, `database.duplicateActiveItems`, `environment`, and a fixed `qualification: "unqualified"`. Its own text says there is "no kernel workload receipt, baseline/trend comparison, threshold attention or accepted qualification evidence yet." Exit 1 means a target failed. `--smoke` runs two seconds and never passes.
- The neutral starter has no `workload/`, no `workload.json` and no `workload` key in `recipe.json`. Tech Spec §5.1 and §13 name `workload.json` as a starter resource and `workload` as a recipe-manifest field. `recipe.json` lists `protectedPaths` without any workload path.
- The starter's own acceptance of the reference run currently fails (plan §12.16: operation busy and hash acceptance stay failed). A kernel obligation will report that failure honestly; it does not fix it.
- Persisted records cannot gain fields freely. Nested `z.object`s strip unknown keys on every publish, so an older kernel would erase a new field (`schema-migration.md` §16.7). A new stored field belongs to a schema version the owner approves.
- Windows refuses mutating verbs. Check-pipeline tests run on POSIX CI. The report parser and trend rule are pure and run anywhere.

## 3. Requirements

| ID | Requirement | Source |
|---|---|---|
| WR-1 | A project's workload declaration names the command, the report location, the minimum samples and each fitness function with its measure, target and its own degradation threshold. A malformed declaration makes the obligation inconclusive; it is never replaced by defaults. | QLT-05; TS §12.7; TS §9.2 (no silent default for a declared check) |
| WR-2 | A Deep contract with a valid declaration owes a `workload` obligation, run once per full candidate check after the other required obligations pass. Standard and Quick contracts do not owe it. | TS §9.2 category `release`; TS §5.3 |
| WR-3 | The kernel runs the declared command in its own process group under the existing runner and envelope rules. The report is untrusted: bounded, parsed, and judged by the kernel against the declared targets. | TS §9.3, §9.6 |
| WR-4 | The receipt is `pass` only when the run is a reference run, has at least the minimum samples, meets every declared target, and the report's own verdict agrees. A smoke run, too few samples or an unreadable report is `inconclusive`. A missed target is `fail`. | TS §9.1 (validation: protocol followed, minimum samples); TS §9.6 |
| WR-5 | Each valid receipt yields one measurement per fitness function. One point per contract is kept in a bounded series, tagged with the environment the report states. A change of environment starts a new comparison. | QLT-05 ("report trends across changes") |
| WR-6 | The trend rule is applied by the kernel with the thresholds the declaration gives. When it fires, the contract gets one attention item per fitness function and window, the verdict carries `fitness-trend-degraded`, and a disposition is required. | QLT-05; PRD §4.3 |
| WR-7 | Every workload receipt and every trend report says it measures the declared reference workload on the recorded machine and does not show whole-application conformance. | QLT-05 ("without claiming whole-application conformance from changed flows") |
| WR-8 | The kernel never writes a fitness measurement, threshold or baseline from a model's statement. Only a kernel-run receipt feeds the series. | `copilot-instructions.md` (binding facts written only by the kernel); EVD-12 |
| WR-9 | Weakening a declared threshold is visible: edits to the declaration file need authority or raise an attention item. | TS §8.7 (test-discovery and configuration changes); SEC-10 spirit |

## 4. Proposed behavior and examples

Tests named here do not exist yet. `[QLT-05]` is added to a test title only when E1 to E12 pass in the built kernel on POSIX CI, because the requirement has four clauses (declare, report trends, no whole-application claim, escalate). A pure-core test alone proves none of them end to end.

| Example | Expected behavior | Test file |
|---|---|---|
| E1: a Deep contract in a project with a valid `workload.json` | `OB-workload` (kind `workload`, category `release`) is among the contract's obligations. A Standard contract in the same project has none. A Deep contract in a project with no `workload.json` has none and no reason about workload. | `packages/kernel/test/workload-receipt.test.ts` |
| E2: `workload.json` has an unknown key, a non-numeric target, `consecutive` below 2, a duplicate fitness id, a report path outside the run directory, or a command with a shell metacharacter string instead of an argument array | The check yields an `inconclusive` receipt with `adapter-unsupported-config` and a limitation naming the key. The workload command is not run. | `workload-receipt.test.ts` |
| E3: a reference report meets every target, has the minimum samples, and exits 0 | Receipt `pass`. `workload.measures` holds each fitness value. `limitations` carry the WR-7 sentence. | `workload-receipt.test.ts` |
| E4: one operation's p95 is over its target; exit 1 | Receipt `fail`, reason `evidence-failed`, failure names the fitness id and the two numbers. | `workload-receipt.test.ts` |
| E5: smoke report, samples below minimum, report missing, invalid JSON, over 10 MB, depth over 64 | Receipt `inconclusive` with `not-executed`, `report-missing`, `report-invalid` or `population-mismatch` as the existing table in TS §9.6 gives. A smoke report never passes. | `workload-receipt.test.ts` |
| E6: exit 0 but the report's `referencePass` is false; or exit 1 but every target is met; or the report's own reasons list a failure the kernel's targets do not | Receipt `inconclusive`, `report-contradiction`. | `workload-receipt.test.ts` |
| E7: the same candidate is checked twice | One series point per contract, taken from the latest fresh receipt at `finish`. An aborted contract adds none. Two different candidates in one contract still add one. | `packages/kernel/test/fitness-trend.test.ts` |
| E8: values 100, 110, 121 ms (list p95), declared 20% over 3 consecutive | The rule in §5.5 fires at the third point (21% above the window start, never decreasing). It does not fire at the second. 100, 130, 100 does not fire (not monotone). 100, 100, 100, 119 does not fire. | `fitness-trend.test.ts` |
| E9: the environment (node major, platform, arch, memory) differs between two reports | The earlier points belong to another series; the rule uses only points with the latest report's environment. No alert across the change. | `fitness-trend.test.ts` |
| E10: the rule fires during `check` | The contract's attention list gains one item (path `workload.json`, pattern `fitness-trend:<id>`, not a marker). A second check of the same window adds none and keeps a recorded disposition. The verdict shows `fitness-trend-degraded` and not `checked-local` until the item has a disposition (reviewer, same-session or user, as for other non-marker attention). The review manifest lists the item with the measures behind it. | `packages/kernel/test/fitness-attention.test.ts` |
| E11: the user records `accepted` for the item, then the next contract's window starts at a newer point | No new item for the accepted window. A later window that again crosses the threshold raises a new item. | `fitness-attention.test.ts` |
| E12: a contract edits `workload.json` to raise a target or lower `consecutive` | Authority is needed (if `workload.json` is a protected path, Q5 option A) or an attention item is raised (option B). | `fitness-attention.test.ts` |
| E13: the kernel is killed (SIGKILL) while the workload command runs | The next call stops the recorded process group, discards the partial report, and records no receipt (the existing `Check run` row of TS §7.4). No series point is added. | `workload-check.test.ts` (POSIX), real process |
| E14: `inspect why` and `finish` on a contract with a trend item | The response gives the series (up to the last 12 points per fitness function, environment-tagged) and the WR-7 sentence. It contains no phrase claiming the application meets its workload. | `fitness-attention.test.ts` |
| E15: a Deep contract whose earlier obligations fail | The workload is not run; the receipt is absent with a note `workload not run: a required obligation failed`; no 2.5-minute run is spent on a candidate that cannot pass. | `workload-check.test.ts` (POSIX) |

## 5. Proposed contract

### 5.1 Declaration (`workload.json`)

A project file, copied from the starter template at scaffold like `journeys.json`. Strict (unknown keys refused), version 1.

```json
{
  "version": 1,
  "build": ["node", "node_modules/vite/bin/vite.js", "build"],
  "run": ["node", "--experimental-strip-types", "workload/run.ts"],
  "report": "stdout",
  "timeoutMs": 900000,
  "minimumSamples": 5000,
  "samples": ["operations.list.successful.samples", "operations.reserve.successful.samples", "operations.return.successful.samples"],
  "fitness": [
    { "id": "list-p95-ms", "measure": "operations.list.successful.p95", "unit": "ms",
      "better": "lower", "target": 200, "degradation": { "percent": 20, "consecutive": 3 } }
  ]
}
```

- `run` and `build` are argument arrays. No shell, no `npx`, no `npm exec` (TS §9.3). `report` is `stdout` or a path under the run directory.
- `samples` lists the dotted paths whose values are summed and compared with `minimumSamples` (the harness counts successful samples across all three operations).
- `measure` is a dotted path into the report. The kernel reads numbers only. A path that is absent, not a finite number, or negative makes the receipt `inconclusive` (`report-invalid`).
- `target` is the pass bound in the direction of `better`: a maximum when `lower`, a minimum when `higher`. `better` is `lower` or `higher`. `degradation.percent` and `degradation.consecutive` (at least 2, at most 12) belong to the function; the trend rule reads them from here, never from a kernel default.
- A fitness function that is a pure invariant (for example `database.duplicateActiveItems` must be 0) sets `target: 0` and `trend: false`; it can fail a receipt but never enters a series.
- The kernel's own pass judgement uses these numbers, not the report's `referencePass`. The report's `referencePass` and `mode` must agree with the kernel's result or the receipt is `inconclusive` with `report-contradiction` (E6).
- The loan-desk harness's report matches this shape without change (`operations.*.successful.p95`, `metrics.peakRssBytes`, `metrics.eventLoopP95Ms`, `database.duplicateActiveItems`); the harness's own constants (200 ms, 300,000,000 bytes) become the declaration's targets.

### 5.2 Obligation derivation

`withWorkload(obligations, lane, declaration)` in `core/obligations.ts` adds `{ id: "OB-workload", kind: "workload", category: "release", tool: "workload" }` when the lane is Deep and `workload.json` parses. It is called from `withRequiredChecks` next to `withE2e`. The dispatch routes by `tool: "workload"` so the shared Vitest path excludes it (as `isE2e` does for Playwright).

### 5.3 Run

Sequence within a full candidate check of a Deep contract: all other required obligations run first; only if each has a passing, non-flaky receipt does the workload run (E15). The runner executes `build` (if any) then `run` in one run directory, in its own process group, with the reduced environment of TS §9.3 plus `TMPDIR` set to the run directory. The harness picks its own loopback port and private database; the kernel passes neither a port nor a database path. A declared `build` step makes the receipt eligible; a served workload without a build step in the same run is `inconclusive` with `build-not-fresh`.

The execution envelope gains kind `workload`: argv, working directory, environment names, expected network `localhost`, data target `private database in the run directory`. It is consented per project and envelope hash like the other kinds (`envelope-unknown`).

### 5.4 Receipt

`Receipt` gains one optional strict field:

```ts
workload?: { env: string; samples: number; measures: Record<string, number> }   // measures: at most 32 entries
```

`env` is a SHA-256 over the report's `environment.{node major, platform, arch, totalMemoryBytes}`; the individual values are not stored. Nothing path-like, no port, no token, no database path and no response body is recorded. `qualifiers` and `limitations` follow the existing rules. `limitations` always include: "Measured on the declared reference workload on this machine. This is not evidence that the whole application meets its workload." The receipt is never marked qualified.

Status mapping: `pass` and `fail` as WR-4; everything else `inconclusive` with the §9.6 reason codes. `fail` appears in the verdict as `evidence-failed`, so the existing continue and attempt rules apply.

### 5.5 Series, baseline and trend rule

**Series.** Per fitness function with `trend` not false: up to 12 points `{ value, receipt, at, env }`, newest last, and `raised`, the id of the first receipt of the last window that raised an item (set at `finish` when the contract carried a trend item for that function; it keeps an already-raised window from raising again). A point is appended at `finish` for the contract's latest fresh `pass` or `fail` workload receipt (WR-5). `check` evaluates the rule on the stored points plus a virtual point from the current receipt, so the attention item exists before `finish` and the verdict is honest at `finish` time.

**Rule (recommended; Q1 lists the alternatives).** Let the points with the latest environment be x₁ … x_k, and let n and p be the function's `consecutive` and `percent`. The rule fires when k ≥ n and, over the last n points, no point is better than the one before it (for `better: "lower"`, xᵢ ≥ xᵢ₋₁) and the last is worse than the first by more than p percent ((x_k − x_{k−n+1}) / x_{k−n+1} > p/100; mirrored for `better: "higher"`). The reference for the comparison is the first point of the window, so no separate stored baseline is needed. After a disposition, a window must start at a point newer than the window that raised the item.

**Report.** Every response that shows workload results includes, per function, the stored points and the change from the first retained point. That is the QLT-05 "report trends across changes" clause. It is informational until the rule fires.

### 5.6 Attention item and verdict

The item goes through `carryDispositions` beside the existing attention items so dispositions survive rechecks (`verbs/check-evidence.ts` `attentionOf`). Its `id` is `AT-` plus the first eight hex characters of a hash over the function id and the window's first receipt id, so the same window keeps the same id. `path` is `workload.json`, `line` is 1, `pattern` is `fitness-trend:<id>`, `marker` is false.

`judgeAttention` in `core/verdict.ts` emits `fitness-trend-degraded` (existing code, exit 0 in a verdict) for such an item without a disposition, in place of `major-undisposed`. A disposition outcome `accepted` ends the item; outcome `finding` opens an ordinary finding. The review manifest's evidence part adds the measures of the window for the item (`core/review.ts`).

### 5.7 Consumers the implementation must cover

`Obligation` derivation (`core/obligations.ts`, `verbs/reconcile.ts`); envelope kinds (`core/execution-envelope.ts`); the runner dispatch (`verbs/check-execute.ts`); receipt building (`verbs/check-evidence.ts`, including the `tests` filter); the check finalize path (series evaluation, attention merge); `finish` (series append, result text); `core/verdict.ts` (`judgeAttention`); `core/review.ts` (evidence summary); `inspect why` and `inspect status` text; `verbs/facts.ts` (no new input: attention is already passed); the Deep budget preview (`deep-budget-preview.test.ts`; the coordinator line "State workload run counts when known" can now be exact: one per full candidate check); `recipe.json` and the starter skill; `tools/payload-files.json` if `workload.json` joins the template; schema 2 (§6).

## 6. State and compatibility

- **New stored fields:** `Receipt.workload` (about 110 non-whitespace characters of schema) and `project.fitness`, a record of bounded series (about 190). Together about 300 of the 528 characters free in `core/schemas.ts`. Both are nested plain objects, so they are a schema change under `schema-migration.md` §16.7: an older kernel would strip them. They must be added to the schema 2 design (Q3) or the feature waits for a later schema.
- **No change** to the verdict endpoint set, the reason-code registry (the code exists), the attention record shape, or `Grant`.
- **Retention.** The series is bounded to 12 points per function and is project-level, so it outlives contracts and is not evicted with archived work. Forgetting and `delete-records` must remove it; that consumer is listed for review.

## 7. Does it fit central code, and what does it cost?

**It does not fit.** Central has 37 characters free (`unmapped-musts.md`); `adapters/node-ts` has 0. Estimates below are not measurements; they are scaled from the e2e consumer, which exists and was measured by extracting its functions with the quality gate's counting: `runE2e` and its constants 925 characters, `e2eReceipts` and helpers 945, `withE2e` 702 (in uncapped `core/obligations.ts`).

| Piece | Where | Central? | Estimate (characters) |
|---|---|---|---|
| Declaration parser, report reader, kernel judgement, status mapping, series, trend rule, report text | `core/fitness.ts` (new; pure) | No budget matches it; function limits apply | 5,000 to 7,500 |
| `withWorkload`, envelope kind | `core/obligations.ts`, `core/execution-envelope.ts` | No | 600 to 900 |
| Run: build then run, environment, timeout, dispatch edits | `verbs/check-execute.ts` | Yes | 1,000 to 1,400 |
| Receipt building and the `tests` filter | `verbs/check-evidence.ts` | Yes | 900 to 1,300 |
| Series evaluation, attention merge | `verbs/check-evidence.ts` (`attentionOf`) and `verbs/check-finalize.ts` | Yes | 500 to 900 |
| Series append and result text | `verbs/finish.ts` | Yes | 300 to 600 |
| `withWorkload` call | `verbs/reconcile.ts` | Yes | 60 to 120 |
| `judgeAttention` change | `core/verdict.ts` (4,731 free) | Within its own owner | 150 to 250 |
| Manifest evidence summary | `core/review.ts` (3,179 free) | Within its own owner | 300 to 600 |
| Schema fields | `core/schemas.ts` (528 free) | Within its own owner | 250 to 400 |

**Central total: about 2,760 to 4,320 characters**, 75 to 117 times the free space. This is smaller than my first count because the normalization is a pure core function rather than a `Stack` port method (the e2e route needed `adapters/node-ts`, which has 0 free). The estimate excludes `inspect why` text and the starter template edit. It needs the owner's capacity decision (decision-packet decision 1) or an offsetting removal.

**Slices.** (1) Pure `core/fitness.ts` and its tests (E2 to E9) can be built and reviewed without touching central code; it maps nothing and gets no `[QLT-05]` tag, as the unwired trait core did. (2) The central wiring and E10 to E15 follow the capacity decision and the schema 2 gate.

## 8. Alternatives considered

| Question | Options | Notes |
|---|---|---|
| Who judges the report | A. The kernel against declared targets, requiring the report's own verdict to agree (recommended). B. Trust the harness's `referencePass`. | B lets a harness constant diverge from the declaration, and a changed harness could pass quietly (WR-3, EVD-12). |
| Where the series lives | A. `project.fitness`, bounded (recommended). B. Derived from retained receipts of archived contracts. C. A separate `.tenet` file. | B loses points when contracts are evicted and shifts the first point silently. C adds store code (214 free) and a new strict-decoder inventory item. A needs schema 2 either way for `Receipt.workload`. |
| When a workload runs | A. Deep contracts only (recommended; TS §9.2 `release`). B. Also Standard contracts that change a path or trait the declaration lists. | B finds a slow decline sooner but costs about 2.5 minutes plus a build per Standard check. With A the series has one point per Deep contract, so "consecutive" means consecutive Deep contracts. |
| Trend rule | See Q1. | |
| Where the declaration lives | A. A project file copied at scaffold, protected (recommended). B. Recipe-only, read from the plugin payload. | B stops a project from weakening a threshold but also stops a domain increment from adding its own functions. |

**Recommendation: all A, with the rule in §5.5.**

## 9. Owner questions

**Q1. What does "regresses by more than 20% across 3 consecutive checks" mean?** Tech Spec §12.7 gives the example; PRD QLT-05 says "a trend crossing its declared degradation threshold across consecutive checks". For values 100, 110, 121, 133:
- A. **Windowed and non-improving** (recommended): the last 3 points never improve and the last is more than 20% above the first of the 3. Fires at 121. Needs no stored baseline.
- B. **Sustained against a baseline:** each of the last 3 points is more than 20% above a stored baseline. With baseline 100 it fires at the third point above 120 (121, 133, then the next). Needs a stored baseline and a way to reset it (a disposition could do so).
- C. **Windowed, direction ignored:** last point against the first of the 3, more than 20%. Fires on a single step change and on noise.
A catches the slow decline the Tech Spec describes; B is more noise-tolerant but later; C is simplest and the noisiest.

**Q2. Which lanes run the workload?** Deep only (recommended), or Deep plus Standard changes that touch declared paths (§8). The second changes the cost of ordinary work.

**Q3. Does the stored shape join schema 2?** Options: A. Yes; add `Receipt.workload` and `project.fitness` to `schema-migration.md` §16.2 and its strict decoder (recommended, because the owner is already designing schema 2 and each later bump costs a migration). B. Wait for a later schema and ship the pure core only. This is the owner's call on the migration gate.

**Q4. Harness ownership.** The only harness is in a golden fixture. A. The neutral starter ships `workload.json` with the PRD §5.16 targets and a domain-free harness (a large starter increment; plan §12.16 shows the starter's own reference acceptance fails today). B. The starter ships the declaration only; in Deep the run fails to start and the receipt is `inconclusive` (`not-executed`) until a domain increment adds the harness. C. The declaration appears only where a domain increment supplies a harness, and the "each recipe shall declare" clause of QLT-05 is narrowed for the neutral starter. Recommended: B, because it declares without inventing a harness. It makes a Deep contract in a harness-less starter unable to reach `checked-local`, which the owner must accept or reject.

**Q5. Weakened thresholds.** A. `workload.json` and `workload/*` become protected paths in `recipe.json` (edits need a grant; bumps the recipe version). B. Edits raise an attention item. Recommended: A, with B as the fallback for an adopted project that cannot take a recipe bump.

**Q6. Disposition strength.** Tech Spec §12.7 says the item needs a disposition "the same as any other finding", so a same-session disposition counts. A degradation accepted by the model that caused it is weak. Option: require `reviewer` or `user`, as for markers (`marker-unaccepted`). Recommended: follow the Tech Spec for now and revisit after seeing real series.

**Q7. Central capacity.** §7 needs decision-packet decision 1, or the owner names what to remove.

## 10. Risks and assumptions

- **Few points.** With Deep-only runs, a project may produce one point per several contracts. The rule then rarely fires, and the spec says so in the report text instead of implying coverage.
- **Noisy hardware.** The harness cannot verify reference-hardware identity or isolation. The environment tag separates different machines but not a noisy neighbour. A false alert costs one disposition; a missed one costs the feature. No tuning of thresholds is proposed here (PRD §5.16: provisional, frozen under §6.12).
- **A failing reference run.** Plan §12.16 records the starter's reference acceptance as failing. This spec makes that a visible `fail` receipt; it does not and must not relax a target.
- **Report size.** The loan-desk report includes burst and probe arrays. The 10 MB bound applies before parsing, and only declared measures are read.
- **Declared command.** A declared `run` is project code the kernel will execute. It goes through the existing envelope consent. The reduced environment is not isolation (TS §9.3), and the result says so.
- **Unobserved:** every behavior on a native host, and how often a real project would reach three Deep contracts.

## 11. Acceptance criteria and gates

Before implementation: independent review with dispositions (§12 is the author's own pass); owner answers Q1 to Q5 and Q7; owner sign-off; the schema 2 and capacity decisions. Implementation is red-first with E1 to E15. Done when all pass, `npm run ci` passes, and the built bundle is driven on a scratch repository: a declared stub workload that prints a fixture report, three consecutive contracts with worsening values, observing the attention item, the verdict reason and the disposition. Compare with E8 to E11 and record what was and was not observed. `[QLT-05]` is added only then. Update Tech Spec §§9.1, 12.7 and Appendix C, the starter skill text and `recipe.json` only for what changes. Do not claim reference-machine qualification or host qualification.

## 12. Review pass and dispositions (author, 2026-11-03, fresh re-read against the PRD text)

Method: re-read QLT-05 ("Each application recipe shall declare a reference workload and fitness functions (Section 5.16); checks shall report trends across changes without claiming whole-application conformance from changed flows, and a trend crossing its declared degradation threshold across consecutive checks shall raise an attention item rather than only appear in a report"), PRD §5.16 and Tech Spec §12.7 against §§3 to 6. This is a self-review after drafting, not an independent review.

| # | Finding | Disposition |
|---|---|---|
| 1 | QLT-05 has four clauses (declare, report trends, no whole-application claim, escalate). The first draft mapped only the last two. | Fixed: WR-1 (declare), WR-5 and §5.5 "Report" (report trends), WR-7 and E3 and E14 (no claim), WR-6 and E10 (escalate). |
| 2 | "Each application recipe shall declare": the neutral starter has no workload declaration, and the only harness is a fixture. The first draft assumed a harness. | Open: Q4. Recorded in §2; not resolvable by the author. |
| 3 | The first draft added `OB-workload` to every contract. The verdict requires a fresh passing receipt for every listed obligation, so every contract would block. | Fixed: lane-dependent derivation (WR-2, E1) after reading `judgeObligation` and `reconcile.ts`. |
| 4 | Series points per check would count iterations within one contract as "changes". | Fixed: one point per contract, appended at `finish`; `check` uses a virtual point so the attention item exists in time (E7, §5.5). |
| 5 | A rule keyed to a stored baseline needs a reset path and a place to keep it. | Accepted into Q1: the recommended rule uses the window's first point and needs no baseline; the stored-baseline reading is option B. |
| 6 | The attention record has `path` and `line`; the first draft gave the item no real location. | Fixed: `workload.json`, line 1, pattern `fitness-trend:<id>`; the reviewer manifest adds the numbers because the record has no text field (§5.6). Weak: a reviewer sees a pattern name, not a message. Accepted; the evidence part carries the measures. |
| 7 | An item id based on the contract or the check would change on every recheck and lose dispositions. | Fixed: id from the function id and the window's first receipt id (§5.6, E10). |
| 8 | The first estimate routed normalization through a `Stack` port in `adapters/node-ts` (0 characters free). | Fixed: pure core function (§7). The central estimate fell accordingly. |
| 9 | A new stored field in a nested object would be stripped by an older kernel. | Recorded in §6 and Q3 from `schema-migration.md` §16.7. |
| 10 | The harness's own pass constants (200 ms, 300,000,000 bytes) duplicate the declaration; two judges can disagree. | Fixed: kernel judges from the declaration and treats disagreement with the report as `report-contradiction` (§5.1, E6). |
| 11 | A workload run costs minutes. Running it on a candidate that already fails other obligations wastes it. | Fixed: E15 and §5.3 order. |
| 12 | Editing the declaration is a way to hide a regression. | Added WR-9, E12, Q5. |
| 13 | A same-session disposition of a degradation can come from the model that caused it. | Open: Q6. Tech Spec wording ("the same as any other finding") is followed in the draft. |
| 14 | NFR-01's reference fixtures and this feature overlap in "reference hardware". | No change: out of scope (§1). The receipt says "unqualified". |
| 15 | The reason `fitness-trend-degraded` is exit 0 inside a verdict, which is also how `major-undisposed` behaves; confirmed in `core/verdict.ts` that any non-note reason lowers the endpoint. | No change needed; recorded so a reviewer need not re-derive it. |
| 16 | On a second read, the rule "a window must start after the window that raised the item" had nowhere to be remembered. | Fixed: the series carries `raised` (§5.5); the schema estimate in §6 rises by about 30 characters, still inside the 528 free. |
| 17 | `target` had no stated direction, so a throughput function (`better: higher`) could not be judged. | Fixed in §5.1. |
