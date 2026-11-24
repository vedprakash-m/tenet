# Answers — CP-0049 round 10

Answers to `tenet/packets/CP-0049-kernel-schemas/escalations/proposals-r9.md`:

1. **Schema filenames and primitive `$id`s (`contracts.md §1`; `plan/alpha.1.md` CP-0049)**
   Each kernel record schema lives at `kit/schemas/<name>.json` with `$id` `https://vedprakash-m.github.io/tenet/schemas/0.1/<name>.json`:
   - Primitives: `subject.json`, `actor.json`, `claim.json`, `evidence.json`, `decision.json`, `event.json` (Policy remains `tenet-yaml.json`).
   - Evidence payload schemas from `evidence.md §1` live under `$defs` in `evidence.json`.
   - Work and loop schemas: `work.json`, `criteria.json`, `step-assignment.json`, `step-result.json`, `loop.json` (keeping existing onboarding `assignment.json` unchanged for `.tenet/onboard/assignment.json`).

   *Coordinator note for CP-0054-locked files (`tech-spec.md §3` line 56):* add "(schema files `{subject,actor,claim,evidence,decision,event,work,criteria,step-assignment,step-result,loop}.json`)" after `validated by kit/schemas/` once CP-0054 merges.

2. **`migratePacket(old) -> {work, events, problems}` exact output (`plan/alpha.1.md` CP-0049)**
   - Never mutates `old`. Preserves legacy `CP-NNNN` identity and observed history fields (including legacy `lane: "standard"` and duplicate `history[]` rows) without inferring claims, decisions, or approvals.
   - `work` matches `work.json` (`{ schema_version: 1, id, title, type, lane, priority, due, levels, serves, implements, milestone, source, blocked_by, unblocks, candidate, appetite, spent, owner_role, claimed_by }`).
   - `events[]` contains `event.json` objects ordered across `old.history[]` (`index === 0` emits `work.created` with `prev: []`; station targets emit `work.moved`; holding-status targets `blocked|waiting-owner|parked|active|cancelled|superseded` emit `work.status`; each `events[i].prev` links `[events[i - 1].id]`).
   - Deterministic ULIDs: 10 uppercase Crockford Base32 chars for the 48-bit UTC millisecond timestamp (`YYYY-MM-DDTHH:MMZ` treated as `:00Z`) + 16 uppercase Crockford Base32 chars from the first 80 bits of SHA-256 over RFC 8785 `{ work: old.id, index, entry }` — identical across repeated migrations.
   - `problems[]` holds `finding.json` records (`code: "TN-SCHEMA"`, `severity: "error"`, `rule: null`, `file: null`, `line: null`, `message`, `fix`); invalid entries produce findings rather than throwing.

3. **Evidence payload validation vs evaluator enforcement (`plan/alpha.1.md` CP-0049; `evidence.md §1`)**
   `kit/schemas/evidence.json` conditionally validates `payload` against the `kind`-specific schema in `$defs` when both `kind` and `payload` are present (including requiring `review` findings when `status !== "incomplete"` to be `located` or listed in `invalid`), and accepts `proof`, `simulation`, and `differential` payload structures cleanly. Evaluator claim satisfaction still rejects unshipped methods (`proof`, `simulation`, `differential`) at evaluation time (`CP-0049` *Out of scope*).

4. **`loop.json` structural validation vs `check --pack` (`agents.md §5`)**
   `kit/schemas/loop.json` enforces structure (`additionalProperties: false` + `^x-`, required `loop`, `kind: "station"|"fix"`, `applies`, `limits: {rounds, steps?}` defaulting `steps` to `20`, discriminated `steps[]` with `kind: "agent"|"script"|"human_gate"|"set"|"route"`, and `route.on` requiring `advance`, `refuse`, `human-gate` targets as strings or `{if, goto, else}`). Cross-step graph checks (`stop` first on `human_gate`, backward `fix:<id>`, monotonic counters, existing targets) stay in `tenet check --pack`.

   *Coordinator note for CP-0054-locked `agents.md §5` (line 136):* note "`kit/schemas/loop.json` validates structure and `route.on` keys; graph checks stay in `check --pack`."

5. **Criteria schema (`kit/schemas/criteria.json`) (`plan/alpha.1.md` CP-0049)**
   `$id: "https://vedprakash-m.github.io/tenet/schemas/0.1/criteria.json"` validates `{ schema_version: 1, work, implements: [string], acceptance: [{ id, text, class, methods: [string], pass_rule, test_ids: [string] }] }`, permitting `^x-` keys and rejecting unknown keys.
