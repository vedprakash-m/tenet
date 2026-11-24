# 2026-11-24 rerun comparison

Compared against the prior `2026-11-24` matrix in `BASELINE-2026-11-24.md`.

## Problems in the rerun

No crash, `TN-INTERNAL`, contradiction, or run over 60 seconds remains in the main eight-repository matrix.

Missing-policy runs now return `TN-POLICY-MISSING` (exit 3) for `check`, `board`, and `context`
instead of `TN-INTERNAL`.

ADR `onboard --inventory-only --json` is slow at **93.557 seconds** and exits 0 with
`ok: true`; it reads 26,618 files and skips 8,473. It is the only run over 60 seconds.

## Per-repository and command comparison

| Repository | Command | Policy | Before | After | Result |
|---|---|---|---|---|---|
| all repositories | check/board/context | without tenet.yaml | TN-INTERNAL | TN-POLICY-MISSING | Better |
| tenet-copilot | check | minimal policy | 4.816 s, ok | 1.869 s, ok | Better |
| BotFramework-WebChat | onboard | with minimal policy | 14.027 s | 15.604 s | Worse |
| architecture-decision-record | check | minimal policy | 120.033 s, slow | 1.917 s, ok | Better |
| eslint-plugin-jest | check | minimal policy | 12.876 s | 3.376 s | Better |
| lerna | check | minimal policy | 16.711 s | 6.827 s | Better |

Rows not explicitly listed above remain unchanged in problem class. Timing-only rows are
considered worse only when the rerun is more than 10% slower or crosses a problem threshold.
