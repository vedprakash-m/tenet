# Specification: Configuration Completion (CFG-01, CFG-03, CFG-04, CFG-08, CFG-09, CFG-10)

> Status: Reviewed 2026-10-24 (fresh-context subagent: 15 findings, 3 blockers; each blocker re-checked in code; dispositions in §11). **§12 (v2) supersedes §2 to §10 where they differ.** Awaiting owner decisions (§13). No code before sign-off. Date: 2026-10-24 | Decision owner: @vedprakash-m.
> Sources: PRD CFG-01 to CFG-11 (lines 924-935), §7.1-7.9, AC-23 (§7.8); tech-spec §5.1 (skills), §7.2, §7.8, §8.5; ux-spec §8 (lines 521-556); plan line 436 (settings catalog entry) and §3 SP-02.

## 1. Outcome

A user can change a setting in plain words, see the interpreted value and scope and what it changes for work already under way, ask "why <setting>" or "what have I set?", and rely on four properties that are tested rather than assumed: resolution follows PRD §7.4, personal settings never reach a shared file, Tenet never rewrites another tool's instruction files, and saying the same thing twice changes nothing. What cannot be built before the host spike SP-02 (where personal preferences can be written, which instruction file the host loads) is listed as open, with no stand-in.

**Verification:** drive the built kernel on a scratch repository through each example in §4; compare responses and stored documents.

## 2. Current state (inspected 2026-10-24)

What exists (`core/config.ts`, `decisions/simple.ts:174`, `verbs/inspect.ts:100`, `core/policy.ts`, `verbs/reconcile.ts`):

- A typed catalog of the 12 PRD §7.3 settings with default, kind and allowed scopes (`config.ts:18-32`). Scopes in code are `task` and `project` only.
- Resolution: preferences take the most specific source (task, then project, then default); restrictions only add (union of protected paths, exclusion kinds merged per pattern, required checks by ID with a conflict limit, strictest dependency field, commands per name with the project winning) (`config.ts:60-125`).
- `decide config` sets or resets a value for the task or the project; a repeat with the same value makes no revision (`simple.ts:174-196`; `settings.test.ts:33`). It applies at once; there is no interpretation read-back and no confirmation.
- `inspect --view settings [--topic <key>]` returns the effective value, source, adoption state, overridden values, contributions, limits and "how to change it", plus a document-wide `revision` (`config.ts:104-135`, `inspect.ts:100-106`; `settings.test.ts:65`).
- `tenet.policy.json` is parsed strictly, compared field by field, tightening applied at once, loosening held for acceptance (`policy.ts`, `trust.ts`, `reconcile.ts:21-39`). Tenet records its adoption but never writes the file.
- Shared files Tenet writes: `INTENT.md` (`decisions/adopt.ts:160`), lockfiles (`decisions/dependency-job.ts:29`) and recipe scaffold files (`adapters/project-fs.ts:39`). No code writes an instruction file; the charter is read only (`core/charter.ts`).

What the six requirements still lack:

| Req | Gap, with evidence |
|---|---|
| CFG-01 | (a) "show the interpreted value and scope before saving": `decide config` returns `{setting, scope, value, changed}` after writing (`simple.ts:185-196`). (b) The coordinator skill has no row for changing, listing or explaining a setting; "be brief, explain more" says only "Change presentation for this task" and names no kernel call (`plugin/skills/tenet/SKILL.md:81`); `decide config` appears only in the decision-kind list (line 16) and `inspect settings` is not mentioned. (c) The user scope is absent from the catalog (`config.ts:12`): UX-D3 says style, check-ins and resource use save "for you in every project"; code saves them for the project (plan 2026-10-19 decision). |
| CFG-03 | The pure resolution is built and tested by `config.test.ts` but carries no `[CFG-03]` tag, so coverage lists it unmapped. Not built: the user-local layer (SP-02); a conflict report for a command defined differently in two sources (`config.ts:92-100`: the project's wins silently; today every command is stored-only and blocks execution, `config.ts:123`, so the effect is inert); the §7.4 rule that a project command never discharges a shared obligation with a non-equivalent command (needs execution envelopes, SEC-04). |
| CFG-04 | `inspect settings --topic` answers it, but (a) the coordinator is told "why …?" means `inspect why`, the contract verdict (`SKILL.md:84`; `inspect.ts:81`); `/tenet why` in the README is the same; (b) `limits` is empty for settings with no kernel consumer: `resource_mode` is not consulted by any code, `style` and `checkpoints` are only handed to the coordinator (`settings.test.ts:91`), so "why resource_mode" implies enforcement that does not exist; (c) the revision is the whole document's counter, not the revision of the layer that set the value (PRD §7.5.2); (d) `overridden` is empty for restrictions although the sources are listed in `contributions`. |
| CFG-08 | True today by construction (no code path copies `config.local` into a shared file) but unproven and unguarded: no test, no lint rule. One path is not covered by construction: `decide overview` takes free-text `preferences` that become the "Preferences" list in the `INTENT.md` `OVERVIEW` block (`decisions/overview.ts:10`, `core/intent-md.ts:60`); a coordinator could file a personal preference ("be concise") there. The adoption preview names block IDs, not their text (`adopt.ts:150`). |
| CFG-09 | True today (nothing writes an instruction file; hooks and plugin files of others are never touched) but untested. The PRD §7.9 rules that need the host are unbuilt: writing the charter into the instruction file the host loads (SP-02), reporting a visible conflicting rule only when it affects current work, adopting an equivalent host capability. |
| CFG-10 | `decide config` compares the held value with `JSON.stringify` (`simple.ts:192`, no normalization), so re-saying a list in another order, or with a repeat, makes a new revision although the lists are the same set: `protected_paths ["a","b"]` against `["b","a"]`, an exclusion's `kinds` order. Other decisions (`adopt` "up to date", `overview`, `decision-record`) have their own same-value checks and are outside this requirement. |

Not in scope but seen: PRD §7.5 item 6 (restriction-only safe revision), AC-23 item 12 (symlink and case-variant matching, checked elsewhere under SEC-08/CFG-11) and per-restriction revision history have no code or tag in the settings path; they belong to CFG-11/CFG-05 follow-ups and are listed in §9 as open, not specified here.

## 3. Requirements

| ID | Requirement | Req |
|---|---|---|
| CC-1 | `decide config` returns an `interpreted` read-back: key, value, scope, the effective value before and after, which running contracts it affects and from when (PRD §7.6 table), and how to undo. The coordinator shows it in the same reply as the save. | CFG-01 |
| CC-2 | A project-scope change that loosens an effective restriction or commitment (removes or narrows a protected path, exclusion kind, required check, or relaxes a dependency field) is previewed by a `config-confirm` question bound to the exact change; nothing is written until it is answered. Tightening and preferences save at once with the read-back. | CFG-01, §7.6 |
| CC-3 | The `tenet` skill (resource `config.md`, TS §5.1) maps plain requests to kernel calls: "be brief" (task scope), "always/here" (project scope), "what have I set?" (`inspect settings`), "why <setting>" (`inspect settings --topic`), "undo that setting" (reset). `inspect why` stays the contract verdict. | CFG-01, CFG-04 |
| CC-4 | `inspect settings --topic` states for each setting whether the kernel enforces it, only hands it to the coordinator, or has no consumer yet (`resource_mode`), and reports per source the revision at which it was set. | CFG-04 |
| CC-5 | Tests tagged `[CFG-03]` prove AC-23 items 1, 2, 4, 7 and 15 end to end through `decide config` and `open`; a command defined differently in two sources is reported as a limit naming both sources. | CFG-03 |
| CC-6 | A structural test proves no shared-file writer reads `config`; `lint-arch` gains a rule that `decisions/adopt.ts` and the other shared-file writers import nothing from `core/config.ts`; the `adopt intent` preview shows the `OVERVIEW` text, preferences included, and the skill states that personal settings are not overview preferences. | CFG-08 |
| CC-7 | A test runs a full loop on a repository holding `AGENTS.md`, `.github/copilot-instructions.md` and another plugin's directory and proves their bytes and permissions unchanged; the skills and agents name only `tenet*` entry points (`lint-skills`). | CFG-09 |
| CC-8 | `decide config` compares set-like values (lists of paths, exclusion kinds, required-check IDs) as sets, so a reorder or repeat makes no revision; the stored order is the user's. | CFG-10 |
| CC-9 | Items needing SP-02 are written into the plan as open with their entry condition: user scope and its storage (`style`, `checkpoints`, `resource_mode`, `integration`, `exclusions` at user scope), the charter write, instruction-file precedence, conflicting-rule reporting. None is simulated. | CFG-01/03/08/09 |

## 4. Behavior as examples (test ownership)

| # | Example | Test file |
|---|---|---|
| E1 | "Never touch migrations/" as `protected_paths` at project scope: response `interpreted` says "Changes to migrations/** need your permission", before/after lists, and "applies from the next step" if a contract is open; one revision. | `settings.test.ts` [CFG-01] |
| E2 | Removing a protected path from the project: first call returns exit 3 with `config-confirm`; no state change; the matching answer writes; a stale answer after another edit is refused. | `settings.test.ts` [CFG-01] |
| E3 | "Be brief" for this task: task scope, no revision of the document, `interpreted.scope = task`. | `settings.test.ts` |
| E4 | Skill table contains rows for set, list, why-setting and undo-setting; each kernel call it names exists. | `tools.test.ts` + `tools/lint-skills.ts` |
| E5 | `inspect settings --topic resource_mode` states "recorded; no consumer yet". `--topic style` states "followed by the coordinator; not enforced by the kernel". `--topic protected_paths` shows each source and revision. | `settings.test.ts` [CFG-04] |
| E6 | Shared file with `protected_paths: ["a"]`, project adds `["b"]`: effective `["a","b"]`, contributions show both, `overridden` empty; task scope refuses `protected_paths`; an empty project list removes nothing. | `config.test.ts` [CFG-03] |
| E7 | Same `commands.test` argv differs in shared and project: limit names both sources. | `config.test.ts` [CFG-03] |
| E8 | Full loop with personal `style: concise` set: afterwards `INTENT.md`, `tenet.policy.json` and every committed file contain no settings text. | `settings.test.ts` [CFG-08] |
| E9 | `decide overview` with `preferences: ["be concise"]` then `adopt intent`: the preview text includes "be concise" under the overview; declining writes nothing. | `adopt.test.ts` [CFG-08] |
| E10 | Instruction files and another plugin's folder byte-identical after open, basis, check, finish. | `coexistence.test.ts` (new) [CFG-09] |
| E11 | `protected_paths ["a","b"]` then `["b","a"]` and `["a","a","b"]`: `changed: false`, revision unchanged. `exclusions` kinds reordered: same. | `settings.test.ts` [CFG-10] |

## 5. State and contract changes

- No new state fields for CC-1 to CC-9 except the `config-confirm` question in `pending` (existing array) and, for CC-4, a `config.revisions: Record<key, number>` (D-4 if the owner wants per-setting revisions; otherwise the layer's `config.revision` is used and the response says "layer revision").
- `decide config` response gains `interpreted`; existing fields stay.
- `inspect settings --topic` gains `enforcement: "kernel" | "coordinator" | "none"` and per-source `revision`.
- One new resource file `plugin/skills/tenet/resources/config.md` and a row in `tools/lint-skills.ts` `RESOURCE_BUDGET`; `plugin/skills/tenet/SKILL.md` is at its 4,000-token budget (15,977 bytes), so it gains only a pointer line by removing an equal amount.
- One `lint-arch` rule. No change to `verdict.ts`, `budget.ts`, the pipeline, or the closed vocabularies other than the new question id `config-confirm`.

## 6. Alternatives considered

| Option | Behavior | For | Against |
|---|---|---|---|
| A. Skill text only | Tell the coordinator to read back and confirm | no kernel change | cooperative only; PRD says never claim more than the mechanism gives; a skipped read-back loses "never touch" strength |
| B. Read-back always, confirm only loosening (this draft) | Kernel returns the read-back; one bound question for loosening | the fidelity risk is highest for restrictions; matches UX "applied at once" for the rest | one new question id; loosening detection must be exact |
| C. Confirm every durable change | One question per project save | simplest rule | contradicts UX §8.1 and CFG-07 "without re-asking" |
| D. Separate preview verb | `inspect` a proposed change, then `decide` | read-only preview | extra call every time; two ways to write |

**Recommendation: B.** For CFG-10: compare as sets (CC-8) rather than sort on write, so the user's order is kept.

## 7. Risks

- Loosening detection misses a case (for example a glob replaced by a broader one). The kernel has no implication solver (`policy.ts` header); a changed glob counts as loosening the old one, so the rule errs toward asking.
- The skill budget is full; a resource file adds loaded tokens against `LOADED_BUDGET` 12,000.
- `config-confirm` adds a pending question that fences dependent mutations like the others; a forgotten question blocks work. It follows the existing `adopt-confirm` pattern (`adopt.ts:82-102`).
- Enforcement labels must stay true as consumers are added (RSC-05): the label comes from one table next to the catalog, tested.

## 8. Assumptions

- A1: "show before saving" is met by a read-back in the same reply for preferences and tightening, and by a question for loosening (UX §8.1 governs the wording).
- A2: Until SP-02, durable preferences go to the project (plan 2026-10-19 decision) and the reply says so rather than "for you in every project".
- A3: `[CFG-03]` coverage by existing tests needs only tags and the gaps in §3.

## 9. Acceptance criteria and open items

Acceptance: every example in §4 passes; `npm run ci` green; built-bundle UAT of E1, E2, E5, E11 on a scratch repository; coverage maps CFG-01/03/04/08/09/10.

**Open, documented, not built (need SP-02 or later work):** user-scope preferences and their file; the charter write and instruction-file precedence; conflicting-rule reporting and host-capability adoption (CFG-09 second half); command-versus-obligation equivalence (SEC-04); restriction-only safe revision (§7.5.6); per-restriction revision history; case and symlink matching for settings paths (AC-23 item 12).

## 10. Decisions for the owner (one at a time)

- **D1.** Approach B (recommended), or A, C, D for CFG-01?
- **D2.** Is "loosening" confirmation enough, or must tightening also be confirmed (PRD "durable or consequential")?
- **D3.** Resource `config.md` under the `tenet` skill (TS §5.1), or free budget inside `SKILL.md`?
- **D4.** Per-setting revisions (new `config.revisions`) or report the layer revision?
- **D5.** CFG-08 guard: lint rule plus the overview preview (recommended), or a runtime check only?

## 11. Independent review: findings and dispositions (2026-10-24)

| # | Sev | Finding | Verified | Disposition |
|---|---|---|---|---|
| 1 | Blocker | §2 was wrong that the skill has no routing: `SKILL.md:16` already explains `decide config` (task vs project scope, reset) and `inspect --view settings [--topic]` as the answer to "why <setting>". Real gaps: line 81 ("be brief" names no kernel call), line 84 ("why …?" maps only to `inspect why`), no "what have I set?" or "undo that setting" row, no read-back instruction. | yes (the author's first search was incomplete) | **Accepted.** CC-3 shrinks to editing lines 81 and 84 plus two rows and one read-back sentence, paid for by shortening line 16. No resource file. |
| 2 | Blocker | `adopt-confirm` fences nothing: `fence()` blocks only `quarantine-review`, `takeover-check` and a running job (`pipeline-mutate.ts:24-41`). The draft's fencing and "forgotten question blocks work" were invented. E2's "no state change" is wrong (the question is stored in `pending`). `decide config` needs a work handle. | yes | **Accepted.** v2: `config-confirm` does not fence (like `adopt-confirm`), is replaced by id on a new config call, and binds `factsHash({key, scope, value, heldBefore})`. A stale or missing answer applies nothing. Because the confirmation is therefore cooperative at the coordinator, the spec says so and does not claim kernel enforcement of the user's consent beyond the bound answer. |
| 3 | Blocker | `checkpoints` has a kernel consumer (`pipeline-render.ts:75-79`, check-in cadence for active time). Only `style` is coordinator-only; `resource_mode` has none. | yes | **Accepted.** Three labels (kernel, coordinator, none) over a table covering all 12 settings, each entry verified against code at implementation. |
| 4 | Major | CC-8 incomplete: `commands` is a record, `argv` order matters, `required_checks` hold arrays, `exclusions` are objects; `policy.ts` already has set comparators. | yes | **Accepted.** CC-8 reuses `comparePolicy`/`stableStringify`; `argv` is never set-compared; `changed:false` keeps the stored order. |
| 5 | Major | "Loosening" must be effective, not local, and computable purely; `changed` kinds and `commands` need a rule; task scope cannot loosen; an open contract's `scope.protected` is a snapshot. | yes | **Accepted.** Loosening = `comparePolicy(effectiveBefore, effectiveAfter)` has a `loosened` or `changed` entry; cited PRD §7.4, §7.6. Implemented as a pure function in `core/`. |
| 6 | Major | `LOADED_BUDGET` counts skill bodies, not resources; an unlisted resource has no cap; lint rules on words (`enforces`, `prevents`), verb parsing, ambiguous-word rows. | yes | **Accepted.** Moot after #1 (no resource); the lint constraints are listed for the wording work. |
| 7 | Major | No closed vocabulary for question ids; the cooperative boundary must be stated. | yes | **Accepted** (see #2); the `SKILL.md` answer line and "never answer this gate for the user" wording are required and budgeted. |
| 8 | Major | The `lint-arch` rule is vacuous (the leak is through state, not imports); E8 cannot test a *personal* preference before SP-02. | yes | **Accepted.** Lint rule dropped. CFG-08 is proved by a byte-search test (seed a recognizable value, search every shared file Tenet writes: `INTENT.md`, lockfiles, scaffold output) and the overview-preview test. Stated honestly: before SP-02 only the project-local layer exists, so CFG-08 is **partly provable**; the personal half stays open. Adopt prompt text changes; existing adopt preview assertions are listed for update. |
| 9 | Major | PRD CFG-01 / §7.5.1 say a durable change shows the interpreted value and scope *first*; a read-back after saving for preferences and tightening contradicts the text rather than interpreting it. UX §8.1 and CFG-07 (Should) allow "without re-asking" for explicit "always" corrections only. Option C was dismissed on a Should; D was a strawman. | yes | **Accepted.** v2 stops calling B compliant. It is presented as a **spec amendment decision** (D1): either (C) a preview for every durable change (PRD-compliant, one extra answer), or (B) PRD/UX amended so that a preference or tightening saved on an explicit "always" is shown in the same reply, and only loosening is asked first. The recommendation is B with the amendment logged in plan §12.3, because UX-D3 and CFG-07 already describe that behavior and the PRD wording is the outlier. |
| 10 | Major | SP-02 classification: restriction-only safe revision (§7.5.6, AC-23 item 13) is buildable now and must not hide under "seen"; AC-23 item 12 needs its real owner test cited. | yes | **Accepted.** Item 13 becomes a separate listed gap with no SP-02 dependency and a recommendation to take it next (D6); item 12 is cited as open until its test is found. |
| 11 | Major | AC-23 coverage was overstated. Existing: 14, 15 covered; 1, 2, 3, 4, 5, 6, 7 partial; 8, 10, 11, 12, 13, 16 none; 9 partial. | yes | **Accepted.** §12.3 maps each item to an existing test, a new test or an explicit open entry. |
| 12 | Major | `npm run coverage` runs milestone M0, and CFG release-B IDs are checked only by `--milestone B`; one tag maps a requirement. | yes | **Accepted.** Acceptance names `node tools/coverage.ts --milestone B`; tags are necessary, not sufficient, and only proving tests are tagged. |
| 13 | Minor | Budget ceiling for pipeline+verbs+decisions; 250-line file cap (`simple.ts`); pure functions in `core/`; wording owner; response-shape callers (`tools/uat/uat.mjs`, golden tasks); `Resolved` change; "no new state fields" contradicted by `config.revisions`; task and shared sources have no revision. | yes | **Accepted.** Pure code in `core/config.ts`/`policy.ts`; the kernel returns facts (values, before/after lists, affected contracts) and the coordinator words them; callers are listed in §12.4; per-source revision is dropped (D5): the response reports the layer's revision only and says task and shared sources have none. |
| 14 | Minor | Line citations: `adopt.ts:82-102` is imprecise (73-94); `config.ts:104-135` mislabeled; `project-fs.ts:39`/`scaffold.ts:110` are the scaffold writers. | yes | **Accepted**; corrected in §12. |
| 15 | Minor | CC-3 and CC-7 have no behavioral test (lint is structural; the "tenet*" lint already exists); the "free budget inside SKILL.md" alternative is a strawman. | yes | **Accepted.** CC-3 is marked host-unobserved; CC-7 keeps the byte-identical test only; D3 is removed. |

## 12. Revised scope, v2 (supersedes §2 to §10 where they differ)

### 12.1 Corrected current state
The skill already explains `decide config` and `inspect --view settings` (`SKILL.md:16`); lines 81 and 84 contradict or omit them. `checkpoints` is consumed by the kernel (`pipeline-render.ts:75-79`), `style` by the coordinator, `resource_mode` by nothing. `config-confirm` would follow `adopt-confirm`: stored in `pending`, never fencing (`pipeline-mutate.ts:24-41`). All other §2 facts stand.

### 12.2 Requirements

| ID | Requirement | Req |
|---|---|---|
| V1 | `decide config` returns facts for the read-back: key, scope, value, the effective value before and after (`resolveSetting`), whether open contracts are affected and from when (a loosening does not change an open contract's `scope.protected` snapshot; a tightening applies at the next dispatch), and the layer revision. The coordinator words them. | CFG-01 |
| V2 | Confirmation, by the owner's decision D1: **B** (recommended) a project-scope change whose effective result loosens or changes a restriction or commitment (`comparePolicy(before, after)` has a `loosened` or `changed` entry; all `commands` changes count) returns `config-confirm`, bound to `factsHash({key, scope, value, heldBefore})`, replaced by id on a newer call, not fencing; preferences and tightening save with the read-back; or **C** the same question for every durable change. Task scope never loosens (`validateSetting` refuses commitment keys). | CFG-01, §7.4, §7.6 |
| V3 | Skill edits (paid for by shortening line 16): line 81 "be brief" calls `decide config` at task scope; line 84 sends "why <setting>" to `inspect --view settings --topic` and keeps "why …?" about work on `inspect why`; add "what have I set?" (`inspect --view settings`) and "undo that setting" (reset); one read-back sentence; the `config-confirm` answer line and "never answer this gate for the user". Wording avoids lint-skills' blocked words and the ambiguous-word rule. Host routing is unobserved. | CFG-01, CFG-04 |
| V4 | `inspect settings --topic` adds `enforcement` from one table covering all 12 settings (kernel, coordinator, none) and the layer revision; `resource_mode` says "recorded; nothing consults it yet". | CFG-04 |
| V5 | Tests tagged `[CFG-03]` and a command conflict reported as a limit naming both sources (inert today: every command already blocks, `config.ts:123`). Per-item AC-23 mapping in §12.3. | CFG-03 |
| V6 | CFG-08: byte-search test over every shared file Tenet writes; the `adopt intent` preview shows the OVERVIEW text; the skill says personal settings are not overview preferences. Only the project-local layer exists before SP-02, so this is **partly provable**; the personal-layer half is open. No lint rule. | CFG-08 |
| V7 | CFG-09: byte-identical `AGENTS.md`, `.github/copilot-instructions.md` and a fixture directory of another plugin (files with fixed bytes and mode 0644) after `open`, `basis`, `check`, `finish`. The second half stays open (SP-02, host). | CFG-09 |
| V8 | CFG-10: compare with the existing `comparePolicy`/`stableStringify` set semantics (lists as sets, record keys unordered, `argv` order significant, `alternatives` as sets); a reorder or repeat gives `changed:false` and keeps the stored order. | CFG-10 |
| V9 | Open and documented, no stand-in: user scope and its storage (`style`, `checkpoints`, `resource_mode`, `integration`, `exclusions`), charter write and instruction-file precedence, conflicting-rule reporting and host-capability adoption, the personal half of CFG-08, and (not SP-02) restriction-only safe revision (§7.5.6, AC-23 item 13), AC-23 items 8, 10, 12, 16 and command-versus-obligation equivalence (SEC-04). | all |

### 12.3 AC-23 mapping

1 partial (`config.test.ts:102`; new test adds shuffled source order for every restriction key); 2 partial (add required check, exclusion); 3 partial (new, all 12 settings); 4 (new for restrictions); 5 (V8 matrix); 6 partial (new: unknown preference key diagnostic through `open`); 7 partial (new zero/empty/`auto`); 8 open; 9 partial (open); 10 open; 11 V6; 12 open; 13 open, buildable, recommended next; 14, 15 covered; 16 open. Tests: `config.test.ts`, `settings.test.ts`, `adopt.test.ts`, `coexistence.test.ts` (new).

### 12.4 Impact
`decisions/simple.ts` (250-line cap; move logic to `core/config.ts`), `core/policy.ts` (reuse), `verbs/inspect.ts`, `decisions/adopt.ts` (prompt text; update assertions in `adopt.test.ts`), `plugin/skills/tenet/SKILL.md` (at budget), `tools/uat/uat.mjs` and the golden tasks (grep response-shape use before change), `lint-quality` ceiling (record the increment; owner pre-approved under 1%). No schema change, no new state field.

### 12.5 Alternatives
**A** skill text only (cooperative, cheapest; leaves PRD wording unmet); **B** facts always, question for loosening (recommended, needs the amendment); **C** question for every durable change (PRD-literal); **D** a `--dry` preview flag on `decide config` (read-only preview, then a second call). For CFG-10: compare as sets, not sort on write.

## 13. Decisions for the owner (review applied, one at a time)

- **D1.** CFG-01 timing: B with a PRD/UX amendment logged (recommended), C (PRD-literal), or D?
- **D2.** Treat all `commands` changes and `changed` required-check definitions as confirm-first (recommended)?
- **D3.** Edit the skill in place by shortening `SKILL.md:16` (recommended); confirm no resource file.
- **D4.** Accept that CFG-08 and CFG-09 are only partly provable before SP-02 and keep the rest open (recommended).
- **D5.** Report the layer revision only, not per-source revisions (recommended).
- **D6.** Take restriction-only safe revision (AC-23 item 13) as the next configuration slice?
