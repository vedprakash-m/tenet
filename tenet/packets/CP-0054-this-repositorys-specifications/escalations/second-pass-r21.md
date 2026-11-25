# CP-0054 Second Pass — Audit and Preparation Plan (Round 21)

Preparation-only audit of [PR #5](https://github.com/vedprakash-m/tenet/pull/5) (`origin/r10/cp-0054`, `93c1a49`) projected onto `origin/main` + `r21/integrity-and-version` (`cd7f277`), building on [audit-r20.md](../../release-0.1.0-alpha.0/audit-r20.md) and [deferred-edits.md](deferred-edits.md). No target specification files are modified here; the Owner reviews this alongside PR #5.

## 1. Why 76 errors (and 2 warnings) remain after PR #5

On current `r21/integrity-and-version` (`cd7f277`), unscoped `node dist/cli.js check --json` reports **118 errors** (`plan.md`: 7, `prd.md`: 47, `tech-spec.md`: 1, `ux-spec.md`: 15, `vision.md`: 48).

Merging PR #5 (`git merge --no-commit --no-ff -X ours origin/r10/cp-0054`, matching [audit-r20.md](../../release-0.1.0-alpha.0/audit-r20.md#cp-0054-projection-and-owner-release-actions)) produces **76 errors, 2 warnings** in `node dist/cli.js check --json`:

| File | Finding summary | Lines | Cause and fix |
|---|---|---|---|
| `tenet/vision.md` | **48 errors**: `1 TN-SPEC-NO-FRONT` (`line: null`), `47 TN-SPEC-MISSING-ID` (`Value` 21–29, `Principles` 35–45, `Horizons` 57–61, `Outcome metrics` 69–80, `Boundaries` 86–95) | null, 21–95 | PR #5 prepared `escalations/vision.patch` (`git apply --check` exits 0), adding front matter and `Origin: asked` columns, left unapplied because only the Owner edits `tenet/vision.md`. |
| `tenet/specs/prd/catalog.md` | **28 errors**: `28 TN-SPEC-REQ-META` | 53–62, 68–85 | Merge conflict with PR #11 (`CP-0039`, updated `R-175` and `R-177` in 6-column format). `-X ours` left 6-column rows (`Decisions` 53–62, `Work items` 68–85) inside PR #5's 8-column `| Origin | Cites |` tables. Taking PR #5's `catalog.md` cleanly drops `catalog.md` errors to **0** (48 total check errors remaining, all in `vision.md`); re-applying PR #11's `R-175` and `R-177` prose with `| asked | |` preserves both PRs. |
| `tenet/specs/tech-spec.md` | **1 warning**: `TN-BUDGET-WARN` (`10,903 / 12,000` tokens, `90.9%`) | null | Crossed the 90% threshold (`10,800`) due to post-PR-#5 `CP-0039` additions (`r17`). Needs `≥ 104` tokens trimmed, plus room for `deferred-edits.md` items #1–#2. |
| `tenet/specs/tech-spec/agents.md` | **1 warning**: `TN-BUDGET-WARN` (`5,416 / 6,000` tokens, `90.3%`) | null | At `5,416` tokens (`5,397` in PR #5 before merge), just over 90% (`5,400`). Needs `≥ 17` tokens trimmed, plus room for `deferred-edits.md` item #3. |

(Note: PR #5 also leaves `tenet/specs/plan.md` at `5,396 / 6,000` tokens [`89.9%`] and `tenet/specs/ux-spec.md` at `5,397 / 6,000` tokens [`90.0%`], within 4 tokens of `TN-BUDGET-WARN`.)

## 2. The 14 split specification files PR #5 has not prepared yet

Currently `tenet.yaml` omits `specs.documents[]`, so `check` discovers only the 5 default ladder files plus files already carrying `tenet: {spec: 1}` YAML front matter (`src/specs/ladder.ts:90`). PR #5 prepared **10** of the **24** active spec documents (`vision.patch`, `prd.md`, `prd/{catalog,decisions,tooling}.md`, `tech-spec.md`, `tech-spec/{agents,kernel}.md`, `ux-spec.md`, `plan.md`) and did not touch the remaining **14** split L2 files.

Parsing those 14 files directly via `parseDoc(..., { prefix: "R" })` on `cd7f277` reveals **77 hidden parse errors** (`14 TN-SPEC-NO-FRONT` + `63 TN-SPEC-MISSING-ID`) plus serious post-front-matter budget pressure on 5 files:

| File | Budget vs 6,000 | Parse errors | What each file needs |
|---|---:|---|---|
| `tenet/specs/plan/0.1.0.md` | 33.5% (2,013) | 1 `NO-FRONT` | Add L2 YAML front matter (`doc: 0.1.0`, `owner: ved`) and section entries/digests. |
| `tenet/specs/plan/0.1.x.md` | 31.4% (1,887) | 1 `NO-FRONT` | Same. |
| `tenet/specs/plan/alpha.0.md` | 86.4% (5,184) | 1 `NO-FRONT`, 16 `MISSING-ID` | Add L2 YAML front matter; resolve 16 bullets containing `{...}` (e.g., lines 8, 35, 81–84) and trim slightly (`5,184` + `sections:` digests approaches `5,400`). |
| `tenet/specs/plan/alpha.0b.md` | 79.0% (4,740) | 1 `NO-FRONT`, 4 `MISSING-ID` | Add L2 YAML front matter; resolve 4 bullets containing `{...}` (lines 28, 29, 41, 43). |
| `tenet/specs/plan/alpha.1.md` | 38.8% (2,326) | 1 `NO-FRONT` | Add L2 YAML front matter. |
| `tenet/specs/plan/alpha.2.md` | 22.6% (1,355) | 1 `NO-FRONT` | Add L2 YAML front matter. |
| `tenet/specs/tech-spec/algorithms.md` | 87.8% (5,270) | 1 `NO-FRONT`, 2 `MISSING-ID` | Add L2 YAML front matter across 17 sections (`~425` tokens for `sections:` digests pushes past `5,400` unless trimmed by `~300+` tokens or rolled over); resolve 2 bullets with `{...}` (lines 38, 142). |
| `tenet/specs/tech-spec/ci.md` | 89.6% (5,375) | 1 `NO-FRONT`, 1 `MISSING-ID` | Trim `~300+` tokens before adding 11 section digests so post-edit stays `< 5,400`; resolve 1 bullet with `{...}` (line 161). |
| `tenet/specs/tech-spec/contracts.md` | 86.2% (5,169) | 1 `NO-FRONT` | Trim `~150+` tokens before adding 15 section digests so post-edit stays `< 5,400`. |
| `tenet/specs/tech-spec/evidence.md` | 55.4% (3,325) | 1 `NO-FRONT`, 4 `MISSING-ID` | Add L2 YAML front matter; resolve 4 bullets containing `{...}` (lines 36, 65, 67, 68). |
| `tenet/specs/tech-spec/health.md` | 42.8% (2,567) | 1 `NO-FRONT`, 7 `MISSING-ID` | Add L2 YAML front matter; resolve 7 bullets containing `{...}` (lines 9, 11–13, 24–25, etc.). |
| `tenet/specs/tech-spec/mcp.md` | 18.4% (1,102) | 1 `NO-FRONT`, 3 `MISSING-ID` | Add L2 YAML front matter; resolve 3 bullets containing `{...}` (lines 10–12). |
| `tenet/specs/tech-spec/messages.md` | 59.2% (3,550) | 1 `NO-FRONT`, 25 `MISSING-ID` | Add L2 YAML front matter; resolve 25 bullets containing `{path}`, `{id}`, etc. (lines 9–11, 85+, mostly template parameter bullets). |
| `tenet/specs/tech-spec/onboarding.md` | 88.8% (5,326) | 1 `NO-FRONT`, 3 `MISSING-ID` | Trim `~150+` tokens before adding 5 section digests so post-edit stays `< 5,400`; resolve 3 bullets containing `{...}` (lines 11, 23, 119). |

**Why the 63 `TN-SPEC-MISSING-ID` findings happen:** In `src/specs/parse.ts:511`, any markdown bullet in a non-governed section containing `{` triggers requirement parsing and emits `TN-SPEC-MISSING-ID` — even when `{...}` is inside inline backticks (e.g., ``- `{path}` ``, `` `kit/workflows/{tenet-tests.yml,tenet.yml}` ``, or JSON schema examples `` `{evaluation_id, run}` ``).

## 3. Additional integration work after PR #5

1. **Apply [deferred-edits.md](deferred-edits.md) (8 edits)** to `tech-spec.md` (#1–#2), `tech-spec/agents.md` (#3), `tech-spec/kernel.md` (#4–#7), and `prd.md` (#8) while keeping every file `< 90%` of its budget.
2. **Declare `specs.documents[]` in `tenet.yaml`:** List all 24 active specification files (with explicit L0/L1/L2 levels and section/budget metadata if needed) so `tenet check` checks the whole specification tree consistently.

## 4. Owner decisions required

1. **Apply `vision.patch` to `tenet/vision.md`:** Confirm PR #5's [vision.patch](vision.patch) (L0 text/format edit adding front matter and `Origin: asked` columns; fixes 48 errors).
2. **`catalog.md` merge resolution:** Confirm keeping PR #5's 8-column `| Origin | Cites |` tables (`Origin: asked`) merged with `CP-0039` PR #11's updated `R-175` and `R-177` rule text (fixes 28 errors).
3. **Handling the 63 `{...}` bullets in L2 technical/plan docs:** Choose one of:
   - *(a) Spec + parser clarification (recommended):* clarify `contracts.md §3` and update `parse.ts:511` so `{...}` inside inline backticks (or prose bullets lacking a trailing un-backticked `{...}` metadata block) does not classify a technical bullet as a requirement missing an ID; **or**
   - *(b) Spec-only pass:* rewrite all 63 technical bullets across the 9 L2 files (`messages.md`, `alpha.0.md`, `health.md`, `evidence.md`, `alpha.0b.md`, `mcp.md`, `onboarding.md`, `algorithms.md`, `ci.md`) to avoid `{` in list items (e.g., paragraphs or tables).
4. **Budget trims vs rollover/overrides on crowded L2 files:** Approve concise wording trims on `tech-spec.md`, `agents.md`, `algorithms.md`, `ci.md`, `contracts.md`, `onboarding.md`, and `alpha.0.md` (and tighten `ux-spec.md` / `plan.md` slightly off `90.0%` / `89.9%`), or split/override budgets in `tenet.yaml` for any file whose content cannot shrink cleanly under `90%` once `sections:` digests are added.
5. **Protected `tenet.yaml` + L2 preparation scope for `CP-0054` second pass:** Authorize editing `tenet.yaml` to register `specs.documents[]` across all 24 spec files and preparing the 14 remaining L2 files in `draft` state ahead of `CP-0057` interactive blessing.
