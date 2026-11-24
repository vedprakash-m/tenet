---
tenet: {spec: 1, doc: tech-spec, level: L2, version: "0.12", owner: ved}
sections:
  _preamble: {state: draft, digest: sha256:80012618c3b959c8d1a1becc4fe1b34170d086bdb8a320a2cda7d67189b73ae4, flags: []}
  1-evidence-payloads: {state: draft, digest: sha256:832ed7d1c26a78079dfb097a6b34f21b2d26d7dff48bcff609e7d17c84514cdb, flags: []}
  2-real-test-reports: {state: draft, digest: sha256:38a40f209ea0d3967857ddb8f25e1836fcfe3d872cada41c88e26bbbf7a43ef1, flags: []}
  3-test-evidence-matching-alg-08: {state: draft, digest: sha256:76c164440a8733550e10a3f804b7fea65f39b028f529d6f54a7c1f318a80fe7d, flags: []}
  4-trust-observations-and-guarantee-levels: {state: draft, digest: sha256:18cada498cd28f3908a8137e9019c5c336dd0329bbfaffeb47a73dcff36c35eb, flags: []}
---
# Tenet technical specification: evidence payloads and real reports

> Level L2 · Version 0.12 · Part of [tech-spec.md](../tech-spec.md) · Status: **draft, awaiting the Owner's approval** · Budget: 6,000 tokens · Split from `contracts.md` §6 and §12 under the rollover rule (L-0030)

**Context card.** What each kind of evidence carries and when it is complete, and how real test reports differ from their formats. Readers are ALG-08, in §3; the report model is contracts §6.

## 1. Evidence payloads

| Kind | Payload | Completes when |
|---|---|---|
| `check` | report digest, log hash, fix hints `[{rule_id, path, hint}]` | Its expected cases were discovered and run (zero discovered is inconclusive); a static method reports the scope it analyzed |
| `measurement` | `{metric, value, threshold, direction, samples, baseline_value, rule, scope, confidence, scope_digest?, complete?, tool?, tool_version?, config_digest?, missing_metadata?, quarantined?}` (`tool` from `<base>` `tenet.yaml` check declaration; `complete: null` + named `missing_metadata` for advisory raw `lcov`/`cobertura`; TypeScript source maps enabled for info-only coverage dogfooding; subject-executed checks stay within `ci.md §5:185`'s honest limit until `CP-0064`); mutation counts (eligible, generated, executed, killed, survived, invalid, equivalent, timed out, excluded) | Samples meet the pass rule's minimum (and for enforced health indicators, required `tenet-health-json`/`sarif` metadata is complete) |
| `attestation` | Artifact hashes (screenshots, recordings, traces) | The attested artifact is present |
| `observation` | Outcome status (`recovered`, `partial`, `no-change`, `insufficient-exposure`, `unknown`), scope, window; trust observations | The window has closed or the exposure is sufficient |
| `review` | `{round, judge, model_family, status, findings, invalid, resolved, requires_human}`; each finding is `introduced`, `exposed`, `inherited` or `uncertain`, and `located` or `substantiated` | Every finding is located or moved to `invalid`, which makes the review `incomplete` |
| `proof` | `{prover, version, theorem_hash, obligations, audit: {escape_hatches, axioms_used, axioms_allowed, unsafe_added}}` | Every obligation is discharged, the audit is clean and `theorem_hash` matches the approved definition; a model-check timeout is `unknown` |
| `simulation` | `{seed, fault_profile, steps, properties, replay, twin?}` | The replay command reproduces the result |
| `differential` | `{reference, generator, cases, divergences}` | All cases ran |

## 2. Real test reports

`init` writes the runner's own command with these flags (never `npm test -- …`):

| Runner / kind | `checks.<name>.run` | `report`, `report_from` |
|---|---|---|
| vitest | `npx vitest run --reporter=default --reporter=junit --outputFile.junit=.tenet/reports/<name>.xml` | `junit`, file |
| jest | `npx jest --ci --json --outputFile=.tenet/reports/<name>.json` | `jest-json`, file |
| node:test | `node --test --test-reporter=spec --test-reporter-destination=stdout --test-reporter=junit --test-reporter-destination=.tenet/reports/<name>.xml` | `junit`, file |
| pytest | `python -m pytest --junitxml=.tenet/reports/<name>.xml` | `junit`, file |
| go | `go test -json ./...` | `go-test-json`, stdout |
| ctrf | runner's CTRF command writing `.tenet/reports/<name>.json` | `ctrf`, file |
| other | the user's own command | `none`: per-test results unavailable |

Every reader enforces `ci.md §3` limits (`50 * 1024 * 1024` bytes per file; `20,000` raw cases per file before retry collapsing and `20,000` merged total; nesting depth `64`) and throws `TN-REPORT-MISSING` (missing file or empty `path[]`) or `TN-REPORT-MALFORMED` (unknown `kind` or invalid format), each with `.code`, plain message and fix. `kind === "none"` returns `{ runner: "none", cases: [], teardown_failed: false, inconclusive: true }` immediately without reading disk. Relative report paths resolve against `opts?.cwd ?? process.cwd()`, while `case.file` is relativized to `cwd` only when `opts?.cwd` is explicitly passed (otherwise keeping forward slashes). Zero cases sets `inconclusive: true`. Matrix shards passed as `path[]` merge by `full_name` using worst-status precedence `error > fail > skip > pass` (concatenating `attempts`, unioning deduplicated `tags`, keeping first non-empty `file`, summing `duration_ms` when present on any merged shard, setting `teardown_failed: shards.some(s => s.teardown_failed)`, and `inconclusive: mergedCases.length === 0`).

- **JUnit general:** if both `classname` and `name` are missing/empty, throw `TN-REPORT-MALFORMED`; if `name` is missing/empty with non-empty `classname`, `full_name` is `classname`; if `classname` is empty/missing or equals `name`, `full_name` is `name`; otherwise `` `${classname} > ${name}` ``. Inherit `file` from the nearest ancestor `<testsuite file="…">` when `<testcase>` omits `file`. `duration_ms` is `Math.round(Number(time) * 1000)` when finite. Repeated `<testcase>` elements with the same `full_name` in one file collapse into one case keeping all `attempts` in document order, final element's `status`, unioned `tags`, first `file` and summed `duration_ms`. `<flakyFailure>` / `<rerunFailure>` children record prior `"fail"` entries in `attempts` before the case's final status. Read `<properties><property name="tenet.case" value="…">` at the `<testcase>` level only (not `<testsuite>`); accept comma- or whitespace-separated tag tokens (`AB-1`, `[AB-1]`, `tenet_AB_1`), ignoring unknown/reserved prefixes and deduplicating `tags`.
- **node:test JUnit:**
  - `classname` is the `describe` name, and `file` is an absolute path (store relative to `opts.cwd` with forward slashes when `opts.cwd` is passed; otherwise forward slashes)
  - a hook failure outside any suite is wrapped in a non-standard `<undefined>` element, so readers collect every `testcase` element at any depth
- **vitest JUnit:**
  - `classname` is the file, and `name` joins `describe > test`
  - retries are invisible (the attempts are unknown)
  - a teardown failure appears as an extra failing case named after the file (non-empty `classname === name` with `fail`/`error` status): set `teardown_failed: true` and keep that failing case in `cases`
- **pytest JUnit:** a teardown failure is attached as `<error>` on the last case, with `message` (else body text when `message` is empty) starting `"failed on teardown with"`. That case keeps its own status (`pass`/`fail`/`skip`), and `teardown_failed` is set `true`.
- **jest JSON:**
  - `fullName` joins with spaces; map `passed → pass`, `failed → fail`, `pending|skipped|todo → skip`, and throw `TN-REPORT-MALFORMED` on any unrecognized status; `duration_ms` is `Math.round(duration)` when finite
  - retries show in `invocations` and `retryReasons`: if `invocations > 1`, `attempts` is `invocations - 1` `"fail"` entries followed by the final mapped status (or `retryReasons.length` `"fail"` entries if `invocations` is absent); otherwise `[status]`
  - a teardown failure sets the suite's `status: "failed"` with zero failed `assertionResults`: set `teardown_failed: true` if any `testResults[]` suite meets this without adding synthetic cases
- **go-test-json:** read NDJSON `Test` events (ignoring `Action: "output"`, empty `Test`, or incomplete tests without a terminal `pass`/`fail`/`skip`); 0 lines or 0 terminal cases returns `cases: [], inconclusive: true`. Collapse repeated terminal events for the same `(Package, Test)` into `attempts` keeping the final status; `duration_ms` is `Math.round(Elapsed * 1000)` when finite. Subtests (`Test` with `/`) emit their own case and suppress duplicate counting of their parent `Test`. When `Package` is empty, `full_name` is `Test`.
- **ctrf:** map `passed → pass`, `failed → fail`, and `skipped`, `pending`, `other` or any unrecognized status to `"skip"`; read `case.file` from `filePath ?? file` and `duration_ms` from `Math.round(duration)` (milliseconds) when finite; tags come from `name` plus normalized tokens in `extra.tenet_cases` (deduplicated).
- **XML:** refuse `<!DOCTYPE` or `<!ENTITY` with `TN-REPORT-MALFORMED`; decode standard XML entities (`&lt;`, `&gt;`, `&amp;`, `&quot;`, `&apos;` and numeric character references); treat `<failure>`, `<error>`, `<system-out>` and `<system-err>` bodies as unparsed character data (`stopNodes`) so angle-bracket tokens like `<work>` or `<anonymous>` inside stack traces never break parsing.

## 3. Test evidence matching (ALG-08)

**Test reports and items.**

| Format | Case name | Status | Tags |
|---|---|---|---|
| JUnit (any `testsuite` nesting) | `classname > name` | failure → fail, error → error, skipped → skip | from the name plus `tenet.case` properties |
| CTRF | `tests[].name` | passed, failed, skipped (pending and other count as skip) | from the name plus `extra.tenet_cases` |
| `go-test-json` | `Package > Test`; a subtest (`Test/sub`) is its own case, and its parent doesn't count twice | the final pass, fail or skip action | from the name |
| `jest-json` | `assertionResults[].fullName` | its status | from the name |

- **Readers:** see `evidence.md §2`.
- **Tagged declarations** (`ALG-09` patterns): multi-line `it`/`test` title within next 3 lines; `def test_…`; `t.Run(`; `@Test` or `#[test]` with method/fn within next 3 lines; `record_property("tenet.case", "<tag>")` in test body. Exclude `describe(` from `declarations[]`; its tag propagates across its `{…}` body with `via_describe: true` iff an enclosing `describe(` contributes ≥1 tag absent on the declaration. `end_line` = closing brace (ignoring comments/strings in brace languages), closing `)` of expression-arrow tests, or last non-blank indented body line. Strip `_?tenet_(?:AB|<prefix>)_\d+` (and trailing `_` if leading), collapsing spaces/`__` and trimming `_`/whitespace for `name`.
- **Which tags count:** `AB-n` counts when its source line or enclosing `describe(`-inherited inner declaration line is added in `git diff -U0 <base>..<tested>`; requirement tags count anywhere. Unknown/reserved tokens ignored (contracts §1).
- **Matching:** strip tags/`case.tags` from case name first, drop any trailing pytest `[…]` suffix, then match suffix against tagless declaration title/fn; placeholders (`%s %d %i %f %j %o %p %#`, `$name`, `${…}`) match `.+`. `coverage` is `confirmed` iff `declarations.length > 0` and every declaration has `≥1` case (else `not-confirmed`).
- **Item result & counts:** `failed` (any fail/error) > `not-run` (0 cases or any declaration unmatched) > `skipped` (all cases skipped) > `passed` > `no-test` (0 declarations). `tests.expected` = declaration count; `passed`/`failed`/`skipped` = counts over deduplicated matched cases; `not_run` = unmatched declarations. `first_failure` = `{full_name, status}` of first matched case whose final `status` is `fail`/`error`, else `null`.
- **Authorship:** per-declaration in `declaredTags`: `written-here` if tagless title was absent in that `file` (or `-M` source) at `base`, `unknown` if `via_describe`, else `tag-added-here`; `itemResults` aggregates (`unknown` if empty or any `unknown`; else `written-here` if all `written-here`; else `tag-added-here`).
- **Check vs cases:** non-zero check exit or `teardown_failed` fails the check; items keep case results.
- **Fixtures:** missing second declaration → `not-run`; old `[AB-1]` ignored; newly tagged test → `tag-added-here`; fail-then-pass retry; matrix shard; teardown failure; all runner declaration forms.

## 4. Trust observations and guarantee levels

The attest job observes:
- **T1:** the verifier runs from a protected source
- **T2:** evidence verifies against that source's identity
- **T3:** decisions reserved to people carry proof an agent can't produce

**T4** (agents never hold decision-makers' credentials) is declared and spot-checked: agent commits come from `bots[]`, and no owner acts on a pull request their agent session opened. It supports enforced\* only where a host binding attests it.

Separately, the attest job observes **whether merging requires the Tenet status** (`unavailable` on forge plans without merge protection). `enforced*` counts as enforced while the latest observation is under 7 days old and holds; otherwise it counts as detected. `tenet doctor` reads it offline.

| Rule | Mode A (deterministic engine) | Mode B (host-driven) with CI |
|---|---|---|
| Gate holds before advancing | enforced | detected locally; enforced* by replay and required status |
| Evidence produced by a protected verifier (provenance) | enforced* | enforced* |
| The check written apart from the claimant (independence, tech spec §3.1) | as recorded | as recorded; a signature never establishes it |
| Code under test cannot fake its check | not guaranteed | not guaranteed |
| Decisions made by a person | at the proof-table strength | at that strength; `forge-verified` enforced* only under T4; `key`, `channel` advisory. A forge session or key alone never shows that agents and decision-makers are separate |
| Protected paths unchanged | enforced* | enforced* (detected below `verify`) |
| Holdout hidden | enforced* if the binding shows builders can't read the external holdout | the same; advisory in-repo |
| Agent tools, paths, network | as the adapter declares | as the host binding declares |
