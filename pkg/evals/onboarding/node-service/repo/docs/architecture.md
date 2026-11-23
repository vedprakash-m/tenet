# Architecture

## Async Reconciliation
Async ledger reconciliation runs via worker queue when `ENABLE_ASYNC_RECONCILE` is enabled.

## Security
All incoming webhooks must carry a valid HMAC-SHA256 `X-Signature` header.
