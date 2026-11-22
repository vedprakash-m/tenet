# Architecture criteria

> Kit file · id `architecture` · version 0.1.0 · Applied by the judge at Design (Standard, Deep) and Review (Deep)

| ID | Check | Default severity when violated |
|---|---|---|
| A1 | The change respects every boundary and invariant marked in the tech spec | Blocker |
| A2 | New modules have one responsibility and a stated interface; dependencies point the way the tech spec allows | Major |
| A3 | Data and schema changes have a migration and a rollback path | Major (Blocker for destructive migrations) |
| A4 | Alternatives considered are recorded with the reason for the choice | Minor |
| A5 | No duplicate mechanism exists for something the system already does | Major |
| A6 | Failure modes (timeouts, retries, partial failure) are handled as the design states | Major |
| A7 | The design is the simplest that meets the acceptance basis; speculative generality is a finding | Minor |
