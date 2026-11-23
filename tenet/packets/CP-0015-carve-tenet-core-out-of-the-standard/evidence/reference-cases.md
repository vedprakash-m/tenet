# R-009 reference-case walkthrough

These are synthetic, portable gate examples. The case envelope identifies the applicable claims, target subject, visible evidence and decisions per evaluation. Its hashes and timestamps are fixture inputs. The expected JSON projects the gate result to evaluation ID, verdict, disposition and next action. This envelope is a conformance fixture, with the underlying primitive formats owned by CP-0049.

| Case and evaluation | Walk through Part I and ALG-07 | Expected |
|---|---|---|
| Library, install unknown | The artifact is the subject. The project has an applicable observation claim. The observation explicitly records that downstream installs are unobservable. It cannot satisfy the enforced claim. The verified publication result alone cannot establish downstream adoption. | Refuse, block, wait for evidence. |
| Rollback, west only | The gate is for recovery across both affected regions. The positive observation is for the west-only deployment subject. It leaves the claim for the full target unsatisfied. | Refuse, block, wait for evidence. |
| Rollback, all regions | A subsequent fresh observation covers the exact target and both regions. The recovery claim now holds. The earlier refusal remains reproducible with its earlier snapshot. | Advance, record. |
| Migration, before authorization | The rehearsal establishes recovery before cutover. At the point of no return, a separate approval claim applies. A rehearsal cannot supply the approval. | Refuse, block, request the Owner's decision. |
| Migration, authorized cutover | The Owner's in-scope decision covers the same target. Both the evidence and approval claim now hold. This permits the named transition without establishing a rollback path after it. | Advance, record. |
| ML, old data | The program revision is the same. The data subject changed. A positive benchmark on the previous data gives no evidence for this subject. | Refuse, block, wait for evidence. |
| ML, new data | A fresh measurement on the current data subject meets the approved claim. The gate can advance before a later staged deployment or production observation is considered. | Advance, record. |

The evaluator trial follows one unchanged code subject across six evaluations. A scoped waiver initially covers the missing case. A description edit invalidates the waiver while still in date. Restoring the original text isolates expiry at the original deadline. A passing observation clears the gate under the old policy. Tightening the policy and changing the pinned check makes that same observation stale. A fresh passing run clears the gate again. The per-evaluation modes are fixture inputs keyed by claim ID. In the reference binding the acceptance claim maps to the `acceptance-proven` rule.

The data, deployment and operation vocabulary in these examples exercises the standard independently of when a particular reference binding ships. The examples do not certify any host's enforcement.
