# Unmapped Musts: classification and next steps, 2026-11-03

Scope: the 26 Musts that `node tools/coverage.ts --milestone R1` lists as unmapped on main at `06bcbb0`. For each, this audit read the PRD row and its acceptance cases, the Tech Spec mechanism (Appendix A), and every feature spec in `specs/` that names it, then compared both with the source and tests in this worktree.

Result: **no requirement is class (a).** None can be implemented from signed specs without a decision, within the current size ceilings, with a test that distinguishes the requirement. No source, test or tag was changed. R1 mapping is unchanged: 139 mapped, 16 host-only, 26 unmapped, 0 qualified.

## Classes

| Class | Meaning |
|---|---|
| a | Implementable now from signed specs, no decision, within ceilings |
| b | Needs an owner decision, or a spec that is unsigned or still missing a mechanism |
| c | Needs real host or human evidence |
| d | Needs a larger feature that does not exist |
| e | Blocked by a fixed size ceiling |

Each row gives the primary class; secondary blockers follow in the blocker column. The temporary approval to skip sign-off applies only to work kept on this branch. It does not supply a missing decision, a missing mechanism or ceiling headroom, so those stay blockers.

Counts by primary class: **a 0, b 13, c 4, d 8, e 1** (total 26).

## Ceiling headroom measured on this tree

Non-whitespace characters, from `tools/lint-quality.ts` `measure()`. The ceiling is the owner-set budget; `tools/quality-baseline.json` records no raised ceiling.

| Module | Used | Ceiling | Free |
|---|---:|---:|---:|
| Central (pipeline, verbs, decisions) | 247,182 | 247,219 | 37 |
| `adapters/node-ts` | 20,160 | 20,160 | 0 |
| `adapters/git-cli` | 37,801 | 37,843 | 42 |
| `core/budget` | 8,806 | 8,870 | 64 |
| `adapters/store-fs` | 25,706 | 25,920 | 214 |
| `core/schemas` | 26,371 | 26,899 | 528 |
| `core/review` | 16,981 | 20,160 | 3,179 |
| `core/risk` | 4,779 | 8,640 | 3,861 |
| `core/verdict` | 12,549 | 17,280 | 4,731 |

Any behavior that needs a new verb, decision kind, response field or schema field lands in central, schemas or store, which have 37, 528 and 214 characters free. That is why class (e) shows up as a secondary blocker in many rows.

## Per-requirement table

| ID | Class | Exact blocker | Smallest next step | Action taken |
|---|---|---|---|---|
| INS-05 | b | No mechanism is specified for re-probing. The `Host` port is `capabilities(): Descriptor` only (`ports/types.ts:254`); it has no host version, no probe cache and no invalidation inputs. Tech Spec §4.4 names only `containment` as a probe; every other key is static or observed. Secondary: c (needs host version/plugin version observations), e. | Owner decision plus a short spec: which capabilities are probed, where the host version comes from, and the cache key and provenance fields. | None |
| AGT-10 | c | The outcome is what a user sees on a native host (AC-22 traces, AC-21 journeys). By construction the coordinator already dispatches `tenet-reviewer`/`tenet-analyst` and passes JSON to `findings` (`SKILL.md` lines 44-45); a user is never asked to manage them. Adding an instruction sentence and testing for it would prove instruction presence only, which is the inflation the task excludes. | Observe a native Reviewer/Researcher run and record that no specialist session was surfaced to the user (needs spike authorization). | None; no tag |
| AGT-12 | e | `buildManifest` (`core/review.ts`) receives `{path, kind, added, removed}` only; its `investigation` list is changed source and test paths, with no changed-export detection, no callers and no linked acceptance tests. Tech Spec §8.7 specifies this list. The inputs are gathered in `verbs/manifest.ts` (central, 37 characters free). Secondary: d (export detection from diffs), c (AC-22 native traces). | Owner-approved central increment, or a measured replacement elsewhere, then red-first tests for export-change detection and the investigation order. | None |
| EVD-04 | b | The baseline stage exists, but the second clause (rerun a broader candidate failure on a sealed baseline outside the workspace) needs the sealed-baseline contract. `specs/sealed-baseline.md` is "Awaiting owner decisions D1 to D8. No implementation before sign-off"; `verbs/facts.ts` supplies an empty baseline-failure set. Secondary: d (materializer, classifier, excluded-failure listing), e. | Owner decisions D1-D8, then independent review of the materialization/classification contract. | None |
| RES-05 | b | `specs/result-demo-path.md` is a proposal: RD-1 to RD-5 and production prerequisites are unsigned (plan §12.16). The kernel has no demo-path output; only coordinator text asks for one (`SKILL.md:67`). Secondary: d (command-source, proposal/idempotency, screenshot transport), e. | Review and sign the concrete result contract. | None |
| GIT-09 | b | `specs/shared-files.md` S1 and S3 are unsigned (only S2 SF-21-24 is approved). Reconcile-by-ID, same-ID collision detection and merge proposal are S1/S3 behavior. Secondary: d (ID-aware integration), e. | Sign S1 and S3, then implement vertical slices with real Git conflict tests. | None |
| CON-07 | b | `specs/reconstruction.md` is "Awaiting owner decisions. No code before sign-off". Secondary: d (open/inspect/adopt/fence wiring; the inherited parser prototype is not accepted), e. | Owner decisions in §13 of that spec, then sign-off. | None |
| CFG-01 | b | `specs/config-completion.md`: design v3 (§14) and the binding protocol (§16, §18) are unreviewed as a whole; "final implementation sign-off pending". Needs the `interpreted` read-back, `config-confirm`, and skill routing (V1-V3). Secondary: e (`decisions/simple.ts`, `pipeline-mutate.ts` are central), d. | Final combined configuration/migration review and sign-off. | None |
| CFG-03 | b | Same sign-off. `config.test.ts` genuinely covers resolution for the layers that exist, but §7.4 also requires the user-local layer (needs SP-02, host evidence), a conflict report for a command defined differently in two sources (V5), and the rule that a project command never discharges a non-equivalent shared obligation (SEC-04). Tagging now would claim §7.4 is resolved when three parts are not built. Secondary: c, d. | Sign-off, then V5 (conflict limit naming both sources) with permuted-discovery tests; user layer after SP-02. | None; no tag |
| CFG-04 | b | Same sign-off. `inspect --view settings --topic` returns value, source, adoption state, overridden values and limits and is tested under `[CFG-05]`. Remaining per spec: `enforcement` per setting (V4), layer-labelled revision, and the coordinator routing for "why <setting>" (`SKILL.md:88` maps "why …?" to `inspect why`, the contract verdict). Secondary: e. | Sign-off, then V3/V4. | None |
| CFG-08 | b | Same sign-off, and the spec itself says only the project-local half is provable before SP-02. A byte-search test (E8) would pass today while a known leak path stays open: `decide overview` free-text preferences become the shared `INTENT.md` OVERVIEW list, and the fix (E9, preview text in `decisions/adopt.ts`) is central code with 37 characters free. Tagging E8 alone would hide that path. Secondary: e, c (personal layer, SP-02). | Sign-off and a central-ceiling decision for E9; E8 and E9 land together. | None; no tag |
| RSC-08 | d | No qualification table exists in the descriptor. `ModelRecord.qualification` is always `unknown` (`core/state.ts:47-48`); TS §4.8 says the Deep warning "is not built for the same reason". With an empty table the warning would fire on every Deep entry. The table comes from golden-suite campaign results (§6.4.4). Secondary: c (campaign), e (Deep entry is central). | Qualification-table schema and shipped data from an authorized campaign. | None |
| LFC-01 | c | Release-time practice: SemVer bump chosen against PRD §6.5. A test that `plugin.json` and `KERNEL_VERSION` are valid and equal would be true now (`0.1.0-m0`) but does not distinguish "versioned against the compatibility contract"; it would be the tag-to-inflate pattern. No release has been cut. Secondary: d. | First tagged release with a recorded bump rationale per contract item. | None; no tag |
| LFC-02 | d | No release-notes mechanism or template exists, and `.github/workflows` has only `untrusted.yml` (no release workflow). TS §18 item 3 lists the contents; the format and location are unspecified. Secondary: c. | Decide where release notes live (file or GitHub Release) and add a generator or checklist that enumerates the six disclosure items. | None |
| QLT-05 | d | Tech Spec §12.7: kernel workload obligation, receipt, baseline, trend and attention consumers (`fitness-trend-degraded` exists only as a reason code) are unimplemented. The starter workload tooling is local-only and its supported-runtime acceptance currently fails (plan §12.16). Secondary: c, e. | Reviewed workload-receipt contract, then red-first trend tests. | None |
| QLT-11 | b | `specs/trait-detection.md`: behavior and the schema 2 addition are owner-signed, but implementation waits for independent review, budget measurement and the complete schema 1 to 2 migration design. Needs a trait registry and persisted change traits (schemas 528, store 214 free). Secondary: d, e. | Finish the combined migration review; measure the whole target. | None |
| QLT-13 | d | The threat-and-data note needs change traits (QLT-11) to know when it applies, a recorded note shape linking each security item to a test or constraint (E20, `trait-threat-data.test.ts`), and the `threat-note.md` review resource named in TS §5.1, which is not shipped. Secondary: b (QLT-11 dependency), e. | Implement after QLT-11. | None |
| ENG-05 | c | Monthly native-host suite on the exact tuple; needs host/account access and separate spike authorization. A known conflict is logged: PRD requires the full suite, TS §17.5/§18 says smoke (plan §12.6.3). | Authorize and run the host suite; resolve the PRD/TS wording first. | None |
| ENG-07 | d | The §5.9.2 chain needs a protected branch, signed tag, provenance attestation and installed-artifact verification. Only the "build inputs" link has a test (action pinning, tagged `[ENG-10]`/`[AC-28]`), and `verify:reproducible` covers part of "produced artifact". No release workflow, no signing, and `inspect doctor` does not yet verify the installed payload (TS §18). Secondary: c. | Release workflow with provenance, then an independent rebuild and a signature check. | None |
| ENG-08 | d | No `eval/experiments/` manifests and no experiment tool exist (TS §17.8). Needs live baseline-versus-candidate runs with a holdout. TS §17.8's allowlist omits PRD §6.10.1's configuration/default surface (plan §12.6.3), an owner decision. Secondary: b, c. | Resolve the allowlist discrepancy; build the allowlisted experiment tool; run one frozen experiment (separately authorized). | None |
| ENG-09 | b | Plan §12.3 (2026-10-31) records that the PRD names fields without a versioned trace contract: event placement, correlation, missing-value vocabulary, action/permission/check taxonomy, termination mapping and retention/export are undecided. The journal call record today holds `verb`, `exit`, `revision` only (`adapters/store-fs.ts:31`). Secondary: e (store 214 free), d. | Owner records the trace contract choices. | None |
| ENG-11 | c | Practice, not code: a 72-hour public review window on an open PR with release-note disclosure. `SECURITY.md` states the rule; no release notes exist, and the evidence is real pull requests. A document test would prove the sentence exists. Secondary: d (release notes). | Operate the rule on the first change to executable content; record it in the release notes. | None; no tag |
| OSS-01 | b | `CONTRIBUTING.md` says `PLACEHOLDER-CODE-OF-CONDUCT`; `SECURITY.md` has `PLACEHOLDER-SECURITY-CONTACT`, `PLACEHOLDER-REPOSITORY-URL` and `PLACEHOLDER-SUPPORTED-VERSIONS`. The policy for supported versions is in PRD §5.9.2, but Q-09 (naming release and security owners) and Q-13 (distribution identity) are open. A code of conduct needs an enforcement contact. LICENSE, NOTICE (attribution) exist. | Owner supplies the conduct code choice and contact, the security contact, and the repository URL; then add a no-placeholder test. | None. Filling only the supported-versions text would leave the requirement unmet and would not be mapped. |
| NFR-01 | d | §4.4.3 budgets are measured "on the frozen reference fixtures" (AC-19: small, large, long-history). Those fixtures and the benchmarks do not exist (`tools/bench-inventory.ts` covers inventory only). Several budgeted pieces are not built: the repository map, aggregate `.tenet/` eviction (storage-retention is partial). Lint already enforces the token budgets. Secondary: c (reference hardware), e. | Define the three fixtures and a latency/size harness; finish eviction. | None |
| NFR-05 | b | The kernel has call durations and gaps (TS §8.6); it cannot observe provider, network or user-wait time separately, and the report shape (how unknown values appear, where the fields go) is unspecified. Plan §12.17: "partial coverage but lacks provider/tool/network separation". Secondary: e (`core/budget` 64, render is central), c. | Owner decides the report fields and the "unknown" convention. | None |
| NFR-07 | d | No diagnostics export exists. TS §16 specifies a previewed, redacted export saved only to a chosen path, mapped to the OpenTelemetry subset (ENG-06). Redaction (`core/redact.ts`) exists. A new verb or view is central code. Secondary: b (export schema, retention), e. | Spec the export contents and verb; add a central increment or a replacement. | None |

## Candidates considered and not implemented

- **CFG-03 tag:** `config.test.ts` tests are real but cover resolution only for the existing layers. Three §7.4 parts are not built, so a tag overclaims.
- **CFG-08 byte-search test (E8):** passes today but leaves the `decide overview` preference path open, and the E9 fix is ceiling-blocked.
- **LFC-01 version-consistency test:** true now, but not specific to the requirement.
- **AGT-10 coordinator sentence:** the loop already hides specialist lifecycles; a sentence and a text test would prove nothing about host behavior.
- **OSS-01 supported-versions text:** policy text is settled in PRD §5.9.2, but the requirement needs the code of conduct and contacts, which need the owner.

## What ran and what did not

Ran on this Windows host, on the unchanged tree: `npm run typecheck` (clean), `node tools/lint-arch.ts` (112 files, no problems), `node tools/lint-skills.ts` (5 skills, no problems), `node tools/lint-quality.ts` (no problems), `node tools/coverage.ts --milestone R1` (181 Musts, 139 mapped, 16 host-only, 26 unmapped), and `node --test` on `config.test.ts`, `release-checklist.test.ts` and `readme.test.ts` (22 pass, 0 fail).

Not run: `npm run ci`, the build, payload and reproducibility checks, and the mutation/process suites (the kernel refuses mutating verbs on win32; macOS/Linux CI is the real validation). Nothing was changed, so no new test or UAT was needed. The classifications are from reading specs and source; host behavior is unobserved.

## Decisions the owner needs, in order of unblocking value

1. Final sign-off for the combined configuration/migration/trait design (unblocks CFG-01/03/04/08, QLT-11, then QLT-13).
2. A central-capacity decision (fixed budgets are unchanged here): AGT-12, CFG-08 E9, NFR-07 and RSC-08 each need central code.
3. Sign-off for shared-files S1/S3, reconstruction, sealed baseline and the result-demo contract (GIT-09, CON-07, EVD-04, RES-05).
4. Trace contract (ENG-09), report fields (NFR-05) and probe/cache contract (INS-05).
5. Conduct code, contacts and repository URL (OSS-01; Q-09, Q-13).
6. Resolve the PRD/TS wording conflicts for ENG-05 and ENG-08.
