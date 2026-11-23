# Tenet technical specification: evidence payloads and real reports

> Level L2 · Version 0.12 · Part of [tech-spec.md](../tech-spec.md) · Status: **draft, awaiting the Owner's approval** · Budget: 6,000 tokens · Split from `contracts.md` §6 and §12 under the rollover rule (L-0030)

**Context card.** What each kind of evidence carries and when it is complete, and how real test reports differ from their formats. Readers are ALG-08; the report model is contracts §6.

## 1. Evidence payloads

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

## 2. Real test reports

Every reader enforces `ci.md §3` limits (`50 * 1024 * 1024` bytes per file; `20,000` cases per file and merged total; nesting depth `64`) and throws `TN-REPORT-MISSING` (missing file or empty `path[]`) or `TN-REPORT-MALFORMED` (unknown `kind` or invalid format), each with `.code`, plain message and fix. `kind === "none"` returns `{ runner: "none", cases: [], teardown_failed: false, inconclusive: true }` immediately without reading disk. Relative report paths resolve against `opts?.cwd ?? process.cwd()`, while `case.file` is relativized to `cwd` only when `opts?.cwd` is explicitly passed (otherwise keeping forward slashes). Zero cases sets `inconclusive: true`. Matrix shards passed as `path[]` merge by `full_name` using worst-status precedence `error > fail > skip > pass` (concatenating `attempts`, unioning deduplicated `tags`, keeping first non-empty `file`, summing `duration_ms` when present on any merged shard, and setting `teardown_failed: shards.some(s => s.teardown_failed)`).

- **JUnit general:** if `classname` is empty or missing, or equals `name`, `full_name` is `name`; otherwise `` `${classname} > ${name}` ``. `duration_ms` is `Math.round(Number(time) * 1000)` when finite. Repeated `<testcase>` elements with the same `full_name` in one file collapse into one case keeping all `attempts` in document order, final element's `status`, unioned `tags`, first `file` and summed `duration_ms`. `<flakyFailure>` / `<rerunFailure>` children record prior `"fail"` entries in `attempts` before the case's final status. `<property name="tenet.case" value="…">` accepts comma- or whitespace-separated tag tokens (`AB-1`, `[AB-1]`, `tenet_AB_1`), ignoring unknown/reserved prefixes and deduplicating `tags`.
- **node:test JUnit:**
  - `classname` is the `describe` name, and `file` is an absolute path (store relative to `opts.cwd` with forward slashes when `opts.cwd` is passed; otherwise forward slashes)
  - a hook failure outside any suite is wrapped in a non-standard `<undefined>` element, so readers collect every `testcase` element at any depth
- **vitest JUnit:**
  - `classname` is the file, and `name` joins `describe > test`
  - retries are invisible (the attempts are unknown)
  - a teardown failure appears as an extra failing case named after the file (non-empty `classname === name` with `fail`/`error` status): set `teardown_failed: true` and keep that failing case in `cases`
- **pytest JUnit:** a teardown failure is attached as `<error>` to the last case, with a message starting `"failed on teardown with"`. That case keeps its own status (`pass`/`fail`/`skip`), and `teardown_failed` is set `true`.
- **jest JSON:**
  - `fullName` joins with spaces; map status `passed → pass`, `failed → fail`, `pending|skipped|todo → skip`
  - retries show in `invocations` and `retryReasons`: if `invocations > 1`, `attempts` is `invocations - 1` `"fail"` entries followed by the final mapped status (or `retryReasons.length` `"fail"` entries if `invocations` is absent); otherwise `[status]`
  - a teardown failure sets the file's `status: "failed"` with no failed case: set `teardown_failed: true` without adding synthetic cases
- **go-test-json:** read NDJSON `Test` events (ignoring `Action: "output"`, empty `Test`, or incomplete tests without a terminal `pass`/`fail`/`skip`); subtests (`Test` with `/`) emit their own case and suppress duplicate counting of their parent `Test`. When `Package` is empty, `full_name` is `Test`.
- **ctrf:** map `passed → pass`, `failed → fail`, and `skipped`, `pending`, `other` or any unrecognized status to `"skip"`; tags come from `name` plus normalized tokens in `extra.tenet_cases` (deduplicated).
- **XML:** refuse `<!DOCTYPE` or `<!ENTITY` with `TN-REPORT-MALFORMED`; decode standard XML entities (`&lt;`, `&gt;`, `&amp;`, `&quot;`, `&apos;` and numeric character references); treat `<failure>`, `<error>`, `<system-out>` and `<system-err>` bodies as unparsed character data (`stopNodes`) so angle-bracket tokens like `<work>` or `<anonymous>` inside stack traces never break parsing.
