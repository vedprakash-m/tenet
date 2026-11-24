# Release Checklist — `0.1.0-alpha.0`

Operational release packet (`CP-0059`, `ops`) implementing [plan.md §1](../../specs/plan.md#1-milestones), [plan/alpha.0b.md](../../specs/plan/alpha.0b.md#a0-8), [onboarding.md §4](../../specs/tech-spec/onboarding.md#4-release-procedure) (moved from `ci.md §9`), [CP-0016](../../specs/plan.md#cp-0016--experiment--problem-validation-and-baselines-alongside-m1), `package.json`, and [release.yml](../../../.github/workflows/release.yml).

Status snapshot verified on `main` (`87606f6`) / `r13/next`.

## 1. Gate Criteria Summary

**Counts (13 criteria): 4 `met`, 6 `not met`, 3 `not yet measurable`.**

| # | Criterion | Source | Exact command or evidence | State | Notes on current repository |
|---|---|---|---|---|---|
| 1 | M0 ratification (`CP-0001`) | `plan.md §0–§1` | Owner signs `vision.md` v1 and approves M0 specs + `kit/TENET.md` Part I (`tenet/ledger/` entry, `CP-0001` closed) | **not met** | `CP-0001` is `commit / waiting-owner`; specs remain drafts awaiting approval |
| 2 | Lint clean | `release.yml`, `package.json` | `npm run lint` | **met** | `biome lint .` checked 186 files cleanly |
| 3 | Documentation examples parse | `plan.md §0–§1` | `npm run check:examples` | **met** | Checked 11 documents cleanly |
| 4 | Test suite passes on `main` | `release.yml`, `package.json` | `npm test` | **met** | 407/407 tests pass on `87606f6` (covering shipped modules; `CP-0010` and `CP-0052` suites still on open branches) |
| 5 | All alpha.0 packets built & merged (`CP-0004, 0005, 0006, 0009, 0010, 0012, 0018, 0044, 0045, 0048, 0051, 0052, 0053, 0054, 0057`) | `plan.md §1–§2` | `tenet/packets/*/packet.yaml` + `git log main` | **not met** | `CP-0010`, `CP-0052`, `CP-0054`, `CP-0057` not merged to `main`; `CP-0009` has open `pending-r13.md` / `B4` |
| 6 | First findings in `<= 10` minutes on fixture repositories | `plan.md §1`, `alpha.0b.md` `CP-0010` | Timed `tenet init` + `tenet onboard --inventory-only` on Torus & empty repository | **not yet measurable** | `CP-0010` (`init`) not yet merged to `main` |
| 7 | Onboarding evaluation (`>= 90%` kept & recalled, `0` invented, `ALG-13`) | `plan.md §1`, `alpha.0b.md` `CP-0052` | `npm run eval:onboarding -- --agent <name>` across `>= 4` fixture repos and 2 `CP-0058` agents | **not yet measurable** | `CP-0052` evaluation harness not merged to `main` |
| 8 | Scenario suite passes (`pkg/conformance/scenarios/`) | `plan.md §1`, `alpha.0b.md` `CP-0052` | `npm run scenarios` (`test/onboard/scenarios.test.ts`) | **not met** | On `r11/cp-0052-fixes`, 7/13 pass (`s07`, `s11`–`s13` need `CP-0010`; `s06` awaits `check` wiring + `pending-r13.md`; `s10` step `05` awaits `recordAll` closed-PR guard) |
| 9 | Fresh-session check passes | `plan.md §1`, `alpha.0b.md` `CP-0052` | Bless "retry once", modify retry code, verify fresh agent (only `AGENTS.md`, skills, MCP) follows blessed spec and reports drift | **not yet measurable** | Depends on `CP-0010` + `CP-0052` |
| 10 | Packed artifact installs & runs both UX Part 1 journeys on 3 platforms (Linux, macOS, Windows) | `plan.md §1`, `onboarding.md §4`, `release.yml` | Build `.tgz` on 3 OS runners via `release.yml`, run `1A` (existing repo) & `1B` (new repo) on clean installs | **not met** | `CP-0010` not on `main`; `v0.1.0-alpha.0` tag not yet cut |
| 11 | This repository passes its own `tenet check` | `plan.md §1`, `alpha.0b.md` `CP-0054`/`CP-0057` | `node dist/cli.js check --json` (after `npm run build`) | **not met** | Emits 118 errors on `87606f6` (`5 TN-SPEC-NO-FRONT`, `87 TN-SPEC-MISSING-ID`, `26 TN-SPEC-REQ-META` across `vision.md`, `prd.md`, `tech-spec.md`, `ux-spec.md`, `plan.md`); blocked on `CP-0054` & `CP-0057` |
| 12 | Tarball excludes disallowed repository paths | `onboarding.md §4`, `release.yml`, `AGENTS.md` | `npm pack --dry-run --json` | **met** | 0 entries under `pkg/evals/`, `tenet/`, `test/`, `src/`, `.github/`, `package-lock.json`, `LICENSE-docs` (version still `0.0.0`, see §5) |
| 13 | Evidence-track announcement gate (`CP-0016`): 2 unrelated outside maintainers complete UX Part 1A & 1B unaided | `plan.md §1`, `CP-0016` | Observed unaided sessions recorded in `tenet/ledger/` | **not met** | `CP-0016` active; release-candidate sessions wait on packed `0.1.0-alpha.0` build |

## 2. Owner-Only Prerequisites

Only the Owner (Ved) can execute or authorize the following items:

1. **`CP-0001` ratification:** Read and sign `tenet/vision.md` v1 and approve the M0 specifications and `kit/TENET.md` Part I at named versions and digests (`L-0034`/`plan.md §0`).
2. **`CP-0054` approval and `tenet/vision.md` patch:** Apply and approve L0 changes to `tenet/vision.md` (`tenet/vision.md` is Owner-only per `AGENTS.md`) and approve L1/L2 specification preparation.
3. **`CP-0057` blessing:** Run `tenet bless` interactively across every section of this repository's specifications until `tenet check --json` has no unapproved findings.
4. **History rewrite before making repository public:** Rewrite git history as planned while `vedprakash-m/tenet` is still private, before flipping visibility to public at `alpha.0`.
5. **`vedprakash-m/tenet-sandbox` provisioning:** Create/configure `vedprakash-m/tenet-sandbox` (note `plan.md §0` records it as created private for Spike B/`CP-0051`; Owner verifies sandbox branch protection, secrets, and access) plus npm trusted publishing / GitHub Release permissions.
6. **Two unrelated maintainers (`CP-0016`):** Recruit and observe two maintainers unrelated to the steward running both UX Part 1 journeys on the release candidate without coaching (blocks announcing `alpha.0` per `plan.md §1`).

## 3. Ordered Release Procedure (`onboarding.md §4` & `release.yml`)

1. **Merge remaining alpha.0 work and close Owner gates:** Land `CP-0010`, `CP-0052`, `CP-0009` (`pending-r13.md`), `CP-0054` (+ `deferred-edits.md` + `vision.md` patch), `CP-0057` (`tenet bless`), and confirm `node dist/cli.js check --json` passes on this repository.
2. **Rewrite history and publish schemas:** Complete Owner history rewrite on `vedprakash-m/tenet` before public visibility; publish `kit/schemas/*.json` to GitHub Pages (`https://vedprakash-m.github.io/tenet/schemas/0.1/`, `CP-0002` / `L-0031`).
3. **Bump version and update changelog (`onboarding.md §4` step 1):** Set `"version": "0.1.0-alpha.0"` in `package.json` (confirm lockstep policy for `workspaces: [".", "runner"]` even though `runner/` ships in `0.1.0`) and append a `0.1.0-alpha.0` entry to `kit/CHANGELOG.md` using structured fields (`kind: rule-added | rule-clarified | field-added | breaking`).
4. **Build and pack once per package (`onboarding.md §4` step 2 & `release.yml`):** Tag `v0.1.0-alpha.0` (triggering `.github/workflows/release.yml` across `ubuntu-latest`, `windows-latest`, `macos-latest`), run `npm run lint`, `npm test`, and `npm pack --json` once; record each `.tgz` SHA-256 digest and assert the tarball file list matches §4.
5. **Cross-platform clean install and journey verification (`onboarding.md §4` step 3):** Install **the same `.tgz` artifacts** on clean Windows, macOS, and Linux environments (`release.yml` smoke test plus full UX Part 1A & 1B journeys and `pkg/conformance/scenarios/`).
6. **Publish to npm (`onboarding.md §4` step 4):** Publish **the same `.tgz` files** with `npm publish --provenance --tag next` via trusted publishing (a short-lived granular token may be used for the initial publish of `@vedprakash-m/tenet`; retry using the same version if needed).
7. **Create GitHub Release (`onboarding.md §4` step 5):** Publish the `v0.1.0-alpha.0` GitHub Release attaching the `.tgz` tarball(s), the `kit/` archive, and `SHA256SUMS`.
8. **Registry byte verification (`onboarding.md §4` step 6):** Install `@vedprakash-m/tenet@0.1.0-alpha.0` from the npm registry and verify exact bytes against `SHA256SUMS` and `tenet doctor`.
9. **Update `vedprakash-m/tenet-starter` (`onboarding.md §4` step 7):** Sync `examples/starter/` (`CP-0010`) into `vedprakash-m/tenet-starter` and tag `v0.1.0-alpha.0`.
10. **Evidence-track announcement gate (`CP-0016`):** Complete and record the two unaided outside-maintainer sessions before public announcement.

## 4. Packed Artifact Specification

- **Must contain** (`package.json` `files` + `release.yml`):
  - `package.json`, `LICENSE`, `README.md`
  - `dist/` compiled JS and `.d.ts` files (`dist/cli.js`, `dist/sdk.js`, `dist/commands/index.js`, `dist/core/{fs,yaml,git,hash,output,clock}.js`, etc.)
  - `kit/` (`kit/TENET.md`, `kit/CHANGELOG.md`, `kit/README.md`, `kit/defaults/`, `kit/hooks/`, `kit/packs/`, `kit/practices/`, `kit/schemas/`, `kit/skills/`, `kit/templates/`, `kit/workflows/`, `kit/agents/`)
  - `pkg/migrations/`, `pkg/conformance/`, `pkg/hosts/` (only entries matching `LICENSE`, `README.md`, `package.json`, `dist/`, `kit/`, `pkg/migrations/`, `pkg/conformance/`, `pkg/hosts/`)
- **Must NOT contain** (`release.yml` `forbidden` list & `AGENTS.md`):
  - `pkg/evals/` (including `pkg/evals/bench/`, `pkg/evals/onboarding/`)
  - `tenet/` (this repository's own records, specs, packets, ledger, `holdout/`)
  - `test/`
  - `src/`
  - `.github/`, `package-lock.json`, `LICENSE-docs`, `runner/`

## 5. `npm pack --dry-run` Verification (`87606f6`)

Command run: `npm pack --dry-run --json` on commit `87606f6`.

- **Archive summary:** `@vedprakash-m/tenet@0.0.0`, `entryCount: 1038`, compressed `1,031,757` bytes, unpacked `5,971,045` bytes (`vedprakash-m-tenet-0.0.0.tgz`).
- **Forbidden-path check:** `0` matches for `pkg/evals/`, `tenet/`, `test/`, `src/`, `.github/`, `package-lock.json`, or `LICENSE-docs`; `0` entries outside `package.json` `files` allowlist.
- **Included counts by top-level area:** root (`LICENSE`, `README.md`, `package.json`): `3`; `dist/`: `134`; `kit/`: `46`; `pkg/conformance/`: `855`.
- **Issues / gaps observed in dry-run (things present or not yet ready before cutting `alpha.0`):**
  1. **Unbumped package version & changelog:** Tarball builds as `@vedprakash-m/tenet@0.0.0` instead of `0.1.0-alpha.0`, and `kit/CHANGELOG.md` stops at `0.1.0-draft`.
  2. **Future-milestone fixtures packed into npm tarball:** `pkg/conformance/` contributes **855 of 1,038 files (~82%)** — including unshipped `alpha.1` / `alpha.2` / `0.1.0` conformance suites (`decisions/`: 31, `events/`: 31, `full-board/`: 27, `gate/`: 33, `kernel-schemas/`: 33, `replay-trust/`: 31, `signed-evidence/`: 31, `evaluator-trial/`: 2, `red-team/`: 2, `reference/`: 8) alongside `install/` (176) and `scenarios/` (177). All are permitted by `package.json:files` and `release.yml`, though `alpha.1+` suites inflate the alpha.0 npm download (~6 MB unpacked) and should either be accepted deliberately or scoped before release if keeping alpha.0 minimal.
  3. **Empty `pkg/migrations/` and `pkg/hosts/`:** Both are listed in `package.json` `files` and `release.yml`, with 0 files currently on disk.
  4. **Missing `CP-0010` runtime & schema outputs:** `dist/install/` and `kit/schemas/results/{init,upgrade,remove,doctor}.json` are absent because `CP-0010` is not yet merged to `main`.
