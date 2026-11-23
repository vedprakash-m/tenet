# CP-0044 · Answers to the round 2 specification questions

Answers to [proposals-r2.md](proposals-r2.md), drafted by the M0 coordinating session on 2026-11-23 to keep CP-0044 unblocked. All specifications are still drafts awaiting the Owner's ratification (CP-0001), so the Owner can overturn any answer there.

**When these are applied:** after round 2's `r2/trial-round-4` branch merges, because it owns `algorithms.md` and `plan/alpha.0.md` this round. They must be applied before CP-0044 is dispatched. After that, the independent fixture author adds cases for each answer.

1. **Section owner.**
   - **Precedence:** the section's `owner`, else the document's `tenet.owner`, else the owners on the last CODEOWNERS line matching the document, else the Owner.
   - **What CP-0044 does:** `parseDoc` adds `owner: string | null` to each section record, filled from the section's entry, else the document's front matter, else `null`. It never reads CODEOWNERS.
   - **What callers do:** they apply the CODEOWNERS and Owner fallbacks with CP-0006's `ownersFor(path)`.
   - **Spec edits:**
     - ALG-03 "Owner" becomes "section front matter, else document front matter, else …".
     - The CP-0044 exports add `owner` to the section record.
2. **Rename precedence.**
   - `matchRenamed` compares vanished entries with new sections in two tiers: first by current `digest`, then by `blessed_digest` only when the first tier has no candidate.
   - Two or more candidates in the tier that decides make the result `ambiguous`.
   - The returned `digest` is the value that matched.
   - **Spec edit:** ALG-02 "Rename".
3. **Malformed citations.**
   - Each citation yields at most one finding, checked in this order: syntax, then file, then range, heading or test.
   - Any citation-shaped token that fails its syntax gives `TN-CITE-RANGE` with message "citation is malformed" and nothing else. That covers `doc:` without `#slug`, `test:` without ` > `, and a path range that isn't `start-end` with integers.
   - **Spec edit:** ALG-04 "Errors".
4. **Removed or no-longer-blessed requirements.**
   - A requirement blessed at `base` whose line is gone at `head`, or whose section is no longer `blessed` at `head`, is included with `why: text-changed`. Its record is read from `base`.
   - This holds whether or not the document still exists.
   - **Spec edit:** ALG-14 reason 3.
5. **Ordering ties.**
   - Within a reason, sort by numeric ID, then by the full ID string in ASCII order.
   - **Spec edit:** ALG-14 "sorted by numeric ID".
6. **Independent ALG-03 suite.**
   - CP-0044's *Fixtures* field becomes: its own ALG-02, ALG-04 and ALG-14 fixtures, plus the independent suites in `pkg/conformance/alg-02/`, `alg-03/`, `alg-04/` and `alg-14/` ([INDEPENDENT.md](../../../../pkg/conformance/INDEPENDENT.md)).
   - It may add cases to those suites but never change existing ones.
   - Its *Owns* lists only its own new cases.
   - *Proving* runs all four suites.
