# Deferred edits for `CP-0054`-locked specifications

Collected from round 10–12 specification answers (`answers-r10.md`, `answers-r11.md`, `answers-r12.md`). Apply after `CP-0054` merges, keeping every edited document below 90% of its `Budget` header (`tenet/specs/tech-spec/agents.md` is near `89.4%`, so keep its phrasing compact).

## 1. `tenet/specs/tech-spec.md` §3 (`line 56`)
- **Source:** [CP-0049/escalations/answers-r10.md](../../CP-0049-kernel-schemas/escalations/answers-r10.md#L11)
- **File & line:** `tenet/specs/tech-spec.md:56`
- **Old text:**
```markdown
<!-- provisional --> These are the only normative record types. All are YAML or JSON validated by `kit/schemas/`; timestamps are UTC RFC 3339 with seconds; hashes are full and algorithm-tagged.
```
- **New text:**
```markdown
<!-- provisional --> These are the only normative record types. All are YAML or JSON validated by `kit/schemas/` (schema files `{subject,actor,claim,evidence,decision,event,work,criteria,step-assignment,step-result,loop}.json`); timestamps are UTC RFC 3339 with seconds; hashes are full and algorithm-tagged.
```

## 2. `tenet/specs/tech-spec.md` §8 (`line 223`)
- **Source:** [CP-0008/escalations/answers-r11.md](../../CP-0008-tenet-board/escalations/answers-r11.md#L23)
- **File & line:** `tenet/specs/tech-spec.md:223`
- **Old text:**
```markdown
- **`board.json`** (schema in [contracts §5](tech-spec/contracts.md#5-proof-card-and-board-models); `tenet board --since <rev>` returns only changed items). In 0.1.0-alpha.0, `tenet board` (CP-0053) reads only the repository: specifications, their states and flags, the blessing queue and spec debt; pull requests and decisions join from alpha.1 through the records ref. `now.md` and a single-file `now.html` render it, opening on **waiting for you, blocked, and changed since you looked**, with flow, areas, campaigns and audit detail one level down; generated views are never committed (this repository's hand-written `now.md` is an M0 exception until CP-0053). A **fixture gallery** (`pkg/conformance/boards/`) holds boards for tentative moves, conflicts, waivers, flags and stale trust.
```
- **New text:**
```markdown
- **`board.json`** (schema in [contracts §5](tech-spec/contracts.md#5-proof-card-and-board-models); `tenet board --since <rev>` returns only changed items and exits with `TN-USAGE-REF` on an invalid ref; tampered or drifted records emit `TN-RECORD-TIP` or `TN-EV-DUP` in `board.json.findings[]`). In 0.1.0-alpha.0, `tenet board` (CP-0053) reads only the repository: specifications, their states and flags, the blessing queue and spec debt; pull requests and decisions join from alpha.1 through the records ref. `now.md` and a single-file `now.html` render it, opening on **waiting for you, blocked, and changed since you looked**, with flow, areas, campaigns and audit detail one level down; generated views are never committed (this repository's hand-written `now.md` is an M0 exception until CP-0053). A **fixture gallery** (`pkg/conformance/boards/`) holds boards for tentative moves, conflicts, waivers, flags and stale trust.
```

## 3. `tenet/specs/tech-spec/agents.md` §5 (`line 136`)
- **Source:** [CP-0049/escalations/answers-r10.md](../../CP-0049-kernel-schemas/escalations/answers-r10.md#L26)
- **File & line:** `tenet/specs/tech-spec/agents.md:136`
- **Old text:**
```markdown
A loop is data in `kit/loops/<name>.yaml` (schema `kit/schemas/loop.json`, CP-0049). The pack names one **station loop** per station and lane (`define`, `build`, `verify`); they share the **fix loop**. Projects may only narrow a loop: fewer rounds, more checks, stricter cards.
```
- **New text:**
```markdown
A loop is data in `kit/loops/<name>.yaml` (`kit/schemas/loop.json` validates structure and `route.on` keys; graph checks stay in `check --pack`, CP-0049). The pack names one **station loop** per station and lane (`define`, `build`, `verify`); they share the **fix loop**. Projects may only narrow a loop: fewer rounds, more checks, stricter cards.
```

## 4. `tenet/specs/tech-spec/kernel.md` §1 (`line 7`)
- **Source:** [CP-0007/escalations/answers-r10.md](../../CP-0007-tenet-new-move-state-only-status/escalations/answers-r10.md#L11)
- **File & line:** `tenet/specs/tech-spec/kernel.md:7`
- **Old text:**
```markdown
Read the selected store revision in one batch. Reduce one work item at a time. Order eligible events by ancestry and break ties by ASCII event ID. Return the effective state, justified station, tentative moves, conflict heads, applied and held IDs, and sorted findings. The following table supplies the missing ALG-05 cases for CP-0007.
```
- **New text:**
```markdown
Read the selected store revision in one batch. Reduce one work item at a time. Order eligible events by ancestry and break ties by ASCII event ID. Return `{state, justified_station, tentative_moves, conflicts, applied, held, findings}` (`conflicts` are conflict heads; `findings` are sorted `TN-EV-*`). The following table supplies the missing ALG-05 cases for CP-0007.
```

## 5. `tenet/specs/tech-spec/kernel.md` §1 (`line 34`)
- **Source:** [CP-0042/escalations/answers-r12.md](../../CP-0042-replay-trust-observations-and-close/escalations/answers-r12.md#L8)
- **File & line:** `tenet/specs/tech-spec/kernel.md:34`
- **Old text:**
```markdown
Replay uses the recorded policy, evidence-store and trust snapshots, pack, evaluator revision and evaluation time. Preserve the rule and evidence or decision IDs for each claim. Replaying today means reproducing that historical decision. Re-evaluation against today's inputs is a separate operation. Tentative moves supply no advancement authority. At the pending deadline an unresolved tentative move becomes unjustified. An observation arriving later can support a new evaluation. Preserve and expose the historical view. Test cycles, cross-work edges, both duplicate cases, delayed parents, resolution permutations and independent state in a partial failure.
```
- **New text:**
```markdown
Replay uses the recorded policy, evidence-store and trust snapshots, pack, evaluator revision and evaluation time, returning transitions `{event_id, type, status: "justified"|"pending-evidence"|"unjustified", reason?}` and `state.endpoint` (`checked|integrated|implemented-unverified|cancelled|superseded|null`). Preserve the rule and evidence or decision IDs for each claim. Replaying today means reproducing that historical decision. Re-evaluation against today's inputs is a separate operation. Tentative moves supply no advancement authority. At the pending deadline an unresolved tentative move becomes unjustified. An observation arriving later can support a new evaluation. Preserve and expose the historical view. Test cycles, cross-work edges, both duplicate cases, delayed parents, resolution permutations and independent state in a partial failure.
```

## 6. `tenet/specs/tech-spec/kernel.md` §3 (`line 48`)
- **Source:** [CP-0019/escalations/answers-r11.md](../../CP-0019-decisions/escalations/answers-r11.md#L10)
- **File & line:** `tenet/specs/tech-spec/kernel.md:48`
- **Old text:**
```markdown
Persist the request and presentation before accepting an answer. Its identity is `sha256:` followed by the SHA-256 of the UTF-8 RFC 8785 serialization with a request-domain label and repository, work, target, subject, decision kind, question, ordered choice IDs and labels, displayed evaluation, target policy revision, allowed actors sorted by ID and expiry. The selected choice binds that immutable request. Recompute authorization against its scope, proof minimum and permitted actor.
```
- **New text:**
```markdown
Persist the request and presentation before accepting an answer. Its identity is `sha256:` followed by the SHA-256 of the UTF-8 RFC 8785 serialization with domain `"tenet.decision.request.v1"` and repository, work, target, subject, decision kind, question, ordered `choices: [{id, label}]`, displayed evaluation, target policy revision, allowed actors sorted by ID and expiry. The selected choice binds that immutable request. Recompute authorization against its scope, proof minimum and permitted actor.
```

## 7. `tenet/specs/tech-spec/kernel.md` §4 (`line 68`)
- **Source:** [CP-0050/escalations/answers-r10.md](../../CP-0050-gate-rule-modes-level-and-rules/escalations/answers-r10.md#L24)
- **File & line:** `tenet/specs/tech-spec/kernel.md:68`
- **Old text:**
```markdown
Count a PR once in the headline false-block total when any enforced refusal is independently found wrong. Record per-rule findings separately. A waiver or not-useful mark is an input for adjudication. A case with inadequate history is unassessable. Report which cases are missing and rerun with a complete prespecified sample before claiming the 100-PR threshold. The result records the numerator, denominator, coverage and rule breakdown. Time active Tenet-specific human work, such as finding and correcting records, separately from ordinary review and waiting. Record the measurement protocol and sample distribution. Apply plan §1’s strict false-block threshold. Publish the duration for each trial including zero-active-work trials. The plan leaves the summary statistic for the overhead threshold unspecified. The proposal for Owner approval is total attributable active minutes divided by 100 with complete timing coverage.
```
- **New text:**
```markdown
Count a PR once in the headline false-block total when any enforced refusal is independently found wrong. Record per-rule findings separately. A waiver or not-useful mark is an input for adjudication. A case with inadequate history is unassessable. Incomplete coverage (`coverage < 100` or any `incomplete: true`) fails validation with `TN-BACKTEST-INCOMPLETE` before claiming the 100-PR threshold. The result records the numerator, denominator, coverage and rule breakdown. Time active Tenet-specific human work, such as finding and correcting records, separately from ordinary review and waiting. Record the measurement protocol and sample distribution. Apply plan §1’s strict false-block threshold. Publish the duration for each trial including zero-active-work trials. The overhead metric is `mean_active_minutes_per_pr = total_active_minutes / 100` with complete timing coverage.
```

## 8. `tenet/specs/prd.md` §4 (`line 74`, `R-033`)
- **Source:** [CP-0009/escalations/answers-r12.md](../../CP-0009-tenet-check-structure/escalations/answers-r12.md#L10)
- **File & line:** `tenet/specs/prd.md:74`
- **Old text:**
```markdown
| R-033 | `tenet check` runs structure, traceability and citation (R-210), change-control (R-209), section-state, event, alias and budget checks; findings block only for rules in `enforce` mode (tooling R-215); `tenet fix` repairs the mechanical ones | V-P2, V-M2 | 0.1.0 | detected | proposed |
```
- **New text:**
```markdown
| R-033 | `tenet check` runs structure, traceability and citation (R-210), change-control (R-209), section-state, event, alias and budget checks; direct `tenet check` treats broken citations (`TN-CITE-*`) as `error`, while `--ci --base` blocks only for rules in `enforce` mode (tooling R-215); `tenet fix` repairs the mechanical ones | V-P2, V-M2 | 0.1.0 | detected | proposed |
```
