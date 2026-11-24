---
tenet: {spec: 1, doc: intent, level: L1, version: "0.1", owner: owner, drafted_from: "{{revision}}"}
sections:
  vision: {state: draft, digest: null, flags: []}
  requirements: {state: draft, digest: null, flags: []}
  design: {state: draft, digest: null, flags: []}
  experience: {state: draft, digest: null, flags: []}
  plan: {state: draft, digest: null, flags: []}
  conflicts: {state: draft, digest: null, flags: []}
---
## Vision
- V-1 {{purpose}} {origin: asked}

## Requirements
- R-1 Reports never include raw secret values. {origin: observed; cites: internal/scanner/rules.go:5-10, doc: GEMINI.md#rules; scope: global; serves: V-1}
- R-2 Unknown CLI flags return exit code 2. {origin: observed; cites: internal/cli/run.go:13-15}
- R-3 The scanner skips .git, vendor, node_modules, and files above 1 MB. {origin: observed; cites: internal/scanner/rules.go:12-14, internal/scanner/scan.go:14-22}
- R-4 Findings sort by forward-slash path and then line number. {origin: observed; cites: internal/scanner/scan.go:23-29}

## Design
Undecided, needs the Owner.

## Experience
Undecided, needs the Owner.

## Plan
Undecided, needs the Owner.

## Conflicts
- [ ] CF-1 (section: requirements) README.md still describes CSV. internal/cli/run.go accepts text and JSON, and CHANGELOG.md records CSV removal. | 1: Correct the README | 2: Reintroduce CSV via an approved change
- [ ] CF-2 (section: requirements) docs/adr/0001-exit-codes.md promises exit 0 for warnings; internal/cli/run.go and internal/cli/run_test.go use 1 for findings. | 1: Revise the ADR to reflect the current contract | 2: Change implementation and tests to match the ADR
- [ ] CF-3 (section: requirements) internal/scanner/flags.go defines a disabled entropy scan. | 1: Keep entropy scanning unsupported | 2: Define and test the feature before enabling it
- [ ] CF-4 (section: requirements) docs/roadmap.md proposes GitHub SARIF upload. | 1: Keep upload as future work | 2: Specify and build the integration
