---
tenet: {spec: 1, doc: tech-spec, level: L2, version: "0.1", owner: ved}
sections:
  _preamble: {state: draft, digest: sha256:437c50b1c325dc75159652cdf187218ba1bf5c0d25e0fb4121a538e23956301e, flags: []}
  1-state-reduction-and-replay: {state: draft, digest: sha256:6d3404af6ccd6a09814aff5817a19d3f55df04ac8cb7e0a0f354204a31104ad0, flags: []}
  2-evaluation-inputs-and-evidence: {state: draft, digest: sha256:29187704f25030d3e0e9f4ece2057437f524c85e10f9f5f996feb4c77819479f, flags: []}
  3-decision-requests-and-proof: {state: draft, digest: sha256:535ead503c8fc6382a5ba23403a0a6e4a4eef9d72d80384ee50d8ac473ed0215, flags: []}
  4-alpha1-backtest: {state: draft, digest: sha256:b9d12ea64f18c176c9eaf559b16d0413da0c54db1cdfacbe81be9ffa72e66376, flags: []}
  5-merge-candidates-and-required-outcomes: {state: draft, digest: sha256:30fe23df8bde0d3b9a8385d70721fad1e366203c6229e1bad8aab3a42145e982, flags: []}
---
# Tenet technical specification: kernel contracts

> Level L2 · Draft for Owner approval · Budget: 6,000 tokens · Implements Part I. The bindings in CI and agents supply transport and execution.

## 1. State reduction and replay

Read the selected store revision in one batch. Reduce one work item at a time. Order eligible events by ancestry and break ties by ASCII event ID. Return `{state, justified_station, tentative_moves, conflicts, applied, held, findings}` (`conflicts` are conflict heads; `findings` are sorted `TN-EV-*`). The following table supplies the missing ALG-05 cases for CP-0007.

| Input | Outcome |
|---|---|
| No valid creation | No effective work state. Preserve reported facts and why state is unavailable. |
| One valid creation | Initialize the immutable work identity and starting station. Multiple incompatible causally unrelated creations have no effective identity until resolved. |
| Identical canonical events with the same ID | Apply once. |
| Same ID with distinct content | Report `TN-EV-DUP`. Exclude all candidates for that ID and hold dependents. |
| Missing predecessor | Report `TN-EV-ORPHAN`. Hold it and its descendants until the predecessor is available. |
| Cycle or self-link | Structural invalid history for the cycle. Hold its descendants. Reduce independent valid history. |
| Predecessor belongs to a different work item | Structural invalid predecessor. Hold its descendants. |
| Comparable state events | Apply in causal order using the pack's legal edges. |
| Concurrent disjoint changes | Merge named fields, subject to ALG-05's closure rule. |
| Concurrent incompatible changes | Keep the prior effective value and competing heads visible. Refuse advancement until resolution. |
| Authorized resolution naming every conflicting head and the retained event | Apply the chosen change. A later incompatible concurrent event reopens the conflict. |

| Event | State affected |
|---|---|
| `work.created` | Initialize identity. A later conflicting creation does not replace it. |
| `work.changed` | Only the named fields, tasks and dependencies. |
| `work.moved` | Station. A tentative move is a distinct observed fact through replay. |
| `work.status` | Holding status. |
| `work.closed` | Observed closure and computed endpoint. External closure gives no automatic verified endpoint. |
| `claim.stated` | Add, replace or retire the named claim under its authority. |
| `decision.*` | Record the request or answer. Only an eligible decision supplies authority or resolves a conflict. |
| `evidence.recorded`, `run.*`, `gate`, `lease.*` | Append observations. Lease strength depends on the actual atomic provider. |

Replay uses the recorded policy, evidence-store and trust snapshots, pack, evaluator revision and evaluation time, returning transitions `{event_id, type, status: "justified"|"pending-evidence"|"unjustified", reason?}` and `state.endpoint` (`checked|integrated|implemented-unverified|cancelled|superseded|null`). Preserve the rule and evidence or decision IDs for each claim. Replaying today means reproducing that historical decision. Re-evaluation against today's inputs is a separate operation. Tentative moves supply no advancement authority. At the pending deadline an unresolved tentative move becomes unjustified. An observation arriving later can support a new evaluation. Preserve and expose the historical view. Test cycles, cross-work edges, both duplicate cases, delayed parents, resolution permutations and independent state in a partial failure.

## 2. Evaluation inputs and evidence

Keep three identities distinct: the code or other subject, the evaluation input identity, and the immutable observation or run attempt. The evaluation names the repository, work, target revision, tested revision, acceptance basis, sorted relevant blessed requirement digests and target policy under contracts §1 and CI §3. An observation carries its receipt identity and check inputs. A retry supplies another observation, with independent provenance and result.

An evidence record may satisfy a claim only when the subject, claim, applicable requirement revision, acceptance basis, policy, pinned check and required input digests agree with the evaluation. Require an admitted method, complete passing cases where mapped, required strength on both axes, visibility in the evaluation snapshot, and an unexpired validity interval. A value is expired at its deadline. Treat missing required inputs as unknown and identify them. An old observation remains visible with its actual outcome. Under CI §3 a description edit may reuse an underlying test report only by mapping it to the new claim basis and evaluating it again. An older verdict or approval gives no authority for the new evaluation. Apply ALG-07 to every applicable row. Include the blocking reason when the lead finding is advisory.

Read legacy alpha.0 proof and rule records with a versioned reader. Preserve known values and leave absent facts unknown. Read compatibility is distinct from evidence eligibility. Keep golden receipts, pointers, rule observations and an unknown-version example.

The R-009 and evaluator-trial YAML files supply fixture envelopes around the primitives. They pin evaluations, applicable claims, reports, decisions, observed modes and causal heads. Their synthetic IDs are opaque and their custom packs exercise kernel semantics independent of release schedules. The projected expected JSON uses lower-case machine actions. `advance` has no actor. Missing or stale evidence yields `ci/wait-for-evidence`. Missing approval yields `owner/request-decision`. A failed check with rounds available yields `builder/revise`. An unresolved conflict yields `owner/resolve`. Fixture command fields are null because renderer commands are not part of the expected projection.

## 3. Decision requests and proof

Persist the request and presentation before accepting an answer. Its identity is `sha256:` followed by the SHA-256 of the UTF-8 RFC 8785 serialization with domain `"tenet.decision.request.v1"` and repository, work, target, subject, decision kind, question, ordered `choices: [{id, label}]`, displayed evaluation, target policy revision, allowed actors sorted by ID and expiry. The selected choice binds that immutable request. Recompute authorization against its scope, proof minimum and permitted actor.

Preserve the forge source ID, reviewed revision, creation time and observed content digest. Exact redelivery is idempotent. Edits, dismissals, withdrawals and stale replies remain observations. A native review can count only when the reviewed commit and one request or evaluation can be established at submission. An unqualified reply can count only if the binding establishes one eligible presented request at submission. Explicit evaluation references cannot transfer between requests. Ambiguity or a late reply prompts a fresh decision. Concurrent compatible duplicates are equivalent. Competing answers leave the request unresolved until an authorized decision resolves the conflict. A waiver needs the eligible claim, matching scope, authorized actor, reason, strength and unexpired time. Follow R-203 for self-waivers and CI §6 for reserved rights.

### Person-present wire payload

CP-0046 supplies canonical fixtures and verifies capability. The assure-level activation remains in CP-0047 and depends on observed hardware-backed user presence. The signing input is the UTF-8 RFC 8785 serialization of this record under the `tenet-decision` namespace:

```text
{domain: "tenet.decision.person-present.v1", repository, work, request_id,
 evaluation_id, subject, policy_revision, decision_kind, choice_id,
 actor_id, challenge, expires_at}
```

The detached signature and key ID travel beside the signed bytes. Generate a fresh random challenge at the trusted issuer, persist it scoped to the actor and request, and consume it atomically with acceptance. Verify canonical fields and domain, repository as audience, scope, signature and key authority, observed user presence, expiry and challenge state. Exact redelivery returns the original result. A distinct reuse fails. An ordinary key signature does not establish user presence. The release proving records unobserved presence as unavailable.

## 4. Alpha.1 backtest

Freeze a manifest of 100 distinct historical pull requests drawn from Tenet, Torus and one public project. Record repository, time window, inclusion and selection procedure before evaluating results. Pin the facts, policy and evaluation times. Use the recorded information available at each decision point. The independent adjudicator records whether the refusal was warranted under the applicable rule at that time and records a reason.

Count a PR once in the headline false-block total when any enforced refusal is independently found wrong. Record per-rule findings separately. A waiver or not-useful mark is an input for adjudication. A case with inadequate history is unassessable. Incomplete coverage (`coverage < 100` or any `incomplete: true`) fails validation with `TN-BACKTEST-INCOMPLETE` before claiming the 100-PR threshold. The result records the numerator, denominator, coverage and rule breakdown. Time active Tenet-specific human work, such as finding and correcting records, separately from ordinary review and waiting. Record the measurement protocol and sample distribution. Apply plan §1’s strict false-block threshold. Publish the duration for each trial including zero-active-work trials. The overhead metric is `mean_active_minutes_per_pr = total_active_minutes / 100` with complete timing coverage.

## 5. Merge candidates and required outcomes

For a merge-group event bind the candidate to repository, provider candidate identity, candidate revision, target revision and listed member work. Evaluate the exact candidate under the target policy and publish on the candidate revision. The original PR head does not establish the candidate's evidence. A superseded group remains in history without authority over its replacement. Missing, ambiguous or incomplete required observations hold a protected transition under CI §10. Keep read-only test execution, protected recording and signature claims distinct. Demonstrate required status on actual branch protection before declaring forge enforcement. Alpha.1 can record the merge-group observation under CI §3. Alpha.2 checks the exact candidate before publishing its required status. R-152 and CP-0035 cover the later merge-queue evidence capability. Resolve the delivery boundary with the Owner if integration treats them as the same commitment.
