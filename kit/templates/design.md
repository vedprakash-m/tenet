---
tenet: {spec: 1, doc: tech-spec, level: L2, version: "0.1", owner: "<owner>"}
sections:
  architecture: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["src/**"], flags: []}
  working-rules: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
  conflicts: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, anchors: {}, flags: []}
  open-questions: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, anchors: {}, flags: []}
  completeness-checklist: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
---
# <Project> technical specification

> Level L2 · Version 0.1 · Implements `tenet/specs/prd.md` · Owner: `<owner>` · Budget: 12,000 tokens

## Architecture

<!-- Give each design prose section `applies_to` in front matter so `tenet context` returns it for matching paths. -->

Module boundaries:
- `src/checkout/` owns retry orchestration and idempotency key generation; only `src/gateway/` opens outbound payment connections.

<!-- Worked traceable statement: -->
- R-4 Outbound gateway calls pass a per-attempt idempotency key derived from the order ID. {origin: observed; cites: src/checkout/retry.ts:24-31; serves: V-M1}

## Working rules

<!-- Imported from existing instruction files during onboarding or authored for this project. -->

- Keep changes small and verify every changed path with tests before opening a pull request.

## Conflicts

<!-- List disagreements discovered between architecture docs and code as `- [ ] CF-<n> (section: <slug>) ... | 1: ... | 2: ...` -->

## Open questions

<!-- List unresolved design questions as `- [ ] Q-<n> (section: <slug>) ...` -->

## Completeness checklist

- [ ] Every prose section declares `applies_to` globs in front matter
- [ ] Module boundaries and invariants are explicit; `<!-- invariant -->` or `<!-- provisional -->` marks owner-locked sections
- [ ] Every `observed` or `documented` statement cites source files or documents (`tenet check` passes)
- [ ] Document stays under 90% of its token budget (split parts if needed)
