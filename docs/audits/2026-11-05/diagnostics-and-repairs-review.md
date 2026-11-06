# Independent diagnostics-contract and repair review — November 5, 2026

Read-only review of revised `specs/diagnostics-export.md`, its first review/dispositions, the relevant canonical privacy/trace/approval contracts, and the current uncommitted dependency/project-text repairs. No runtime implementation, owner approval, host observation or heavyweight test campaign is supplied by this review. This file is the only reviewer-authored change.

**Verdict: diagnostics is not sign-off-ready.** The revised draft addresses much of the first review, but its outside-file lifecycle and two value-projection paths still need correction. Complete the corrections below, disposition them, then obtain the outstanding owner decisions and a focused re-review. Do not implement the unsigned runtime from these recommendations.

## Current repair review

The dependency metadata/age/order repairs and `FsProject.read` UTF-8 refusal are consistent with their stated narrow goals. The new text-read refusal retains raw-byte hashing, valid Unicode and missing-file behavior. The pnpm matching change conservatively pairs only one absent prior with one new version, avoiding order-dependent predecessor claims.

One additional scope-relevant defect was reproduced and reported: the first version check used `lines.some(validV9)`, admitting a lockfile containing both `lockfileVersion: '99.0'` and `lockfileVersion: '9.0'`. The implementation has since changed to require exactly one version declaration, including detection of quoted declaration keys. The same mixed-version pure probe now rejects at `packages/kernel/src/core/dependencies.ts:89–91`. The main agent reports new duplicate/mixed-version controls. This review independently reran the direct counterexample, not the full suite.

No further actionable defect was established in the changed runtime code during this scoped pass. This is not full npm/pnpm YAML conformance, absence-of-races proof, dependency-policy completion, installed-host qualification or approval of prior previews across a runtime change.

## Remaining diagnostics findings

### DX-R1 — The temp pathname is required before the API can return it (Blocker)

`specs/diagnostics-export.md:133–150` records `{target, temp, bundle, bytes}` in the intent at step 3, but only step 4 calls `stageOutside(target, bytes) → temp`. The exact name cannot be journaled before the API has allocated it. Creating first would violate the proposed intent-before-effect ordering and leave an undiscoverable file after a kill.

Minimal correction: split a read-only planning operation from creation. Reserve a random pathname without creating anything, validate the target/parent, record that exact planned path in the intent, then call `stageOutside(plan, bytes)` using that path. Specify how private ownership metadata is found from the recorded plan. Keep the create, fill, fsync, link and cleanup boundaries individually injectable.

### DX-R2 — Restart cleanup lacks durable proof that it owns the temporary file (Blocker)

Recovery unconditionally removes the named temporary file when the target is absent or matching (`diagnostics-export.md:138–151`). The only durable proposed intent data is path/hash/length; `discardOutside` promises an identity check but no durable identity is specified. The existing in-process project writer captures `dev`/`ino` immediately after open (`adapters/project-fs.ts:137–150`); that memory is lost on restart. A different process can replace the planned pathname before recovery. Path unpredictability or matching content does not prove ownership.

Minimal safe full-save mechanism: after exclusive creation, capture file and parent identities and durably store the witness through a private, bounded ownership record referenced by the intent before filling/publishing. Revalidate the witness for publication and cleanup. A kill can still occur between creation and durable witnessing. In that window, preserve the unwitnessed or substituted file and report a residue; do not guess ownership or delete it. Amend E9's unconditional cleanup expectation, the retention/revocation table and the “Tenet kept no copy” wording to disclose this case. Never fence unrelated work merely because an outside export residue cannot safely be removed.

Smaller safe alternative: in-process cleanup uses the live descriptor identity, while restart recovery never deletes a temporary file. It reports the residue and closes the export as abandoned, leaving manual cleanup to the user. This requires explicit residual-copy/retention disclosure. Preview-only option B avoids the kernel's outside-file lifecycle entirely, but changes the canonical save mechanism and byte-binding claim and therefore needs owner approval.

### DX-R3 — `visibilityGaps` can carry arbitrary private text into the bundle (Blocker)

The bundle's `gaps` is the union of exported records' `visibilityGaps` (`diagnostics-export.md:113`). The listed validators do not constrain those array elements (`:117`). Journal call records are passthrough (`adapters/store-fs.ts:28–32`), so an otherwise valid record can contain `visibilityGaps: ["private project description"]` or an ordinary machine path. `core/redact.ts` explicitly leaves names/identifiers and does not remove ordinary text or paths. The whole-text heuristic can therefore pass while the bundle violates its no-content/no-path projection claim.

Minimal correction: derive gap names only from a finite constant set (`TRACE_GAPS` keys plus the explicitly enumerated future-gap names); intersect supplied values with that set. Count every unrecognized value as dropped without copying or displaying it. Add planted ordinary-text/path controls as well as token-shaped controls, including a record whose valid core fields allow it to remain in `calls`.

### DX-R4 — Capability field allowlisting does not restrict its free-text value (Major)

`diagnostics-export.md:108` copies each capability's `value`, merely truncating it to 200 characters. `Capability.value` is an unconstrained `z.string()` in `core/capabilities.ts:7`. A host value containing a project path, source fragment or ordinary user text passes the redactor. E4b covers a token-shaped value, which does not establish the stronger promise that no content or machine paths can enter the preview.

Minimal correction: use a finite per-capability value vocabulary for exported facts, or export only the capability key and closed provenance/availability summary. Map unsupported free text to `unknown` and count it as dropped. Do not copy arbitrary descriptor values and then describe the payload as path/content-free. Add non-secret-shaped private-value controls.

### DX-R5 — Existing-target hashing needs the same byte/type/race bounds as the preview (Major)

`hashOutside(path)` promises only a regular-file hash/null (`diagnostics-export.md:152`). Before any intent, E8b invokes it on an arbitrary chosen existing path (`:133`). Without a byte cap and stable nonblocking read contract, a huge regular file can consume unbounded time/memory; a replacement FIFO can block. The only possible matching target is the already bounded preview.

Minimal correction: use the expected preview byte length (never above 16,384), admit a no-follow/nonblocking regular descriptor, refuse a mismatching size before allocating/reading, then perform a bounded stable read and identity/post-read checks. Name the result for unreadable/moved/too-large input. Apply the same bound during restart recovery. Add large-file, FIFO replacement and concurrent-change controls, while preserving foreign bytes.

### DX-R6 — An error after linking can be reported as “nothing saved” (Major)

Step 4 closes every post-intent port error with `{completed:false}` (`diagnostics-export.md:136`). Yet `publishNewOutside` links first and syncs the parent, and `discardOutside` runs after linking (`:149–151`). A directory-sync or cleanup failure can occur after a complete target exists. The draft's blanket failure rule and E8c's absent-target assertion cannot describe all those paths accurately.

Minimal correction: distinguish pre-publication failure from an observed matching target, different target and unknown postcondition. Re-observe with the bounded identity-aware port, preserve any target, and report an already saved file plus a cleanup/durability limitation when appropriate. Limit E8c's “no target” expectation to failures known to precede linking. Add faults after link, during parent sync and during temp removal. No automatic deletion of the published target is a safe rollback.

### DX-R7 — Wording should describe refusal rather than secret removal (Minor)

DX-4 refuses a bundle whenever redaction would alter it (`diagnostics-export.md:52–57`), while the proposed preview says “Likely secrets are removed” (`:167,172`). The mechanism projects fields and refuses matching candidate text; it does not emit redactor-rewritten text. Prefer “Includes only the listed diagnostic fields; Tenet refuses likely-secret matches. Review the preview before saving.” Preserve the explicit heuristic limitation.

## Outstanding owner choices

These are decisions already listed in the draft, not approvals supplied by this review:

| Question | Recommendation / qualification |
|---|---|
| Q1 — OpenTelemetry | Defer mapping for this slice; keep ENG-06 pending an individually signed Should disposition. Do not silently mark it omitted. |
| Q2 — Work handle | Existing handle-bound save is the smaller path; no-contract projects retain preview/manual save. |
| Q3 — Destination | Outside-project new-file-only matches the proposed attribution boundary, subject to the ownership/bounds corrections above. |
| Q4 — Kernel save | Full save preserves canonical byte binding only after DX-R1/2/5/6 are resolved. Preview-only is the smaller safe alternative and requires an explicit narrower cooperative save claim. |
| Q5 — Capacity | Rebase measurements on current main and measure the complete mechanism; no exact ceiling is approved by this review. Do not bypass existing owners by moving code. |
| Q6 — Monthly summaries | Defer initially; summaries require their own bounded projection if added later. |
| Q7 — Reasons | Add the three specific codes if the full contract is signed, with discriminating refusal controls. |
| Q8 — Request/preview claim | Requires an explicit canonical decision, not an inferred waiver of AC-11. Cooperative request provenance and whether a human read the preview must remain disclosed. |
| Q9 — Preview gate | Read-only preview is the smaller route after the value-projection holes are closed. Moving it to a model-callable `decide` alone does not make a truthful user request kernel-observable in auto-approval mode. |
| Q10 — UX | Approve final corrected wording and any block-format exception through the UX Spec. Include residue/durability/manual-save limitations if full save is chosen. |

## Smallest safe sequence

1. Correct the projection vocabulary and outside-file ownership/order/bounds contract; choose the residual-temp behavior and update E9/retention/wording.
2. Rebase capacity and input/source references; disposition this review. Obtain Q1–Q10 decisions and final implementation sign-off, including any canonical narrowing.
3. Implement the pure bounded preview first with planted-path/text/token and deterministic-shedding controls.
4. Implement kernel save only after its ownership/postcondition mechanism is signed; use real files, killed steps, foreign replacements and post-link failures.
5. Run full validation and built UAT, then the separately authorized host observation. Keep semantic and qualification claims separate.

## Focused re-review of diagnostics §13 — November 5, 2026

Scope: the main agent's engineering correction proposal at `specs/diagnostics-export.md:297` onward, against DX-R1–R7 above. No runtime change or owner choice was reviewed as implemented.

**Disposition: substantial corrections accepted as proposal directions; two recovery-mechanism issues remain before sign-off.** Q1–Q10, concrete strict ownership-record/API shapes, complete measurement and implementation sign-off stay open.

| Finding | Disposition of §13 proposal |
|---|---|
| DX-R1 — temp planning order | Addressed in direction: `planOutside` reserves only a name; the intent precedes exact-name creation. Include the ownership-record reference in the fully validated plan before recording the intent. |
| DX-R2 — durable ownership | Addressed in direction: the witness is durable, missing/substituted witnesses preserve residue, and the unavoidable create-before-witness window is disclosed. Remaining deletion-race issue is below. |
| DX-R3 — free `visibilityGaps` | Addressed: intersect with exact constant names, count unrecognized members and never copy them. Ordinary-text/path controls are required. |
| DX-R4 — free capability values | Addressed: closed summaries only; unsupported values become unknown pending a reviewed finite per-key table. No arbitrary text is admitted by truncation/redaction. |
| DX-R5 — unbounded target hashing | Addressed in direction: preview-sized no-follow/nonblocking regular stable read, explicit unavailable causes and foreign-byte preservation. The concrete port/result schema still needs to be written before implementation. |
| DX-R6 — blanket false failure | Partly addressed: exact matching content, uncertain durability and residual-copy outcomes are now separate. Unknown-postcondition treatment reintroduces the prior global-fence contradiction below. |
| DX-R7 — redaction wording | Addressed: omit/refuse unsupported content and describe observed copy/durability limitations. Final wording remains the UX owner's decision. |

### DX-R8 — Unknown outside-export postconditions still trigger the global work fence (Blocker)

Section 13 item 5 says “Unknown postconditions leave the effect unresolved.” Existing `pipeline-mutate.ts:158–159` fences every subsequent mutating call except `stop` whenever recovery reports an uncertain effect. This reintroduces the first review's D4 problem and contradicts DX-6's deliberate “recovery never fences” contract. The new section's opening supersession list does not resolve that policy conflict.

Smallest consistent correction: close the outside export as **abandoned with unknown observed postcondition**, preserve every uncertain target/temp and report exactly that uncertainty. Do not describe that as “not performed,” “nothing saved” or “completed successfully.” Keep residue/witness retention and any manual-cleanup disposition separately from an unresolved kernel effect, so a lost diagnostic export cannot block the user's application work. If the owner instead chooses a global fence, state and justify that product-policy change explicitly before sign-off; it is not an engineering detail supplied by this review.

### DX-R9 — Witness revalidation is not atomic conditional deletion (Major)

A durable `dev`/`ino` witness allows refusal of an **observed** substitution. It does not by itself justify the universal promise in §13 item 3 that restart cleanup “removes only a matching witnessed identity.” With a pathname-based `lstat/fstat → unlink`, another writer can replace the path after the last identity check and before deletion. This is a separate window from creation-before-witness; more pre-operation revalidation does not close it.

Smallest safe option within the already proposed alternatives: **restart recovery does not delete outside temporary files**; it records/reports residue, retains the witness for disposition, and lets explicit user cleanup handle it. In-process cleanup may use the owned descriptor and conservative checks, with its external-writer race honestly stated. Alternatively, design a concrete deletion mechanism with a precisely bounded external-writer claim and real replacement controls before promising stronger preservation. Do not present the durable witness as an atomic compare-and-delete primitive.

After these two corrections and the explicit ownership-record/reference/result schemas are written, the original review's engineering directions can be dispositioned without claiming implementation or qualification. The independent reviewer still does not select an outside-save option, a capacity increase, a PRD narrowing, or a release claim.
