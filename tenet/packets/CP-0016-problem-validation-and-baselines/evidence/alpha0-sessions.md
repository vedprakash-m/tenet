# Alpha.0 outside-maintainer sessions

Sources: plan §§1 and 3 (CP-0016), [UX Part 0 and Part 1](../../../specs/ux-spec.md#part-1-start-here).

The Owner recruits two maintainers unrelated to the steward. Each tries both Part 1 journeys on the release candidate without coaching. The build track publishes snapshots when its own gate passes. These sessions supply the outside-use evidence for announcing alpha.0.

## Facilitator checklist

- [ ] Get consent to observe and take de-identified notes. Agree on whether to capture commands, and redact credentials and private URLs.
- [ ] Record candidate version, platform, host and available permissions. Provide the candidate, instructions as published, and suitable existing and new repository starting points. Keep normal setup steps in the journey.
- [ ] Start the timer when the participant receives the journey brief. Observe quietly. Log actions, commands as entered, the preflight list of files Tenet plans to write, first useful finding, blockers, pauses and whether the participant completed the journey. Record the actual advisory card or its absence separately from the participant's or forge's approval and merge decision. They can consult the provided docs and their usual tools.
- [ ] If help is needed for a safety or access issue, pause, log what happened and mark any coached attempt separately. A coached finish does not count as unaided.
- [ ] Ask what they thought was in force, what the card checked, and what surprised them. Record observations after completion. Do not retrospectively change the result.

## Journey endpoints

**Part 1A, existing repository.** Install and initialize, draft and review the specifications, explicitly bless, merge the setup, then make the example change via a normal pull request. Check that the expected advisory card appears and the participant can review and merge.

**Part 1B, new project.** Initialize a new repository or follow the documented template path, draft and bless intent before building, then finish the first-slice pull request. The participant should recognize that a proposed check needs approval before pinning and finish the review and merge.

Log incomplete, stopped and assisted journeys, with the reason. Announcing alpha.0 requires both maintainers to complete both journeys unaided. Report the measured time to first useful finding separately.

## Data sheet

| Participant ID | Candidate, OS and host | Journey and start state | Start/end | Elapsed minutes | First useful finding and minute | Commands and preflight write list | Advisory card observed | Blocker, workaround and minutes | Help given | Completion and endpoint evidence |
|---|---|---|---|---:|---|---|---|---|---|
| | | | | | | | | | | |
