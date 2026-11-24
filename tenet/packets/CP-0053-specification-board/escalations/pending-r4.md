# CP-0053 · Round 4 pending

1. **Schema scope conflict.** `answers-r4.md` assigns updates to
   `kit/schemas/board.json` and generated types to CP-0053, but the direct task
   scope explicitly forbids edits outside its Owns list. CP-0053 therefore
   updates only `kit/schemas/results/board.json`; the base schema and generated
   type remain unchanged.
2. **Command registration.** The current command/index architecture cannot
   self-register `board` within the direct CP-0053 files without a
   `src/commands/` to `src/cli.ts` dependency, which the enforced architecture
   rejects. Resolving this shared blocker requires an edit to `src/cli.ts` or
   the architecture allowance, both outside CP-0053's scope.
