# Decision-reconstruction exercise

Sources: [R-075](../../../specs/prd/tooling.md#0-work-views-and-operations), [V-M1 and V-H1](../../../vision.md#horizons), plan §3 (CP-0016).

Measure how long an unfamiliar maintainer takes to reach a correct decision about a real change. Use the same procedure in each pilot for the project's previous tools and its Tenet view.

## Prepare and run

1. The Owner selects real changes with decision-time records. Include cases with both sufficient evidence and unresolved work. Record the revision, action, decision time and visible sources. Freeze the case set, time limit and scoring key before sessions. Use only records the participant may see.
2. Prepare comparable changes for each condition. A participant sees each change once. Where practical, alternate the order of conditions and rotate cases so case difficulty and practice are visible in the results. Record any deviation.
3. Give the maintainer the same brief and point them to the condition's starting view. Start the timer when the brief and tools are available. Do not help them find or interpret the answer. Stop on final submission or the agreed time limit. Record elapsed minutes, timeouts and answers as submitted.
4. Have an independent scorer compare answers with the frozen key and cited records. Remove condition labels where feasible. Score the submitted answers before discussing results with the participant.

## Four questions

| Ask | A correct answer includes |
|---|---|
| What was authorized? | Scope, applicable revision and decision or authority. If authority cannot be established, name the missing record. |
| What was checked? | The checks or evidence, the evaluated revision and material limits on coverage. An unchecked item stays unchecked. |
| May the proposed action proceed? | The applicable disposition at the case time and the reason, including any condition, waiver or missing evidence. |
| Who can resolve what is unknown? | The unresolved question and responsible actor or role. If none remain, say so based on the records. |

Give one point per answer only if the required facts match the key. Record a reason and source for each point or miss. A case reaches a correct decision when all four answers are right. Score timed-out answers as submitted and mark the timeout. Report correct cases over all attempts, per-question correctness, and median elapsed minutes for correct cases with the number of correct attempts. Include timeouts and incomplete cases when reporting coverage. Compare times at equal correctness for V-H1. Report the V-H3 thresholds separately when there are results for that horizon.

## Data sheet

| Case and frozen revision | Participant ID | Tool condition and position | Elapsed minutes | Timed out | Authorization 0/1 | Checks 0/1 | Proceed 0/1 | Resolver 0/1 | All four right | Scorer, key and reasons |
|---|---|---|---:|---|---:|---:|---:|---:|---|---|
| | | | | | | | | | | |
