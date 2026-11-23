# CP-0045 pending round 4

`r4/spec-answers:tenet/packets/CP-0045-agent-context/escalations/answers-r4.md`
is binding. It resolves query and selection, the closed result, budget
accounting, rules, and MCP transport in `proposals-r3.md`.

## Resolved conformance dependencies

| Specification question | Cases depending on it |
|---|---|
| Query domain and selection precedence | `p03-id-and-path-deduplicate`, `p10-query-case-insensitive` |
| Budget accounting and explicit IDs | `n04-local-omitted`, `n05-over-budget-explicit-id`, `p07-mcp-session`, `p09-global-beyond-reserve` |
| Closed context result, drafts and integrity | `n01-no-blessed-material`, `n03-broken-blessed-copy`, `p01-path-admitted`, `p02-retry-once-source-changed`, `p04-include-draft-with-blessing`, `p05-no-inputs-global-and-index`, `p08-applies-to-prose` |
| Rules and transport encoding | `n06-unknown-method`, `p06-checked-policy-rule`, `p07-mcp-session` |

No query, result-schema, budget, rule-list or core-transport case remains
unresolved.

## Contract-defined but not fixture-pinned

- The exact object fields of `tenet_status` work-item state, `tenet_next`
  actions, and the on-disk envelope/name for `tenet_propose` are not defined
  beyond Contracts §9. The implementation uses the smallest projection of the
  available policy/packet data and a `proposals/<ulid>.json` file inside the
  named packet folder.
- Tool descriptions and the exact human prose outside the resolved
  `content[0].text == tenet context` rule are not golden-pinned.

These do not justify inventing broader authority. A later specification change
or fixture can pin them without changing the determinable CP-0045 cases above.
