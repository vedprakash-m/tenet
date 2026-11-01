# Specification: Verified result demo paths (RES-05)

> Status: Draft for independent review and owner sign-off. No result-contract or runtime implementation is authorized by this draft. Date: 2026-10-31.
> Sources: PRD RES-05 and AC-20; Tech Spec §8.3 Result and §9.10 UI evidence; UX Spec §4.2.

## 1. Outcome

For a user-facing change, the final result gives a concise, usable path to run the changed application and steps that demonstrate the confirmed examples. For a `ui` change, the result also references screenshots captured from those examples. Commands, examples and screenshots must come from project and run evidence; the coordinator must not invent or imply verification that did not occur.

The kernel owns the verdict and result structure. Demo material is explanatory and never changes the verdict, check status, or owner acceptance.

## 2. Current state

- The Tech Spec declares an optional `Result.demo` with `run`, `steps` and `screenshots`; the `finish` response does not return it.
- The work contract retains basis element IDs, obligations and receipt summaries. The result does not expose a run command, resolved acceptance-example text, or screenshot references.
- Playwright runs use a temporary run directory and the adapter normalizes outcome counts. No kernel result path currently exposes screenshot artifacts.
- The coordinator skill now instructs reports to include a verified demo path and available UI screenshots, and a regression checks that wording. This is instruction-presence evidence only; it does not supply or validate demo data and is not sufficient RES-05 coverage.

## 3. Requirements

| ID | Requirement | Source |
|---|---|---|
| DP-1 | A user-facing result contains a run instruction that is present in project documentation or project configuration and a step-by-step demonstration of confirmed examples. | RES-05 |
| DP-2a | For a `ui` change, the kernel may reference only screenshots captured under the current contract's run directory and verified to exist. | RES-05, Tech Spec §9.10 |
| DP-2b | On a qualified host, the rendered result makes referenced screenshots accessible and identifies them as presentation, not evidence. | RES-05, Tech Spec §9.10 |
| DP-3 | Missing, stale, unresolvable or unverified demo inputs are disclosed as unavailable; they never become a success claim or alter the verdict. | PRD §4.5, Tech Spec §8.3 |
| DP-4 | Result consumers can distinguish demo guidance from check evidence and screenshots from acceptance evidence. | Tech Spec §9.10 |

## 4. Examples and test ownership

| Example | Expected behavior | Test |
|---|---|---|
| E1: a checked change has confirmed examples and a documented project run command | The result exposes the documented command and steps that name the confirmed examples; it does not substitute an unrelated test command for an application run command. | `packages/kernel/test/result-demo.test.ts` |
| E2: a `ui` example produced an in-run screenshot | The result references the screenshot from the current contract's run artifacts and marks it as presentation, not evidence. | `packages/kernel/test/result-demo.test.ts` |
| E3: no run command or screenshot artifact is available | The result states the relevant demo item is unavailable rather than guessing a command/path or silently omitting the limitation. | `packages/kernel/test/result-demo.test.ts` |
| E4: a screenshot path belongs to another contract, is outside the run directory, or no longer resolves | The result refuses that path and preserves the verdict and other result fields. | `packages/kernel/test/result-demo.test.ts` |
| E5: a change is not user-facing | No demo path is required; the result does not invent one. | `packages/kernel/test/result-demo.test.ts` |

## 5. Contract changes and design decision

The canonical Tech Spec sketches optional `Result.demo`, but does not define its producer, provenance, artifact transport, or fallback wording. Two approaches are under consideration:

1. **Kernel-built demo data (recommended for review):** the coordinator supplies a bounded demo proposal to `finish`; the kernel resolves example IDs against the accepted basis and validates commands against project configuration/documentation and screenshots against current-run artifacts. The result returns the existing optional `demo` shape. Invalid or missing elements are disclosed, not guessed. This keeps verdict fields kernel-owned while treating demo content as untrusted explanatory data.
2. **Coordinator-only rendering:** keep `finish` unchanged and require the host coordinator to construct the demo section from repository and host-visible artifacts. This avoids kernel state/response changes, but screenshot access and verified command provenance vary by host and cannot be tested by the deterministic kernel suite.

Neither approach is selected. Owner decisions are required on the authoritative source and provenance of application run commands, how demo content reaches the result without weakening `finish` idempotency, and how the host renders current-run screenshots without exposing arbitrary temporary paths. Do not solve this by treating test commands as app run commands, scanning outside an authorized run directory, adding a new verb, adding redundant basis state, or claiming host behavior not observed.

## 6. Risks and assumptions

- A model-written command can be syntactically valid but wrong for the project; a shape-only validator is insufficient.
- A temporary artifact path may not be readable or renderable by the host. A path string is not proof that a screenshot was captured or displayed.
- Acceptance examples are stored in shared intent and may be absent, changed, or not directly linkable to a finished contract; the result must preserve the basis revision and example identity.
- The demo path is not a test receipt, screenshot evidence is not acceptance evidence, and neither can strengthen the endpoint.
- Native-host screenshot rendering remains unobserved; a T1 test cannot establish it.

## 7. Acceptance and gates

Before implementation: independent review with dispositions for every finding, followed by owner sign-off on the data source, result input contract and rendering boundary. Then implement red-first, verify all examples above, run `npm run ci`, built-bundle UAT on a scratch project, privacy and whitespace checks, and update the canonical Tech Spec and UX wording only if the approved contract differs from their current wording.

Do not count RES-05 as mapped until tests exercise the real command/example/artifact result path. DP-2b requires separate exact-host evidence; a T1 test cannot establish host rendering. Do not mark the requirement qualified without its authorized evidence and host campaign.

## 8. Independent review and dispositions (2026-10-31)

Fresh-context review identified nine findings. Dispositions:

| # | Finding | Disposition |
|---|---|---|
| 1 | The source and provenance of the application run command are undefined. | **Accepted; blocker.** DP-1 needs an authoritative source before implementation. This remains an owner decision. |
| 2 | Playwright normalization and receipts do not expose screenshot artifacts or bind example IDs to them. | **Accepted in part; blocker.** Define a bounded artifact reference and its current-contract provenance. A cryptographic hash was suggested but is not required by the PRD or established as necessary; do not add one without a demonstrated integrity need. |
| 3 | The demo proposal input to `finish` and its bounds are unspecified. | **Accepted; blocker.** The draft does not choose `FinishInput` over coordinator-side rendering; resolve this together with source provenance and `finish` idempotency before implementation. |
| 4 | Add `demoStatus` to basis elements to connect examples to the demo. | **Rejected.** Existing accepted example IDs can be referenced by demo steps; a new persisted flag adds state without a requirement. |
| 5 | The user-facing wording for missing or stale demo material is unspecified. | **Accepted.** DP-3 requires an explicit unavailable status; define its exact rendering in the approved result contract. |
| 6 | The draft does not identify whether `ui` is a project or change trait for screenshot selection. | **Accepted.** The current basis stores project traits but not change traits. Resolve the selection rule without treating all project UI work as a changed UI journey. |
| 7 | Host screenshot rendering cannot be established by the kernel. | **Accepted.** Split the kernel artifact-reference rule (DP-2a) from exact-host rendering (DP-2b). No speculative `rendering` field is added. |
| 8 | Keep demo separate from check evidence in the result. | **Accepted as a constraint;** the existing optional nested `Result.demo` already supplies this separation. It need not be present for non-user-facing changes. |
| 9 | DP-2 conflated kernel path validation with host accessibility. | **Accepted.** Split into DP-2a and DP-2b; host accessibility remains unobserved until a separately authorized host check. |

**Review outcome:** implementation remains blocked by findings 1–3 and their dependent decisions. No owner sign-off is inferred from the general request to continue implementation.
