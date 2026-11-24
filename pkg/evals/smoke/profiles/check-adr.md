# CPU profile: `tenet check` on architecture-decision-record

## Run

- Full command: `node --cpu-prof --cpu-prof-dir=<clone>\.prof <dist>/cli.js check --json`
- Repository: `architecture-decision-record/architecture-decision-record`
- Minimal `tenet.yaml`: used
- Result: **finished**
- Exit code: 1 because the check found six schema findings
- Wall time: **44.600 seconds**
- CPU profile duration: 28.966 seconds
- Profile: `CPU.20261123.204027.58604.0.001.cpuprofile`

## 15 functions with the most self time

| Rank | Self time | Function | Dist location | Source mapping |
|---:|---:|---|---|---|
| 1 | 18.067 s | `(idle)` | — | runtime idle |
| 2 | 1.898 s | `(program)` | — | program time |
| 3 | 1.344 s | RegExp citation/range matcher | — | `[citedPath]` in `src/specs/sections.ts:3` |
| 4 | 436 ms | `lstat` | node native | filesystem stat |
| 5 | 380 ms | `openFileHandle` | node native | filesystem open |
| 6 | 331 ms | `readdir` | node native | discovery/read |
| 7 | 300 ms | `encode` | `node:internal/encoding:356` | Node encoding |
| 8 | 284 ms | `parseStatements` | `dist/specs/parse.js:359` | `src/specs/parse.ts:441` |
| 9 | 257 ms | `sectionDigest` | `dist/specs/sections.js:14` | `src/specs/sections.ts:15` |
| 10 | 249 ms | `update` | `node:internal/crypto/hash:187` | hashing |
| 11 | 207 ms | `makeSection` | `dist/specs/parse.js:259` | `src/specs/parse.ts:315` |
| 12 | 206 ms | `parseMetadata` | `dist/specs/parse.js:82` | `src/specs/parse.ts:143` |
| 13 | 173 ms | `Hash` | `node:internal/crypto/hash:113` | hashing |
| 14 | 168 ms | `splitFront` | `dist/specs/parse.js:198` | `src/specs/parse.ts:259` |
| 15 | 166 ms | `fstat` | node native | filesystem stat |

The top five application functions by self time are:

1. `parseStatements` — 284 ms — `src/specs/parse.ts:441`
2. `sectionDigest` — 257 ms — `src/specs/sections.ts:15`
3. `makeSection` — 207 ms — `src/specs/parse.ts:315`
4. `parseMetadata` — 206 ms — `src/specs/parse.ts:143`
5. `splitFront` — 168 ms — `src/specs/parse.ts:259`

## Top-level phase shares

Among active CPU samples (excluding `(idle)` and `(program)`):

- Discovery: 16.95%
- Parsing: 24.36%
- Citations: 0.08%
- Git calls: 0.41%
- Other/runtime: 58.20%

The profile has substantial `(idle)` time (62.4% of sampled profile time), consistent with waiting and process/service activity outside direct application CPU.

## Scaling observations

| Run | Wall time | Result |
|---|---:|---|
| Full repository `check --json` | 44.600 s | Finished; 6 schema findings |
| `check README.md --json` | 29.562 s | Finished; 0 findings |
| `specs.documents` limited to `docs/` | 29.852 s | Finished; 7 schema findings |

The README-only and docs-only runs take almost the same 29–30 seconds, while the full repository is about 15 seconds slower. This points to repository discovery and broad file inventory as a large part of the cost; limiting the spec document list alone does not remove repository-wide discovery.

## Markdown input size

- Markdown files: **26,153**
- Total Markdown size: **155,408,733 bytes** (148.19 MiB)

Largest 10 Markdown files:

| Size | Path |
|---:|---|
| 80,674 B | `architecture-decision-record.github.io/src/content/locales/km-001/index.md` |
| 80,674 B | `architecture-decision-record.github.io/src/content/locales/km-kh/index.md` |
| 80,674 B | `locales/km-001/index.md` |
| 80,674 B | `locales/km-001/README.md` |
| 80,674 B | `locales/km-kh/index.md` |
| 80,674 B | `locales/km-kh/README.md` |
| 75,323 B | `architecture-decision-record.github.io/src/content/locales/ta-001/index.md` |
| 75,323 B | `locales/ta-001/index.md` |
| 75,323 B | `locales/ta-001/README.md` |
| 69,309 B | `architecture-decision-record.github.io/src/content/locales/kn-001/index.md` |
