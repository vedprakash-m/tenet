---
tenet: {"spec":1,"doc":"intent","level":"L1","version":"0.1","owner":"ved"}
sections:
  requirements: {"state":"blessed","digest":"sha256:31aacaecffb74f771e58bad06b1ea18eee5c711a4bb3b76788546c4158b9c630","flags":[],"blessed_digest":"sha256:31aacaecffb74f771e58bad06b1ea18eee5c711a4bb3b76788546c4158b9c630","blessed_at_rev":"0000000000000000000000000000000000000001","blessed_copy":"tenet/blessed/tenet__intent.md/requirements.md","recorded":"self","blessed_by":"ved","blessed_at":"2026-11-23T10:00:00Z","anchors":{"src/retry.ts:1-3":"sha256:a20fc8b408dfe2a9fc54e03ded1661884dbff158b2bf29a89bf5145fca8e3242"}}
---
## Requirements
- R-1 A payment that times out is retried once, never twice. {origin: observed; cites: src/retry.ts:1-3}
