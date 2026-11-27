---
tenet: {spec: 1, doc: tech-spec, level: L2, version: "0.12", owner: ved}
sections:
  _preamble: {state: draft, digest: sha256:05c4e6215f121ab9e5de57dafa61a056e15488ec4adcc5cb8856c592b5d900b0, flags: []}
  1-one-shape-for-every-release: {state: draft, digest: sha256:9256c01e2eecf400a4d5729b6dfbedf067900bc73637fb7167de9fe2df7f7805, flags: []}
  2-running-checks: {state: draft, digest: sha256:537a6bba07b30f7f92d90f232af47893e75b21da69a08194c5aa7ec1e5aed823, flags: []}
  3-workflows: {state: draft, digest: sha256:9297be6610d32c27624915705b0d77e67afe6fd3fc61217364db2b0366130a02, flags: []}
  4-records-ref: {state: draft, digest: sha256:949207be5f84a65a873e824a9c46232a10f54e83137016859ddf5e609c147936, flags: []}
  5-verify-sealed-tests-and-signed-records-alpha2-on: {state: draft, digest: sha256:4f48c4c597126e518e134350975fe041ac89b57cb7d4fd1f0fbdacc31d6087eb, flags: []}
  6-decisions-and-proof: {state: draft, digest: sha256:affe8479bde2bee84b3f57c674cf7cff5582ce18c7ee00cb47928f10cac41b15, flags: []}
  7-trust-observations-and-guarantee-levels: {state: draft, digest: sha256:dad2d348957a0f175c6e287e5be894e6b56479afb894137d11fc818497a6b72b, flags: []}
  8-safe-failure: {state: draft, digest: sha256:50a4f85f0d42fd038c8d80d04d1ff61a030d67e14738c6a30d42bcf188c739a5, flags: []}
  9-release-procedure: {state: draft, digest: sha256:a2edca4ab67d63bb3f5adf8d2fc47bfa7a18d7b49e285de268dceb643031eedb, flags: []}
  10-outcomes: {state: draft, digest: sha256:79146887c3e1d1c002ebb9b3aab45ff98d95e064abe727a4cefae51e5b13dde0, flags: []}
---
# Tenet technical specification: CI, verification and authority

> Level L2 · Version 0.12 · Part of [tech-spec.md](../tech-spec.md) · Status: **draft, awaiting the Owner's approval** · Budget: 6,000 tokens · Split from `tech-spec.md` §7.2–§7.6 and `contracts.md` §7 under the rollover rule (L-0024) · Previous version: `archive/specs/tech-spec/ci.md@0.11.md`

**Context card.** Every release uses one CI shape (DEC-48). GitHub is the reference binding; the kernel names only the properties (signed provenance, merge requires status, attributable decisions). Spike CP-0040 confirms this shape and delivers its event table; if `workflow_run` fails it, the fallback is one job that posts the card and writes records only on `push`.

**Words used here.**
- **Test job:** runs the change's code; holds no write token.
- **Recorder:** never runs the change; posts the card and keeps the records.
- **Attest job:** the recorder at `verify`, which signs.
- **Sealed test job:** the test job at `verify` (no secrets, network denied).
- **Bundle:** what the test job hands the recorder.
- **Evaluation:** one set of inputs (contracts §1).
- **Run:** one attempt at an evaluation.

## 1. One shape for every release

| Job | Runs | Holds | Does |
|---|---|---|---|
| **Test job** | the change's code | `contents: read`; at `verify`, no secrets and network denied by default | `tenet verify --run-checks` runs setup and the checks the target's `tenet.yaml` names, or `tenet verify --bundle` collects reports the project's own CI job already wrote; uploads the bundle |
| **Recorder** | from the default branch; reads the change only as data | `contents: write`, `checks: write`, `pull-requests: read`, `actions: read` | `tenet verify --record`: validates the bundle, reads policy from the target, runs `tenet check`, weakening and ALG-14 on the tested commit's files, evaluates the rules, posts the check run `Tenet`, writes the records ref |

| Capability | alpha.0 | alpha.1 | alpha.2 on, at `verify` |
|---|---|---|---|
| Where tests run | Tenet's test workflow, or a step in a project CI job that writes a report | same | Tenet's sealed test workflow only |
| What the recorder keeps | card; records ref: proof, rule outcomes | plus decisions, forge-state events, `board.json` | signed, on the evidence store |
| Decisions read | — | reviews and `/tenet` replies (`forge`) | signed (`signed`) |

**Observed in Spike B (L-0030):**
- `workflow_run` includes `pull_requests` for same-repo PRs; the recorder updates the head check run and writes records via plumbing.
- `pull_request_target: edited` re-evaluates from latest test bundles.
- `upload-artifact` accepts a dotfolder as `path` directly, skipping hidden files inside folders; `tenet-bundle/` avoids both.
- On GitHub Free, private repos cannot require checks (branch protection and rulesets refuse), making `merge requires status` `unavailable`.
- An account cannot approve its own pull request.

**Honest limits below `verify`:**
- PRs can alter test workflows, so blocking there is **detected** (cards flag workflow drift).
- The recorder token has full repo write access, so its records are labelled detected (DEC-49). At `verify`, the attest signature sets the boundary (§5).

## 2. Running checks

1. Read `tenet.yaml` from the target (`git show <base>:tenet.yaml`). **First policy:** at `observe` and `protect`, a check the pull request adds runs labelled "proposed check · approve tenet.yaml to pin"; **Proposal · CP-0066 AB-C3.** if the head changes an existing check's command, CI still runs the base command and the card notes that the change takes effect after merge (whether the base check passes or fails; when it passes, the note is informational and neither degrades the card nor changes its conclusion); at `verify` an unpinned check never runs.
2. Create `.tenet/reports/`.
3. Run each check's `setup` commands, then `run`, from the repository root. CI runners use `bash -eo pipefail -c` (locally: `bash` where present, else the platform shell), within `timeout_minutes` (default 30). Locally, `tenet verify --local` runs configured checks on the working tree against the default branch's merge base (from the base's `tenet.yaml` when present, else the working tree's) with no CI event file and no network, and prints a local preview proof card.
4. `report_from: stdout` captures standard output as UTF-8 into `.tenet/reports/<name>.<ext>`; `file` (default) reads `report_path` (default `.tenet/reports/<name>.xml` or `.json`).
5. Read the report whatever the exit code (ALG-08 says how the exit code and the cases combine). With no report it is `TN-REPORT-MISSING` and the check fails.
6. Write `tenet-bundle/` (not a dot-folder): `bundle.json` `{schema_version, run: {id, attempt, workflow, job, index}, pr?, tested: {commit, kind, head, base}, checks: [{name, exit_code, outcome, duration_ms, report, report_sha256, inputs, config_digest?, complete?, missing_metadata?}]}` plus the reports (`tool` comes from `<base>` `tenet.yaml`; raw `lcov`/`cobertura` name `missing_metadata`). `exit_code` and `duration_ms` may be null.

**What `init` writes.**
- **The test command:** synthesized under `checks.test` ( picking the first matching runner in contracts §6 table order) with the reporter flags of contracts §6, never `npm test -- …`.
- **Setup:** the shell `run:` steps before the test step in the project's CI workflow, else this table (`uses:` toolchain steps stay in the workflow).
- **Toolchain:** the project's version files (`.nvmrc`, `.python-version`, `go.mod`), else the runner default.

| Found | `setup` |
|---|---|
| `package-lock.json` | `npm ci` |
| `pnpm-lock.yaml` | `corepack enable && pnpm install --frozen-lockfile` |
| `yarn.lock` | `corepack enable && yarn install --immutable` |
| `uv.lock` | `pip install uv && uv sync` |
| `pyproject.toml`, else `requirements.txt` | `pip install -e ".[test]"`, else `pip install -r requirements.txt` |
| `go.mod` | `go mod download` |
| `pom.xml`, `build.gradle` | none |

**Where the tests run** (`ci.mode`). `init` chooses the **existing-CI step** only when both hold:
- a CI job runs the detected test command
- that job already writes a supported report (its path becomes `report_path`), **or** the user accepts a marked edit that adds the reporter setting to that step (`PYTEST_ADDOPTS` or `NODE_OPTIONS` in an `env:` block where the runner reads them, else the flags appended to its `run:` line)

`init` also gives that step an `id` (`tenet-tests`, or `tenet-tests-2`, … on collision) if it lacks one, preserving existing step IDs, `services`, and `strategy.matrix`. If the job calls a reusable workflow, or the user declines the reporter edit (under `--yes` without explicit reporter-edit consent, `init` does not edit a non-reporting job), or neither condition holds, it writes Tenet's test workflow instead (`ci_mode: "tenet-workflow"`). The preflight says which and why.

```yaml
# tenet:begin v<version>
- if: always()
  uses: actions/setup-node@<pinned sha>    # node-version: 22
  with: {node-version: "22"}
- if: always()
  run: npx -y @vedprakash-m/tenet@<locked> verify --bundle
  env: {TENET_TEST_OUTCOME: "${{ steps.<id>.outcome }}"}
- if: always()
  uses: actions/upload-artifact@<pinned sha>
  with: {name: "tenet-bundle-${{ github.job }}-${{ strategy.job-index }}", path: tenet-bundle/, if-no-files-found: error, retention-days: 7}
# tenet:end
```

## 3. Workflows

Actions are pinned by commit SHA (the tag in a comment). Event fields never appear inside `run:`; commands read them from the event file.

`.github/workflows/tenet-tests.yml` (when Tenet runs the tests):

```yaml
name: Tenet tests
on:
  pull_request: {types: [opened, synchronize, reopened, ready_for_review]}
  push: {branches: [<default branch>]}
permissions: {contents: read}
concurrency: {group: "tenet-tests-${{ github.ref }}", cancel-in-progress: true}
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<pinned sha>
        with: {fetch-depth: 1}
      - uses: actions/setup-node@<pinned sha>
        with: {node-version: "22"}
      - <toolchain step>
      - run: npx -y @vedprakash-m/tenet@<locked> verify --run-checks
      - if: always()
        uses: actions/upload-artifact@<pinned sha>
        with: {name: "tenet-bundle-${{ github.job }}-0", path: tenet-bundle/, if-no-files-found: error, retention-days: 7}
```

`.github/workflows/tenet.yml` (the recorder, always written):

```yaml
name: Tenet recorder
on:
  workflow_run: {workflows: [<test workflow name>], types: [completed]}
  pull_request_target: {types: [edited]}
permissions: {contents: write, checks: write, pull-requests: read, actions: read}
concurrency: {group: "tenet-record-${{ github.event.workflow_run.head_sha || github.event.pull_request.head.sha }}", cancel-in-progress: false}
jobs:
  record:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<pinned sha>
        with: {fetch-depth: 1}
      - uses: actions/setup-node@<pinned sha>
        with: {node-version: "22"}
      - run: npx -y @vedprakash-m/tenet@<locked> verify --record
```

Both read `tenet.lock` from target (`base.sha`, else `event.before` or default-branch `HEAD`), install with `npm install --no-save --ignore-scripts` (for `x-integrity-source: "local"`, via registry, workspace `node_modules`, or repo/release `.tgz`), verify tarball `sha512` (registry) or installed-file `sha512` (local), and mark local locks advisory (`verify`/`assure` refuse).

**Forge events (alpha.1; proposal · CP-0067, L-0043 OD-8).** One table for every forge event Tenet records. Each row runs without checking out or executing pull-request code, and CP-0019 must observe each row working in the sandbox repository before release.

| Event | Trigger | Permissions | Repeat-delivery key | When missing or degraded |
|---|---|---|---|---|
| Ready for review, converted to draft, closed | `pull_request_target: {types: [ready_for_review, converted_to_draft, closed]}` in `tenet.yml` | the recorder's | `{repository, pr, action, head_sha, at}` | no state change; the board shows the observation as missing |
| Native review (submitted, edited, dismissed) | `pull_request_review` in a no-secret capture workflow; the recorder reads it through `workflow_run` | capture: `contents: read`; recorder: its own | `{repository, review_id, submitted_at, content_digest}` | an observation only; no decision |
| `/tenet` reply comment (created, edited) | `issue_comment` in the same capture workflow, then `workflow_run` | as above | `{repository, comment_id, updated_at, content_digest}` | an observation only; no decision |

An exact repeat delivery is a no-op. A forge event moves a work item only to a destination the selected pack defines as legal for that event; otherwise it is kept as an observation and changes nothing. Only `work.created` starts a work item: a forge event for an unknown work item is an observation.

**`verify --record` steps.**
1. **Find the change.**
   - `workflow_run`: use `workflow_run.pull_requests`; else paginate open PRs matching `head.sha` (covers fork PRs and shared heads); none means a default-branch push.
   - `edited`: reuse latest bundle for `head.sha` (if absent: "waiting for tests"; if expired: "tests from <date> expired · push or re-run").
2. **Accept bundles.** List triggering run artifacts via API and download each `tenet-bundle-*` (up to 3 retries; failures emit "not checked: N of M bundles unavailable" and never report partials as complete, per Spike B `503 Egress`). Accept only from the policy test workflow for this repo and head SHA, bounded at `50 MB` per bundle, `20,000` cases, depth `64`, no symlinks/absolute paths/`..` (else `TN-RECORD-BUNDLE`, naming unavailable conclusions). Matrix bundles take worst status per case.
3. **Read the change as data.** Load policy/lock from `<base>` (fallback `base^` with §10 degraded note). Fetch `origin refs/pull/<n>/head refs/pull/<n>/merge` (`--no-tags --filter=blob:none`; note `merge-candidate-stale` if merge ref moved). Check out tested commit in a temp worktree without executing it.
4. **Evaluate:** parse acceptance block from `pr.body` (0.1.0 fallback: named packet `definition.md`, agents.md §5), run `tenet check --ci --base <base>`, ALG-08, ALG-09, ALG-14, ALG-07 rules, and compute evaluation ID.
5. **Post check run** `Tenet` on **head** SHA per §10 ($N > 1$ PRs sharing `head`: `Pull request #<number>\n` header, budget $\lfloor(60,000 - \text{overhead})/N\rfloor$, worst conclusion). Shed order at `60,000` chars: same-area requirements, passing test lists, passing requirements; failing items, weakening, protected files, blocking health lines ([health.md](health.md)) and "would have blocked" are never shed (overflow writes full card to `refs/tenet/records` `overflow_ref` keeping conclusion, or `renderCheckSummary` throws `RangeError`).
6. **Append records** (§4).

Alpha.1+ recorder also handles review, `/tenet` reply, ready-for-review, draft conversion and closing (alpha.0 closed-unmerged PRs stop at their last evaluation). **Merge queues** (L-0032): alpha.1 records candidates; alpha.2 verifies the exact candidate (`kernel §5`); 0.1.x adds full evidence and quarantine. CP-0040's event table sets trigger/token per event.

## 4. Records ref

`refs/tenet/records`:
- `proof/<pr or main>/<evaluation_id>/<run_id>-<attempt>.json` (immutable)
- `proof/<pr or main>/latest` (forward-only by run start time)
- `rules/<yyyy-mm>.jsonl` (`{evaluation_id, run, pr, rule, mode, would_block, at}` per run/rule)
- alpha.1+: `works/pr-<n>/events/<id>.json`, `decisions/<id>.json`, `board/board.json`

**Writing:** idempotent by path (identical content no-op, conflict refused); git plumbing (`hash-object`, `mktree`, `commit-tree`, `update-ref`, committer `tenet-recorder`, message `tenet: <kind> <id>`, no working tree touch); retries rejected pushes up to 8 times with 0.5–3 s jitter (final failure shows "results not kept", `failure` at `verify` per §10). **Retention:** alpha.0 keeps all runs; alpha.1+ on each new month `rules/` file prunes `proof/<work>/<evaluation_id>/<run>-<attempt>.json` older than 30 days unless referenced by `latest`, `decisions/`, or `works/`. Not fetched by default (`tenet board --fetch`).

## 5. Verify: sealed tests and signed records (alpha.2 on)

**Sealed test job.**
- no secrets, read-only, network denied by default, an environment-variable allowlist
- no cache shared with the recorder; the runner image recorded
- it computes the subject before and after each check; changed tracked files make a check inconclusive (`TN-SEALED-DIRTY`)
- a check passes only on exit code 0 with a valid report

**Attest job** (the recorder at `verify`).
- It restores no cache and recomputes the subject.
- It accepts a bundle only from the named test workflow run for the same head SHA (`workflow_run` carries a different run ID; the bundle's `run` is checked against the triggering run).
- It evaluates protected paths against the target, replays events, signs evidence and observations, and writes the evidence store.
- It also records forge state, posts the status and decision requests, reads approvals, observes trust, verifies merge-queue candidates, and on main publishes `board.json`.

**Honest limit.** A check that runs the change's code can be subverted by that code. The jobs keep it away from credentials, policy and the store; independent tests, distinguishing evidence, review and external holdout cover the rest.

**Evidence store.** Each record carries a **signature only the attest job can make**, so it verifies wherever it is kept. CP-0040 confirms the defaults:
- **public repositories:** a public signing service with a transparency log (Sigstore; GitHub artifact attestations)
- **private repositories:** an Ed25519 key held as a secret only the protected workflow can read, signed with `node:crypto`, its public half pinned in `tenet.yaml`; public logs reveal the repository name, so private repositories never use them without consent (V-B5)
- **only if both fail:** the forge's OIDC token, verified when recorded

Records live at `refs/tenet/evidence` under `<subject-digest>/<id>.json`, written as in §4; write access alone can't forge one. The fallback is a store only the attest job can write (a protected branch or a separate repository).

## 6. Decisions and proof

| Decision (name → kind) | Required strength |
|---|---|
| `change-policy`, `widen-permission`, `amend-vision`, deep-lane `release` (approve) | `person-present` at `assure`; `forge-verified` otherwise |
| `approve-spec-change`, `approve-definition`, `replace-proving-case`, `retire-obligation` (by the promise's owner), `release`, campaign approval (approve); `accept-findings`, `accept-risk`, `override`, `quarantine-check`, `accept-health-regression` (waive; `person-present` optional at `assure`, `30d` default `expiry`); `resolve-conflict` (resolve); `delegate` | `forge-verified` |

**`forge-verified`** means **attributable to the decision-maker's forge account**:
- either a native approving review whose commit is the current subject
- or a reply (`/tenet approve`, `/tenet pick <n>`, `/tenet bless <section>`, `/tenet not-useful <finding>`) from an account in `owners[].forge_accounts`, which binds the **evaluation** the latest card showed and is refused if that has changed; an `@<evaluation>` suffix is optional, and required at `assure`

**Recording and limits.**
- The recorder records two-factor status as `enforced`, `not-enforced` or `unobservable`.
- A pull-request author can't approve their own pull request on most forges, so from `verify` agents open pull requests as a `bots[]` identity, or the decision-maker uses the comment form.
- Below `verify` the Owner may accept their own work (`proof.self_accepted: true`), shown as `self-accepted` on the board after merge. `/tenet bless <doc>#<slug>` stores an attributed `approve` (`name: "bless-section"`, `recorded: "forge"`); `/tenet not-useful <finding>` writes an immutable `not-useful` observation (`decision: null`; rolling-30d deduped by `(work_id, indicator, fp_key)` with `minimum_sample`, `R-177`). `accept-health-regression` follows `R-203`: `verify`/`assure` self-waive refuses `TN-GATE-SELF-WAIVE`; below `verify` an owner self-waive is labelled `self-waived` (`Decision.expiry`, `0` verified credit).
- A decision by an account on a pull request its own agent session opened is flagged. Unless a host binding attests credential separation (assumption 4), `forge-verified` counts as detected.

`person-present` is an `ssh-keygen -Y` signature by a security key whose presence can be read from the signature (CP-0017). `key` and `channel` answers are advisory. An option that changes scope carries the replacement digest or returns to Define. Revoking a key is a policy change; earlier signatures stay valid.

## 7. Trust observations and guarantee levels

In [evidence.md §4](evidence.md#4-trust-observations-and-guarantee-levels), moved under the rollover rule.

## 8. Safe failure

Nothing silently passes: every degraded result is labelled on the card and the board, and what each one concludes is §10.

## 9. Release procedure

In [onboarding.md §4](onboarding.md#4-release-procedure), moved under the rollover rule.

## 10. Outcomes

**Proposal · CP-0068 AC-B1.** When the base commit has no `tenet.yaml`, the proof card exempts only changed protected paths listed in the tested commit’s version 1 `.tenet/manifest.json` under `created`, `blocks` or `keys`. It reports one informational note for those paths. “First-time setup: protected Tenet files are expected in this pull request.” All other protected changes use the usual rule. Once the base has `tenet.yaml`, the usual rule applies to every protected path.

**Proposal · CP-0068 AC-B2.** `skip-added` considers only conventional test paths and any extra file globs in the target check definitions’ `x-test-files` lists. Process exits in scripts do not count as test skips (ALG-09).

One table decides what every situation concludes. "Advisory" means the item, rule or card says so and nothing blocks.

| Situation | `observe`, `protect` | `verify`, `assure` | CLI `check` exit | Badge or line |
|---|---|---|---|---|
| No acceptance block, or an empty one | advisory; `acceptance-passed` would have blocked | `failure` unless the lane needs no items (`explore`) | 0 | "no acceptance items" |
| Malformed acceptance block | advisory (`degraded`: `"<code>: <message>"`) | `failure` | 1 (structural) | the parse error |
| Report missing, malformed, or with zero cases | advisory; the items become `not-run` (`degraded`: `"not checked: test report <missing\|malformed>"` or `"not checked: 0 test cases discovered"`) | `failure` | 0 | "not checked" |
| Only skipped cases | advisory; the items become `skipped` | `failure` | 0 | the skipped cases |
| Coverage not confirmed | advisory | `failure` for that item | 0 | "coverage not confirmed" |
| Non-zero exit with a passing report | the check fails; items keep their case results (`degraded`: `"check failed after its tests passed"`) | `failure` | 0 | "check failed after its tests passed" |
| CI unavailable, a check timed out, or the bundle was refused | `neutral`, "not checked" (`degraded`: `"not checked: bundle refused (TN-RECORD-BUNDLE)"` or `"not checked: check timed out"`) | `failure` | — | "not checked" |
| Signature or key unavailable | not applicable | `failure` (evidence `unsigned`) | — | "unsigned" |
| Records not kept | `neutral`, "results not kept" (`degraded` includes `"results not kept"`) | `failure` | — | "results not kept" |
| Policy or kit fails to load | `neutral`; the previous policy is used and named (`degraded`: `"policy failed to load at head; using previous policy from base (tenet.yaml)"`) | `failure` | 3 | the reason |
| Review or decision unobservable | recorded as `unknown` | the decision is asked again | — | "decision needed" |
| Optional/inapplicable health input missing/incomplete | advisory (`unknown` / `not-applicable`) | advisory (`unknown` / `not-applicable`); `enforce` failure → `failure` | 0 / 1 | `"unknown"` / `"health regressed"` |
| An enforced rule refuses (alpha.1 on) | `failure` | `failure` | 1 | "blocked" |
| Otherwise | `success`, or `neutral` when something would have blocked | `success` | 0 | the result |

At `verify` and `assure` a required control that can't run is always `failure`, never `neutral`: GitHub treats `neutral` as passing a required check (DEC-53). An override is a waiver recorded as `accepted-without-verification`.
