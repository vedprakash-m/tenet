# LedgerGate

Payment webhook gateway with automatic retry and idempotency.

## Behavior
- Downstream gateway timeouts retry up to 3 times with exponential backoff.
- Idempotency records are retained for 48 hours.

## Run
```bash
npm test
```
