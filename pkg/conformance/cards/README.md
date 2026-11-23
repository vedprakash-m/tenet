# CP-0051 proof card goldens

`r4/` is a byte-for-byte mirror of the independent `pkg/conformance/card/` fixtures on `r5/spec-answers` at `8c32aca`. This copy keeps the tests runnable in a checkout without the answer branch. The original cases are unchanged.

The renderer consumes each approved model and compares Markdown bytes. The recorder tests exercise actual bundle envelopes and report parsing. The independent cases currently supply normalized legacy check objects. Their transport mismatch and related open questions are recorded under CP-0051.
