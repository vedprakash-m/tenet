<!-- DRAFT for owner review. Placeholders are marked PLACEHOLDER; each one is listed in the report that came with this draft. -->
# PLACEHOLDER-NAME (working name: Tenet)

A governed, test-first engineering loop for GitHub Copilot in VS Code. A small local program (the kernel) records what is true about a piece of work. A plugin of agents, commands and skills does the work and cannot relabel what the kernel recorded.

> **Status: preview. Nothing is qualified on a real host yet.**
> The qualified host tuple (VS Code, the Copilot extension, the model, the operating system) is **unrecorded**. No requirement has passed qualification. Read [Status](#status) before you install.

## What Tenet adds

Copilot already chats, edits and runs tools. Tenet adds a fixed loop around a request, and keeps its records outside the chat:

- **A written acceptance basis.** Before code, the request becomes confirmed examples and rules you can read and correct.
- **Test-first work.** A failing test comes before the code that makes it pass.
- **Checks that run through the kernel.** Test results are recorded as receipts tied to the exact files they ran against. A later edit makes a receipt stale.
- **An independent review.** A separate reviewer agent (a fresh-context subagent) reads the change. Its findings carry a severity and a disposition.
- **One stated outcome.** Each piece of work ends with a label chosen by fixed rules, such as `checked-local`, `implemented-unverified`, `prototype`, `findings-only` or `blocked`. The label names what was and was not shown. `checked-local` is not owner acceptance and is not production readiness.
- **Your work stays yours.** Tenet works on a branch and commits only files it wrote. Your uncommitted edits are left alone.

What it does not do in this release line: deploy, push, or open pull requests on its own; run as a service; or send project content anywhere except through the host's model traffic.

## Status

Dated record: [specs/plan.md](specs/plan.md) (sections 1, 4 and 13). In short, as of this draft:

| Area | State |
|---|---|
| Kernel, plugin, starter recipe, deterministic tests | Built. The full test suite passes locally. This is local evidence, not a qualification. |
| Qualified tuple (host, extension, model, OS) | **Unrecorded.** No tuple is qualified. |
| Installing and running on VS Code Copilot | **Partly observed** on VS Code 1.142.0 and 1.143.0 (October 19 and 20, 2026): the plugin loaded from a local plugin location; the kernel ran from the host's snapshot copy of the plugin; real multi-step tasks ran through `finish`. The Copilot extension version was not recorded. |
| Reviewer subagent | **Partly observed.** A reviewer was dispatched several times, each time as a fresh subagent, and a partial result was correctly refused and retried. Not observed on VS Code: the reviewer's real tool list, whether its tools are restricted by the host, parallel dispatch, a cancelled or dead reviewer, and `usages`. |
| Approval behavior | **Unobserved** beyond one terminal approval ("Allow in this Session") per session. The approval mode is recorded as `unknown`. |
| A 15-minute command through the host's terminal tool | **Unobserved.** The one attempt measured a test-runner timeout, not the host. |
| Enable, disable, uninstall and update of the plugin | **Unobserved.** |
| Which instruction file the host loads, `.tenet/` exclusion from host indexing, token-estimate accuracy | **Unobserved or inconclusive.** |
| Hooks | None ship. The kernel finds edits made outside its own calls by comparison. |
| Copilot CLI | Early hypotheses only. Not part of this release line. |
| Publisher, signed release, checksums, provenance | **Not published.** There is no release to verify yet. |

Capabilities described in this repository are intended outcomes until their gates pass.

## Before you install

**Do not rely on the items below until each says "qualified".** Today none of them does.

- **Prerequisites.** VS Code with GitHub Copilot Chat in agent mode and the setting that enables agent plugins; Node.js 22.12 or newer (Tenet reuses your Node and installs nothing); Git. Full checking needs a TypeScript or JavaScript project that uses Vitest. Other setups get a lower assistance level, which Tenet states in its first message.
- **Support matrix.** No combination is supported. VS Code on macOS is the only environment that has been tried, and only partly (see [Status](#status)). Everything else is untested.
- **Permissions and executable content.** The plugin ships one bundled file, `plugin/kernel/tenet.mjs`, that the agent runs with your Node through the host's terminal tool. The host asks you to approve terminal commands. Tenet's own project checks (your tests, linters, servers) also run as local processes. The plugin ships no hooks and no network client.
- **Publisher and verification.** PLACEHOLDER-PUBLISHER and PLACEHOLDER-REPOSITORY-URL. No signed release, checksum file or provenance record exists yet; until they do, verification is reading the source in this repository and building it yourself.
- **Autopilot.** Under Copilot's Autopilot, the host can answer native questions automatically, and Tenet cannot tell your answers from automatic ones. Questions about scope, protected paths, remote or destructive actions, risk and owner acceptance are therefore asked in plain chat, and every decision record made under Autopilot is unverifiable. Do not use Autopilot for work where that matters.

Full details: [docs/user/install-and-remove.md](docs/user/install-and-remove.md).

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

## Documentation

- [What Tenet adds](docs/user/what-tenet-adds.md)
- [The qualified tuple, as it stands](docs/user/qualified-tuple.md)
- [Install and remove](docs/user/install-and-remove.md)
- [The Autopilot limit](docs/user/autopilot.md)
- [Three starter requests](docs/user/starter-requests.md)
- For maintainers: [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [NOTICE](NOTICE), and the specifications in [specs/](specs/) ([PRD](specs/PRD.md), [tech spec](specs/tech-spec.md), [UX spec](specs/ux-spec.md), [plan](specs/plan.md))

## License

PLACEHOLDER-LICENSE: no license has been chosen (plan section 4.5). Until the owner chooses one and adds a license file, no permission to use, copy or distribute this code is granted by this repository. The plugin manifest currently says `UNLICENSED`. Using Tenet does not require you to disclose your application's source and gives Tenet no ownership of it; obligations of incorporated third-party code are listed in [NOTICE](NOTICE).
