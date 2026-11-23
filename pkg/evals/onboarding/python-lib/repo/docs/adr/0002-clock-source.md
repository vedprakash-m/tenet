# ADR-0002: Distributed Clock Source

Status: Accepted

## Decision
Refill timers may use wall clock (`time.time()`) so buckets stay aligned across processes.
