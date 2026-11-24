# Independent round 8 review · CP-0053

Reviewed `96eee9a` against `alpha.0b.md:38–46`, Contracts §5, and binding `answers-r4.md`. `node dist/cli.js board --json` dispatched and exited 0 in a disposable project.

## Blockers

- **B1 · The shared board schema and generated type still describe the old shape.** `alpha.0b.md:40` and binding `answers-r4.md:5–8`; `kit/schemas/board.json:104–118,485–494` still requires recorded on all rows and omits spec_debt, and `src/types/generated.ts:61–80` reflects that shape. Only the command result schema was updated (`kit/schemas/results/board.json:73–94,132–167`). Update the shared schema and regenerate its types; validate both schemas with the exact same draft/clean-blessed JSON.
- **B2 · Independent board cases are outside the test run.** `alpha.0b.md:45–46`, `pkg/conformance/board/README.md:3`; `test/views/specs-board.test.ts:73–512` supplies hand-built examples including the UX transcript and never reads the 13 independent cases. The cases match `7d92f6b` byte for byte. Execute all JSON and Markdown expectations, including negative cases, from the independent inputs on the named platforms.
- **B3 · Extracted specification parts can disappear from the board.** Binding `answers-r4.md:12–13` and `alpha.0b.md:42` require the full ladder. `src/views/specs-board.ts:309–328` sends only configured paths to ladder and lines 415–437 check budgets only for the configured documents. A newly split part with valid front matter outside the configured path list has no state, debt or pending blessing. Use complete ladder discovery with configured metadata overrides.
- **B4 · A blessed row can omit recorded.** Binding `answers-r4.md:7`; `src/views/specs-board.ts:354–366` silently omits the field when the metadata is absent or invalid, even though its owned command result schema requires it for blessed rows. Define the failure path or valid alpha.0 default and test the exact result.
- **B5 · Budget debt depends on checkout line endings.** `alpha.0b.md:42` and `:46`, Contracts determinism at `contracts.md:152`; `src/views/specs-board.ts:417–427` counts raw CRLF text. The same committed document can cross the threshold on Windows only. Normalize before counting and add paired LF/CRLF proving.

## Shoulds

- **S1 · Board usage text differs from the catalog.** `contracts.md:162`, `messages.md:76`; `src/commands/board.ts:11–17` hard-codes different TN-USAGE-BOARD message/fix text. Use the wildcard template. Board debt text is a different contract surface and uses binding answer lines 22–25, so it should retain those domain-specific messages.

## Notes

- **N1.** The implementation reads working specification text, checks test declarations at HEAD, keeps draft and flagged blessed sections pending, and makes --all a renderer-only switch (`src/views/specs-board.ts:305–415,501–552`). It exercises the UX format with a builder fixture. The independent golden and cross-platform gate remain open.
