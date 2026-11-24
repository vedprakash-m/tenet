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
- R-1 After a gateway timeout, retry once. {origin: observed; cites: src/payments/retry.js:2-11; serves: V-1}
- R-2 Webhook signatures use HMAC-SHA256 and a timing-safe comparison. {origin: observed; cites: src/security/hmac.js:3-9}
- R-3 Redact raw card numbers and CVVs before logging. {origin: observed; cites: src/security/redact.js:1-6, doc: CLAUDE.md#rules; scope: global}
- R-4 Destroy the request when its body exceeds 65,536 bytes. {origin: observed; cites: src/config/limits.js:1, src/server.js:12-16}
- R-5 GET /healthz returns HTTP 200 with an ok status. {origin: observed; cites: src/routes/health.js:1-3}

## Design
- R-20 Idempotency records live in memory and expire after 24 hours. {origin: observed; cites: src/payments/idempotency.js:3-14, src/config/limits.js:2}
- R-21 Keep diffs minimal and run node --test before proposing a change. {origin: documented; cites: doc: CLAUDE.md#rules}

## Experience
Undecided, needs the Owner.

## Plan
Undecided, needs the Owner.

## Conflicts
- [ ] CF-1 (section: requirements) README.md describes three retries and a 48-hour TTL; src/payments/retry.js and src/config/limits.js implement one retry and 24 hours. | 1: Document the implemented limits | 2: Adopt the documented limits with a separately approved change
- [ ] CF-2 (section: requirements) docs/adr/0001-idempotency-ttl.md requires rejecting a missing key; test/webhook.test.js expects acceptance in the sandbox. | 1: Enforce the ADR | 2: Document an approved sandbox exception
- [ ] CF-3 (section: requirements) docs/architecture.md describes async reconciliation; src/config/flags.js keeps it off. | 1: Remove the active-feature claim | 2: Implement and validate the worker before enabling it
- [ ] CF-4 (section: requirements) docs/roadmap.md lists multi-currency settlement as planned. | 1: Keep it on the roadmap | 2: Scope implementation as new work
