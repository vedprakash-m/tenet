---
tenet: {"spec":1,"doc":"intent","level":"L1","version":"0.1","owner":"ved","drafted_from":"774fed95b005b532eda2556eb22ac1a541df320a","drafted_at_rev":"774fed95b005b532eda2556eb22ac1a541df320a"}
sections:
  requirements: {"state":"blessed","digest":"sha256:41cb31ed0b9d7f835e107d5219215ac88a6bdf3fd889b48262c2d72a41a77fe9","flags":[],"blessed_digest":"sha256:41cb31ed0b9d7f835e107d5219215ac88a6bdf3fd889b48262c2d72a41a77fe9","blessed_at_rev":"774fed95b005b532eda2556eb22ac1a541df320a","blessed_copy":"tenet/blessed/tenet__intent.md/requirements.md","recorded":"self","blessed_by":"ved","blessed_at":"2026-11-23T10:00:00Z","anchors":{"src/shared/http.ts:1-3":"sha256:231d46c6502f5326a2d1d2bb962ed6dab3e71d8d22b3d0fafeb9f01fcacf7e10","src/billing/charge.ts:1-2":"sha256:5de3a4cede952067861972cd4243c882b4b11f1e9b0e68ea3d5fdc769fd9958f"}}
---
## Requirements
- R-1 HTTP calls use the shared helper wrapper. {origin: observed; cites: src/shared/http.ts:1-3}
- R-2 Billing charges post to /b. {origin: observed; cites: src/billing/charge.ts:1-2}
