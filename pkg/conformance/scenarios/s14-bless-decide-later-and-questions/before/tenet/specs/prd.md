---
tenet: {"spec":1,"doc":"prd","level":"L1","version":"0.1","owner":"ved"}
sections:
  orders: {"state":"draft","digest":null,"flags":[]}
  timeouts: {"state":"draft","digest":null,"flags":[]}
  logging: {"state":"draft","digest":null,"flags":[]}
  conflicts: {"state":"draft","digest":null,"flags":[]}
  open-questions: {"state":"draft","digest":null,"flags":[]}
---
## Orders
- R-1 Retry failed jobs up to three times. {origin: observed; cites: src/app.ts:1-3; serves: V-1}

## Timeouts
- R-2 Wait 5 seconds before timing out. {origin: observed; cites: src/app.ts:4-6; serves: V-2}

## Logging
- R-3 Log every dropped item with its ID. {origin: documented; cites: README.md:3; serves: V-3}

## Conflicts
- [ ] CF-1 (section: orders) Retry limit differs in docs vs code | 1: Retry three times | 2: Retry once
- [ ] CF-2 (section: timeouts) Timeout value differs in docs vs code | 1: Wait 5 seconds | 2: Wait 10 seconds

## Open questions
- [ ] Q-1 (section: logging) Should logs include timestamps?
