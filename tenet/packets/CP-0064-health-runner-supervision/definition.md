---
packet: CP-0064
version: 1
---
# CP-0064 stub definition · Protected runner supervision

> Split from `CP-0039` (Owner scope cut, 2026-11-24) · Blocked by: `CP-0039`.

## Preserved design & round 4 review findings

Extends `CP-0039` (which validates report bytes, `exit_code === 0`, `<base>` `inputs[]`, and declared `{tool, tool_version, config_digest}` under `ci.md §5`'s honest limit for subject-executed checks) with protected verifier/runner per-unit completion proof.

**Open critic findings carried from `CP-0039` rounds 4–5:**
- **GPT R4 F3 (verifiable per-unit completion & anti-swap binding):** Launch arguments (`--files`) select requested scope but do not prove the analyzer processed every file or extracted every directed `R-176` edge. Must define a protected verifier/runner protocol (`built-in-verifier` / telemetry-verified `adapter-verified`) that records per-file analyzed digests and per-module `{files_parsed, edge_count}` independent of subject-side output, bound canonically in `runner_receipt` to `(run_id, attempt, check, tested_commit, base_commit, executable_sha256, config_sha256, report_sha256)` to prevent swapped slots/reports. Keep unverified CLI tools capped at `coverage_unverified` (`advise`).
- **GPT R5 F4 (silent-omission detection for `R-176` architecture graphs):** `CP-0039` core observes only declared partial coverage (`complete: false`), missing expected `<base>` modules, or unknown edge endpoints. When a subject-side producer declares `complete: true` and lists all expected modules while silently omitting an edge (e.g., an allowed or cycle-closing `A -> B` edge), the core graph and coverage metadata are byte-identical to a truly complete graph. Detection of silently omitted `R-176` edges rests on this packet's protected per-unit telemetry/supervision.
