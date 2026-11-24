# Independent round 3 review · CP-0003

Reviewed `main` at `1729379` (after merge `ab82537` containing GPT's `scripts/check-examples.mjs` fix) against the bootstrap scope in `tenet/specs/plan.md:64` and `:170–177` and the shared proving requirements in `tenet/specs/plan/alpha.0.md:7–12`.

| Contract field | Verdict | Evidence |
|---|---|---|
| Needs | met | `CP-0002` namespace and licence (`LICENSE`, `LICENSE-docs`) are present (`tenet/specs/plan.md:169–170`); `CP-0001` ratification is deferred by the Owner for alpha.0 bootstrap (`tenet/ledger/L-0034-round-1-merged.md:15`). |
| Owns | partly | `package.json`, `tsconfig.json`, Biome, `test/architecture.test.ts`, `scripts/check-examples.mjs`, `scripts/examples-known.json`, `test/examples/check-examples.test.js`, licences and `.github/workflows/ci.yml` exist; hook ownership in `tenet/specs/plan.md:176` vs `tenet/specs/plan/alpha.0.md:128` remains split with `CP-0009`. |
| Exports | met | `npm run lint`, `npm run check:examples`, `npm test`, and `inspectExamples` / `commandNames` / `compareKnownFailures` (`scripts/check-examples.mjs:73, 358, 405`) are exported and tested. |
| Behavior | partly | The round 2 blocker is resolved: `scripts/check-examples.mjs:447–452` now scans `README.md`, `tenet/specs/ux-spec.md`, `tenet/specs/tech-spec.md`, and all `tenet/specs/tech-spec/*.md` parts (11 documents) across YAML, JSON, schemas, front matter, acceptance blocks, tags, proof cards and commands. Onboarding cards and `README.md`'s card block are still skipped (`scripts/check-examples.mjs:336–356`). |
| Edge cases | met | Nested Markdown fences, unclosed YAML fences, custom requirement prefixes, and exact `(file, line, reason)` matching for `scripts/examples-known.json` are covered (`test/examples/check-examples.test.js:100–197`). |
| Out of scope | met | No product runtime commands or deferred packet features are bundled in `scripts/check-examples.mjs`. |
| Fixtures | met | Twelve positive/negative sample pairs plus five structural tests are present in `test/examples/check-examples.test.js:14–197`. |
| Proving | met | `npm run lint`, `npm run check:examples`, and `npm test` (98/98 tests passing, including 17 example-checker tests and 5 architecture tests) passed on Windows; three-platform CI passed on PR #1 and PR #2 (`tenet/ledger/L-0036-round-2-merged.md:20–21`). |

## Findings

- **should** · `scripts/check-examples.mjs:336–356` versus `tenet/specs/plan.md:64`, `tenet/specs/ux-spec.md:72–97` and `tenet/specs/tech-spec/onboarding.md:57`. `inspectCard` only matches fences containing `^### Tenet proof\b`, so the `### Tenet onboarding` card in `tenet/specs/ux-spec.md:72` and the `Tenet · verified on CI` card in `README.md:36` are never validated. **Fix:** extend `inspectCard` to validate `### Tenet onboarding` cards (`Read:`, `Sections`, `Commands`) and `README.md`'s summary card header.
- **nit** · `tenet/specs/plan.md:176` versus `tenet/specs/plan/alpha.0.md:128`. `plan.md:176` lists `hooks` under `CP-0003`, whereas `alpha.0.md:128` assigns `kit/hooks/pre-commit` to `CP-0009`. **Fix:** note in `tenet/specs/plan.md:176` that the pre-commit hook ships in `CP-0009`.

## Proving on Windows

Ran on Windows (Node 24.22.1) against `1729379`:
- `npm run lint`: exited `0` (`Checked 131 files in 70ms. No fixes applied.`).
- `npm run check:examples`: exited `0` (`Checked examples across 11 documents (6 YAML, 0 JSON fences; 4 documented failures).`).
- `npm test`: exited `0` (`98 pass, 0 fail`).
