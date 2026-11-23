# CP-0053 · Round 4 pending

1. **Scope conflict.** `answers-r4.md` assigns updates to
   `kit/schemas/board.json` and generated types to CP-0053, but the direct task
   scope explicitly excludes that file and says not to work outside the direct
   Owns list. CP-0053 updates only the owned
   `kit/schemas/results/board.json`; the base schema and generated type remain
   unchanged.
2. **Acceptance suite availability.** The binding `pkg/conformance/board/`
   suite is available only on the read-only `r4/spec-answers` ref, not on this
   branch, so it is not copied or modified in the CP-0053 worktree.
