# Answers — CP-0010 round 20

Ruling on published prerelease lock pins, `x-integrity-source: "local"` verification in CI, and `tenet doctor` lock reporting (`audit-r20.md`, `contracts.md §1`, `ci.md §§3, 10`, `onboarding.md §2`).

## 1. Published prereleases must query the registry

- **Gap (`src/install/integrity.ts:146`, `audit-r20.md` line 30):** `releaseIntegrity()` currently treats any version containing `-` as local/offline (`version.includes("-")`), skipping `npm view <pkg>@<version> dist.integrity --json` even for published prereleases (`0.1.0-alpha.0`, `-rc.1`).
- **Rule:** Skip registry lookup only for `version === "0.0.0"` or `--offline` (when no `TENET_INSTALL_INTEGRITY` or `environment.registry` override is supplied). Published prereleases query `dist.integrity` from npm and record a standard registry lock (no `x-integrity-source: "local"`). Fall back to `x-integrity-source: "local"` only when `version === "0.0.0"`, `--offline`, or the registry lookup returns not-found (`E404` / unpublished tarball).
- **Transport failure vs. local integrity:** A registry transport failure is `TN-ENV-REGISTRY` (environment, exit 3); only "not found" plus `0.0.0` or `--offline` leads to local integrity.

## 2. How CI acquires and verifies a `x-integrity-source: "local"` lock

- **Why tarball hashing cannot work for local locks:** A local-integrity lock hashes the unpacked installed package tree (`sha512` of sorted `<path>\0<bytes>` over `package.json`, `LICENSE`, `README.md`, `dist/**`, `kit/**`, `pkg/{migrations,conformance,hosts}/**`). When `init` runs from an installed unpublished tarball (e.g., `npm install --global ./vedprakash-m-tenet-0.1.0-alpha.0.tgz` during `CP-0016` alpha.0 maintainer sessions), npm has already discarded the `.tgz` bytes, so CI hashing the compressed `.tgz` always rejects a local lock. Recording a tarball hash inside the package at pack time is cryptographically circular.
- **Decision: verify installed files in CI + mark proof cards visibly advisory (never silently skip):**
  1. **Package acquisition in CI (`kit/workflows/tenet*.yml`, `kit/workflows/existing-ci-step.yml`):**
     - When `x-integrity-source` is absent (registry lock): run `npm pack --ignore-scripts --json <package>@<version>`, assert `sha512(tgz) === lock.integrity`, and run `npm install --no-save --ignore-scripts --no-audit --no-fund ./<tgz>`.
     - When `lock["x-integrity-source"] === "local"` (unpublished tarball / `CP-0016` maintainer sessions / `--offline` init): acquire the unpacked package in `RUNNER_TEMP/tenet-tool` (or reuse workspace `node_modules/@vedprakash-m/tenet` when already installed at `lock.version` via `npm ci`), trying `npm pack <package>@<version>`, else repo/env tarball (`./vedprakash-m-tenet-<version>.tgz` / `TENET_TARBALL`), else the matching GitHub Release asset (`vedprakash-m-tenet-<version>.tgz` for tag `v<version>`), installing unpacked `.tgz` with `npm install --no-save --ignore-scripts --no-audit --no-fund`.
  2. **Integrity check:** For `x-integrity-source: "local"`, compute the deterministic sorted installed-file SHA-512 (`localIntegrity`) over the acquired package root (`package.json`, `LICENSE`, `README.md`, `dist/**`, `kit/**`, `pkg/{migrations,conformance,hosts}/**`) and require it to equal `lock.integrity`. Mismatch fails the CI step immediately. (Any non-`"local"` `x-integrity-source` value is refused.)
  3. **CI card status (`verify --record`):** When the target's `tenet.lock` carries `x-integrity-source: "local"`:
     - At `observe` and `protect` (including `alpha.0` maintainer sessions), `verify --record` succeeds cleanly and adds a `degraded` entry (`"local package integrity in tenet.lock; re-pin published release with tenet upgrade"`) so the card visibly notes it.
     - At `verify` and `assure` (`alpha.2+`), `x-integrity-source: "local"` is refused (`conclusion: failure`).

## 3. What `tenet doctor` reports

- **`kit_sha256` & version:** Unchanged (`TN-KIT-EDITED`, `TN-KIT-MISSING`, `TN-LOCK-MISMATCH`).
- **Local-integrity lock (`x-integrity-source: "local"`):**
  - When `lock.version === installedVersion`, `doctor` recomputes the installed package tree `localIntegrity` and compares it to `lock.integrity`. If they differ, the `lock` check fails (`ok: false`, `TN-LOCK-INVALID`, exit `1`).
  - If both `kit_sha256` and `localIntegrity` match, `checks[name="lock"]` reports `ok: true` with `detail` noting local integrity and CI advisory status (e.g., `"tenet.lock matches kit (local integrity; CI cards advisory until published pin via tenet upgrade)"`, or vendored equivalent), and CLI stderr prints a non-blocking notice when CI workflows are configured (`ci.mode !== "none"`).
