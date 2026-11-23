# Tenet plan: 0.1.0-alpha.0 build contracts

> Level L2 · Version 0.12 · Part of [plan.md](../plan.md) · Status: **draft, awaiting the Owner's approval; frozen by CP-0015** · Budget: 6,000 tokens · Added in L-0023 · Previous version: `archive/specs/plan/alpha.0.md@0.11.md`

**Context card.** One build contract per alpha.0 packet, in wave order ([plan §2](../plan.md#2-waves)), with the eight fields of [plan §4](../plan.md#4-build-contract). A builder reads its contract, the sections it names and nothing else. If the contract and a specification disagree, the builder stops and escalates; it never chooses. References: **C** = [contracts](../tech-spec/contracts.md), **ALG** = [algorithms](../tech-spec/algorithms.md), **CI** = [ci](../tech-spec/ci.md), **AG** = [agents](../tech-spec/agents.md), **OB** = [onboarding](../tech-spec/onboarding.md), **TS** = [tech spec](../tech-spec.md), **UX** = [ux-spec](../ux-spec.md).

**Every contract also means:**
- module import rules (TS §1); SDK functions take `{cwd, stdin, stdout, now}`
- error codes, exit codes and plain words (C §13, R-083); `--json` envelope and result schemas (C §8); determinism (C §11)
- each command lives in `src/commands/<name>.ts`; the one shared file, `src/commands/index.ts`, gets one import line per command
- tests in `test/<module>/`; algorithm fixtures in `pkg/conformance/alg-<nn>/`
- Proving always includes `npm run lint` and `npm test` passing on Windows, macOS and Linux in CI

## A0-1

**CP-0004 · Schemas for alpha.0** · R-010 (part), R-205, R-206 (agent card schema)
1. *Needs:* CP-0003; C §1–§6, §8, §10; CI §2; TS §6.1.
2. *Owns:* `kit/schemas/` (new: `tenet-yaml`, `lock`, `pack`, `agent-card`, `spec-front-matter`, `inventory`, `interview`, `assignment`, `test-report`, `bundle`, `proof-card`, `board`, `manifest`, and `results/<command>` for each alpha.0 command); `src/core/schema.ts`; `src/types/` (generated); the `gen:types` script entry in `package.json`; `test/schemas/`. Replaces `tenet-profile.json` and `agent.json`; `packet.json` stays until CP-0049.
3. *Exports:* `validate(name, data) → {ok, errors: [{pointer, keyword, message}]}`; `npm run gen:types`.
4. *Behavior:* JSON Schema 2020-12, compiled once with ajv strict and ajv-formats; `additionalProperties: false` plus `patternProperties: {"^x-": {}}`; `schema_version: 1` where C names it.
5. *Edge cases:* an unknown key is refused; an `x-` key is accepted; `board` accepts the alpha.0 subset (C §5).
6. *Out of scope:* kernel records, events, evidence payloads (CP-0049).
7. *Fixtures:* per schema ≥2 valid and ≥3 invalid in `test/schemas/<name>/`, each invalid file named for the keyword it must fail (`invalid-required-owner.json`).
8. *Proving:* `npm test -- test/schemas`; `npm run gen:types` leaves no diff.

**CP-0005 · CLI, core and packaging** · R-048, R-080, R-081, R-083, R-084
1. *Needs:* CP-0003, CP-0002; C §8, §11, §13; TS §1–§2.
2. *Owns:* `src/cli.ts`, `src/sdk.ts`, `src/commands/index.ts`, `src/core/{fs,yaml,git,hash,output,clock}.ts`, `package.json` (except `gen:types`), `.github/workflows/release.yml`, `test/core/`, `test/cli/`.
3. *Exports:* `run(argv, io) → exit code`; `registerCommand(spec)`; `writeAtomic`, `readYaml`, `git(args, {cwd})`, `sha256`, `jcs`, `ulid(now)`, `alias(ulid)`, `result(command, value, errors)`, `fail(code, words, fix)`.
4. *Behavior:* `--version`, `help`; the envelope and exit precedence; human text on stderr under `--json`; `writeAtomic` writes a temporary file in the same folder, then renames; `git` always passes `-c core.quotepath=false`; `--offline` refuses every network call.
5. *Edge cases:* paths with spaces and non-ASCII; backslashes stored as `/`; an interrupted write leaves the old file; an unknown flag exits 2; Node below 22 or git below 2.40 exits 3.
6. *Out of scope:* every command's behavior; `sign` (alpha.2).
7. *Fixtures:* RFC 8785 test vectors; ULIDs monotonic within one millisecond; an alias collision lengthened by one.
8. *Proving:* `npm test -- test/core test/cli`; `npm pack`, then on each platform in an empty folder: install the `.tgz`, `npx tenet --version` prints it, and `node -e "import('@vedprakash-m/tenet')"` succeeds.

## A0-2

**CP-0012 · Kit content** · R-011, R-012 (drafter, spec reviewer), R-016, R-017, R-142, R-171, R-174, R-188 · touches `kit/agents/`, so it runs as an `agent` packet
1. *Needs:* CP-0004; C §2–§4; AG §1–§3; TS §6.2.
2. *Owns:* `kit/templates/` (`intent`, `vision`, `requirements`, `design`, `experience`, `plan`, `pull-request`, `agents-block`, `escalation`), `kit/packs/minimal/pack.yaml`, `kit/skills/{draft-specs,work-a-change,review-with-findings}/SKILL.md`, `kit/agents/{drafter,spec-reviewer}.md`, `kit/defaults/`, `test/kit/`. Old kit files it supersedes are deleted, not edited.
3. *Exports:* the files above.
4. *Behavior:* `agents-block` is AG §1 verbatim, with the AG §3 tagging line per runner; the skills follow AG §2 step for step; templates carry C §3 front matter (with `scope` and `applies_to` examples), a worked example and a completeness checklist; `pull-request` holds the C §2 block; the pack lists stations, lanes express, quick, careful and deep, work types including `explore`, and phases; the drafter card is read-only, the spec reviewer reports advisory findings.
5. *Edge cases:* an empty repository (questions only); a project kind not listed (generic questions).
6. *Out of scope:* the 0.1.0 cards (CP-0022); loops (CP-0020).
7. *Fixtures:* the pack and both cards against their schemas; every template's example passes C §3 parsing (checked again by CP-0009).
8. *Proving:* `npm test -- test/kit`: everything validates; each skill is under 2,000 tokens and the block under 1,500.

**CP-0006 · Policy, levels, kit and lock** · R-050, R-053, R-104, R-109, R-204, R-214
1. *Needs:* CP-0004, CP-0005; TS §6.1–§6.3, §7.1; C §1; OB §2 (`kit_sha256`); ALG-06.
2. *Owns:* `src/policy/`, `test/policy/`.
3. *Exports:* `loadPolicy({ref?})`, `ruleMode(policy, rule)`, `match(selector, change)`, `ownersFor(path)`, `areaFor(path)`, `loadKit(policy) → {path, sha256}`, `verifyLock()`.
4. *Behavior:* validates `tenet.yaml` (including `checks`, `ci`, `stop`, `onboard`, `specs`, `protect`); fills defaults from `level` and the rule registry, capping every rule at `advise` in alpha.0 with a notice; a level not yet available warns `TN-POLICY-LEVEL-UNAVAILABLE` and runs as `observe`; loads the kit from the installed package, or `.tenet/kit/` when `vendored`, and checks `kit_sha256`; `kit_path` (self-hosting) skips the lock; `ref` reads the target with `git show`, and a branch that edits `tenet.yaml` is flagged `TN-POLICY-BRANCH`; owners and areas per ALG-03 and ALG-06.
5. *Edge cases:* no `tenet.yaml` (`TN-POLICY-MISSING`); an unknown rule; a loosening overlay; no CODEOWNERS (the Owner).
6. *Out of scope:* `level` and `rules` commands (CP-0050).
7. *Fixtures:* one repository per level; a branch-edited policy; an edited vendored kit; a loosening overlay.
8. *Proving:* `npm test -- test/policy`.

**CP-0018 · Reports, acceptance and weakening** · R-034 (part), R-172, R-188
1. *Needs:* CP-0005; C §1–§2, §6; ALG-08, ALG-09.
2. *Owns:* `src/reports/`, `test/reports/`, `pkg/conformance/alg-08/`, `alg-09/`.
3. *Exports:* `readReport(kind, path) → TestReport`; `parseAcceptance(body) → {implements, items, digest, problems}`; `declaredTags(base, head) → {acceptance, requirement}`; `itemResults(items, report, tags) → [{id, result, tests, written_in_change, first_failure}]`; `weakening(base, head) → {found, by, not_checked}`.
4. *Behavior:* ALG-08, ALG-09 and C §2 exactly.
5. *Edge cases:* entities and CDATA in names; retries; nested suites; zero cases; two tags on one test; `tenet_AB_1` names; a second tagged test missing from the report; an old `[AB-1]` outside the diff; a call to `init(`; a test moved between files; tests folded into `it.each`.
6. *Out of scope:* running checks; the card (CP-0051).
7. *Fixtures:* the real reports captured by CP-0041, plus one per edge case.
8. *Proving:* `npm test -- test/reports`.

## A0-3

**CP-0044 · Specification formats** · R-207–R-210, R-212, R-213, R-220
1. *Needs:* CP-0006; C §1, §3; ALG-02, ALG-03 (anchors, flags, owner), ALG-04, ALG-14; OB §1 (table form).
2. *Owns:* `src/specs/{parse,sections,citations,anchors,flags,ladder,deltas,touched}.ts`, `test/specs/`, `pkg/conformance/alg-02/`, `alg-04/`, `alg-14/`.
3. *Exports:* `parseDoc(path, text) → {front, sections: [{slug, heading, level, text, digest, requirements, conflicts, questions, applies_to}], problems}`; `parseRequirement(line | row) → {id, text, origin, cites, serves, scope, adopted_by} | problem`; `sectionDigest(text)`; `anchorsFor(section, readFile)`; `resolveCitations(doc, readFile) → findings`; `flags(section, readFile) → ("edited" | "sources-changed")[]`; `matchRenamed(front, sections)`; `ladder(policy) → [{path, level, doc}]`; `deltas(base, head) → [{doc, added, modified, removed}]`; `touched(base, head, implements) → [{id, why}]`.
4. *Behavior:* ALG-02, ALG-03's anchors and flags, ALG-04 and ALG-14 exactly; requirements are list items or table rows (OB §1).
5. *Edge cases:* missing braces (`TN-SPEC-REQ-META`); a duplicate ID across documents (`TN-SPEC-DUP-ID`); a line without an ID ("needs an ID"); a file without front matter (all `draft`, with a finding); `## ` inside a code fence; CRLF; a Unicode heading; lines shifted above an anchor; a cited file deleted.
6. *Out of scope:* `bless` (CP-0052); the `check` command (CP-0009); context (CP-0045).
7. *Fixtures:* ALG-02, ALG-04 and ALG-14 fixtures.
8. *Proving:* `npm test -- test/specs`; every fixture's output equals its expected JSON byte for byte.

## A0-4

**CP-0009 · Check, fix and split** · R-008, R-033, R-038, R-054 (lock mismatch), R-219
1. *Needs:* CP-0044; TS §9–§10; C §1, §13; ALG-02 (rename), ALG-03 (integrity).
2. *Owns:* `src/specs/{check,fix,split}.ts`, the commands `check`, `fix`, `split`, `kit/hooks/pre-commit`, `test/check/`.
3. *Exports:* `check({paths?, pack?, ci?}) → {findings: [{file, line, code, rule, severity, message, fix}]}`; `fix({dryRun}) → {changes}`; `split(doc, section)`.
4. *Behavior:*
   - **Findings:** required files, schemas, links and anchors, citations, origin present, section states and flags, blessed-copy integrity, unique IDs, budgets, kit integrity, and a package version that differs from the lock.
   - **Exit codes** follow C §13: budget is an error only with `--ci` on a change that crosses 100%.
   - **`fix`:** assigns IDs (C §1), writes front matter, section entries, digests and `drafted_from`, moves renamed entries and shifted anchors, and normalizes citation paths. It never changes text, states or blessings.
   - **`split`:** moves a section into a part, leaving a pointer and updated links.
   - The hook warns and never blocks.
5. *Edge cases:* `fix` twice changes nothing; two branches both assigning `R-40` (`fix` renumbers the newer unblessed one; if both are blessed, `check` reports it).
6. *Out of scope:* event and alias checks (CP-0007).
7. *Fixtures:* `test/check/<code>/`, one violation each; a generated 500-document repository for R-082.
8. *Proving:* `npm test -- test/check`: each fixture yields exactly its finding; `fix` repairs every mechanical one; R-082 timing holds.

**CP-0045 · Agent context and MCP** · R-049, R-211
1. *Needs:* CP-0044; C §9; ALG-10.
2. *Owns:* `src/context/`, `src/mcp/`, the commands `context` and `mcp`, `test/context/`, `test/mcp/`.
3. *Exports:* `context(input) → {blessed, drafts, index, omitted, truncated, rules}`; `serveMcp(io)`.
4. *Behavior:* ALG-10 and C §9 exactly, reading blessed copies; `tenet_status` gives the level and spec states; `tenet_next` gives the pending blessings; `tenet_propose` writes `.tenet/proposals/<ulid>.json`.
5. *Edge cases:* nothing blessed ("nothing blessed yet; run tenet bless"); global rules over their reserved share; a blessed copy failing integrity (served as a draft); notifications get no reply; stdout carries only protocol messages.
6. *Out of scope:* writing host entries (CP-0010).
7. *Fixtures:* `pkg/conformance/alg-10/`, including "retry once".
8. *Proving:* `npm test -- test/context test/mcp`; a scripted session matches its golden transcript; the official MCP Inspector CLI lists and calls every tool on Windows (`cmd /c npx`), macOS and Linux.

**CP-0053 · Specification board** · R-032 (alpha.0 part)
1. *Needs:* CP-0044; C §5.
2. *Owns:* `src/views/specs-board.ts`, the `board` command, `test/views/`.
3. *Exports:* `board({all}) → board.json` with `as_of`, `read`, `specs`, `pending_blessings`.
4. *Behavior:* reads the working tree. The markdown groups "waiting for your blessing", "sources changed", "edited" and **spec debt**: citations that don't resolve, blessed requirements with no tagged test, and sections over budget. `--all` adds clean blessed sections.
5. *Edge cases:* no specifications ("run tenet onboard").
6. *Out of scope:* work items, `--open`, `--since`, `--fetch` (CP-0008).
7. *Fixtures:* fresh drafts; half blessed; blessed with sources changed; spec debt.
8. *Proving:* golden `board.json` and markdown byte-identical on three platforms.

## A0-5

**CP-0048 · Onboarding inventory and assignment** · R-021, R-027, R-223 (preflight, inventory, units, assignment, refresh)
1. *Needs:* CP-0009, CP-0012; OB §1; C §4; ALG-11.
2. *Owns:* `src/onboard/{preflight,inventory,findings,assignment,refresh}.ts`, the `onboard` command (without `--card`), `test/onboard/`.
3. *Exports:* `onboard({inventoryOnly, refresh, layout}) → {preflight, inventory, findings, assignment}`.
4. *Behavior:*
   - preflight text as UX Part 1
   - the inventory, its first findings, project kind, units and output paths exactly as OB §1 and ALG-11
   - repository facts byte-identical for one commit; report data only in `observations`
   - refresh keeps IDs, edits, rejections and blessings, and assigns only changed units
5. *Edge cases:* no commit (`TN-ENV-NO-COMMIT`); uncommitted changes; a monorepo; not a git repository (exit 3).
6. *Out of scope:* drafting (the user's agent); blessing and the card (CP-0052).
7. *Fixtures:* `test/onboard/{empty,node-service,python-lib,go-cli,monorepo}`.
8. *Proving:* inventories byte-identical on three platforms; no skipped file in `sources`; layouts and units match ALG-11.

**CP-0051 · Test job, recorder and card** · R-218, R-103, R-146, R-034 (part)
1. *Needs:* CP-0006, CP-0009, CP-0018; CI §1–§4; C §5; ALG-07 (alpha.0: every rule in `advise`), ALG-14.
2. *Owns:* `src/verify/{run-checks,bundle,record,card,records}.ts`, `verify --run-checks`, `--bundle` and `--record`, `kit/workflows/{tenet-tests.yml,tenet.yml,existing-ci-step.yml}`, `pkg/conformance/cards/`, `test/verify/`.
3. *Exports:* `runChecks(policy) → bundle`; `record(event) → {card, conclusion, wrote}`; `renderCard(model) → markdown`.
4. *Behavior:* CI §2–§4 step for step. The card model and order are C §5, built from `parseAcceptance`, `itemResults`, `weakening`, `touched`, `deltas`, `check` and the five alpha.0 rules. `evaluation_id` is per C §1. It reports blessings changed and whether the test workflow differs from the target's.
5. *Edge cases:* no acceptance block; a description edit on the same commit (reuses the bundle); a failing check (items failed, card still posted); a missing report; no blessed specifications (badge `intent-not-yet-blessed`); a fork; a bundle from another run (refused, `TN-RECORD-BUNDLE`); the summary over the size limit.
6. *Out of scope:* decisions, signing, board publishing.
7. *Fixtures:* `workflow_run`, `edited` and `push` payloads; a fake checks API; golden cards.
8. *Proving:* `npm test -- test/verify`. Then on a real GitHub repository, through both Tenet's test workflow and the existing-CI step:
   - a tagged test removed from discovery gives `not run`
   - a deleted test is reported
   - editing `Implements:` re-evaluates
   - a fork gets the full card
   - five concurrent writes lose no record

**CP-0054 · This repository's specifications** · R-210 (this repository) · a `spec` packet; each document's change is approved by its owner
1. *Needs:* CP-0009; C §3; OB §1.
2. *Owns:* front matter, requirement metadata and `blessed/` copies for `tenet/vision.md` and `tenet/specs/**`; the Status column's removal (R-210).
3. *Exports:* none.
4. *Behavior:* convert the PRD tables to the table form (`ID`, `Requirement`, `Serves`, `Origin`, `Cites`); run `tenet fix`; the Owner blesses each section with `tenet bless`.
5. *Edge cases:* a requirement with no source (origin `asked`); budgets near 90%.
6. *Out of scope:* changing any requirement's meaning.
7. *Fixtures:* none beyond this repository.
8. *Proving:* `tenet check` on this repository exits 0 with no exceptions file.

## A0-6

**CP-0010 · Init, upgrade, remove** · R-020, R-022, R-023, R-024, R-025, R-051, R-221, R-222
1. *Needs:* CP-0045, CP-0048, CP-0051; OB §2; C §6, §10; CI §2–§3; AG §1; ALG-12.
2. *Owns:* `src/install/`, the commands `init`, `upgrade`, `remove`, `doctor`, `examples/starter/` (the `tenet-starter` contents), `test/install/`.
3. *Exports:* `init({yes, vendor, force})`, `upgrade()`, `remove()`, `doctor()`.
4. *Behavior:*
   - **Preflight:** as UX Part 1, with the host capability level (R-222) and where the tests will run (CI §2: the existing-CI step when a CI job runs the detected test command, else Tenet's workflow), and why.
   - **Writes (ALG-12):** `tenet.yaml` at `observe` with the runner command and setup (C §6, CI §2), the lock, the recorder workflow, the chosen test path, the `AGENTS.md` block, the pull-request template block, the `.gitignore` block, host entries (C §10), owners (OB §2) and the manifest.
   - **After writing:** prints the first findings and offers onboarding. An empty repository gets two questions and `tenet/intent.md`; with `--yes`, kind `other`.
   - `upgrade` per OB §2; `remove` per ALG-12 with the branch-rule reminder; `doctor` checks Node, git, OpenSSH, the lock and the workflows.
5. *Edge cases:* an existing `AGENTS.md` block or pull-request template; `.mcp.json` with other servers; an interruption after each write; no git (exit 3); a forge other than GitHub (no card, said plainly); a CI job using services.
6. *Out of scope:* `level`, `rules` (CP-0050); scheduled upgrades (M4).
7. *Fixtures:* `test/install/{empty,node-vitest,node-existing-ci,python-pytest,go,existing-agents-md,existing-mcp}`.
8. *Proving:* a second `init` changes nothing; `remove` restores every fixture byte for byte and keeps a key the user changed; first findings appear within ten minutes on Torus and on an empty repository.

## A0-7

**CP-0052 · Blessing, onboarding card, evaluation and scenarios** · R-223 (bless, card), R-012 (drafter evaluation)
1. *Needs:* CP-0010; ALG-03, ALG-13; OB §1; AG §1–§2.
2. *Owns:* `src/onboard/{bless,card}.ts`, the `bless` command, `onboard --card`, `pkg/evals/onboarding/`, `pkg/conformance/scenarios/`, `test/onboard/bless/`.
3. *Exports:* `bless({doc?, section?}) → {blessed, confirmed, rejected, deferred, minutes}`; `onboardingCard() → markdown`.
4. *Behavior:* ALG-03's session (conflicts first; bless, confirm, edit, reject, defer); the log line (ALG-13); the card per OB §1 and its golden examples.
5. *Edge cases:* no terminal (exit 2); an inferred statement left; an open conflict; a conflict choice that contradicts a statement; interruption keeps finished sections; re-blessing an edited section.
6. *Out of scope:* forge blessing (alpha.1).
7. *Fixtures:*
   - **The evaluation suite** (`pkg/evals/`, excluded from the npm package, and never read by agents under test):
     - ≥4 repositories: a Node service, a Python library, a Go CLI, and one with docs and ADRs
     - each has a `key.json` with obligations and their sources, planted conflicts (a stale README, an ADR against a test, an inactive flag, a roadmap issue) and scripted answers
     - scoring: ALG-13's automatic checks and kept ratio; recall and invented scored by a person who did not run the agent, with a second scorer on 20%
     - **fresh-session check:** bless "retry once", change the code to retry twice, then ask a fresh agent session that has only the installed `AGENTS.md`, skills and MCP to change the retry code; it passes if the agent works from "retry once" and reports the drift
   - **The scenario suite** (`pkg/conformance/scenarios/`), run against the CLI, SDK, MCP and card:
     - a tagged test that never ran
     - `Implements:` changed on the same commit
     - an advisory and an enforced failure together (ALG-07, as a fixture)
     - rejecting an edit to a blessed section
     - a global rule under budget pressure
     - a change to a shared helper
     - an install interrupted part-way
     - blessing in a fresh clone after a squash merge
     - a pull request closed without merging
     - the README and UX walkthroughs run verbatim
8. *Proving:* `npm test -- test/onboard`, using a scripted terminal through injected stdin; `npm run eval:onboarding -- --agent <name>` writes a scored report, which passes on two agents; `npm run scenarios` passes.

**Release 0.1.0-alpha.0** (an `ops` work item): CI §9's release procedure, then the M1 alpha.0 gate in [plan §1](../plan.md#1-milestones).
