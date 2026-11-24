# CP-0045 · Answers to the round 3 specification questions

Answers to [proposals-r3.md](proposals-r3.md), decided on 2026-11-23 to unblock `CP-0045`.

1. **Query domain and selection precedence.**
   - **Precedence:** `ALG-10`'s five-group order is normative across CLI, SDK and MCP: (1) `global`, (2) `id` (`--ids`), (3) `path` (`--paths` citations), (4) `applies_to` (`--paths` prose sections), (5) `query` (`--query`). `ux-spec.md` Part 5 is updated to list IDs before paths.
   - **Query search domain:** case-insensitive substring match against a blessed requirement's `text` or a blessed section's `heading`. The parenthetical `"(titles only)"` in `contracts.md §8` is removed.
   - **Spec edits:** `tenet/specs/tech-spec/contracts.md` §8 (`line 117`), `tenet/specs/tech-spec/algorithms.md` (`ALG-10`, `line 165`), and `tenet/specs/ux-spec.md` Part 5 (`line 200`).

2. **Closed result schema, prose IDs, owners, drafts and warnings.**
   - **`reason` values:** `"global" | "id" | "path" | "applies_to" | "query"`.
   - **Prose section `id` (`applies_to`):** `"<doc>#<slug>"` where `<doc>` is `tenet.doc ?? path`, with `section: "<slug>"` and `text` equal to the blessed copy body.
   - **`owner` string:** single string (`section.owner ?? doc.owner`, else CODEOWNERS principals joined by `", "`, else `"Owner"`).
   - **`drafts` array:** `[{id?: string, section: string, path: string, state: "draft" | "deferred", text: string, integrity_failed?: boolean}]`. Empty (`[]`) unless `include_drafts: true` or a candidate blessed section fails `ALG-03` blessed-copy integrity (`TN-SPEC-BLESSED-COPY`), in which case that section is excluded from `blessed` and served in `drafts` with `state: "draft"`, `integrity_failed: true`, and working-tree `text`. `rejected` sections are never returned.
   - **`index` `title`:** `item.text.slice(0, 80)` (the requirement's parsed `text` without `{…}` metadata, sliced to at most 80 UTF-16 code units).
   - **Warnings and `"nothing blessed yet; run tenet bless"`:** the 6 result keys (`{blessed, drafts, index, omitted, truncated, rules}`) never change. Under CLI `--json`, `TN-SPEC-BLESSED-COPY` is emitted in envelope `errors[]`; in human CLI output and MCP `content[0].text`, `"nothing blessed yet; run tenet bless"` (when the repository has 0 valid blessed sections) and any integrity notice are rendered in the text summary.
   - **Spec edits:** `tenet/specs/tech-spec/contracts.md` §9 (`line 140`), `tenet/specs/tech-spec/algorithms.md` (`ALG-10`, `lines 164–169`), and `tenet/specs/plan/alpha.0.md` (`CP-0045` *Behavior*, `lines 145–149`).

3. **Budget accounting.**
   - **Token formula:** `tokens(s) = Math.ceil(s.length / 4)` over LF-normalized text (`tokens(item.text)` for `blessed` candidates; `tokens(id + " " + title)` for `index` entries). `budget_tokens <= 0` or non-finite refuses with `TN-USAGE-BUDGET` (or JSON-RPC `-32602` in MCP).
   - **Scanning and omission:** walk candidates in group order `(1..5)`. If a non-explicit candidate exceeds remaining budget (`used + item_tokens > budget_tokens`), append its `id` to `omitted`, set `truncated = true`, and continue scanning later candidates so a smaller item that fits is still admitted.
   - **Explicit `ids` (Group 2):** always admitted whole to `blessed` (never placed in `omitted`), advancing `used = Math.min(budget_tokens, used + item_tokens)` and setting `over_budget: true` when `item_tokens > budget_tokens`. `truncated` becomes `true` iff `omitted.length > 0`.
   - **Index:** built from remaining blessed requirements not in `blessed` and not in `omitted` (ordered by `L0 < L1 < L2 < null`, then numeric/ASCII ID), adding entries while `index_used + entry_tokens <= Math.floor(budget_tokens * 0.20)`.
   - **Spec edits:** `tenet/specs/tech-spec/algorithms.md` (`ALG-10`, `lines 166–170`).

4. **Rule list and MCP transport encodings.**
   - **`rules` array:** lists the active pack's five alpha.0 rules (`tests-not-weakened`, `protected-surfaces`, `acceptance-passed`, `citations-valid`, `budget`) in pack order, each with its effective capped `mode` from `ruleMode(policy, rule)`.
   - **MCP `content[0].text` and JSON-RPC errors:** `tools/call` sets `content[0].text` to the same Markdown/human summary printed by `tenet context` and `structuredContent` to the 6-key result object (`isError: false`). JSON-RPC errors use `{code, message}` with standard messages (`-32700` `"Parse error"`, `-32600` `"Invalid Request"`, `-32601` `"Method not found"`, `-32602` `"Invalid params"`).
   - **Spec edits:** `tenet/specs/tech-spec/contracts.md` §9 (`lines 135–140`) and `tenet/specs/plan/alpha.0.md` (`CP-0045` *Behavior*, `line 145`).
