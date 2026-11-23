# Tenet technical specification: CI, verification and authority

> Level L2 · Version 0.11 · Part of [tech-spec.md](../tech-spec.md) · Status: **draft, awaiting the Owner's approval** · Budget: 6,000 tokens · Split from `tech-spec.md` §7.2–§7.6 and `contracts.md` §7 under the rollover rule (L-0024)

**Context card.** Every release uses one CI shape (DEC-48). A **test job** runs the change's code and holds no write token. A **recorder** never runs the change: it builds the proof card, posts it and keeps the records. From `verify`, the test job is sealed and the recorder signs (the **attest job**). This part covers how checks run, the workflows, where results are kept, decisions, trust observations and safe failure. GitHub is the reference binding; the kernel names only the properties (signed provenance, merge requires status, attributable decisions). Spike CP-0040 confirms this shape and delivers its event table; if `workflow_run` fails it, the fallback is one job that posts the card and writes records only on `push`.

## 1. One shape for every release

| Job | Runs | Holds | Does |
|---|---|---|---|
| **Test job** | the change's code | `contents: read`; at `verify`, no secrets and network denied by default | `tenet verify --run-checks` runs setup and the checks the target's `tenet.yaml` names, or `tenet verify --bundle` collects reports the project's own CI job already produced; uploads the artifact `tenet-bundle` |
| **Recorder** | from the default branch; reads the change only as data | `contents: write` (records ref only), `checks: write`, `pull-requests: read`, `actions: read` | `tenet verify --record`: validates the bundle, reads policy from the target, runs `tenet check`, weakening and ALG-14 on the tested commit's files, evaluates the rules, posts the check run `Tenet`, writes the records ref |

| Capability | alpha.0 | alpha.1 | alpha.2 on, at `verify` |
|---|---|---|---|
| Where tests run | Tenet's test workflow, or a step in the project's CI job | same | Tenet's sealed test workflow only |
| What the recorder keeps | card; records ref: proof, rule outcomes | plus decisions, forge-state events, `board.json` | signed, on the evidence store |
| Decisions read | — | reviews and `/tenet` replies (`forge`) | signed (`signed`) |

Below `verify` a pull request can change the workflow that tests it, so blocking there is **detected**, not enforced (DEC-49). The card says when the test workflow differs from the target's.

## 2. Running checks

1. Read `tenet.yaml` from the target (`git show <base>:tenet.yaml`). **First policy:** at `observe` and `protect`, a check the pull request adds runs labelled "proposed check · approve tenet.yaml to pin"; at `verify` an unpinned check never runs.
2. Create `.tenet/reports/`.
3. Run each check's `setup` commands, then `run`, from the repository root, with `bash -eo pipefail -c` on CI runners (locally: `bash` where present, else the platform shell), within `timeout_minutes` (default 30).
4. `report_from: stdout` captures standard output as UTF-8 into `.tenet/reports/<name>.<ext>`; `file` (default) reads `report_path` (default `.tenet/reports/<name>.xml` or `.json`).
5. Read the report whatever the exit code. A non-zero exit with a valid report fails only its failing cases; with no report it is `TN-REPORT-MISSING` and the check fails.
6. Write `.tenet/bundle/`: `bundle.json` `{schema_version, run: {id, attempt, workflow}, tested: {commit, kind, head, base}, checks: [{name, exit_code, duration_ms, report, report_sha256, inputs}]}` plus the reports. Uploaded as `tenet-bundle`, kept 7 days.

**What `init` writes.** The runner's own command with the reporter flags of contracts §6, never `npm test -- …`. Setup comes from the steps before the test step in the project's CI workflow, else from this table; the toolchain step uses the project's version files (`.nvmrc`, `.python-version`, `go.mod`), else the runner default.

| Found | `setup` |
|---|---|
| `package-lock.json` | `npm ci` |
| `pnpm-lock.yaml` | `corepack enable && pnpm install --frozen-lockfile` |
| `yarn.lock` | `corepack enable && yarn install --immutable` |
| `uv.lock` | `pip install uv && uv sync` |
| `pyproject.toml`, else `requirements.txt` | `pip install -e ".[test]"`, else `pip install -r requirements.txt` |
| `go.mod` | `go mod download` |
| `pom.xml`, `build.gradle` | none |

**Where the tests run.** When `init` finds a CI job that already runs the detected test command (and so has its services and secrets), it adds the **existing-CI step** at the end of that job; otherwise it writes Tenet's test workflow. The preflight says which and why.

```yaml
# tenet:begin v<version>
- if: always()
  run: npx -y @vedprakash-m/tenet@<locked> verify --bundle
- if: always()
  uses: actions/upload-artifact@v4
  with: {name: tenet-bundle, path: .tenet/bundle/}
# tenet:end
```

## 3. Workflows

`.github/workflows/tenet-tests.yml` (when Tenet runs the tests):

```yaml
name: Tenet tests
on:
  pull_request: {types: [opened, synchronize, reopened, ready_for_review]}
  push: {branches: [<default branch>]}
permissions: {contents: read}
concurrency: {group: tenet-tests-${{ github.ref }}, cancel-in-progress: true}
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: {fetch-depth: 0}
      - <toolchain step>
      - run: npx -y @vedprakash-m/tenet@<locked> verify --run-checks
      - if: always()
        uses: actions/upload-artifact@v4
        with: {name: tenet-bundle, path: .tenet/bundle/}
```

`.github/workflows/tenet.yml` (the recorder, always written):

```yaml
name: Tenet
on:
  workflow_run: {workflows: [<test workflow name>], types: [completed]}
  pull_request_target: {types: [edited]}
permissions: {contents: write, checks: write, pull-requests: read, actions: read}
concurrency: {group: tenet-record-${{ github.event.workflow_run.head_sha || github.event.pull_request.head.sha }}}
jobs:
  record:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: {fetch-depth: 0}
      - run: npx -y @vedprakash-m/tenet@<locked> verify --record
```

**`verify --record` steps.**
1. Find the change: for `workflow_run`, the pull request whose head is the run's head SHA (through the API; none means a push to the default branch); for `edited`, the latest bundle for the head SHA (none yet: post "waiting for tests").
2. Accept the bundle only from the test workflow named in policy, for this repository and the same head SHA; parse it as data.
3. Read policy and the lock from the target. Fetch the tested commit and base (`git fetch origin <sha>`); read their files, never execute them.
4. Parse the acceptance block from the pull request body; run `tenet check`, ALG-08, ALG-09 and ALG-14; evaluate the rules (ALG-07); compute the evaluation ID (contracts §1).
5. Create or update the check run `Tenet` on the **head** SHA, found by name and head. Conclusion: `success`; `neutral` when something would have blocked or a control degraded; `failure` only when an enforced rule refuses (alpha.1 on). The summary is cut at 60,000 characters with a line pointing to the full record.
6. Append records (§4). Fork pull requests get the same card.

From alpha.1 the recorder also handles review, `/tenet` reply, ready-for-review, conversion to draft and closing events; CP-0040's event table fixes the trigger and token for each.

## 4. Records ref

`refs/tenet/records`:
- `proof/<commit>/<evaluation_id>.json` for each evaluation, and `proof/<commit>/latest`
- `rules/<yyyy-mm>.jsonl`: one line per evaluation and rule, `{evaluation_id, pr, rule, mode, would_block, at}`
- from alpha.1: `works/pr-<n>/events/<id>.json`, `decisions/<id>.json`, `board/board.json`

The committer is `tenet-recorder`, and each message is `tenet: <kind> <id>`. A write fetches the ref, builds a commit on its tip and pushes it; if rejected, it retries up to 5 times with 1–5 s jitter. A final failure is shown on the card as "results not kept". Locally, `tenet board --fetch` reads the ref.

## 5. Verify: sealed tests and signed records (alpha.2 on)

**Sealed test job.** No secrets, read-only, network denied by default, an environment-variable allowlist, no cache shared with the recorder, the runner image recorded. It computes the subject before and after each check; changed tracked files make a check inconclusive. A check passes only on exit code 0 with a valid report.

**Attest job** (the recorder at `verify`). It restores no cache and recomputes the subject. It accepts a bundle only from the named test workflow run for the same head SHA (`workflow_run` carries a different run ID; the bundle's `run` is checked against the triggering run). It evaluates protected paths against the target, replays events, signs evidence and observations and writes the evidence store. It also records forge state, posts the status and decision requests, reads approvals, observes trust, verifies merge-queue candidates and on main publishes `board.json`.

**Honest limit.** A check that runs the change's code can be subverted by that code. The jobs keep it away from credentials, policy and the store; independent tests, distinguishing evidence, review and external holdout cover the rest.

**Evidence store.** Each record carries a **signature only the attest job can make**, so it verifies wherever it is kept. CP-0040 confirms the defaults:
- **public repositories:** a public signing service with a transparency log (Sigstore; GitHub artifact attestations)
- **private repositories:** an Ed25519 key held as a secret only the protected workflow can read, signed with `node:crypto`, its public half pinned in `tenet.yaml`; public logs reveal the repository name, so private repositories never use them without consent (V-B5)
- **considered only if both fail:** the forge's OIDC token, verified when recorded

Records live at `refs/tenet/evidence` under `<subject-digest>/<id>.json`, written with the §4 retry; write access alone can't forge one. The fallback is a store only the attest job can write (a protected branch or a separate repository).

## 6. Decisions and proof

| Decision (name → kind) | Required strength |
|---|---|
| `change-policy`, `widen-permission`, `amend-vision`, deep-lane `release` (approve) | `person-present` at `assure`; `forge-verified` otherwise |
| `approve-spec-change`, `approve-definition`, `replace-proving-case`, `retire-obligation` (by the promise's owner), `release`, campaign approval (approve); `accept-findings`, `accept-risk`, `override`, `quarantine-check`, `accept-health-regression` (waive); `resolve-conflict` (resolve); `delegate` | `forge-verified` |

`forge-verified` means **attributable to the decision-maker's forge account**. That is either a native approving review whose commit is the current subject, or a reply (`/tenet approve`, `/tenet pick <n>`, `/tenet bless <section>`, `/tenet not-useful <finding>`) from an account in `owners[].forge_accounts`. A reply binds the **evaluation** the latest card showed and is refused if it has changed since; an `@<evaluation>` suffix is optional, and required at `assure`.

The recorder records two-factor status as `enforced`, `not-enforced` or `unobservable`. A pull-request author can't approve their own pull request on most forges, so from `verify` agents open pull requests as a `bots[]` identity, or the decision-maker uses the comment form. Below `verify` the Owner may accept their own work, shown as `self-accepted` on the board after merge. A decision by an account on a pull request its own agent session opened is flagged; unless a host binding attests credential separation (assumption 4), `forge-verified` counts as detected.

`person-present` is an `ssh-keygen -Y` signature by a security key whose presence can be read from the signature (CP-0017). `key` and `channel` answers are advisory. An option that changes scope carries the replacement digest or returns to Define. Revoking a key is a policy change; earlier signatures stay valid.

## 7. Trust observations and guarantee levels

The attest job observes:
- **T1:** the verifier runs from a protected source
- **T2:** evidence verifies against that source's identity
- **T3:** decisions reserved to people carry proof an agent can't produce

**T4** (agents never hold decision-makers' credentials) is declared and spot-checked: agent commits come from `bots[]`, and no owner acts on a pull request their agent session opened. It supports enforced\* only where a host binding attests it. Separately, the attest job observes **whether merging requires the Tenet status** (`unavailable` on forge plans without merge protection). `enforced*` counts as enforced while the latest observation is under 7 days old and holds; otherwise it counts as detected. `tenet doctor` reads it offline.

| Rule | Mode A (deterministic engine) | Mode B (host-driven) with CI |
|---|---|---|
| Gate holds before advancing | enforced | detected locally; enforced* by replay and required status |
| Evidence not from the claimant | enforced* | enforced* |
| Code under test cannot fake its check | not guaranteed | not guaranteed |
| Decisions made by a person | at the proof-table strength | at that strength; `forge-verified` enforced* only under T4; `key`, `channel` advisory |
| Protected paths unchanged | enforced* | enforced* (detected below `verify`) |
| Holdout hidden | enforced* if external | enforced* if external; advisory in-repo |
| Agent tools, paths, network | as the adapter declares | as the host binding declares |

## 8. Safe failure

| Control cannot run | `observe`, `protect` | `verify`, `assure` |
|---|---|---|
| CI unavailable or a check times out | Card says "not checked"; nothing blocks | Every change holds; an override is a waiver recorded as `accepted-without-verification` |
| Signature or key unavailable | Not applicable | Evidence shown `unsigned`, counts as detected |
| Review or decision unobservable | Recorded as `unknown` | The decision is asked again |
| Policy or kit fails to load | Warning; previous policy used and named | The status fails with the reason |

Nothing silently passes: every degraded result is labelled on the card and the board.

## 9. Release procedure

Each alpha is an `ops` work item:
1. Bump the version; write the changelog with structured fields (`kind: rule-added|rule-clarified|field-added|breaking`).
2. `npm pack` **once** and record the `.tgz` digest.
3. Install that `.tgz` on clean Windows, macOS and Linux, and run both UX Part 1 journeys and the scenario suite.
4. Publish **the same file**: `npm publish <tgz> --provenance --tag next` through trusted publishing.
5. Create a GitHub release with that `.tgz`, the kit archive and `SHA256SUMS`.
6. Update and tag `tenet-starter`.
