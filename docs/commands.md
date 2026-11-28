# Tenet commands

Run `tenet --help` for the command list and `tenet --version` for the installed version.

## Repository commands

| Command | Options and behavior |
|---|---|
| `tenet init` | Lists setup writes and asks for confirmation. `--yes` accepts defaults, `--local-hosts` explicitly allows supported local host edits, and `--vendor` copies the kit into the repository. `--force` can replace colliding setup files. **Proposal:** repeat `--host <name>` to select `claude`, `cursor`, `copilot` or `vscode` when its marker is absent. With no detected or selected host, portable skills remain under `.agents/skills/`. |
| `tenet onboard` | Reads committed files and writes an inventory and drafting assignment under `.tenet/onboard/`. `--inventory-only` is the local inspection step. `--layout one-file` and `--layout separate` override layout selection. `--refresh` requests an updated assignment. |
| `tenet onboard --card` | Checks that citations resolve, records the draft revision and lists changed files. Pass `--pr <number>` when a pull request is open. |
| `tenet bless` | Reviews and approves sections in a terminal. Use `--doc <path>` or `--section <slug>` to narrow the session. |
| `tenet check` | Reports structural, citation and integrity findings. Pass paths for a focused check or `--pack` to validate a pack. |
| `tenet fix` | Repairs mechanical specification metadata and IDs. Use `--dry-run` for a summary or `--diff` for a unified diff. Both leave files unchanged. |
| `tenet split <document> <section>` | Moves a section to a separate document, leaves a pointer and updates links. |
| `tenet board` | Groups specification sections by file and shows open conflicts, open questions and spec debt. `--all` includes clean blessed sections. |
| `tenet context` | Selects relevant specification context. Use `--paths app.py,src/lib.py`, repeat `--paths` (for example `--paths app.py --paths src/lib.py`), or use separate values after one flag (`--paths app.py src/lib.py`). Use `--ids`, `--query` or `--budget-tokens` to narrow or budget the result. Add `--include-drafts` to select labeled draft text with the same rules. |
| `tenet mcp` | Starts a local MCP server on standard input and output. It exposes context, check and status tools to a compatible host. |
| `tenet upgrade` | Refreshes the lock and managed files for the installed package version. |
| `tenet remove` | Shows what will be removed or kept before asking for confirmation. Pass `--yes` when running without a terminal. It then lists every removed file and kept item. `.tenet/onboard/interview.json` is kept because it contains the Owner's answers. |
| `tenet doctor` | Reports tool availability, lock verification and workflow status. |

## CI commands

The GitHub Actions workflows configure and run these commands for you.

| Command | Behavior |
|---|---|
| `tenet verify --local` | Runs configured checks on the working tree against the default branch's merge base, builds the bundle without network calls, and prints a local preview proof card. |
| `tenet verify --run-checks` | Runs configured checks and creates an evidence bundle. |
| `tenet verify --bundle` | Collects evidence from existing CI reports. |
| `tenet verify --record` | Posts or updates the GitHub check and keeps a proof record. |

The proof card is advisory in this release. Use repository branch protection to decide which checks are required.

## Network access and output

Use `onboard.exclude` in `tenet.yaml` to keep matching folders out of onboarding inventory:

~~~yaml
onboard:
  exclude:
    - "archive/**"
    - ".archive/**"
    - "old/**"
~~~

- npm install and uncached npx invocations reach the registry. A host that launches MCP through npx may need the registry too. The installed `tenet mcp` executable serves context locally.
- `init` and `upgrade` normally look up the package's integrity on npm. If the lookup fails, interactive `init` offers to record local integrity. With `--yes` or with `upgrade`, run the command again with `--offline` to choose local integrity. When the registry becomes reachable, use `tenet upgrade` to refresh the pin for GitHub CI.
- Inventory, blessing, specification checks, the board, context, doctor and removal use local data. Your agent may use its model provider. The GitHub CI commands need their workflow environment and reject `--offline`.

Global options include `--cwd <path>`, `--json`, `--quiet`, `--verbose` and `--offline`. With `--json`, stdout contains one object with `ok`, `command`, `version`, `result` and `errors`. Human notices go to stderr in that mode.

| Exit | Meaning |
|---|---|
| 0 | Success, including advisory findings |
| 1 | A check failed |
| 2 | Invalid usage, including blessing without a terminal |
| 3 | An environment problem, such as a missing repository or an unavailable registry |
| 4 | A policy refusal |

A blessing session exits 0 when it finishes without errors, even when it blesses nothing or you choose to skip sections. Unresolved review errors exit 1. Blessing needs a terminal and exits 2 without one.

See the [command contract](../tenet/specs/tech-spec/contracts.md#8-commands) for exact output shapes and error codes.
