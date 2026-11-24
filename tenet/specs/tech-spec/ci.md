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

**Observed in Spike B (L-0030).**
- `workflow_run` carries `pull_requests` for a same-repository pull request; the recorder can create the check run on the head and write the records ref with plumbing.
- `pull_request_target: edited` re-evaluates from the latest test run's bundles.
- `upload-artifact` uploads a hidden folder named directly as `path`, but skips hidden files inside a folder; `tenet-bundle/` avoids both.
- On GitHub Free, a private repository can't require a status (branch protection and rulesets both refuse), so there `merge requires status` is `unavailable`.
- An account can't approve its own pull request.

**Honest limits below `verify`.**
- A pull request can change the workflow that tests it, so blocking there is **detected**. The card says when the test workflow differs from the target's.
- The recorder's token can write the whole repository, not only the records ref, so its records are labelled detected (DEC-49).
- At `verify`, the signature only the attest job can make is the boundary (§5).

## 2. Running checks

1. Read `tenet.yaml` from the target (`git show <base>:tenet.yaml`). **First policy:** at `observe` and `protect`, a check the pull request adds runs labelled "proposed check · approve tenet.yaml to pin"; at `verify` an unpinned check never runs.
2. Create `.tenet/reports/`.
3. Run each check's `setup` commands, then `run`, from the repository root. CI runners use `bash -eo pipefail -c` (locally: `bash` where present, else the platform shell), within `timeout_minutes` (default 30).
4. `report_from: stdout` captures standard output as UTF-8 into `.tenet/reports/<name>.<ext>`; `file` (default) reads `report_path` (default `.tenet/reports/<name>.xml` or `.json`).
5. Read the report whatever the exit code (ALG-08 says how the exit code and the cases combine). With no report it is `TN-REPORT-MISSING` and the check fails.
6. Write `tenet-bundle/` (not a dot-folder): `bundle.json` `{schema_version, run: {id, attempt, workflow, job, index}, pr?, tested: {commit, kind, head, base}, checks: [{name, exit_code, outcome, duration_ms, report, report_sha256, inputs}]}` plus the reports. `exit_code` and `duration_ms` may be null.

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

Both install the locked version with `npm install --no-save` and check it against the lock's `integrity` (contracts §1; on `pull_request` / PR `workflow_run` from the PR `base.sha`, and on `push` / push `workflow_run` from `event.before` when reachable, else the default-branch checkout `HEAD`).

**`verify --record` steps.**
1. **Find the change.**
   - For `workflow_run`: use `workflow_run.pull_requests`; else list open pull requests (paginated) and keep those whose `head.sha` is the run's head SHA. This finds fork pull requests, and two pull requests sharing a head each get their own card. None means a push to the default branch.
   - For `edited`: reuse the latest bundle for that head SHA. If none exists, the card says "waiting for tests"; if it expired, "tests from <date> expired · push or re-run".
2. **Accept the bundles.** List the triggering run's artifacts through the API, then download each `tenet-bundle-*` one, retrying each up to 3 times. If a listed bundle still can't be downloaded, the card says "not checked: N of M bundles unavailable" and never reports the rest as the whole result (Spike B saw a transient `503 Egress is over the account limit`). Accept them only from the test workflow named in policy, for this repository and this head SHA, and only within the limits:
   - 50 MB per bundle, 20,000 cases
   - XML or JSON nesting depth 64
   - no symlinks, absolute paths or `..`

   Anything beyond a limit is refused with `TN-RECORD-BUNDLE`, naming the conclusion that becomes unavailable. Merge matrix bundles: a case's status is its worst across them.
3. **Read the change as data.** Read policy and the lock from the target (`base`; if loading at `base` fails, fall back to `base^` and record the §10 degraded string). Fetch the change with `git fetch --no-tags --filter=blob:none origin refs/pull/<n>/head refs/pull/<n>/merge`; if the merge ref has moved past the tested commit, note `merge-candidate-stale`. Check the tested commit out into a temporary worktree, never executing it.
4. **Evaluate.**
   - parse the acceptance block from `pr.body` (or in 0.1.0, the named packet's `definition.md` when `pr.body` has none, agents.md §5)
   - run `tenet check --ci --base <base>`, ALG-08, ALG-09 and ALG-14
   - evaluate the rules (ALG-07)
   - compute the evaluation ID
5. **Post the check run** `Tenet` on the **head** SHA, found by name and head. Its conclusion follows §10 (when $N > 1$ PRs share `head`, each card is headed `Pull request #<number>\n` with budget $\lfloor(60,000 - \text{overhead})/N\rfloor$ and the worst conclusion across the $N$ cards). The summary is cut at 60,000 characters in this order: same-area requirements first, then passing items' test lists, then passing requirements. Failing items, weakening, protected files and "would have blocked" are never cut (if those essential lines alone exceed the budget, `renderCheckSummary` throws `RangeError`, or the recorder keeps the full card in `refs/tenet/records` and posts a `neutral`/`failure` truncated pointer).
6. **Append records** (§4).

From alpha.1 the recorder also handles review, `/tenet` reply, ready-for-review, conversion to draft and closing events (in alpha.0, a pull request closed without merging records nothing beyond its last evaluation). **Merge queues** (L-0032): alpha.1 records merge-group candidates as observations; alpha.2 verifies the exact tested candidate before publishing its required status (kernel §5); full merge-queue evidence and quarantine come in 0.1.x. CP-0040's event table fixes the trigger and token for each.

## 4. Records ref

`refs/tenet/records`:
- `proof/<pr or main>/<evaluation_id>/<run_id>-<attempt>.json`, one per run, never overwritten
- `proof/<pr or main>/latest`, which moves only forward: a run that started earlier than the one it points to never replaces it
- `rules/<yyyy-mm>.jsonl`: one line per run and rule, `{evaluation_id, run, pr, rule, mode, would_block, at}`
- from alpha.1: `works/pr-<n>/events/<id>.json`, `decisions/<id>.json`, `board/board.json`

**Writing.**
- **Idempotent:** the key is the path. Writing the same content again is a no-op; different content at the same path is refused.
- **Git plumbing** (`hash-object`, `mktree`, `commit-tree`, `update-ref`), so the working tree is never touched. The committer is `tenet-recorder`, and each message is `tenet: <kind> <id>`.
- **Retry:** a rejected push fetches the new tip, rebuilds on it and retries, up to 8 times with 0.5–3 s jitter (five concurrent writers in Spike B needed up to 4 attempts and lost nothing). A final failure shows on the card as "results not kept"; at `verify` that conclusion is `failure` (§10).

**Retention:** in alpha.0 the recorder keeps every immutable run and advances `latest` forward-only; from alpha.1, on the first write to a new `rules/<yyyy-mm>.jsonl` month file, it prunes `proof/<work>/<evaluation_id>/<run>-<attempt>.json` files older than 30 days except each `latest` target and any run referenced under `decisions/` or `works/`. Clones never fetch the ref by default; locally, `tenet board --fetch` reads it.

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
| `approve-spec-change`, `approve-definition`, `replace-proving-case`, `retire-obligation` (by the promise's owner), `release`, campaign approval (approve); `accept-findings`, `accept-risk`, `override`, `quarantine-check`, `accept-health-regression` (waive); `resolve-conflict` (resolve); `delegate` | `forge-verified` |

**`forge-verified`** means **attributable to the decision-maker's forge account**:
- either a native approving review whose commit is the current subject
- or a reply (`/tenet approve`, `/tenet pick <n>`, `/tenet bless <section>`, `/tenet not-useful <finding>`) from an account in `owners[].forge_accounts`, which binds the **evaluation** the latest card showed and is refused if that has changed; an `@<evaluation>` suffix is optional, and required at `assure`

**Recording and limits.**
- The recorder records two-factor status as `enforced`, `not-enforced` or `unobservable`.
- A pull-request author can't approve their own pull request on most forges, so from `verify` agents open pull requests as a `bots[]` identity, or the decision-maker uses the comment form.
- Below `verify` the Owner may accept their own work (`proof.self_accepted: true`), shown as `self-accepted` on the board after merge. `/tenet bless <doc>#<slug>` stores an attributed `approve` (`name: "bless-section"`, `recorded: "forge"`); `/tenet not-useful <finding>` writes an immutable `not-useful` observation (`decision: null`).
- A decision by an account on a pull request its own agent session opened is flagged. Unless a host binding attests credential separation (assumption 4), `forge-verified` counts as detected.

`person-present` is an `ssh-keygen -Y` signature by a security key whose presence can be read from the signature (CP-0017). `key` and `channel` answers are advisory. An option that changes scope carries the replacement digest or returns to Define. Revoking a key is a policy change; earlier signatures stay valid.

## 7. Trust observations and guarantee levels

In [evidence.md §4](evidence.md#4-trust-observations-and-guarantee-levels), moved under the rollover rule.

## 8. Safe failure

Nothing silently passes: every degraded result is labelled on the card and the board, and what each one concludes is §10.

## 9. Release procedure

In [onboarding.md §4](onboarding.md#4-release-procedure), moved under the rollover rule.

## 10. Outcomes

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
| An enforced rule refuses (alpha.1 on) | `failure` | `failure` | 1 | "blocked" |
| Otherwise | `success`, or `neutral` when something would have blocked | `success` | 0 | the result |

At `verify` and `assure` a required control that can't run is always `failure`, never `neutral`: GitHub treats `neutral` as passing a required check (DEC-53). An override is a waiver recorded as `accepted-without-verification`.
