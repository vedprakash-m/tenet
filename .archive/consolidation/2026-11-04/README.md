# Preserved consolidation candidates

These patches and source files preserve work from branches and worktrees
removed during the owner-requested consolidation. They are not part of the
runtime, payload, or test suite and do not approve a contract, size limit,
schema activation, or release.

`manifest.json` records the exact base and head commits. A worktree's
`changes.patch` applies to its recorded base; files beneath `untracked/`
are additional source files absent from that base. A branch patch applies
to its recorded merge base.

Three synthetic URL-redaction fixtures in the remote-publish snapshot have
an added `privacy-ok` comment identifying their test-only credential values.
No credential-test value or assertion is changed.

The implementation-audit, starter/privacy, repeated-detection, and reviewer
repair snapshots are retained even where their changes are integrated into
main, so overlapping revisions remain recoverable. Dependency recovery tests
and their draft contract remain candidate evidence rather than a claim that
the unsafe normal-resolution rollback has been repaired. The protocol,
migration, configuration, derived trace, diagnostics, workload-fitness, and
remote-publish candidates remain nonshipping.

Only reviewed repairs and dependency updates are selected for runtime
integration. Previously committed candidate changes already on main are not
silently approved by this consolidation; existing decision gates still apply.
