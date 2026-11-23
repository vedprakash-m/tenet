# Tenet plan: 0.1.0-alpha.1 (protect)

> Level L2 · Version 0.12 · Part of [plan.md](../plan.md) · Status: **draft, awaiting the Owner's approval** · Budget: 6,000 tokens · Added in L-0023 · Previous version: `archive/specs/plan/alpha.1.md@0.11.md`

**Context card.** Rules the Owner turns on block, and decisions are taken on pull requests. Each packet has build-contract fields 1 (Needs), 2 (Owns) and 8 (Proving) from [plan §4](../plan.md#4-build-contract); the other fields are written, and the part frozen, when alpha.0 ships. Order: CP-0049 → CP-0007 → CP-0050 → CP-0019 and CP-0008. Every packet keeps alpha.0 records readable. Before this part is frozen, the evaluator trial ([plan §4](../plan.md#4-build-contract)) runs, and the recorder's new triggers follow CP-0040's event table.

**CP-0049 · Kernel schemas** · R-010 (rest), R-173, R-179, R-180
1. *Needs:* alpha.0; TS §3; C §12.
2. *Owns:* `kit/schemas/` for the seven primitives (minimal and full), the event, the work item, criteria, assignment, result and loop, and the evidence payloads (`proof`, `simulation` and `differential` names reserved); a migration from `packet.json`; `test/schemas/`.
8. *Proving:* ≥2 valid and ≥3 invalid fixtures per schema pass or fail with the named keyword; every `packet.yaml` in this repository migrates and validates.

**CP-0007 · Events and reduction** · R-018, R-030, R-037, R-039, R-091, R-185, R-186, R-200, R-201, R-203
1. *Needs:* CP-0049; TS §3, §5; ALG-01, ALG-05; C §1, §7.
2. *Owns:* `src/kernel/{subjects,events,reduce,aliases,leases}.ts`; forge state recorded as events by the recorder (`works/pr-<n>/events/` on the records ref), including ready for review, conversion to draft and closing without merge; `test/kernel/`; `pkg/conformance/alg-01/`, `alg-05/`.
8. *Proving:* the same state in every arrival order; concurrent state events give a conflict and one `resolve` settles it; a resolution delivered twice applies once; the subject digest is identical on three platforms; property tests of the reducer.

**CP-0050 · Gate, rule modes, `level` and `rules`** · R-031, R-202, R-215
1. *Needs:* CP-0007; TS §4, §6.1; ALG-06, ALG-07.
2. *Owns:* `src/kernel/gate.ts`, `src/policy/modes.ts`, the commands `level` and `rules`; the recorder's check run concluding `failure` for an enforced rule; `test/kernel/gate/`; `pkg/conformance/alg-06/`, `alg-07/`.
8. *Proving:* one fixture per ALG-07 row, plus an advisory failure beside an enforced pass and a stop threshold with every claim passing; `tenet rules` shows each rule's "would have blocked" count; promoting a rule to `enforce` makes the check fail and is recorded as a decision.

**CP-0019 · Decisions on pull requests** · R-090, R-101, R-102, R-108, R-123, R-177, R-203
1. *Needs:* CP-0050; CI §6; spike CP-0017's results and CP-0040's event table.
2. *Owns:* `src/verify/decisions.ts`; reading native review approvals and `/tenet approve` or `/tenet pick` replies; forge-recorded blessing (`recorded: forge`); decision requests on the card; `/tenet not-useful` marks on findings (R-216); `test/verify/decisions/`.
8. *Proving:* a listed owner's approval counts; an edited reply, a reply from an unlisted person and a reply bound to an evaluation other than the latest card's do not; a self-acceptance is labelled; a review action on the onboarding pull request blesses its sections as `forge`.

**CP-0008 · Full board** · R-032 (rest), R-073, R-082, R-216
1. *Needs:* CP-0050; TS §8; C §5.
2. *Owns:* `src/views/` (work items, the default view of waiting for you, blocked, and changed since you looked, next actions, friction per rule, `--since`, `--open` with a single-file `now.html`); publishing `board/board.json` on the records ref; the fixture gallery; `test/views/`.
8. *Proving:* the same refs and as-of time give byte-identical output on three platforms; every gallery fixture renders; R-082 timing with 10,000 event files on Windows.

**Release 0.1.0-alpha.1:** CI §9's release procedure, then the gate in [plan §1](../plan.md#1-milestones).
