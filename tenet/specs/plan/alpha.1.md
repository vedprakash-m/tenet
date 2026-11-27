---
tenet: {spec: 1, doc: plan, level: L2, version: "0.1", owner: ved}
sections:
  _preamble: {state: draft, digest: sha256:4601155f579c5471598542c511932dd4fc70c563b97d93ff1796d5d040f862ab, flags: []}
---
# Tenet plan: 0.1.0-alpha.1 (protect)

> Level L2 · Track 1 draft for Owner approval · Budget: 6,000 tokens · Part of [plan.md](../plan.md)

**Context card.** CP-0049 → CP-0007 → CP-0050 → CP-0019 and CP-0008. Keep alpha.0 records readable. Use CP-0040’s event table and the independent evaluator trial. Uses [kernel](../tech-spec/kernel.md) (K), [contracts](../tech-spec/contracts.md) (C), [CI](../tech-spec/ci.md), [agents](../tech-spec/agents.md) (AG) and the [technical specification](../tech-spec.md) (TS). Standard JSON envelopes, exit codes, and three-platform checks follow the alpha.0 build contracts.

**CP-0049 · Kernel schemas · R-010, R-173, R-179, R-180**
1. *Needs:* Alpha.0; TS §3; C §§1, 11; evidence §1; K §§1–3.
2. *Owns:* `kit/schemas/{subject,actor,claim,evidence,decision,event,work,criteria,step-assignment,step-result,loop}.json` (`$defs` payloads inside `evidence.json`; onboarding keeps `assignment.json`), `pkg/migrations/`, `test/schemas/kernel/`.
3. *Exports:* Named schemas (`…/schemas/0.1/<name>.json`) and `migratePacket(old) → {work, events, problems}`.
4. *Behavior:* Validate minimal and full records. `evidence.json` conditionally validates `kind` payloads (`evidence §1`, rejecting unlocated non-incomplete `review` findings; `proof`/`simulation`/`differential` accepted as data). `loop.json` validates structure (`steps` default `20`, all 3 `route.on` branches); cross-step graph rules stay in `check --pack`. `migratePacket` emits deterministic Crockford-Base32 ULIDs (`48-bit ms + 80-bit sha256(rfc8785({work, index, entry}))`), `problems` as `finding.json`, preserves legacy identities/history (including `standard` lane and duplicates), creates no inferred authority, leaves originals intact.
5. *Edge cases:* Unknown keys, `^x-` extensions, incomplete claims, duplicate history, malformed entries and repeat migration.
6. *Out of scope:* Evaluation, signing and execution. Reserve proof, simulation and differential names until their methods ship.
7. *Fixtures:* `test/schemas/kernel/<schema>/` with at least two positive and three negative inputs each, plus legacy and migrated packets.
8. *Proving:* `npm test -- test/schemas/kernel`. Named invalid fixtures fail as expected. All current packet files migrate and validate twice with identical output.

**CP-0007 · Events and reduction · R-018, R-030, R-037, R-039, R-091, R-185, R-186, R-200, R-201, R-203**
1. *Needs:* CP-0049; TS §§3, 5; ALG-01, ALG-05; CI §§3–4; L-0030; K §§1–2.
2. *Owns:* `src/kernel/{subjects,events,reduce,aliases,leases}.ts`, forge state observations, `test/kernel/{subjects,events}/`, conformance fixtures `events/` (`alg-01`, `alg-05`, `alpha.0-records`).
3. *Exports:* `subject(revision, exclusions)`, `readEvents(revision, work)`, `reduce(events, pack, asOf) → {state, justified_station, tentative_moves, conflicts, findings, applied, held}`, `recordForgeEvent(input)`, `readProofRecord(path, bytes)`, `deriveAlias(ulid, existingAliases)`, `activeLeases(events, asOf)`.
4. *Behavior:* Use one batched committed-record read. Reduce as K §1 (`tentative_moves` flip to `unjustified` at `asOf >= deadline`; structural errors emit `TN-EV-DUP`, `TN-EV-ORPHAN`, `TN-EV-CYCLE`, `TN-EV-CROSS-WORK`, `TN-EV-NO-CREATE`, `TN-EV-RESOLVE`). `recordForgeEvent` records `ready_for_review`, `converted_to_draft`, `closed` (`merged` -> `"integrated"`, unmerged -> `null`) with `data.forge` (`signed: false`) and returns `{recorded: false, reason: "stale-forge-event", observation}` when stale. `readProofRecord` returns `{kind, schema_version, data, unknown_fields}` read-only (throwing `TN-SCHEMA` on unsupported versions). Working-copy leases stay advisory.
5. *Edge cases:* Cycle, transitive orphan, duplicate, delayed input, repeated resolve, stale forge event, unsupported legacy version and unusual paths.
6. *Out of scope:* Gate decisions, signatures and exclusive leases.
7. *Fixtures:* `test/kernel/events/{cycles,orphans,duplicate,conflict,resolve,close}` and golden alpha.0 proof, latest pointer and rule observations.
8. *Proving:* `npm test -- test/kernel/subjects test/kernel/events`. Golden outcomes are invariant under permutations. Verify alpha.0 record preservation, cross-platform digests and the 10,000-event batch.

**CP-0050 · Gate, levels and rule modes · R-031, R-202, R-215**
1. *Needs:* CP-0007; TS §§4, 6.1; ALG-06 and ALG-07; CI §10; K §§2, 4.
2. *Owns:* `src/kernel/gate.ts`, `src/policy/modes.ts`, `level`, `rules`, `kit/schemas/results/{level,rules}.json`, recorder outcome mapping, `test/kernel/gate/`, conformance `gate/` (`alg-06`, `alg-07`, backtest).
3. *Exports:* `evaluateGate(input) → GateResult`, `ruleMode(policy, rule)`, `level(target, opts) → {previous_level, level, mode_changes, warnings}`, `rules(ruleId?, mode?, opts)`.
4. *Behavior:* Validate target policy and freshness. Evaluate every applicable row and return verdict, disposition, blocking (`{row, rule, claim_id, reason}`), ordered `reasons` and next action (`ALG-07`). Rule promotion (`observe -> advise|enforce`) requires an approved `change-policy` decision (`TN-POLICY-RULE-DECISION`); self-waivers fail with `TN-GATE-SELF-WAIVE`. Derive recorder conclusion from CI §10. Backtest the fixed 100-PR cohort (`TN-BACKTEST-INCOMPLETE` when incomplete) and time active overhead per K §4.
5. *Edge cases:* Advisory and enforced failures together, expiry boundary, stronger policy, changed requirement, missing inputs and incomplete backtest.
6. *Out of scope:* Signing, forge replies and undeclared policy changes.
7. *Fixtures:* `test/kernel/gate/{mixed,expired,stale,stop,unknown}/`, an input per ALG-07 row and the evaluator trial and backtest manifests.
8. *Proving:* `npm test -- test/kernel/gate`. Adding an enforced failure never weakens disposition. Match all evaluator-trial outputs. Record both thresholds and judgments for the full backtest.

**CP-0019 · Decisions on pull requests · R-090, R-101, R-102, R-108, R-123, R-177, R-203**
1. *Needs:* CP-0050; CI §§3, 4, 6; K §3 and observed parts of L-0030.
2. *Owns:* `src/verify/decisions.ts`, forge review and reply binding, attributed blessing and usefulness marks, `test/verify/decisions/`.
3. *Exports:* `makeRequest(input)` (`"tenet.decision.request.v1"` RFC 8785 tuple), `recordAnswer(request, event, snapshot) → {decision?, observation, findings}` (`TN-DEC-*`), `renderRequest(request)` and CI §6 replies.
4. *Behavior:* Persist the presentation before matching. Require actor, current request, evaluation and proof. Keep stale, withdrawn or ambiguous observations visible. Record below-`verify` self-acceptance with `proof.self_accepted: true` (`TN-DEC-SELF-VERIFY` at `verify+`). Store `/tenet bless` as `approve` (`name: "bless-section"`, `recorded: "forge"`) and `/tenet not-useful` as an observation (`kind: "not-useful"`, `finding_id`, `decision: null`). Verify new recorder triggers in the sandbox.
5. *Edge cases:* Two pending requests, same-commit edit, unlisted actor, late or concurrent reply, revocation, repeated delivery and exact section blessing.
6. *Out of scope:* Person-present activation and unobserved host guarantees.
7. *Fixtures:* `test/verify/decisions/{approve,late,edited,concurrent,unlisted,bless,self-accepted,not-useful,duplicate}/`.
8. *Proving:* `npm test -- test/verify/decisions`. Sandbox native approvals and replies resolve only their historical question and evaluation.

**CP-0008 · Full board · R-032, R-073, R-082, R-216**
1. *Needs:* CP-0050; TS §8; C §§5, 8; K §§1, 2, 4.
2. *Owns:* Remaining `src/views/`, board publication, `--since`, `--fetch`, `--open`, `test/views/`, board fixture gallery.
3. *Exports:* `projectBoard(snapshot, now, since?)`, `renderBoard(board) → {markdown, html}` (`<!doctype html>`, zero external scripts/styles; LF Markdown `Waiting for you|Blocked|Changed since you looked|Friction|Flow`) and the board JSON result.
4. *Behavior:* Use one snapshot across formats. Read CP-0049 decision records using fixtures before CP-0019 integration. Preserve apparent and justified state, conflicting heads, cost availability, modes, next actions, flow (`verified_per_week_by_lane`, `lead_time_hours`, `lane_mix_quick_express_pct`, `decision_wait_hours`, `cost`, `escapes`, `autonomy_share`), `self_accepted`, and friction (`flagged_for_demotion` when `not_useful_pct > 10 || false_blocks_per_100 > 2`). `--since` filters `items`/`decision_queue`/`review_queue`/`specs` (`TN-USAGE-REF` on invalid ref); stale trust (`> 7d`) degrades to `detected`; tampered events or ref drift emit `TN-EV-DUP`/`TN-RECORD-TIP`. Read external refs only on an allowed explicit fetch. Generated views stay untracked.
5. *Edge cases:* Empty change set, missing cost, old records, changed ref, conflict, stale trust and cold large workload.
6. *Out of scope:* External store, campaigns and current policy re-evaluation.
7. *Fixtures:* `test/views/{empty,legacy,tentative,conflict,friction,no-cost,changed}` plus the R-082 workload.
8. *Proving:* `npm test -- test/views`. Gallery facts and normalized output agree on all three platforms. Meet R-082 cold and warm targets.

**Coverage.** K §§1–4 define reducer errors, freshness, request identity and the backtest. CP-0007 owns golden alpha.0 records and state triggers. Apply CI’s release procedure and plan §1’s separate build and evidence gates.
