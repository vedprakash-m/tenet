---
tenet: {"spec":1,"doc":"prd","level":"L1","version":"0.1","owner":"ved"}
sections:
  global-rules: {"state":"blessed","digest":"sha256:194749a88214c5e341f6488395f91092ba1f865a51f9fce1de4f18c367db6f83","flags":[],"blessed_digest":"sha256:194749a88214c5e341f6488395f91092ba1f865a51f9fce1de4f18c367db6f83","blessed_at_rev":"0000000000000000000000000000000000000001","blessed_copy":"tenet/blessed/tenet__specs__prd.md/global-rules.md","recorded":"self","blessed_by":"ved","blessed_at":"2026-11-23T10:00:00Z","anchors":{}}
  app-core: {"state":"blessed","digest":"sha256:3427a1e6e9e61bc3288ffcb00b5299ff065bd0234e118f092f3b06e0d07bce3a","flags":[],"blessed_digest":"sha256:3427a1e6e9e61bc3288ffcb00b5299ff065bd0234e118f092f3b06e0d07bce3a","blessed_at_rev":"0000000000000000000000000000000000000001","blessed_copy":"tenet/blessed/tenet__specs__prd.md/app-core.md","recorded":"self","blessed_by":"ved","blessed_at":"2026-11-23T10:00:00Z","anchors":{},"applies_to":["app/**","pyproject.toml"]}
  secondary-module: {"state":"blessed","digest":"sha256:c98e93eb7c94d35f62158f96828bbdf5f423967064a633df0f9bcff4a1f9d15a","flags":[],"blessed_digest":"sha256:c98e93eb7c94d35f62158f96828bbdf5f423967064a633df0f9bcff4a1f9d15a","blessed_at_rev":"0000000000000000000000000000000000000001","blessed_copy":"tenet/blessed/tenet__specs__prd.md/secondary-module.md","recorded":"self","blessed_by":"ved","blessed_at":"2026-11-23T10:00:00Z","anchors":{},"applies_to":["b/**"]}
  upcoming: {"state":"draft","digest":null,"flags":[]}
---
## Global Rules
- R-1 Always validate inputs before execution. {origin: asked; scope: global; serves: V-1}

## App Core
- R-7 Core module must validate config before running. {origin: asked; serves: V-1}

## Secondary Module
- R-8 Secondary module must stay stateless. {origin: asked; serves: V-1}

## Upcoming
- R-9 Upcoming feature must emit structured events. {origin: asked; serves: V-1}
