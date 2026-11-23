# CP-0006 · Answers to the round 3 specification questions

Answers to the round 3 review of `CP-0006` (`src/policy/load.ts`), decided on 2026-11-23.

1. **Unregistered error and notice codes emitted by `src/policy/load.ts`.**
   - Register all three codes emitted by `src/policy/load.ts` and asserted by `test/policy/policy.test.ts` directly in `contracts.md §13` and `messages.md §2`:
     - `TN-POLICY-SCHEMA` (structural, exit 1): emitted when `tenet.yaml` is invalid YAML or fails `tenet-yaml` schema validation.
     - `TN-POLICY-ALPHA0-CAP` (warning/notice, exit 0, `severity: "advise"`): recorded in `policy.findings` when a rule's effective mode is capped from `enforce` to `advise` in alpha.0 (`alpha.0.md:68`: "capping every rule at `advise` in alpha.0 with a notice").
     - `TN-USAGE-REF` (usage, exit 2, under `TN-USAGE-*`): emitted when `options.ref` is invalid (such as starting with `-`).
   - **Spec edits:** `tenet/specs/tech-spec/contracts.md` §13 (`lines 166–171`) and `tenet/specs/tech-spec/messages.md` §2.
