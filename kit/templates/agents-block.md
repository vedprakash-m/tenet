<!-- tenet:begin v{version} -->
## Working with Tenet

This repository's intent lives in specifications: {documents with their levels}.
Blessed text is the source of truth. Drafts are hints only.

Before you change code:
1. Get context for the paths you will touch: the MCP tool `tenet_context`, or
   `tenet context --paths <paths>`. Read every blessed requirement it returns,
   including the global rules. If it lists omitted IDs, ask for them by ID.
2. A requirement flagged `edited` or `sources-changed` still applies as blessed.
   Say so in your pull request if your change depends on it.

Every pull request:
- Has a `## Acceptance` section: an `Implements: {prefix}-12, {prefix}-14` line, then
  one line per item, `- [AB-1] what must hold`. Number items from 1 in each pull
  request. (A packet keeps this block in its `definition.md`.)
- Tags each test that shows an item: {tagging line for the detected runner}.
  A test that should keep proving a requirement also carries `[{prefix}-12]`.
- Never deletes, skips or weakens a test to make a check pass. If a test is wrong,
  explain why in the pull request.

Specifications:
- To change {L0–L2 documents}, edit the specification file in this pull request
  and say why. The edit is a proposal: the blessed text stays in force until its
  owner blesses the change. Never bless.
- A change to `tenet.yaml` (for example a new check) is also a proposal: make it
  in this pull request and say why; it counts once the Owner approves it.
- Never edit `{records}/blessed/`, blessing fields in front matter, `tenet.lock`
  or Tenet's workflows.

Working rules:
{working rules}

Stop and write your question in the pull request when a requirement conflicts
with the task, the same check fails three times, or passing would need a changed
test, acceptance item or specification.
<!-- tenet:end -->

<!-- Tagging lines filled for `{tagging line for the detected runner}` (non-normative binding reference):
- vitest / jest / node:test / mocha: `it("[AB-1] retries once after a timeout", ...)`
- pytest: `def test_retries_once_tenet_AB_1():` or `record_property("tenet.case", "AB-1")` in the test body
- go: `t.Run("[AB-1] retries once", ...)` (reported as `TestRetry/[AB-1]_retries_once`)
- junit: `@Test` then `void retriesOnce_tenet_AB_1()` (or property `tenet.case`)
- rust: `#[test]` then `fn retries_once_tenet_AB_1()`
- other: `tenet_<ID with underscores>` in the test name, or the `tenet.case` property
-->
