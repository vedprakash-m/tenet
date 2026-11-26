---
tenet: {spec: 1, doc: escalation, level: L2, version: "0.1", owner: "Ved Mishra"}
sections:
  what-was-attempted: {level: L2, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
  where-it-rubs: {level: L2, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
  resolution: {level: L2, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
  completeness-checklist: {level: L2, state: draft, digest: null, blessed_digest: null, blessed_at_rev: null, applies_to: ["**"], flags: []}
---
# Escalation: Claude Code install output contradicts independent goldens

> Work item: `CP-0066 / track 3 / group B` · Stop signal: conflicting requirements · Lowest level that can decide: owner

## What was attempted

- Implemented AB-B1 through AB-B4 on `cp-0066/b-context`.
- Focused context, CLI, MCP, kit and install tests pass.
- `npm run lint` exits 0. The 500-document timing test passes when rerun without the full suite contention.
- A same-branch run of the three affected scenario cases reproduced the conflict consistently.

## Where it rubs

- AB-B4 (F-21, F-12) requires a repository with no agent configuration to install or point to skills where Claude Code loads them and register the MCP server.
- The protected independent goldens for `s07-install-interrupted-part-way`, `s11-readme-walkthrough` and `s13-ux-walkthrough-new` expect no Claude host, no `CLAUDE.md`, no `.claude/skills/`, and `keys: []` for that same repository shape.
- The new implementation adds Claude to `hosts`, three `.claude/skills/` files, the `CLAUDE.md` block, and `.mcp.json/mcpServers/tenet`, so those exact goldens fail.
- CP-0066's rules forbid builders from editing `pkg/conformance/**` cases written by others and require stopping when an independent case contradicts an acceptance item.
- After applying the Owner decision, `s07` and `s11` pass unchanged. `s13` still fails only because its protected inventory golden pins the old SHA-256 bytes for the three skill files. Keeping `name: tenet-*` necessarily changes those bytes, but changing that golden is forbidden.
- **Owner decision (2026-11-26):** `s13` must remain unchanged. Its `04-onboard-inventory.json` hash changes are expected from the approved skill rename. The case owner will refresh the three hashes in a separate pull request, and the coordinator will merge both pull requests together.

## Resolution

1. Stopped group B without weakening or editing the independent scenarios.
2. **Owner decision (2026-11-26):** narrow AB-B4. A repository with no agent setup stays neutral; host writes require a detected marker or repeatable `--host claude|cursor|copilot|vscode`.
3. Kept the skill renames, host-file reasons, AB-B1 through AB-B3, and the README fallback at `.agents/skills/tenet-draft-specs/SKILL.md`.
4. Open group B with the exact `s13` exception in the pull request; do not edit, weaken or normalize the protected case.
5. Start group E independently from `origin/main`; do not build it on group B.

## Completeness checklist

- [x] Quotes the conflicting acceptance item and names the protected cases.
- [x] Names the stop signal and evidence.
- [x] Names the owner as the lowest level that can resolve it.
- [x] Lists `stop` as the first option.
