# Performance benchmark

Generated fixtures: 1000, 5000, 10000, 30000 markdown files, 1024 bytes target each, 5 specification documents.

| Markdown files | check | board | context | onboard inventory |
|---:|---:|---:|---:|---:|
| 1000 | 6.907 s | 1.944 s | 1.549 s | 7.376 s |
| 5000 | 34.210 s | 1.875 s | 1.514 s | 5.975 s |
| 10000 | 42.038 s | 1.800 s | 1.424 s | 10.490 s |
| 30000 | 138.154 s | 1.957 s | 1.502 s | 40.551 s |

## Growth: 1k to 30k markdown files

- check: 6.907 s to 138.154 s (20.00x)
- board: 1.944 s to 1.957 s (1.01x)
- context: 1.549 s to 1.502 s (0.97x)
- onboard: 7.376 s to 40.551 s (5.50x)
