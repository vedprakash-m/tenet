# Track 3 · MAI Code 2 · Group B (agent context and skills), then group E (upgrade and anchors)

Read [common.md](common.md) first. Worktree `Q:\Ved\Pers\tenet-track3` only. Never work in `Q:\Ved\Pers\tenet`.

## Part 1 · Group B (branch `cp-0066/b-context`)

### Specifications to read

- `tenet/specs/tech-spec/algorithms.md` ALG-10 (context selection).
- `tenet/specs/tech-spec/mcp.md` §2.
- `tenet/specs/tech-spec/agents.md` (what agents are told; skills and hosts).
- `tenet/specs/tech-spec/onboarding.md` §2 (what init may write for hosts, and any consent rule).

### Code to start from

`src/context/index.ts`, `src/commands/context.ts`, `src/mcp/`, `src/cli.ts` (argument parsing), `src/install/hosts.ts`, `src/install/writes.ts`, `kit/skills/*/SKILL.md`, `README.md` (quick start prompt), the generated `AGENTS.md` template.

### What was observed (synthetic)

1. **AB-B1 (F-53):** blessed sections:
   - section A, `applies_to: ["app/**", "pyproject.toml"]`, holds the requirement a change needs;
   - section B, `applies_to: ["**"]`, holds 53 work items (11 KB);
   - one global rule.

   `context --paths app/config/resolve.py,tests/test_resolve.py,pyproject.toml` returns the global rule, a vision checklist and **all of section B**. Section A appears only as a title in the index, without its text. Only `--ids` returns the needed requirement. Find why the glob match didn't select section A (check how `applies_to`, anchors and the `"**"` fallback interact), rank specific matches first, and keep big `"**"` sections from filling the budget.
2. **AB-B2 (F-38):** before anything is blessed:
   - plain `context` says nothing is blessed;
   - `--include-drafts` lists 39 draft section *names* with no text or path, and the same list for any `--paths` or `--ids`;
   - `--json --query … --include-drafts` dumps every draft section (78 KB) with `truncated: false`.

   Drafts must be selected and budgeted like blessed text, marked as drafts.
3. **AB-B3 (F-52):** `--paths a b` fails with "unexpected positional arguments". Commas work but aren't documented. Support commas and a repeated flag, and document both.
4. **AB-B4 (F-21, F-12, and F-08's host line):** in a repository with no agent configuration, init's plan says "agents (skills+mcp)" but:
   - it writes skills only to `.agents/skills/`, which Claude Code doesn't load;
   - it registers no MCP server;
   - the skill's front matter says `name: draft-specs` while the README asks for "the `tenet-draft-specs` skill";
   - an agent pasting the README prompt can't find the skill without searching.

   Make the names match everywhere. Make the README prompt work in Claude Code, by installing or pointing to skills where it loads them and registering MCP, within what the specification allows. If it requires consent for host files, ask in init's plan and honour `--yes` as the spec says. List each host file in the plan, with a reason. Add the skill's path to the README prompt as a fallback.

Existing cases in `pkg/conformance/alg-10/` and `install/` may pin today's behaviour. If one blocks an AB item, stop and report it.

## Part 2 · Group E (branch `cp-0066/e-upgrade-anchors`, after B's pull request is green)

### Specifications to read

ALG-03 and the anchors entry in `contracts.md` (around line 47), and `onboarding.md` §2 (upgrade).

### Code to start from

`src/specs/anchors.ts`, `src/specs/citations.ts`, `src/onboard/bless.ts` (writing anchors), `src/install/upgrade.ts`, `src/install/writes.ts` (manifest).

### What was observed (synthetic)

1. **AB-E1 (F-56):** after init writes 12 managed paths, a same-version `upgrade --offline` reports 8. It drops the pull-request template, both workflows and their `.gitattributes` lines from the manifest. A later `remove` then leaves the workflows behind. Make same-version upgrade a no-op, with a test.
2. **AB-E2 (F-47, Owner decision L-0041: hashes only):** blessing writes `tenet/blessed/<doc>/<section>.md.anchors.json` holding the full text of every cited range, so a second copy of cited source text lands in git. Change anchors to keep a hash, the line range and the blessed commit, and no text. When a cited source changes, show the old text from git history (`git show <blessed commit>:<path>`) when it's available, and otherwise the changed range. Make `upgrade` rewrite existing anchor files without text. Update ALG-03 and the contract in the same pull request, as a proposal. Existing tests of stale-source behaviour must keep passing, or be reported to the coordinator.
