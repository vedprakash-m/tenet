---
tenet: {"spec":1,"doc":"intent","level":"L1","version":"0.1","owner":"ved"}
sections:
  requirements: {"state":"blessed","digest":"sha256:06927c99a40c76764496b041c2f5aa81272736f3f0e3dffc579e7b47956e4ee6","flags":[],"blessed_digest":"sha256:06927c99a40c76764496b041c2f5aa81272736f3f0e3dffc579e7b47956e4ee6","blessed_at_rev":"0000000000000000000000000000000000000001","blessed_copy":"tenet/blessed/tenet__intent.md/requirements.md","recorded":"self","blessed_by":"ved","blessed_at":"2026-11-23T10:00:00Z","anchors":{"src/retry.ts:1-3":"sha256:c7444a1db489c3faea243a1d0e6eadd9cb6bb1969e4d3ebbf5f0b5037f6f5abe","test: test/retry.test.ts > retries once":"sha256:5e57527187b360f6ca205b47fdabefac97f1376007045b9f76c35c9ff3219b5f"}}
---
## Requirements
- R-1 A payment that times out is retried once, never twice. {origin: observed; cites: src/retry.ts:1-3, test: test/retry.test.ts > retries once}
