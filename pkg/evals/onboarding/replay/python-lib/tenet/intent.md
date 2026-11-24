---
tenet: {spec: 1, doc: intent, level: L1, version: "0.1", owner: owner, drafted_from: "{{revision}}"}
sections:
  vision: {state: draft, digest: null, flags: []}
  requirements: {state: draft, digest: null, flags: []}
  design: {state: draft, digest: null, flags: []}
  experience: {state: draft, digest: null, flags: []}
  plan: {state: draft, digest: null, flags: []}
  conflicts: {state: draft, digest: null, flags: []}
---
## Vision
- V-1 {{purpose}} {origin: asked}

## Requirements
- R-1 The runtime has no third-party dependencies. {origin: observed; cites: pyproject.toml:5; scope: global; serves: V-1}
- R-2 Non-positive capacity or refill rates raise ValueError. {origin: observed; cites: src/pulselimit/bucket.py:5-7}
- R-3 Each token bucket updates state under its own lock. {origin: observed; cites: src/pulselimit/bucket.py:13-26}
- R-4 Retry-after rounds positive deficits up and returns zero for non-positive deficits. {origin: observed; cites: src/pulselimit/headers.py:3-6}

## Design
- R-20 The default clock is time.monotonic(). {origin: observed; cites: src/pulselimit/clock.py:3-4}

## Experience
Undecided, needs the Owner.

## Plan
Undecided, needs the Owner.

## Conflicts
- [ ] CF-1 (section: requirements) README.md advertises AsyncLimiter; src/pulselimit/__init__.py no longer exports it. | 1: Remove the unsupported API from documentation | 2: Restore it through a separate approved change
- [ ] CF-2 (section: requirements) docs/adr/0002-clock-source.md allows wall time; tests/test_bucket.py expects the monotonic clock. | 1: Update the ADR | 2: Take a separate decision on changing the clock
- [ ] CF-3 (section: requirements) src/pulselimit/config.py defines a disabled burst-borrowing flag. | 1: Remove the unused switch | 2: Design and test burst borrowing before exposing it
- [ ] CF-4 (section: requirements) docs/issues/009-redis-backend.md proposes a Redis backend. | 1: Keep it as future work | 2: Define a separate backend scope
