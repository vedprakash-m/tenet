---
tenet: {"spec":1,"doc":"prd","level":"L1","version":"0.1","owner":"ved"}
sections:
  checkout-retries: {"state":"blessed","digest":"sha256:57a4e7f2ccfc6e7bfce9687c5ed4fb5288d306efb72526bd2fccf10a590da607","flags":[],"blessed_digest":"sha256:57a4e7f2ccfc6e7bfce9687c5ed4fb5288d306efb72526bd2fccf10a590da607","blessed_at_rev":"0000000000000000000000000000000000000001","blessed_copy":"tenet/blessed/tenet__specs__prd.md/checkout-retries.md","recorded":"self","blessed_by":"ved","blessed_at":"2026-11-23T10:00:00Z","anchors":{"test: test/retry.test.ts > retries once":"sha256:5e57527187b360f6ca205b47fdabefac97f1376007045b9f76c35c9ff3219b5f"},"applies_to":["src/retry.ts"]}
---
## Checkout retries
- R-1 A payment that times out is retried once, never twice. {origin: observed; cites: test: test/retry.test.ts > retries once; serves: V-1}
