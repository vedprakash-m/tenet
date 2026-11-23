# Tenet plan: 0.1.0-alpha.0 build contracts

> Level L2 · Version 0.11 · Part of [plan.md](../plan.md) · Status: **draft, awaiting the Owner's approval; frozen by CP-0015** · Budget: 6,000 tokens · Added in L-0023

**Context card.** One build contract per alpha.0 packet, in wave order ([plan §2](../plan.md#2-waves)), with the eight fields of [plan §4](../plan.md#4-build-contract). A builder reads its contract, the sections it names and nothing else. If the contract and a specification disagree, the builder stops and escalates; it never chooses. References: **C** = [contracts](../tech-spec/contracts.md), **ALG** = [algorithms](../tech-spec/algorithms.md), **OB** = [onboarding](../tech-spec/onboarding.md), **TS** = [tech spec](../tech-spec.md), **UX** = [ux-spec](../ux-spec.md).

**Every contract also means:**
- module import rules (TS §1); SDK functions take `{cwd, stdin, stdout, now}`
- errors carry a `TN-` code, plain words and a fix (R-083)
- `--json` envelope and exit codes (C §8); determinism (C §11)
- tests in `test/<module>/`; algorithm fixtures in `pkg/conformance/alg-<nn>/`
- Proving always includes `npm run lint` and `npm test` passing on Windows, macOS and Linux in CI

## A0-1

**CP-0004 · Schemas for alpha.0** · R-010 (part), R-205, R-206 (agent card schema)
1. *Needs:* CP-0003; C §1–§6, §10; TS §6.1.
2. *Owns:* `kit/schemas/` (new: `tenet-yaml`, `lock`, `pack`, `agent-card`, `spec-front-matter`, `inventory`, `interview`, `assignment`, `test-report`, `proof-card`, `board`, `manifest`); `src/core/schema.ts`; `src/types/` (generated); `test/schemas/`. Replaces `tenet-profile.json` and `agent.json`; `packet.json` stays until CP-0049.
3. *Exports:* `validate(name, data) → {ok, errors: [{pointer, keyword, message}]}`; `npm run gen:types`.
4. *Behavior:* JSON Schema 2020-12, compiled once with ajv strict and ajv-formats; `additionalProperties: false` plus `patternProperties: {"^x-": {}}`; `schema_version: 1` required where C names it.
5. *Edge cases:* an unknown key is refused; an `x-` key is accepted; `board` accepts the alpha.0 subset (C §5).
6. *Out of scope:* kernel records, events, evidence payloads (CP-0049).
7. *Fixtures:* per schema ≥2 valid and ≥3 invalid in `test/schemas/<name>/`, each invalid file named for the keyword it must fail (`invalid-required-owner.json`).
8. *Proving:* `npm test -- test/schemas` (valid pass; invalid fail with the named keyword); `npm run gen:types` leaves no diff.

**CP-0005 · CLI, core and packaging** · R-048, R-080, R-081, R-083, R-084
1. *Needs:* CP-0003, CP-0002; C §8, §11; TS §1–§2.
2. *Owns:* `src/cli.ts`, `src/sdk.ts`, `src/core/{fs,yaml,git,hash,output,clock}.ts`, `package.json` (`bin`, `exports`, `files`, `engines`), `.github/workflows/release.yml`, `test/core/`, `test/cli/`.
3. *Exports:* `run(argv, io) → exit code`; `registerCommand(spec)`; `writeAtomic`, `readYaml`, `git(args, {cwd})`, `sha256`, `jcs`, `ulid(now)`, `alias(ulid)`, `result(command, value, errors)`.
4. *Behavior:* commands register themselves; `--version`, `help`; the envelope and exit precedence 2 > 3 > 4 > 1 > 0; human text on stderr under `--json`; `writeAtomic` writes a temporary file in the same folder, then renames; `git` always passes `-c core.quotepath=false`; `--offline` refuses every network call.
5. *Edge cases:* paths with spaces and non-ASCII; backslashes stored as `/`; an interrupted write leaves the old file; an unknown flag exits 2; Node below 22 or git below 2.40 exits 3 (`TN-ENV-NODE`, `TN-ENV-GIT`).
6. *Out of scope:* every command's behavior; `sign` (alpha.2).
7. *Fixtures:* RFC 8785 test vectors; ULIDs monotonic within one millisecond; an alias collision lengthened by one.
8. *Proving:* `npm test -- test/core test/cli`; `npm pack`, then on each platform in an empty folder: install the `.tgz`, `npx tenet --version` prints it, and `node -e "import('@vedprakash-m/tenet')"` succeeds.

## A0-2

**CP-0012 · Kit content** · R-011, R-012 (drafter, spec reviewer), R-016, R-017, R-142, R-171, R-174, R-188 · touches `kit/agents/`, so it runs as an `agent` packet
1. *Needs:* CP-0004; C §2–§4; TS §6.2.
2. *Owns:* `kit/templates/` (`intent`, `vision`, `requirements`, `design`, `experience`, `plan`, `pull-request`, `escalation`), `kit/packs/minimal/pack.yaml`, `kit/skills/{draft-specs,work-a-change,review-with-findings}/SKILL.md`, `kit/agents/{drafter,spec-reviewer}.md`, `kit/defaults/`, `test/kit/`. Old kit files it supersedes are deleted, not edited.
3. *Exports:* the files above.
4. *Behavior:* templates carry C §3 front matter, a worked example and a completeness checklist; `pull-request` holds the C §2 block. The pack lists stations, the lanes express, quick, careful and deep, work types including `explore`, and phases. `draft-specs` is the drafting procedure: read the assignment, draft each view, cite every `observed` or `documented` statement, list conflicts as `CF-` items, ask at most 10 questions grouped by project kind (service, library, CLI, application, data or infrastructure), never resolve a conflict, never bless. The drafter card is read-only; the spec reviewer reports unsupported statements as advisory findings.
5. *Edge cases:* an empty repository (questions only, no citations); a project kind not listed (generic questions).
6. *Out of scope:* builder and judge cards (CP-0022); loops (CP-0020).
7. *Fixtures:* the pack and both cards against their schemas.
8. *Proving:* `npm test -- test/kit`: everything validates; each skill is under 2,000 tokens; every template's front matter parses.

**CP-0006 · Policy, levels, kit and lock** · R-050, R-053, R-104, R-109, R-204, R-214
1. *Needs:* CP-0004, CP-0005; TS §6.1–§6.3, §7.1; C §1; ALG-06.
2. *Owns:* `src/policy/`, `test/policy/`.
3. *Exports:* `loadPolicy({ref?})`, `ruleMode(policy, rule)`, `match(selector, change)`, `ownersFor(path)`, `loadKit(policy) → {path, sha256}`, `verifyLock()`.
4. *Behavior:* validates `tenet.yaml`; fills defaults from `level` and the rule registry (TS §6.1), capping every rule at `advise` in alpha.0 with a notice; loads the kit from the installed package, or `.tenet/kit/` when `vendored`, and checks `kit_sha256`; `kit_path` (self-hosting) skips the lock. In CI, `ref` is the target branch read with `git show`; a branch that edits `tenet.yaml` is flagged `TN-POLICY-BRANCH`. Owners per ALG-03.
5. *Edge cases:* no `tenet.yaml` (exit 3, "run tenet init"); an unknown rule (`TN-POLICY-RULE`); an overlay that loosens (`TN-POLICY-LOOSEN`); no CODEOWNERS (the Owner).
6. *Out of scope:* `level` and `rules` commands (CP-0050).
7. *Fixtures:* one repository per level; a branch-edited policy; an edited vendored kit; a loosening overlay.
8. *Proving:* `npm test -- test/policy`: each level yields TS §6.1's defaults; the branch edit is ignored and flagged; the edited kit fails.

## A0-3

**CP-0044 · Specification formats** · R-207–R-210, R-212, R-213, R-220 · the medium-model trial builds this packet
1. *Needs:* CP-0006, CP-0012; C §1, §3; ALG-02, ALG-03 (flags and owner only), ALG-04.
2. *Owns:* `src/specs/{parse,sections,citations,flags,ladder,affected}.ts`, `test/specs/`, `pkg/conformance/alg-02/`, `alg-04/`.
3. *Exports:* `parseDoc(path, text) → {front, sections: [{slug, heading, text, digest, requirements, conflicts, questions}], problems}`; `parseRequirement(line) → {id, text, origin, cites, serves, scope, adopted_by} | problem`; `sectionDigest(text)`; `resolveCitations(doc, rev) → findings`; `flags(section, rev) → ("edited" | "sources-changed")[]`; `ladder(policy) → [{path, level, doc}]`; `affected(base, head) → {sections, requirements}`.
4. *Behavior:* sections and slugs per ALG-02; citations per ALG-04 at `drafted_from` for drafts and `blessed_at_rev` for blessed sections; flags per ALG-03; a requirement is a list item or a table cell starting `R-<n>` (with the project's prefix); `affected` lists the sections whose digest differs between two revisions, for the pull request's spec list.
5. *Edge cases:* a requirement without braces gets `TN-SPEC-REQ-META`; a duplicate ID across documents `TN-SPEC-DUP-ID`; a line without an ID, "needs an ID"; a file without front matter is all `draft` with a finding; `## ` inside a code fence; CRLF.
6. *Out of scope:* `bless` (CP-0052); the `check` command (CP-0009); context (CP-0045).
7. *Fixtures:* ALG-02 and ALG-04 fixtures; this repository's `tenet/specs/`, with its expected findings in `test/specs/expected-self.json`.
8. *Proving:* `npm test -- test/specs`; every fixture's output equals its expected JSON byte for byte.

## A0-4

**CP-0009 · Check, fix and split** · R-008, R-033, R-038, R-219
1. *Needs:* CP-0044; TS §9–§10; C §1.
2. *Owns:* `src/specs/{check,fix,split}.ts`, the commands `check`, `fix`, `split`, `kit/hooks/pre-commit`, `test/check/`.
3. *Exports:* `check({paths?, pack?}) → {findings: [{file, line, rule, severity, message, fix}]}`; `fix({dryRun}) → {changes}`; `split(doc, section)`.
4. *Behavior:* alpha.0 rules: required files, schemas, links and anchors, citations, origin present, section states and flags, budgets (warning at 90%, error over 100%), lock integrity, unique IDs. Exit 1 on any error; warnings alone exit 0. `fix` assigns IDs (C §1), recomputes digests, adds missing sections as `draft` and normalizes citation paths; it never changes text, states or blessings. `split` moves a section to a part file, leaves a pointer and updates links. The hook warns and never blocks.
5. *Edge cases:* `fix` twice changes nothing; two branches both assigning `R-40`: `fix` renumbers the newer unblessed one, and if both are blessed `check` reports it for a person.
6. *Out of scope:* event and alias checks (CP-0007).
7. *Fixtures:* `test/check/<rule>/`, one violation each; a generated 500-document repository for R-082.
8. *Proving:* `npm test -- test/check`: each fixture yields exactly its finding; `fix` repairs every mechanical one; `tenet check` on this repository shows only `expected-self.json`'s findings; R-082 timing holds.

**CP-0045 · Agent context and MCP** · R-049, R-211
1. *Needs:* CP-0044; C §9; ALG-10.
2. *Owns:* `src/context/`, `src/mcp/`, the commands `context` and `mcp`, `test/context/`, `test/mcp/`.
3. *Exports:* `context(input) → {blessed, drafts, index, rules, truncated}`; `serveMcp(io)`.
4. *Behavior:* ALG-10 exactly, reading blessed copies. `initialize` answers with name `tenet`, the version and `capabilities: {tools: {}}`. `tenet_status` gives the level and spec states; `tenet_next` the pending blessings; `tenet_propose` writes `.tenet/proposals/<ulid>.json`. Markdown output by default, the object under `--json`.
5. *Edge cases:* nothing blessed ("nothing blessed yet; run tenet bless"); one requirement over the budget (index only); malformed JSON-RPC (-32700), bad request (-32600), unknown tool (-32602); stdout carries only protocol messages.
6. *Out of scope:* writing host entries (CP-0010).
7. *Fixtures:* `pkg/conformance/alg-10/`, including "retry once".
8. *Proving:* `npm test -- test/context test/mcp`; a scripted MCP session matches its golden transcript.

**CP-0053 · Specification board** · R-032 (alpha.0 part)
1. *Needs:* CP-0044; C §5.
2. *Owns:* `src/views/specs-board.ts`, the `board` command, `test/views/`.
3. *Exports:* `board({all}) → board.json` with `as_of`, `read`, `specs`, `pending_blessings`.
4. *Behavior:* reads the working tree; markdown groups "waiting for your blessing", "sources changed" and "edited"; `--all` adds clean blessed sections.
5. *Edge cases:* no specifications ("run tenet onboard").
6. *Out of scope:* work items, `--open`, `--since` (CP-0008).
7. *Fixtures:* fresh drafts; half blessed; blessed with sources changed.
8. *Proving:* golden `board.json` and markdown byte-identical on three platforms.

**CP-0018 · Reports, acceptance and weakening** · R-034 (part), R-172, R-188
1. *Needs:* CP-0005; C §2, §6; ALG-08, ALG-09.
2. *Owns:* `src/reports/`, `test/reports/`, `pkg/conformance/alg-08/`, `alg-09/`.
3. *Exports:* `readReport(kind, path) → TestReport`; `parseAcceptance(body) → {implements, items, digest, problems}`; `proveItems(items, report) → [{id, result, tests}]`; `weakening(base, head) → {found, by, files}`.
4. *Behavior:* ALG-08, ALG-09 and C §2; XML read with entity expansion off.
5. *Edge cases:* entities and CDATA in names; retries; nested suites; zero cases (inconclusive); two tags on one test; a renamed test file is not deleted; a missing or unreadable report.
6. *Out of scope:* running checks; the card (CP-0051).
7. *Fixtures:* the real reports captured by CP-0041.
8. *Proving:* `npm test -- test/reports`.

## A0-5

**CP-0048 · Onboarding inventory and assignment** · R-021, R-027, R-223 (preflight, inventory, assignment, refresh)
1. *Needs:* CP-0009, CP-0012; OB §1; C §4; ALG-11.
2. *Owns:* `src/onboard/{preflight,inventory,assignment,refresh}.ts`, the `onboard` command, `test/onboard/`.
3. *Exports:* `onboard({inventoryOnly, refresh, layout}) → {preflight, inventory, assignment}`.
4. *Behavior:* preflight text as UX Part 1; the inventory of `HEAD` is byte-identical for one commit (sorted by path). It skips `.env*`, credential files, vendored and generated paths, binaries, files over 1 MB and `onboard.exclude`. Test names come from the latest report in `.tenet/reports/`, else from `it(`, `test(`, `def test_` and `func Test` lines. Docs: first `# ` heading, `## ` slugs, `git log -1 --format=%cI`. CI commands come from workflow `run:` lines. Project kind comes from manifests. Refresh keeps IDs, edits, rejections and blessings, and assigns only changed sources.
5. *Edge cases:* an empty repository (questions only); uncommitted changes (`HEAD` with a warning); a monorepo; not a git repository (exit 3).
6. *Out of scope:* drafting (the user's agent); blessing and the card (CP-0052).
7. *Fixtures:* `test/onboard/{empty,node-service,python-lib,go-cli,monorepo}`.
8. *Proving:* inventories byte-identical on three platforms; no skipped file listed in `sources`; layouts match ALG-11.

**CP-0051 · Proof job, card and records ref** · R-218, R-103, R-146, R-034 (part)
1. *Needs:* CP-0018, CP-0044, CP-0006; C §5, §7.
2. *Owns:* `src/verify/{proof-job,card,records}.ts`, `verify --proof`, `kit/workflows/tenet.yml`, `test/verify/`.
3. *Exports:* `proofJob(event) → {card, conclusion, wrote}`; `renderCard(model) → markdown`.
4. *Behavior:* the C §7 steps. The tested commit is the merge candidate when present. Built-in rules come from policy (at most `advise`). The card model is C §5, with changed lines and files. The check run is `Tenet`, concluding `neutral` when anything would have blocked, else `success`; a Tenet error is `neutral` with `degraded`. A read-only token writes the job summary. On `push`, it appends to the records ref and retries up to 5 times by rebuilding the commit on the new tip.
5. *Edge cases:* no acceptance block (suggest the template); an `edited` event on the same commit re-checks; a failing check leaves items unproven but still posts; a missing report; no blessed specifications (badge `intent-not-yet-blessed`).
6. *Out of scope:* decisions, signing, board publishing.
7. *Fixtures:* event payloads for opened, synchronize, edited and a fork; a fake checks API.
8. *Proving:* `npm test -- test/verify`; on a real GitHub repository: a skipped mapped case leaves its item unproven, a deleted test is reported, editing the acceptance list re-checks, a fork gets a job summary, five concurrent pushes lose no record.

## A0-6

**CP-0052 · Blessing, onboarding card and evaluation** · R-223 (bless, card), R-012 (drafter evaluation)
1. *Needs:* CP-0048; ALG-03, ALG-13; OB §1.
2. *Owns:* `src/onboard/{bless,card}.ts`, the `bless` command, `onboard --card`, `pkg/evals/onboarding/`, `test/onboard/bless/`.
3. *Exports:* `bless({doc?, section?}) → {blessed, rejected, deferred, minutes}`; `onboardingCard() → markdown` (printed for the agent to put in the pull request description).
4. *Behavior:* ALG-03: conflicts first, then each section with its reading time (words ÷ 200); bless, edit, reject or defer; the person picks who they are; `recorded: self`; the blessed copy is written and the `git commit` command printed. Timestamps go to `.tenet/onboard/bless-log.jsonl`.
5. *Edge cases:* no terminal (exit 2); an inferred statement left; an open conflict; interruption keeps finished sections; re-blessing an edited section replaces its copy.
6. *Out of scope:* forge blessing (alpha.1).
7. *Fixtures, the evaluation suite* (never read by agents under test): ≥4 repositories (a Node service, a Python library, a Go CLI, one with docs and ADRs), each with `key.json` holding obligations with sources, planted conflicts (a stale README, an ADR against a test, an inactive flag, a roadmap issue) and scripted answers. Scoring: ALG-13's automatic checks and kept ratio; recall and invented scored by a person who did not run the agent, with a second scorer on 20%. **Fresh-session check:** bless "retry once", change the code to retry twice, then ask a fresh agent session with only `AGENTS.md` and MCP to change the retry code; it passes if the agent works from "retry once" and reports the drift.
8. *Proving:* `npm test -- test/onboard` (scripted terminal through injected stdin); `npm run eval:onboarding -- --agent <name>` writes a scored report, passing on two agents at the M1 alpha.0 gate.

## A0-7

**CP-0010 · Init, upgrade, remove** · R-020, R-022, R-023, R-024, R-025, R-051, R-221, R-222
1. *Needs:* CP-0045, CP-0051, CP-0052; OB §2; C §6, §10; ALG-12.
2. *Owns:* `src/install/`, the commands `init`, `upgrade`, `remove`, `doctor`, `examples/starter/` (the `tenet-starter` contents), `test/install/`.
3. *Exports:* `init({yes, vendor, force})`, `upgrade()`, `remove()`, `doctor()`.
4. *Behavior:* the preflight as UX Part 1, with the detected host capability level (R-222); the runner detected and `checks.test.run` given C §6's flags (`package.json` never edited); writes `tenet.yaml` at `observe`, the lock, the workflow, the `AGENTS.md` block, host entries (C §10), the manifest last; offers onboarding; an empty repository gets two questions and `tenet/intent.md`. `upgrade` per OB §2; `remove` per ALG-12 with the branch-rule reminder; `doctor` checks Node, git, OpenSSH, the lock and the workflow.
5. *Edge cases:* an existing `AGENTS.md` block; `.mcp.json` with other servers; a rerun after interruption; no git (exit 3); a forge other than GitHub (no card, said plainly).
6. *Out of scope:* `level`, `rules` (CP-0050); scheduled upgrades (0.1.0).
7. *Fixtures:* `test/install/{empty,node-vitest,python-pytest,go,existing-agents-md,existing-mcp}`.
8. *Proving:* a second `init` changes nothing; `remove` restores every fixture byte for byte; then the release check below.

**Release 0.1.0-alpha.0** (an `ops` work item): C §7's release procedure, then the M1 alpha.0 gate in [plan §1](../plan.md#1-milestones), timed on Torus and an empty repository.
