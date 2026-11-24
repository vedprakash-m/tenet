---
tenet: {"spec":1,"doc":"prd","level":"L1","version":"0.1","owner":"ved"}
sections:
  requirements: {"state":"blessed","digest":"sha256:0d5c5ae31980a68f89c21572b3eb0f28f2469cdcf59ccdbb045d594e47035194","flags":[],"blessed_digest":"sha256:0d5c5ae31980a68f89c21572b3eb0f28f2469cdcf59ccdbb045d594e47035194","blessed_at_rev":"0000000000000000000000000000000000000001","blessed_copy":"tenet/blessed/tenet__specs__prd.md/requirements.md","recorded":"self","blessed_by":"ved","blessed_at":"2026-11-23T10:00:00Z","anchors":{"src/retry.ts:1-3":"sha256:a20fc8b408dfe2a9fc54e03ded1661884dbff158b2bf29a89bf5145fca8e3242"}}
---
## Requirements
- R-1 A payment that times out is retried once, never twice. {origin: observed; cites: src/retry.ts:1-3; serves: V-1}
