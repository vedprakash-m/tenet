# Baseline comparison

## Baseline repositories

| Repository | 2026-11-23 baseline | 2026-11-24 matrix | Result |
|---|---|---|---|
| tenet-copilot | Onboard contradicted exit 1; check, board and context required missing policy | Onboard exit 0; minimal policy makes check/board/context exit 0 | Better |
| BotFramework-WebChat | Onboard contradicted exit 1; check, board and context required missing policy | Onboard exit 0; minimal policy makes check/board/context exit 0 | Better |
| torus | Onboard and Git setup problems; missing policy affected four commands | No-policy onboard works; minimal policy makes check/board/context exit 0 | Better |

## Matrix totals

- `ok`: 53
- `TN-INTERNAL`: 26
- `slow`: 1
- `crash`: 0
- `contradictory`: 0

The only slow command is `architecture-decision-record` with the minimal policy:
`check --json`, 120.033 seconds. No crash or contradictory result remains in the corrected matrix.
