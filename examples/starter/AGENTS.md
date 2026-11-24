<!-- tenet:begin v0.1.0-alpha.0 -->
## Working with Tenet

This repository's intent lives in specifications: tenet/intent.md (L1).
Blessed text is the source of truth. Drafts are hints only.

Before you change code:
1. Get context for the paths you will touch: the MCP tool `tenet_context`, or
   `tenet context --paths <paths>`. Read every blessed requirement it returns,
   including the global rules. If it lists omitted IDs, ask for them by ID.
2. A requirement flagged `edited` or `sources-changed` still applies as blessed.
   Say so in your pull request if your change depends on it.

Every pull request:
- Has a `## Acceptance` section: an `Implements: R-12, R-14` line, then
  one line per item, `- [AB-1] what must hold`. Number items from 1 in each pull
  request. (A packet keeps this block in its `definition.md`.)
- Tags each test that shows an item: `tenet_<ID with underscores>` in the test name, or the `tenet.case` property.
  A test that should keep proving a requirement also carries `[R-12]`.
- Never deletes, skips or weakens a test to make a check pass. If a test is wrong,
  explain why in the pull request.

Specifications:
- To change the L0–L2 documents listed above, edit the specification file in this pull request
  and say why. The edit is a proposal: the blessed text stays in force until its
  owner blesses the change. Never bless.
- A change to `tenet.yaml` (for example a new check) is also a proposal: make it
  in this pull request and say why; it counts once the Owner approves it.
- Never edit `tenet/blessed/`, blessing fields in front matter, `tenet.lock`
  or Tenet's workflows.

Working rules:
- State your assumptions. If the task can be read more than one way, say so and ask; don't choose silently.
- Make the smallest change that meets the acceptance items. No features, options or abstractions nobody asked for.
- Touch only what the task needs. Match the existing style. Don't tidy unrelated code; mention it instead.
- Remove only what your own change made unused.
- Before you start, say how each step will be checked; finish only when it is.
- Write plain words: say what you mean, without flourish.

Stop and write your question in the pull request when a requirement conflicts
with the task, the same check fails three times, or passing would need a changed
test, acceptance item or specification.
<!-- tenet:end -->
