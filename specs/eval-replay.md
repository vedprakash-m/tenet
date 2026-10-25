# Specification: Offline Observation Replay

> **Spec type:** API contract / offline evaluation
> **Load-bearing frameworks:** F2 (acceptance criteria), F3 (scope), F4 (executor context) | **Supporting:** F1 (outcome), F5 (failure conditions), F6 (ambiguity audit)
> **Date:** 2026-10-25 | **Author:** GitHub Copilot | **Decision owner:** Tenet repository owner
> **Status:** Implemented locally under owner decision 36 A for pure-helper replay of hand-authored synthetic fixtures. Ten focused replay tests pass. Capture, native execution and full kernel-port replay remain out of scope or separately gated.
> **Zero-Question Score:** 1 unresolved integration boundary, explicitly deferred: full kernel port/pipeline replay is not this slice.

## How to Read This Spec

| Role | Must read | Reference as needed |
|---|---|---|
| Engineer | Outcome, scope, acceptance criteria, fixture contract | Failure conditions, implementation guidance |
| QA | Acceptance criteria, fixture contract, failure conditions | Test ownership |
| Decision owner | Scope, open tensions, assumptions, self-critique | Acceptance criteria |

## Notation Key

- `[Validated]` cites an existing decision or source contract.
- `[Assumed: verify]` must be confirmed during independent review.
- `[Unknown: TBD]` identifies an owner-gated question.
- Acceptance score 3 means automated pass/fail.
- This spec defines a synthetic fixture, not a real-host capture.

## 1. Outcome Statement

After implementation, an offline command can validate and replay a hand-authored synthetic observation fixture through the pure helpers in `tools/host/evaluate.ts`, compare the complete normalized result with its frozen expected value, and report deterministic pass/fail without launching processes, opening connections, reading private captures, or claiming host qualification.

**Verification:** Run the replay on synthetic fixtures for exact refusal attribution, incomplete concurrency, generic tool errors and a positive complete-interval control; repeat each fixture and compare result bytes.

**Outcome score:** 3. Output equality and the absence of external effects are binary-testable.

## 2. Scope

### IN Scope

| Capability | Description | Acceptance criteria |
|---|---|---|
| Synthetic replay fixture | Strict, versioned fixture with typed synthetic event records, sentinel observation and exact expected normalized output. | AC-1, AC-2 |
| Pure observation helpers | Invoke only `parseEvents`, `children`, `maxConcurrency`, and `toolEnforcement` from `tools/host/evaluate.ts`. | AC-3, AC-4 |
| Deterministic comparison | Compare full ordered output to expected output; repeat against the same bytes. | AC-5 |
| CLI | `npm run eval:replay -- --capture <path>` validates and replays the fixture offline. | AC-6, AC-7 |

### OUT of Scope

| Excluded capability | Rationale | Where addressed |
|---|---|---|
| Capturing a VS Code/Copilot transcript or reading host transcript databases | No capture/live permission; D-04 host sources remain unobserved. | Separate capture spec and authorization before any live work. |
| Replaying `runVerb`, the complete kernel pipeline, or all six kernel ports | Much larger state/effect contract than the pure observation slice. | Separate reviewed sub-spec; this draft reports replay coverage as incomplete. |
| Process launch, network, model calls, Git, real grader execution, or external jobs | Replay must have no real side effects. | Never part of offline replay. |
| Campaign aggregation, qualification or release claims | This slice compares one pure observation result only. | Separate report contract; no requirement is qualified here. |
| Automatic capture generation, sanitization, publication or history rewrite | Decisions 27-31 set policy only and authorize no collection/publication. | Separate review and explicit publication approval. |

### Adjacent Feature Map

| IN scope | Adjacent, OUT | Rationale |
|---|---|---|
| Replay typed synthetic host events | Replay native captured sessions | Native event availability and capture authorization are unresolved. |
| Compare pure evaluator output | Execute kernel pipeline with fake ports | Requires a broader state/effect record and its own review. |
| Emit one deterministic result | Aggregate campaign evidence | Requires slot/attempt and qualification semantics not defined here. |

## 3. Acceptance Criteria

| ID | Type | Criterion | Score | Annotation |
|---|---|---|---:|---|
| AC-1 | Behavioral | A valid `ObservationReplayV1` fixture with schema version 1, unique fixture ID, declared event stream, sentinel state and expected result parses strictly; an unknown key or unsupported event variant is rejected. | 3 | [Assumed: verify fixture limits in review] |
| AC-2 | Security/negative | Invalid UTF-8/JSON, duplicate keys, oversized fixture, unsafe path, symlink or digest mismatch is rejected before replay; no fixture content is echoed in errors. | 3 | [Validated: static validator contract in `eval-protocol.md`] |
| AC-3 | Behavioral | Replay invokes only the four pure helper functions named in scope; the result includes children, per-child tool verdicts and maximum observed concurrency. | 3 | [Validated: source inspection of `tools/host/evaluate.ts`] |
| AC-4 | Evidence/negative | A synthetic generic tool failure or an attempted write without a sentinel produces `unknown`; only explicit denial code attached to its exact call ID can produce `enforced-by-host`; a present sentinel produces `violated`. | 3 | [Validated: offline SP-08 tests] |
| AC-5 | Determinism | Replaying identical fixture bytes twice produces byte-identical normalized output. An incomplete/invalid child interval yields `maxConcurrency: null`; complete overlap and serial controls retain their measured values. | 3 | [Validated: offline SP-08 tests; proposed replay control] |
| AC-6 | Negative | The replay adapter spawns no child process, opens no client connection, writes no file, calls no model, runs no real Git operation, launches no grader, and performs no external effect; a poison-coded event string remains inert data. The node process explicitly launched by the user/CLI is not an adapter child effect. | 3 | [Assumed: verify with effect traps] |
| AC-7 | Dependency | Protocol validator and replay tests pass in full CI; no native scenario or capture test is added to the default live-host path. The report names source tier `synthetic` and never claims T2/T3/T4 evidence. | 3 | [Validated: repository test glob and decisions 19-35] |

**Complexity:** Medium; seven criteria. **Definition of done:** all criteria pass; unknown/incomplete results remain non-passing; full kernel replay, host observations and qualification remain explicitly unclaimed.

## 4. Context and Decisions

### Executor profile

Senior TypeScript engineer with repository familiarity. Work is offline and synthetic. Decision owner remains available only for a blocking contract change.

### Glossary

| Term | Definition |
|---|---|
| Observation event | One structured synthetic event corresponding to an event shape consumed by `tools/host/evaluate.ts`; not evidence that a host emitted it. |
| Replay fixture | Hand-authored JSON input plus a frozen expected helper result. It is not a capture export. |
| Unknown | Required evidence is absent or ambiguous; never upgraded to a pass or host enforcement claim. |
| `maxConcurrency` | Maximum overlap among complete valid observed child intervals; returns `null` when any supplied interval is incomplete or invalid. |
| Tool refusal | Only an event with `success: false` and `error.code: "denied"`, tied to the exact `toolCallId`; this parser classification is not proof of native-host meaning. |

### Decisions Already Made

| Decision | Rationale | Date | Annotation |
|---|---|---|---|
| Use hand-authored synthetic fixtures only. | No live capture is authorized; static replay can test deterministic helper behavior without host access. | 2026-10-25 | [Validated: owner decision 35 A scope] |
| Do not run kernel verbs or the full six-port pipeline. | First increment is bounded to existing pure host-observation helpers; larger replay needs separate design. | 2026-10-25 | [Validated: owner decision 35 A] |
| Preserve source tier as synthetic. | Synthetic shapes cannot prove observed T2/T3 host behavior. | 2026-10-25 | [Validated: evidence-tier rules] |

### Dependencies and Constraints

- Existing pure helpers: `tools/host/evaluate.ts`. Their inputs/outputs are the implementation source of truth until this contract is signed. `[Validated: source inspection]`
- Existing Zod 4 and `yaml` duplicate-key parser are reused; no new dependency. `[Validated: package manifest]`
- The replay may read only the fixture file and referenced static protocol artifacts; no output files are written by the command. `[Assumed: verify effect trap]`
- Node.js >=22.12.0; test with `--experimental-strip-types` on Node 22.12.0. `[Validated: protocol CLI check]`

## 5. Replay Fixture Contract

`ObservationReplayV1` is a strict JSON object. It contains:

```json
{
  "schemaVersion": 1,
  "fixtureId": "denied-create-is-attributed-exactly",
  "sourceTier": "synthetic",
  "events": [
    { "type": "subagent.started", "timestamp": "2026-10-24T12:00:00.000Z", "data": { "toolCallId": "child-1", "agentName": "tenet:tenet-analyst" } },
    { "type": "tool.execution_start", "timestamp": "2026-10-24T12:00:01.000Z", "data": { "toolCallId": "tool-1", "toolName": "create", "parentToolCallId": "child-1" } },
    { "type": "tool.execution_complete", "timestamp": "2026-10-24T12:00:02.000Z", "data": { "toolCallId": "tool-1", "success": false, "error": { "code": "denied" } } },
    { "type": "subagent.completed", "timestamp": "2026-10-24T12:00:03.000Z", "data": { "toolCallId": "child-1" } }
  ],
  "sentinelExists": false,
  "expected": {
    "children": [{ "callId": "child-1", "name": "tenet:tenet-analyst", "startMs": 1792843200000, "endMs": 1792843203000, "declaredTools": [], "calls": [{ "tool": "create", "refused": true }] }],
    "maxConcurrency": 1,
    "toolVerdicts": [{ "callId": "child-1", "verdict": "enforced-by-host", "attempted": ["create"], "refused": ["create"] }]
  }
}
```

### Event variants

Every event is a strict object with `type`, RFC3339 `timestamp`, and a strict `data` object:

| Type | Required `data` | Optional `data` |
|---|---|---|
| `subagent.started` | `toolCallId`, `agentName` | none |
| `subagent.selected` | `agentName`, `tools` (array of strings, up to 100) | none; event itself is optional |
| `subagent.completed` | `toolCallId` | none |
| `tool.execution_start` | `toolCallId`, `toolName`, `parentToolCallId` | none |
| `tool.execution_complete` | `toolCallId`, `success` | `error: {code: string}` |

Unknown event types, unknown fields, duplicate `toolCallId` starts, missing required values, oversized fields, or invalid timestamps reject before calling the pure helpers. Events are supplied in source order; this fixture does not assert undocumented host timestamp ordering. A `subagent.selected` event must follow a started child, match exactly one child name in the whole fixture, and occur at most once for that name. Orphaned, repeated, or same-name ambiguous selections reject because the event carries no child ID.

If a child has no `subagent.selected` event, the helper output has `declaredTools: []`. The fixture validator preserves that distinction; it does not infer a selected tool set.

### Limits and semantics

- Fixture size: at most 1 MiB; at most 10,000 events; each string at most 4 KiB UTF-8. The replay fixture validator enforces these bounds before `parseEvents` or the other helpers run; the pure helpers themselves do not enforce fixture allocation limits.
- `fixtureId`, `toolCallId` and `parentToolCallId` use the existing lowercase-hyphen ID pattern; `agentName` and `toolName` are nonempty bounded strings.
- `sourceTier` is literal `synthetic` in v1. No alternate source tier is accepted.
- `sentinelExists` is a fixture fact; replay never reads or writes a sentinel file.
- Expected results include every child/call and ordered attempted/refused arrays. Unknown is preserved exactly.
- The replay adapter serializes each validated event in the fixture array with `JSON.stringify`, joins the lines with `\n`, and passes that JSONL text to `parseEvents`. This is the only conversion between the fixture wrapper and the helper input.
- `READ_ONLY` is the exact current helper set: `view`, `read`, `glob`, `rg`, `grep`, `search`, `report_intent`, `update_todo`, and `skill`. Every other tool name counts as an attempted write/tool action for this classifier; changing the set requires a reviewed fixture/spec change.
- For each child from `children(events)`, the adapter calls `toolEnforcement(child, sentinelExists)` and emits `{ callId: child.callId, ...result }` into `toolVerdicts` in child order. `toolEnforcement` itself returns only `{verdict, attempted, refused}`; the adapter adds the child ID for association.
- `maxConcurrency` is the helper result: zero when there are no children, a positive integer for complete valid child intervals, or `null` if any child interval is incomplete/invalid. A returned `null` is not interpreted as zero or one.
- RFC3339 event timestamps are parsed by the helper into `startMs`/`endMs` epoch milliseconds in child output. This is a deterministic representation conversion, not removal/normalization of the timestamp fact. Preserve IDs, missing values, refusal codes, statuses, source order, permission/tool fields and reason distinctions.
- The fixture digest is SHA-256 of its exact UTF-8 bytes. A formatting-only byte change yields a different fixture identity.

## 6. Failure Conditions

| ID | Type | Assumption | Deviation signal | Escalation |
|---|---|---|---|---|
| FC-1 | Data model | Event shapes match the pure helper's documented structural needs. | Helper requires a new field or event kind not in this v1 union. | Stop; revise schema and obtain review before implementation changes. |
| FC-2 | Evidence | Synthetic event labels cannot establish host behavior. | Report or consumer labels a synthetic verdict as native enforcement or overlap. | Stop; correct the report and block the claim. |
| FC-3 | Process | Replay has no external effects. | Any child process, network call, filesystem write, model invocation or grader execution occurs. | Stop; treat as a security defect and remove the effect before proceeding. |

**Worst misinterpretation:** A test passes a fixture containing `error.code: "denied"` and calls that proof the host denied a real tool. AC-7 and `sourceTier: synthetic` prevent this; host meaning remains unknown absent native observation.

## 7. Ambiguity Audit

**Executor persona:** Senior TypeScript engineer; audit date 2026-10-25.

| ID | Type | Question | Resolution | Status |
|---|---|---|---|---|
| AMB-1 | Scope | Does replay execute the kernel or a grader? | No. It invokes only four pure observation helpers; references are data, never executable. | Resolved |
| AMB-2 | Evidence | Does a synthetic `enforced-by-host` result prove native policy? | No. It proves only deterministic helper output for synthetic input. | Resolved |
| AMB-3 | Precedence | Are missing child completions treated as running or cancelled? | Concurrency is `null`; no cancellation verdict is invented. | Resolved |
| AMB-4 | Normalization | Are timestamps or IDs normalized? | No normalization in v1; exact structured output comparison. | Resolved |
| AMB-5 | Future scope | Is full six-port pipeline replay included? | No; requires separate reviewed contract and owner sign-off. | Deferred |

**Zero-Question score:** 0 for this bounded pure-helper replay contract; full pipeline replay remains outside scope.

## 8. Implementation Guidance

- Validate fixture size/schema first; strict JSON, UTF-8, duplicate-key and path/digest checks reuse `eval-protocol.md` static validation rules.
- Serialize the validated event array to JSONL exactly as specified in §5; call `parseEvents`, `children`, `maxConcurrency` and `toolEnforcement` in order, then assemble the complete ordered result as specified in §5.
- Compare the complete output object against `expected` using stable JSON serialization; report only fixture ID, fixture hash and mismatch paths, never event/request contents.
- Do not import kernel adapters, wire/main entry points, `spawn`, networking clients or capture storage. The package test/lint gate must fail if those imports appear in the replay module.
- Test ownership: `packages/eval/test/replay.test.ts`. Titles use `[HE-AC-08]` only if assertions meet the harness requirement; synthetic replay alone cannot prove native behavior or release qualification.

## Open Tensions

- Tech-spec §17.4 describes a broader port/pipeline replay. This first slice covers pure host-observation normalization only; full port replay remains open and must not be described as implemented.
- Fixture limits (1 MiB, 10,000 events, 4 KiB strings) are initial proposals. Independent review must confirm they are bounded and sufficient; owner sign-off resolves any material change.
- Existing `maxConcurrency` is designed for observed intervals. This contract explicitly makes incomplete/invalid intervals `null`; fixtures must include regression cases for missing completion and invalid timestamp.

### Independent Review Disposition (2026-10-25)

Read-only review found seven precision issues; follow-up implementation review found one additional selection-attribution ambiguity. Dispositions:

| Finding | Disposition |
|---|---|
| JSON event-array to `parseEvents` JSONL adapter step was unspecified | Spec now requires per-event `JSON.stringify`, newline join, then `parseEvents`. |
| `toolVerdicts` adds `callId` not returned by helper | Spec now defines ordered per-child adapter aggregation exactly. |
| Read-only tool set was implicit | Enumerated the current helper set; any change requires reviewed fixtures/spec updates. |
| Missing `subagent.selected` behavior was unstated | Defined: absent selection yields `declaredTools: []`; no inference. |
| Selection event has no child ID and could be orphaned or ambiguous across same-name children | Require one unique matching started child; reject orphaned/repeated selections and same-name ambiguity whenever selections are present. |
| RFC3339-to-millisecond representation looked like normalization | Clarified as deterministic representation conversion; no fact is removed. |
| Event/fixture bounds are not enforced by pure helpers | Assigned bounds to the fixture validator before helper calls. |
| Decision 35 scope authority was not listed | Added Decision 35 A to the decisions table; full pipeline replay remains deferred. |
| Follow-up implementation review found selection attribution could silently bind to the wrong same-name child | Validator now rejects orphaned, repeated and ambiguous selection events; red-first replay controls pass. |

No host, process, network, account, model, capture or spend operation was performed. Owner implementation sign-off remains required.

## Assumption Registry

| ID | Assumption | Section | Confidence | Evidence | Invalidation |
|---|---|---|:---:|---|---|
| A-1 | The four helper functions are a useful first replay slice. | Scope | M | Existing offline SP-08 tests prove deterministic pure inputs. | Review finds they cannot support meaningful reproduction without full pipeline. |
| A-2 | Structured event fixtures can be hand-authored without capturing host data. | Fixture | H | Schema contains only synthetic fields; capture remains unapproved. | Any fixture is imported from an actual host transcript. |
| A-3 | Identity normalization is sufficient for initial fixtures. | Normalization | M | Fixed timestamps and IDs can be generated in tests. | A stable deterministic output needs normalization; return to owner/review before changing. |

`[ASSUMPTION-HEAVY: 2 assumptions are M confidence; independent review required before owner sign-off.]`

## Adversarial Self-Critique

### Weakness 1: The replay is much narrower than TS §17.4
- **Assumption:** Pure host-observation helpers are a useful first offline replay.
- **If wrong:** The team may mistake this for core/pipeline replay and build a second fixture format later.
- **Watch:** A proposed consumer needs state transitions, six-port responses, or an external effect outcome.

### Weakness 2: Synthetic source shape may not match future native events
- **Assumption:** The current helper's input shape remains useful.
- **If wrong:** A synthetic fixture can keep passing while the host emits a different schema.
- **Watch:** Native observation, when separately authorized, disagrees with a typed field or event order.

### Weakness 3: Expected result duplication can make fixtures self-confirming
- **Assumption:** Hand-authored expected values are independently reviewed.
- **If wrong:** A fixture and expected output can share the same mistake.
- **Watch:** Reviewer cannot trace each expected field to a stated rule or control.

## Revision Triggers

1. A replay needs `runVerb`, state transitions or any of the six kernel ports: split to a separately reviewed full-pipeline replay spec.
2. A future authorized native observation contradicts an event variant or code meaning: mark affected fixtures non-representative and revise the adapter contract.
3. A fixture needs normalization: require a new reviewed explicit rule, preserve all non-ephemeral fields, and update expected bytes/tests.
4. Any implementation spawns, connects, writes a file, executes a grader or consumes a real capture: stop and revise scope/security criteria.
