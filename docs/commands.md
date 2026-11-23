# Alpha.0 command reference

Source: [command contract §8](../tenet/specs/tech-spec/contracts.md#8-commands), [error contract §13](../tenet/specs/tech-spec/contracts.md#13-error-codes).

**Draft for 0.1.0-alpha.0**

## Repository commands

Source: [contracts §§8 and 10](../tenet/specs/tech-spec/contracts.md#8-commands), [onboarding](../tenet/specs/tech-spec/onboarding.md), [alpha.0 build contracts](../tenet/specs/plan/alpha.0.md), [alpha.0 continuation](../tenet/specs/plan/alpha.0b.md), [ALG-11](../tenet/specs/tech-spec/algorithms.md#alg-11).

The table gives command-specific options specified for alpha.0. The common exits below apply to each command.

| Command | Options or inputs | Writes |
|---|---|---|
| `tenet init` | `--yes`, `--vendor`, `--force` | Files announced in preflight, including setup, the lock and install manifest. |
| `tenet onboard` | `--inventory-only`, `--refresh`, layout override `--layout`, onboarding card `--card` | Inventory and assignment under `.tenet/onboard/`. Your agent writes drafted documents. The card operation records the revision holding the draft. |
| `tenet bless` | Interactive actions: bless, confirm, edit, reject or defer | Section metadata, blessed copies and the blessing log. Without a terminal it exits 2. An open conflict or unresolved inference can cause a policy refusal. |
| `tenet context` | `--paths`, `--ids`, `--query` for titles, `--include-drafts` | None. |
| `tenet check` | `--pack`. The build contract uses `--ci --base` for CI budget comparisons. | None. |
| `tenet fix` | Local mechanical repairs | IDs, metadata, digests and citation repairs in local specification files. |
| `tenet split` | Document and section | Moves the section into a part, leaves a pointer and updates links. |
| `tenet board` | `--all` | None. Prints the specification board or its JSON result. |
| `tenet upgrade` | Upgrade for the installed version | Updates the lock and regenerates the recorded integration, including workflows, skills and the managed instruction block. |
| `tenet remove` | Reads the install manifest | Removes managed additions and reports files or settings it kept. |
| `tenet doctor` | Checks the local setup | None. |
| `tenet mcp` | Starts the local stdio server | The launch itself writes no files. A tool operation that is supported by the host has its own contract. |
| `tenet --version`, `tenet help` | CLI version and help | None. |

## CI commands

Source: [command contract §8](../tenet/specs/tech-spec/contracts.md#8-commands), [CI §§1–4 and 10](../tenet/specs/tech-spec/ci.md#1-one-shape-for-every-release).

| Command | Writes |
|---|---|
| `tenet verify --run-checks` | Runs configured checks and creates the bundle in `tenet-bundle/`. |
| `tenet verify --bundle` | Collects existing CI reports into the bundle. |
| `tenet verify --record` | Posts or updates the forge check and writes to the records ref. |

These are CI operations in alpha.0. The forge check's conclusion follows the CI outcome table. The local advisory `--run-checks --local` option arrives in 0.1.0.

## Global options and exit codes

Source: [command contract §8](../tenet/specs/tech-spec/contracts.md#8-commands), [error contract §13](../tenet/specs/tech-spec/contracts.md#13-error-codes).

Global options are `--json`, `--cwd`, `--quiet`, `--verbose` and `--offline`. With `--json`, standard output contains one object with `ok`, `command`, `version`, `result` and `errors`. Human-readable output goes to standard error.

Exit precedence is the order below when more than one result applies.

| Code | Meaning |
|---|---|
| 2 | Invalid usage, including blessing without a terminal |
| 3 | Environment problem, such as no Git repository or a missing policy |
| 4 | Policy refusal |
| 1 | Failed gate or check. Structural findings fail `check`. |
| 0 | Success or a non-blocking advisory or warning |

A rule finding counts as a failed check only when its rule is enforced. Alpha.0's advisory card and a structural CLI error can therefore report different kinds of result.
