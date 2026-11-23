# Package-only content

Shipped in the npm package and used by the `tenet` CLI, but **never vendored** into projects and never read by agents.

| Path | What | Milestone |
|---|---|---|
| `migrations/<to-version>/` | Upgrade migrations (tech spec §12.2) | M4 |
| `conformance/<step>/<rule-id>/` | Conformance fixtures and expected outputs (tech spec §13) | M4 |
| `evals/<agent>/` | Reference evaluation suites; kept out of the vendored kit so agents under test cannot read them | M5 |
| `hosts/` | Pinned host file formats for the host compilers (tech spec §11) | M3 |
