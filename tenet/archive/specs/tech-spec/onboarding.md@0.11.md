# Tenet technical specification: onboarding, install and upgrade

> Level L2 · Version 0.11 · Part of [tech-spec.md](../tech-spec.md) · Status: **draft, awaiting the Owner's approval** · Budget: 6,000 tokens · Split from `tech-spec.md` §6.5 and §12 under the rollover rule (L-0022) · Previous version: `archive/specs/tech-spec/onboarding.md@0.10.md`

**Context card.** How a project gets Tenet, how its specifications are drafted and blessed, and how Tenet is upgraded and removed. Implements PRD R-223 and tooling R-020, R-021, R-025, R-051 and R-221; the experience is UX spec Parts 0, 1 and 4. File formats: [contracts.md](contracts.md) §1–§4 and §10; CI: [ci.md](ci.md); what agents are told: [agents.md](agents.md); algorithms ALG-02, ALG-03, ALG-04, ALG-11, ALG-12, ALG-13.

## 1. Onboarding and blessing (R-223)

<!-- provisional --> **Preflight and inventory.** `tenet onboard` needs at least one commit (else `TN-ENV-NO-COMMIT`: "make a first commit, then run tenet onboard"). It lists:
- what it will read: code, configuration, tests, docs, CI, owners
- what it skips: `.env*`, credential files (`*.pem`, `*.key`, `id_*`, `*credentials*`, `*secret*`), vendored and generated paths (ALG-11), binaries, files over 1 MB, anything in `onboard.exclude`
- that drafting sends content to the user's own agent and its model provider

`--inventory-only` stops there. It writes `.tenet/onboard/inventory.json` (contracts §4, git-ignored) from `HEAD`. Uncommitted changes are left out, with a warning.
- **Modules** are the folders holding a package manifest, else top-level source folders.
- **Project kind:**
  - `cli`: a `bin` entry or `cmd/` folder
  - `library`: a published package manifest without a server entry
  - `service`: a server framework dependency or a `Dockerfile` exposing a port
  - `data`: dbt, Airflow or notebooks
  - `infrastructure`: Terraform, Helm or Kubernetes manifests
  - `application`: otherwise
- **Tests:** files matching ALG-09, with the names from its declaration patterns.
- **Docs:** each doc's first `# ` heading, its `## ` slugs and `git log -1 --format=%cI`.

The inventory is byte-identical for one commit. Results from local test reports go only in `observations`, named by digest.

**First findings** (the "first useful finding", V-V3). These are printed by `init` and `onboard --inventory-only`, deterministic, within ten minutes of install:
- doc paths and links that name missing files
- skipped or focused tests present (ALG-09 skip patterns over the tree)
- CODEOWNERS patterns matching nothing
- whether a test report can be produced (contracts §6)

**Drafting units and output paths.** The assignment (`.tenet/onboard/assignment.json`) lists units (ALG-11) in order, each with its slice of the inventory.

| View | `one-file` | `separate` |
|---|---|---|
| vision | `tenet/intent.md` `## Vision` | `tenet/vision.md` (L0) |
| requirements | `## Requirements` | `tenet/specs/prd.md` (L1) |
| design | `## Design` | `tenet/specs/tech-spec.md` (L2) |
| experience | `## Experience` | `tenet/specs/ux-spec.md` (L2) |
| plan | `## Plan` | `tenet/specs/plan.md` (L2) |

`intent.md` sections take the levels shown, so one file keeps section-level governance (R-207). Vision items are `V-<n>`. **Who writes what:**
- The agent writes text, citations, origins, `scope`, `applies_to`, conflicts and questions.
- `tenet fix` writes IDs, front matter, section entries, digests and `drafted_from` (the inventory's revision).
- The `draft-specs` skill ends with `fix`, then `check` (agents.md §2).

**Draft format.** Requirement lines, citations, conflicts, open questions and front matter follow contracts §3. A requirement may also sit in a table: a header row naming `ID`, `Requirement` and optionally `Serves`, `Origin` and `Cites` maps those columns to the same metadata, and braces are optional there. `inferred` statements cannot be blessed until a person edits or explicitly adopts them (origin becomes `asked`, with `adopted_by`).

**The onboarding card.** The target branch has no Tenet workflow yet, so `tenet onboard --card` renders the card for the pull request description the agent opens: what was read, conflicts, sections with statement counts by origin and reading times (words ÷ 200), and the citation check. Golden examples live in `pkg/conformance/cards/`. CI cards begin after the setup merges. Supported starts:
- protected main (the onboarding pull request)
- an empty repository (commit to main)
- a template clone
- a contributor without settings rights (the pull request waits for someone who has them)

**Checks and blessing.** `tenet check` resolves every citation (ALG-04) and flags statements without an origin. `tenet bless` follows ALG-03:
- interactive only; conflicts first, then each section with its reading time
- actions: bless, confirm (for `sources-changed`), edit, reject, defer
- the person picks who they are from `owners[]`
- each session is logged in `<records>/blessed/log.jsonl`
- the blessing is recorded as `self` (advisory: anyone with write access could edit front matter, which is why the card lists blessings changed in each pull request); from alpha.1 a review action also blesses, recorded as `forge`; from alpha.2, `signed`

A conflict's resolution is written as `resolution:` on its `CF` item. When the chosen option contradicts a drafted statement, bless opens that statement for editing before the section can be blessed.

The **last blessed text stays in force** (the blessed copy):
- An edit to it is flagged `edited`: an unblessed proposal that rejecting keeps out.
- A change to the cited lines is flagged `sources-changed`: confirm re-anchors.
- Re-running `onboard` keeps IDs, edits, rejections and blessings, and assigns only changed units.

## 2. Install and upgrade

`init` runs the preflight (R-020) and writes, all recorded in `.tenet/manifest.json` (ALG-12):
- `tenet.yaml`: checks with the runner command and setup of [ci.md §2](ci.md#2-running-checks); `package.json` is never edited
- `tenet.lock`
- the `AGENTS.md` block (agents.md §1)
- the recorder workflow, and either Tenet's test workflow or the existing-CI step
- the pull-request template block and the `.gitignore` block
- the detected hosts' skills and MCP entries (contracts §10)

It then prints the first findings and offers onboarding. Existing files are edited only inside marked blocks or owned JSON keys. Integrity is checked by hash; files are not made read-only. `owners[]` starts from `git config user.name` and the CODEOWNERS handles, confirmed once (with `--yes`: the git user only). The lock's `kit_sha256` is SHA-256 over the sorted lines `<path>\0<sha256 of file>` for every file under `kit/`.

`tenet remove` reverses the manifest (ALG-12), keeps specifications, records and values the user changed, and reminds the user to remove the branch rule if the Tenet status was made required. `tenet check` reports a package version that differs from the lock ("run tenet upgrade").

**Upgrade** (alpha.0 on): update the lock, regenerate the `AGENTS.md` block, workflows and skills, report what changed, and run `tenet check`. It never changes the level or starts a new rule beyond `observe`. From M4: stage, migrate with a restricted file API, regenerate, swap atomically; classify from structured fields; a scheduled pull request.
