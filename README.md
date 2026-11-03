# Tenet (working name)

A governed, test-first engineering loop for GitHub Copilot in VS Code. A small local program (the kernel) records what is true about a piece of work. A plugin of agents, commands and skills does the work and cannot relabel what the kernel recorded.

> **Status: preview. Nothing is qualified on a real host yet.**
> The qualified host tuple (VS Code, the Copilot extension, the model, the operating system) is **unrecorded**. No requirement has passed qualification. Read [Status](#status) before you install.

## What Tenet adds

Copilot already chats, edits and runs tools. Tenet adds a fixed loop around a request, and keeps its records outside the chat:

- **A written acceptance basis.** Before code, Tenet records examples and rules; it asks you to confirm or correct Tenet-added examples, assumptions or design commitments when the kernel returns `basis-confirm`.
- **Test-first work.** A failing test comes before the code that makes it pass.
- **Checks that run through the kernel.** Test results are recorded as receipts tied to the exact files they ran against. A later edit makes a receipt stale.
- **A reviewer subagent.** It reads the change and reports findings with a severity and a disposition. Dispatch has been observed on VS Code; host-enforced context isolation and tool restrictions have not.
- **One stated outcome.** Each piece of work ends with a label chosen by fixed rules, such as `checked-local`, `implemented-unverified`, `prototype`, `findings-only` or `blocked`. The label names what was and was not shown. `checked-local` is not owner acceptance and is not production readiness.
- **Your work stays yours.** Tenet works on a branch and commits only files it wrote. Your uncommitted edits are left alone.

What it does not do in this release line: deploy, push, or open pull requests on its own; run as a service; or send project content anywhere except through the host's model traffic.

## Status

Dated record: [specs/plan.md](specs/plan.md) (sections 1, 4 and 13). Current source-checkout evidence, as of October 31, 2026:

| Area | State |
|---|---|
| Kernel, plugin, starter recipe, deterministic tests | Local `npm run ci` passes typecheck, lints, M0 coverage, the 763 KB bundle build, payload verification, reproducibility and 1,296 tests / 206 suites. Built-bundle UAT, privacy and whitespace checks pass. This is local source evidence, not hosted CI or host qualification; the working tree is not a release artifact. |
| Qualified tuple (host, extension, model, OS) | **Unrecorded.** No tuple is qualified. |
| Installing and running on VS Code Copilot | **Partly observed** on VS Code 1.142.0 and 1.143.0 (October 19 and 20, 2026): the plugin loaded from a local plugin location; the kernel ran from the host's snapshot copy of the plugin; real multi-step tasks ran through `finish`. The Copilot extension version was not recorded. |
| Reviewer subagent | **Partly observed.** A reviewer was dispatched several times on VS Code, and a partial result was refused and retried. Not observed: the reviewer's real tool list or host enforcement of its restrictions, actual context isolation, parallel dispatch, a cancelled or dead reviewer, and `usages`. |
| Approval behavior | **Unobserved** beyond one terminal approval ("Allow in this Session") per session. The approval mode is recorded as `unknown`. |
| A 15-minute command through the host's terminal tool | **Unobserved.** The one attempt measured a test-runner timeout, not the host. |
| Enable, disable, uninstall and update of the plugin | **Unobserved.** |
| Which instruction file the host loads, `.tenet/` exclusion from host indexing, token-estimate accuracy | **Unobserved or inconclusive.** |
| Hooks | None ship. The kernel finds edits made outside its own calls by comparison. |
| Copilot CLI | Early hypotheses only. Not part of this release line. |
| Publisher, signed release, checksums, provenance | **Not published.** The source build creates `plugin/SHA256SUMS` for local payload integrity; there is no signed release or provenance attestation. |

Capabilities described in this repository are intended outcomes until their gates pass.

## Before you install

**No host tuple or release is qualified.** Treat this repository as a source preview, not as a supported public installation.

- **Prerequisites.** VS Code with GitHub Copilot Chat in agent mode and the setting that enables agent plugins; Node.js 22.12 or newer (Tenet reuses your Node and installs nothing); Git. Full checking needs a TypeScript or JavaScript project that uses Vitest. Other setups get a lower assistance level, which Tenet states in its first message.
- **Permissions and executable content.** The plugin ships one bundled file, `plugin/kernel/tenet.mjs`, that the agent runs with your Node through the host's terminal tool. The host asks you to approve terminal commands. Tenet's own project checks (your tests, linters, servers) also run as local processes. The plugin ships no hooks and no network client.
- **Publisher and verification.** The marketplace publisher is **not designated**, and no public release exists; “Tenet” remains a working name pending namespace clearance. The source repository is [vedprakash-m/tenet](https://github.com/vedprakash-m/tenet). There is no signed tag, provenance attestation or published release checksum. To verify this source preview, confirm the repository and commit, inspect the source, then run `npm ci` and `npm run build`; the generated `plugin/SHA256SUMS` checks local payload bytes only and does not authenticate a publisher or release.
- **Autopilot.** Under Copilot's Autopilot, the host can answer native questions automatically, and Tenet cannot tell your answers from automatic ones. Questions about scope, protected paths, remote or destructive actions, risk and owner acceptance are therefore asked in plain chat, and every decision record made under Autopilot is unverifiable. Do not use Autopilot for work where that matters.
- **If policy blocks installation or a required feature.** An organization or plan policy can disable agent mode, agent plugins, custom agents or subagents. Tenet cannot see the policy and does not try to get around it. The recovery path is the host's own: read the message VS Code or Copilot shows, ask whoever manages your Copilot organization settings to allow the missing feature, or use an account where it is allowed. Until then Tenet does not work, and Copilot without the plugin is unchanged. Setting names and messages are unobserved: no blocked install has been recorded.

Full details: [docs/user/install-and-remove.md](docs/user/install-and-remove.md).

## Support matrix and assistance levels

No combination is currently qualified. These observations are not support claims:

| Environment | Status |
|---|---|
| VS Code with GitHub Copilot on macOS arm64 | Partly observed; no complete qualified tuple |
| VS Code with GitHub Copilot on Linux | Host behavior unobserved; not qualified |
| VS Code with GitHub Copilot on Windows | Read-only inspection only; mutating kernel calls are refused; not qualified |
| Copilot CLI, other editors or agents | Outside this release line or untested; not supported |

Tenet states one assistance level for each project and task:

| Level | What Tenet can do | Highest endpoint |
|---|---|---|
| L0 Refuse | Explain why a required boundary cannot be met | `blocked` |
| L1 Inspect | Read, explain and review source | `findings-only` |
| L2 Plan | Propose requirements, plan items and a readiness task | `findings-only` |
| L3 Implement, unqualified | Implement and run available checks outside the qualified profile | `implemented-unverified` |
| L4 Qualified local | Implement inside the qualified profile with full evidence | `checked-local` |
| L5 Deliver | Planned for R1.1; not available in this release line | `delivered` |

## Install

There is no public install path yet. The only route that has been tried is the preview route for people who build from source:

```bash
npm ci
npm run build
```

Then point VS Code's `chat.pluginLocations` setting at the `plugin/` folder of this repository. This route clones and builds, so it does not meet the requirement that a user install without cloning or building; that requirement is open. VS Code keeps its own snapshot copy of the plugin and may not pick up edits until it refreshes it. See [docs/user/install-and-remove.md](docs/user/install-and-remove.md).

## Remove

Remove the plugin from `chat.pluginLocations` (uninstall behavior is unobserved on the host), then in each project where you used Tenet ask Tenet "help uninstall". It lists what remains and offers two previewed cleanups. Tenet never deletes `.tenet/` or your files; you remove `.tenet/` yourself. See [docs/user/install-and-remove.md](docs/user/install-and-remove.md).

## Three requests to start with

In Copilot Chat, agent mode:

1. **A new app.** `/tenet build a small API for tracking reminders, with sign-in`
2. **A bug fix.** `/tenet fix: saving a reminder with an empty title returns a server error, and it should say the title is required`
3. **A review.** `/tenet-review review my uncommitted changes` (read-only: it changes nothing in your project; its review file is written to the system temp folder. Only uncommitted changes against `HEAD` can be reviewed today.)

More on each: [docs/user/starter-requests.md](docs/user/starter-requests.md).

## Update

There is no public update path, and plugin update and stored-record migration have not been qualified. For the source preview, select and review the exact repository commit you want to use, rebuild it, and point VS Code at that checkout's `plugin/` folder. Do not assume an active contract or older `.tenet/` state can migrate safely; see [Install and remove](docs/user/install-and-remove.md).

## Offline evaluation tools

Maintainers can validate static protocol files, replay hand-authored synthetic observations, or render a local campaign report:

```bash
npm run eval:validate -- --protocol <path>
npm run eval:replay -- --capture <path>
npm run eval:report -- --input <path> --format json|markdown|junit
```

`eval:report` reads a `CampaignReportInputV1` JSON file and writes the selected report to stdout. Exit codes are 0 for report eligibility `pass`, 3 for `fail` or `inconclusive`, 2 for invalid input, and 1 for usage errors. Eligibility is computed from untrusted local declarations; it does not authorize a run, qualify a requirement, or establish support. Validation and replay are local-only and do not execute graders, capture host sessions, or contact a model.

## Documentation

- [What Tenet adds](docs/user/what-tenet-adds.md)
- [The qualified tuple, as it stands](docs/user/qualified-tuple.md)
- [Install and remove](docs/user/install-and-remove.md)
- [The Autopilot limit](docs/user/autopilot.md)
- [Three starter requests](docs/user/starter-requests.md)
- For maintainers: [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [NOTICE](NOTICE), and the specifications in [specs/](specs/) ([PRD](specs/PRD.md), [tech spec](specs/tech-spec.md), [UX spec](specs/ux-spec.md), [plan](specs/plan.md))

## License

Tenet and its own starter-template code are licensed under the [MIT License](LICENSE). Retain the required copyright and permission notice when copying or distributing substantial portions. Your application code remains yours; using Tenet does not require source disclosure or give Tenet ownership of it. Third-party components retain their own licenses and notices, listed in [NOTICE](NOTICE). License selection is not a claim of release readiness or approval to publish.
