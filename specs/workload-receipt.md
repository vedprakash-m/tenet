# Specification: Workload obligation, receipt and fitness trend (QLT-05)

> Status: **draft, revised, unreviewed.** First written 2026-11-03 under the owner's blanket direction of that date to build candidates on an isolated branch. That direction is not a sign-off. An independent review the same day ([reviews/workload-receipt-review.md](reviews/workload-receipt-review.md), 16 findings) is answered in this revision; the disposition of each finding is in that file. A **second independent review is required before sign-off.** This spec is not part of the canonical specs, changes no source, and authorizes no implementation. Open owner questions are in §9.
> Sources: PRD QLT-05, §4.4.3, §5.16 (starter reference workload), AC-19, AC-20; Tech Spec §§9.1, 9.2, 9.3, 9.6, 12.7, 8.7, 8.8, 13, Appendix C; `docs/audits/2026-11-03/unmapped-musts.md` row QLT-05; `schema-migration.md` §§16.2, 16.6, 16.7, 18.1; `ux-spec.md` §§4.1, 4.4, 5.2.
> The PRD change log (v0.17, line 2817) says QLT-05's escalation is recorded in "Section 4.3, `fitness-trend-degraded`". PRD §4.3 is the non-functional table and has no such row; the code is registered in Tech Spec Appendix C. Logged in plan §12.3.
> Code read for this revision: `main` at `8b1d574`.

## 1. Outcome

A project whose recipe declares a reference workload and fitness functions gets them judged by the kernel, not only by a script the model runs. A Deep contract runs the declared workload as a required obligation and receives a receipt. The measurements are kept across contracts. When a fitness function worsens by its own declared threshold across its declared number of consecutive workload runs, the kernel raises an attention item that needs a disposition, and the verdict says so with `fitness-trend-degraded`.

What the kernel does and does not provide. The kernel runs the declared command, reads the report it prints, judges that report against the numbers in the declaration, and keeps the points. It **does not measure anything itself.** Every number it reads is produced by project code (the harness), including the node major in the environment tag. That puts workload receipts in the same trust class as test receipts: the kernel checks consistency, bounds and the declared targets, and it cannot tell a doctored harness from an honest one. What protects the harness and the declaration is the protected-path rule (WR-9), which is enforced by the kernel but whose grant is user-reported (cooperative). Reports of trends never claim that the whole application meets its workload.

"Consecutive" has a narrower meaning than the PRD's "consecutive checks": it means consecutive **Deep contracts** that ran the workload (WR-11, Q2). Most work is Quick or Standard, so the series moves rarely and the escalation is reachable only in projects that run several Deep contracts.

Out of scope: choosing or changing the workload protocol or its numbers (PRD §5.16, provisional); reference-machine qualification (the receipt stays unqualified, as the harness already reports); the starter's admission-policy capacity problem (`admission-policy.md`, plan §12.16), which can make the reference run fail for reasons unrelated to this spec; performance of the kernel itself (NFR-01).

## 2. Current state (read from `main` at `8b1d574`)

- `Obligation.kind` already allows `"workload"` (`core/schemas.ts:99`). Nothing creates, runs or judges one. `Receipt.kind` is a free string. The receipt shape has test counts and failures but no measurement fields.
- `fitness-trend-degraded` exists only as a reason code (`core/reasons.ts:26`, exit 0) and in Tech Spec Appendix C (line 2298). It has no producer.
- Every obligation in `work.obligations` must have a fresh passing receipt for the verdict to reach `checked-local` (`core/verdict.ts` `judgeObligation`, lines 53-69). `category` is stored but not read by the verdict (it is read once, for `acceptance`, in `decisions/basis.ts:124`). So a workload obligation added to every contract would block every contract; it must be derived by lane and by recipe.
- **The e2e precedent derives its obligation from the recipe record.** `project.recipe.checks` (`core/schemas.ts:326`, an enum of `tsc`, `eslint`, `e2e`) is set at scaffold; `withRequiredChecks` adds the obligation with `withE2e(…, wantsE2e(checks))` (`verbs/reconcile.ts:78`; `core/obligations.ts`). `CheckTool` is `StaticTool | "e2e"` (`ports/types.ts:224`). The e2e obligation is dispatched as `kind: "static"`, `tool: "playwright"` so the shared Vitest path skips it; Tech Spec §12.7 records why.
- Consumers that treat every non-static obligation as a Vitest test: `receiptsOf` (`verbs/check-evidence.ts:101`), the flaky rerun (`verbs/check-rerun.ts:35`, `tests = run.toRun.filter((ob) => !isStatic(ob))`), and launched-check accounting (`verbs/check-evidence.ts:162-164`, `ranTests` and `launched`). `checkInputId` hashes the obligation fields (`verbs/facts.ts:62`). A `kind: "workload"` obligation would be rerun as a test and counted as a launched test unless these sites change.
- Budget: `recordLaunchedChecks` is the only counter writer (`core/budget.ts:83`). Active time is call duration plus the gap after a call that said to keep working (`accrueTime`, `core/budget.ts:51-59`); a `check` call that runs a workload counts its whole duration. Deep limits are 4 attempts, 2 review rounds, 12 delegations and 120 minutes (`LIMITS`, `core/budget.ts:6`).
- The workload harness exists only in the loan-desk golden fixture (`test/fixtures/golden-tasks/loan-desk/workload/*.txt`, `docs/workload.md.txt`). `npm run workload` is `npm run build 1>&2 && node --experimental-strip-types workload/run.ts` (`package.json.txt:20`); `run.ts` itself does not build. It prints one JSON report on stdout: `mode`, `referencePass`, `reasons`, `protocol.minimumSamples`, `operations.{list,reserve,return}.successful.{samples,p50,p95,p99}` (nearest rank; `p95` is null when nothing succeeded), `metrics.peakRssBytes`, `metrics.eventLoopP95Ms`, `database.duplicateActiveItems`, `environment.{node,platform,arch,release,totalMemoryBytes}` (`node` is the full `process.version` string), and a fixed `qualification: "unqualified"`. Exit 1 means a reference run failed a judgement or the harness threw (then stdout may hold no report); `--smoke` runs two seconds, exits 0 and never passes.
- **The harness judges more than a target list covers.** `judge` in `report.ts.txt` and `harness.ts.txt:113-116` can put these strings in `reasons`: `<op>-success-unobserved`, `<op>-p95-over-200ms`, `<op>-unexpected-errors` (for `list`, `reserve`, `return`), `server-memory-target-failed`, `event-loop-unobserved`, `event-loop-p95-over-200ms`, `five-way-bursts-incomplete`, `double-booking`, `busy-degradation-unobserved`, `diagnostic-smoke-only`, `insufficient-successful-samples`, `foreign-key-violations`, `hash-capacity-probes-incomplete`, `twenty-client-concurrency-unobserved`.
- The neutral starter has no `workload/`, no `workload.json` and no `workload` key in `recipe.json` (`checks` is `tsc`, `eslint`, `e2e`). Tech Spec §5.1 and §13 name `workload.json` as a starter resource and `workload` as a recipe-manifest field.
- The starter's own acceptance of the reference run currently fails (plan §12.16 row 6: operation busy and hash acceptance stay failed). A kernel obligation will report that failure honestly; it does not fix it.
- `AttentionItem` has `id`, `path`, `line`, `pattern`, `marker` and an optional `disposition` (`by`: reviewer, same-session or user; `outcome`: accepted or finding) and **no text field** (`core/schemas.ts:147-152`). `judgeAttention` (`core/verdict.ts:165-175`) rejects a `same-session` disposition for markers only; any recorded disposition clears a non-marker item. `carryDispositions` and `attentionOf` keep dispositions across rechecks.
- `adapter-unsupported-config` is thrown as a `KernelError` with exit 2 from `assertSupportedConfiguration` (`adapters/node-ts.ts:439`) and aborts the whole `check`; it is not a receipt-level code in practice. In Tech Spec §9.6, `not-executed` means no exit or signal was recorded.
- Persisted nested objects strip unknown keys today (`schema-migration.md` §16.7). The signed migration design makes every decoder strict and says "semantic/reference fields need strict versioned schemas and inventory additions" (`schema-migration.md` §18.1, line 408). Rollback is refused once any post-upgrade mutating action has run (`schema-migration.md` §16.6).
- Windows refuses mutating verbs. Check-pipeline tests run on POSIX CI. The report parser and trend rule are pure and run anywhere.
- Capacity (measured 2026-11-03): central **147** characters free against the **proposed, not approved** ceiling of 248,256 (used 248,109); the approved ceiling of 247,219 is already exceeded by 890. `core/schemas.ts` has **463** free. `adapters/runner` has 10,232 free. Tech Spec §6.2 gives `core/obligations` and `core/findings` 250 lines, but `tools/lint-quality.ts` has no entry for either (`core/obligations.ts` is 110 lines), so that budget is not enforced.

## 3. Requirements

| ID | Requirement | Source |
|---|---|---|
| WR-1 | A project's workload declaration names the command, the report location, the timeout, the minimum samples, the sample paths and each fitness function with its measure, direction, target and its own degradation threshold (percent, consecutive, floor). A missing, unparseable or invalid declaration makes the receipt `inconclusive` with `workload-declaration-invalid`, naming the file or key. It is never replaced by defaults and never silently ignored. | QLT-05; TS §12.7; TS §9.2 (no silent default for a declared check) |
| WR-2 | The obligation `OB-workload` is owed when the project's recipe record lists `workload` in `checks` **and** the contract's lane is Deep. It is derived from the recipe record, like `e2e`, not from the presence of a file. It runs once per full candidate check, after the other required obligations pass. Standard and Quick contracts do not owe it. A project with no recipe, or a recipe scaffolded before `workload` was listed, owes none. | TS §9.2 category `release`; TS §5.3; QLT-05 ("each application recipe shall declare") |
| WR-3 | The kernel runs the declared command in its own process group under the existing runner and envelope rules. The report is untrusted: bounded, parsed, and judged by the kernel against the declared targets. | TS §9.3, §9.6 |
| WR-4 | The receipt is `pass` only when the report is a reference-mode report, has at least the minimum samples, every declared target is met by the kernel's own reading, the report lists no `reasons`, and exit and report agree. A missed declared target, or any reason the harness reports other than the two population reasons, is `fail`. A smoke or non-reference report, too few samples, or an unreadable report is `inconclusive`. | TS §9.1; TS §9.6 |
| WR-5 | Each receipt that is `pass` or `fail` yields one measurement per trend function. One point per contract is kept in a bounded series, tagged with an environment tag in which platform, architecture and memory come from kernel observation and the node major from the report. A change of tag starts a new comparison, and the response says so. | QLT-05 ("report trends across changes") |
| WR-6 | The trend rule is applied by the kernel with the thresholds the declaration gives. When it fires, the contract gets one attention item per fitness function and window, the verdict carries `fitness-trend-degraded`, and a disposition by the reviewer or the user is required. | QLT-05; TS §12.7 |
| WR-7 | Every workload receipt and every trend report carries, as a positive sentence, the scope of the measurement (§5.4). Tests check that the sentence is present in every workload-bearing response. | QLT-05 ("without claiming whole-application conformance from changed flows") |
| WR-8 | The kernel never writes a fitness measurement, threshold or baseline from a model's statement. Only a kernel-run receipt feeds the series. This is a statement about where the numbers enter, not about their integrity: the harness that produced them is project code. | `copilot-instructions.md` (binding facts written only by the kernel); EVD-12 |
| WR-9 | For recipe projects, `workload.json` and `workload/*` are listed in the recipe's `protectedPaths`. An edit to either needs a grant. The kernel enforces this at the verdict as for any protected path (`uncoveredProtected`, `authority-needed`): the contract cannot reach `checked-local` while an edit is uncovered. It does not prevent the edit, and the grant itself is user-reported and cooperative. | TS §8.7; SEC-10 spirit |
| WR-10 | A workload run is one launched check. It is never rerun as a flaky test. Its minutes are part of the `check` call's active time. Deep limits apply unchanged, so a Deep contract runs the workload at most once per attempt, at most four times. | WRK-08; NFR-05; PRD §4.4.1 |
| WR-11 | "Consecutive" means consecutive Deep contracts that ran the workload. Every trend report says "the last n Deep contracts". | QLT-05 narrowed (Q2) |

## 4. Proposed behavior and examples

Tests named here do not exist yet. `[QLT-05]` is added to a test title only when E1 to E20 pass in the built kernel on POSIX CI **and** the owner has answered Q2 saying that "consecutive Deep contracts" meets the PRD, because the requirement has four clauses (declare, report trends, no whole-application claim, escalate) and the series moves only on Deep contracts. A pure-core test alone proves none of them end to end.

| Example | Expected behavior | Test file |
|---|---|---|
| E1: a Deep contract in a project whose recipe lists `workload` | `OB-workload` (kind `workload`, category `release`) is among the contract's obligations. A Standard contract in the same project has none. A Deep contract in a project with no recipe, or a recipe without `workload`, has none and no reason about workload. | `packages/kernel/test/workload-receipt.test.ts` |
| E1b: the same Deep contract, with `workload.json` deleted, emptied or renamed | The obligation is still owed. The receipt is `inconclusive` with `workload-declaration-invalid` naming the file; the verdict cannot reach `checked-local`. There is no silent removal. | `workload-receipt.test.ts` |
| E2: `workload.json` has an unknown key, a non-numeric target, `consecutive` below 2 or above 12, a duplicate or invalid fitness id (including `__proto__`), more than 32 functions, a report path outside the run directory, or a command that is a string instead of an argument array | The check yields an `inconclusive` receipt for `OB-workload` only, with `workload-declaration-invalid` and a limitation naming the key. The workload command is not run. Other obligations are judged normally and the `check` call does not abort. | `workload-receipt.test.ts` |
| E3: a reference report meets every target, has the minimum samples, lists no reasons, and exits 0 | Receipt `pass`. `workload.measures` holds each fitness value. `limitations` carry the WR-7 sentence. | `workload-receipt.test.ts` |
| E4: one operation's p95 is over its target; exit 1 | Receipt `fail`, reason `evidence-failed`, failure names the fitness id and the two numbers. | `workload-receipt.test.ts` |
| E4b: a recorded reference report from the loan-desk fixture whose `reasons` hold `double-booking`, or `five-way-bursts-incomplete`, or `list-unexpected-errors` while every declared target is met | Receipt `fail` (not `inconclusive`), `evidence-failed`, the failure quoting each reason string (each must match `^[a-z0-9-]{1,60}$`, at most 5 shown). A recorded passing report from the same harness yields `pass`. The test uses the complete declaration of §5.1. | `workload-receipt.test.ts` |
| E5: smoke report (`mode` not `reference`), samples below minimum, report missing, invalid JSON, over 10 MB, depth over 64, or no exit recorded | Receipt `inconclusive` with `population-mismatch` (smoke, or too few samples), `report-missing`, `report-invalid` or `not-executed` (no exit recorded), as the table in TS §9.6 gives. A smoke report never passes and is never `not-executed`. Each code has a registered fixture. | `workload-receipt.test.ts` |
| E6: exit 0 with `referencePass` false in reference mode; exit 1 with `referencePass` true; `referencePass` false with an empty `reasons`; `referencePass` true with a non-empty `reasons` | Receipt `inconclusive`, `report-contradiction`. | `workload-receipt.test.ts` |
| E6b: the report's `environment.platform`, `arch` or `totalMemoryBytes` differs from what the kernel observes | Receipt `inconclusive`, `report-contradiction`, naming the field. | `workload-receipt.test.ts` |
| E7: the same candidate is checked twice, then the contract finishes | One series point per contract, taken from the latest fresh `pass` or `fail` workload receipt at `finish`. An aborted contract adds none. Two different candidates in one contract still add one. A second `finish` of the finished contract adds none. | `packages/kernel/test/fitness-trend.test.ts` |
| E8: the rule of §5.5 on lower-is-better values with `percent` 20, `consecutive` 3, `floor` 0 | 100, 110, 121 fires at the third point and not at the second. 100, 130, 100 does not fire. 100, 100, 100, 119 does not fire. **100, 100, 121 does not fire** (a flat step is not a strict worsening). 0, 5, 12 with `floor` 10 fires; 0, 1, 2 with `floor` 10 does not; 0, 0, 0 does not. A higher-is-better mirror of each. No division occurs. | `fitness-trend.test.ts` |
| E9: the environment tag differs between two reports | The earlier points belong to another series; the rule uses only points with the latest tag and the same measure path. No alert across the change, and the response states "series restarted: environment changed" with the old and new platform, architecture and node major. | `fitness-trend.test.ts` |
| E10: the rule fires during `check` | The contract's attention list gains one item (path `workload.json`, line 1, pattern `fitness-trend:<id> <first> to <last> <unit> (+<percent>%, <n> runs)`, not a marker). A second check of the same window adds none and keeps a recorded disposition. The verdict shows `fitness-trend-degraded` and not `checked-local` until the item has a disposition by the reviewer or the user; a `same-session` disposition does not clear it. The review manifest lists the item with the measures behind it. | `packages/kernel/test/fitness-attention.test.ts` |
| E11: the user records `accepted` for the item, then the next contract's window starts at a newer point | No new item for the accepted window. A later window that again crosses the threshold raises a new item. | `fitness-attention.test.ts` |
| E12: a contract edits `workload.json` or a file under `workload/` in a recipe project: raises a `target`; flips `better`; lowers `consecutive`; raises `percent` or `floor`; sets `trend: false`; removes a function; lowers `minimumSamples`; edits `samples` or `measure` paths; changes `run`, `build`, `report` or `timeoutMs`; changes `workload/run.ts` | Each edit is an uncovered protected path: the verdict carries `authority-needed` naming the path and the contract cannot reach `checked-local` until a grant covers it (the edit itself is not prevented). One assertion per field. (Adopted projects with no recipe owe no workload; nothing to protect.) | `fitness-attention.test.ts` |
| E13: the kernel is killed (SIGKILL) while the workload command runs | The next call stops the recorded process group, discards the partial report, and records no receipt (the existing `Check run` row of TS §7.4). No series point is added. | `workload-check.test.ts` (POSIX), real process |
| E13b: the kernel is killed at each step of `finish` for a contract with a workload receipt: before the commit intent; after the commit intent; after the commit result and before the state publish; after the publish | After recovery and a retried `finish`, the series holds exactly one point for the contract's receipt, never two and never none for a finished contract. The point is written in the same state publish as the contract's `finished` state (`close()` in `verbs/finish.ts`) and skipped when a point with that receipt id exists. | `fitness-trend.test.ts`, fixture `fixtures/crash-finish-fitness.ts` (POSIX) |
| E13c: the kernel is killed after the `check` publish that added the attention item, then the check is run again | The item exists once, with the same id and a kept disposition. The series is unchanged. | `fitness-attention.test.ts` (POSIX) |
| E14: `inspect why` and `finish` on a contract with a trend item | The response gives the series (up to the last 12 points per function, each with its environment tag), the sentence "the last n Deep contracts", and the WR-7 scope sentence. The scope sentence is asserted present in every workload-bearing response. | `fitness-attention.test.ts` |
| E15: a Deep contract whose earlier obligations fail | The workload is not run; the receipt is absent with a note `workload not run: a required obligation failed`; no run is spent on a candidate that cannot pass. | `workload-check.test.ts` (POSIX) |
| E16: a Deep contract whose workload receipt fails | The workload is not rerun as a flaky test (`check-rerun.ts` skips it). `checksLaunched` rises by one for the run. A `check` that did not run the workload (E15) does not raise it. No new counter exists. | `workload-check.test.ts` (POSIX) |
| E17: schema-1 state (no `project.fitness`, recipe `checks` without `workload`) is converted | `project.fitness` is empty, no receipt carries `workload`, and no contract owes `OB-workload` until a recipe upgrade lists it. Conversion reads no report. | `packages/kernel/test/fitness-migration.test.ts` |
| E18: rollback after conversion | Eligible only before the first post-upgrade mutating action (`schema-migration.md` §16.6). The first series point is written by `finish`, a mutating action, so no series exists in a rollback-eligible state; nothing is lost. | `fitness-migration.test.ts` |
| E19: `forget` of a lesson; and an older kernel reads a newer state with `project.fitness` | The series is untouched by `forget` (it holds numbers, hashes, receipt ids and timestamps, no lesson text). The older kernel refuses the document under the strict decoders; it does not strip the field. | `fitness-migration.test.ts` |
| E20 (only if Q4 is B): a Deep contract in the neutral starter, which lists `workload` but ships no harness | The receipt is `inconclusive` with `workload-declaration-invalid` ("workload/run.ts is missing"); the verdict says `evidence-inconclusive: OB-workload`; the endpoint is below `checked-local`. Under Q4 C there is no obligation (E1). | `workload-receipt.test.ts` |

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
      "better": "lower", "target": 200, "degradation": { "percent": 20, "consecutive": 3, "floor": 5 } }
  ]
}
```

- `run` and `build` are argument arrays. No shell, no `npx`, no `npm exec` (TS §9.3). The fixture's own script, `npm run build 1>&2 && node … workload/run.ts`, uses a shell redirect the declaration cannot express, so the example declares the two steps separately: the build (`vite build`, the fixture's `build` script) and the run. `report` is `stdout` or a path under the run directory.
- `timeoutMs` bounds the build and the run together. The example's 900,000 (15 minutes) is above the 10-minute recipe default of PRD §4.4.3; a declared value is allowed. The run itself is at least 30 s of warm-up plus 120 s measured (2.5 minutes); the harness also seeds 2,000 users, 10,000 items and 50,000 loans, builds, drains and runs bursts. **Real wall time is unobserved**, so 900,000 is a guess until a run is timed.
- `samples` lists the dotted paths whose values are summed and compared with `minimumSamples` (the harness counts successful samples across the three operations).
- `measure` is a dotted path into the report. The kernel reads numbers only. A path that is absent, not a finite number, or negative makes the receipt `inconclusive` (`report-invalid`).
- `target` is the pass bound in the direction of `better`: a maximum when `lower`, a minimum when `higher`. `degradation.percent`, `consecutive` (2 to 12) and `floor` (a number at least 0, in the function's unit) belong to the function; the trend rule reads them from here, never from a kernel default.
- A fitness function that is a pure invariant (for example `database.duplicateActiveItems` must be 0) sets `target: 0` and `trend: false`; it can fail a receipt but never enters a series. At most 32 functions. Ids match `^[a-z][a-z0-9-]{0,39}$`; maps are read with `Object.hasOwn` (TS §6.1 admission rule). `unit` matches `^[A-Za-z%/]{0,12}$`.
- **Judgement.** The kernel's pass judgement uses the declared targets and the sample paths, not only the report's `referencePass`. The report's `mode`, `referencePass`, `reasons` and exit must agree with the kernel's reading or the receipt is `inconclusive` with `report-contradiction` (E6). The report's own `reasons` are **evidence**: in a reference-mode report, any reason other than `diagnostic-smoke-only` and `insufficient-successful-samples` (which map to `population-mismatch`) makes the receipt `fail`, quoting the reason strings (E4b). A real failure the declaration does not cover is therefore a failure, never "could not judge".
- **Complete declaration for the loan-desk fixture** (tested against recorded reports, E4b): `list-p95-ms`, `reserve-p95-ms` and `return-p95-ms` (`operations.<op>.successful.p95`, lower, target 200, trend); `event-loop-p95-ms` (`metrics.eventLoopP95Ms`, lower, 200, trend); `peak-rss-bytes` (`metrics.peakRssBytes`, lower, 300000000, trend); `duplicate-active-items` (`database.duplicateActiveItems`, lower, 0, `trend: false`). The harness reasons not tied to a number (`<op>-unexpected-errors`, `five-way-bursts-incomplete`, `double-booking`, `busy-degradation-unobserved`, `foreign-key-violations`, `hash-capacity-probes-incomplete`, `twenty-client-concurrency-unobserved`, `event-loop-unobserved`, `<op>-success-unobserved`) fail through the `reasons` rule. The harness's own constants (200 ms, 300,000,000 bytes) become the declaration's targets; the harness itself does not change.

### 5.2 Obligation derivation

`withWorkload(obligations, wanted)` in `core/obligations.ts` adds `{ id: "OB-workload", kind: "workload", category: "release", tool: "workload" }` when `wanted` is true, where `wanted` is `wantsWorkload(project.recipe.checks) && w.lane === "deep"`. It is called from `withRequiredChecks` beside `withE2e` (`verbs/reconcile.ts:78`), so it is evaluated on every call and does not depend on any file. `"workload"` joins `CheckTool` (`ports/types.ts:224`) and the `project.recipe.checks` enum (`core/schemas.ts:326`). `OB-workload` is judged and dispatched by `tool: "workload"` and by a shared predicate, `isSharedTest(ob)` (`kind === "test"`), used at the three sites of §2 so the Vitest path, the rerun and the launched-check count exclude it. (The e2e precedent, `kind: "static"` with a tool name, would make those sites need no change; it is not chosen because `kind` is what `inspect why` and the verdict text show, and Tech Spec §9.1 names `workload` as a kind.)

### 5.3 Run

Sequence within a full candidate check of a Deep contract: all other required obligations run first; only if each has a passing, non-flaky receipt does the workload run (E15). The runner executes `build` (if any) then `run` in one run directory, in its own process group, with the reduced environment of TS §9.3 plus `TMPDIR` set to the run directory. The harness picks its own loopback port and private database; the kernel passes neither a port nor a database path. A served workload without a build step in the same run is `inconclusive` with `build-not-fresh`.

The execution envelope gains kind `workload`: argv, working directory, environment names, expected network `localhost`, data target `private database in the run directory`. It is consented per project and envelope hash like the other kinds (`envelope-unknown`).

### 5.4 Receipt

`Receipt` gains one optional strict field:

```ts
workload?: { env: string; samples: number; measures: Record<string, number> }   // measures: at most 32 entries
```

`env` is a SHA-256 over `{ platform, arch, totalMemoryBytes, nodeMajor }`. The first three are **kernel observations** through one new read-only method on the `Runner` port (`machine()`), not values from the report; the report's own `environment.platform`, `arch` and `totalMemoryBytes` must equal them or the receipt is `report-contradiction` (E6b). `nodeMajor` is read from the report's `environment.node` (the child process may run a different node from the kernel); it is project-produced and is stated as such. The individual values are not stored. Nothing path-like, no port, no token, no database path and no response body is recorded.

`limitations` always include this positive sentence (WR-7): "Measured on this machine by the project's declared workload (report mode: reference). It is a trend of that workload, not evidence that the whole application meets its workload, and the harness that produced the numbers is project code." The receipt is never marked qualified. The word "reference" is used only as the harness's `mode` value; the PRD's reference laptop (Apple silicon, 16 GB) is not checked.

Status mapping: `pass` and `fail` as WR-4; everything else `inconclusive` with these codes: `workload-declaration-invalid` (new, exit 0: a missing, unparseable or invalid declaration or harness, naming the file or key), `population-mismatch` (smoke or too few samples), `report-missing`, `report-invalid`, `report-contradiction`, `not-executed` (no exit or signal recorded), `timeout`, `build-not-fresh`. A `fail` appears in the verdict as `evidence-failed`, so the existing continue and attempt rules apply.

### 5.5 Series, baseline and trend rule

**Series.** `project.fitness` is a record keyed by function id. Per function with `trend` not false: up to 12 points `{ value, receipt, at, env, measure }`, newest last (`measure` is the dotted path, at most 200 characters), and `raised`, the id of the first receipt of the last window that raised an item. A point is appended **inside `close()` of `verbs/finish.ts`**, in the same state publish that sets the contract to `finished`, for the contract's latest fresh `pass` or `fail` workload receipt, and only if no point with that receipt id exists (E7, E13b). There is no separate effect: the append cannot be half-applied, and a kill before the publish leaves the series unchanged for the retried `finish`. `check` evaluates the rule on the stored points plus a virtual point from the current receipt, so the attention item exists before `finish` and the verdict is honest at `finish` time.

**Rule (recommended; Q1 lists the alternatives).** Let the points with the latest environment tag and the same `measure` path be x₁ … x_k, and let n, p and f be the function's `consecutive`, `percent` and `floor`. For `better: "lower"` the rule fires when k ≥ n and, over the last n points, **each point is worse than the one before** (xᵢ > xᵢ₋₁) and the last is worse than the first by more than the larger of p percent of the first and f: x_k − x_{k−n+1} > max(p/100 · x_{k−n+1}, f). `better: "higher"` mirrors the signs. There is no division by a possibly zero value: a zero base uses `floor`. After a disposition, a window must start at a point newer than the window that raised the item. The reference for the comparison is the first point of the window, so no separate stored baseline is needed.

**Report.** Every response that shows workload results includes, per function, the stored points (with environment tags) and the change from the first retained point, and says "the last n Deep contracts". That is the QLT-05 "report trends across changes" clause. It is informational until the rule fires.

### 5.6 Attention item, verdict and words

The item goes through `carryDispositions` beside the existing attention items so dispositions survive rechecks (`verbs/check-evidence.ts` `attentionOf`). Its `id` is `AT-` plus the first eight hex characters of a hash over the function id and the window's first receipt id, so the same window keeps the same id. `path` is `workload.json`, `line` is 1, `marker` is false. **`pattern` carries the text**, because the record has no text field: `fitness-trend:<id> <first> to <last> <unit> (+<percent>%, <n> runs)`, built only from the validated id, unit and numbers, at most 120 characters. The item is told apart from other attention by the `fitness-trend:` prefix; no attention pattern in `adapters/node-ts.ts` begins with it, and a test asserts that, so no schema change is needed. (A typed `kind` field on `AttentionItem` would also work; it costs a schema field and an inventory entry and gains nothing here.)

`judgeAttention` in `core/verdict.ts` emits `fitness-trend-degraded` (existing code, exit 0 in a verdict) for such an item without a clearing disposition, in place of `major-undisposed`. A clearing disposition has `outcome: "accepted"` or opens a finding, and is by `reviewer` or `user`; a `same-session` disposition does not clear it (Q6). The review manifest's evidence part adds the measures of the window (`core/review.ts`).

Proposed words (the UX Spec owns the final text; backfill required):
- **Verdict reason:** "`list-p95-ms` rose from 100 to 121 ms (+21%) over the last 3 Deep workload runs (`fitness-trend-degraded`). This is a trend of the declared workload on this machine, not a result for the whole application."
- **Question** in plain chat (a disposition on a performance regression; `ux-spec.md` §5.2): "The list p95 rose 21% over the last 3 Deep workload runs (100, 110, 121 ms). 1. Open a finding to fix it (recommended) 2. Accept it for now; the next window starts at the newest run 3. Look first". "Accepted" ends the item for that window only.
- The item is not a "shortcut" in the words of `ux-spec.md` §4.4; it is shown as "a trend".

### 5.7 Consumers the implementation must cover

`Obligation` derivation (`core/obligations.ts`, `verbs/reconcile.ts:78`); the `CheckTool` type and `project.recipe.checks` enum; envelope kinds (`core/execution-envelope.ts`); the runner dispatch (`verbs/check-execute.ts`); receipt building (`verbs/check-evidence.ts`, including the `tests` filter at line 101); the flaky rerun filter (`verbs/check-rerun.ts:35`); launched-check accounting (`verbs/check-evidence.ts:162-164`: one launched check per workload run, counted through `core/budget.ts`); the obligation fields hashed by `checkInputId` (`verbs/facts.ts:62`, `OB-workload` is simply one more entry); the check finalize path (series evaluation, attention merge); `finish` (`close()` series append, result text); `core/verdict.ts` (`judgeAttention`); `core/review.ts` (evidence summary); `inspect why` and `inspect status` text; the `Runner` port (`machine()`); the Deep budget preview (`deep-budget-preview.test.ts`; the coordinator line "State workload run counts when known" can now be exact: one per full candidate check, at most four); `recipe.json` (`checks` and `protectedPaths`; a recipe version bump), the starter skill and `tools/payload-files.json` if `workload.json` joins the template; `core/reasons.ts` (`workload-declaration-invalid`); schema 2 (§6); `delete-records`, which has no implementation yet and must remove `project.fitness` when built.

## 6. State and compatibility

- **New stored fields:** `Receipt.workload` (about 110 non-whitespace characters of schema), `project.fitness`, a record of bounded series (about 190, plus `measure` and the id pattern), and the value `workload` in `project.recipe.checks` (about 10). Together about 320 to 420 of the **463** characters free in `core/schemas.ts`. **Together with the other two pending specs the demand exceeds the free space:** diagnostics export needs about 10, the threat note about 60 to 120, so the three need about 390 to 550. QLT-11 trait state and the configuration companion also draw on schema space (`schema-migration.md` §20). Schema 2 will re-baseline `core/schemas` (the owner sets it); this spec does not propose a figure.
- **Migration (schema 1 to 2).** All three fields are semantic fields that feed a verdict, so `schema-migration.md` §18.1 (line 408) applies: each needs a strict versioned decoder and an inventory entry (exact key sets: `Receipt.workload` = `{env, samples, measures}`; `project.fitness` = record of `{points, raised?}` with the id pattern of §5.1 and `Object.hasOwn` reads; points = `{value, receipt, at, env, measure}` with bounds). Conversion of schema 1: `project.fitness` absent or empty, receipts without `workload`, and recipe `checks` unchanged (a project owes no workload until a recipe upgrade lists it, E17). **Rollback** (§16.6) is refused after any post-upgrade mutating action; the first series point is written by `finish`, so a series cannot exist while rollback is eligible (E18). **Forgetting** (§16.7): the series holds no lesson text; `forget` does not touch it; a future `delete-records` must (E19). An older kernel reads a newer document under the strict decoders: it refuses, it does not strip. Three tests own these: `fitness-migration.test.ts`.
- **No change** to the verdict endpoint set, the attention record shape, or `Grant`. One new reason code is added: `workload-declaration-invalid` (additive, TS §6.7; it needs a fixture because `tools/coverage.ts` counts codes without one). The code `fitness-trend-degraded` already exists.
- **Retention.** The series is bounded to 12 points per function and is project-level, so it outlives contracts and is not evicted with archived work.

## 7. Does it fit central code, and what does it cost?

**It does not fit.** Central has 147 characters free against a proposed ceiling and is already over the approved one (§2); `adapters/node-ts` has 0. Estimates below are not measurements. They are scaled from the e2e consumer, measured on 2026-11-03 by extracting each function and counting non-whitespace characters without leading comments: `runE2e` 714, `e2eReceipts` 585, `withE2e` 233, `wantsE2e` 81; and from existing code the change must touch: `attentionOf` 1,618 and `account` 1,080 (`verbs/check-evidence.ts`). The pure core is scaled from `core/lessons.ts` 4,491, `core/outputs.ts` 3,857 and `core/journal-reduce.ts` 2,832.

| Piece | Where | Central? | Estimate (characters) |
|---|---|---|---|
| Declaration parser, report reader, kernel judgement, harness-reason mapping, status mapping, series, trend rule, report text | `core/fitness.ts` (new; pure) | No budget matches it; function limits apply | 5,000 to 7,500 |
| `withWorkload`, `wantsWorkload`, `isSharedTest`, envelope kind | `core/obligations.ts`, `core/execution-envelope.ts` | No | 450 to 750 |
| `Runner.machine()` | `ports/types.ts`, `adapters/runner.ts` (10,232 free) | No | 200 to 350 |
| Run: build then run, environment, timeout, dispatch edits | `verbs/check-execute.ts` | Yes | 800 to 1,300 |
| Receipt building, the three filter edits, launched-check count | `verbs/check-evidence.ts`, `verbs/check-rerun.ts` | Yes | 800 to 1,300 |
| Series evaluation, attention merge | `verbs/check-evidence.ts` (`attentionOf`) and `verbs/check-finalize.ts` | Yes | 500 to 900 |
| Series append and result text | `verbs/finish.ts` (`close()`) | Yes | 300 to 600 |
| `withWorkload` call | `verbs/reconcile.ts` | Yes | 60 to 120 |
| `judgeAttention` change | `core/verdict.ts` (4,731 free) | Within its own owner | 200 to 350 |
| Manifest evidence summary | `core/review.ts` (3,179 free) | Within its own owner | 300 to 600 |
| Schema fields | `core/schemas.ts` (463 free) | Within its own owner | 320 to 420 |
| Reason code | `core/reasons.ts` | No | 300 |

**Central total: about 2,460 to 4,220 characters** (run 800 to 1,300, receipts 800 to 1,300, series 500 to 900, finish 300 to 600, reconcile 60 to 120), 17 to 29 times the 147 free. The estimate excludes `inspect why` text and the starter template edit. It needs the owner's capacity decision (decision-packet decision 1) or an offsetting removal.

**Slices.** (1) Pure `core/fitness.ts` and its tests (E2 to E9) can be built and reviewed without touching central code; it maps nothing and gets no `[QLT-05]` tag, as the unwired trait core did. (2) The central wiring and E10 to E20 follow the capacity decision and the schema 2 gate.

## 8. Alternatives considered

| Question | Options | Notes |
|---|---|---|
| Who judges the report | A. The kernel against declared targets, with the harness's reasons as evidence and exit/report agreement required (recommended). B. Trust the harness's `referencePass`. | B lets a harness constant diverge from the declaration, and a changed harness could pass quietly (WR-3, EVD-12). A shares the harness trust class either way (§1). |
| What makes the obligation owed | A. The recipe record lists `workload`, like `e2e` (recommended). B. A parsed `workload.json`. | B lets a contract remove the obligation by deleting the file (review W1). |
| Where the series lives | A. `project.fitness`, bounded (recommended). B. Derived from retained receipts of archived contracts. C. A separate `.tenet` file. | B loses points when contracts are evicted and shifts the first point silently. C adds store code (214 free) and a new strict-decoder inventory item. A needs schema 2 either way for `Receipt.workload`. |
| When a workload runs | A. Deep contracts only (recommended; TS §9.2 `release`). B. Also Standard contracts that change a path or trait the declaration lists. | B finds a slow decline sooner but costs minutes plus a build per Standard check. With A the series has one point per Deep contract, so "consecutive" means consecutive Deep contracts. Q2. |
| Dispatch | A. `kind: "workload"` with a shared predicate at three sites (recommended). B. The e2e precedent: `kind: "static"`, a tool name. | B needs no change at those sites; A keeps `kind` truthful in verdict text. |
| Where the declaration lives | A. A project file copied at scaffold, protected by the recipe (recommended). B. Recipe-only, read from the plugin payload. | B stops a project from weakening a threshold but also stops a domain increment from adding its own functions. |
| Attention text | A. Carry the numbers in `pattern` (recommended). B. A typed `kind` and a text field on `AttentionItem`. | B costs schema and an inventory entry. |

**Recommendation: all A, with the rule in §5.5.**

## 9. Owner questions

**Q1. What does "regresses by more than 20% across 3 consecutive checks" mean?** Tech Spec §12.7 gives the example; PRD QLT-05 says "a trend crossing its declared degradation threshold across consecutive checks". For values 100, 110, 121, 133:
- A. **Strictly worsening window** (recommended): every point of the last 3 is worse than the one before, and the last is worse than the first by more than 20% of the first (or the declared `floor`). Fires at 121; does not fire on 100, 100, 121. Needs no stored baseline and does not divide by a zero base.
- A′. **Non-improving window** (the earlier draft's rule): no point is better than the one before and the last is more than 20% above the first. This also fires on a single step, as in 100, 100, 121, or a one-point spike after a flat run, so it is closer to C than to a slow-decline detector.
- B. **Sustained against a baseline:** each of the last 3 points is more than 20% above a stored baseline. With baseline 100 it fires at the third point above 120 (121, 133, then the next). Needs a stored baseline and a way to reset it.
- C. **Windowed, direction ignored:** last point against the first of the 3, more than 20%. Fires on a single step and on noise.
A catches the slow decline the Tech Spec describes with the fewest false alerts; B is more noise-tolerant but later; C is simplest and the noisiest.

**Q2. Which lanes run the workload, and does "consecutive Deep contracts" meet QLT-05? (PRD narrowing.)**
- A. Deep only, and the owner confirms that "consecutive checks" may be read as "consecutive Deep contracts that ran the workload" (recommended; TS §9.2 `release`). The PRD reading is narrower in practice: ordinary work never moves the series. Every report says so.
- B. Deep plus Standard changes that touch declared paths. Finds a decline sooner, costs minutes and a build per Standard check, and needs its own cost entry.
Without an answer that says A meets the PRD, `[QLT-05]` is not added.

**Q3. Does the stored shape join schema 2?** A. Yes; add `Receipt.workload`, `project.fitness` and the `workload` check value to `schema-migration.md` §16.2 and §18.1 (recommended, because the owner is already designing schema 2 and each later bump costs a migration; but see §6 on schema space). B. Wait for a later schema and ship the pure core only. This is the owner's call on the migration gate.

**Q4. Harness ownership and the neutral starter.** The only harness is in a golden fixture, and plan §12.16 shows the starter's own reference run fails today.
- A. The neutral starter ships `workload.json`, a domain-free harness and lists `workload` in `checks` (a large starter increment).
- B. The starter lists `workload` in `checks` and ships the declaration only. Every Deep contract in it ends below `checked-local` with `evidence-inconclusive: OB-workload` until a domain increment adds a harness (E20). QLT-05's "each recipe shall declare" is met on paper while no workload can run.
- C. `workload` is listed in `checks` only by a recipe that ships a harness (recommended). The neutral starter owes none. QLT-05's "each application recipe shall declare" is **narrowed** for the neutral starter until a domain recipe exists. This narrows a Must (QLT-05, AC-19, AC-20) and is the owner's PRD decision.
B is not recommended: it leaves the starter unable to finish its own Deep work.

**Q5.** Withdrawn as a question: protecting `workload.json` and `workload/*` for recipe projects is now a requirement (WR-9, E12). The only owner item left is the recipe version bump it implies, which follows the normal recipe release.

**Q6. Disposition strength.** Tech Spec §12.7 says the item needs a disposition "the same as any other finding", and non-marker attention is cleared by a `same-session` disposition today. A degradation accepted by the model that caused it is weak. A. Require `reviewer` or `user`, as for markers (recommended; the cost is one extra question and one line in `judgeAttention`; the Tech Spec text does not forbid it). B. Follow the Tech Spec as written and revisit after real series.

**Q7. Central capacity.** §7 needs decision-packet decision 1, or the owner names what to remove.

**Q8. UX Spec amendments.** Approve the wording of §5.6 as the basis for a UX Spec change: the verdict reason, the disposition question, and the statement that a performance trend is not a "shortcut" in the words of `ux-spec.md` §4.4. The UX Spec owns the final text; this is a spec amendment that needs the owner. Recommended: yes.

## 10. Risks and assumptions

- **Project-produced numbers.** A project, or a model editing `workload/`, controls every measurement. The kernel's controls are consistency checks (E6, E6b), declared targets, the protected-path rule (E12) and visible series restarts (E9). They do not prove the measurement is honest. Anyone reading a trend must read it as such (§1).
- **Few points.** With Deep-only runs, a project may produce one point per several contracts. The rule then rarely fires, and the spec says so in the report text instead of implying coverage (WR-11).
- **Noisy hardware.** The harness cannot verify reference-hardware identity or isolation. The environment tag separates different machines but not a noisy neighbour. A false alert costs one disposition; a missed one costs the feature. No tuning of thresholds is proposed here (PRD §5.16: provisional, frozen under §6.12).
- **A failing reference run.** Plan §12.16 records the starter's reference acceptance as failing. This spec makes that a visible `fail` receipt; it does not and must not relax a target.
- **Report size.** The loan-desk report includes burst and probe arrays. The 10 MB bound applies before parsing, and only declared measures are read.
- **Declared command.** A declared `run` is project code the kernel will execute. It goes through the existing envelope consent. The reduced environment is not isolation (TS §9.3), and the result says so.
- **Unobserved:** every behavior on a native host, real run time (the 900,000 ms timeout is a guess), and how often a real project would reach three Deep contracts.

## 11. Acceptance criteria and gates

Before implementation: a second independent review with dispositions (§12 is the author's pass and the first review's record); owner answers Q1 to Q4 and Q6 to Q8; owner sign-off; the schema 2 and capacity decisions. Implementation is red-first with E1 to E20. Done when all pass, `npm run ci` passes, and the built bundle is driven on a scratch repository: a declared stub workload that prints a fixture report, three consecutive Deep contracts with worsening values, observing the attention item, the verdict reason and the disposition. Compare with E8 to E11 and record what was and was not observed. `[QLT-05]` is added only then and only with the Q2 answer. Update Tech Spec §§9.1, 12.7 and Appendix C, §6.2 (a row for `core/fitness`), the starter skill text, `recipe.json`, the PRD change-log citation, and `ux-spec.md` (the words of §5.6) only for what changes. Do not claim reference-machine qualification or host qualification.

## 12. Review pass and dispositions

### 12.1 Author's pass (2026-11-03, before the independent review)

Method: re-read QLT-05 ("Each application recipe shall declare a reference workload and fitness functions (Section 5.16); checks shall report trends across changes without claiming whole-application conformance from changed flows, and a trend crossing its declared degradation threshold across consecutive checks shall raise an attention item rather than only appear in a report"), PRD §5.16 and Tech Spec §12.7 against §§3 to 6. This was a self-review, not an independent review.

| # | Finding | Disposition |
|---|---|---|
| 1 | QLT-05 has four clauses (declare, report trends, no whole-application claim, escalate). | Fixed: WR-1, WR-5 and §5.5 "Report", WR-7, WR-6. |
| 2 | "Each application recipe shall declare": the neutral starter has no workload declaration, and the only harness is a fixture. | Open: Q4 (revised). |
| 3 | The first draft added `OB-workload` to every contract; the verdict requires a fresh passing receipt for every listed obligation. | Fixed: lane- and recipe-dependent derivation (WR-2, E1). |
| 4 | Series points per check would count iterations within one contract as "changes". | Fixed: one point per contract, appended at `finish` (E7, §5.5). |
| 5 | A rule keyed to a stored baseline needs a reset path and a place to keep it. | Accepted into Q1. |
| 6 | The attention record has no text field. | Revised: the numbers ride in `pattern` (§5.6). |
| 7 | An item id based on the contract or the check would lose dispositions on recheck. | Fixed: id from the function id and the window's first receipt id. |
| 8 | Routing normalization through a `Stack` port would hit `adapters/node-ts` (0 free). | Fixed: pure core function. |
| 9 | A new stored field in a nested object would be stripped by an older kernel. | Revised: §6 migration paragraph, `schema-migration.md` §18.1. |
| 10 | The harness's own pass constants duplicate the declaration. | Revised: kernel judges from the declaration; the harness's reasons are evidence (§5.1). |
| 11 | A workload run costs minutes. | Fixed: E15. |
| 12 | Editing the declaration is a way to hide a regression. | Revised: WR-9 is a requirement; E12 covers every field. |
| 13 | A same-session disposition of a degradation can come from the model that caused it. | Open: Q6, recommendation now `reviewer` or `user`. |
| 14 | NFR-01's reference fixtures and this feature overlap. | No change: out of scope (§1). |
| 15 | `fitness-trend-degraded` is exit 0 inside a verdict, as `major-undisposed` is. | No change needed. |
| 16 | "A window must start after the window that raised the item" needed storage. | Fixed: the series carries `raised`. |
| 17 | `target` had no stated direction. | Fixed in §5.1. |

### 12.2 Independent review (2026-11-03)

[reviews/workload-receipt-review.md](reviews/workload-receipt-review.md): 16 findings (0 Blocker, 10 Major, 6 Minor). Every finding has a disposition in the table appended to that file. This revision changes §1, WR-1 to WR-11, E1 to E20, §5.1 to §5.7, §6, §7 and §9 (Q1, Q2, Q4, Q6 revised; Q5 withdrawn; Q8 added). A second independent review of this revision is required.
