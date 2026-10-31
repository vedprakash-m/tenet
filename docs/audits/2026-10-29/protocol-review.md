# Independent configuration/migration protocol review

Date: October 29, 2026. Status: **review complete; not ready for final implementation sign-off**.

## Authority and scope

The owner selected **"Authorize one bounded read-only protocol review (Recommended)"** during the current reassessment. One fresh-context reviewer examined the inactive configuration/schema-2 migration contract against current source and the October 28 CR-1 through CR-9 packet. The reviewer made no edits, activated no schema, launched no further agents and ran no native/model/campaign work. This authorization is not owner implementation sign-off.

Review sources: `specs/config-completion.md` (especially sections 14-20), `specs/schema-migration.md` (16-19), `specs/migration-closure.md`, the [source-grounded protocol packet](../2026-10-28/protocol-review.md), and the corresponding pipeline, runner, store, recovery, schema and accounting consumers. Settled D1-D8/MC policies were not reopened. R08 remains deferred. Starter admission policy A is outside this review.

## Verdict and dispositions

The reviewer independently confirms the packet's not-ready conclusion and its source descriptions. The principal unresolved item is **capacity and a credible target estimate**, not a new product-policy question.

| Review item | Finding | Author disposition |
|---|---|---|
| F1: capacity | Current schema owner has 36 non-whitespace characters free; central pipeline/verbs/decisions has 9. New typed identities, recovery/settlement/launch records and their consumers are not implemented. No credible complete target-size forecast exists | Accepted. These are measurements of current headroom, not a measured numerical target deficit. Prepare a bounded simplification/target estimate before any cap request or final implementation approval. Do not silently relocate code outside measured owners |
| F2: CR-4 precision | Configuration section 18.4 already requires retaining later known launches diagnostically when an earlier launch leaves a settlement hole | Accepted. CR-4 is **partial**, not wholly unspecified. The rule exists; its exact representation and consumer/restart behavior are not validated. Preserve that distinction rather than reopening the policy |
| F3: completion/proof credit | `recover-effects.ts` currently restores integration validation from operation mode without the proposed configuration-proof binding | Source confirmation, not a newly reproduced schema-1 defect. The target must separate landed facts from current proof credit |
| F4: acknowledgment/ownership | Current runner has one root `run.json`, a prepared sentinel and file-fsync/rename without parent-directory fsync; current launch guard obtains a completion promise synchronously | Source confirmation of the target integration work. Existing absence of schema-2 consumers is not by itself a contradiction in the draft; concrete launch/stop/recovery/durability exits remain prerequisites |
| F5: approved repairs | MC-2 admission and schema-1 forget purge/publication/recovery/revision repairs genuinely exist | Accepted confirmation. Do not relist these as awaiting POSIX implementation or imply they activate target migration |
| F6: migration sources | The archive blob schema field has no producer; cached response data has no complete migration decoder | Accepted. Preserve/refuse actual source variants under the finite decoder contract; do not assume arbitrary strings are reference edges |

## CR status after review

| Obligation | Review disposition | Remaining exit |
|---|---|---|
| CR-1 typed check/operation domain | Unresolved implementation integration | All real launch producers supply the admitted domain and identity; no unsafe fallback |
| CR-2 ordinal ownership | Unresolved implementation integration | Independent ownership records, full stop/recovery traversal, unchanged command/report/data scope |
| CR-3 bounded spawn acknowledgment | Unresolved implementation integration | Durable starting/child/no-child acknowledgment under lock, release before completion, explicit uncertainty |
| CR-4 holes/settlement/discard | Partial | Existing diagnostic-retention rule represented exactly, exercised across cancellation and restarts, no missing/double counts |
| CR-5 cumulative recovery/proof floors | Unresolved implementation integration | Backup/reduction preserve issuance floors and unsettled suffix; no stale proof revival |
| CR-6 migration decoding | Partial | Finite source inventory exists; real producer-form decoding or explicit refusal still required |
| CR-7 completion versus proof | Unresolved implementation integration | Landed Git facts survive independently from current proof binding |
| CR-8 forgetting/rollback | Partial | Schema-1 forgetting is implemented; target recovery-set deletion/pristine rollback remain inactive |
| CR-9 budgets | Current measurement confirmed; target feasibility unresolved | Measured simplification, complete target estimate and any explicit budget decision before sign-off |

These dispositions do not equate every absent target consumer with a new design defect. Implementation remains unauthorized because the combined mechanism, budget feasibility and required exits have not received final sign-off.

## Next decision and recommendation

Two reasonable capacity paths remain:

1. **Bounded behavior-preserving simplification and sizing first (recommended).** Examine only the tight measured owners, propose a small consolidation with identical consumer behavior, measure its saving and estimate the complete target. This retains the complexity constraint but may show that a justified cap increase is still necessary.
2. **Cost a cap-increase proposal without first refactoring.** Preserve current source structure and produce an explicit source/bundle estimate for all target consumers, then request the smallest justified owner-approved increase. This avoids refactor risk but accepts more code and leaves existing duplication in place.

The review also mentioned narrowing a first schema-2 slice. It is not recommended as a way to fit a number: typed launches, ownership, accounting, stop/recovery and proof invalidation must still compose safely. No partial activation that omits its required safeguards is authorized.

No exact cap increase is proposed without a target estimate. No new reviewer, runtime refactor or schema activation is inferred from this review's completion. The next capacity scope goes to the owner one decision at a time.

## Subsequent owner selection and sizing

The owner selected **"Bounded simplification and complete sizing (Recommended)"**, proposal only. The resulting [capacity proposal](../../../specs/protocol-capacity.md) preserves the measurements and inventories every target responsibility. In-memory source candidates save 180 characters/302 bundle bytes, not enough to establish a credible full within-cap path. Forecast ranges still exceed five owner ceilings; bundle fit remains uncertain. Current coordinator measurement is 3,999/4,000 tokens; the older 3,892 figure is historical. No candidate was installed, budget increased or schema activated.

The owner then separately authorized **one bounded read-only capacity review**. Its verdict is sound/internally consistent, with no blocking document defect. [Both dispositions](../../../specs/protocol-capacity.md#10-independent-capacity-review-and-dispositions) are recorded: guidance alone exceeds the coordinator cap by 88 tokens, so the modeled fit requires all six paired reductions; existing reconciler wiring is explicitly costed in C6/C8 without a duplicate estimate or new ordinary migration effect. Final bounded protocol/budget/implementation approval remains a separate gate.
