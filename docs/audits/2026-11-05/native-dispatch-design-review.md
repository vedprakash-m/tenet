# Native dispatch issuance and settlement — bounded design proposal

Date: November 5, 2026. **Proposal for independent review and a narrow owner decision; not approved runtime or schema.** This reviewer changed no runtime, budget or canonical contract and ran no tests. This document is the only authored file. The preserved protocol candidate and current main are distinct inputs; historical candidate tests are not passing evidence for this proposal.

## Outcome and evidence boundary

Give each kernel-issued Reviewer/Analyst assignment a durable identity that survives proof invalidation. A matching native result or the existing native retry operation may consume its delegation unit once; repeats cannot consume it again. Losing proof eligibility never proves that an assignment did or did not run. Keep unknown exposure visible and conservative without turning a packet reservation into an observed dispatch.

There is no qualified host-start observer. Consequently the system can report **kernel-accounted units**, **results reported as native**, **retry-accounted units**, **pending capacity exposure**, and **observed native dispatches: unknown**. It cannot establish the actual number of host invocations, executions that bypassed Tenet, or two physical invocations that reused one packet identity. Existing host reporting remains cooperative. No model/account/spend authority, host operation, observer hook or new reconciliation command is proposed.

## Existing contracts and the precise missing mechanism

- Tech Spec section 6.5 says results bind to reservation/attempt, can arrive out of order and each settles once.
- Section 8.6 counts every reported native dispatch, stale or not, and `packet --retry`; a lost child consumes its retry as a delegation but no review round. Reservations hold capacity; retries have new attempts and the existing retry bound.
- `config-completion.md` section 16.5 requires stale native dispatch to be charged exactly once while withholding current proof/round/recheck credit.
- Current `core/budget.ts:releaseStale` deletes identities. `recordDelegation` and `settleReservation` are unconditional increments. `verbs/findings.ts` charges an unmatched native result without retaining a settlement identity. `verbs/manifest.ts:reserveIssued` charges the replaced native reservation during retry. A late result can therefore charge that same old assignment again.
- The schema-2 check launch ledger cannot be reused: its records describe tests/static/e2e processes, captured obligation units and spawn phases, not native reviewer/Analyst assignments. Its process ownership protocol is unrelated to whether the host dispatched a packet.

## One genuine owner choice: stale/no-result capacity

The canonical text releases a hold when its manifest becomes invalid. That cannot establish that an unobserved host dispatch never started. Releasing it and issuing another packet can silently reopen capacity while the earlier dispatch remains possible. A durable identity alone does not solve this epistemic gap.

| Choice | Concrete behavior and scope | Consequence |
|---|---|---|
| **A — retain uncertain capacity exposure (recommended)** | Retire the packet for proof but retain its pending native hold until a matching reported result or existing `packet --retry` accounts for it. Do not increment `delegations` merely on issuance/retirement. Amend TS section 8.6 so proof validity and capacity exposure are separate. Add the ledger and derived reporting below; no new action API. | Honest unknown actual dispatch; no silent reopening. A no-result retired assignment can consume the remaining capacity until the existing retry path accounts for it or the work ends. |
| B — consume an explicit upper-bound unit on retirement | Retiring a possibly dispatched packet accounts for one unit immediately, marked `retirement-upper-bound`; a late result adds no unit. Requires a new accounting provenance case, count wording and tests, in addition to the ledger. | Preserves the same conservative capacity but can overcount known dispatches and broadens delegation semantics beyond existing result/retry triggers. Less honest/useful than A unless separately labeled. |
| C — preserve release-on-invalid behavior | Keep durable duplicate suppression for results/retries but release the old hold with an explicit unknown-exposure notice. Narrow any claim that the native capacity limit prevents further exposure. | Smallest behavioral change, but cannot provide the requested conservative no-reopening guarantee. Any withdrawn assurance claim needs the corresponding canonical/release disposition. |

This decision does not ask whether to count stale native results, whether same-session review delegates, or whether retries count: those are settled. **Do not implement A as though its TS wording amendment were already approved.** The remaining representation/algorithm choices below are proposed engineering details, not additional policy polls.

## Smallest concrete representation

Extend only the inactive schema-2 `BudgetState2` with one versioned `nativeAccounting` value. Reuse the existing accounting checkpoints/publication and cumulative recovery snapshot. Do not add a launch kind, sidecar log, second publication pipeline or public flag.

```ts
NativeAccountingV1 = {
  version: 1,
  issued: NativeIssue[],
  unissuedReports: UnissuedNativeReport[]
}

NativeIssue = {
  id: OpaqueKernelId,
  owner: { workspaceId: WorkspaceId, work: WorkId, generation: SafeNonnegative },
  reservation: OpaqueKernelReservationId,
  attempt: SafePositive,
  manifestHash: Sha256,
  role: "reviewer" | "analyst",
  analystRole?: "researcher" | "architect" | "security",
  reviewMode: "full" | "recheck",
  expectedDispatch: "subagent-fresh" | "same-session",
  candidate: CandidateIdentity,
  basisHash: BasisIdentity,
  issuedBinding: ConfigStamp,
  retryOf?: OpaqueKernelId,
  retries: ExistingRetryCount,
  retired: boolean,
  settlement: null | { via: "result" | "retry" },
  resultDigest?: Sha256
}

UnissuedNativeReport = {
  identityHash: Sha256,
  resultDigest: Sha256
}
```

These names are a review proposal, not existing types or approved persisted fields. Use strict versioned decoders, existing workspace/work/hash/numeric validators, exact role-field combinations and unique IDs/keys. Bound complete JSON bytes/depth before parsing under existing private-record limits; strings are fixed kernel tokens or existing bounded identities. Arrays are finite because their admitted record bytes are finite; do not invent a larger byte ceiling or silently truncate rows. Charge growth to the original budget/schema/store/central owners and existing protected storage limits. Measure actual row/count and worst-case state/checkpoint/snapshot bytes before implementation sign-off; a separate smaller count cap would require an explicit supported-workload rationale.

### Identity and payload rules

- Allocate a fresh opaque kernel ID for every newly issued assignment, including retries. Use the existing random port, sufficient fixed entropy and a collision check against admitted retained IDs. Do not derive identity from mutable `delegations + live reservations`; that value can repeat after retirement. The existing public reservation field carries the opaque reservation ID, so no result-request field is added. Attempt/retry numbers retain their existing user-visible meanings.
- The full issuance/result join is workspace/work plus exact reservation, attempt, manifest hash and role/Analyst-role/mode. Current generation authenticates the caller's handle; the recorded generation authenticates the original issuance. A prior-generation result may contribute stale accounting to the same work, but never current proof. Cross-workspace/work joins refuse.
- `issuedBinding` comes only from the admitted work at issuance. It is never taken from caller data, inferred from current work when receiving a stale result, or reconstructed from a result hash.
- `resultDigest = hashOf` the complete strictly validated result value after the existing normalizer, with its reported dispatch mode. Exclude CLI handle/`again` and current state. Use the same canonicalization everywhere; do not silently invent new set semantics for result payloads. A second payload with a different digest under the same issuance is a conflicting report, not a new dispatch.
- Rows contain no paths, argv/env values, question text, model/user prose or result payloads. `manifestHash` is an identity, not permission to restore/read a missing packet. Raw observations remain in the existing result/history structures under their privacy/retention rules. An unissued report is explicitly not a manufactured issuance.

## Transitions, counters and capacity under recommended A

All transitions occur in the existing locked state transaction. Only `core/budget` changes numeric counters. A helper may return a validated ledger transition and counter delta, but must not become a second counter owner.

| Event | Ledger transition | Counter/capacity | Proof |
|---|---|---|---|
| Issue native packet | Append immutable issue, `retired=false`, `settlement=null` | Counter unchanged; hold +1 | Candidate/basis/binding-bound reservation only, not proof that dispatch occurred |
| Issue same-session packet | Append same-session issue or bind the existing focused slot with the same once-only result identity | No native counter/hold | Existing reduced-independence rules; never upgraded to native |
| Candidate/basis/config/generation invalidates packet | `retired=true`, permanently for this issuance | Native pending hold remains; counter unchanged | Ineligible; remove it from the live proof-reservation projection |
| Matching native result, first settlement | Validate issued identity and mode; set `settlement={via:"result"}` and digest | Delegation +1, pending hold −1, so capacity does not reopen | Accept current proof only if the complete currentness/coverage/role checks pass; otherwise history only, no round/recheck credit |
| Matching same-session result | Record digest and terminal result settlement | Native delta 0 | Existing focused/same-session rules; fresh-context claims remain unavailable |
| Existing native `packet --retry` replaces a pending issue | Retire old issue and settle it `via:"retry"`; append new unique issue and retry linkage | Old native delegation +1 and hold −1; new native hold +1. Existing capacity/retry gate applies to the complete planned transition before publication | Old issue forever ineligible; new packet has a new identity/attempt |
| Retry after old issue already settled | Do not charge old issue again; issue a new packet only if existing packet/retry rules actually request a new assignment | Fresh assignment gets its own hold; no replay-induced charge for old key | No old proof revival |
| First late result after retry accounting | Preserve `via:"retry"`; add digest/history, no new settlement | Delegation delta 0 | Stale history only |
| Exact duplicate result after any intervening call or `again` | Same digest: no ledger/counter/round/link duplication | Delta 0 | Render current eligibility, not cached historical success |
| Conflicting second report under same issue | Keep first digest/settlement; return existing invalid/stale diagnostic with conflict detail | Delta 0; never refund | No replacement proof; require an existing fresh packet/retry to represent another assignment |

Derived capacity is `budget.delegations + number of pending expected-native issues`, including retired ones. Do not also add the old `budget.reservations.length`: the live reservation is a projection of the same issue, not a second hold. Same-session slots contribute neither native term. Report the pending count split into live and retired/uncertain. The numerical `delegations` field keeps its existing result/retry-accounted meaning; distinguish its provenance from observed actual dispatches, which remain unknown.

A retry's charge preserves the existing policy for a lost child; it is not an observation that the child ran. A result reported as native is reported evidence, not a qualified host-start signal. These distinctions must be included in diagnostics/status output before exact-current-count claims are made.

### Unissued or mismatched reports

The existing contract charges reported native work even when its reservation is stale or missing. Simply rejecting a wholly unissued native report with no accounting would silently narrow that behavior.

For a strictly valid native report with no admitted matching issue, compute `identityHash = hashOf({version:1, workspaceId, work, kind, reservation, attempt, manifest, analystRoleOrNull, reviewModeOrNull})` from its bounded reported identity. Append one `UnissuedNativeReport`, charge one reported unit and reject proof with `review-stale`; label origin/issuance unverified. A duplicate key/digest is a no-op; a conflicting digest under that reported identity is rejected without another charge. Never create an issued stamp, reservation or accepted link from this report. This preserves conservative first-report accounting and does not pretend that the claimed identity is authoritative.

A native report claiming a same-session-only focused packet is rejected for proof and handled as an unissued native report for accounting, preserving the existing cost-accounting intent. A same-session report cannot clear a pending expected-native hold. An identity matching another work/workspace is not charged to the caller's work. Malformed transport/result input retains its existing pre-dispatch rejection and does not invent a native event.

This deduplicates **reported identities**, not physically distinct host actions. Two real host invocations reusing the same packet identity are unobservable without a qualified observer; a coordinator must obtain a fresh packet/retry for each dispatch. Do not advertise exactly-once actual-host accounting. If review concludes the canonical “each result received” wording intentionally charges repeat transport delivery, that conflicts with “each settles once” and must be resolved explicitly rather than hidden in implementation.

### Retry selection and ambiguity

Preserve ordinary live-reservation selection first. With no live proof reservation, `packet reviewer --retry` may account for a unique matching retired reviewer lineage using its preserved issuance identity. Do not guess between parallel pending lineages or Analyst assignments: existing input that cannot identify one safely returns a diagnostic stop, without charging or releasing any hold. This proposal adds no retry/reconciliation flag. A future request to expose ambiguous-lineage selection is a separate API design.

Immediate identical command retry continues to use `session.last`. An explicit `again`, or a later command that existing transport semantics treats as a new retry, may issue a new packet; exactly-once settlement is per immutable issuance, not a new promise of global request-idempotency without request IDs.

## Durable publication, crashes and recovery

No new journal event kind is required. `AccountingCheckpoint2.entries[].budget` and the cumulative schema-2 recovery snapshot must strictly include the complete native accounting value. Updating a ledger row is an accounting change even when no numeric counter changes. Do not drop the value in `privateBudget`, schema parsing, serialization, changed-entry selection, fallback or compaction.

1. **Issuance:** create the packet using the allocated identity; persist the complete issuance with the existing state/accounting publication before returning its path. An artifact written before publication is not permission to dispatch. A crash before durable issuance leaves no returned authoritative packet; orphan owned artifacts follow existing safe cleanup.
2. **Checkpoint then publication crash:** if the native issue appears in a durable checkpoint but not selected state, recover only its immutable accounting identity and potential hold. Mark proof retired/ineligible; never reconstruct a live grant, packet authority or passing result from accounting history. The conservative extra hold is unknown exposure, not an observed invocation.
3. **Settlement:** the row's terminal settlement and numeric delegation delta enter the SAME budget/checkpoint/state publication. The accounting checkpoint is synchronized before acknowledging. Never publish the numeric increment independently of its deduplication identity.
4. **Crash after accounting checkpoint:** recover the row and numeric high-water together; do not call the incrementing settlement helper again. A repeated result may report already-accounted status. Missing result/history payload cannot be invented from its digest; after fallback/recovery fence, require fresh proof rather than replaying a prior success.
5. **Recovery join:** inspect the independently admitted selected/previous states, accounting checkpoints, cumulative snapshot and covering suffix across the retained horizon. Immutable row fields must agree. Retirement is monotone; settlement is one-way; the first result digest is fixed. Same row transitioning from retry-settled to carrying its first late result is allowed without changing charge source. Conflicting owners/stamps/digests or an unexplained charged-to-pending regression fence accounting completeness, preserving known numeric maxima and identities. Do not choose the largest timestamp or erase a conflict by taking a union silently.
6. **Counter validation:** normal transitions validate `new delegations = old delegations + newly charged native issued/unissued rows`; same-session/duplicate transitions have zero delta. Recovery preserves existing legacy numeric counts and maximum observed values—it does not derive historical totals from the new rows or add merged rows a second time. Missing coverage or inconsistent counter/row deltas stays unknown and uses existing accounting-safety diagnostics; no new user reconciliation API is implied.
7. **Compaction:** include every retained native issuance/settlement and unissued-report key in the complete cumulative recovery snapshot before dropping its covering checkpoints. Selected-state readability alone is insufficient. Protect unresolved holds and charged identities independently of age; no newest-N eviction. This is a concrete addition to B1/O4 recovery and retention, not independent of them.

This representation does not require the check runner's spawn acknowledgment handshake. It does require schema-2 budget/checkpoint/snapshot and full-horizon recovery integration. C5 cannot be declared closed after only proof builders or pure ledger tests.

## Migration, retention, privacy and pruning

- New schema-2 work initializes an empty native accounting value. Schema-1 upcast preserves delegation/review/recheck counters exactly and initializes no synthetic native issue or proof stamp. Upgrade already requires quiescence and no live reservations. Historical unbound results remain historical; an unissued late report uses the explicit unissued-report branch, never a fabricated legacy issuance.
- Primary and previous states convert independently with their distinct numeric histories. There is no new baseline counter whose value would require synchronizing those snapshots during migration. Recovery uses the existing numeric high-water contract plus complete native identity coverage, not a sum of different historical state counters.
- Retain native identities for as long as the corresponding work can receive or replay a result, including paused/recovered/archived forms and protected source recovery sets. Deleting stale packet bytes does not delete its accounting identity or refund a hold. Every copied/archived budget needs the strict new decoder.
- No automatic expiry, hold release, new archival format or reconciliation authority is added. If protected ledger growth reaches existing storage limits, refuse data-adding issuance while allowing diagnostics/stop under their existing rules. Do not evict rows to manufacture capacity. Repeated undispatched invalidations can create many pending holds; under A they reach the existing delegation capacity first, making that consequence explicit rather than an unbounded silent queue.
- Forgetting purges controlled packet/result prose through its existing approved protocol. Native accounting contains only kernel identities, enums and hashes; these do not restore forgotten payloads or authorize reading a manifest. Review any payload-digest privacy implications in the existing diagnostic/export policy; do not claim secure erasure or host-memory control.
- Only explicit removal of the work/store under its existing approved record-deletion lifecycle may remove its identity history. Subsequent results must not recreate that work. Removing a migration recovery set cannot remove independently active accounting identities.

## Required falsifiers and acceptance tests

Reuse `budget`, `review-admission`, `analyst`, `focused-review`, `manifest`, `settings`, `version-pin`, `accounting`, `store-boundary` and existing crash/recovery test homes. Add a dedicated native-accounting pure test file only if the independent state machine needs a focused home.

| Case | Binary required result |
|---|---|
| Native issue then candidate/config/basis invalidation, no result | Proof retires, reported delegation count unchanged, uncertain hold retained; another issue cannot exceed capacity |
| Same candidate/basis/files, A→B→A serial | Original issued stamp never supplies current proof; held/settled identity survives |
| Native current result; stale result; same-session result | Native unit once, stale proof/round credit zero; same-session native unit zero |
| Result duplicate immediately, after unrelated call, after `again`, after restart | No additional delegation, round, link or findings disposition |
| Retry then late old result, both arrival orders | One unit per old issue; old result cannot settle new issue; new packet gets a unique identity and hold |
| Two concurrent results or result racing retry | Existing lock serializes them; one charge for the old identity; no transient capacity reopening |
| Conflicting second payload, wrong role/mode/stamp/owner | No replacement proof or second charge; conflicts retained/diagnosed |
| Unknown reported native identity repeated/conflicting | First reported unit once, no manufactured issue/proof; repeated key no extra charge; different digest conflicts |
| Focused packet reported as native | Proof refused; reported cost accounted without upgrading independence |
| Prior-generation result after takeover | At most stale accounting for its original issuance; no restored ownership or current proof |
| Lost issuance response, checkpoint-before-state kill | Accounting recovers uncertain hold; no grant/reservation authority or proof is recreated |
| Real kill before/after checkpoint fsync, state rename and response | Two restarts retain identity and known cost without duplicate settlement; missing proof remains unavailable |
| Fallback from previous with newer charged checkpoint | Charged identity and counter high-water survive; retry cannot charge again |
| Compaction/snapshot and retained older backup | Same deduplication/unknown exposure survives; missing/conflicting native coverage fences instead of resetting |
| Schema-1 migration with nonzero historical native counters | Exact counters unchanged; no inferred issued/settled rows or fresh proof |
| Storage pressure, packet purge, forget and work deletion | Protected identities retained while work remains addressable; no payload restoration, implicit hold refund or deleted-work recreation |
| Missing executable/ordinary check launch fixtures | Native mechanism leaves check-process units/JobSettlement unchanged; no ledger-domain conflation |

Required red controls independently bypass row retention, identity equality, terminal-charge gating and checkpoint inclusion; each must fail its corresponding test. Built candidate UAT uses scripted reported native results only and must be labeled protocol/accounting evidence, not host dispatch observation. Native-host qualification remains separate.

## Review and implementation sequence

1. Obtain the narrow A/B/C stale-capacity decision; independent review checks the schemas, unknown-report behavior and retry-selection boundary. No generic reapproval of already settled budget policy.
2. Implement the pure ledger reducer and strict inactive schema-2 types with failing identity/charge/capacity tests; keep counters owned by `core/budget`.
3. Integrate issued identities and C5/V1 proof builders/admission without advertising complete settlement.
4. Integrate checkpoint/full-horizon recovery and cumulative-snapshot retention, then existing findings/retry paths in one candidate; no counter-only intermediate shipping step.
5. Run real concurrent/crash controls and scripted built UAT, review exact source/record/payload costs under original owner matchers, and return final production schema/budget/activation decisions. Main remains schema 1 until its separate activation gates close.

The proposal is intentionally smaller than a new native event/observer subsystem: one budget-owned accounting value, existing result identity fields, existing locked publication/checkpoint machinery, and a conservative capacity distinction. Its remaining owner choice is explicit; its implementation and recovery costs are not claimed measured or approved.
