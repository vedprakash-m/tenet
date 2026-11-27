# Track 1 (GPT) · readiness of CP-0049 and CP-0007

**Your file:** `tenet/packets/CP-0067-groundwork-0.2.0/readiness-cp-0049-cp-0007.md`. Your pull request adds nothing else.

## Scope

- [plan/alpha.1.md](../../../specs/plan/alpha.1.md), the entries **CP-0049 · Kernel schemas** and **CP-0007 · Events and reduction**.
- Every section their *Needs* lines name:
  - TS §3 and §5;
  - contracts §1 and §11;
  - evidence §1;
  - kernel §1 to §3;
  - ALG-01 and ALG-05;
  - CI §3 and §4;
  - L-0030;
  - `agents.md` lines 169 and 184, which `kernel-schemas/README.md` cites.
- Today's code, for name collisions and for seams these packets plug into: `src/` (`core/`, `verify/`, `views/`, `policy/`) and `kit/schemas/`.
- The independent cases in `pkg/conformance/kernel-schemas/` and `pkg/conformance/events/`. Read them only to compare. Track 2 audits them in depth.

## Method

For each packet, work through the eight fields in order:

1. **Needs.** Open every reference. Does it exist, and does it say what the contract assumes?
2. **Owns.** Check each path. Does it exist already? Would creating it collide with 0.1.x code? For example, `kit/schemas/` already ships schemas; list which names would clash.
3. **Exports.** Write each signature in your report, not in `src/`, with three to five lines of pseudocode taken only from the text. Every point where you had to guess is an **invention**: record it.
4. **Behavior.** Follow each rule to its algorithm or contract section. Pay particular attention to:
   - the ULID recipe in `migratePacket` (bit layout, the exact hash input, RFC 8785);
   - the error codes. Check that every `TN-…` code is defined in the contracts' error table, and list any that aren't.
5. **Edge cases.** Is each one defined well enough to write a test?
6. **Out of scope.** Does it conflict with anything a later packet expects from this one?
7. **Fixtures.** Do the named folders match the independent cases? List what's missing on either side.
8. **Proving.** Would `npm test -- test/schemas/kernel` actually select those tests with `scripts/run-tests.mjs`? Check how that script handles path arguments.

Then check **drift since 2026-11-23**. 0.1.0 and 0.1.1 changed packets, records and anchors; for example, CP-0066 AB-E2 now stores only hashes. List everything that changes what these two contracts assume, especially:
- "alpha.0 records", which now means the records 0.1.0 and 0.1.1 write;
- `migratePacket` against the packet files in `tenet/packets/` as they exist today. Count those files and name any field the contract doesn't handle.

## Report shape (exactly this)

```
# Readiness · CP-0049 and CP-0007
## Summary
| Packet | Verdict | gap | stale | conflict | Inventions | Owner decisions |
## CP-0049 · Kernel schemas
| # | Field | Verdict | Evidence | Problem | Proposed text |
(eight rows, 1 Needs … 8 Proving)
### Inventions
1. <rule a builder would have to invent> · where it belongs (file#section) · proposed text
### Drift since 2026-11-23
## CP-0007 · Events and reduction
(same three parts)
## Owner decisions
D-1 · question · options · recommendation · why
```

The packet verdict is **ready** (no gap, stale or conflict rows), **ready after fixes** (every problem has proposed text and no Owner decision blocks it) or **not ready**.
