<!-- DRAFT. Host observations remain the dated observations below. Deterministic source evidence was reconciled on 2026-11-05; CI does not qualify an installed host. -->
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

Exact-source [CI 41977194444](https://github.com/vedprakash-m/tenet/actions/runs/41977194444), for commit `14aa0f71a5970c708e62423b44d5a06b81a93c94`, passes full CI on Ubuntu and macOS and built-bundle UAT on Node 24 and minimum Node 22.12.0. It covers the kernel, plugin text checks, starter and real repository/process scenarios. The Windows job checks portability and explicit platform refusals; it does not exercise a supported Windows mutating workflow.

This is deterministic source and built-bundle evidence, not an installed VS Code/Copilot qualification. It does not establish reviewer isolation, approval behavior, model effectiveness, human comprehension or a public release chain. Later source changes require their own validation; the separate schema-2 candidate is not covered.

## Other hosts

Copilot CLI was run once, before the VS Code runs. The results are hypotheses, and the CLI is outside this release line.

## Support matrix

**Current-model label (ENG-05): not yet evaluated with the current model.** Apply this label to each combination without a dated native-host suite run on that model. A host/model change invalidates the current-model evaluation label, not the historical observation record. The monthly `model-drift.yml` workflow requests a new run; an issue or deterministic CI pass is never evidence that it happened. When the model is unobservable, claims stop at the last evaluation date.

| Environment | Status |
|---|---|
| VS Code with GitHub Copilot, macOS arm64 | Partly observed in the dated runs above; **not qualified** |
| VS Code with GitHub Copilot, Linux | Installed-host behavior unobserved; POSIX source CI and built UAT pass, but do not qualify this host |
| VS Code with GitHub Copilot, Windows | Installed-host behavior unqualified; read-only inspection and advisory review available, mutating kernel calls refused |
| Copilot CLI | Untested for release; hypotheses only |
| Other editors and agents | Not supported |
