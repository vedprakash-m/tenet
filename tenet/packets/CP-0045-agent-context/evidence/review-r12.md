# Independent round 12 re-review · CP-0045

Re-reviewed PR #28 (`9cb1be3`) against [review-r8.md](review-r8.md), [pending-r8.md](../pending-r8.md), `CP-0045` (`plan/alpha.0.md`), `contracts.md §9`, and `ALG-10`. Did not edit code under review.

## Prior Findings Status

| Prior finding | Status | Evidence |
|---|---|---|
| B1 | fixed | `test/mcp/mcp.test.ts:169–228` loads and executes all 16 `pkg/conformance/alg-10/` cases unmodified (including CLI + MCP parity projections). |
| B2 | fixed | `src/cli.ts:144–151` rejects `--json`, `--quiet`, and `--verbose` on `mcp` with `TN-USAGE-MCP` (exit `2`) before invoking `serveMcp`; tested at `test/mcp/mcp.test.ts:403–420`. |
| B3 | fixed | `src/mcp/index.ts:298–320` commits the generated proposal via `git add` + `git commit --only --no-verify` without disturbing unrelated staged files; tested at `test/mcp/mcp.test.ts:349–401`. |
| B4 | fixed | `src/context/index.ts:323–338` emits section prose candidates unconditionally whenever `hasProse(copy, ...)` is true, even alongside requirements. |
| S1 | fixed | `src/context/index.ts:263–278` and `src/cli.ts:149–150` call `message()` for `TN-USAGE-BUDGET`, `TN-USAGE-CONTEXT`, and `TN-USAGE-MCP`. |
| S2 | fixed | `src/commands/context.ts:32–55` rejects positional arguments (`TN-USAGE-CONTEXT`) and respects `--quiet`; `src/cli.ts:145–151` rejects positional args on `mcp` (`test/mcp/mcp.test.ts:422–433`). |
| S3 | not fixed | Cross-platform MCP Inspector run logs (`pending-r8.md:1–10`) remain open externally. |

## New Finding (Bounded Discovery)

- **should** (`src/context/index.ts:287–290`): `collect()` iterates only `policy.specs.documents` (populated by `loadPolicy` with the five `separate` defaults when omitted), missing `tenet/intent.md` in `one-file` repositories and missing split parts nested under `<doc-stem>/**`. Apply the same `one-file` fallback + split-part discovery used by `check.ts:503–520`.
