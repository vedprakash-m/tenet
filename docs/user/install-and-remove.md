<!-- Preview. The release tarball route was checked from the public download through a running kernel; installation inside a clean VS Code profile has not been observed (specs/re-plan.md host track). -->
# Install and remove

## Before you install

- **VS Code 1.142 or newer** with GitHub Copilot Chat in agent mode, and `chat.plugins.enabled` set to `true`. Plugins were observed on 1.142.0 and 1.143.0; newer versions are unobserved.
- **Node.js 22.12 or newer.** Tenet uses the Node already on your machine and installs nothing. Without it, Tenet can give an advisory review only and will say so. Official installer: nodejs.org.
- **Git**, with `user.name` and `user.email` set, and a Git repository for the project. Tenet's `doctor` reports a missing repository or identity.
- **Platform limits:** no host tuple is qualified yet. R1 targets macOS arm64; Linux is experimental. On Windows, read-only inspection and advisory review remain available, but every mutating kernel call is refused with `capability-missing` before local state is opened or changed. Building the bundle on Windows does not enable mutating workflows.
- **A TypeScript or JavaScript project with Vitest** for full checking. Other setups get a lower assistance level, stated in Tenet's first message.
- **Be aware:** the plugin runs a bundled file, `kernel/tenet.mjs`, through the host's terminal tool with your Node. The host will ask you to approve terminal commands. Project checks (tests, linters, servers) run as local processes on your machine. Under Autopilot, see [The Autopilot limit](autopilot.md).

`inspect --view doctor` remains available on unsupported platforms, but reports `ok: false`, exit 2 and the platform readiness block rather than presenting a successful editing setup. Help, status and advisory review remain available.

Capability observations are keyed by host version, shipped plugin version, governing policy and each capability's declared project inputs. `inspect --view status` shows provenance and `reused`; mutating calls save matching observations in the existing local state. Read-only calls never save them. `doctor` resolves fresh declarations without reading or creating `.tenet/`. A binding may pass the exact host version through `TENET_HOST_VERSION`; when it is absent, the version is unknown and observations are not reused. This does not detect capability support from a version number or qualify a host.

The kernel's helper is found by the plugin's own path, not through your `PATH`. It does run the `node` that your `PATH` resolves; that is a documented residual risk.

## Install (from the v0.1.0 release tarball)

The quickest route is the plugin tarball on the [v0.1.0 pre-release](https://github.com/vedprakash-m/tenet/releases/tag/v0.1.0): download it and its `.sha256` file, check the hash, extract it into a folder of its own, then set `"chat.plugins.enabled": true` and add that folder to `chat.pluginLocations` (a map of full folder path to `true`) in your user `settings.json`. The README quick start has the exact commands. The release is hand-published and unsigned, so the hash shows your download matches the build, not who made it. A zero-JSON install is still not available; that requirement is open.

## Install (preview route, from source)

The route below clones and builds.

1. Clone the source repository: `git clone https://github.com/vedprakash-m/tenet.git`.
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

1. In each project where you used Tenet, ask: **"help uninstall"** (or "what does Tenet leave behind"). Tenet lists some residue without removing it.
2. Review the residue and cleanup previews (below).
3. Remove the plugin from `chat.pluginLocations`.
4. Optionally remove `.tenet/` yourself after uninstalling. This deletes Tenet's project records. Tenet cannot delete the store it is running in.

### What remains (the residue listing)

Under the hood this is `tenet inspect --view residue`. The residue listing is incomplete: it does not identify every possible residual file, including decision records and the charter block. Cleanup is bound to a preview and removes only entries Tenet can still identify as unchanged; installed-host behavior and complete ownership reporting remain unqualified. It reports:

| What | Where | Who removes it |
|---|---|---|
| Tenet's records for the project: state, log, blobs | `.tenet/` in the project, with file count and size | You |
| Adopted documents, if any: `INTENT.md`, `tenet.policy.json`, `docs/architecture.md`, `docs/hardening.md`, each shown present or absent | The project | They are your documents and stay. Delete them yourself if you do not want them. |
| Test tags (`@tenet`) in test files; `Tenet-Work` trailers in commits; the code, specs and evidence you committed | The project and its Git history | They stay |
| Run files: review and analyst packets, reports | A `tenet-ws_…` folder in the system temp folder, with file count and size | Tenet, after you review and confirm the bound cleanup; you may remove entries Tenet refuses or keeps |

Tenet installs no service. Do not assume that a residue listing identifies every running process or file.

### Cleanups (`decide cleanup`)

Cleanup removal is available after a bound preview. It removes entries one at a time only while they still match the preview. Review what will be removed before confirming.

| Scope | Previewed run folders | Notes |
|---|---|---|
| This project | This project's run folder | Refused while a check or review/analyst packet still holds run files |
| This machine | Run folders reported as stale for this workspace | The preview also reports folders it would keep |

Cleanup preview is refused while a check or packet is active. Stopping a check and completing a review are separate actions: pausing or abandoning work does not release an outstanding packet. Record its actual result when available; retrying keeps a packet open. Never fabricate a review to enable cleanup. Safe disposal of an unfinished packet has not been implemented.

Say "clean up" and then choose project or machine. Tenet shows its temporary folder for this project in the system temp folder (file count and size) and what stays. Nothing is removed until you answer yes. If anything in that folder changed after the preview, the cleanup is refused and you preview again; anything added during the removal itself is kept and listed. `.tenet/` is never touched.

## Update

Tenet pins the versions a piece of work started under. After an update, Tenet stops, says so in one question, and continues or parks that work on your answer. Migration of older stored records between versions is not built yet.
