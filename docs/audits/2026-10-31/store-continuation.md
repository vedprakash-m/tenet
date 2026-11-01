# Store continuation and execution change

October 31, 2026. **◐ Local, uncommitted, unqualified.** Continues the [previous repair/refactor batch](continuation.md). Full source CI now passes **1,266 tests / 204 suites**, zero failures/skips. Final built evidence is recorded separately in [store-validation.json](store-validation.json); previous exact-source validation records remain historical.

## Reproduced and repaired

Three real child-process regressions mutate valid, same-size state/marker/journal bytes after the descriptor returns its first buffer, then restore the original mtime. All three fail against the previous reader: it returns the stale buffer as valid. Size and mtime alone do not establish that those captured bytes are current.

When ctime changes during a bounded private read, the reader now compares the captured bytes against the same descriptor in chunks of at most 64 KiB, including an EOF probe, then checks size/mtime/ctime again. A different byte or another observed mutation refuses before decoding/parsing. This preserves permission-only and hard-link metadata changes when content is stable, without allocating a second document-sized buffer. Stable short reads continue to work. Marker errors retain marker-mismatch; state/journal errors retain unsupported-record. No file is repaired, overwritten or reset by the read.

This is observed-mutation detection, not filesystem snapshot isolation or a parent-path race guarantee. A stable identical reread may accept metadata changes; a mutation completed before the captured content is read can still supply the stable current content. Neither ctime nor a double read proves historical immutability. The metadata-only and restored-mtime cases distinguish the intended behavior.

The same store owns a single cleanup candidate enumerator for age sweeping and run-size eviction. It enumerates run-prefixed leaves at the temp root and leaves beneath real manifests/review directories, preserving lstat link refusal, listing-error behavior, keep-path boundaries and ordering. Age sweeping still uses the leaf's mtime; cap eviction still uses recursive size/newest time and oldest-first ordering. Their differing eviction policies remain separate.

Focused evidence: **three failures before repair; 15 read-race cases pass afterward**, including short reads, permission-only changes and same-size mutations. The complete store/boundary/lock selection passes **91 tests / six suites**, zero failures/skips. Types and all lints pass. No safety guard, deadline, source budget or quality ratchet was relaxed.

The consistency repair and cleanup consolidation initially measured **25,581 / 25,920**, adding 661 characters against the frozen 24,920-character source. The later bounded-write repair, preserved in the shared checkout and recorded by the takeover audit, brings the current store to **25,706 / 25,920**, leaving 214. This consumes capacity for a demonstrated safety defect; it is not a simplification saving or evidence that the migration target fits. Later starter/schema/checkpoint work is preserved; it is not counted again as a new change in this report. The current built kernel is 775,824 bytes before final evidence capture. Exact identity is in the validation record.

## Faster completion route

The owner called out slow progress. The execution change is to stop using micro-refactors as the primary path to full migration/configuration capacity: one complete candidate, focused iteration, one final gate batch, and compact progress records. Existing separately gated workstreams can proceed independently where their contracts are settled.

A [concrete isolated prototype proposal](../../../specs/protocol-prototype.md) resolves a real sequencing restriction: schema-migration.md says “No migration code before sign-off,” but sign-off needs credible full sizing. The proposal requests only an isolated executable target candidate with every fixed budget retained, no installation/activation, and final review/sign-off intact. Parallel agents require explicit owner delegation authority. Neither authority is inferred from this audit. Until the owner answers, target prototype and delegation remain pending; schema-1 repairs remain authorized.

Current structural mapping is 117/181 Musts mapped, 16 host buckets and 48 unmapped, as reconciled by the later plan checkpoints. Remaining product gaps, the empty semantic ledger, all 19 open Should dispositions and zero qualification remain as recorded in the working inventory and preceding audits. No host/model/human campaign, reference-hardware qualification, publication, commit or push.
