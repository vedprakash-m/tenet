# CP-0010 · Answers to the round 5 install fixture questions

Answers to `tenet/packets/CP-0010-tenet-init/escalations/proposals-r5.md` (on branch `r5/review-and-install-cases`), decided on 2026-11-23 to unblock `CP-0010`.

1. **Q1 · Command result shapes and preflight view (`contracts.md:128`, `ux-spec.md:36–48`, `alpha.0b.md:106–117`).**
   - **`init` result:** `{plan: {created: [path], blocks: [{path, kind: "markdown"|"yaml"}], keys: [{path, pointer}], local_keys: [{host, path, pointer}], hosts: [{id, capability: "skills+mcp"|"mcp"|"instructions"}], ci_mode: "existing-ci"|"tenet-workflow"|"none", ci_reason: string}, wrote: {created: [path], blocks: [{path, kind}], keys: [{path, pointer}], local_keys: [{host, path, pointer}]}, findings: [{kind, path, message}], cancelled?: boolean}`. Every array of paths/items is sorted by UTF-16 `path` and then `pointer`. Under `--json`, preflight prompts and progress lines write to `stderr` while `stdout` emits only the single JSON envelope (`contracts.md:128`).
   - **`upgrade` result:** `{from: string, to: string, changed: [{path, action: "created"|"replaced"|"kept"}]}` sorted by UTF-16 `path`.
   - **`remove` result:** `{removed: [{path, kind: "file"|"block"|"key"}], kept: [{path, reason: "edited-by-you"|"spec-or-records"}], reminder: string | null}` sorted by UTF-16 `path`, then `kind`.
   - **`doctor` result:** `{checks: [{name: "node"|"git"|"ssh"|"gh"|"lock"|"workflows", ok: boolean, detail: string}]}` in that fixed six-check order.
   - **Spec edits:** `tenet/specs/tech-spec/contracts.md` §8 (`line 128`) and `tenet/specs/plan/alpha.0b.md` (`CP-0010` *Exports* / *Behavior*, `lines 106–117`).

2. **Q2 · First-tree bytes, action pins, owner IDs, and LF termination (`onboarding.md:75–96`, `ci.md:87–133`).**
   - Generated files (`tenet.yaml`, `tenet.lock`, `.tenet/manifest.json`, workflows, skills, and starter files) are UTF-8 with LF line endings and one trailing `\n` (`contracts.md:5`).
   - Workflow templates come verbatim from `kit/workflows/{tenet-tests.yml,tenet.yml,existing-ci-step.yml}` with `<locked>` replaced by the locked package version and `<default branch>` / `<test workflow name>` filled from the repository.
   - `owners[]` in `tenet.yaml` derives `id` by stripping any leading `@` and lowercasing non-alphanumeric runs to `-` (e.g. `@payments-team` → `id: "payments-team", name: "@payments-team", roles: ["owner"]`; git user `"Ved"` → `id: "ved", name: "Ved", roles: ["owner"]`), deduplicated by `id` in discovery order (`git config user.name` first, then CODEOWNERS handles; with `--yes`, git user only per `onboarding.md:95`).
   - `kit_sha256` is SHA-256 over sorted `<relative-path-under-kit>\0<sha256-hex-of-file>` joined by `\n` (`onboarding.md:95`).
   - **Spec edits:** `tenet/specs/tech-spec/onboarding.md` §2 (`lines 75–96`).

3. **Q3 · Runner discovery, check key `<name>`, and `setup` extraction (`contracts.md:90–100`, `ci.md:50–69`).**
   - The synthesized check key in `tenet.yaml` is `"test"` (so default report paths are `.tenet/reports/test.xml` or `.tenet/reports/test.json`, matching `contracts.md:92–100`).
   - When multiple runners or CI jobs exist, pick the first matching runner in `contracts.md §6` table order (`vitest`, `jest`, `node:test`, `pytest`, `go`, `ctrf`, `other`).
   - `checks.test.setup` records only shell `run:` commands preceding the test step in the detected CI job (or the lockfile table in `ci.md:55–63` when no CI job exists); `uses:` toolchain steps stay in the workflow file.
   - **Spec edits:** `tenet/specs/tech-spec/ci.md` §2 (`lines 50–69`) and `tenet/specs/plan/alpha.0b.md` (`CP-0010` *Behavior*, `line 110`).

4. **Q4 · Empty repository `init` (`onboarding.md:53–58`, `ux-spec.md:119`, `alpha.0b.md:116`).**
   - In an empty repository (unborn `HEAD` or zero tracked files), `init` asks two prompts: (1) project purpose (`"What is this project for?"`) and (2) project kind (`"Project kind (service/library/data/infrastructure/ml/other) [other]:"`). With `--yes`, prompts are skipped, `kind` defaults to `"other"`, and purpose is left as `"Undecided · edit or run tenet onboard"` in `tenet/intent.md` (seeded from `kit/templates/intent.md`, all sections in `state: "draft"`). First findings for an unborn repository omit `TN-ENV-NO-COMMIT` (which is an `onboard` preflight error) and report `findings: [{kind: "no-test-report", path: "tenet.yaml", message: "No machine-readable test report configured"}]`.
   - **Spec edits:** `tenet/specs/tech-spec/onboarding.md` §2 (`line 95`) and `tenet/specs/plan/alpha.0b.md` (`CP-0010` *Behavior*, `line 116`).

5. **Q5 · Byte-preserving managed edits and restoration (`onboarding.md:83–97`, `algorithms.md:182–194`).**
   - For markdown and YAML files where Tenet inserts or replaces a marked block (`<!-- tenet:begin v<version> -->` … `<!-- tenet:end -->` or `# tenet:begin` … `# tenet:end`), all bytes outside the block (including CRLF line endings in the surrounding file) are preserved verbatim. To allow `remove` to restore a pre-existing file byte-for-byte (including when `init` replaced an older Tenet block or appended to a file without a trailing newline), `manifest.json` `blocks[]` entries may record optional `previous_block: string | null` and `prefix_sep: string` (`""`, `"\n"`, or `"\r\n"`), and `keys[]` entries may record `previous_raw?: string` (the exact pre-install file bytes when Tenet was the only edit). On `remove`, if no unowned key or outside byte changed since install, `previous_raw` / `previous_block` restores the exact pre-install bytes; if the user edited the owned key (`sha256` / JSON value differs from `installed`), that key is kept untouched (`kept: [{path, reason: "edited-by-you"}]`).
   - **Spec edits:** `tenet/specs/tech-spec/onboarding.md` §2 (`lines 83, 97`) and `tenet/specs/tech-spec/algorithms.md` (`ALG-12`, `lines 183–193`).

6. **Q6 · `upgrade` and `remove` files, rows, and branch-rule reminder (`onboarding.md:97–99`, `algorithms.md:188–193`).**
   - `upgrade` reads the installed package's `kit/` and `package.json` version, updates `tenet.lock`, regenerates the `AGENTS.md` block, Tenet workflows, skills, and owned MCP version pins (`@vedprakash-m/tenet@<to>`), preserves `tenet.yaml` (`level`, `rules`, `checks`, `owners`) and any user-modified unowned content, classifies each managed path in `changed: [{path, action: "created"|"replaced"|"kept"}]`, and runs `check`.
   - `remove` reverses `manifest.json` (`ALG-12`), deletes `.tenet/manifest.json` and `.tenet/manifest.pending.json` (and removes `.tenet/` and empty managed skill/workflow directories if empty), never touches `tenet/` specifications or records, and sets `reminder: "If you made the Tenet check required in branch protection or rulesets, remove that rule in your forge settings."` (printed as a final line in human output).
   - **Spec edits:** `tenet/specs/tech-spec/onboarding.md` §2 (`lines 97–99`) and `tenet/specs/plan/alpha.0b.md` (`CP-0010` *Behavior*, `line 117`).

7. **Q7 · Interrupted plan replay and drift refusal (`algorithms.md:182–187`, `onboarding.md:83`).**
   - `.tenet/manifest.pending.json` records `{schema_version: 1, version, writes: [{id, kind: "file"|"block"|"key"|"local_key", path, pointer?, before_sha256: string|null, after_sha256: string, content?: string}], manifest: Manifest}`.
   - Before each write (and on resume when `.tenet/manifest.pending.json` already exists), check the target file's current SHA-256:
     - If `current_sha256 === after_sha256`, the write is already applied: skip it idempotently and continue.
     - If `current_sha256 === before_sha256`, apply the write.
     - If `current_sha256 !== before_sha256 && current_sha256 !== after_sha256`, stop immediately before writing, keep `.tenet/manifest.pending.json` on disk, and fail with `TN-INIT-EXISTS` (`exit 4`, `file: <path>`, message from `messages.md §2`) so the plan remains inspectable.
   - **Spec edits:** `tenet/specs/tech-spec/algorithms.md` (`ALG-12`, `lines 182–187`).

8. **Q8 · Windows local host settings (`onboarding.md:85–93`, `alpha.0b.md:114`).**
   - Committed repository MCP files (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`) always store the portable command `{"command": "npx", "args": ["-y", "@vedprakash-m/tenet@<locked>", "mcp"]}` on every platform.
   - When running on Windows (or when a test injects a Windows local profile root `localProfileRoot`) and a detected host requires `cmd /c` in local settings, `init` writes `{"command": "cmd", "args": ["/c", "npx", "-y", "@vedprakash-m/tenet@<locked>", "mcp"]}` under the host's local profile settings file inside `localProfileRoot` (confined to `localProfileRoot`) and tracks those entries in `local_keys` (never as outside-repo paths in `manifest.json`'s repo-confined `created`/`blocks`/`keys`), and `upgrade` updates their pinned version alongside repo keys.
   - **Spec edits:** `tenet/specs/tech-spec/onboarding.md` §2 (`line 93`) and `tenet/specs/plan/alpha.0b.md` (`CP-0010` *Behavior*, `line 114`).

9. **Q9 · CI reporter consent, synthesized step ID, and reusable workflow fallback (`ci.md:65–83`, `alpha.0b.md:108, 121`).**
   - When an existing CI job runs the detected test command and already writes a supported report, `init` uses the existing-CI step (`ci_mode: "existing-ci"`), keeping the step's existing `id` (or assigning `id: tenet-tests`, or `tenet-tests-2`, `tenet-tests-3` on collision) and preserving all other job fields (`services`, `strategy.matrix`, etc.).
   - When the existing CI job runs the test command without a report:
     - In interactive mode, `init` asks whether to add the reporter flags to that step; if accepted, it edits that step (and assigns `id: tenet-tests` if missing) and appends the `# tenet:begin` bundle upload block (`ci.md:71–83`).
     - If declined, or under `--yes` when no explicit reporter-edit answer is provided, or when the job calls a reusable workflow (`uses: ./.github/workflows/...` or `org/repo/.github/workflows/...`), `init` leaves the existing workflow untouched and writes `.github/workflows/tenet-tests.yml` (`ci_mode: "tenet-workflow"`, `ci_reason: "reusable workflow cannot be edited in place"` or `"existing CI job does not write a test report"`).
   - **Spec edits:** `tenet/specs/tech-spec/ci.md` §2 (`lines 65–70`) and `tenet/specs/plan/alpha.0b.md` (`CP-0010` *Behavior*, `lines 108, 112, 121`).

10. **Q10 · Non-GitHub forge install plan (`alpha.0b.md:108, 121`).**
    - When the git remote is not GitHub (e.g. GitLab or no GitHub forge binding), `init` writes `tenet.yaml`, `tenet.lock`, `AGENTS.md`, host skills/MCP entries, `.gitignore`, `.gitattributes`, and `.tenet/manifest.json`, omits `.github/workflows/tenet.yml`, `.github/workflows/tenet-tests.yml`, and `.github/pull_request_template.md`, sets `plan.ci_mode: "none"` and `plan.ci_reason: "non-GitHub remote: local checks and specifications are enabled; CI proof cards require GitHub in alpha.0"`, and exits `0`.
    - **Spec edits:** `tenet/specs/tech-spec/onboarding.md` §2 (`line 79`) and `tenet/specs/plan/alpha.0b.md` (`CP-0010` *Behavior* / *Edge cases*, `lines 108, 121`).

11. **Q11 · `doctor` checks and fresh vendored clone (`contracts.md:128`, `alpha.0b.md:117, 120`).**
    - `doctor()` returns `{checks: [{name, ok, detail}]}` with six checks in order:
      1. `"node"` — `ok: true` when Node `>= 22.0.0`, `detail: "Node.js <version>"`
      2. `"git"` — `ok: true` when Git `>= 2.40.0` inside a git repo, `detail: "Git <version>"`
      3. `"ssh"` — `ok: true` when OpenSSH `>= 8.9` is found (optional below `assure`: if absent, `ok: true`, `detail: "OpenSSH not found (optional until assure)"`)
      4. `"gh"` — `ok: true` when `gh` CLI is available (optional: if absent, `ok: true`, `detail: "gh CLI not found (optional)"`)
      5. `"lock"` — verifies `tenet.lock` and kit integrity (`verifyLock()`); in a fresh clone with `--vendor` (`.tenet/kit/` and `tenet.lock` committed), `ok: true`, `detail: "vendored kit matches tenet.lock"`; when `tenet.lock` is missing, `ok: false`, `detail: "Lock file tenet.lock was not found."`
      6. `"workflows"` — `ok: true` when the configured workflow files exist (or `ci_mode === "none"`), else `ok: false`, `detail: "missing workflow <path>"`
    - When any required check (`node`, `git`, `lock`, `workflows`) has `ok: false`, `doctor` includes the corresponding finding (`TN-ENV-NODE`, `TN-ENV-GIT`, `TN-ENV-NOT-GIT`, `TN-LOCK-MISSING`, `TN-LOCK-INVALID`, `TN-KIT-EDITED`, `TN-KIT-MISSING`) in `findings` and exits with `exitCodeFor(findings)` (`3` for `TN-ENV-*`, `1` for lock/kit/workflow structural errors).
    - **Spec edits:** `tenet/specs/tech-spec/contracts.md` §8 (`line 128`) and `tenet/specs/plan/alpha.0b.md` (`CP-0010` *Behavior*, `line 117`).

12. **Q12 · Codes and exit codes for missing Git executable and missing lock (`contracts.md:167–169`, `messages.md:30–56`).**
    - **Missing Git executable:** emits `TN-ENV-GIT` with `found: "not installed"` (`"Git not installed is below required version 2.40."`, fix `"Install Git 2.40 or newer and retry."`), exiting `3` (matching `src/cli.ts:118–120`).
    - **Not a Git repository:** emits `TN-ENV-NOT-GIT` (exit `3`, `messages.md:33`).
    - **Missing or invalid lock / kit:** registered in `contracts.md §13` (structural, exit `1`) and `messages.md §2`:
      - `TN-LOCK-MISSING`: `"Lock file tenet.lock was not found."` / `"Run \`tenet init\` to create and pin tenet.lock."`
      - `TN-LOCK-INVALID`: `"Lock file tenet.lock is invalid: {detail}."` / `"Fix tenet.lock or run \`tenet init\` to regenerate it."`
      - `TN-KIT-MISSING`: `"Kit directory {path} was not found."` / `"Reinstall @vedprakash-m/tenet or fix kit_path in tenet.yaml."`
      - `TN-KIT-INVALID`: `"Kit at {path} is invalid: {detail}."` / `"Restore {path} to regular kit files or run \`tenet upgrade\`."`
    - **Spec edits:** `tenet/specs/tech-spec/contracts.md` §13 (`lines 167–169`) and `tenet/specs/tech-spec/messages.md` §2 (`lines 30–56`).

13. **Q13 · State after refusals or preflight cancellation (`algorithms.md:181–187`, `ux-spec.md:44`).**
    - **Static pre-checks before writing:** path-confinement (`TN-PATH-ESCAPE`, exit `1`) and existing unmanaged file collisions (`TN-INIT-EXISTS`, exit `4` when `--force` is absent) run during planning before `.tenet/manifest.pending.json` or any target file is written, leaving the repository tree completely unchanged.
    - **Mid-flight hash drift (`n06`):** if a target file's hash changes after `.tenet/manifest.pending.json` was written and before its step executes, `init` stops before that write, keeps `.tenet/manifest.pending.json` and any already-completed earlier writes on disk, and fails with `TN-INIT-EXISTS` (exit `4`, `file: <drifted path>`).
    - **Declined preflight (`Continue? [Y/n]` answered `n`):** `init` writes nothing, leaves the working tree unchanged, and returns `{plan, wrote: {created: [], blocks: [], keys: [], local_keys: []}, findings: [], cancelled: true}` with exit code `0`.
    - **Spec edits:** `tenet/specs/tech-spec/algorithms.md` (`ALG-12`, `lines 182–187`) and `tenet/specs/plan/alpha.0b.md` (`CP-0010` *Behavior*, `lines 108–115`).
