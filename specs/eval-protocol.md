# Specification: Offline Evaluation Protocol Validation

> **Spec type:** API contract / offline validation
> **Load-bearing frameworks:** F2 (acceptance criteria), F3 (scope), F4 (executor context) | **Supporting:** F1 (outcome), F5 (failure conditions), F6 (ambiguity audit)
> **Date:** 2026-10-25 | **Author:** GitHub Copilot | **Decision owner:** Tenet repository owner
> **Status:** Static offline implementation completed locally under owner Decision 34 A; focused protocol tests pass on Node 26.3.0 and Node 22.12.0. Final-tree CI passes. Native execution and trusted authorization remain out of scope.
> **Zero-Question Score:** 1 open question remains: authorization trust is deferred to a separate contract and is not needed for this static validator. The duplicate-key parser choice is resolved below using the existing `yaml` dependency.

## How to Read This Spec

| Role | Must read | Reference as needed |
|---|---|---|
| Engineer | Outcome, scope, AC, contract, implementation guidance | Failure conditions, open tensions |
| QA | AC and test ownership | Contract examples, failure conditions |
| Decision owner | Outcome, scope tensions, deferred decisions, self-critique | Acceptance criteria |

## Notation Key

- `[Validated]` means an existing canonical rule or code contract is named.
- `[Assumed: verify]` means the independent review must check it before implementation sign-off.
- `[Unknown: TBD]` means implementation must not proceed on that point until the named owner resolves it.
- AC score 3 means automated binary pass/fail.
- H/M/L describe confidence: high (>70%), medium (40-70%), low (<40%).

## 1. Outcome Statement

After this spec is implemented, a maintainer can validate a versioned offline protocol document and its referenced fixture/grader bytes without launching a subject, model, grader, shell command, network request, or live host; the validator reports the exact protocol-byte hash and either a strict validation result or bounded errors.

**Verification:** Run the offline validator on valid and adversarial scratch documents; verify the result and artifact hashes, and prove no process/network/model action occurs.

**Outcome score:** 3. The result is deterministic, observable, and testable without host access.

## 2. Scope

### IN Scope

| Capability | Description | Acceptance criteria |
|---|---|---|
| Static protocol parsing | Validate the `StaticProtocolV1` shape with strict Zod schemas and reject unsupported fields/versions. | AC-1, AC-2 |
| Tuple and evidence references | Reuse the exact PRD Section 2.2 qualification tuple field set; require a provenance entry for each top-level tuple field. | AC-3 |
| Local artifact binding | Resolve safe relative file references below the declared protocol root, reject links/non-files, and compare exact-byte SHA-256 digests. | AC-4 |
| Offline CLI result | `npm run eval:validate -- --protocol <path>` reports protocol validity and exact raw-byte digest; it performs no execution. | AC-5, AC-6 |

### OUT of Scope

| Excluded capability | Rationale | Where addressed |
|---|---|---|
| Authorization file trust, owner authentication, provider spend enforcement, or live-run permission | A parsed field cannot prove owner approval or enforce account/host policy. Existing D-02/D-03/D-07 gates remain open. | Separate authorization contract before any execution implementation. |
| Native UI, model calls, shell commands, grader execution, replay execution, capture, and CI credentials | Decision 32 A permits offline validation only in this first slice. | Later reviewed specs and separate G1/G2/G3 approvals. |
| Complete campaign scheduling (arms, strata, repetitions, retry policy, invalid-run adjudication) | These need a reviewed executable protocol contract; this static descriptor cannot be treated as executable. | A later protocol revision/spec. |
| Publishing or modifying fixture/grader files | Validation is read-only. | Separate publication decision and review. |

### Scope Dependencies

- The existing tuple schema in `tools/coverage.ts` is currently private to that module. Implementation must extract/reuse it without changing its field semantics, or the independent reviewer must approve an alternative that cannot drift. `[Assumed: verify]`
- Fixture path checks should match or strengthen existing guards in `tools/eval-validate.ts`; they must not import its CLI side effects. `[Validated: source inspection]`

### Adjacent Feature Map

| IN scope | Adjacent, OUT | Reason |
|---|---|---|
| Parse a protocol document | Accept an execution authorization | Parsing cannot establish trusted origin or grant authority. |
| Verify referenced bytes | Execute a referenced grader | A grader is untrusted code for this slice and is never launched. |
| Validate tuple structure | Observe or qualify a real host tuple | No host observations or qualification follow from static validation. |

## 3. Acceptance Criteria

| ID | Type | Criterion | Score | Annotation |
|---|---|---|---:|---|
| AC-1 | Behavioral | Given a `StaticProtocolV1` JSON document with every required field, the validator returns a typed result and SHA-256 of the exact UTF-8 input bytes; a whitespace-only byte change changes that digest. | 3 | [Assumed: verify raw-byte identity in review] |
| AC-2 | Negative | Unknown keys at every fixed-schema object, duplicate IDs, unsupported schema versions, invalid UTF-8, malformed JSON, or a duplicate JSON object key are rejected before any artifact is opened. | 3 | [Assumed: strict parser mechanism needs review] |
| AC-3 | Behavioral | The tuple uses exactly the current PRD §2.2 field set and corresponding `tools/coverage.ts` schema; every tuple field has exactly one source record (`observed`, `documented`, or `unknown`). `unknown` has no source reference; the other states require one. | 3 | [Validated: PRD tuple and tech-spec provenance rule; verify exact reuse] |
| AC-4 | Security/edge | Every fixture/grader reference is a safe POSIX relative path beneath the protocol root, each component is inspected without following symlinks, the final entry is a regular file, and its SHA-256 over raw bytes matches. `protectedPaths` receive the same syntax check but need not exist. Traversal, absolute/drive/UNC paths, backslashes, NUL, links, non-files, missing fixture/grader files, and digest mismatch fail closed. | 3 | [Validated: existing golden-task path safeguards; extend to all components] |
| AC-5 | Negative | The CLI reads only the protocol and declared artifact files; it does not spawn child processes, open network connections, invoke graders/models, write files, or treat validity as execution authorization. | 3 | [Validated: Decision 32 A scope] |
| AC-6 | Edge | Usage errors exit 1; malformed, unsupported, unsafe, or hash-mismatched input exits 2; a structurally valid document exits 0. Standard output contains only the protocol ID and exact protocol hash on success; errors are bounded and do not echo request contents. | 3 | [Validated: harness §7.4 exit contract; output restriction proposed] |
| AC-7 | Dependency | Full CI proves schema tests, path/hash controls, CLI exit behavior, and the existing golden-task suite all pass; no native/live test is invoked by the default command. | 3 | [Validated: repo CI glob and Decision 32 A] |

**Complexity:** Medium; seven criteria. **Definition of done:** every criterion passes, all ambiguities in §6 are resolved or remain explicitly outside this slice, and owner signs this spec after independent review. Passing static validation never passes HE-AC-01 as a whole, G1/G2, or a qualification gate.

### Contract: `StaticProtocolV1`

All fixed-schema objects below are strict: unknown keys reject. `featureSettings` and `toolchainVersions` are maps with string keys; `featureSettings` values are JSON values and `toolchainVersions` values are strings. Integer fields are positive safe integers unless noted. IDs use `^[a-z0-9]+(-[a-z0-9]+)*$`; hashes use 64 lowercase hexadecimal characters. Document and referenced-file encodings are strict UTF-8. The document is at most 1 MiB; each referenced file is at most 10 MiB. Request text is at most 65,536 UTF-8 bytes; tuple-source references and artifact paths are at most 512 UTF-8 bytes each. `[Assumed: verify these input bounds during independent review.]`

```json
{
  "schemaVersion": 1,
  "protocolId": "example-case",
  "revision": 1,
  "purpose": "formative",
  "subject": { "artifactSha256": "<64 lowercase hex>" },
  "qualificationTuple": {
    "vscodeVersion": "<string>",
    "copilotChatExtensionVersion": "<string>",
    "agentHarness": "<string>",
    "pluginFormatVersion": "<string>",
    "installPath": "<string>",
    "featureSettings": {},
    "copilotPlan": "<string>",
    "organizationPolicyProfile": "<string>",
    "osVersion": "<string>",
    "architecture": "<string>",
    "executionTarget": "<string>",
    "workspaceMode": "<string>",
    "recipeVersion": "<string>",
    "toolchainVersions": {}
  },
  "tupleSources": {
    "vscodeVersion": { "status": "unknown", "reference": null },
    "copilotChatExtensionVersion": { "status": "unknown", "reference": null },
    "agentHarness": { "status": "unknown", "reference": null },
    "pluginFormatVersion": { "status": "unknown", "reference": null },
    "installPath": { "status": "unknown", "reference": null },
    "featureSettings": { "status": "unknown", "reference": null },
    "copilotPlan": { "status": "unknown", "reference": null },
    "organizationPolicyProfile": { "status": "unknown", "reference": null },
    "osVersion": { "status": "unknown", "reference": null },
    "architecture": { "status": "unknown", "reference": null },
    "executionTarget": { "status": "unknown", "reference": null },
    "workspaceMode": { "status": "unknown", "reference": null },
    "recipeVersion": { "status": "unknown", "reference": null },
    "toolchainVersions": { "status": "unknown", "reference": null }
  },
  "cases": [{
    "caseId": "example-case",
    "request": "Synthetic request text",
    "fixtureRefs": [{ "path": "fixtures/input.json", "sha256": "<64 lowercase hex>" }],
    "graderRefs": [{ "path": "graders/acceptance.mjs", "sha256": "<64 lowercase hex>" }],
    "expected": { "endpoint": "findings-only", "scope": "working-tree-uncommitted" },
    "protectedPaths": ["src/locked.ts"],
    "requiredObservations": [{ "id": "clean-result", "source": "grader", "required": true }]
  }]
}
```

Schema rules:

- `schemaVersion` is literal `1`; `purpose` is `formative` or `qualification` (intent only, not status). `subject` is a strict object with exactly one field: `artifactSha256`. This is a declared digest only; v1 has no subject-byte reference, so static validation does not verify the subject payload. Later admission must bind the installed payload before launch.
- `qualificationTuple` is exactly the current PRD §2.2 / `tools/coverage.ts` tuple shape: `vscodeVersion`, `copilotChatExtensionVersion`, `agentHarness`, `pluginFormatVersion`, `installPath`, `featureSettings`, `copilotPlan`, `organizationPolicyProfile`, `osVersion`, `architecture`, `executionTarget`, `workspaceMode`, `recipeVersion`, and `toolchainVersions`. `tupleSources` is a strict object with exactly those top-level keys. Its `observed`/`documented`/`unknown` provenance vocabulary applies only to tuple fields; it is distinct from required-observation `source` values. `reference` is at most 512 UTF-8 bytes. A value marked `unknown` never becomes an observation.
- `cases` contains 1-40 entries with unique `caseId`. `request` is synthetic text at most 65,536 UTF-8 bytes. Fixture and grader reference arrays are nonempty and contain unique safe paths. `protectedPaths` may be empty; otherwise paths are unique safe relative paths; validation does not require them to exist. Expected endpoint values are `blocked`, `findings-only`, `implemented-unverified`, `checked-local`, `prototype`; scope values are `committed`, `working-tree-uncommitted`, `working-tree-with-your-edits`, matching `packages/kernel/src/core/schemas.ts`.
- Required observation `source` is one of `driver-ui`, `documented-export`, `kernel-response`, `filesystem-monitor`, `grader`, `subject-report`. This source vocabulary is distinct from tuple provenance. IDs are unique within a case. This is a declaration only; static validation does not assert that an observation occurred.
- Protocol identity is SHA-256 over the exact original UTF-8 bytes, including whitespace and final newline; it is not a semantic/canonical JSON digest. Any byte change produces a new identity.
- Paths use `/` separators, are relative to the protocol file's parent, and contain no empty, `.`, `..`, drive, UNC, backslash, colon, NUL, trailing-dot, or trailing-space components. Resolve and inspect each component without following symlinks; final files must be regular files below the same root. Compare exact bytes, not decoded text, for referenced-file hashes.

`ExecutionAuthorization` is deliberately not defined here. A valid `StaticProtocolV1` is not approved, executable, or evidence of an observed tuple. A later authorization contract must bind trusted provenance, case scope, limits, account/terms controls, and expiry before any action; it cannot be inferred from a JSON field.

### CLI and result

`npm run eval:validate -- --protocol <path>` invokes static protocol validation only. Invalid/missing protocol is non-passing. It never accepts `--authorization`, a candidate-supplied file, or a command/action list. An optional future validation-only mode may inspect an authorization document after a separate contract is approved, but may not permit execution.

Success emits `{ protocolId, protocolSha256, caseCount, result: "valid-static-protocol" }`. It must not emit a label such as `approved`, `authorized`, `admitted-for-run`, `qualified`, or `supported`. Invalid output includes bounded field/path error codes, not request text or file contents.

## 4. Context and Decisions

### Executor profile

Senior TypeScript engineer with high codebase familiarity; independent reviewer has read-only access. No host, account, capture, network, or spend permissions are part of this contract.

### Glossary

| Term | Definition |
|---|---|
| Static validation | Parsing, shape checks, relative-path admission, and byte-digest comparison only; it does not run a subject or grant authority. |
| Protocol identity | SHA-256 digest of the exact original protocol bytes. |
| Qualification tuple | The exact PRD §2.2 dimensions, represented by the existing strict tuple schema in `tools/coverage.ts`. |
| Source record | For each tuple dimension, whether it is observed, documented, or unknown, plus a reference where applicable. |
| Reference file | A local fixture or grader file named by safe relative path and exact-byte SHA-256. |

### Decisions already made

| Decision | Rationale | Date | Annotation |
|---|---|---|---|
| Use strict schema version 1 and reject unknown fields. | Protocol files are future inputs to trusted evaluation; silent interpretation would be unsafe. | 2026-10-25 | [Validated: harness §7.4; Decision 32 A scope] |
| Hash exact input bytes. | Avoid hidden canonicalization and make any edit invalidate identity. | 2026-10-25 | [Assumed: verify in review] |
| Static validation never authorizes execution. | Owner has not approved native execution, and source JSON cannot establish trusted approval. | 2026-10-25 | [Validated: Decision 32 A; harness D-02/D-03/D-07 remain gated] |

### Dependencies and constraints

- Node.js >=22.12.0; TypeScript strict; Zod 4 is already installed. `[Validated: package.json]`
- Existing endpoint/scope enums are in `packages/kernel/src/core/schemas.ts`; the tuple schema is in `tools/coverage.ts`. Reuse/extract without semantic drift. `[Validated: source inspection]`
- Existing root CI runs `packages/**/test/**/*.test.ts`; a new `packages/eval/test` would be included. No native test path or live environment is added. `[Validated: package.json and harness §7.10]`
- Implementation must not change kernel core, plugin payload, runtime verbs, verdicts, budgets, or published claims. `[Validated: Decision 32 A]`

### Stakeholders

| Role | Owner | Authority |
|---|---|---|
| Decision owner | Tenet repository owner | Signs this spec and resolves any scope changes. |
| Technical reviewer | Independent reviewer designated by owner | Reviews contract consistency; cannot approve implementation or live use. |
| Executor | Maintainer/engineer | Implements only after the spec is signed. |

## 5. Failure Conditions

| ID | Type | Assumption | Deviation signal | Escalation |
|---|---|---|---|---|
| FC-1 | Data model | Existing tuple schema is the canonical PRD §2.2 field set. | A field is added/removed/renamed in the PRD or `tools/coverage.ts` without corresponding protocol update. | Stop implementation; reconcile the shared tuple schema and rerun independent review. |
| FC-2 | Authorization | Static validation cannot prove who wrote or approved a file. | A consumer attempts to use `valid-static-protocol` as execution permission. | Stop; reject that integration and require a separately reviewed authorization design. |
| FC-3 | Parser | Inputs can be safely interpreted as unique-key JSON. | Duplicate keys, malformed UTF-8, or alternate parser behavior is accepted. | Stop; select a strict JSON parser and add duplicate-key controls before implementation sign-off. |

**Worst misinterpretation:** An executor treats a validated protocol as permission to launch its prompt or grader. AC-5 and CLI result naming explicitly prohibit this; any code path reaching a process/model adapter fails review.

## 6. Ambiguity Audit

**Executor persona:** Senior engineer with repository context; audit date 2026-10-25.

| ID | Type | Question | Resolution | Status |
|---|---|---|---|---|
| AMB-1 | Definitional | Does validation mean authorization? | No. It only proves the static document shape and referenced bytes; output uses `valid-static-protocol`. | Resolved |
| AMB-2 | Temporal | Does whitespace change protocol identity? | Yes. Hash exact original bytes, including whitespace. | Resolved |
| AMB-3 | Precedence | Which tuple field set wins if helper and PRD diverge? | PRD §2.2 owns meaning; update/extract the helper and block until in sync. | Resolved |
| AMB-4 | Behavioral | Are malformed/unknown fields dropped? | No. Strict objects reject them. | Resolved |
| AMB-5 | Ownership | What proves an authorization file was approved by the owner? | This static validator does not accept execution authorization; the repository owner must approve a separate trust/provenance contract before any action. | Deferred to that contract; owner gate before execution |
| AMB-6 | Definitional | Which JSON-only parser rejects duplicate keys and invalid UTF-8? | Use fatal UTF-8 decoding, native `JSON.parse` for JSON grammar, then `yaml` `parseDocument` with `schema: "json"` and `uniqueKeys: true` solely to detect duplicate keys. A focused experiment confirmed top-level, nested and escape-equivalent duplicate keys are reported; JSON.parse rejects YAML-only syntax. `yaml` is already an existing dependency. | Resolved by technical check 2026-10-25; no new dependency |

**Zero-Question score:** 1 question remains, explicitly outside this slice (AMB-5). Parser implementation is signed off within the static-only scope; no execution authorization follows.

## 7. Implementation Guidance

- Prefer a pure schema/validation module and a thin CLI adapter. Keep filesystem reads outside the pure schema; inject or isolate the time/hash/path checks for deterministic tests.
- Reuse `QualificationTuple`, `Endpoint`, `Scope`, and the existing safe path policy rather than copy divergent enums. Move a schema only if the independent review confirms the extraction is semantics-preserving.
- Decode bytes with fatal UTF-8. Require `JSON.parse` to accept the text, then parse the same text using the existing `yaml` dependency with `schema: "json"` and `uniqueKeys: true`; reject any parser errors or non-JSON root result. `yaml` is used only for duplicate-key detection, not as a YAML input format. Regression-test escaped-equivalent duplicate keys. No dependency or lockfile change is authorized by this choice.
- Static-validator tests live in `packages/eval/test/protocol.test.ts`; they do not prove the full HE-AC-01 live prerequisite. A future authorization/admission contract owns execution-level tests.
- No golden grader, task request, shell script, or module in a reference is executed by validation. Tests assert bytes and path state are unchanged.

### Acceptance tests

1. Valid protocol: strict parse, all tuple sources present, file hashes match, exact protocol hash returned.
2. One changed protocol byte: protocol hash changes; authorization is not parsed by this slice.
3. Unknown field, unsupported version, invalid enum, duplicate case/path, invalid tuple source: reject.
4. Invalid UTF-8, duplicate JSON key, oversized document: reject before path access.
5. Absolute/traversal/drive/UNC/backslash/NUL paths, symlink parent/leaf, directory/FIFO leaf, missing file, and digest mismatch: reject without following link or modifying target.
6. Malformed request content is never echoed in diagnostics.
7. CLI valid/invalid/usage exits are 0/2/1 respectively; no child process/network launch and no data write.
8. Existing `tools/coverage.ts` tuple and golden-task validation regressions stay green.

### Implementation record (2026-10-25)

- `packages/eval/src/tuple.ts` is the shared strict PRD tuple schema used by campaign coverage and `StaticProtocolV1`.
- `packages/eval/src/protocol.ts` performs bounded strict JSON/UTF-8 parsing, duplicate-key detection via the existing `yaml` dependency, local no-follow file checks, and exact-byte hash verification. Referenced files are never executed.
- `tools/eval.ts` and `npm run eval:validate` expose the static-only CLI with usage/error/pass exits 1/2/0.
- Eight offline protocol tests pass on Node 26.3.0 and Node 22.12.0 with the built-in strip-types flag. Full CI passes 1,091 tests/182 suites on Node 26.3.0.
- No execution authorization, protocol consumption by a runner, native UI, replay execution, capture, account, network, or spend behavior is implemented.

## Open Tensions

- HE-AC-01 mentions expired authorization and changed subject/grader before launch, but this slice never launches anything and deliberately does not parse trusted authorization. The full criterion remains open for the separate authorization/admission spec; do not claim HE-AC-01 complete from this work.
- The top-level harness proposes a full campaign Protocol; this document defines only the static v1 descriptor needed by offline validation. Interactions, arms, strata, repetitions, invalid-run decisions, and controller lifecycle remain outside this first schema.
- `subject.artifactSha256` is carried as an expected identifier but cannot be checked by this local validator. No result from this command may claim that the installed subject matches it; the execution-admission contract must verify that binding.

### Independent Review Disposition (2026-10-25)

Read-only review of this file found six precision issues and one intentionally deferred implementation choice. Dispositions:

| Finding | Disposition |
|---|---|
| Tuple-source and required-observation source vocabularies could be confused | Clarified as distinct vocabularies with separate field scopes. |
| `request` and tuple-source `reference` said "bounded" without limits | UTF-8 byte bounds are now explicit; the overall document/file caps remain assumptions for owner review. |
| `subject` strict shape was implicit | Specified exactly one field: `artifactSha256`. |
| `protectedPaths` existence semantics were unclear | Clarified: safe relative-path syntax only; existence is not required or checked. |
| Endpoint/scope enums were implicit | Listed current kernel enum values and source file. |
| Strict objects conflicted with open tuple maps | Clarified fixed-object strictness and the two existing map fields. |
| Duplicate-key JSON parser mechanism was not selected in the draft | Resolved before implementation: `JSON.parse` enforces JSON grammar and existing `yaml` `parseDocument` with JSON schema/`uniqueKeys` detects duplicate keys; focused tests include nested and escaped-equivalent keys. No dependency was added. |
| ReadBoundedRegularFile size check was alleged to occur only after reading | Not reproduced: the code checks descriptor size before buffer allocation and verifies size/inode/device/mtime and byte count after reading. No code change required. |
| Duplicate-key detection parses input with two parsers | Retained intentionally: `JSON.parse` is authoritative for the returned value and JSON syntax; `yaml` is used only to report duplicate-key errors. Top-level, nested and escaped-equivalent duplicate tests pass. |
| Tuple record key count has no separate cap | No additional key-count cap added: the strict 1 MiB protocol-byte bound gives a finite input bound; this is a local maintainer validator, not a network service. A stricter cap would change the accepted schema and requires a spec revision. |

No host, account, capture, model, network or runtime operation occurred. Decision 34 A separately approves static parser implementation; this review does not approve any live path.

## Assumption Registry

| ID | Assumption | Section | Confidence | Evidence | Invalidation |
|---|---|---|:---:|---|---|
| A-1 | The existing tuple schema can be reused without changing its PRD meaning. | Contract | H | PRD §2.2 and `tools/coverage.ts` currently agree. | Reviewer finds field or meaning mismatch. |
| A-2 | Protocol references are local files beneath a protocol root for this offline command. | Contract | M | Golden-task validation uses local fixtures; no remote refs are needed. | A required use case needs remote/artifact-store refs. |
| A-3 | Raw-byte identity is preferable to semantic JSON identity. | Hash rule | M | Avoids canonicalization and makes edits invalidate binding. | Owner requires whitespace-insensitive identity. |
| A-4 | Static v1 need not encode executable interactions. | Scope | M | G0 authorizes offline validation, not native execution; §7.3 has no signed JSON shape. | Owner/reviewer requires a protocol immediately consumable by later execution. |

`[ASSUMPTION-HEAVY: 3 assumptions are M confidence; independent review required before sign-off.]`

## Adversarial Self-Critique

### Weakness 1: Static subset may be mistaken for the complete campaign contract
- **Assumption:** A static descriptor is useful even though it cannot drive a native or replay scenario.
- **If wrong:** The project could implement a schema that is immediately replaced before any consumer uses it.
- **Watch:** Independent reviewer or owner requires this schema to carry interactions, arms, or repeat policies.

### Weakness 2: Raw-byte hashes are operationally strict
- **Assumption:** Requiring a new digest after harmless formatting changes is acceptable.
- **If wrong:** Reviews produce churn and operators may try to reuse stale authorization.
- **Watch:** Reviewers propose semantic/canonical identity instead.

### Weakness 3: Tuple schema extraction is safe
- **Assumption:** `tools/coverage.ts` can share its existing schema without changing evidence-ledger behavior.
- **If wrong:** Protocol work changes release qualification validation unexpectedly.
- **Watch:** Existing coverage tests or schema snapshots change beyond export/import wiring.

## Revision Triggers

1. PRD §2.2 changes tuple fields or meanings: update tuple schema and provenance map, then rerun review.
2. The offline command needs to execute a grader, model, or scenario: stop; this spec's scope is invalid and a new reviewed execution contract is required.
3. Owner approves an authorization source or any live/capture path: write and review a separate authorization/admission spec; do not extend this schema silently.
4. The chosen strict JSON parser cannot reject duplicate keys or invalid UTF-8: revise dependency and acceptance criteria before implementation.

## References

- [Harness evaluation spec](harness-eval.md), especially §7.4 and HE-AC-01.
- [PRD](PRD.md) §2.2 for qualification tuple semantics.
- [Technical spec](tech-spec.md) §17 for evaluation evidence and campaign behavior.
- [Evidence classification](evidence-classification.md) for source distinctions and claims.
- Existing code: `tools/coverage.ts`, `tools/eval-validate.ts`, `packages/kernel/src/core/schemas.ts`.
