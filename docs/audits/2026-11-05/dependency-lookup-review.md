# Independent review: dependency lookup continuation — November 5, 2026

Scope: only the continuation adding `releaseLookups`/`releaseAge` in `core/dependency-admission.ts`, their use by `decisions/dependency-start.ts`, the new `dependency-lookups.test.ts`, and the two new lookup integration cases in `dependency.test.ts`. Earlier uncommitted dependency/parser/project-text fixes were preserved and were not reconsidered as a new design. No source was edited; this report is the only reviewer-authored change.

**Verdict: no actionable defect found in this bounded delta.** It is compatible with Tech Spec §9.11's registry-version age normalization and the rule that unavailable metadata remains unknown. This is a source/test review, not full dependency conformance, independent owner sign-off on an unsigned feature, or qualification evidence.

## Findings and evidence

| Boundary | Review result |
|---|---|
| Lookup identity | `releaseLookups` (`core/dependency-admission.ts:56–65`) deduplicates registry observations by package name/version, preserving the first representative. Distinct versions and scoped names remain distinct. Non-registry observations do not consume lookup slots. The diff's complete observation population is still passed to dependency judgment; deduplication affects network lookups only, so transitive/path-specific observations are not dropped from the policy population. |
| Finite work | The old maximum remains 50 actual `npm view` calls. The limit now applies after version deduplication, allowing repeated installed paths to share one response rather than hiding later unique versions behind the cap. Versions beyond the limit have no age entry and therefore follow the existing unknown-age policy. No retry, parallel worker or additional bound is added. |
| Evidence admission | `releaseAge` (`core/dependency-admission.ts:68–73`) accepts date stdout only for explicit exit 0, no timeout, no signal and no truncation. Missing/nonzero exit, signal, timeout or truncation returns unknown even when stdout contains a valid old date. The existing date helper then rejects malformed/non-finite ages. |
| Runner contract | `RunResult` already exposes `exit`, `signal`, `timedOut` and optional `outputTruncated` (`ports/types.ts:156–158`). The production runner sets timeout/truncation and resolves signal/exit after process close (`adapters/runner.ts:143–178`). No new adapter metadata or persisted field is assumed. A truncation flag caused only by stderr also conservatively makes age unknown. |
| Policy behavior | `releaseAges` (`decisions/dependency-start.ts:45–60`) stores only the admitted age or undefined. The existing `judgeDependencies` path still applies `unknown_age` and governs publication before preview/install. Lookup failure does not become false verified age; it also does not silently strengthen an owner-selected allow/approval policy into a new hard failure. |
| Fact/authority boundary | The same guarded runner, argv, private run directory, process timeout and existing dependency intent are used. The change grants no authority, writes no new source/state field, adds no credential forwarding and does not run scripts. It changes neither publication/restore sequencing nor the existing external-writer race. |

## Tests inspected and run

Ran `node --test packages/kernel/test/dependency-lookups.test.ts`: **3/3 pass**, no skips. The controls cover duplicate installed paths, distinct versions/scoped names, non-registry exclusion, the 50-unique-version bound, every rejected command termination/output condition, and a successful positive date result.

Read the new decision-pipeline controls in `dependency.test.ts`: failed/timed-out lookups with valid-looking stdout under `unknown_age: deny` must reject without publishing the manifest/lock or installing; repeated installed copies of one version must produce one `npm view` invocation. The root agent owns the full integration, static, built-artifact and CI gates; those were not rerun by this reviewer.

## Claims to retain as partial

- This deduplicates **within one resolution job**. It does not introduce a persisted or cross-request cache for the whole contract. Tech Spec §9.11's broader “cached per version for the contract” wording must not be marked fully implemented solely from these tests.
- The 50-call bound and existing per-command 60-second timeout do not establish a 10-minute aggregate dependency-job deadline. Aggregate timing/accounting and later retries are unchanged by this delta.
- The key relies on the normalized package-name/version profile. This is not a new claim of arbitrary hostile-lockfile grammar conformance or complete manager/config provenance.
- No process crash/restart, source publication race, prior-preview migration, recipe-license consumer, live host or release gate is closed by this bounded repair.

The continuation can proceed through the existing final validation gates without a new feature-policy choice. It does not authorize any unrelated unsigned contract or capacity increase.
