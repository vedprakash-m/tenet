# Independent round 8 review · CP-0045

Reviewed `96eee9a` against `alpha.0b.md:24–36`, Contracts §9, ALG-10, and binding `answers-r4.md`. `node dist/cli.js context --json` returned the six-key result. `node dist/cli.js mcp` served tools/list over NDJSON and listed all five tools.

## Blockers

- **B1 · Independent ALG-10 cases are not run.** `alpha.0b.md:35–36` and `pkg/conformance/alg-10/README.md`; `test/context/context.test.ts:58–285` and `test/mcp/mcp.test.ts:81–281` build their own inputs. The 13 independent cases are byte-identical to `7d92f6b`. Load all checked-in cases, honor their declared projections, and run the same selection cases through CLI and MCP where the README asks for parity.
- **B2 · The MCP command can put protocol frames on stderr.** `contracts.md:132–136`, `alpha.0b.md:33`; `src/cli.ts:139–146,385–407` passes the generic JSON-mode human stream into serveMcp. Verified `--json mcp` puts tools/list on stderr and a CLI envelope on stdout. Explicitly refuse incompatible global flags before serving, or give MCP exclusive ownership of stdout in protocol mode. Add a spawned CLI regression.
- **B3 · Proposals are written but never committed.** `contracts.md:144`; `src/mcp/index.ts:271–294` writes the file and returns the path with no Git commit. `test/mcp/mcp.test.ts:200–230` asserts the file only. Make the proposal durable in the committed packet as contracted, without staging unrelated files, or have the Owner clarify a separate commit step.
- **B4 · Applicable prose can disappear from mixed sections.** `algorithms.md:164–165` and binding answer lines 7,12; `src/context/index.ts:288–310` creates a section-body candidate only if the blessed copy has no requirements. A blessed design section with narrative, a requirement table and matching applies_to never returns its prose. Construct the section candidate independently and test path plus heading selection.

## Shoulds

- **S1 · Usage findings bypass canonical words.** `contracts.md:162`, `messages.md:76–77`; `src/context/index.ts:239–251` emits custom text for TN-USAGE-BUDGET and TN-USAGE-CONTEXT. Observed budget 0 returns “Invalid token budget: 0” instead of the canonical wording. TN-SPEC-BLESSED-COPY at lines 131–140 matches both canonical strings. Use the canonical formatter for the usage codes too.
- **S2 · Quiet and positional handling are incomplete.** Contracts §8 and §9, `alpha.0b.md:28,33`; `src/commands/context.ts:26–45` writes the human summary unconditionally and ignores positional arguments. Verified `--quiet context` prints output, and `mcp stray` starts the protocol (`src/cli.ts:139–146`). Honor quiet for context and validate the MCP command arguments.
- **S3 · Inspector verification is missing.** `alpha.0b.md:36`; `test/mcp/mcp.test.ts:81–281` proves a scripted stdio session and tool list in process. It does not show the pinned MCP Inspector calling all tools on the three platforms and both entry forms. Record the named proving evidence.

## Notes

- **N1.** Candidate group precedence, budget scanning after omission, oversized explicit IDs, index accounting, rule order, and dropped rejected drafts are implemented (`src/context/index.ts:315–425`). Protocol negotiation and notification suppression are present (`src/mcp/index.ts:338–389`). The four JSON-RPC error code/message pairs match Contracts §9.
