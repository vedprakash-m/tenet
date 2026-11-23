# ADR-0001: Idempotency Key Enforcement and TTL

Status: Accepted

## Decision
Every `POST /charges` request without an `Idempotency-Key` header MUST be rejected with HTTP 400.
Keys are stored for 24 hours.
