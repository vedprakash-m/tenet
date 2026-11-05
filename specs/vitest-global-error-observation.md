# Vitest global-error observation

Status: Draft; implementation not approved. Related: TDD-02, EVD-02, EVD-05,
tech spec sections 9.3, 9.5 and 9.6.

## Problem and observed scope

Vitest 5.0.5's built-in JSON reporter omits global errors. An assertion failure
and an unhandled rejection both produce exit 1, but the JSON names only the
assertion; the shipping adapter can incorrectly establish behavioral red.
Enforcing `dangerouslyIgnoreUnhandledErrors=false` does not distinguish these
runs. An imported `onUnhandledError` callback can discard the error before both
exit checking and reporter completion. Lexical inspection of the root config
cannot establish the effective callback.

On Windows Node 24.22.1 and 22.12.0, an isolated completion reporter observes
global rejections and uncaught exceptions, including beside assertion failures.
It does not recover errors discarded by an imported callback. An isolated
public-API launcher with an inline `onUnhandledError: () => true` override
also preserves the imported-filter fixture's error. These are feasibility
observations, not shipping implementation, approved contracts or host qualification.

## Proposed contract

1. A completed Vitest report must contain a required, nonnegative safe-integer
   global-error count produced from the runner's complete completion-callback
   population. It is not inferred from exit status, stderr or assertion messages.
2. Missing, malformed or nonzero counts make the entire report invalid using
   the existing `report-invalid` receipt reason. No whole-file, suite, tagged
   selection or rerun can turn that observation into passing or behavioral-red
   evidence. An invalid original run cannot be upgraded by a passing rerun.
3. Ordinary passing tests, assertion-only red, suite-hook failures, focus refusal
   and diagnostic bounds retain their existing semantics.
4. The launch must prevent configured callback filtering before the runner
   records errors, including the observed imported callback. A completion
   reporter alone is insufficient. Configuration evaluated later or per-project
   overrides must either preserve this control or refuse explicitly.
5. Only a complete, run-bound report is eligible. Publication failures, missing
   completion, interruption, oversized output and uncertain termination remain
   inconclusive under existing rules. A partially written built-in report must
   never serve as a successful fallback.
6. Previous adapter/report identities become stale; historical receipts are
   never rewritten. No new state schema, receipt failure kind or reason code is
   proposed.

## Recommended mechanism and unsettled implementation details

Use the installed runner's public launch API with kernel-owned admission
options and a kernel-owned completion reporter. Produce one JSON report with
assertions and the required global-error observation; retain the existing
`RunResult.report`, `RunFacts.raw`, `Stack.normalize` and receipt boundaries.
This avoids another independent observation channel through the full pipeline.

The runnable session prototype uses Vitest's JSON reporter as a base, redirects
its incomplete intermediate report, and publishes the augmented final report.
It supplies inline launch options overriding the imported filter. Its absolute
local imports, inherited reporter internals, intermediate-file handling and
small predicate-based normalizer are **not a shipping implementation design**.

**Feasibility blocker, not ordinary remaining polish:** only ten non-whitespace
characters remain in the node adapter's owner. The recommended launcher/reporter
has not been shown to fit. No shipping implementation can start until a measured
same-owner candidate fits without weakening controls, or a separately measured
owner decision changes this constraint. The recommendation below is design
direction only, not a claim that the mechanism is feasible within the current cap.

Before implementation sign-off, settle and review all of:

- Portable loading of the already-admitted project runner without computed
  imports, evaluation or a second uncontrolled execution surface.
- Exact executable/payload topology, invocation and execution-envelope binding;
  include every helper/intermediate artifact and its identity. Do not silently
  add a public verb, hidden unbound helper or second shipped executable.
- Public API compatibility for every admitted Vitest major, complete callback
  precedence across root/per-project configuration, and late-error lifecycle.
  The current observation covers only Vitest 5.0.5 with one project.
- Explicit prevention of automatic dependency installation or fetching through
  the programmatic API; existing direct invocation's no-download contract stays.
- Bounded report generation, strict field admission, publication/crash behavior,
  permissions and preservation of foreign/replaced destinations.
- Measured same-owner fit. The shipping node adapter is 20,150/20,160
  non-whitespace characters; the central owner is at its ceiling. No cap
  increase, owner-matcher change or moving implementation out of its owner is
  authorized by this draft.

## Alternatives

| Alternative | Disposition |
|---|---|
| Plain JSON plus nonzero exit | Rejected: actual mixed-error reports establish false assertion-only red. |
| Parse stderr or arbitrary diagnostic words | Rejected: JSON-only reporting omits the signal; project output is not an authoritative global-error population. |
| Completion reporter alone | Rejected as a complete fix: imported-filter controls still establish false red. |
| Built-in blob or an additional JUnit report | Not selected: different parser/channel and compatibility obligations; filtering still precedes completion. JUnit additionally changes the JSON-only mechanism. |
| Public API launch plus complete JSON observation | Recommended direction, conditional on the implementation details above and owner approval. |

## Behavior examples and test map

These are required implementation tests, not claims that they already exist.

| Example | Expected result | Test file |
|---|---|---|
| Passing test; zero observed global errors | Passing full-file and tagged receipts | `packages/kernel/test/receipts.test.ts` |
| Assertion-only failure; zero global errors | Assertion-only behavioral red remains eligible | `packages/kernel/test/receipts.test.ts` |
| Assertion failure plus unhandled rejection | Invalid entire report; no behavioral baseline match | `packages/kernel/test/receipts.test.ts` |
| Passing test plus rejection or uncaught exception | Invalid report, never pass | `packages/kernel/test/receipts.test.ts` |
| Imported callback returns false; assertion also fails | Effective launch preserves the global error in completion or refuses; never behavioral red. Does not claim to identify the filter. | `packages/kernel/test/static-conformance.test.ts`, `packages/kernel/test/receipts.test.ts` |
| Missing/string/fractional/negative/boolean/null/object count | Invalid before any evidence projection | `packages/kernel/test/receipts.test.ts` |
| Error population exceeds displayed-example cap | Still invalid; count cannot be truncated with examples | `packages/kernel/test/receipts.test.ts` |
| Invalid mixed run followed by an actual passing rerun | No upgrade of original invalid observation | `packages/kernel/test/scenarios.test.ts`, `packages/kernel/test/receipts.test.ts` |
| Reporter fails or process is killed before final publication | No eligible incomplete/raw fallback | `packages/kernel/test/runner-artifact.test.ts`, `packages/kernel/test/runner-ownership.test.ts` |
| Execution-envelope plan, dependency consent and installed version move | Existing admission binds exact launcher and owned report; changed inputs refuse/stale | `packages/kernel/test/execution-envelope.test.ts`, `packages/kernel/test/static-conformance.test.ts` |

All table paths name existing files; the new cases are not implemented.
The existing explicit-token refusal tests in `static-conformance.test.ts`
remain prior art, not new imported-graph coverage. The effective-callback
controls must extend these without duplicating their claims.
Real-process cases must use both minimum
and current runtimes and every admitted runner major, then built public POSIX
dispatch. A source-only mock, the Windows mutation refusal, or reusing the same
receipt twice is not a real rerun.

## Acceptance, risks and assumptions

Acceptance requires independent review and disposition, owner sign-off on the
complete mechanism, red-first tests, unchanged-budget `npm run ci`, built
scratch-repository UAT, exact artifact evidence, and plan/changelog updates.
Do not promote TDD-02 or EVD-05 while filtering/lifecycle/compatibility or
qualification obligations remain unresolved.

Assumption: the runner's completion population, with filtering prevented,
is sufficient for the errors it promises to observe. This is not a guarantee
about arbitrary swallowed exceptions, malicious test code, errors after the
runner's observation lifecycle, or host behavior. Any wider claim needs its own
evidence. The single-project prototype does not establish that assumption for
all supported configuration graphs.

## Review and disposition

A fresh-context review found two implementation blockers and two clarifications:

| Finding | Disposition |
|---|---|
| Two test-map filenames did not exist | Corrected to existing scenario/receipt and runner-artifact/ownership files. No tests are claimed implemented. |
| Near-zero owner capacity could make the mechanism infeasible | Raised to an explicit feasibility blocker above. Measured fixed-budget fit or a separately approved owner decision is required before implementation. Remains open. |
| Prior lexical callback guard/tests were insufficiently acknowledged | Identified as retained prior art; new imported-graph tests must not duplicate those claims. |
| Launcher observation could be overread as detecting the filter | Acceptance wording now requires error preservation or refusal, not identifying the callback; only the single imported fixture is observed. |

Review supports coherent design direction, **not implementation sign-off**.
No runtime source, bundle, payload, capacity policy, public CLI, admission rule
or canonical mechanism is changed by this draft. Portable topology, complete
configuration precedence and measured fit remain blockers; no owner approval
has been inferred.

The focused owner question about changing the direct-CLI/plain-JSON mechanism
returned user unavailable with autonomous-work guidance, not a selection of
either alternative. It does not supply mechanism or implementation approval.
