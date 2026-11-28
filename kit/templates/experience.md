---
tenet: {spec: 1, doc: ux-spec, level: L2, version: "0.1", owner: "<owner>"}
sections:
  journeys: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["src/ui/**", "src/cli/**"], flags: []}
  output-and-errors: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["src/**"], flags: []}
  wording: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
  completeness-checklist: {state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
---
# <Project> experience specification

> Level L2 · Version 0.1 · Implements `tenet/specs/prd.md` · Owner: `<owner>` · Budget: 6,000 tokens

## Journeys

<!-- Worked example (replace with user journeys for this project): -->
1. A returning shopper confirms payment once and waits at most one retry window before seeing either a confirmation receipt or one actionable error message.

## Output and errors

- R-5 Every user-facing error states what happened, why, and the next action in plain words. {origin: asked; serves: V-V1; scope: global}

## Wording

| Prefer | Avoid |
|---|---|
| Payment could not be confirmed; your card was not charged | Unexpected upstream timeout (504) |

## Completeness checklist

- [ ] Primary user journeys cover first run, daily use, and failure recovery
- [ ] Output and error rules follow plain wording and declare `applies_to` in front matter
- [ ] Every requirement line carries `origin:`, `serves:` and citations where `observed`/`documented`
- [ ] Document stays under 90% of its token budget
