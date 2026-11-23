# ADR-0001: Core Boundary

## Decision
`src/core/` contains pure domain logic and must not depend on HTTP transport (`src/http/`).
