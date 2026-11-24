# CP-0048 · Answers to the round 4 specification questions

Answers to [proposals-r4.md](proposals-r4.md), decided on 2026-11-23 to pin exact `pkg/conformance/alg-11/` outputs for `CP-0048`.

1. **`sources.skipped[].reason` vocabulary and skip ordering.**
   - Every skipped tracked file is excluded from `sources.files` (and from `size.source_lines`, `modules`, `tests`, `docs`, and `ci`) and recorded in `sources.skipped: [{path, reason}]`, sorted by `path`, using the first matching reason from:
     1. `"env"` — basename is `.env` or starts with `.env.`
     2. `"credentials"` — matches `*.pem`, `*.key`, `id_*`, `*credentials*`, or `*secret*` (case-insensitive basename/glob)
     3. `"vendored"` — path starts with `vendor/`, `node_modules/`, `dist/`, or `build/` (or a `/vendor/`, `/node_modules/`, `/dist/`, `/build/` segment)
     4. `"generated"` — marked `linguist-generated` in `.gitattributes`, or first 5 lines contain `Code generated` or `@generated`
     5. `"excluded"` — matches a glob in `policy.onboard?.exclude`
     6. `"binary"` — contains a NUL byte (`\0`) in its first 8 KB or has a non-text binary extension (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.ico`, `.pdf`, `.zip`, `.tar`, `.gz`, `.wasm`, `.exe`, `.dll`, `.so`, `.dylib`)
     7. `"oversize"` — byte length `> 1_048_576` (`1 MB`)
   - Test files matching `ALG-09` test globs are **not** skipped: they appear in `sources.files` with `kind: "test"` (and in `inventory.tests[]`), and are excluded only from `size.source_lines` per `ALG-11`.
   - **Spec edits:** `tenet/specs/tech-spec/onboarding.md` §1 (`lines 11–14`), `tenet/specs/tech-spec/contracts.md` §4 (`line 76`), and `tenet/specs/plan/alpha.0b.md` (`CP-0048` *Behavior*, `lines 55–58`).

2. **Drafting unit IDs, `views`, and merge neighbor tie-breaker (`ALG-11`).**
   - **`one-file` layout:** `units` has a single unit: `[{id: "root", paths: ["."], views: ["vision", "requirements", "design", "experience", "plan"]}]`.
   - **`separate` layout:**
     - Initial units come from CODEOWNERS areas when `size.areas >= 1` (in CODEOWNERS order, `id` = pattern stripped of leading/trailing `/` and `*` with `/` replaced by `-`, `paths: [<normalized prefix>]`), else from top-level folders containing counted source files in ASCII order (`id` = folder name, `paths: ["<folder>"]`; root-level source files form `{id: "root", paths: ["."]}`).
     - **Under-2,000-line merge rule:** while `units.length > 1` and any unit has `< 2,000` counted source lines, pick the first such unit in order and merge it into its **preceding** unit (or into the **following** unit when it is at index `0`), keeping the target unit's `id`, appending the merged unit's `paths` in order, and summing their line counts.
     - Every unit in `separate` layout carries `views: ["vision", "requirements", "design", "experience", "plan"]`.
   - **Spec edits:** `tenet/specs/tech-spec/algorithms.md` (`ALG-11`, `line 176`) and `tenet/specs/plan/alpha.0b.md` (`CP-0048` *Behavior*, `line 56`).

3. **`findings[]` message templates and `no-test-report` path.**
   - `inventory.findings` is sorted by `kind` order (`dead-path`, `skipped-tests`, `owners-unmatched`, `no-test-report`), then `path`, then `message`:
     - `dead-path`: one entry per missing local path linked/named in a doc, `{kind: "dead-path", path: "<doc.path>", message: "<doc.path> links missing path <target>"}`.
     - `skipped-tests`: one entry per test file with `≥ 1` `ALG-09` skip match, `{kind: "skipped-tests", path: "<test.path>", message: "<count> skipped or focused test(s) in <test.path>"}`.
     - `owners-unmatched`: one entry per CODEOWNERS entry matching zero tracked files, `{kind: "owners-unmatched", path: "<codeowners.path>", message: "CODEOWNERS pattern <pattern> matches no tracked files"}`.
     - `no-test-report`: emitted when `observations.reports` is empty and no configured check or recognized runner can produce a report (`contracts §6`), `{kind: "no-test-report", path: "<ci workflow path, else tenet.yaml>", message: "No machine-readable test report configured"}` (choosing the first CI workflow in `inventory.ci` when present, else `"tenet.yaml"`).
   - **Spec edits:** `tenet/specs/tech-spec/onboarding.md` §1 (`lines 29–33`) and `tenet/specs/plan/alpha.0b.md` (`CP-0048` *Behavior*, `line 56`).

4. **Return shape of `onboard({inventoryOnly, refresh, layout})` and `assignment.inventory`.**
   - `onboard({inventoryOnly, refresh, layout})` returns `{preflight: {revision: string, read_count: number, skipped_count: number, dirty_warning: boolean}, inventory, findings, assignment: Assignment | null}`.
   - Top-level `findings` equals `inventory.findings`.
   - `assignment` is always populated (`inventory: ".tenet/onboard/inventory.json"` per `onboarding.md:14, 35`) and written to `.tenet/onboard/assignment.json` unless `--inventory-only` is meant to omit drafting execution only (both `.tenet/onboard/inventory.json` and `.tenet/onboard/assignment.json` are computed deterministically from the inventory so `onboard({inventoryOnly, refresh, layout})` always returns `{preflight, inventory, findings, assignment}`).
   - **Spec edits:** `tenet/specs/tech-spec/contracts.md` §4 (`lines 76, 80`) and `tenet/specs/plan/alpha.0b.md` (`CP-0048` *Exports* / *Behavior*, `lines 53–59`).
