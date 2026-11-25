# Changelog

All changes to the standard and kit. Each release lists added, changed, deprecated and removed rules, and the migrations it ships (PRD R-004).

## 0.1.0

### Added

- Install Tenet in a Git repository with `tenet init`. Review the files it plans to write and choose whether to connect an existing test workflow.
- Use `tenet onboard` to give your coding agent an inventory and a drafting assignment. Review the result with the onboarding card and put approved sections in force with `tenet bless`.
- Check specification structure, citations and integrity with `tenet check`. Use `tenet board` to find drafts, edited sections and changed sources.
- Give agents relevant approved text through `tenet context` or a local MCP server.
- On GitHub, the installed workflows collect test evidence and post an advisory proof card tied to the tested commit.
- Use `tenet doctor` to diagnose setup, `tenet upgrade` to refresh it, and `tenet remove` to remove managed setup while keeping project specifications and records.

### Changed

- The first public package includes the CLI, SDK, kit and conformance examples for this release.
- Specification discovery follows the configured documents, or the one-file layout and its split parts when using that layout.

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
