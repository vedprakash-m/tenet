---
id: L-0045
kind: decision
date: 2026-11-28
packet: CP-0068
title: "Owner approves the remaining CP-0068 specification text"
---
# L-0045 · Remaining CP-0068 specification text approved

## Context

CP-0068's groups A to E are merged on main, with CI green on three operating systems and independent scenarios s17 to s23 passing. [L-0044](L-0044-group-e-proposals-approved.md) approved the four group E proposals. The rest of the specification text that CP-0068 added was still labelled as a proposal. The Owner had approved the scope on 2026-11-26 ([definition](../packets/CP-0068-dogfood-fixes-0.2.0/definition.md)), and OD-13 and OD-14 in [L-0043](L-0043-owner-decisions-0.2.0.md) decided AC-B1 and AC-D3.

## Decision or event

The Owner approved all 13 remaining labels on 2026-11-28, as written:

| Item | Where | Rule |
|---|---|---|
| AC-A1–A5 | contracts §3 | One front-matter validator for `check`, `fix`, `onboard --card`, `bless` and `board`; `TN-SPEC-NO-FRONT` and `TN-SCHEMA` with JSON Pointers |
| AC-A3 | onboarding | The agent drafts the Markdown; `tenet fix` creates the YAML header |
| AC-A1–A5 | onboarding | The assignment output is checked even with bad front matter; `board` shows its diagnostic |
| AC-A4–A5 | messages | `TN-SCHEMA` lists each failing pointer and directs the user to `tenet fix` |
| AC-A4 | algorithms | `bless` validates front matter before its first question |
| AC-B1 | ci §10, contracts §5 | First-setup exemption for manifest-listed protected files, with one note on the proof card |
| AC-B2 | ci, evidence | `skip-added` counts only test files and `x-test-files` globs |
| AC-B3 | onboarding | `dead-path` counts only references that look like paths |
| AC-D2 | contracts §4 | The assignment carries `questions: {project_kind, generic}`, capped by `question_limit` |
| AC-E1 | onboarding | `init` checks the registry before confirmation and offers local integrity |
| AC-E12/E13 | onboarding | The card groups sections by file and shows what the drafter could read and what it cited |

## Evidence

The Owner's reply of 2026-11-28: "Approve all".

## Consequences

- Every CP-0068 label in the technical specification now cites L-0044 or L-0045. None is left as a proposal, so 0.2.0 ships with no open CP-0068 proposals.
- Contracts §4's `documentation_tokens` label cites L-0044, which approved AC-E4.
- Labels from CP-0066 (AB-E2) are not part of this decision.
