---
tenet: {spec: 1, doc: tech-spec, level: L2, version: "0.1", owner: ved}
sections:
  _preamble: {state: draft, digest: sha256:c5479c09095dcb5f8d55e85bd0d435cd935f6ecfb69ef026bd6cc1f45b675584, flags: []}
  1-mcp: {state: draft, digest: sha256:f50f40f03e81a5a9cd1a3b58ba4e4e6e23a57de7f78e4bb1c3c7eddc40c9b096, flags: []}
  2-context-selection-alg-10: {state: draft, digest: sha256:61498b4dce17ef76b23509825633b5ee68d1ebb1be5be4c8215e7016b52676aa, flags: []}
---
# Tenet technical specification: MCP and context selection

> Level L2 · Version 0.1 · Part of [tech-spec.md](../tech-spec.md) · Status: **draft, awaiting the Owner's approval** · Budget: 6,000 tokens · Split from `contracts.md` §9 and `algorithms.md` ALG-10 under the rollover rule

**Context card.** Local MCP server protocol, tools, and context-selection algorithm (ALG-10). Command exits and result schemas live in [contracts.md](contracts.md); specification parsing and blessings in [algorithms.md](algorithms.md).

## 1. MCP

Newline-delimited JSON-RPC 2.0 over stdio; logs on stderr only; no network. Protocol revision `2025-11-25`, also accepting `2025-06-18`.
- `initialize`: answer `{protocolVersion, capabilities: {tools: {listChanged: false}}, serverInfo: {name: "tenet", version}}`, where `protocolVersion` is the client's requested revision if supported, else `2025-11-25`.
- Notifications (`notifications/initialized` and any other message without an `id`) get no reply. `ping` returns `{}`.
- `tools/list` gives each tool's `inputSchema` and `outputSchema` (from its result schema). `tools/call` returns `{content: [{type: "text", text: <markdown>}], structuredContent: <result>, isError}` (`content[0].text` uses the CLI human summary).
- Errors: -32700 `"Parse error"`, -32600 `"Invalid Request"`, -32601 `"Method not found"`, -32602 `"Invalid params"`.

| Tool | Input | Result |
|---|---|---|
| `tenet_context` | `{paths?, ids?, query?, include_drafts?, budget_tokens?}` | `{blessed: [{id, section, text, flags, owner, reason: global\|id\|path\|applies_to\|query, over_budget?}], drafts: [{id?, section, path, state, text, integrity_failed?}], index: [{id, title}], omitted: [id], truncated, rules: [{rule, mode}]}` (`owner` joins multiple CODEOWNERS with `", "`; `rules` lists the five alpha.0 pack rules in pack order; an explicit `id` item always comes back whole, flagged `over_budget` if `tokens > budget_tokens`) |
| `tenet_check` | `{paths?}` | `{findings, summary}`, as `check` |
| `tenet_status` | `{work?}` | level, spec states, work item status |
| `tenet_next` | `{work?}` | `next_actions` |
| `tenet_propose` | `{kind: acceptance \| escalation, work, payload}` | `{path}` inside the work item's packet folder (committed); specification changes are edits to the files themselves (agents.md §1) |

## 2. Context selection (ALG-10)

**Context selection.**
- **Inputs:** `paths`, `ids`, `query`, `include_drafts`, `budget_tokens` (default 4,000).
- **Candidates:** blessed sections, using their blessed copies; when `include_drafts` is true, draft/deferred requirements and sections from the working specification.
- **Groups, in order:**
  1. **global**: requirements marked `scope: global`, within a reserved 25% of the budget
  2. requirements whose ID is named
  3. requirements citing a path equal to, inside or containing an input path
  4. **`applies_to`**: prose sections whose `applies_to` matches an input path (`id: "<doc>#<slug>"`)
  5. **`query`**: requirements (`text`) or sections (`heading`) containing the query, case-insensitive
- **Ordering:** `applies_to` candidates with a more specific matching glob come first; within the same specificity, order by level (L0, L1, L2) then numeric/ASCII ID. Duplicates are dropped. A literal beats `app/**`, and `app/**` beats `"**"`.
- **Budget:** `tokens(s) = Math.ceil(s.length / 4)` (`budget_tokens <= 0` refuses with `TN-USAGE-BUDGET`). Walk candidates in group order: add whole items while `used + tokens(item.text) <= budget_tokens` (global rules beyond their 25% share still precede Groups 2–5); if a non-explicit item doesn't fit, push its `id` to `omitted`, set `truncated = true`, and keep scanning smaller items. An item named in `ids` always comes back whole (never `omitted`), clamping `used` at `budget_tokens` and setting `over_budget: true` if `tokens(item.text) > budget_tokens` (`truncated` is `omitted.length > 0`). Then build `index` from remaining blessed requirements and prose sections (`title` is at most 80 characters and is shortened further to fit, cost `tokens(id + " " + title)`) up to `Math.floor(budget_tokens * 0.20)`. An omitted large prose section can therefore retain a small title index.
- **Each item carries** its `flags`, single-string `owner` (joining multiple CODEOWNERS with `", "`) and `reason` (`global|id|path|applies_to|query`).
- **Drafts:** `include_drafts` applies the same path, ID, query, ordering and budget rules to `draft`/`deferred` requirements and sections (never `rejected`). Draft results carry their state, source path and text. `--ids` can return one named draft statement. A blessed copy failing `ALG-03` integrity is excluded from `blessed` and served in `drafts` (`integrity_failed: true`).
- **No inputs:** group 1 plus the index.

Fixtures: a global rule survives a budget filled by one long local requirement; the omitted IDs match between CLI and MCP.
