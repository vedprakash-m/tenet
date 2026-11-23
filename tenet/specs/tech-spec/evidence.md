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

- **node:test JUnit:**
  - `classname` is the `describe` name, and `file` is an absolute path (store it relative)
  - a hook failure outside any suite is wrapped in a non-standard `<undefined>` element, so readers collect every `testcase` element at any depth
- **vitest JUnit:**
  - `classname` is the file, and `name` joins `describe > test`
  - retries are invisible (the attempts are unknown)
  - a teardown failure appears as an extra failing case named after the file
- **pytest JUnit:** a teardown failure is attached as `<error>` to the last case, with a message starting "failed on teardown with". That case keeps its own status and the check fails.
- **jest JSON:**
  - `fullName` joins with spaces
  - retries show in `invocations` and `retryReasons`
  - a teardown failure sets the file's `status: failed` with no failed case
- **XML:** standard entities are decoded; a `DOCTYPE` is refused.
