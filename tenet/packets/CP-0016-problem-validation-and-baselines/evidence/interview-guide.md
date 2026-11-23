# Maintainer interview guide

Sources: plan §§1 and 3 (CP-0016), [V-M1 and V-M11](../../../vision.md#outcome-metrics).

The Owner runs five interviews with maintainers who delegate real changes to coding agents. Include at least one maintainer outside application code, such as infrastructure, data pipelines or tooling. Use the same questions with each person. Ask them to walk through a recent real change before describing Tenet.

## Consent and timing

Read this before starting: “We're studying how maintainers hand off changes to coding agents and decide what can proceed. Participation is voluntary. You can skip any question or stop. Please avoid secrets and private code. May I take notes and use a de-identified summary in project decision records? I'll ask separately before using any quote or recording.”

Record the consent decision. Take notes only as agreed. If permission to use notes is declined, omit the interview from findings and recruit another participant.

| Minutes | Topic |
|---|---|
| 0–3 | Consent, role, project and typical agent work |
| 3–13 | A real recent change, intent and handoff |
| 13–21 | Evidence, review and authorization |
| 21–27 | Drafted specs and blessing |
| 27–30 | Missing questions and optional follow-up |

## Questions

1. What real change did you recently delegate? What parts did the agent handle? What did you have to do?
2. Where did you write down the intended behavior, limits and approval conditions? What did the agent receive, and how?
3. Show how you noticed stale or conflicting intent. What version applied at the time? If you have no example, how would you find out?
4. What did you inspect before the next action? Which checks ran, what did they establish, and who could answer anything they left open?
5. Where did the work wait? Which manual steps or rework could you remove? What did that take in minutes, if known?
6. Would you read a machine-drafted specification and explicitly approve it as governing intent? What would you need to see first, and how long would you spend reading it? What would make you defer or reject it?
7. What should stay exactly as it is in your current workflow?

Ask “What happened next?” and “Where would someone else find that?” Record concrete examples and estimated durations as different kinds of evidence.

## Notes template

| Field | Value |
|---|---|
| Participant ID, date, role and project type | |
| Delegates real changes, outside application code, consent scope | |
| Recent change and permitted source reference | |
| Intent source, revision, agent handoff and times it went stale | |
| Evidence, authorization, unknowns and resolver | |
| Human minutes or estimate, manual steps, rework | |
| Would bless, conditions, reading time and concerns | |
| What worked, contradictions and unanswered questions | |

After five sessions, summarize recurring observations, counterexamples and whether they justify changing the first adopter or entry point. Attribute conclusions to the evidence and keep identifying information out of the report.

The Owner still needs to replay 10 Torus changes, record Torus's health indicators and recruit the external pilot. The interview findings complement those baselines and pilot evidence.
