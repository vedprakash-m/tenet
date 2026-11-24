# Changelog

All changes to the standard and kit. Each release lists added, changed, deprecated and removed rules, and the migrations it ships (PRD R-004).

## 0.1.0-alpha.0

### Added

- `kind: field-added` · The npm package includes the CLI, SDK, kit, and alpha.0 conformance fixtures.
- `kind: field-added` · `tenet onboard` inventories committed files and writes a drafting assignment. The onboarding card pins the draft revision. `tenet bless` records section-level decisions and keeps the last blessed copy in force while people review edits or changed sources.
- `kind: field-added` · `tenet check` reports specification structure, citations, and budget findings. `tenet fix` repairs mechanical metadata and `tenet split` moves a section to its own document. `tenet board` shows specification state and work that needs review.
- `kind: field-added` · The local MCP server and `tenet context` give agents the blessed text that applies to their task, with draft hints and omissions labeled.
- `kind: field-added` · The CI test job collects evidence and the recorder posts an advisory proof card. The card shows the tested revision, touched requirements, tagged test results, and weakening findings.

### Changed

- `kind: rule-clarified` · Alpha.0 runs its five proof rules at advisory strength. The proof card separates what passed from what did not run or could not be checked.
- `kind: rule-clarified` · Specification checks follow the configured document ladder, including the one-file layout and its split parts.

### Migrations

None.

## 0.1.0-draft · 2026-11-22

### Added

- The standard, derived from the Torus process proposal: documents and ownership gradient, change packets and lanes, thirteen stations in five phases, gates and evidence, the factory floor, flow control, change control, traceability, escalation, verification and holdout, release and observation, agent management, metrics and learning, layout, adoption.
- §18 Deliverables, distribution and execution: what ships, what a project contains, onboarding, updates, execution modes A–C, conformance, namespace, upstream feedback.
- Draft schemas: `packet`, `agent`, `tenet-profile`. Default profile.
- Draft templates, reference agents (shaper, builder, verifier, judge), judge protocol, five criteria files, station loop.

### Changed

- Renamed from the source: `factory.yaml` → `tenet.yaml`; the `factory` command → `tenet`; commit trailers prefixed `Tenet-`.
- Project layout (§3.1, §16, §18): records live in one records folder (`tenet/` by default, `paths.records`; visible `tenet/` is the project's, hidden `.tenet/` is the tool's); overlays move to `.tenet/overlays/`; schemas, templates and reference agents are read from `.tenet/kit/` and never copied; `specs/process.md` is replaced by the vendored `TENET.md` with the profile; agent path rules use `${records}`.
- Package layout: `kit/` is vendored one to one; migrations, conformance, evaluation suites and host formats ship only in the package. Added `tenet doctor` and `tenet eject`; the update bot reads the version from `tenet.lock`.

### Migrations

None.
