# Specification: Diagnostics export (NFR-07, ENG-06)

> Status: **draft, unreviewed.** Written 2026-11-03 under the owner's blanket direction of that date to build candidates on an isolated branch. That direction is not a sign-off. This spec is not part of the canonical specs, changes no source, and authorizes no implementation. Open owner questions are in §9.
> Sources: PRD NFR-07, ENG-06, SEC-11, AC-11, §3.8.8, §5.10.1, §5.17; Tech Spec §§4.3, 6.5, 7.4, 11.3, 16; `decision-packet.md` decisions 1, 6 and rows ENG-06 and OSS-06; `docs/audits/2026-11-03/unmapped-musts.md` row NFR-07.

## 1. Outcome

A user can ask Tenet for a diagnostics bundle, see exactly what it contains before anything leaves Tenet's control, and save it to a path they choose. The bundle holds only fields Tenet lists in advance, passes redaction, and carries no file contents, prompts, secrets or command output. Tenet never produces or saves a bundle on its own.

Out of scope: the `evidence` bundle (JUnit, SARIF; Tech Spec §9.5), the `feedback` bundle (OSS-06, a Should; it would reuse this export and add user-written text), telemetry upload of any kind (SEC-03), and any change to what the journal records (ENG-09, decision-packet decision 6).

## 2. Current state (read from this tree, `34d6030`)

- No export exists. `InspectInput.view` has no `export` value (`core/schemas.ts:506`); `DECISIONS` has no `export` kind (`decisions/index.ts`). `OSS-06` and `ENG-06` are marked "omit" in `decision-packet.md` §11 for this reason.
- Tech Spec §6.5 lists an `inspect export` view ("redacted preview of a feedback, diagnostics or evidence bundle") and an `export` request kind for `decide`. §4.3 says feedback uses `decide` and "a previewed export to a chosen path". §7.4 classes exports as not repeatable (intent, act, result, publish). §16 says the export "maps [field names] to the pinned OpenTelemetry GenAI subset" and is "previewed in full and saved only to a chosen path".
- `core/redact.ts` provides `redact` and `redactDeep`. Its header says it is a heuristic: "likely secrets", never "no secrets".
- The journal call record holds `verb`, `exit` and `revision` only (`pipeline-render.ts:107`). The journal schema keeps extra fields on read (`adapters/store-fs.ts:31`, passthrough). Tech Spec §16's `CallRecord` fields (`work`, `role`, `model`, `permission`, `termination`, `durationMs` and others) are not written.
- `Store.readLog()` returns the validated journal. Old call records are reduced to monthly counts of calls by verb and by exit code (`core/journal-reduce.ts`), so older history has only those counts.
- `inspect doctor` is stateless and reports kernel checks, detected stack and the host `Descriptor` (`verbs/inspect.ts`).
- `decide` requires an existing state document and a work handle: `workOf(state, input.h)` throws `handle-required` or `handle-unknown` before any decision kind runs (`verbs/decide.ts`, `verbs/common.ts:27`). Every decision kind receives a `WorkContract`.
- The project port (`ports/types.ts:238`) writes inside the project root only (`writeNew`, `write`). The store port writes artifacts only under Tenet's own temp folder (`writeArtifact`).
- Windows refuses mutating verbs (`capability-missing`), so write-path tests run on POSIX CI only. Read-only views run on Windows.
- The Tech Spec records no OpenTelemetry version. PRD §3.8.8 requires "the version current at Tech Spec approval". This is a spec defect (plan §12.3 row added with this spec).

## 3. Requirements

| ID | Requirement | Source |
|---|---|---|
| DX-1 | The bundle is produced only by an explicit user-initiated request. No other verb, hook or background step builds, writes or sends one. | NFR-07; SEC-03 |
| DX-2 | Before any save, the user can see the complete bundle text that would be written. The saved bytes equal the previewed bytes. | NFR-07; TS §16 |
| DX-3 | The bundle is built by projection: a field is included only if this spec lists it. Unlisted fields in state or in journal records are dropped, never copied. | NFR-07; SEC-11; TS §16 ("records never contain file contents, prompts, secrets or command output") |
| DX-4 | Every included string passes `redact` unchanged. If redaction would change any included string, the export is refused and names the field, not the value. | SEC-11; TS §11.3 (suspected exposure) |
| DX-5 | Saving writes one new file at a path the user names. It never overwrites, never writes under `.tenet/`, and never follows a link. | TS §16; PRD §5.10.1 |
| DX-6 | The save is a not-repeatable effect: intent, write, result. A crash at any step leaves either no file or a complete file, and recovery reports which. | TS §7.4 |
| DX-7 | Field names map to the pinned OpenTelemetry GenAI subset. A value Tenet cannot observe is listed as a gap; it is never given a placeholder value. | ENG-06; PRD §3.8.8; decision-packet decision 6A |
| DX-8 | The bundle is bounded in size and says when it was truncated. | PRD §4.4.3 (bounded outputs) |
| DX-9 | The bundle is a deterministic function of state, journal and host facts. It contains no wall-clock time of its own, so a preview and a later save can be compared by hash. | DX-2 |

## 4. Proposed behavior and examples

Tests named here do not exist yet. `[NFR-07]` is added to a test title only when the examples E1 to E10 all pass, because the requirement has three clauses and a tag on one would overclaim. `[ENG-06]` is added only on E11.

| Example | Expected behavior | Test file |
|---|---|---|
| E1: the user asks to see the diagnostics bundle on a project with state | `inspect --view export` returns the bundle text, its `bundleHash`, and the list of sections included. State revision, every file under `.tenet/` and the project tree are byte-identical before and after. No file is created anywhere. | `packages/kernel/test/diagnostics-export.test.ts` |
| E2: the folder has no `.tenet/` | The view returns a bundle with only kernel, platform and host facts and `work: []`. It does not create `.tenet/`. | `diagnostics-export.test.ts` |
| E3: state and journal hold a work request with a token, an outcome sentence, a project path, a `ghp_` token in a hand-added journal field, and a quoted user word, and an `export` effect intent whose target path holds a user name | None of them appears in the bundle. A golden test pins the exact set of keys at every level of the bundle. | `diagnostics-export.test.ts` |
| E4: a journal call record has a `verb` value that looks like a token (a hand-edited journal) | The export is refused with `export-refused`, naming the field class `call.verb`. The response does not contain the value. Nothing is written. | `diagnostics-export.test.ts` |
| E5: the user confirms a preview and names a new file | `decide --kind export --h <handle> --target <path> --answers export-confirm=<bundleHash>` writes a file whose bytes equal the previewed text. Mode is private (0600). Creation is exclusive. | `packages/kernel/test/diagnostics-export-write.test.ts` (POSIX) |
| E6: `decide export` arrives without an `export-confirm` answer | Refused with `export-preview-stale`. Nothing is written. (A question response is not used: the refused call would append a journal record, which changes the hash it is meant to bind.) | `diagnostics-export-write.test.ts` |
| E7: a journal record is added between the preview and the confirmation | The bundle hash differs; refused with `export-preview-stale`; nothing written. A new preview then confirms. | `diagnostics-export-write.test.ts` |
| E8: the target is an existing file, a directory, a path with a link component, a path whose parent is missing, a path under `.tenet/`, a path inside the project tree (refused under §9 Q3 option B; accepted under option A), a path with `..`, a NUL or more than 1,024 characters | Each is refused with `export-target-refused` and a one-line reason. Nothing is written. | `diagnostics-export-write.test.ts` |
| E9: the process is killed (SIGKILL) before the intent, after the intent, after the write and after the result | Recovery reports: no file and no intent; intent with no file (not performed); file with the intent's hash (completed, result recorded); result with no state change (nothing to replay, because the effect changes no state). No partial file exists at the target at any point. | `diagnostics-export-write.test.ts`, fixture `fixtures/crash-export.ts` |
| E10: a full ordinary lifecycle (open, basis, check, finish) runs | No export file is created, `inspect --view export` is never called by the kernel, and no verb response contains a `bundleHash`. | `diagnostics-export.test.ts` |
| E11: a journal call record with the fields of Tech Spec §16 (written by ENG-09 if decision 6 is taken) | Each field is exported under the attribute in §5.3. Fields the record lacks appear in `gaps`. No attribute outside the pinned subset list and the `tenet.` namespace appears. | `diagnostics-export.test.ts` |
| E12: a journal with 5,000 call records | The bundle holds the newest 500, sets `truncated: true`, and its text stays under 256 KB (262,144 bytes). | `diagnostics-export.test.ts` |
| E13: `inspect doctor` and the bundle on the same project | The `kernel`, `platform` and `host` sections equal the doctor values for the same keys. | `diagnostics-export.test.ts` |

## 5. Proposed contract

### 5.1 Verb and view

- **Preview:** `inspect --view export [--topic diagnostics]`. New value `export` in `InspectInput.view`. `--topic` defaults to `diagnostics`; any other topic is refused (`restriction-key-unknown`) until the `evidence` and `feedback` bundles are specified. Class: read-only. It reads state and journal; it writes nothing and appends no journal record.
- **Save:** `decide --kind export --h <handle> --target <path> --answers export-confirm=<bundleHash>`. New decision kind `export` (request form, as Tech Spec §6.5 lists). `--target` and `--answers` already exist in `DecideInput`. No other input field changes.
- **Handle limit.** `decide` needs a handle (§2). Any contract works, including a finished or abandoned one. With no contract there is nothing in the journal beyond doctor facts, and the preview is still available for the user to copy by hand. This is Q2.
- **Why two steps.** The preview call appends nothing to the journal, so the bundle seen at preview equals the bundle built at confirmation unless something else ran in between (E7). A single `decide` that returns a question would append a journal record on the way and could never match its own hash.

### 5.2 Bundle content (projection, DX-3)

The text is JSON with sorted keys, two-space indentation, LF endings and one trailing newline.

| Section | Fields | Source |
|---|---|---|
| `format` | `name: "tenet.diagnostics"`, `version: 1` | constant |
| `kernel` | `version`, `stateSchema`, `adapter` | `ports.version`, `schemaStatus`, the adapter id the doctor already reports |
| `platform` | `os` (`ports.platform`), `node` (`process.version`) | as `inspect doctor` |
| `host` | for each capability key: `value` and `source`, cut to 200 characters. The free-text `evidence` is not exported. | `ports.host.capabilities()` |
| `state` | `initialized`, `revision`, counts of work by `state`, by `lane` and by `profile`, `pendingQuestions` (count) | state document |
| `work[]` (newest 20) | `handle`, `label` (a sequence label such as `W7`, made by `workLabel` in `verbs/open-new.ts`), `profile`, `state`, `lane`, `stopReason`, budget counters (`attempts`, `reviewRounds`, `delegations`, `checksLaunched`, `activeMinutesTotal`), receipt counts by `kind` and `status`, finding counts by `severity` and `state`, `model.qualification` | state document. Never `outcome` (the user's words), scope paths, quotes, or any message. |
| `calls[]` (newest 500) | `t`, `verb` (must be a known verb name, else the record is counted in `dropped`), `exit` (0 to 5), `revision`, plus the §16 fields each validated against a closed vocabulary or a handle pattern once written | journal |
| `effects` | count of intents and results by effect name; count of unresolved intents. No `op` bodies, paths or hashes. | journal |
| `gaps` | names of attributes in §5.3 that no record supplied | computed |
| `dropped` | count of journal fields and records not exported | computed |
| `truncated` | `true` when `calls` were cut at 500 | computed |

Excluded on purpose and tested (E3): request text, outcome text, user quotes, file paths of the project or the machine, file contents, command lines and output, environment values, host-supplied usage figures (RSC-04; TS §16 says they are personal data and need a preview), lesson text, decision-record text and the `evidence` strings of capabilities.

Monthly summaries of reduced old records are not exported in the first version (open question Q6).

### 5.3 OpenTelemetry mapping (ENG-06, DX-7)

The bundle is not an OTLP payload and does not claim OTLP conformance. Each entry of `calls[]` carries an `attributes` object. Attribute names below are candidates written from memory of the GenAI conventions; the pinned version must be chosen and each name checked against it before implementation (Q1). The conventions have changed names between releases, which is why the pin matters.

| Tenet field | Attribute | Today |
|---|---|---|
| (constant) | `gen_ai.operation.name` = `execute_tool` | observed: every verb call is a tool call |
| `verb` | `gen_ai.tool.name` | observed |
| `exit` | `error.type` (set only when `exit` is not 0, value `exit-<n>`) and `tenet.exit` | observed |
| `revision` | `tenet.revision` | observed |
| `t` | `tenet.recorded_at` (the append time, not a start time) | observed |
| `work` | `tenet.work` | gap until ENG-09 |
| `role` | `gen_ai.agent.name` | gap until a host mechanism qualifies (SP-03) |
| `model.requested` / `model.resolved` | `gen_ai.request.model` / `gen_ai.response.model` | gap until written on the call record |
| usage tokens | `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens` | gap: the kernel observes no provider usage (`usage: unknown`, RSC-04) |
| `permission`, `termination`, `checkOutcome`, `durationMs`, `intentRevision` | `tenet.permission`, `tenet.termination`, `tenet.check.outcome`, `tenet.duration_ms`, `tenet.intent_revision` | gap until ENG-09 |

Rule: a name outside `gen_ai.*`, `error.type` and `tenet.*` is a defect. `tenet.*` is Tenet's own namespace for values the conventions do not define. A gap is a name in the `gaps` list, not a field with the value `unknown` or `null`, so that a reader cannot mistake absence of observation for a measured value. (If decision 6 settles on an explicit `unknown` value instead, this rule changes to match.)

### 5.4 Save effect

1. `decide export` rebuilds the bundle, compares its hash to the `export-confirm` answer (E6, E7), validates the target (E8), and refuses on any mismatch.
2. `tx.intent("export", id, { target: <path>, temp: <temporary file name>, bundle: <hash>, bytes })`. The intent holds the path because recovery runs before any request and has no other way to find the file; it never holds content. The path may contain a user name, so the journal's `op` bodies are never exported (DX-3, E3), and the response repeats the path only as the user gave it.
3. The file is written beside the target as an exclusive, no-follow temporary file, synced, then published with an exclusive hard link so an existing file is never replaced (the pattern in Tech Spec §7.4 for recipe creation). The temporary file is removed.
4. `tx.result("export", id, { completed: true })`. No state document change follows, so there is nothing to replay on recovery.
5. Recovery (`SETTLE.export`): hash the target. Equal to the intent's bundle hash means completed; absent means not performed; anything else means unresolved and is reported. In every case the named temporary file beside the target is removed if it is still there.

New reason codes (additive, minor under Tech Spec §6.7): `export-preview-stale` (exit 2), `export-target-refused` (exit 2), `export-refused` (exit 2, redaction or projection refused the bundle).

## 6. Does it fit central code, and what does it cost?

**It does not fit.** Central (pipeline, verbs, decisions) has 37 non-whitespace characters free of 247,219 (`unmapped-musts.md`, measured 2026-11-03). Any option that adds a view needs more than that. The figures below are estimates, not measurements. They are derived from existing modules measured with the quality gate's own counting: `decisions/cleanup.ts` 1,039 characters, `decisions/hardening.ts` 2,757, the `hardening` recovery handler 704, the `residue` view case 64, one import line 47.

| Piece | Where | Counts as central? | Estimate (characters) |
|---|---|---|---|
| Bundle builder, projection, OTel mapping, target checks, hash | `core/diagnostics.ts` (new) | No. No budget in `tools/lint-quality.ts` matches it. Function limits still apply (80 lines, complexity 25). | 4,500 to 6,500 |
| `export` in `InspectInput.view`, view `case`, import, help text | `core/schemas.ts` (528 free); `verbs/inspect.ts` | schemas: no budget conflict; inspect: yes | 10 (schemas); 130 to 200 (inspect) |
| `export` decision: validate, rebuild, compare, intent, write, result | `decisions/export.ts` (new), one registry line in `decisions/index.ts` | Yes | 1,800 to 2,800 |
| Recovery handler | new `verbs/recover-export.ts`, one registry line in `verbs/recover-effects.ts` | Yes | 500 to 750 |
| Exclusive create outside the project | a new method on the `Project` port and `adapters/project-fs.ts` (not on `Store`: `adapters/store-fs` has 214 free); it must not reuse the root-confined path resolver | No budget matches `adapters/project-fs.ts` (148 lines) | 900 to 1,400 (option A of Q3 needs none) |
| Reason codes | `core/reasons.ts` | No | 250 |

**Central total, full design (preview and kernel save): about 2,450 to 3,800 characters**, which is 66 to 103 times the free space. **Preview only (Q4 option B): about 130 to 200.** Both need an owner capacity decision (decision-packet decision 1) or an offsetting removal. The owner sets ceilings; this spec does not propose a figure.

File-size cap: `verbs/recover-effects.ts` is 263 lines and the file cap for verbs and decisions is 265 (`tools/coverage.ts`). The recovery handler therefore goes in its own file with a one-line registration. `verbs/inspect.ts` (123 lines) has room.

Bundle size: the bundle build adds to `plugin/kernel/tenet.mjs`. The November 2 baseline build is 784,061 bytes against a 819,200-byte limit (`decision-packet.md`, not rebuilt for this spec). The builder is plain code with no new dependency; an estimate of 8 to 14 KB is the author's, to be measured.

## 7. Alternatives considered

| Option | What it does | Cost and limits |
|---|---|---|
| A. Preview view plus kernel save through `decide` (recommended) | As §5. The hash binds the saved bytes to the previewed bytes; the kernel validates the path and records the effect. | Largest central cost. Needs a work handle for the save. |
| B. Preview view only; the host writes the file | `inspect --view export` returns the text. The coordinator writes it to the user's path with the host's own file tool, after the user agrees. | Smallest central cost. "Saved only to a chosen path" and "only on request" rest on the coordinator and the host's write approval (cooperative, to be disclosed as such). The kernel cannot check that the saved bytes equal the preview. |
| C. A front-end-only `tenet export` command | Builds the bundle in `frontends/cli.ts` or `main.ts`, which are outside the central budget. | Rejected: front-ends hold no logic and one pipeline runs every verb (`copilot-instructions.md`, checked by `lint-arch`). |
| D. Kernel writes to Tenet's temp folder and reports the path | Uses `Store.writeArtifact`; no new port; the user copies the file. | Meets the PRD's "a report file the user chooses to save" (§3 command table) but not Tech Spec §16's "chosen path". Lowest kernel-save cost, and the folder is swept by `cleanup`. |

**Recommendation: A**, because it is the mechanism Tech Spec §§4.3, 6.5, 7.4 and 16 already describe, and it is the only option where the kernel, not a model, ties the saved bytes to the previewed bytes. If capacity is not granted, **B** is the smallest option that still gives redaction and preview inside the kernel; it must then be described as cooperative for saving. A and B share the preview, so building the preview first loses nothing under either choice.

## 8. State, compatibility and impact

- **No schema change and no stored field.** The bundle is derived. The only new durable record is the journal intent and result pair for the save (`LogRecord` already accepts any effect name).
- **Consumers affected.** `InspectInput` (one enum value; `lint-skills` builds example command lines from this schema, so any skill text naming the view must parse); `DECISIONS` registry; recovery dispatch (an unknown effect name stays unresolved today, so an old kernel reading a newer journal reports `effect-uncertain`, which is safe); `core/reasons.ts` and `tools/coverage.ts` (every reason code needs a test fixture); the reason-code audit; `inspect help` text; the coordinator skill and `/tenet feedback` wording if the owner wants the user-facing command (the coordinator skill is at 3,992 of 4,000 tokens, so a row there needs a matching removal; `tenet-intake` has room but does not own this command).
- **Attribution.** A save outside the project tree (Q3 option B) leaves the project inventory unchanged. A save inside it creates an untracked file that an active edit contract would see as a foreign change (`attribution-unexplained-change`).
- **ENG-09 coupling.** The export reads whatever the journal holds. It does not need decision 6, and it gains fields as ENG-09 writes them. ENG-09's candidate branch is held 245 characters over the ceiling; the two share the same capacity decision.
- **Requirement mapping.** ENG-06 (Should) moves from "omit" to buildable only if the owner revisits `decision-packet.md` §11 row ENG-06 and OSS-06. Until then the narrower claim stands: plain field names.
- **Unobserved.** How a model or host handles the preview text, whether the coordinator shows it to the user in full, and how a user chooses a path in the host UI are unobserved. The kernel cannot verify that the user asked (cooperative; E10 shows only that the kernel never starts an export).

## 9. Owner questions

**Q1. Which OpenTelemetry GenAI version is pinned, and who checks the attribute names?**
- A. Pin the newest stable release at implementation time and record it in Tech Spec §16 (recommended: the PRD's own wording asks for the version at approval, which was not recorded, so the next honest point is when the names are checked).
- B. Pin the version current at the Tech Spec's approval date, found from history. Needs a date the Tech Spec does not state.
- C. Drop ENG-06 for R1 and keep plain names (the decision-packet's current narrower claim).

**Q2. May the save require a work handle?**
- A. Yes; with no contract at all, only the preview is available (recommended: no new central code, and an empty project has little to export).
- B. No; add a handle-free path to `decide`. Changes `verbs/decide.ts` and the `DecisionCtx` type that every decision uses.

**Q3. Where may the saved file go?**
- A. Anywhere under the project root that is not excluded and not under `.tenet/`. Uses the existing project port. Adds an untracked file to the working tree.
- B. Anywhere outside the project root and outside `.tenet/` (recommended: no effect on attribution, and the user can attach it directly). Needs a new exclusive-create port method.
- C. Either, with the user's path deciding.

**Q4. Preview only, or preview and kernel save?**
- A. Both (recommended; §7 option A).
- B. Preview only, host saves (§7 option B). Requires wording that says saving is cooperative.

**Q5. Central capacity.** The cost in §6 needs decision-packet decision 1, or the owner names what to remove. This spec proposes no figure.

**Q6. Monthly summaries.** Export the reduced monthly counts as well? Recommended: not in the first version; they are counts by verb and exit only, so they add little and need a store read method (`Store` has only `readLog`).

**Q7. New reason codes.** Add `export-preview-stale`, `export-target-refused` and `export-refused` (additive). Recommended: yes; no existing code names these refusals.

## 10. Risks and assumptions

- **Redaction is a heuristic.** `redact` misses what it does not match. The primary control is the allowlist projection (DX-3); redaction is a second layer. The preview is the user's last check. The bundle must say "likely secrets removed", never "no secrets".
- **Journal fields written in future.** When ENG-09 adds fields, each must be added to the allowlist with a validator before it is exported. An unlisted field is dropped, so a new field is invisible rather than leaked (tested in E3 and E11).
- **Diagnostics on damaged state.** The most useful export may be wanted when the state is recovered from backup or quarantined. How the read-only path behaves then is unobserved and not specified here (assumption: the view returns host and kernel facts and a `state` section marked unreadable, without the journal). To be settled in review.
- **Hash race.** A second Tenet call between preview and confirmation makes the save refuse. This is correct, and costs one more preview in a rare single-user case.
- **Path handling on Windows.** Write tests run on POSIX CI only; drive-letter and device-name handling for targets is unobserved.
- **Assumption.** The coordinator relays the user's request truthfully and shows the whole preview. Both are cooperative and unobserved on a native host.

## 11. Acceptance criteria and gates

Before implementation: independent review with dispositions (§12 is the author's own pass and does not replace it); owner answers Q1 to Q5; owner sign-off; a decision on central capacity.

Implementation is red-first with E1 to E13. Done when: all examples pass; `npm run ci` passes (typecheck, `lint-arch`, `lint-skills`, `lint-quality`, coverage, bundle within budget, tests); the built bundle is driven on a scratch repository through preview, refusal and save, and the saved file is compared byte for byte with the preview (UAT, step 6 of the lifecycle); a planted-secret scan of the saved file finds nothing. Host behavior stays "unobserved" until a spike records it. `[NFR-07]` is added only when E1 to E10 all pass; the R1 mapping changes only then. Backfill Tech Spec §§6.5 and 16 (pin, closed vocabulary, `export-confirm`) and the PRD data-model row only for what changes.

## 12. Review pass and dispositions (author, 2026-11-03, fresh re-read against the PRD text)

Method: re-read NFR-07 ("Diagnostics shall be redacted and exported only on user request, with the included content previewed"), ENG-06, SEC-11, PRD §3.8.8, §5.10.1 and Tech Spec §16 against §§3 to 5 above. This is a self-review after drafting, not an independent review; it does not meet lifecycle step 2.

| # | Finding | Disposition |
|---|---|---|
| 1 | NFR-07 says "exported only on user request". The first draft's flow let `decide` without a confirmation return a question, and that call appends a journal record, so the question's hash could never match the later bundle. | Fixed: preview moved to the read-only `inspect` view; `decide` without a matching answer is refused (§5.1, E6). |
| 2 | "Redacted": the first draft relied on `redact` alone. Its own header says it misses what it does not match. | Fixed: allowlist projection is the primary control (DX-3, E3); redaction is a second layer that refuses rather than edits (DX-4, E4). |
| 3 | "Previewed": a preview of a different byte sequence than the one saved would not satisfy the clause. | Fixed: the saved bytes are bound to the previewed bytes by hash (DX-2, E5, E7). Under option B of Q4 this is not kernel-checkable; stated in §7. |
| 4 | The first draft kept a hash of the target path in the intent so the journal would not hold a user name. On re-reading §5.4 step 5, recovery runs before any request and could not find the file from a hash. | Fixed the other way: the intent holds the path and the temporary file name; the journal's `op` bodies are excluded from every export (DX-3, E3). Recovery also removes a leftover temporary file. |
| 5 | TS §16 says records hold no file contents or prompts, but the journal passthrough accepts any extra field. A hand-edited or future field could carry them into an export. | Fixed: unlisted fields are dropped and counted (DX-3, E3, E11). |
| 6 | ENG-06 requires "the pinned" subset, but no pin exists in the Tech Spec. The attribute names here came from memory and could be wrong for the pinned version. | Open: Q1. The names are marked as candidates in §5.3. A §12.3 defect row is added with this spec. Not resolvable by the author. |
| 7 | `decide` needs a work handle (checked in `verbs/decide.ts`, `verbs/common.ts`), but Tech Spec §4.3 routes `/tenet feedback` through `decide` with no mention of a handle. A project with no contract cannot save. | Open: Q2. Recorded as a spec defect in plan §12.3. |
| 8 | The first estimate counted only the new decision module. Recovery would add about 700 characters to `verbs/recover-effects.ts`, which is at 263 of 265 lines. | Fixed: recovery is a separate file with a one-line registration (§6). |
| 9 | NFR-07 is a Must at Beta with AC-11 (never waivable). A tag on a partial test would claim more than the evidence. | Fixed: tag rule in §4 and §11. |
| 10 | The PRD (§3 command table) says "only a report file the user chooses to save"; Tech Spec §16 says "a chosen path". These differ slightly. | Open: listed as option D in §7 so the owner can choose the PRD reading. Not a conflict that blocks the recommended design, which satisfies both. |
| 11 | Windows refuses mutating verbs, so E5 to E9 cannot run on this host. | Accepted: stated in §2 and in the test file column. Preview examples run anywhere. |
| 12 | The bundle's "no wall-clock time" rule (DX-9) hides when the bundle was made, which a recipient might want. | Accepted: the recipient can read the newest `t` in `calls[]`. A generated-at field would break the hash comparison in E7. |
| 13 | AC-11 also forbids bundling an MCP server and requires telemetry off by default. | No change needed: the export adds no network code and no MCP surface; DX-1 and E10 cover "off by default". |
| 14 | A claim in the first draft that `label` is derived from the request was wrong; `workLabel` makes a sequence label. Recovery also could not find a file from a path hash (finding 4). | Fixed in §5.2 and §5.4 after a second read of `verbs/open-new.ts` and the recovery dispatch. |
