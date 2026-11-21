# R1 Should dispositions

Status: **proposed; owner sign-off pending**.

This register does not approve an omission. The PRD requires every Should to
pass or have an owner-signed omission before R1. Evidence below identifies
source work already present; it does not replace native-host or campaign
qualification.

| ID | Milestone | Proposed disposition | Evidence and remaining work |
|---|---|---|---|
| INS-08 | R1 | Retain | `README.md` explains the host-native recovery path; `packages/kernel/test/readme.test.ts` covers it. Reconfirm on the qualified install tuple. |
| INT-13 | R1 | Retain, complete semantic evidence | `packages/kernel/test/intent-md.test.ts` proves byte-preserving blocks. Designated existing-document selection and the full change-controlled adoption journey still need a complete acceptance fixture. |
| INT-14 | R1 | Retain, complete update semantics | The starter ships `docs/architecture.md` and reviews use it, but handover behavior does not yet prove that every material architecture change updates the document. Add a focused handover fixture. |
| AGT-09 | B | Retain | Quick work returns the existing focused-review path in `packages/kernel/src/verbs/findings.ts` and is covered by focused-review tests. |
| TDD-05 | B | Retain | `plugin/skills/tenet-build/SKILL.md` directs a post-green refactor and reruns affected/full checks; native adherence remains part of host qualification. |
| EVD-14 | R1 | Retain, host verification pending | `packages/kernel/src/core/verdict.ts` now keeps every `ci-external` receipt inconclusive unless a separate protected-verification path exists. The six protected-run facts remain externally verifiable evidence, not a kernel inference. |
| RES-08 | R1 | Retain | `packages/kernel/test/prerequisite-guidance.test.ts` covers a consented Guided demo that must respond and is not treated as verification. |
| RES-09 | B | Retain | `packages/kernel/test/deep-budget-preview.test.ts` covers the coordinator preview and later lane-change requirement. |
| GIT-06 | R1 | Retain | The coordinator agent drafts a PR brief from the contract and findings, without pushing or opening it. Host campaign evidence remains open. |
| GIT-07 | R1 | Retain | `packages/kernel/test/starter-ci.test.ts` checks that the starter workflow runs the declared obligations and full suite. |
| GIT-14 | R1 | Retain | `plugin/com.github.copilot/agents/tenet.agent.md` offers only `git branch -d` after integration and warns before destructive deletion after abandon. User execution remains host behavior. |
| CFG-07 | R1 | Retain, complete provenance fixture | Personal settings and scope resolution exist; add a direct regression that an explicit "always in this project" correction is persisted with provenance and inferred preferences still ask. |
| RSC-05 | R1 | Retain | The coordinator obeys `conserve`/`serial` while the required review continues, in `plugin/com.github.copilot/agents/tenet.agent.md`. |
| LRN-04 | R1 | Retain | The coordinator offers a lesson only from a cited finding, repeated failure or correction and requires user confirmation; add campaign evidence for over-offering/under-offering. |
| QLT-08 | R1 | Retain | `packages/kernel/test/prerequisite-guidance.test.ts` covers current handover documentation without inventing evidence. Extend the fixture through every required document. |
| QLT-15 | R1 | Retain | `packages/kernel/test/recipe-guidance.test.ts` requires a reviewed manual recipe migration and rejects replacement of an existing app. |
| ENG-06 | R1 | Omit only if owner signs; otherwise implement | The pinned OpenTelemetry GenAI trace-field subset is not complete in the current trace schema. Add the closed field projection without exporting data by default. |
| OSS-03 | R1 | Retain | `CONTRIBUTING.md` now defines RFC inputs, independent review, and cumulative experimental/community/official certification. |
| OSS-06 | R1 | Retain, host qualification pending | `/tenet feedback` now routes to `inspect --view export --topic feedback`; the kernel returns the redacted, no-save/no-send preview and the coordinator stops. |

## Owner decisions required

For each row above, the owner must record one of:

1. **Retain:** the behavior is in scope; identify the qualification evidence and
   acceptance date.
2. **Omit:** the release claim is intentionally absent; record the
   user/release impact, residual risk and approval date.

No owner answer exists in this checkout, so all 19 remain open for R1.
