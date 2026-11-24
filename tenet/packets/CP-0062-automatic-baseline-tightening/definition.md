---
packet: CP-0062
version: 1
---
# CP-0062 stub definition · Automatic baseline tightening

> Split from `CP-0039` (Owner scope cut, 2026-11-24) · Implements `R-175` auto-tightening · Blocked by: `CP-0039`.

## Preserved design & round 4 review findings

Extends `CP-0039` (which updates `.tenet/health-baseline.json` solely by explicit reviewed `change-policy` commits) with automatic monotonic `main`-branch baseline tightening on `refs/tenet/records: health/baseline.json` and signed `refs/tenet/evidence` snapshots.

**Open critic findings carried from `CP-0039` round 4 (plus earlier R1–R3 tightening protocol):**
- **GPT R4 F2 (reset epoch transition, predecessor recovery & semantic hash):** Must define an authorized per-key `reset_seq` transition from an older `records` tip (`R`) to a newer committed floor (`R'`) so post-reset runs do not fail CAS against epoch `R`; require explicit generation/`reset_seq` bumps on config/scope changes; bind signed snapshots in `refs/tenet/evidence` via `predecessor_sha256` to prevent two signed orphans on one `main_commit` from causing ambiguous recovery; project semantic `health_basis_digest` strictly over limits and expiries (excluding mutable run/attempt metadata); enforce universal `canTighten` gates before all CAS branches (including same-commit retries) and element-wise `min` `finding_set` shrinkage without losing sibling keys.
