<!-- DRAFT. The public install path is not decided. Only the preview route below has been tried (specs/plan.md section 4.1). -->
# Install and remove

## Before you install

- **VS Code** with GitHub Copilot Chat in agent mode, and the setting that enables agent plugins.
- **Node.js 22.12 or newer.** Tenet uses the Node already on your machine and installs nothing. Without it, Tenet can give an advisory review only and will say so. Official installer: nodejs.org.
- **Git.**
- **A TypeScript or JavaScript project with Vitest** for full checking. Other setups get a lower assistance level, stated in Tenet's first message.
- **Be aware:** the plugin runs a bundled file, `kernel/tenet.mjs`, through the host's terminal tool with your Node. The host will ask you to approve terminal commands. Project checks (tests, linters, servers) run as local processes on your machine. Under Autopilot, see [The Autopilot limit](autopilot.md).

The kernel's helper is found by the plugin's own path, not through your `PATH`. It does run the `node` that your `PATH` resolves; that is a documented residual risk.

## Install (preview route, from source)

There is no public install path yet. A release install with no cloning, building or JSON editing is a requirement that is not met.

1. Clone the repository (PLACEHOLDER-REPOSITORY-URL).
2. In the repository:

```bash
npm ci
npm run build
```

3. In VS Code settings, add the repository's `plugin/` folder to `chat.pluginLocations`. The folder that holds `plugin.json`, the agents under `com.github.copilot/`, the skills and `kernel/tenet.mjs` is `plugin/`, not the repository root.
4. Open a project and send `/tenet help`. It answers from the kernel and starts no work.

Things seen on the preview route:

- VS Code runs the plugin from its own snapshot copy (under `agentPlugins/` in its user data folder). After you rebuild, the snapshot may be older than the source. Deleting the copy made VS Code recreate it on the next chat.
- The first kernel call needed one terminal approval; "Allow in this Session" covered later calls.

Not observed: any step of plugin update; whether work in progress survives one.

## Remove

Uninstall behavior on the host is **unobserved**. The steps below are the intended ones.

1. In each project where you used Tenet, ask: **"help uninstall"** (or "what does Tenet leave behind"). Tenet lists what remains. It does not change anything while it lists.
2. Decide which cleanup you want (below).
3. Remove the plugin from `chat.pluginLocations`.
4. Remove `.tenet/` yourself, if you want it gone: `rm -rf .tenet` from the project root. Tenet cannot delete the store it is running in, and it never removes `.tenet/` or your files.

### What remains (the residue listing)

Under the hood this is `tenet inspect --view residue`. It reports:

| What | Where | Who removes it |
|---|---|---|
| Tenet's records for the project: state, log, blobs | `.tenet/` in the project, with file count and size | You |
| Adopted documents, if any: `INTENT.md`, `tenet.policy.json`, `docs/architecture.md`, `docs/hardening.md`, each shown present or absent | The project | They are your documents and stay. Delete them yourself if you do not want them. |
| Test tags (`@tenet`) in test files; `Tenet-Work` trailers in commits; the code, specs and evidence you committed | The project and its Git history | They stay |
| Run files: review and analyst packets, reports | A `tenet-ws_…` folder in the system temp folder, with file count and size | The cleanup below |

Tenet installs no service. Test processes left running by a failed check are checked and named before any removal rather than promised away.

### Cleanups (`decide cleanup`)

Two scopes. Each shows a preview first, then waits for a yes. It only removes run folders in the temp folder.

| Scope | Removes | Notes |
|---|---|---|
| This project | This project's run folder | Refused while a review or analyst packet is still open; record or retry it first |
| This machine | Every Tenet run folder in the temp folder that has not changed in the last hour | Recent folders are kept and listed |

Say "clean up" and then choose project or machine. Tenet shows what would go and what stays, and states that `.tenet/` and your files are not touched. Nothing is removed until you answer yes.

## Update

Tenet pins the versions a piece of work started under. After an update, Tenet stops, says so in one question, and continues or parks that work on your answer. Migration of older stored records between versions is not built yet.
