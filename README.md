# Tenet

**Make Copilot work test-first, check its own work, and say honestly what it did and did not prove.**

Tenet is a plugin for GitHub Copilot in VS Code. You type `/tenet` and what you want. Tenet writes down what "done" means, has Copilot write a failing test first, runs your checks through a small local program that records the results, has a separate reviewer read the change, and ends with one plain label such as `checked-local` or `implemented-unverified`.

> **Preview (v0.1.0). Try it on a throwaway project.**
> Tenet works on a branch and commits only files it wrote, but nothing has been qualified on a real host yet, so do not point it at valuable work, secrets or production credentials. Known open defects are listed under [Before you install](#before-you-install). Seen something odd? [Tell us what happened](https://github.com/vedprakash-m/tenet/issues/new?template=host-report.yml); that is how this preview improves.

## Quick start (about 5 minutes)

**You need:** VS Code with GitHub Copilot Chat in agent mode, [Node.js](https://nodejs.org) 22.12 or newer, and Git. Check with `node --version` and `git --version`. macOS or Linux; on Windows Tenet only reads and reviews.

**1. Download and unpack the plugin.** No build step.

```bash
mkdir -p ~/tenet-plugin && cd ~/tenet-plugin
curl -fsSLO https://github.com/vedprakash-m/tenet/releases/download/v0.1.0/tenet-plugin-v0.1.0.tgz
curl -fsSLO https://github.com/vedprakash-m/tenet/releases/download/v0.1.0/tenet-plugin-v0.1.0.tgz.sha256
shasum -a 256 -c tenet-plugin-v0.1.0.tgz.sha256   # on Linux: sha256sum -c tenet-plugin-v0.1.0.tgz.sha256
mkdir plugin && tar -xzf tenet-plugin-v0.1.0.tgz -C plugin
```

The check should print `OK`. If it does not, stop and re-download.

**2. Tell VS Code where the plugin is.** Open your user `settings.json` (Command Palette, then "Preferences: Open User Settings (JSON)") and add these two settings, using the full path to the `plugin` folder you just made (run `cd plugin && pwd` to print it):

```json
"chat.plugins.enabled": true,
"chat.pluginLocations": {
  "/full/path/to/tenet-plugin/plugin": true
}
```

If you already have `chat.pluginLocations`, add the new line inside it. Reload the VS Code window.

**3. Say hello.** Open a project folder, open Copilot Chat, switch to **Agent** mode and send:

```text
/tenet help
```

Tenet answers from its local program and starts no work. The first time, VS Code asks you to approve a terminal command; choosing "Allow in this Session" covers the rest of the session. If `/tenet` is not offered, see [If something does not work](#if-something-does-not-work).

## Three requests to start with

In Copilot Chat, agent mode:

1. **A new app.** `/tenet build a small API for tracking reminders, with sign-in`. Use an empty folder or a new Git repository.
2. **A bug fix.** `/tenet fix: saving a reminder with an empty title returns a server error, and it should say the title is required`
3. **A review.** `/tenet-review review my uncommitted changes` (read-only: it changes nothing in your project; its review file is written to the system temp folder. Only uncommitted changes against `HEAD` can be reviewed today.)

More on each: [docs/user/starter-requests.md](docs/user/starter-requests.md). Never run anything yet? Start with number 3 on a project you already have: it cannot change your files.

## What to expect

- Tenet states how careful it will be for this task, and asks only what it cannot decide itself.
- For a change it writes down examples and rules, then asks you to confirm or correct any examples or assumptions it added.
- A failing test comes first. Your tests, types and lint then run through the kernel; each result is tied to the exact files it ran against, and a later edit makes it stale.
- A reviewer subagent reads the change and reports findings, each with a severity.
- The report ends with one outcome. `checked-local` means the required checks and review passed on your machine; it is not owner acceptance and not production readiness. The others (`implemented-unverified`, `prototype`, `findings-only`, `blocked`) say what was missing.

Handy commands: `/tenet status` (where things stand, starts nothing), `/tenet why` (why the last decision or outcome), `/tenet help`. To change how it talks to you, say "be brief", "explain more" or "only interrupt for decisions".

More: [What Tenet adds](docs/user/what-tenet-adds.md).

## If something does not work

- **`/tenet` is not offered in chat.** Check that Copilot Chat is in **Agent** mode, that both settings above are in your user `settings.json`, that the path points at the folder holding `plugin.json`, and reload the window. VS Code keeps its own copy of the plugin and may need a reload or a new chat to pick up changes.
- **No agent plugins at all.** Your Copilot plan or organization may disable agent mode, plugins, custom agents or subagents. See "If policy blocks installation" below.
- **Tenet says it can only give an advisory review.** Node.js 22.12 or newer was not found by the host's terminal. Install it from nodejs.org and reload.
- **Anything else, or it surprised you.** Open a [host observation report](https://github.com/vedprakash-m/tenet/issues/new?template=host-report.yml). Run `/tenet help` and paste only its version line; do not paste code, secrets or personal paths.

## Before you install

**No host tuple or release is qualified.** Treat this as a developer preview, not a supported installation.

**Known open safety defects in this preview.** Use Tenet only on disposable projects without valuable work, sensitive data or credentials.
- Undo and cleanup removal are implemented and covered by deterministic tests, but their preservation behavior on the installed VS Code/Copilot host is not qualified.
- Recovery after an interruption can remove a file that matches what Tenet meant to write, even if someone else created it, and does not always report what it did.
- On Windows, Tenet can follow linked installed Vitest metadata and read a file outside the project. Do not use Tenet in untrusted workspaces or with untrusted installed dependencies.

- **Prerequisites.** VS Code with GitHub Copilot Chat in agent mode and the setting that enables agent plugins; Node.js 22.12 or newer (Tenet reuses your Node and installs nothing); Git. Full checking needs a TypeScript or JavaScript project that uses Vitest. Other setups get a lower assistance level, which Tenet states in its first message.
- **Permissions and executable content.** The plugin ships one bundled helper, `plugin/kernel/tenet.mjs`, that the agent runs with your Node through the host's terminal tool. The host asks you to approve terminal commands. Tenet's own project checks (your tests, linters, servers) also run as local processes. No observer hooks ship in this preview; any future hooks are gated on qualification. The plugin ships no network client.
- **Publisher and verification.** The marketplace publisher is **not designated**. [v0.1.0](https://github.com/vedprakash-m/tenet/releases/tag/v0.1.0) is a hand-published GitHub pre-release with a SHA-256 file; there is no signed tag, provenance attestation or authenticated publisher. The checksum shows your download matches that build, not who made it. To check the source yourself, confirm the repository and commit, inspect the source, then run `npm ci` and `npm run build`; the generated `plugin/SHA256SUMS` checks local payload bytes only. The source repository is [vedprakash-m/tenet](https://github.com/vedprakash-m/tenet). `/tenet help` reports the running kernel's version (`0.1.0-m0` is the build in v0.1.0); see the [release verification procedure](docs/release/release-verification.md).
- **Autopilot.** Under Copilot's Autopilot, the host can answer native questions automatically, and Tenet cannot tell your answers from automatic ones. Questions about scope, protected paths, remote or destructive actions, risk and owner acceptance are therefore asked in plain chat, and every decision record made under Autopilot is unverifiable. Do not use Autopilot for work where that matters.
- **If policy blocks installation or a required feature.** An organization or plan policy can disable agent mode, agent plugins, custom agents or subagents. Tenet cannot see the policy and does not try to get around it. The recovery path is the host's own: read the message VS Code or Copilot shows, ask whoever manages your Copilot organization settings to allow the missing feature, or use an account where it is allowed. Until then Tenet does not work, and Copilot without the plugin is unchanged. Setting names and messages are unobserved: no blocked install has been recorded.

Full details: [docs/user/install-and-remove.md](docs/user/install-and-remove.md).

## Status

The [November 4 implementation audit](docs/audits/2026-11-04/implementation-audit.md) is a historical assessment of earlier source; its findings need reconciliation against subsequent repairs. The active progress record for personal target A is `specs/re-plan.md`. The deterministic evidence below is for implementation commit `b7869a09613984b127504503d81b14e08f2e5a90`:

| Area | State |
|---|---|
| Kernel, plugin, starter recipe, deterministic tests | Exact-source [`untrusted` 44885756509](https://github.com/vedprakash-m/tenet/actions/runs/44885756509) and [`system-budgets` 44885756487](https://github.com/vedprakash-m/tenet/actions/runs/44885756487) pass on `b7869a0`, including hosted source, Ubuntu/macOS bundle/UAT and Windows lanes. Green deterministic CI does not qualify an installed host; this checkout is not a release artifact. |
| Production capacity approval | Still open. The central pipeline/verbs/decisions group uses 248,083 characters against the prior approved 247,219 ceiling. The enforced 248,256 ceiling is explicitly proposed, not owner-approved; green lint is not approval of that change. |
| Qualified tuple (host, extension, model, OS) | **Unrecorded.** No tuple is qualified. |
| Installing and running on VS Code Copilot | **Partly observed** on VS Code 1.142.0 and 1.143.0 (October 19 and 20, 2026): the plugin loaded from a local plugin location; the kernel ran from the host's snapshot copy of the plugin; real multi-step tasks ran through `finish`. The Copilot extension version was not recorded. |
| Reviewer subagent | **Partly observed.** A reviewer was dispatched several times on VS Code, and a partial result was refused and retried. Not observed: the reviewer's real tool list or host enforcement of its restrictions, actual context isolation, parallel dispatch, a cancelled or dead reviewer, and `usages`. |
| Approval behavior | **Unobserved** beyond one terminal approval ("Allow in this Session") per session. The approval mode is recorded as `unknown`. |
| A 15-minute command through the host's terminal tool | **Unobserved.** The one attempt measured a test-runner timeout, not the host. |
| Enable, disable, uninstall and update of the plugin | **Unobserved.** |
| Which instruction file the host loads, `.tenet/` exclusion from host indexing, token-estimate accuracy | **Unobserved or inconclusive.** |
| Hooks | None ship. The kernel finds edits made outside its own calls by comparison. |
| Copilot CLI | Early hypotheses only. Not part of this release line. |
| Publisher, signed release, checksums, provenance | **Partly published.** The v0.1.0 pre-release has a plugin tarball and SHA-256 file, hand-published. There is no signed tag, provenance attestation or designated publisher. |

Capabilities described in this repository are intended outcomes until their gates pass.

The current objective is a controlled developer preview for technical builders, installed from the v0.1.0 tarball or from source. Installed-host evaluation is intended to cover a small brownfield change, a starter journey, read-only review and interruption/resume with unrelated staged and dirty edits. These journeys are not yet qualified. Use disposable synthetic projects without sensitive data or production credentials; this is not a preservation guarantee for valuable work. The separate schema-2 protocol candidate is not included. Native Windows mutation support is not approved.

The [schema-1 bridge candidate](docs/schema-1-bridge.md) adds rollback-terminal and writer-fence safeguards. It is not a published or qualified bridge; schema-2 activation remains blocked until the required bridge is available and its actual artifact is pinned.

## Support matrix and assistance levels

No combination is currently qualified. These observations are not support claims:

Every combination without a dated native suite run for the current model is labeled **not yet evaluated with the current model**. Historical observations below do not evaluate today's model. Rerun the native suite monthly and whenever a model change is observed; `.github/workflows/model-drift.yml` opens a monthly reminder without running a model or changing support claims. If the model is unobservable, claims stop at the last evaluation date.

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

## Install from source

Use this route if you want to build the plugin yourself, or to try a newer commit than the release:

```bash
git clone https://github.com/vedprakash-m/tenet.git
cd tenet
npm ci
npm run build
```

Then add the repository's `plugin/` folder to `chat.pluginLocations`, as in the quick start. VS Code keeps its own snapshot copy of the plugin and may not pick up edits until it refreshes it. See [docs/user/install-and-remove.md](docs/user/install-and-remove.md).

## Update

There is no automatic update path, and plugin update and stored-record migration have not been qualified. To move to a newer release, download and unpack it into a new folder, point `chat.pluginLocations` at that folder and reload. Do not assume an active contract or older `.tenet/` state can migrate safely; finish or abandon work in progress first. See [Install and remove](docs/user/install-and-remove.md).

## Remove

In each project where you used Tenet, ask "help uninstall" before removing the plugin from `chat.pluginLocations`. The residue listing is incomplete; review it and the cleanup preview before confirming removal. Tenet removes a run entry only while it still matches the preview; it never removes `.tenet/`. Optionally remove `.tenet/` yourself after uninstalling; this deletes Tenet's project records. Installed-host uninstall and cleanup behavior remain unobserved. See [docs/user/install-and-remove.md](docs/user/install-and-remove.md).

## Offline evaluation tools

Maintainers can validate static protocol files, replay hand-authored synthetic observations, or render a local campaign report:

```bash
npm run eval:validate -- --protocol <path>
npm run eval:replay -- --capture <path>
npm run eval:report -- --input <path> --format json|markdown|junit
```

`eval:report` reads a `CampaignReportInputV1` JSON file and writes `CampaignReportV2` in the selected format to stdout. Unique-defect recall and repeated critical detection are separate: each declared critical defect needs detections in at least four of the first five primary repetitions; retries do not count. Exit codes are 0 for report eligibility `pass`, 3 for `fail` or `inconclusive`, 2 for invalid input, and 1 for usage errors. Eligibility is computed from untrusted local declarations; it does not authorize a run, qualify a requirement, or establish support. Validation and replay are local-only and do not execute graders, capture host sessions, or contact a model.

## Documentation

- [What Tenet adds](docs/user/what-tenet-adds.md)
- [Three starter requests](docs/user/starter-requests.md)
- [Install and remove](docs/user/install-and-remove.md)
- [The Autopilot limit](docs/user/autopilot.md)
- [The qualified tuple, as it stands](docs/user/qualified-tuple.md)
- Found a problem or tried it on your setup? [Open a host observation report](https://github.com/vedprakash-m/tenet/issues/new?template=host-report.yml).
- For maintainers: [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [NOTICE](NOTICE), and the three canonical specifications ([PRD](specs/PRD.md), [tech spec](specs/tech-spec.md), [UX spec](specs/ux-spec.md)).

## License

Tenet and its own starter-template code are licensed under the [MIT License](LICENSE). Retain the required copyright and permission notice when copying or distributing substantial portions. Your application code remains yours; using Tenet does not require source disclosure or give Tenet ownership of it. Third-party components retain their own licenses and notices, listed in [NOTICE](NOTICE). License selection is not a claim of release readiness or approval to publish.
