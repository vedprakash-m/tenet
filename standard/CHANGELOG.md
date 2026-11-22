# Changelog

All changes to the standard and kit. Each release lists added, changed, deprecated and removed rules, and the migrations it ships (PRD R-004).

## 0.1.0-draft · 2026-11-22

### Added

- The standard, derived from the Torus process proposal: documents and ownership gradient, change packets and lanes, thirteen stations in five phases, gates and evidence, the factory floor, flow control, change control, traceability, escalation, verification and holdout, release and observation, agent management, metrics and learning, layout, adoption.
- §18 Deliverables, distribution and execution: what ships, what a project contains, onboarding, updates, execution modes A–C, conformance, namespace, upstream feedback.
- Draft schemas: `packet`, `agent`, `tenet-profile`. Default profile.
- Draft templates, reference agents (shaper, builder, verifier, judge), judge protocol, five criteria files, station loop.

### Changed

- Renamed from the source: `factory.yaml` → `tenet.yaml`; the `factory` command → `tenet`; commit trailers prefixed `Tenet-`.

### Migrations

None.
