# Changelog

All changes to the standard and kit. Each release lists added, changed, deprecated and removed rules, and the migrations it ships (PRD R-004).

## 0.1.1

### Added

- `tenet verify --local` runs your checks on the working tree and prints the proof card a pull request would get, marked as a local preview. It needs no CI event and no network.
- `bless` asks each open question in a section before blessing it, and "Decide later" on a conflict leaves only that section unblessed while the session carries on.
- `tenet <command> --help` prints that command's own options. `onboard.exclude` is documented.
- Install from the GitHub release tarball when a registry mirror doesn't have the package yet.

### Changed

- Every bless session ends with "Blessed N of M sections", also when nothing was blessed. The blessing log records each section's own review time.
- Token budgets count the section body, not front matter.
- While the documents that serve a blessed vision are still drafts, `check` reports one grouped warning instead of an error per vision item.
- The onboarding card lists open questions and says "N citations resolve (file and lines exist)". Plain `board` groups sections by file and shows their conflicts and questions. Statements inside Markdown tables are found when HTML comments sit between rows.
- `context --paths` ranks sections whose `applies_to` matches the path above catch-all sections, and keeps large catch-all sections within the budget. `--paths` takes commas or a repeated flag. `--include-drafts` selects and budgets drafts like blessed text, marked as drafts.
- Shipped skills are named `tenet-draft-specs`, `tenet-review-with-findings` and `tenet-work-a-change` everywhere. `init --host claude|cursor|copilot|vscode` adds that host's skill and MCP files; a repository with no agent setup stays agent-neutral.
- With no test runner detected, `init` asks for the test command, and with `--yes` writes no test check. It never writes `npm test` without a `package.json`.
- Generated workflows run on pull requests and on pushes to the default branch only. When a pull request changes a check's command, the card notes that the change takes effect after merge.
- Anchors keep a hash, line range and blessed commit for each citation, never the cited text. Old text is read from git history when needed.
- Clearer offline and registry messages; no Node deprecation warning on Windows; shorter first findings in `onboard`; `init` says *create* or *edit* per file; path-scoped `check` prints human output.

### Migrations

- `tenet upgrade` rewrites existing generated workflows to the new triggers, and rewrites existing anchor files without cited text. A same-version upgrade changes nothing else.

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
