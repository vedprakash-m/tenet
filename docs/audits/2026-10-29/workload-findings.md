# Workload continuation — October 29, 2026

Status: ◐ local, uncommitted, unqualified. This advances the S8b measurement-tooling part of the [completion plan](../2026-10-28/completion-plan.md). The earlier audit remains the broader gap inventory.

The loan fixture now has a reproducible production-process workload and a two-second diagnostic smoke. The neutral starter, dependency graph, security settings and kernel behavior are unchanged. The harness verifies its private server identity, seeds a fresh full-size database, measures real HTTP responses/server metrics, checks database invariants independently and removes its owned processes/data. The root golden loop must admit and exercise the complete fixture, including these controls.

## Corrected full observation

[Machine-readable report](workload-reference-observation.json) records the complete 30-second warm-up and 120-second window on Node 26.3.0, macOS arm64 with 38,654,705,664 bytes of RAM. This is not the specified 16 GB reference machine or an isolated qualification campaign.

| Operation | Attempts | Validated successes | HTTP 429 |
|---|---:|---:|---:|
| List | 6,623 | 150 | 6,473 |
| Reserve | 1,892 | 42 | 1,850 |
| Return | 946 | 21 | 925 |

Only 213 successful samples were collected against the required 5,000. Successful p95 observations were about 58/50/29 ms, but that sparse accepted subset cannot establish workload performance. The report separates these from refusal latency. Peak server RSS was 331,710,464 bytes against the 300,000,000 target; observed event-loop p95 was 12.21 ms. No duplicate active item or FK violation was found. The independent writer was held for about two seconds, but no matching busy degradation response was observed. All twelve bursts and four-account probes were attempted; required success coverage was not achieved. Cleanup completed.

The existing rate limiter remains enabled (`server/src/app.ts`, global 120/minute; account sign-in also has its existing five/minute key). Twenty loopback clients share an IP. Rate refusals starve the successful workload, burst/probe coverage and writer observation; they are failures, not acceptable fast performance samples. No admission-policy change is authorized by this observation. The RSS failure is a measured server-process result on this runtime, not a root-cause diagnosis or every-platform claim.

An earlier full run also found an invalid-return defect in the harness: clients could drain their three initially owned loans. A failing real seed/ownership test reproduced insufficient inventory. The corrected seed assigns 250 active loans to each of twenty baseline clients, and each client cycles the requested operation mix. The final full report contains no invalid-return status. The earlier report is superseded; it is not the final benchmark source.

## Supported minimum comparison

The [final Node 22.12 report](workload-reference-minimum-observation.json) uses identical executable source and the same full protocol, run sequentially while other validation jobs were idle. It also fails: 9,247 of 9,460 operations are rate-refused, with only 213 successful samples and incomplete burst/hash/busy coverage. Peak server RSS is 297,517,056 bytes, below the target in this observation; event-loop p95 is 12.23 ms. There are no invalid returns, duplicate active items or FK violations, and cleanup completes. This runtime difference makes memory diagnosis important; it does not establish the cause or qualify either runtime on the reference tuple.

Both final full runs have no `MaxListenersExceededWarning`. The first minimum run exposed twenty per-client pacing waits registering listeners on one cancellation signal. A real-process smoke assertion reproduces that warning before repair. Removing unnecessary listeners from the 250 ms think waits fixes it without raising/disabling a threshold; abort checks retain bounded pacing cancellation. Minimum types/lint and all fourteen controls pass. Both full measurements and final integrated checks use this frozen corrected source.

## Efficient remaining sequence

1. Review a concrete legitimate-user admission contract against abuse protection. Recommend evaluating authenticated per-user operation budgets while retaining anonymous IP and account sign-in controls; compare exact key derivation, NAT/shared-IP behavior, session changes and refusal tests before owner sign-off. Changing limits or trusting forwarded client IPs just to pass the driver is not a repair.
2. Diagnose server RSS using the same final workload on an otherwise idle machine. Separate baseline/startup/hash concurrency/steady-state allocation and compare the supported minimum runtime. Preserve the real hash and concurrency limits. Do not use forced GC or hide peak samples to manufacture a pass.
3. Re-run full traffic with enough successful samples and all twelve bursts, sign-in probes and observed busy responses; then run on the specified reference tuple. Keep all failed/unknown coverage explicit.
4. Complete the kernel workload obligation/report normalization and baseline/trend/threshold-attention mechanism after its contract review and budget assessment. The current central module budget has only nine normalized characters free; do not bypass or raise it implicitly.
5. Continue independent quality exits: API compatibility/trait/semver and changed-journey consumers, ASVS applicability/results, manual screen-reader observations, independent recovery review, then unsigned configuration/schema/reconfirmation contracts and separately authorized native-host/release qualification. The ledger still accepts no requirement evidence.

Functional CI and built current/minimum CLI results are recorded separately in `workload-validation.json`; they do not turn this failed local workload into qualification.

The initial integrated `finish` refused `checked-local` because the fixture changed `package.json` and `tsconfig.json` after its baseline red. That is a correct evidence-integrity refusal. Move those infrastructure declarations before the red and preserve them through the candidate; do not weaken fingerprinting or override the verdict. Final gates pass on that corrected arrangement: full CI 1,237 tests/202 suites, zero failures/skips, and both current/minimum actual built feature loops assert 82 evolved app/15 browser cases.

A separate current-runtime UAT sends real SIGTERM after the production server takes its database owner file. The driver exits 130 with no partial report, the server PID is gone and the dedicated temporary directory is empty. This observes startup cancellation cleanup; it does not establish forced-SIGKILL recovery.
