# Specification: Diagnostics export (NFR-07, ENG-06)

> Status: **draft, revised, unreviewed.** First written 2026-11-03 under the owner's blanket direction of that date to build candidates on an isolated branch. That direction is not a sign-off. An independent review the same day ([reviews/diagnostics-export-review.md](reviews/diagnostics-export-review.md), 22 findings) is answered in this revision; the disposition of each finding is in that file. A **second independent review is required before sign-off.** This spec is not part of the canonical specs, changes no source, and authorizes no implementation. Open owner questions are in §9.
> Sources: PRD NFR-07, ENG-06, SEC-03, SEC-11, SEC-13, AC-11, §3.8.8, §4.4.3, §4.7, §5.10.1 to §5.10.3, §5.17; Tech Spec §§4.3, 4.6, 6.2, 6.5, 7.4, 11.3, 11.4, 16; `ux-spec.md` §§3.2, 4.1, 4.4, 4.5, 5.2, 9, 13.1; `decision-packet.md` decisions 1, 6 and rows ENG-06 and OSS-06; `docs/audits/2026-11-03/unmapped-musts.md` row NFR-07.
> Code read for this revision: `main` at `8b1d574` (includes the ENG-09 call record and the RES-05 slice).

## 1. Outcome

A user can ask Tenet for a diagnostics bundle, read the complete text in chat, and have the kernel save exactly that text to a new file at a path they name. The bundle holds only fields this spec lists, passes redaction, and carries no file contents, prompts, secrets, command output or machine paths.

What the kernel enforces, and what it does not:

| Claim | Kernel-enforced | Cooperative (unobserved) |
|---|---|---|
| The bundle holds only listed fields; unlisted fields are dropped | Yes (projection, DX-3) | |
| Likely secrets are removed | Yes, as a heuristic: a bundle that redaction would change is refused (DX-4) | That redaction finds every secret |
| The saved bytes equal the previewed bytes | Yes: the save is bound to the preview's hash (DX-2) | |
| The save never replaces a file, never writes under `.tenet/` or the project, never follows a link | Yes (DX-5) | |
| The kernel builds a bundle only in two calls: the preview view and the save | Yes, and tested by reading imports (E10) | |
| The user asked for the export | | The calls arrive from a model. `inspect` is on the host's auto-approve list (Tech Spec §4.6), so a model can build the preview at any time without the user asking. The save requires a `--quote`, a captured user request recorded as `reported`, and a Consequential host approval in Manual approval mode; neither proves the user spoke. |
| The user read the preview | | Whether the coordinator shows the whole preview is unobserved. |
| Nothing leaves the machine | The kernel has no network code (`lint-arch`) | The preview text is returned to the model as a tool response, so it reaches the model provider (PRD §5.10.1, "Host-managed model and tool traffic"). It holds the listed fields only. It contains no outcome text, path or command output; `inspect status` already returns the first 80 characters of each outcome sentence and `inspect doctor` returns the project root path, neither of which the bundle includes. Its most sensitive content is call timing metadata. |

NFR-07 is a Must tied to AC-11, which PRD §4.7 never allows to be waived. The wording "exported only on user request" can therefore be met by the kernel only in the narrow sense of the first four rows. Whether the PRD should say so is Q8.

Out of scope: the `evidence` bundle (JUnit, SARIF; Tech Spec §9.5), the `feedback` bundle (OSS-06, a Should; it would reuse this export and add user-written text), telemetry upload of any kind (SEC-03), a bundle for a store that cannot be read (§10), and any change to what the journal records (ENG-09, decision-packet decision 6).

## 2. Current state (read from `main` at `8b1d574`)

- No export exists. `InspectInput.view` has no `export` value (`core/schemas.ts:508`); `DECISIONS` has no `export` kind (`decisions/index.ts:23`). `OSS-06` and `ENG-06` are marked "omit" in `decision-packet.md` §11 for this reason.
- Tech Spec §6.5 lists an `inspect export` view and an `export` kind of the `decide` request form (`{request: kind, target, quote?}`, "a user-initiated action"). §4.3 says feedback uses a "previewed export to a chosen path". §7.4 classes exports as not repeatable (intent, act, result, publish). §16 says diagnostics exports are "previewed in full and saved only to a chosen path" and that the export maps field names to the pinned OpenTelemetry subset.
- `core/redact.ts` provides `redact` and `redactDeep`. Its header says it is a heuristic: "likely secrets", never "no secrets". Its credential-assignment pattern (`core/redact.ts:17`) also changes JSON such as `"tokenBudget": 20000000` and `"gen_ai.usage.input_tokens": 12345678` to `[redacted]` (reproduced 2026-11-03 on this tree). A field name containing `token`, `secret`, `password`, `passwd` or `api`/`access`/`private` plus `key`, with a value of eight or more characters holding a digit, is changed. `render()` applies `redactDeep` to every response (`pipeline-render.ts:66`).
- **ENG-09 is on `main`.** The journal call record is written at `pipeline-render.ts:108` with `core/trace.ts` fields: `work` (the contract label such as `W-0007`, absent when the call has none), `intentRevision`, `startedAt`, `durationMs`, `termination`, `checkOutcome` (check calls only), and `role`, `model`, `permission` written as the explicit value `unknown` with `visibilityGaps` naming them. Tech Spec §16 was amended to match. `t` is the append time: the store stamps `this.clock.now()` at append (`adapters/store-fs.ts:446-448`).
- Tech Spec §16's `CallRecord` types `t: "call"`, but the journal uses `kind: "call"` and `t` as a timestamp (`adapters/store-fs.ts:28-33`). Logged in plan §12.3 (2026-11-03 row for this revision).
- The journal schema is passthrough for call, intent and result records; effect names are free strings (`z.string().min(1)`, `store-fs.ts:28-33`). `Store.readLog()` returns the validated journal; records older than 90 days reduce to monthly counts of calls by verb and exit (`core/journal-reduce.ts`). A resolved intent and result pair also reduces after 90 days, so the intent's path is kept at least that long, locally.
- `inspect doctor` is stateless. It returns `checks` (the node check's `detail` is `process.version`), `detected`, `capabilities` (`ports.host.capabilities()`), `level`, `ok` and `readiness` (`verbs/inspect.ts:35-55`). It does not report a kernel version, a state schema number or an adapter id. Those come from `ports.version`, `SCHEMA_VERSION` (`core/schemas.ts`) and `ports.stack.adapterVersion()` (`running()`, `pipeline-version.ts:13-14`). `schemaStatus` (`core/versions.ts:9`) judges a record against a number; it is not a schema version.
- `decide` requires an existing state document and a work handle: `workOf(state, input.h)` throws `handle-required` or `handle-unknown` before any decision kind runs (`verbs/decide.ts:21`, `verbs/common.ts:51-55`). A refusal thrown inside the pipeline is rendered without `tx.call`, so a refused call appends no call record (`pipeline.ts` `fail`; `pipeline-render.ts:108` is the only `tx.call`).
- A mutating call runs, in order and inside the lock: configure policy, `recover` (it may settle effects and append results), `reconcileShared`, the handle envelope (`withRequiredChecks`, `fence`, `versionGate`, possibly `claimSource`), then the verb (`pipeline-mutate.ts:154-180`). An unresolved intent fences every call but `stop` (`pipeline-mutate.ts:132-137, 158-159`). An identical retry (same input hash, no `again`) is answered from `session.last` as `historical` without running (`pipeline-mutate.ts:126-128`).
- The project port (`ports/types.ts:238-251`) is confined to the project root: `writeNew`, `hashes`, `read`, `readBounded`, `write`, `remove` all resolve relative paths under the root. The store port writes artifacts only under Tenet's temp folder (`writeArtifact`). No port can create, hash or remove a file at an arbitrary absolute path.
- Recovery dispatch (`verbs/recover.ts:34-42`) calls `SETTLE[effect]` for an unresolved intent and otherwise adds the intent to `uncertain`, which fences. `verbs/recover-effects.ts` is 263 lines against the 265-line cap (`tools/coverage.ts`).
- Windows refuses mutating verbs (`pipeline.ts:97-100`, `capability-missing`), so the save cannot run on the owner's own machine. Read-only views run on Windows.
- PRD §4.4.3 has no row named "bounded outputs". The relevant row is "Peak Tenet-injected context per assignment (excludes code read by tools) ≤ 20,000 tokens", class Observed, value Provisional.
- The Tech Spec records no OpenTelemetry version. PRD §3.8.8 requires "the version current at Tech Spec approval". Logged in plan §12.3.
- Capacity (measured 2026-11-03 with `tools/lint-quality.ts`'s own counting): the central owner (`pipeline + verbs + decisions`) uses 248,109 non-whitespace characters. The **approved** ceiling is 247,219 (4,292 lines) and is already exceeded by 890. The **proposed, not owner-approved** ceiling of 4,310 lines is 248,256, leaving **147** characters. `core/schemas.ts` has **463** free.

## 3. Requirements

| ID | Requirement | Source |
|---|---|---|
| DX-1 | The kernel builds a bundle only in two calls: `inspect --view export` (preview) and `decide --kind export` (save). No other verb, hook or background step builds, writes or sends one. Both calls can be made by a model; that the user asked is cooperative and is disclosed as such (§1). | NFR-07; SEC-03 |
| DX-2 | Before any save, the complete bundle text that would be written is returned by the preview. The saved bytes equal the previewed bytes: the save is bound to the SHA-256 of the previewed text. | NFR-07; TS §16 |
| DX-3 | The bundle is built by projection: a field is included only if this spec lists it. Unlisted fields in state or in journal records are dropped and counted, never copied. | NFR-07; SEC-11; TS §16 ("records never contain file contents, prompts, secrets or command output") |
| DX-4 | The final bundle text passes `redact` unchanged (`redact(text) === text`), and so does every included string. If redaction would change either, the export is refused and names the field class, not the value. | SEC-11; TS §11.3 |
| DX-5 | The save writes one new file at an absolute path the request names, whose name ends in `.json`. It never overwrites, never writes inside the project root or under `.tenet/`, and never follows a link. It is a Consequential `decide` kind, so the host's approval prompt applies in Manual approval mode, and the coordinator asks in chat first when the approval mode is auto-approve or unknown (SEC-13 reading, advisory; Q8). It requires `--quote` (presence only; not stored, not exported). | TS §§4.6, 11.4; PRD §5.10.1 |
| DX-6 | The save is a not-repeatable effect: intent, act, result. A crash at any step leaves the target either absent or complete, and recovery reports which. Recovery never fences: an export changes no state, so an intent recovery cannot settle is closed as abandoned and reported. | TS §7.4 |
| DX-7 | Tenet field names are plain. A value Tenet cannot observe is named in `gaps`; it is never given an invented value. The OpenTelemetry mapping (ENG-06) is not part of this slice (Q1). | ENG-06; PRD §3.8.8; decision-packet decision 6 |
| DX-8 | The preview text is at most 16,384 bytes. The builder sheds the oldest entries to fit and says what it shed. | PRD §4.4.3 (peak injected context) |
| DX-9 | The bundle is a deterministic function of the state document, the journal, host facts and kernel facts, all as read at the start of the call. It contains no wall-clock time of its own. | DX-2 |
| DX-10 | The bundle is not an opt-in telemetry channel. The five items PRD §5.10.1 names for diagnostics are answered in §5.5. | PRD §5.10.1 |

## 4. Proposed behavior and examples

Tests named here do not exist yet. `[NFR-07]` is added to a test title only when E1 to E10 all pass, because the requirement has three clauses and a tag on one would overclaim. The tag does not claim that the user asked; the claim is the first four rows of §1. `[ENG-06]` is not used by this slice.

| Example | Expected behavior | Test file |
|---|---|---|
| E1: the user asks to see the diagnostics bundle on a project with state | `inspect --view export` returns `data.text` (the bundle), its `bundleHash`, its byte count and the list of sections. State revision, every file under `.tenet/` and the project tree are byte-identical before and after. No file is created anywhere, and no journal record is appended. | `packages/kernel/test/diagnostics-export.test.ts` |
| E2: the folder has no `.tenet/` | The view returns a bundle with only kernel, platform and host facts and `work: []`. It does not create `.tenet/` and does not call `readLog`. | `diagnostics-export.test.ts` |
| E3: state and journal hold a work request with a token, an outcome sentence, a project path, a `ghp_` token in a hand-added journal field, a quoted user word, and an `export` intent whose target path holds a user name | None of them appears in the bundle. A golden test pins the exact set of keys at every level of the bundle. The `dropped` counters account for the hand-added field. | `diagnostics-export.test.ts` |
| E4: a journal call record has a `verb` that is not a name in the verb registry (a hand-edited journal), and another has `exit: 9` | Each record is left out and counted in `dropped.calls`. The value does not appear in the text. The export still succeeds. | `diagnostics-export.test.ts` |
| E4b: a `host` capability value holds a `ghp_` token, or a numeric field name would be changed by `redact` | The export is refused with `export-refused`, naming the field class (`host.model`), not the value. Nothing is written. | `diagnostics-export.test.ts` |
| E5: the user confirms a preview and names a new file | `decide --kind export --h <handle> --target <path> --quote <words> --answers export-confirm=<bundleHash>` writes a file whose bytes equal the previewed text. Mode is 0600. Creation is exclusive. The response says where, how many bytes, and that nothing else was kept. | `packages/kernel/test/diagnostics-export-write.test.ts` (POSIX) |
| E5b: the same `decide export` is sent again unchanged | Answered from `session.last` as `historical`; no second write. After the target is deleted, a retry needs `--again`, and then the hash differs because the journal grew, so a new preview is needed (E7). | `diagnostics-export-write.test.ts` |
| E6: `decide export` arrives without an `export-confirm` answer, or without `--quote` | Refused (`export-preview-stale` for the answer, `export-refused` with "the request needs the user's words in `--quote`" for the quote). Nothing is written, no intent is appended. | `diagnostics-export-write.test.ts` |
| E7: a journal record is added between the preview and the confirmation | The bundle hash differs; refused with `export-preview-stale`; nothing written. A new preview then confirms. | `diagnostics-export-write.test.ts` |
| E7b: between the preview and the confirmation, an unrelated interrupted effect is settled by recovery (it appends a result and may change a contract's state), or `reconcileShared` changes state | The confirmation rebuilds the bundle after recovery, so the hash differs; refused with `export-preview-stale`; a second preview then confirms. If a version drift stops the call first, the answer is `version-changed` (exit 3), not a stale preview. | `diagnostics-export-write.test.ts` |
| E8: the target is an existing file with other content, a directory, a path with a link component, a path whose parent is missing, a path under `.tenet/`, a path inside the project tree, a relative path, a path with `..`, a NUL, a name not ending in `.json`, or more than 1,024 characters | Each is refused with `export-target-refused` and a one-line reason that names the cause. Nothing is written and no intent is appended. | `diagnostics-export-write.test.ts` |
| E8b: the target exists and its bytes already hash to the confirmed `export-confirm` value | Answered as already saved (exit 0), nothing written. (This is also how a retry after a lost response succeeds, D14.) | `diagnostics-export-write.test.ts` |
| E8c: the filesystem refuses a hard link (a port fixture throws `EPERM` at publish), or the operating system refuses the write (`EACCES`) | `export-target-refused` naming the cause ("this filesystem cannot create the file safely", "the operating system denied the write"). The temporary file is removed, a result `{completed:false}` closes the intent, and no file exists at the target. The user's route is to copy the preview text themselves. | `diagnostics-export-write.test.ts` |
| E9: the process is killed (SIGKILL) at each point of the save: before the intent; after the intent; after the temporary file is created; after it is written and synced; after the hard link, before the temporary file is removed; after the temporary file is removed; after the result | Recovery reports, respectively: no file and no intent; intent, no file (not performed, temporary file absent); temporary file present, target absent (not performed, the temporary file is removed, partial or complete); target equal to the intent's hash with the temporary file also present (completed, temporary file removed); target equal to the intent's hash, temporary file absent (completed); result recorded (nothing to settle). In every case the directory holds no file other than the target and, before recovery, the named temporary file, and no half-written file is ever at the target name. | `diagnostics-export-write.test.ts`, fixture `fixtures/crash-export.ts` |
| E9b: after a completed save the user edits the saved file, or a different file appears at the target, and the kill happened before the result | Recovery does not fence. It closes the intent as `{completed:false, observed:"different-content"}` and reports in `effects.completed` that the file at the target has different content now and was left untouched. The next call of any verb is not refused. | `diagnostics-export-write.test.ts` |
| E10: a full ordinary lifecycle (open, basis, check, finish) runs; and the sources of the kernel are read | No export file is created, and no response outside the two calls contains a `bundleHash`. Only `verbs/inspect.ts` and `decisions/export.ts` import `core/diagnostics.ts`. | `diagnostics-export.test.ts` |
| E11: a journal call record with all ENG-09 fields (`work`, `intentRevision`, `startedAt`, `durationMs`, `termination`, `checkOutcome`, `role`, `model`, `permission` as `unknown`, `visibilityGaps`) | Each listed field appears if it passes its validator. `role`, `model` and `permission` are not repeated per record when `unknown`; their names are in `gaps`. A value outside the closed vocabularies of `core/trace.ts` is dropped and counted. No unlisted key appears. | `diagnostics-export.test.ts` |
| E12: a journal with 5,000 call records and 30 contracts | The bundle holds the newest 40 calls and 10 contracts, the `state` counts cover all 30, the text is at most 16,384 bytes, and `truncated` says how many calls and contracts were left out. A bundle that still exceeds the cap sheds the oldest calls, then the oldest contracts, until it fits. | `diagnostics-export.test.ts` |
| E13: `inspect doctor` and the bundle on the same project | `host` equals the doctor's `capabilities` for the same keys, and `platform.node` equals the `detail` of the doctor's `node` check. (`kernel` has no doctor counterpart.) | `diagnostics-export.test.ts` |
| E14: the target is on a filesystem in which `/tmp` is a link (macOS) | Refused with a reason that names the link component. The coordinator text offers the real path. | `diagnostics-export-write.test.ts` (POSIX) |

## 5. Proposed contract

### 5.1 Verb and view

- **Preview:** `inspect --view export [--topic diagnostics]`. New value `export` in `InspectInput.view`. `--topic` defaults to `diagnostics`; any other topic is refused with `capability-missing` (exit 1, "the `evidence` and `feedback` bundles arrive later"), the code the `impact` view already uses for an input it cannot serve. Class: read-only. It reads state and journal; it writes nothing and appends no journal record. It returns `data: { text, bundleHash, bytes, sections, truncated }`.
- **Save:** `decide --kind export --h <handle> --target <path> --quote <words> --answers export-confirm=<bundleHash>`. New decision kind `export` (request form, as Tech Spec §6.5 lists). `--target`, `--quote` and `--answers` already exist in `DecideInput` (`core/schemas.ts:450-459`). No input field changes.
- **Classification.** `export` is Consequential. It is not added to the routine `decide --kind=(…)` pattern of Tech Spec §4.6, so the generated snippet leaves it to the host (the final `decide … : false` line). The Tech Spec §6.5 risk column and the per-kind table must say so (backfill, §11). `inspect` stays Routine and auto-approved; that is why the preview is model-callable (§1).
- **Handle limit.** `decide` needs a handle (§2). Any contract works, including a finished or abandoned one. With no contract there is nothing in the journal beyond doctor facts, and the preview is still available for the user to copy by hand. This is Q2.
- **Why two steps.** The preview call appends nothing to the journal, so the bundle seen at preview equals the bundle built at confirmation unless something else changed state or journal in between (E7, E7b). A single `decide` that returned a question would append a journal record on the way and could never match its own hash.
- **User-facing words** are proposed in §5.6; the UX Spec owns them.

### 5.2 Bundle content (projection, DX-3)

The text is JSON with sorted keys, two-space indentation at the top levels, LF endings and one trailing newline. Each entry of `calls` and `work` is written on one line (compact JSON) so that a reader can scan it and the size stays inside DX-8. A 40-call, 10-contract sample of this shape measured 13,423 bytes (synthetic data, 2026-11-03; a real bundle is unmeasured).

| Section | Fields | Source |
|---|---|---|
| `format` | `name: "tenet.diagnostics"`, `version: 1` | constant |
| `kernel` | `version`, `stateSchema`, `adapter` | `ports.version`, `SCHEMA_VERSION`, `ports.stack.adapterVersion()` |
| `platform` | `os`, `node` | `ports.platform`, `process.version` |
| `host` | for each capability key: `value` and `source`, cut to 200 characters. The free-text `evidence` is not exported. | `ports.host.capabilities()` |
| `state` | `initialized`, `revision`, `recovered` (true when the document came from backup), counts of work by `state`, by `lane` and by `profile`, `pendingQuestions` (count). Counts cover all contracts. | state document |
| `work[]` (newest 10, §5.2.1) | `label` (a sequence label such as `W-0007`, made by `workLabel` in `core/ids.ts:21`), `profile`, `state`, `lane`, `stopReason`, budget counters (`attempts`, `reviewRounds`, `delegations`, `checksLaunched`, `activeMinutesTotal`), receipt counts by `kind` and `status`, finding counts by `severity` and `state`, `modelQualification` (the `qualification` value of `model`, if any) | state document. Never `handle` (it carries the workspace tag and links bundles from one workspace), `outcome`, `request`, scope paths, quotes, `model.requested`, or any message. |
| `calls[]` (newest 40, §5.2.1) | `t`, `verb`, `exit`, `revision`, and when present and valid: `work`, `intentRevision`, `startedAt`, `durationMs`, `termination`, `checkOutcome`; `role`, `model`, `permission` only when not `unknown` and valid | journal |
| `effects` | counts of intents and results, for effect names in a closed list only (the keys of `SETTLE` in `verbs/recover-effects.ts`, passed in by the view, plus `export`); count of unresolved intents. No `op` bodies, paths or hashes. | journal |
| `gaps` | names of fields no exported record supplied or supplied as `unknown`: the union of the exported records' `visibilityGaps` and the names Tech Spec §16 lists as not yet written (`frontEnd`, `generation`, `assignment`, `tenetTokens`, `reasons`, `userWaitBeforeMs`, `outcomeId`, `promptCaused`, `observedHooks`) | computed |
| `dropped` | `calls` (records left out), `fields` (fields left out), `records` (intent or result records with an unlisted effect name) | computed |
| `truncated` | `calls` and `work`: how many were left out for count or size | computed |

Validators. `verb` must be a name in the verb registry. `exit` is an integer 0 to 5. `revision`, `intentRevision` and `durationMs` are non-negative integers. `t` and `startedAt` match an ISO-8601 UTC pattern. `work` matches `^W-\d{4,}$`. `termination`, `checkOutcome`, `permission` and `role` are keys of the matching closed set in `core/trace.ts`. `model` is exported only as `unknown` (a model name is free text and has no closed set). A record whose `verb`, `exit`, `revision` or `t` fails is left out and counted; an optional field that fails is left out of the record and counted. A field name in the bundle never contains `token`, `secret`, `password`, `passwd` or `api`/`access`/`private` followed by `key` (the `redact` pattern, §2); the whole-text check of DX-4 would refuse such a bundle.

#### 5.2.1 Size (DX-8)

The cap is 16,384 bytes. It is a quarter of the 20,000-token peak-injected-context budget (PRD §4.4.3) at a conservative 3 characters per token (about 5,500 tokens; no tokenizer measurement has been made, so the figure is unobserved). It replaces the draft's 256 KB, which would have been several times the whole budget and cannot be read by a person in a narrow chat pane (`ux-spec.md` §4.5). The builder takes the newest 40 `calls` and 10 `work` entries, then, if the text is still over the cap, drops the oldest `calls` one at a time and then the oldest `work` entries until it fits. `state` counts are computed before any shedding. If the larger history is wanted, the route is a second file the user opens by hand, not a larger preview.

Excluded on purpose and tested (E3): request text, outcome text, user quotes, file paths of the project or the machine, file contents, command lines and output, environment values, host-supplied usage figures (RSC-04; TS §16 says they are personal data and need a preview), lesson text, decision-record text, the `evidence` strings of capabilities, and handles. The export therefore cannot contain content under a `no-export` exclusion (PRD §5.10.3), because it contains no project content.

Monthly summaries of reduced old records are not exported in the first version (Q6).

### 5.3 OpenTelemetry mapping (ENG-06)

**Deferred (Q1).** The earlier draft listed attribute names "from memory" (`gen_ai.operation.name = execute_tool`, `gen_ai.tool.name`, `gen_ai.agent.name`, `gen_ai.usage.*`, `error.type`). That list is withdrawn. Nothing in this repository fixes a stable release of the GenAI conventions, which names it defines, or whether `execute_tool` (a tool the model invoked) fits a Tenet verb call; the PRD itself says the conventions moved to another repository (PRD line 2677). When Q1 is answered, a section of this spec will give a table of Tenet field to attribute, each name checked against the pinned text, and E11-style conformance tests become conditional on that pin. Until then ENG-06 (a Should) stays "omit" in `decision-packet.md` §11 and this spec makes no OpenTelemetry claim. The bundle is not an OTLP payload.

### 5.4 Save effect

1. `decide export` checks `--quote` is present, then validates the target with the port (absolute, no `..` or NUL, at most 1,024 characters, ends in `.json`, outside the project root and `.tenet/`, parent exists and is a directory, no link component, not a directory). If the target exists: when its bytes hash to the `export-confirm` value the answer is "already saved" (E8b) and nothing else runs; otherwise `export-target-refused`. No intent exists yet, so a refusal here leaves nothing to recover.
2. It rebuilds the bundle from the state and journal as this call sees them (after recovery, reconciliation and the version gate, §2) and compares its hash to `export-confirm`. A mismatch is `export-preview-stale` (E7, E7b).
3. `tx.intent("export", id, { target, temp, bundle, bytes, capture: "reported" })`. The intent holds the path and the temporary file's name because recovery runs before any request and has no other way to find them; it never holds content or the quote. The path may contain a user name, so `op` bodies are never exported (DX-3, E3), and the intent stays in the local journal for at least 90 days before reduction to a count (CON-08).
4. The port stages the bytes in an exclusive, no-follow temporary file beside the target (mode 0600, written, synced), publishes it with an exclusive hard link so an existing file is never replaced (the pattern of Tech Spec §7.4 for recipe creation, `adapters/project-fs.ts` `publish`), then removes the temporary file. If any port call fails after the intent, the handler removes the temporary file, appends `tx.result("export", id, { completed: false, reason })` and refuses with `export-target-refused` (E8c).
5. `tx.result("export", id, { completed: true })`. No state document change follows, so nothing is replayed on recovery and there is no `PUBLISH` handler. A kill after the result and before the state publish leaves the file in place; the retry is answered by E8b.
6. Recovery (`SETTLE.export`, in its own file registered in one line): list the named temporary file and hash the target with the port.
   - Target absent: not performed. Remove the temporary file if present (a partial or complete one). Result `{completed:false}`.
   - Target hash equals the intent's bundle hash: completed. Remove the temporary file if present. Result `{completed:true}`.
   - Target present with another hash, or unreadable: abandoned. The file is left untouched. Result `{completed:false, observed:"different-content"}`. Reported in `effects.completed`; never in `uncertain`, so nothing is fenced.

New reason codes (additive, minor under Tech Spec §6.7): `export-preview-stale` (exit 2), `export-target-refused` (exit 2), `export-refused` (exit 2: the request is incomplete, or redaction or projection refused the bundle). `invalid-input` is not used because it is not a registered `ReasonCode` and `KernelError` cannot throw it. Each needs a test fixture because `tools/coverage.ts` counts codes without one.

New port methods, joining the `Project` port (the port that already owns exclusive-create publication), implemented in a new adapter file `adapters/outside-fs.ts` that shares no path resolver with `adapters/project-fs.ts` (whose resolver is root-confined and must not be reused). All take absolute paths:

| Method | Does |
|---|---|
| `stageOutside(target, bytes) → temp` | Exclusive, no-follow temporary file beside `target`, mode 0600, written and synced; refuses on the target rules of step 1 |
| `publishNewOutside(temp, target)` | Exclusive hard link; throws if the target exists or the filesystem cannot link; syncs the directory |
| `discardOutside(temp)` | Removes the temporary file if it is the one created (identity check); absent is fine |
| `hashOutside(path) → sha256 \| null` | Hash of a regular file; null only when absent; throws on a link or a non-file |

### 5.5 The five items PRD §5.10.1 names for diagnostics

| Item | Answer |
|---|---|
| Default | Off. No setting turns on automatic export; no bundle exists unless a call asks for it (DX-1). |
| Destination | The path named in the request, shown in the confirm question (§5.6). No upload; the kernel has no network code. |
| Purpose | Set by the user's request (for example, attaching to an issue). The preview frames it in one sentence; the bundle has no purpose field. |
| Schema | `format: tenet.diagnostics`, version 1, §5.2. |
| Retention | Tenet keeps no copy of the content. The journal keeps the intent (hash and path) and result for at least 90 days, then a count. The saved file is the user's. |
| Revocation | Delete the file. No consent record is stored; nothing remains to revoke. |

### 5.6 Proposed user-facing words (UX Spec owns the final text; backfill required)

- **Preview framing**, one sentence before the data (`ux-spec.md` §13.1): "This is the diagnostics bundle Tenet would save: versions, counts and recent call timings, with no code, prompts, file paths or command output. Likely secrets are removed, but that check is not a guarantee, so read it before saving." The bundle follows in full. Block formatting needs a UX Spec exception to §4.5 ("code blocks are only for commands to copy"): this text is data to be saved verbatim.
- **Confirm question** in plain chat (`ux-spec.md` §5.2 table: a write outside the project, so authority-class channel), naming the destination (`ux-spec.md` §9): "Save this to `<path>`? It creates a new file there and replaces nothing. 1. Save it (recommended) 2. Don't save". Under auto-approve or unknown approval mode the gate is labeled advisory.
- **After the save:** "Saved to `<path>` (`<n>` bytes). It is the text shown above, byte for byte. Tenet kept no copy of the content."
- **Refusals**, one sentence each, followed by the reason code in code font: a file already exists there and Tenet does not replace files; the folder does not exist; the path goes through a link (`<component>`), use its real path; Tenet does not save inside the project folder or `.tenet`; the name must end in `.json`; this filesystem cannot create the file safely, copy the text above instead; the operating system denied the write; Tenet's records changed since the preview, here is the new one; part of the bundle looked like a secret (`<field class>`), so nothing was made.
- **Windows:** "On Windows Tenet can show this bundle but cannot save files yet. Copy the text above into a file yourself."
- **Claim limits** (`ux-spec.md` §4.1): never "secure" or "no secrets"; "likely secrets removed, not guaranteed"; never "you approved this" (the kernel cannot tell who spoke).

## 6. Does it fit central code, and what does it cost?

**It does not fit.** The central owner has **147** non-whitespace characters free against a proposed, not approved, ceiling of 248,256; against the approved 247,219 it is already 890 over (§2). Figures below are estimates, not measurements, scaled from named modules measured with the quality gate's counting: `core/journal-reduce.ts` 2,832 (a journal projection), `core/outputs.ts` 3,857, `core/residue.ts` 1,898, `decisions/cleanup.ts` 1,039, `decisions/hardening.ts` 2,757, `adapters/project-fs.ts` `publish` and `syncParents` 1,296, the `hardening` recovery handler 704, the `residue` view case 64.

| Piece | Where | Counts as central? | Estimate (characters) |
|---|---|---|---|
| Bundle builder: projection, validators, size shedding, hash, whole-text redaction check | `core/diagnostics.ts` (new) | No budget in `tools/lint-quality.ts` matches it. Function limits still apply (80 lines, complexity 25). | 3,000 to 5,000 (about `journal-reduce` plus `outputs`; the OpenTelemetry table is out of this slice) |
| `export` in `InspectInput.view`, view `case`, import, help text | `core/schemas.ts` (463 free); `verbs/inspect.ts` | schemas: no; inspect: yes | 10 (schemas); 180 to 300 (inspect: six inputs to the builder, against 64 for the two-read `residue` case) |
| `export` decision: validate, rebuild, compare, intent, stage, publish, discard, result, response | `decisions/export.ts` (new), one registry line in `decisions/index.ts` | Yes | 1,800 to 2,800 (scaled from `hardening.ts`) |
| Recovery handler | new `verbs/recover-export.ts`, one registry line in `verbs/recover-effects.ts` | Yes | 600 to 900 |
| Port methods (§5.4) | `ports/types.ts` (the `Project` interface), new `adapters/outside-fs.ts`, one composition line in `wire.ts` | `ports/types.ts` and `wire.ts` are outside the central budget; no budget matches `adapters/outside-fs.ts` | 1,400 to 2,000 (scaled from `publish` 1,296 plus a no-follow hash reader) |
| Reason codes | `core/reasons.ts` | No | 300 |

**Central total, full design (preview and kernel save): about 2,670 to 4,090 characters** (inspect 180 to 300, decision 1,800 to 2,800, recovery 600 to 900, two registry lines about 90), which is 18 to 28 times the 147 free. **Preview only (Q4 option B): about 190 to 310.** Both need an owner capacity decision (decision-packet decision 1) or an offsetting removal. The new modules are outside any ratchet today; this spec proposes that TS §6.2 give `core/diagnostics`, `decisions/export` and `adapters/outside-fs` budget rows so that they cannot grow unchecked. The owner sets ceilings and budgets (Q5); this spec proposes no figure.

File-size cap: `verbs/recover-effects.ts` is 263 lines and the file cap for verbs and decisions is 265 (`tools/coverage.ts`), so the recovery handler goes in its own file with a one-line registration. `verbs/inspect.ts` (123 lines) has room.

Bundle size: the build adds to `plugin/kernel/tenet.mjs`. The latest figure on record is "772 KB of the unchanged 800 KB cap" (CHANGELOG, 2026-11-03, ENG-09 and RES-05 merge); this feature's addition is unmeasured (the author's guess is 8 to 14 KB).

## 7. Alternatives considered

| Option | What it does | Cost and limits |
|---|---|---|
| A. Preview view plus kernel save through `decide` (recommended) | As §5. The hash binds the saved bytes to the previewed bytes; the kernel validates the path and records the effect. | Largest central cost. Needs a work handle for the save. Does not make "the user asked" kernel-checkable (§1). |
| B. Preview view only; the host writes the file | `inspect --view export` returns the text. The coordinator writes it to the user's path with the host's own file tool, after the user agrees. | Smallest central cost, and the host's file-write approval shows the user the path and content in Manual mode. "Saved only to a chosen path" and "saved bytes equal the preview" rest on the coordinator and the host (cooperative, to be disclosed as such). The kernel cannot check that the saved bytes equal the preview. Also the only option for Windows today. |
| C. A front-end-only `tenet export` command | Builds the bundle in `frontends/cli.ts` or `main.ts`, which are outside the central budget. | Rejected: front-ends hold no logic and one pipeline runs every verb (`copilot-instructions.md`, checked by `lint-arch`). |
| D. Kernel writes to Tenet's temp folder and reports the path | Uses `Store.writeArtifact`; no new port; the user copies the file. | Meets the PRD's "a report file the user chooses to save" (§3 command table) but not Tech Spec §16's "chosen path". Lowest kernel-save cost, and the folder is swept by `cleanup`. |

**Recommendation: A**, because it is the mechanism Tech Spec §§4.3, 6.5, 7.4 and 16 already describe, and it is the only option where the kernel, not a model, ties the saved bytes to the previewed bytes. Neither A nor B makes the request itself kernel-checkable; the difference is only the byte binding and the path rules. If capacity is not granted, **B** is the smallest option that still gives redaction and preview inside the kernel; it must then be described as cooperative for saving. A and B share the preview, so building the preview first loses nothing under either choice.

## 8. State, compatibility and impact

- **No schema change and no stored field.** The bundle is derived. The only new durable record is the journal intent and result pair for the save (`LogRecord` already accepts any effect name).
- **Consumers affected.** `InspectInput` (one enum value; `lint-skills` builds example command lines from this schema, so any skill text naming the view must parse); `DECISIONS` registry; recovery dispatch (an unknown effect name stays unresolved today, so an old kernel reading a newer journal reports `effect-uncertain`, which is safe); the `Project` port, `wire.ts` and the test `portsWith` helper; `core/reasons.ts` and `tools/coverage.ts` (every reason code needs a test fixture); `inspect help` text; the Tech Spec §4.6 snippet (no change; `export` falls under the final `decide … : false` line) and §6.5 risk column; the coordinator skill and `/tenet feedback` wording if the owner wants the user-facing command (the coordinator skill is at 3,992 of 4,000 tokens, so a row there needs a matching removal; `tenet-intake` has room but does not own this command).
- **Attribution.** A save outside the project tree (Q3 option B) leaves the project inventory unchanged. A save inside it creates an untracked file that an active edit contract would see as a foreign change (`attribution-unexplained-change`).
- **ENG-09 coupling.** The export reads what the journal holds today (§2) and gains fields as they are added: each must get a validator in the allowlist before it is exported (§10).
- **Requirement mapping.** ENG-06 (Should) stays "omit" until Q1 is answered. NFR-07 changes status only under the tag rule of §4 and the answer to Q8.
- **UX Spec backfill.** The words of §5.6, the preview-block exception, and the Windows case (`ux-spec.md` §§3.2, 4.5, 5.2, 9).
- **Unobserved.** How a model or host handles the preview text, whether the coordinator shows it to the user in full, how a user chooses a path in the host UI, and token counts of a real bundle.

## 9. Owner questions

**Q1. The OpenTelemetry GenAI mapping (ENG-06).** What happens to it?
- A. Defer: the bundle uses Tenet's plain names; ENG-06 stays "omit" (recommended: the names cannot be checked from this repository, the PRD names no version, and applying a model-call attribute set to a Tenet verb call is a semantic stretch).
- B. Pin the newest stable release at implementation time, check every name against it, and add a mapping section to this spec before implementation.
- C. Pin the version current at the Tech Spec's approval date, found from history. Needs a date the Tech Spec does not state.

**Q2. May the save require a work handle?**
- A. Yes; with no contract at all, only the preview is available (recommended: no new central code, and an empty project has little to export).
- B. No; add a handle-free path to `decide`. Changes `verbs/decide.ts` and the `DecisionCtx` type that every decision uses.

**Q3. Where may the saved file go?**
- A. Anywhere under the project root that is not excluded and not under `.tenet/`. Uses the existing project port. Adds an untracked file to the working tree.
- B. Anywhere outside the project root and outside `.tenet/` (recommended: no effect on attribution, and the user can attach it directly). Needs the four port methods of §5.4.
- C. Either, with the user's path deciding.

**Q4. Preview only, or preview and kernel save?**
- A. Both (recommended; §7 option A).
- B. Preview only, host saves (§7 option B). Requires wording that says saving is cooperative.

**Q5. Central capacity and module budgets.** The cost in §6 needs decision-packet decision 1, or the owner names what to remove. The owner also decides whether TS §6.2 gets budget rows for the new modules (recommended: yes, so growth is checked). This spec proposes no figure.

**Q6. Monthly summaries.** Export the reduced monthly counts as well? Recommended: not in the first version; they are counts by verb and exit only, so they add little and need a store read method (`Store` has only `readLog`).

**Q7. New reason codes.** Add `export-preview-stale`, `export-target-refused` and `export-refused` (additive). Recommended: yes; no existing code names these refusals.

**Q8. What may NFR-07 claim? (PRD narrowing, AC-11.)** The kernel cannot tell who asked for an export or whether the preview was read (§1). NFR-07 says "exported only on user request, with the included content previewed", and AC-11 is never waivable.
- A. Narrow the PRD reading (recommended): "Diagnostics are built only by an explicit export request; the kernel binds the saved bytes to the previewed bytes and writes only a new file at the named path; that the user made the request and read the preview is cooperative, captured as `reported`, and disclosed." Adds the SEC-13 reading in DX-5: a chat question before the save under auto-approve or unknown approval mode, labeled advisory.
- B. Keep the PRD wording and treat the first four rows of §1 as the partial evidence. Leaves a never-waivable requirement with a claim the mechanism cannot support.
- C. Require a stronger control. None exists in the kernel; it would need a host signal for approval mode (SP-12), which is unobserved.

**Q9. Should the preview itself be gated?** `inspect --view export` is auto-approved and model-callable (§1).
- A. No; accept and disclose (recommended: read-only, appends nothing, holds no outcome text, path or output, and reaches the model no more sensitively than `inspect status`).
- B. Move the preview into `decide`, with a chat question, so a model cannot build it silently. The call would append a journal record, so the bundle must then exclude its own record, and the preview becomes a mutating call (Windows could not preview).

**Q10. UX Spec amendments.** Approve the wording of §5.6 as the basis for a UX Spec change: the preview framing sentence, the confirm question naming the destination, the refusal sentences, the Windows sentence, and an exception to `ux-spec.md` §4.5 ("code blocks are only for commands to copy") so that the previewed bundle can be shown as a block. The UX Spec owns the final text; this is a spec amendment that needs the owner. Recommended: yes.

## 10. Risks and assumptions

- **Redaction is a heuristic.** `redact` misses what it does not match. The primary control is the allowlist projection (DX-3); redaction is a second layer. The preview is the user's last check. The bundle must say "likely secrets removed", never "no secrets".
- **Redaction can refuse a harmless bundle.** A field name matching the credential-assignment pattern, with a long numeric value, is changed (§2). Names in §5.2 avoid the substrings; a future field must be checked against the whole-text test before it is added. Usage tokens (RSC-04) are the likely first case.
- **Journal fields written in future.** When ENG-09 adds fields, each must be added to the allowlist with a validator before it is exported. An unlisted field is dropped, so a new field is invisible rather than leaked (E3, E11).
- **Diagnostics on damaged state.** If the state cannot be read, the pipeline refuses before any read-only view runs (`pipeline.ts:107`, `fail`), so no bundle is produced. `inspect doctor` is the tool for that case. A bundle for a damaged store is out of this slice. When the document came from backup, `state.recovered` is true.
- **Hash race.** A second Tenet call between preview and confirmation, or recovery or reconciliation running inside the confirmation, makes the save refuse (E7, E7b). This is correct, and costs one more preview.
- **Path handling.** Write tests run on POSIX CI only; drive-letter and device-name handling for targets is unobserved. macOS links such as `/tmp` are refused with a cause (E14). Filesystems without hard links (exFAT, FAT, some network shares) are refused with a cause (E8c); the user's route is to copy the text.
- **The saved file is the user's.** Tenet cannot stop the user from attaching it anywhere. Only the preview is a check.
- **Assumption.** The coordinator relays the user's request truthfully and shows the whole preview. Both are cooperative and unobserved on a native host.

## 11. Acceptance criteria and gates

Before implementation: a second independent review with dispositions (§12 is the author's own pass and does not replace it); owner answers Q1 to Q10; owner sign-off; a decision on central capacity.

Implementation is red-first with E1 to E14. Done when: all examples pass; `npm run ci` passes (typecheck, `lint-arch`, `lint-skills`, `lint-quality`, coverage, bundle within budget, tests); the built bundle is driven on a scratch repository through preview, refusal and save, and the saved file is compared byte for byte with the preview (UAT, step 6 of the lifecycle); a planted-secret scan of the saved file finds nothing. Host behavior stays "unobserved" until a spike records it. `[NFR-07]` is added only when E1 to E10 all pass, and its comment states that "the user asked" is cooperative. Backfill: Tech Spec §6.5 (the `export` row and its Consequential class), §16 (the `t` typing, the closed vocabulary and `export-confirm`, and the OpenTelemetry pin if Q1 is B or C), §6.2 (module rows), the PRD data-model row, and the PRD wording of NFR-07 if Q8 is A; `ux-spec.md` per §8.

## 12. Review pass and dispositions

### 12.1 Author's pass (2026-11-03, before the independent review)

Method: re-read NFR-07 ("Diagnostics shall be redacted and exported only on user request, with the included content previewed"), ENG-06, SEC-11, PRD §3.8.8, §5.10.1 and Tech Spec §16 against §§3 to 5. This was a self-review; it did not meet lifecycle step 2.

| # | Finding | Disposition |
|---|---|---|
| 1 | NFR-07 says "exported only on user request". The first draft's flow let `decide` without a confirmation return a question, and that call appends a journal record, so the question's hash could never match the later bundle. | Fixed: preview moved to the read-only `inspect` view; `decide` without a matching answer is refused (§5.1, E6). |
| 2 | "Redacted": the first draft relied on `redact` alone. Its own header says it misses what it does not match. | Fixed: allowlist projection is the primary control (DX-3, E3); redaction is a second layer that refuses rather than edits (DX-4, E4b). |
| 3 | "Previewed": a preview of a different byte sequence than the one saved would not satisfy the clause. | Fixed: the saved bytes are bound to the previewed bytes by hash (DX-2, E5, E7). Under option B of Q4 this is not kernel-checkable; stated in §7. |
| 4 | Recovery runs before any request and cannot find a file from a path hash. | Fixed: the intent holds the path and the temporary file name; `op` bodies are excluded from every export (DX-3, E3). |
| 5 | The journal passthrough accepts any extra field; a hand-edited or future field could carry content into an export. | Fixed: unlisted fields are dropped and counted (DX-3, E3, E11). |
| 6 | ENG-06 requires "the pinned" subset, but no pin exists. | Open: Q1. The attribute list is withdrawn (§5.3). |
| 7 | `decide` needs a work handle, but Tech Spec §4.3 routes `/tenet feedback` through `decide` with no mention of one. | Open: Q2. Recorded as a spec defect in plan §12.3. |
| 8 | Recovery would add about 700 characters to `verbs/recover-effects.ts`, which is at 263 of 265 lines. | Fixed: recovery is a separate file with a one-line registration (§6). |
| 9 | NFR-07 is a Must at Beta with AC-11 (never waivable). A tag on a partial test would claim more than the evidence. | Fixed: tag rule in §4 and §11. |
| 10 | The PRD (§3 command table) says "only a report file the user chooses to save"; Tech Spec §16 says "a chosen path". | Open: option D in §7. |
| 11 | Windows refuses mutating verbs, so E5 to E9 cannot run on this host. | Accepted: stated in §2 and in the test file column. Preview examples run anywhere. |
| 12 | The "no wall-clock time" rule (DX-9) hides when the bundle was made. | Accepted: the recipient can read the newest `t` in `calls`. |
| 13 | AC-11 also forbids bundling an MCP server and requires telemetry off by default. | No change needed: the export adds no network code and no MCP surface; DX-1 and E10 cover "off by default". |
| 14 | `label` is a sequence label from `workLabel`, not derived from the request. | Fixed in §5.2; the citation was corrected again in the independent review (`core/ids.ts:21`, format `W-0007`). |

### 12.2 Independent review (2026-11-03)

[reviews/diagnostics-export-review.md](reviews/diagnostics-export-review.md): 22 findings (1 Blocker, 12 Major, 9 Minor). Every finding has a disposition in the table appended to that file. This revision changes §1 (claim strength table), DX-1, DX-2, DX-4 to DX-10, E3 to E14, §5.1 to §5.6, §6, §9 (Q1, Q3 to Q5 revised; Q8 to Q10 added) and §10. A second independent review of this revision is required.
