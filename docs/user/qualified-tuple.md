<!-- DRAFT. Every row is taken from specs/plan.md sections 1, 4 and 13 as of 2026-10-24. Update it when a spike or qualification run is recorded there. -->
# The qualified tuple, as it stands

A **tuple** is the exact combination Tenet's claims are tested against: host application and version, Copilot extension and version, model, operating system, Node.js and Git. A claim is qualified only for a tuple on which it was tested.

**Today the tuple is unrecorded and nothing is qualified.** No requirement has passed a qualification run on a real host. The first VS Code runs did not record the Copilot extension version, so even the partly observed results below cannot be tied to a complete tuple.

## What was observed

Observations by the development team, on VS Code with a managed model, in throwaway projects.

| Date | Host (as recorded) | Observed |
|---|---|---|
| 2026-10-19 | VS Code 1.142.0, macOS, manual terminal permissions; Copilot extension version not recorded | The plugin loaded from a local plugin location. VS Code ran the kernel from its own snapshot copy of the plugin. A reviewer subagent was dispatched and its result accepted. Two runs of one task ended `implemented-unverified` and `checked-local`. |
| 2026-10-20 | VS Code 1.143.0, `@github/copilot` 1.0.100-1, macOS arm64 | A real multi-step task ran through `finish`. The reviewer was dispatched at least three times as a fresh subagent. A partial result was refused and retried. The agent refused to edit `.tenet/`. No contamination of the reviewer by the chat was seen. |

## What was not observed

- The reviewer's real tool list, and whether the host enforces its tool restriction (a different surface showed it was only cooperative).
- Parallel dispatch, a cancelled or dead reviewer, native questions inside a subagent, and `usages` on VS Code.
- Approval behavior beyond one terminal approval per session. The approval mode is recorded as `unknown`.
- A 15-minute command through the host's terminal tool. The one attempt hit a test-runner timeout first and measured nothing about the host.
- Enable, disable, uninstall and update of the plugin, and what survives them.
- Which instruction file the host loads when both `AGENTS.md` and `.github/copilot-instructions.md` exist, whether `.tenet/` is excluded from the host's indexing, and how accurate Tenet's token estimates are.
- Where a plugin can keep persistent data.
- Hooks (none ship), usage reporting and model resolution.

## What is tested without a host

Deterministic tests on the development machine, against real Git and real processes: the kernel, the plugin text checks, the starter recipe and a golden task. As of 2026-10-24 the full suite is recorded in the plan as passing, with built-bundle scenarios on Node 22.12.0 and Node 26.3.0. This is local evidence about the kernel. It is not evidence about any host.

## Other hosts

Copilot CLI was run once, before the VS Code runs. The results are hypotheses, and the CLI is outside this release line.

## Support matrix

| Environment | Status |
|---|---|
| VS Code with GitHub Copilot, macOS | Experimental in the sense that it has been tried; **not qualified**, no smoke list published |
| VS Code on Windows or Linux | Untested |
| Copilot CLI | Untested for release; hypotheses only |
| Other editors and agents | Not supported |
