# ADR-0003: Retention by Tombstone Only

## Decision
Incidents are soft-deleted via `archivedAt` timestamps and never hard-deleted from storage.
