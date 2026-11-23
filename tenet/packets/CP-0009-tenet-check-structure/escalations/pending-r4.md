# CP-0009 · Pending round 4 item

The read-only acceptance suite is present on `r4/spec-answers` but absent from the
current branch. It was used only to inspect inputs and expected projections and
was not copied into this branch.

The five round 3 proposal questions now have binding answers in
`answers-r4.md`; CP-0009 implements those answers.

One integration contradiction remains:

- Every command owns its `src/commands/<name>.ts` and must register through
  `registerCommand`, but the current architecture test rejects command modules
  that import `src/cli.ts`. Resolving that conflict requires a change to
  CP-0005-owned `src/cli.ts` or the existing architecture test, neither of which
  is in CP-0009's Owns. The expected CP-0009 full-suite result is that this
  architecture assertion is the sole blocker. This is a shared blocker for the
  A0-4 command packets: changing the registration design requires a coordinated
  CP-0005 amendment or an approved architecture-test clarification, not a
  hidden dynamic-import or global-registry workaround.
