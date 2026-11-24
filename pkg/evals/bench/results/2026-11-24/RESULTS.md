# Performance benchmark

Generated fixtures: 1000, 5000, 10000, 30000 markdown files, 1024 bytes target each, 5 specification documents.

| Markdown files | check | board | context | onboard inventory |
|---:|---:|---:|---:|---:|
| 1000 | 1.778 s (exit 0) | 1.850 s (exit 0) | 1.478 s (exit 0) | 3.945 s (exit 0) |
| 5000 | 1.770 s (exit 0) | 1.775 s (exit 0) | 1.469 s (exit 0) | FAILED (exit 1) |
| 10000 | 1.884 s (exit 0) | 1.975 s (exit 0) | 1.475 s (exit 0) | FAILED (exit 1) |
| 30000 | 2.326 s (exit 0) | 2.550 s (exit 0) | 4.006 s (exit 0) | FAILED (exit 1) |

## Growth: 1k to 30k markdown files

- check: 1.778 s to 2.326 s (1.31x)
- board: 1.850 s to 2.550 s (1.38x)
- context: 1.478 s to 4.006 s (2.71x)
- onboard: 3.945 s to FAILED (growth unavailable)

## Before PR #28 / after

| Markdown files | Check before | Check after | Board before | Board after | Context before | Context after | Onboard before | Onboard after |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1000 | 6.907 s | 1.778 s | 1.944 s | 1.850 s | 1.549 s | 1.478 s | 7.376 s | 3.945 s |
| 5000 | 34.210 s | 1.770 s | 1.875 s | 1.775 s | 1.514 s | 1.469 s | 5.975 s | FAILED (TN-INTERNAL ENAMETOOLONG) |
| 10000 | 42.038 s | 1.884 s | 1.800 s | 1.975 s | 1.424 s | 1.475 s | 10.490 s | FAILED (TN-INTERNAL ENAMETOOLONG) |
| 30000 | 138.154 s | 2.326 s | 1.957 s | 2.550 s | 1.502 s | 4.006 s | 40.551 s | FAILED (TN-INTERNAL ENAMETOOLONG) |

## FAILED cells

- `onboard --inventory-only --json`: 5000, 10000, and 30000 Markdown files.
- Reason: exit 1 with `TN-INTERNAL` / `spawn ENAMETOOLONG`.
