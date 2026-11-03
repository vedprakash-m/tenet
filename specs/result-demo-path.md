# Specification: Verified result demo paths (RES-05)

> Status: Kernel-validated proposal direction selected for contract development/review on 2026-11-01; §§9–19 are the review draft; §19 supersedes the §18 retirement candidate. Production implementation/sign-off remain open. Original draft: 2026-10-31.
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

Historical October 31 state (superseded by §9 for direction only): neither approach was selected. Owner decisions were required on the authoritative source and provenance of application run commands, how demo content reaches the result without weakening `finish` idempotency, and how the host renders current-run screenshots without exposing arbitrary temporary paths. Do not solve this by treating test commands as app run commands, scanning outside an authorized run directory, adding a new verb, adding redundant basis state, or claiming host behavior not observed.

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

## 9. Owner-selected design work (2026-11-01)

The owner answered **“Develop the kernel-validated proposal contract for review.”** This selects the direction for this draft, not production implementation, a new persisted schema, budget changes, host rendering, or execution of proposed commands. Sections 10–16 supersede conflicting proposals in §5; the original review remains historical. Canonical PRD/Tech/UX semantics are unchanged pending review and sign-off.

The kernel validates bounded references and observed provenance. It does **not** prove semantic entailment between a step and an example, that a documented command starts the intended app, or what screenshot pixels depict. Those limits must survive rendering. No demo input supplies authority, a check receipt, acceptance, or a stronger verdict.

## 10. Proposed input and output contract

### 10.1 Input

Add optional `FinishInput.demo`. Existing finish calls remain valid. Use the existing JSON-valued flag transport, `finish --h <handle> --demo '<JSON>'`; `finish` does not start consuming stdin. No new verb or decision kind.

```ts
type DemoProposal = {
  surface: "ui" | "use" | "internal";
  basisHash: string;
  commands: CommandSource[];
  steps: { exampleId: string; instruction: string }[];
  screenshots: { receiptId: string; exampleId: string; attachmentId: string }[];
};
type CommandSource =
  | { kind: "package-script"; path: string; script: string }
  | { kind: "documentation"; path: string; line: number; command: string };
```

All objects are strict. Proposed concrete bounds: 32 KiB UTF-8 serialized proposal; four commands; 60 steps (the existing basis input permits at most 60 elements); five screenshot selections; reference/path strings at most 200 characters; script names at most 100; command/instruction strings at most 500. Identifiers must also satisfy their owning existing ID/hash validators. Documentation line is a positive safe integer. No NUL, terminal control sequences, absolute/parent-traversing paths or duplicate command/example/attachment references. `internal` proposals have empty command/step/screenshot arrays. A screenshot selection must refer to an example present in `steps`.

A malformed proposal uses existing `invalid-input` handling before finish effects. A well-shaped but stale/missing/ineligible reference becomes an unavailable demo item and does not prevent an otherwise valid finish. Never silently truncate an over-limit proposal into an apparently complete demo.

The exact limits above are proposed new API bounds, not claims already established by the canonical specs. The screenshot count and image-size ceiling remain constrained by Tech Spec §9.10.

### 10.2 Output

Recommend replacing the **unimplemented** Tech Spec §8.3 string-array sketch with structured entries, rather than duplicating strings alongside separate provenance arrays:

```ts
type Demo = {
  surface: "ui" | "use"; // coordinator declaration, subject to §11
  run: {
    instruction: string;
    cwd: string; // validated repository-relative module root; documentation currently supports only "."
    source: CommandSource;
    verification: "source-checked-not-executed";
  }[];
  steps: { exampleId: string; text: string }[];
  screenshots: {
    exampleId: string; receiptId: string; attachmentId: string;
    path: string; verification: "run-attached-presentation";
  }[];
  unavailable: {
    part: "run" | "example" | "screenshot" | "applicability";
    ref?: string;
    reason: "not-supplied" | "source-unavailable" | "stale-basis"
      | "example-unavailable" | "artifact-unavailable" | "unsupported"
      | "sensitive-content" | "applicability-unverified";
  }[];
};
```

These are demo-local values, **not new kernel reason codes or endpoint values**. Use existing optional `Result.demo`; leave endpoint, scope, acceptance, checks, review, controls and execution disclosures untouched. Arrays keep proposal order after validation; duplicates refuse rather than reorder. The renderer must never turn source checking into “app verified running.” Each step names the accepted example and includes its confirmed text, followed by the supplied instruction explicitly as guidance. No model-written step is relabeled as a check result.

Omitted proposal: no invented demo; user-facing applicability is not established by omission. If the kernel's eventual approved change assessment establishes a user-facing/UI change, include the applicable unavailable items even without a proposal. For an `internal` declaration, omit the demo block; the applicability limitation in §11 still applies. A `ui` declaration with no screenshots has a screenshot-unavailable item; a `use` declaration does not itself require screenshots.

This structured output changes the canonical sketch and therefore requires owner approval and canonical backfill before implementation. There is no currently emitted `demo` payload to migrate; persisted receipt changes are separate (§13).

## 11. Applicability and accepted examples

`surface` is a coordinator's semantic declaration, not a kernel inference. `use` covers a user-facing application, library, CLI or backend interaction; it is not limited to browser work. `internal` must not be selected simply because a project lacks a UI trait. A project-level `basis.traits` snapshot does not establish whether this particular change affects UI.

If an approved current change-level assessment establishes UI, it overrides a contradictory `use`/`internal` declaration for screenshot applicability and emits `applicability-unverified`; the coordinator must reconcile the disagreement, never silently waive screenshots. Until the QLT-11 change-level assessment contract is implemented, the kernel cannot certify applicability. For a supplied user-facing proposal it returns `applicability-unverified`; it must not report that checking the proposal established RES-05 in full. An omitted or internal proposal provides no deterministic proof of non-user-facing scope. The coordinator's correct selection/omission remains an explicitly separate host/model acceptance obligation.

Resolve step IDs only from `work.basis.elementIds`, with `kind: example`. Require `demo.basisHash === work.basis.hash` and independently recompute the existing owning basis projection from the referenced intent elements. A matching supplied hash alone is insufficient. A changed/deleted bound element makes the relevant guidance unavailable; do not substitute a newer same-ID text. Never add `demoStatus`, duplicate example text, or another authoritative basis flag to stored state. If current storage cannot reconstruct the exact pinned projection, report `stale-basis` rather than invent history.

Every bound confirmed example must be represented by a step or an explicit example-unavailable item. Omitted steps cannot produce a “complete demo” claim. Failed/unverified examples may still have guidance, with their existing check status unchanged; no step is described as successfully demonstrated merely because it exists.

## 12. Run-command provenance (display only)

1. Resolve only explicitly selected repository-relative files through proposed `Project.readBounded(path, maxBytes)` and the existing exclusion/no-follow regular-file checks. No directory crawl, executable evaluation, shell expansion, remote lookup, `.env` read or fallback to test invocations. Bound each selected text read to 64 KiB before allocation/decoding; a wrapper around the current 20 MiB reader does not satisfy that bound.
2. A `package-script` source is a package manifest named `package.json` at the detected module root. Require an own string entry in `scripts`, with a script name matching `^[A-Za-z0-9][A-Za-z0-9:_-]{0,99}$`. Derive `npm run <script>` or `pnpm run <script>` from the supported detected package manager. Unsupported/ambiguous managers are unavailable. Display the module working directory. Do not use `npx`, install missing tools, or treat the script name as proof of its purpose.
3. A documentation source must be `README.md` or a Markdown file under `docs/`, readable under the same exclusions. The referenced one-based line must exactly equal `command` inside a closed `sh`, `bash` or `shell` fenced block whose first nonempty content line is exactly `# cwd: .`. This initial documentation format supports repository-root execution only and returns `run[].cwd: "."`. Nested/implicit working directories, a prior `cd`, or a missing/different directory marker are unavailable; do not infer directory context from prose. No prompt stripping, substring search, interpolation or multiline command joining. Preserve the source line and directory-marker provenance. Package-script entries return the independently validated detected module root as `cwd`; a package source outside that root is unsupported.
4. Commands may require several terminals: preserve all supplied commands in order, naming their working directory. The starter currently needs both `npm run dev` and `npm run dev:web`; one must not silently replace the other. Missing prerequisites, credentials, URLs or stop instructions are not guessed.
5. Return **“Documented guidance; not executed.”** `finish` never starts/stops the app, opens a browser, installs dependencies or grants host consent. Guided “Try it” startup remains a separate consented coordinator action under UX §4.2; this draft does not implement or verify it.
6. Extracted commands, example text and paths pass existing secret/redaction checks. If redaction would alter a runnable command, omit it with `sensitive-content`; never display a damaged command as ready to copy. Source existence is not permission to execute its contents.

### 12.1 Bounded source-reader port

The new read operation is explicit; current `Project.read(path)` is unchanged and cannot satisfy the smaller bound:

```ts
readBounded(path: string, maxBytes: number):
  | { status: "available"; text: string; sha256: string }
  | { status: "unavailable"; cause: "missing" | "excluded" | "linked" | "outside"
      | "not-regular" | "too-large" | "invalid-utf8" | "moved" | "unreadable" };
```

`maxBytes` is the trusted kernel constant 64 KiB here, not an input-controlled escape from limits. Enforce it against descriptor size and every incremental read before retaining/decoding more than that many bytes; reject malformed UTF-8 and files changed during the read. Reuse existing path/exclusion/descriptor checks; no fallback to the 20 MiB reader and no additional path scan. Only successful stable bytes produce text and a digest. Known admission/filesystem refusals produce `source-unavailable`; programming/invariant failures retain existing internal-error handling rather than being indiscriminately swallowed. Never include underlying file contents in diagnostics. Charge the shared implementation to its existing filesystem owner and demonstrate budget fit. These are cooperative no-follow/stability checks, not a sandbox against an adversarial process with the same OS-user privileges.

## 13. Screenshot producer, binding and lifecycle

### 13.1 Capture producer proposed for review

Current code has no screenshot capture/attachment helper; Playwright output placement alone does not implement §9.10. Add a recipe helper that receives an existing confirmed example ID, calls `page.screenshot`, and attaches the resulting PNG under `tenet-demo:<exampleId>`. The Playwright test must be the accepted example's declared `testFile`; the attachment records the exact test identity, project and attempt. Multiple examples in one file need distinct explicit IDs. No filename/title guessing or “nearest example” matching.

The actual supported reporter's attachment representation must be characterized with a real helper-generated report before final schema selection. Report extraction remains separate from pass/fail normalization: malformed or missing presentation metadata cannot convert a passing test into a failing receipt, or a failing receipt into a passing one. It only withholds demo artifacts. No new check runs solely to obtain screenshots during `finish`.

At check finalization, the kernel admits only attachments from the observed, normally completed candidate/integrated Playwright run, matches their IDs/files to the accepted basis, and writes a small run-local presentation manifest. Require a fresh, passing, non-flaky kernel-run receipt when advertising a screenshot as current-run presentation; other outcomes remain visible as check evidence but do not supply screenshots through this contract.

### 13.2 Proposed minimum persisted binding

An arbitrary later file under a run root is insufficient provenance. Recommend an optional receipt field:

```ts
presentation?: { manifest: "demo-manifest.json"; sha256: string };
```

The manifest is outside `.tenet/` and contains only a version, workspace/work/issuing-generation binding, basis/check-input/candidate identities, receipt/run identity, and up to five entries `{attachmentId, exampleId, testFile, testIdentity, relativePath, sha256}`. Bound it to 16 KiB. Its digest is written with the finalized receipt; each image digest detects replacement between capture admission and display. These hashes address a concrete delayed-read/replay substitution risk; they do not authenticate a hostile same-user process or prove pixels depict the example.

This is a proposed stored-schema change. Legacy receipts without the field remain valid **check evidence**, with screenshot availability unknown. No upcast invents presentation metadata. The owning schema/version/migration review must settle compatibility, old-writer stripping, adapter identity and all receipt producers/consumers before implementation. No schema-1/2 activation is approved here.

### 13.3 Artifact admission

- Resolve `receiptId` only in the current work and use the existing owning receipt-selection/freshness rules. Never fall back to an older passing capture when a later applicable receipt fails or is inconclusive. Derive run roots from the admitted receipt's provenance, never from caller-provided paths. Match workspace/work/issuing-generation, basis, candidate and check-input binding as defined below; reject cross-work, superseded, baseline, stale or imported receipts.
- Add a bounded presentation-reader operation behind the existing Store port: derive owned workspace temp ancestry, inspect all components without following links, open only regular files with no-follow, enforce byte/depth/UTF-8 limits for JSON, and compare descriptor metadata before/after reads. Do not use `realpath` containment alone, unbounded `readFile`, recursive scanning or a generic arbitrary-file reader.
- Images must match an admitted manifest entry, remain inside that run directory, have PNG signature and nonzero dimensions, match the captured digest and be within the canonical §9.10 size ceiling. A header is not proof of a harmless/complete decoded image; native image display remains a host boundary. No HTML, SVG, inline report bodies, external URLs or user-supplied absolute paths.
- The image ceiling is **409,600 bytes** (400 × 1,024). The canonical “400 KB” is binary, as the bundle limit and the `.tenet/` bound already are (Tech Spec §0.4); the earlier 400,000-byte proposal is withdrawn. Set by owner blanket direction 2026-11-03, per decision-packet decision 5. An over-limit image is unavailable, never silently resized, copied into `.tenet`, or uploaded.
- At most five screenshots are returned. The per-contract capture/retention limit across repeated candidate runs needs the explicit disposition in §16; five per run is not silently equivalent to five per contract.

**Generation policy proposed for review:** the manifest records the **issuing generation captured in the immutable prepared run**, not whatever generation exists when it is read. Only successful owner-checked finalization may write its digest onto the receipt. The finalized receipt digest binds that generation inside the manifest; no second unbound live-generation claim is accepted. Ordinary pause/resume changes the live handle generation but does not by itself make a finalized, otherwise-current image ineligible. Do not require the issuing generation to equal the live generation. A cancelled/superseded old-generation result that never passed finalization has no eligible receipt-bound manifest, even if it wrote files. Changed basis/candidate/check binding and owning receipt precedence independently invalidate captures. This policy changes no check-evidence eligibility and does not resurrect a stale launch. Test unchanged resume, changed resume, late superseded launch, wrong-generation manifest mutation and a later failing receipt explicitly.

### 13.4 Retention and rendering

`finish` currently reclaims run files before producing its result, and receipt run directories are not in the cleanup keep set. Preserve existing cleanup policy: revalidate **after** cleanup and disclose evicted/missing artifacts. Do not retain all receipt runs indefinitely, create a new archive or silently change protected-retention ordering for demo convenience. A raw path is available only at the observed validation time, not a durable guarantee.

The host receives only the validated local image path and binding metadata. It must show the caption **“Presentation only; not test evidence”**, and explicitly disclose inability to display or an expired path. No automatic network upload or export. Capture uses the existing isolated test database/synthetic data; neither path validation nor PNG checking establishes absence of sensitive pixels. DP-2b and pixel/privacy handling require separately authorized host acceptance; no T1 result claims them.

## 14. Finish, replay and idempotency

Recommend using the existing pipeline rather than adding a second presentation engine or persisted work-level demo state:

1. Extend **finish-only** identity with selected command-source bytes/admission status, detected package manager/module root, basis projection, selected receipt/manifest/image identity and admission status. Include absence/refusal, not just existing files. This must be a bounded read before historical-response reuse; `worldDigest` alone misses ignored documentation and temporary artifacts.
2. Identical request plus unchanged world and selected presentation inputs may replay the historical result. Deletion, replacement, exclusion, basis change, capture expiry or stale receipt must invalidate replay. A historical response never bypasses admission checks. `again` keeps its existing meaning; it does not waive validation.
3. Build demo material in the result builder from finalized facts, including the existing post-commit callback; revalidate after cleanup and commit effects. A source moving between pre-cache admission and final construction is unavailable. Do not publish the pre-commit proposal as a final result.
4. Changing demo input is a new input under existing input hashing. On an already-finished work item, follow the existing finished branch: recompute presentation/current verdict, commit nothing and acquire no source lease. No new edit, acceptance, receipt, grant, counter reset or plan completion comes from a demo change. Ordinary existing call/revision/time bookkeeping is not promised byte-identical across different requests.
5. Identical finish retries must not duplicate commits/effects, including crashes before/after commit publication. Existing open-question/continue-required behavior stays first; a demo does not close a contract that must continue. A failed base finish response carries no success-shaped demo.
6. Never change the check-input identity, required obligations, endpoint logic or receipt status merely because demo sources/images changed. A real source edit can independently invalidate existing evidence under its owning rules; demo decoration cannot suppress that effect.

No new generic front-end verdict logic, automatic re-run or extra approval is introduced. Kernel responses still pass through existing redaction. Exact identity projection and publication ordering require implementation review against all normal/cache/recovery paths, not just the happy-path `finish.run`.

## 15. Proposed acceptance matrix and delivery slices

| Control | Required observation | Test home |
|---|---|---|
| DP-T01 | npm/pnpm package sources, exact documentation fences, multi-terminal starter commands; unsupported manager, nested/implicit documentation cwd, linked/excluded/oversized/missing/invalid-UTF-8/moving source and command-as-test-purpose limits. | `result-demo.test.ts`, project-reader boundary suite |
| DP-T02 | Missing, stale, deleted, unrelated or duplicate example IDs; changed text under the same ID; supplied matching hash cannot bypass pinned-projection validation; every example has a step or explicit limit. | `result-demo.test.ts` |
| DP-T03 | Actual Playwright helper captures/attaches a PNG under the declared example test; observed report shape and exact manifest binding. No screenshot availability inferred from a report-only synthetic path. | starter browser/helper and Playwright presentation tests |
| DP-T04 | Other work/run/session, stale check, wrong example/test/project/attempt, changed-resume/late-superseded launch, tampered manifest/image, missing file, links/parent links/FIFO/directory, growing/replaced file, bad PNG, oversized image and sixth capture all withhold screenshots. | real-filesystem artifact tests; real-run integration |
| DP-T05 | Unchanged resume preserves otherwise-current finalized captures; changed bindings and superseded launches cannot supply them. Deleting/replacing a selected source or image before identical `finish` invalidates cache; unselected files do not unnecessarily invalidate presentation identity. Cleanup eviction is unavailable, not a dangling success reference. | finish cache/integration tests |
| DP-T06 | `finish` auto-commit rebuilds after finalization; repeated/different demo requests and crash prefixes do not duplicate commits, reset counters, grant authority, alter checks or promote verdicts. | finish/commit real-process tests |
| DP-T07 | ui/use/internal declarations, contradictory future change assessment, unknown applicability, partial examples and omitted proposal render precisely the limits in §11. | result contract tests; separate host/model cases |
| DP-T08 | Source/extracted secrets are unavailable, not damaged copyable commands. No image bytes in `.tenet`, no execution, browser startup, upload or new reads outside selected roots. | privacy/port-spy and real-filesystem tests |
| DP-T09 | Legacy receipt without presentation remains eligible as check evidence but has unavailable screenshots; supported schema round trips and old-reader/writer behavior match the approved migration policy. | owning schema/migration tests |
| DP-T10 | Qualified host can display the actual current-run images, identify presentation limits and handle expiry; coordinator correctly selects user-facing/internal work. | authorized T3 scenarios, not unit substitutes |

Dependency order: (A) approve this result/input/provenance contract and remaining dispositions; (B) characterize actual producer reports and establish complete owner/bundle/instruction capacity plus schema compatibility; (C) implement bounded readers and capture producer with red controls; (D) integrate source/example/result and replay/post-commit paths; (E) full CI and built real-repository UAT on current/minimum Node; (F) authorized host rendering/applicability acceptance. A command-only first slice can be useful, but does not complete RES-05 or count it as wholly mapped/qualified.

All implementation stays on existing main, with no new branch/worktree. Current capacity is especially constrained (central five characters free; store 214). This draft does not prove a fit or permit moving responsibilities into uncharged files, raising budgets or importing unsigned prototypes.

## 16. Review decisions and implementation gate

| ID | Concrete proposal / remaining disposition | Why it needs explicit review |
|---|---|---|
| RD-1 | Approve §10's strict bounded input and structured result, plus source-checked/not-executed command wording and exact source allowlist. | Replaces the canonical unimplemented string-array sketch; source provenance does not prove successful startup. |
| RD-2 | Approve §11's coordinator-declared applicability limit and future approved change-assessment override, or require authenticated change applicability before any production demo. | A project trait cannot safely classify the change; the kernel cannot prove a declaration's semantic correctness. No silent omission may qualify RES-05. |
| RD-3 | Approve the recipe capture → actual report → finalized receipt-bound manifest chain, including the optional receipt metadata and digest rationale. | Current ports/receipt schemas do not supply this; compatibility and complete capacity must be proven. |
| RD-4 | **Count interpretation selected by owner, 2026-11-01: “Five currently retained screenshots; replace stale captures.”** This selects a replaceable current set, not five lifetime captures. The concrete retirement/staging protocol in §18 is a new review draft; its staging allowance and implementation are not approved. | Five-per-run capture without retirement is insufficient. Physical helper/copy files and interrupted staging need a finite bound as well as the selected-set bound. **The “400 KB” byte unit is settled: binary, 409,600 bytes (§13.3; Tech Spec §0.4).** No deletion is authorized by this document. |
| RD-5 | Approve bounded finish identity/revalidation and the explicit ephemeral/host boundary, after independent cache/cleanup/commit review. | Existing cache reuse and reclaim would otherwise advertise stale paths; metadata presence alone does not establish durable or safe host display. |

After independent review, disposition every finding and present the consolidated contract for owner sign-off. Production implementation additionally requires the complete capacity/schema/retention prerequisites above. The owner's November 1 choice authorizes development and review of this document only. No runtime/schema, canonical-spec amendment, accepted RES-05 ledger entry, mapping, native run or release claim follows from it.

## 17. Independent contract review (2026-11-01)

A separate read-only reviewer checked §§9–16 against canonical RES-05, UX §4.2, Tech Spec §§8.3/9.10 and the actual finish/cache/ports implementation. All three material findings are accepted:

| Finding | Draft disposition |
|---|---|
| Documentation source/output has no working-directory contract. | Added structured `run[].cwd`. Initial documentation support requires an explicit root-directory marker in the same fence; implicit/nested contexts are unavailable. Package directories derive from the detected module root. DP-T01 includes nested-directory refusal. |
| Capture generation is ambiguous across resume and superseded launches. | Defined issuing-generation binding authenticated by the finalized receipt's manifest digest. Unchanged resume alone preserves eligibility; late superseded launches cannot register eligible metadata. Changed bindings/later failed receipts still invalidate screenshots. DP-T04/05 cover these boundaries without changing check evidence. |
| Existing `Project.read` cannot enforce a 64 KiB pre-allocation bound. | Specified the narrow `Project.readBounded` operation, strict UTF-8/stability/byte admission and typed unavailable results; preserved old-reader behavior and internal-error distinction. Boundary cases are part of DP-T01. |

These dispositions revise the draft, not runtime. RD-1–RD-5 still require owner review; schema compatibility, complete capacity, actual reporter characterization and cross-run capture-limit/retirement mechanics remain explicit prerequisites. No production implementation readiness or owner implementation approval is inferred.

**Disposition recheck:** the independent reviewer re-read the three revised boundaries and found all three resolved at draft-contract level, with no new finding from those edits. This does not close RD-1–RD-5 or the implementation prerequisites.

## 18. Replaceable screenshot set and crash-safe retirement — review draft (2026-11-01)

The owner selected **five currently retained screenshots, replacing stale captures**. This resolves RD-4's count interpretation only. Historical candidate: independent review found avoidable staging and an ordinary-work-fence contradiction; §19 supersedes the mechanism recommendations below. No staging allowance, receipt/schema effect, recovery behavior or implementation is approved. It authorizes no filesystem deletion. The image byte ceiling remains the separately unresolved canonical “400 KB” interpretation; write `B` for that eventual approved per-image byte limit below.

### 18.1 Observed producer shape and the two counts

The [local synthetic report observation](../docs/audits/2026-11-01/demo-report-characterization.json) used installed Playwright 1.64.1 and cached Chromium 156.0.8078.4, without an application server, account or native host. `page.screenshot({path})` wrote an original PNG; `testInfo.attach(name, {path, contentType: "image/png"})` caused Playwright to create a **second file** under its test output's `attachments/` directory. The JSON report named the copied absolute path under `suites[].suites[].specs[].tests[].results[].attachments[]`, with `name`, `contentType` and `path`; project identity belonged to `tests[]`, and `results[]` carried `retry: 0`. The example attachment was 7,248 bytes at 640×200. A copied attachment pathname is not assumed equal to the helper's original pathname. Failed/retried/multiple-project producer behavior remains uncharacterized and must be exercised before implementation sign-off.

Distinguish:

- **Selected presentation set:** at most five admitted attachment copies for this contract, named by one currently eligible receipt-bound manifest. This is the owner-selected count. Originals, superseded copies and unfinalized files are never selected simply because they exist.
- **Physical presentation files:** originals, attachment copies, unretired prior selected copies and crash leftovers. These consume storage even when logically ineligible. Receipt/manifest JSON, reports and databases are not screenshots; their existing separate bounds remain applicable. A report's inline body is never another accepted image representation.

Proposed bounded handover: one current set of at most five copies, plus **one capture epoch per contract** with at most five originals and five attachment copies. The physical peak is therefore **15 image files and `15 × B` image bytes**, before counting bounded metadata. After successful retirement it returns to at most five copies. This finite temporary allowance is a **new mechanism proposal requiring separate explicit approval**; the count interpretation alone does not approve it or override the project-wide run-file cap. If the allowance is not approved or cannot fit the fixed capacity, capture replacement remains unavailable; do not silently choose unlimited staging or a five-lifetime limit.

### 18.2 Epoch admission and helper limits

Before launching a capture-capable check, the existing locked prepare step admits the current selected set, every outstanding presentation epoch/retirement record, and their accounted physical files. It permits one new epoch only when no previous epoch has unsettled files or uncertain ownership and the bounded handover fits. A check may still run without presentation capture; unavailable screenshots do not change its obligations, receipt status, attempt counting or verdict. Do not launch another check solely to replace pictures.

The immutable prepared-run metadata identifies workspace, work, issuing generation, run, basis, candidate and check-input IDs plus a unique capture epoch and a maximum of five one-use capture slots. Before launch, fsync a narrowly typed `presentation-stage` intent with that binding, the exclusively created epoch namespace's device/inode identity and the approved finite file/byte allowance. The unresolved intent is the durable epoch guard; its absence from a later in-memory session is never proof that staging was settled. Recovery and compaction must retain/admit it. Record its completed result only after every claimed slot is accounted for as selected or safely retired, with no unknown physical remainder. This operational journal guard is not a second authoritative demo list. New `SETTLE` handling and effect-schema compatibility require review alongside `presentation-retire` below.

Use the existing run-directory/owned-process launch and finalize guards. Across all tests, projects and retries in that epoch, helper calls atomically claim a still-unused slot through exclusive creation in the kernel-prepared, no-follow staging namespace. A claim is never returned on failure or retry. Each claimed slot may write at most one original and cause at most one attachment copy; the helper refuses a sixth claim **before** screenshot creation. A retry needing another capture consumes another slot. Unused slots create no images. The precise multiworker helper/public-Playwright integration must be characterized and reviewed; a per-process counter is insufficient.

The helper uses only the declared slot's original path and calls the screenshot operation once with the approved image-byte admission afterward. An oversized result is never selected; its existing physical bytes still count until a safely owned retirement succeeds. Because the browser can write an oversized file before post-capture admission, `15 × B` is an admission target, **not a demonstrated hard disk-write cap**. Before sign-off, prove a supported bounded capture producer or approve a separate finite oversized-output reserve and failure policy. In its absence, production capture stays blocked; do not claim that checking size after capture enforced a write limit.

### 18.3 Manifest publication and logical replacement

On normal owner-checked finalization, validate the actual report's copied attachment paths and all §13 bindings. Admit only complete, stable, in-root regular PNGs with matching example/test/project/attempt identity. The run-local manifest lists the selected copied files, not originals. Write it atomically and durably using the owned artifact seam, then publish its digest with the finalized receipt in the existing state transaction. The filename is epoch-specific until publication; an already-published `demo-manifest.json` is never overwritten to alter a retained receipt's meaning. Final implementation must either use a distinct final run directory for each epoch or review an explicit versioned manifest-name extension to §13.2; a fixed name must not alias two manifests.

The logical selected set is derived from the existing winning applicable receipt and its authenticated manifest; no separate authoritative work-level demo list is introduced. A newly finalized eligible producer replaces the **whole set**, which may contain zero through five images. Do not merge in older pictures merely to fill empty slots. A later applicable failed, inconclusive or otherwise ineligible receipt makes the older set unavailable under §13.3, even if its files have not yet been retired. Basis/candidate/check-input changes similarly make old pictures ineligible. Ordinary unchanged resume retains the finalized manifest's issuing-generation rule; a cancelled or superseded launch cannot publish its manifest.

Logically stale files are not automatically safe to unlink. Durable publication establishes which set may now be advertised; it does not establish successful physical retirement. A manifest write followed by a crash before receipt publication leaves an unselected staged manifest. A receipt publication followed by a crash leaves the new selected set authoritative and the old files pending retirement. Recovery never selects an old image as a fallback for either prefix.

### 18.4 Exact-file retirement through the existing effect journal

Propose one narrowly typed `presentation-retire` effect integrated with the existing `Tx.intent/result`, `recover`/`SETTLE` and policy-aware mutation path. This is a new internal effect, not a user verb or permission to reuse a generic recursive delete. State/effect schema compatibility and all replay consumers must be reviewed together. Before any unlink, fsync an intent containing the workspace/work/epoch IDs, admitted run-root identity, selected-manifest binding at the decision boundary, and at most **15 exact owned file entries**. Entries use root-relative paths, expected device/inode, size and content digest; no caller-supplied absolute unlink target or wildcard. Originals use their capture-slot registration; copied files use admitted report/manifest registration. Metadata retirement is separately bounded and must not remove receipt evidence or process ownership records.

After the relevant process group is established stopped, re-admit the workspace, effect record, root ancestry and exact leaf without following links. Re-evaluate selected-set eligibility: never unlink a file referenced by the current selected set, another admitted live epoch, or an unresolved ownership claim. Require the expected descriptor identity, bytes and digest before deleting a regular leaf. Sync the containing directory after deletion before recording completion. Absence at that exact admitted path is an idempotent retired postcondition; a replaced file, linked component, changed parent identity, unreadable path or mismatched bytes is **uncertain**, not “already removed.” Preserve it. Never delete the whole run directory, report, database, test output tree, unknown attachment or another contract's file as a shortcut.

Recovery repeats exact postcondition admission per entry, so a crash after the unlink but before its result does not repeat a destructive guess. It may durably record per-entry progress, but the whole bounded unresolved entry list must remain recoverable until settlement; no journal compaction may discard the protecting intent. A partially completed retirement reports the removed and retained/uncertain counts, keeps uncertain entries pending, and prohibits a new capture epoch for this contract until physical accounting is settled. Existing completed check receipts remain unchanged. A retirement error cannot promote or demote a check result; dependent presentation is unavailable and ordinary source work follows the existing uncertainty rules. `stop` keeps its existing process-first/effects-deferred behavior.

### 18.5 Crash gaps, unknown files and explicit cleanup

The helper original and Playwright's attachment copy are separate write boundaries. A crash can occur between a copy and its registration or before JSON reporting completes. The implementation must not infer safe deletion from a name prefix or assume every PNG under the run directory is its own. Keep the epoch/slot claim outstanding and conservatively charge every claimed slot's possible original/copy pair against the single staging allowance. No second epoch is admitted while this uncertainty exists. A bounded, read-only inventory within the exclusively prepared epoch namespace may locate candidates for review, but it grants no unlink authority for an unregistered/changed leaf.

Only previously registered exact files may use automatic retirement. Unregistered leftovers remain unavailable and require separately authorized cleanup or another explicitly reviewed ownership proof. An unresolved `presentation-stage`/retirement effect retains the existing generic uncertainty fence: `stop` remains available, but ordinary `decide cleanup` must not be described as reachable through that fence. Recovery can settle a missing exclusively admitted epoch/run namespace after process termination, or registered exact-file postconditions. If unknown files prevent settlement, explain the blocker and require an owner-authorized external removal/reconciliation of the identified owned temp namespace; this draft supplies no automatic removal command or new bypass. With no unresolved effect, existing previewed `decide cleanup` may remove the owned workspace's temp root under its own rules after processes and packets settle. Neither case weakens the live-check/focused-review/reservation gate. Cleanup expiry or run-cap eviction may independently remove files: subsequent presentation admission reports them missing. Do not resurrect image metadata or widen retention to preserve a demo.

There is no promise that a path returned earlier remains readable while retirement or ordinary cleanup occurs. Descriptor reads remain subject to §13 stability checks. A host that already opened a file may retain bytes after unlink; Tenet cannot revoke displayed pixels or same-user copies. A host opening the path after retirement may fail and must disclose expiry. No invented reader lease, OS-wide lock, upload, automatic copy/export or privacy-erasure claim is added. An exact-host display check still requires separate authorization.

### 18.6 Required controls and fixed-capacity gate

Extend DP-T03–06 with actual copied-attachment/original separation; all workers/retries sharing five one-use slots; a sixth claim creating no image; whole-set replacement with fewer/zero captures; later failed receipt forbidding fallback; unchanged and changed resume; and a second epoch refused while the first remains unsettled. Exercise real-process kills before/after slot claim, original write, attachment copy, registration, manifest durability, receipt publication, retirement intent, each unlink/directory sync and result publication. Verify exact byte/digest identity, protected leaf replacement, links/parent replacement, partial permissions failure, absent files, cleanup eviction and no deletion of reports/databases/unrelated PNGs. For every crash prefix, selected count is at most five, one staging allowance remains conservatively charged, no new epoch can accumulate unlimited leftovers, and no stale path is advertised as current.

All physical bound claims require producer measurements, including oversized/capture-failure cases; passing shape tests are insufficient. Measure the complete prepare/helper/finalize/manifest/effect/recovery/reader implementation against unchanged owner, bundle, schema and instruction caps before activation. The existing store has very little capacity, so this draft is **not a capacity solution** and permits neither relocation to uncharged files nor budget increases. The byte-unit decision, staging/reserve approval, helper/report characterization beyond the single passing sample, schema compatibility, independent review and final owner implementation sign-off remain open. No retirement, capture lifecycle or RES-05 completion follows from drafting this section.

## 19. Retirement review disposition and reduced replacement direction (2026-11-01)

**This section supersedes §18's mechanism recommendations.** Preserve §18 as the reviewed candidate, not an implementation-ready protocol. The owner-approved policy is still five currently retained screenshots, replacing stale captures. Independent review accepts the need for durable ownership/slot accounting but rejects two unnecessary consequences of that candidate:

1. A 15-image old/original/copy handover is not implied by the owner's choice. Retire only a set already stale under the owning eligibility rules before replacement. If a current set remains eligible on an unchanged-candidate rerun, do not silently expire it: reuse only where the existing provenance/receipt policy actually permits, otherwise disable recapture until the relevant lifecycle is explicitly designed. Never restamp an older capture as if the new run produced it.
2. Generic unresolved presentation effects would fence ordinary source work, contradicting presentation's advisory boundary. Do not add the proposed `presentation-stage`/`presentation-retire` effects to the ordinary journal merely to track pictures. A replacement must use independently reviewed, separately typed durable **capture-only** accounting: uncertain presentation ownership prevents further capture/materialization, while check execution, receipts, verdicts and ordinary work retain their existing rules. This is not permission to ignore an unknown ordinary effect or corrupt authoritative state.

The [second actual producer observation](../docs/audits/2026-11-01/demo-body-report-characterization.json) changes the proposed route further: `page.screenshot()` returning a Buffer and `testInfo.attach({body, contentType: "image/png"})` produced **inline base64 `body`, no attachment path, and zero PNG files** in the run directory on Playwright 1.64.1. The decoded image matches the path-based sample. The [fixture](../docs/audits/2026-11-01/characterize-demo-report.mjs) supports `--body`; the first observation is preserved separately.

Consequently the body route is a new bounded extraction proposal, **not** an accepted path attachment or an implemented exception to §13.3. The next concrete protocol must specify:

- Admit only the observed named PNG attachment from the exact example/test/project/attempt and a finalized eligible producer. Keep presentation parsing separate from check normalization. Invalid presentation metadata withholds images without relabeling check outcomes.
- Before base64 decoding, enforce the owning raw-report size/depth bounds, a strict canonical base64 alphabet/padding/length check derived from the approved image-byte ceiling, and a bounded selected-image count. Decode only selected entries, one bounded image at a time. Validate actual decoded length and PNG metadata before an exclusive run-local PNG publication. Never expose an arbitrary inline body/HTML/data URI to the renderer or store image bytes in `.tenet/`.
- Account for inline image payloads retained inside raw reports as well as materialized PNGs. **Do not claim the owner's physical retention limit by counting only `.png` filenames.** A reviewed raw-report/body retirement rule or explicitly approved temporary allowance is still required; existing raw-output limits are not automatic permission for unlimited retained image copies. Do not silently rewrite qualification reports or destroy check evidence.
- Establish durable epoch/namespace ownership before image-producing work, share five exclusive one-use slots across workers/retries, retain unresolved-orphan accounting, and refuse another capture/materialization epoch when count/ownership is unknown. A body route removes original/attachment-file duplication during capture, but not a crash during final PNG materialization before registration.
- Retire only exact, registered, already-ineligible files after process/owner re-admission, with idempotent absence and conservative handling of replacements/unknown leftovers. No recursive unlink of a supplied directory. A failure disables dependent presentation/further capture, rather than creating an ordinary-work outage.
- Preserve issuing-generation resume semantics, whole-set replacement, no older-pass fallback after a later failed/inconclusive receipt, ephemeral host availability and absence of pixel/privacy attestation. A size check on a returned screenshot Buffer does not prove a pre-allocation browser memory bound.

Remaining design gates are now narrower and explicit: raw-report image retention/temporary allowance; exact capture-only record/publication/recovery/compaction format; unchanged-candidate reuse versus deliberate expiry; worker/retry/failure/crash producer observations; byte unit, supported compatibility and complete fixed-owner fit. None is implemented by the reader foundation or by the two synthetic captures. Do not seek final implementation approval for the superseded 15-image/global-fence proposal.

### 19.1 Independent implementation foundation and current limits

Under the later comprehensive implementation instruction, the independently scope-reviewed additive `Project.readBounded` boundary from §12.1 is implemented locally. Fourteen new controls and 24 existing project-boundary controls pass, preserving legacy reader behavior. Its explicit `outside` refusal distinguishes root escape from exclusion; programming bounds remain errors. No finish input/result consumer, screenshot reader, capture producer, receipt field, retirement record or schema activation is supplied by that primitive. Full integrated validation and exact artifact scopes are tracked in `plan.md`; this does not mark RES-05 mapped or qualified.
