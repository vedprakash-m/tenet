# Independent round 2 review · CP-0003

Reviewed main at `1225d8d` (8230ced and 12b9116). The packet has no entry or eight-field contract in alpha.0.md. These verdicts use its bootstrap scope in plan.md:170–177 and the common proving requirements in alpha.0.md:7–12.

| Contract field | Verdict | Evidence |
|---|---|---|
| Owns | partly | Bootstrap package, compiler, license, lint, tests and CI matrix exist. Hook responsibility needs to be reconciled with CP-0009. |
| Exports | met | The npm bootstrap entry points and architecture test are present. |
| Behavior | partly | Example checking covers only tech-spec YAML fences. |
| Edge cases | partly | Architecture tests exercise static and dynamic import forms. The published non-YAML examples are untested. |
| Out of scope | met | Runtime role implementations are outside this bootstrap change. |
| Fixtures | met | Import classifier and dependency-allowlist cases are present in the architecture test. |
| Proving | partly | Local commands passed, but checklist scope and three-platform evidence are incomplete. |

## Findings

- **blocker** · `scripts/check-examples.mjs:7`, `:12` and `:19` versus `tenet/specs/plan.md:64` and `:175`. The script only scans YAML fences in the tech-spec parts and does not check README or UX examples, cards, acceptance blocks, tags or commands. **Fix:** collect the stated documentation surfaces and check every required example form under its contract.
- **should** · `tenet/specs/plan.md:176` versus `tenet/specs/plan/alpha.0.md:128`. Bootstrap lists hooks, but the only named hook belongs to CP-0009 and the baseline has no tracked hook. **Fix:** identify bootstrap's intended hook setup or explicitly assign it to the packet that owns the hook.

## Proving on Windows

All commands ran against a disposable source copy from the baseline, using Node 24.22.1. Shared `npm run lint` and `npm run check:examples` exited 0. `npm test` had 59 passes and 2 skips for the excluded pack and agent-card schemas. Linux and macOS CI results were not observed in this review. The example checker reported six YAML blocks across seven technical parts. The architecture tests passed in the shared test run. The CI matrix declares all three operating systems.
