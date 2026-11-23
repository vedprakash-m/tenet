# Independent round 2 review · CP-0005

Reviewed main at `1225d8d` (c9cb334). Contract references below are relative to the repository root.

| Contract field | Verdict | Evidence |
|---|---|---|
| Owns | met | The CLI, SDK, helpers, packaging metadata and workflow are present. |
| Exports | met | The public SDK exposes the listed entry points, including the Git helpers. |
| Behavior | partly | CLI and atomic-write cases pass; JCS accepts invalid Unicode. |
| Edge cases | met | The named path, interrupted write, usage and environment cases are exercised. |
| Out of scope | met | No deferred signing or product command behavior is required here. |
| Fixtures | partly | The listed fixture families exist; the Unicode rejection case is missing. |
| Proving | partly | Core and CLI suites and packed Windows consumer smoke passed; other platforms remain unobserved. |

## Findings

- **should** · `src/core/hash.ts:48` and `:64` versus `tenet/specs/tech-spec/contracts.md:162` and [RFC 8785 §3.2.2.2](https://www.rfc-editor.org/rfc/rfc8785#section-3.2.2.2). A direct call with an unpaired surrogate returned its escaped JSON form, while JCS requires rejection for both string values and keys. **Fix:** validate Unicode before serialization and add RFC rejection vectors for values and keys.

## Proving on Windows

All commands ran against a disposable source copy from the baseline, using Node 24.22.1. Shared `npm run lint` and `npm run check:examples` exited 0. `npm test` had 59 passes and 2 skips for the excluded pack and agent-card schemas. Linux and macOS CI results were not observed in this review. `npm test -- test/core test/cli` had 32 passes. `npm pack` exited 0. A fresh npm consumer with its own package manifest installed the tarball. `npx --no-install tenet --version` printed the packaged `0.0.0` and importing the SDK exposed `run` as a function.
