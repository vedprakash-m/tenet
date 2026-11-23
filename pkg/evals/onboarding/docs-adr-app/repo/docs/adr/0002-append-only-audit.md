# ADR-0002: Immutable Audit Log

## Decision
Every freeze override appends one record carrying `requester` and `approver`; past records are never edited.
