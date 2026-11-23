# Tenet plan: 0.1.0-alpha.0 build contracts, waves A0-1 to A0-4

> Level L2 · Version 0.13 · Part of [plan.md](../plan.md) · Status: **draft, awaiting the Owner's approval; frozen by CP-0015** · Budget: 6,000 tokens · Added in L-0023 · Previous version: `archive/specs/plan/alpha.0.md@0.12.md` · Continued in [alpha.0b.md](alpha.0b.md) (A0-5 to A0-8)

**Context card.** One build contract per alpha.0 packet, in wave order ([plan §2](../plan.md#2-waves)), with the eight fields of [plan §4](../plan.md#4-build-contract). A builder reads its contract, the sections it names and nothing else. If the contract and a specification disagree, the builder stops and escalates; it never chooses. References: **C** = [contracts](../tech-spec/contracts.md), **ALG** = [algorithms](../tech-spec/algorithms.md), **CI** = [ci](../tech-spec/ci.md), **AG** = [agents](../tech-spec/agents.md), **OB** = [onboarding](../tech-spec/onboarding.md), **TS** = [tech spec](../tech-spec.md), **UX** = [ux-spec](../ux-spec.md).

**Every contract also means:**
- module import rules (TS §1), enforced by `test/architecture.test.ts`; SDK functions take `{cwd, stdin, stdout, now}`
- error codes, exit codes and plain words (C §13, R-083); the finding shape, `--json` envelope and per-command results (C §8); determinism (C §11)
- each command lives in `src/commands/<name>.ts`, with its result schema in `kit/schemas/results/<name>.json`; the one shared file, `src/commands/index.ts`, gets one import line per command
- shared test helpers come from `test/helpers/` (CP-0005); tests in `test/<module>/`; algorithm fixtures in `pkg/conformance/alg-<nn>/`
- Proving always includes `npm run lint`, `npm run check:examples` and `npm test` passing on Windows, macOS and Linux in CI

## A0-1

**CP-0004 · Schemas for alpha.0** · R-010 (part), R-205, R-206 (agent card schema)
1. *Needs:* CP-0003; C §1–§6, §8, §10; CI §2; TS §6.1–§6.2 (pack shape); AG §1 (agent card shape).
2. *Owns:*
   - `kit/schemas/` (new: `tenet-yaml` with the alpha.0 fields only (TS §6.1), `lock`, `pack`, `agent-card`, `spec-front-matter`, `inventory`, `interview`, `assignment`, `test-report`, `bundle`, `proof-card`, `board`, `manifest`, `finding`)
   - `src/core/schema.ts`; `src/types/` (generated with the pinned generator); the `gen:types` script entry; `test/schemas/`
   - Replaces `tenet-profile.json` and `agent.json`; `packet.json` stays until CP-0049.
3. *Exports:* `validate(name, data) → {ok, errors: [{pointer, keyword, message}]}`; `npm run gen:types`.
4. *Behavior:* JSON Schema 2020-12, compiled once with ajv strict and ajv-formats; `additionalProperties: false` plus `patternProperties: {"^x-": {}}`; `schema_version: 1` where C names it; nullable fields as C marks them.
5. *Edge cases:* an unknown key is refused; an `x-` key is accepted; `board` accepts the alpha.0 subset (C §5); generated types don't widen into index signatures because of `x-`.
6. *Out of scope:* kernel records, events, evidence payloads (CP-0049); command result schemas (each command's packet).
7. *Fixtures:* per schema ≥2 valid and ≥3 invalid in `test/schemas/<name>/`, each invalid file named for the keyword it must fail; every example in C validates.
8. *Proving:* `npm test -- test/schemas`; `npm run gen:types` leaves no diff.

**CP-0005 · CLI, core and packaging** · R-048, R-080, R-081, R-083, R-084
1. *Needs:* CP-0003, CP-0002; C §8, §11, §13; TS §1–§2; ALG-12 (paths).
2. *Owns:* `src/cli.ts`, `src/sdk.ts`, `src/commands/index.ts`, `src/core/{fs,yaml,git,hash,output,clock}.ts`, `package.json` (except `gen:types`), `.github/workflows/release.yml`, `test/helpers/` (`tmpRepo`, `fakeClock`, `fakeTty`, `fakeGitHub`), `test/core/`, `test/cli/`.
3. *Exports:*
   - `run(argv, io) → exit code`; `registerCommand(spec)`
   - `writeAtomic`, `confine(path)` (TN-PATH-ESCAPE), `readYaml`
   - `git(args, {cwd})`; batched helpers `catFileBatch(ref, paths)`, `lastChangedMap(paths)` and `writeRefFiles(ref, files, message)` (plumbing, never the working tree)
   - `sha256`, `jcs`, `ulid(now)`, `alias(ulid)`
   - `result(command, value, findings)`, `fail(code, words, fix)`
4. *Behavior:*
   - `--version`, `help`; the envelope and exit precedence; human text on stderr under `--json`
   - `writeAtomic` writes `.<name>.<pid>.<random>.tmp` in the same folder, then renames, retrying up to 5 times on `EPERM`, `EBUSY` and `EACCES` (Windows); it removes the temporary file on final failure
   - `git` always passes `-c core.quotepath=false`; `--offline` refuses every network call
5. *Edge cases:* paths with spaces and non-ASCII; backslashes stored as `/`; an interrupted write leaves the old file; an unknown flag exits 2; Node below 22 or git below 2.40 exits 3; a symlink pointing outside the repository.
6. *Out of scope:* every command's behavior; `sign` (alpha.2).
7. *Fixtures:* RFC 8785 test vectors; ULIDs monotonic within one millisecond; an alias collision lengthened by one; 1,500 blobs read in one `catFileBatch`.
8. *Proving:* `npm test -- test/core test/cli`; `npm pack`, then on each platform in an empty folder: install the `.tgz`, `npx tenet --version` prints it, and `node -e "import('@vedprakash-m/tenet')"` succeeds.

## A0-2

**CP-0012 · Kit content** · R-011, R-012 (drafter, spec reviewer), R-016, R-017, R-142, R-171, R-174, R-188, R-225 (working rules) · touches `kit/agents/`, so it runs as an `agent` packet
1. *Needs:* CP-0004; C §2–§4; AG §1–§3; TS §6.2.
2. *Owns:* `kit/templates/` (`intent`, `vision`, `requirements`, `design`, `experience`, `plan`, `pull-request`, `agents-block`, `escalation`), `kit/packs/minimal/pack.yaml`, `kit/skills/{draft-specs,work-a-change,review-with-findings}/SKILL.md`, `kit/agents/{drafter,spec-reviewer}.md`, `kit/practices/default.md` (AG §1), `kit/defaults/`, `test/kit/`. Old kit files it supersedes are deleted, not edited.
3. *Exports:* the files above.
4. *Behavior:*
   - `agents-block` is AG §1 verbatim, with the AG §3 tagging line per runner; the skills follow AG §2 step for step
   - templates carry C §3 front matter (with `level`, `scope` and `applies_to` examples), a worked example and a completeness checklist; `pull-request` holds the C §2 block
   - the alpha.0 pack lists stations, phases, lanes (express, quick, careful, deep), work types including `explore`, and the five alpha.0 rules; claims, methods and strengths come with CP-0049 and CP-0050
   - the drafter may write only the assignment's output paths and `.tenet/onboard/interview.json`; the spec reviewer is read-only and reports advisory findings
5. *Edge cases:* an empty repository (questions only); a project kind not listed (generic questions).
6. *Out of scope:* the 0.1.0 cards (CP-0022); loops (CP-0020).
7. *Fixtures:* the pack and both cards against their schemas; every template's example passes C §3 parsing.
8. *Proving:* `npm test -- test/kit`: everything validates; each skill is under 2,000 tokens and the block under 1,500.

**CP-0006 · Policy, levels, kit and lock** · R-050, R-053, R-104, R-109, R-204, R-214
1. *Needs:* CP-0004, CP-0005; TS §6.1–§6.3, §7.1; C §1; OB §2 (`kit_sha256`); ALG-06.
2. *Owns:* `src/policy/`, `test/policy/`.
3. *Exports:* `loadPolicy({ref?})`, `ruleMode(policy, rule)`, `match(selector, change)`, `ownersFor(path)`, `areaFor(path)`, `loadKit(policy) → {path, sha256}`, `verifyLock()`.
4. *Behavior:*
   - **Validation and defaults:** validates `tenet.yaml` against the alpha.0 schema; fills defaults from `level` and the rule registry, capping every rule at `advise` in alpha.0 with a notice. A level not yet available warns `TN-POLICY-LEVEL-UNAVAILABLE` and runs as `observe`.
   - **Kit:** loads it from the installed package, or from `kit_path` when vendored, and checks `kit_sha256`. Self-hosting (`kit_path: kit`) skips the lock.
   - **Target:** `ref` reads the target with `git show`; a branch that edits `tenet.yaml` is flagged `TN-POLICY-BRANCH`.
   - Owners and areas per ALG-03 and ALG-06.
5. *Edge cases:* no `tenet.yaml` (`TN-POLICY-MISSING`); an unknown rule; a loosening overlay; no CODEOWNERS (the Owner).
6. *Out of scope:* `level` and `rules` commands (CP-0050).
7. *Fixtures:* one repository per level; a branch-edited policy; an edited vendored kit; a loosening overlay.
8. *Proving:* `npm test -- test/policy`.

**CP-0018 · Reports, acceptance and weakening** · R-034 (part), R-172, R-188
1. *Needs:* CP-0005; C §1–§2, §5–§6, §8, §13; EV §2; ALG-08, ALG-09.
2. *Owns:* `src/reports/` (with `registry.ts`, a map from report kind to parser), `test/reports/`, `pkg/conformance/alg-08/`, `alg-09/`.
3. *Exports:*
   - sync `readReport(kind, path: string | string[], opts?: {prefix?: string, cwd?: string}) → TestReport` (C §6, EV §2; throws `Error & {code, fix}` on `TN-REPORT-MISSING` / `TN-REPORT-MALFORMED`)
   - sync `parseAcceptance(text) → {implements: string[], items: [{id, text}], digest, problems: Finding[]}`
   - async `scanTests(ref, policy: {cwd?: string, id_prefix?: string, test_files?: string[]}) → Promise<{declarations: [{file, line, end_line, name, raw_name, kind, tags, via_describe}], skips: [{file, line, pattern, text}]}>` (`kind`: `"it" | "test" | "it.each" | "test.each" | "def" | "func" | "t.Run" | "@Test" | "#[test]"`; excludes `describe`)
   - async `declaredTags(base, head, prefix, opts?: {cwd: string, test_files?: string[]}) → Promise<{acceptance: Record<string, DeclaredTag[]>, requirement: Record<string, DeclaredTag[]>}>` (`DeclaredTag`: `{tag, file, line, name, raw_name, authorship, via_describe}`)
   - sync `itemResults(items: [{id, text?}], reports: TestReport | TestReport[], declarations: {acceptance: Record<string, DeclaredTag[]>}) → [{id, result, coverage, tests, names, authorship, first_failure: {full_name, status} | null}]` (C §5; omits `text`)
   - async `weakening(base, head, opts?: {cwd: string, test_files?: string[]}) → Promise<{found: boolean, by: [{finding, file, names}], notes: [{note, file, names}], not_checked: string[]}>` (C §5)
4. *Behavior:* ALG-08, ALG-09, EV §2 and C §1–§2, §5–§6, §8, §13 exactly; new report formats are added as registry entries. Default `prefix = "R"`, default `cwd = process.cwd()`. `parseAcceptance` excludes repeated `[AB-n]` items after the first and sorts both `implements` and `items` by ASCII `id` in the digest. `scanTests` starts `@Test`/`#[test]` `line` on the attribute/annotation line; `itemResults` requires a start/delimiter boundary (`^|[\s>./:]`) before the declaration title, strips `AB-n` / `case.tags`, and deduplicates cases by `(reportIndex, caseIndex)`.
5. *Edge cases:*
   - **Report content:** entities and CDATA in names; retries; nested suites; zero cases; matrix bundles; a teardown failure.
   - **Tags:** two tags on one test; `tenet_AB_1` inside a longer name; `[UTF-8]`; an old `[AB-1]` outside the diff; a tag added to an existing test.
   - **Declarations:** a second tagged declaration missing from the report; multi-line `it(`; `@Test` and `#[test]` on the line before the method; `t.Run(`; `record_property`.
   - **Weakening:** a call to `init(`; a test moved between files; tests folded into `it.each`.
6. *Out of scope:* running checks; the card (CP-0051).
7. *Fixtures:* the real reports captured by CP-0041, plus one per edge case.
8. *Proving:* `npm test -- test/reports`.

## A0-3

**CP-0044 · Specification formats** · R-207–R-210, R-212, R-213, R-220
1. *Needs:* CP-0006; C §1, §3, §8, §13; ALG-02, ALG-03 (anchors, flags, owner), ALG-04, ALG-14; OB §1 (table form).
2. *Owns:* `src/specs/{parse,sections,citations,anchors,flags,ladder,deltas,touched}.ts`, `test/specs/`, `pkg/conformance/alg-02/`, `alg-04/`, `alg-14/`.
3. *Exports:*
   - sync `parseDoc(path, text, opts?: {prefix?: string}) → {path, front: Record | null, sections: [{slug, heading, level, text, digest, requirements, vision_items, conflicts, questions, applies_to, state, blessed_digest, blessed_at_rev, anchors, blessed_copy, flags}], problems: Finding[]}`
   - sync `parseRequirement(line | row: Record<string, string>, opts?: {prefix?: string, line?: number, file?: string}) → {id, text, origin, cites, serves, scope, adopted_by} | Finding`
   - sync `sectionDigest(body) → string`
   - sync `anchorsFor(section, readFile: (path) => string | null) → {anchors: Record<string, string>, texts: Record<string, string>}` (`texts` stores normalized `\n`-joined lines)
   - sync `resolveCitations(doc, readFile: (path) => string | null) → Finding[]`
   - sync `flags(section, readFile: (path) => string | null) → ("edited" | "sources-changed")[]` (uses `section.digest`, `section.blessed_digest`, `section.anchors`, `section.state`)
   - sync `relocate(anchor: {hash: string, line_count: number}, file: string) → {start, end} | {matches: number}` (`file` is the target file's text content)
   - sync `matchRenamed(front, sections) → {renamed: [{from, to, digest}], ambiguous: [{from, candidates}]}`
   - async `ladder(policy?: {cwd?: string, specs_dir?: string, files?: string[]}) → Promise<[{path, level, doc}]>` (discovers `.md` files with `tenet.spec` front matter; sorted `L0 < L1 < L2 < null` then `path`)
   - async `deltas(base, head, opts?: {cwd?: string}) → Promise<[{doc, added, modified, removed}]>` (`doc` is `tenet.doc`; compares requirement and vision items by ID, omitting unchanged docs)
   - async `touched(base, head, implementsIds: string[], opts?: {cwd?: string, codeowners_path?: string}) → Promise<[{id, why}]>`
4. *Behavior:* ALG-02, ALG-03's anchors, flags and unique relocation, ALG-04 and ALG-14 exactly; requirements/vision items are list items (`parseRequirement` takes `<prefix>-\d+`; `parseDoc` routes `V-(?:[A-Z]+)?\d+` in `L0` sections, including `Vision`, to `vision_items`, excluding duplicate IDs after the first) or table rows (`row` keyed by lowercased header names, OB §1). `parseDoc` checks `TN-SPEC-DUP-ID` within one file; cross-file uniqueness runs in `check`. `anchorsFor` stops `test:` blocks at the next `ALG-09` declaration or `describe(` at `<=` indentation and stores normalized section body in `texts` for `doc:`. `matchRenamed` omits merges (`≥2` vanished slugs matching one new section). `Finding.severity` is `"error"` for `parseDoc`/`resolveCitations`. Default `cwd = process.cwd()`, `prefix = "R"`.
5. *Edge cases:*
   - missing braces (`TN-SPEC-REQ-META`); a duplicate ID across documents (`TN-SPEC-DUP-ID`); a line without an ID ("needs an ID"); a file without front matter (all `draft`, with a finding)
   - a `## ` inside a four-backtick fence; CRLF; a Unicode heading; a renamed heading
   - lines shifted above an anchor; the same cited lines appearing twice; a cited file deleted
   - a PRD table with extra columns; grouped vision IDs (`V-P18`)
6. *Out of scope:* `bless` (CP-0052); the `check` command (CP-0009); context (CP-0045).
7. *Fixtures:* ALG-02, ALG-04 and ALG-14 fixtures.
8. *Proving:* `npm test -- test/specs`; every fixture's output equals its expected JSON byte for byte.

## A0-4

**CP-0009 · Check, fix and split** · R-008, R-033, R-038, R-054 (lock mismatch), R-219
1. *Needs:* CP-0044; TS §9–§10; C §1, §8, §13; ALG-02 (rename), ALG-03 (integrity, relocation).
2. *Owns:* `src/specs/{check,fix,split}.ts`, the commands `check`, `fix`, `split` with their result schemas, `kit/hooks/pre-commit`, `test/check/`.
3. *Exports:* `check({paths?, pack?, ci?, base?}) → {findings, summary}`; `fix({dryRun}) → {changes}`; `split(doc, section)`.
4. *Behavior:*
   - **Findings:** required files, schemas, links and anchors, citations, origin present, section states and flags, blessed-copy integrity, unique IDs, vision coverage (TS §6.3), budgets, kit integrity, and a package version that differs from the lock.
   - **Exit codes** follow C §13: `budget` is a rule finding only with `--ci --base` on a change that crosses 100%.
   - **`fix`:** assigns IDs (C §1), numbers `V-` items, writes front matter, section entries, digests and `drafted_from`, moves renamed entries and copies, updates uniquely relocated anchors, and normalizes citation paths. It never changes meaning, states or blessings.
   - **`split`:** moves a section into a part, leaving a pointer and updated links.
   - The hook warns and never blocks.
5. *Edge cases:* `fix` twice changes nothing; two branches both assigning `R-40` (`fix` renumbers the newer unblessed one; if both are blessed, `check` reports it).
6. *Out of scope:* event and alias checks (CP-0007).
7. *Fixtures:* `test/check/<code>/`, one violation each; a generated 500-document repository for R-082.
8. *Proving:* `npm test -- test/check`: each fixture yields exactly its finding; `fix` repairs every mechanical one; R-082 timing holds with git calls batched.

**CP-0045 · Agent context and MCP** · R-049, R-211
1. *Needs:* CP-0044; C §9; ALG-10.
2. *Owns:* `src/context/`, `src/mcp/`, the commands `context` and `mcp` with their result schemas, `test/context/`, `test/mcp/`.
3. *Exports:* `context(input) → {blessed, drafts, index, omitted, truncated, rules}`; `serveMcp(io)`.
4. *Behavior:* ALG-10 and C §9 exactly, reading blessed copies; `tenet_status` gives the level and spec states; `tenet_next` gives the pending blessings; `tenet_propose` writes into the named work item's packet folder.
5. *Edge cases:*
   - nothing blessed ("nothing blessed yet; run tenet bless")
   - global rules over their reserved share; an item asked for by ID that alone exceeds the budget (`over_budget`)
   - a blessed copy failing integrity (served as a draft)
   - notifications get no reply; stdout carries only protocol messages
6. *Out of scope:* writing host entries (CP-0010).
7. *Fixtures:* `pkg/conformance/alg-10/`, including "retry once".
8. *Proving:* `npm test -- test/context test/mcp`; a scripted session matches its golden transcript; the pinned MCP Inspector CLI lists and calls every tool on Windows, macOS and Linux, through both the committed entry and the Windows local form.

**CP-0053 · Specification board** · R-032 (alpha.0 part)
1. *Needs:* CP-0044, CP-0018; C §5.
2. *Owns:* `src/views/specs-board.ts`, the `board` command and its result schema, `test/views/`.
3. *Exports:* `board({all}) → board.json` with `as_of`, `read`, `specs`, `pending_blessings`, `spec_debt`.
4. *Behavior:* reads the working tree. The markdown groups "waiting for your blessing", "sources changed", "edited" and "spec debt"; **spec debt** is `{kind: broken-citation|untested-requirement|over-budget, path, id, message}`, with untested requirements found through CP-0018's `scanTests`. `--all` adds clean blessed sections.
5. *Edge cases:* no specifications ("run tenet onboard").
6. *Out of scope:* work items, `--open`, `--since`, `--fetch` (CP-0008).
7. *Fixtures:* fresh drafts; half blessed; blessed with sources changed; spec debt of each kind; the UX Part 2 example.
8. *Proving:* golden `board.json` and markdown byte-identical on three platforms.

Waves A0-5 to A0-8 and the release: [alpha.0b.md](alpha.0b.md).
