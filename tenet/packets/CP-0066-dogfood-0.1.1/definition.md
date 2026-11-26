---
packet: CP-0066
version: 1
---
# CP-0066 · 0.1.1 from the first dogfood

> Approved by the Owner on 2026-11-26 ([L-0041](../../ledger/L-0041-dogfood-0.1.1-scope.md)). Release: `0.1.1`.

## Why

The Owner ran 0.1.0 on a private existing project the way a new user would. A new user on an existing repository gets stuck at three points: blessing can't be finished, agent context misses the matching section, and the test check can't be set up. 58 findings were logged (F-01 to F-58). This packet fixes the ones in scope below.

**The source project is private.** No text, file names, terms or evidence from it go into this repository. Every repro, fixture and test here is synthetic. Finding IDs (F-nn) are the only link.

## Rules for every group

- Work only in your own track worktree, on a branch named `cp-0066/<group>-<slug>`, from the latest `origin/main`.
- Commit identity: `Ved Mishra <vedprakash.m@me.com>` set locally (`git config user.name` / `user.email`). Never any other email.
- **Reproduce first** with a synthetic case. If a finding doesn't reproduce, or its cause is different, say so in your report and don't change code for it.
- **Tag every test** with its acceptance ID and finding ID in the test name, for example `test("[AB-A1] [F-43] decide later skips the section", …)`.
- **Never weaken, skip or delete a test.** Never edit `pkg/conformance/**` cases written by others (see [INDEPENDENT.md](../../../pkg/conformance/INDEPENDENT.md)). If an existing independent case contradicts an acceptance item here, stop and report it; don't choose.
- **Specification changes ride in the same pull request** as the code that needs them, marked as a proposal in the pull request body. The Owner blesses them. Change only the sections your group needs. Keep `kit/TENET.md` untouched.
- **Docs:** update `docs/getting-started.md`, `docs/commands.md`, `docs/concepts.md` or `docs/faq.md` where your finding names a docs gap. Plain words (UX spec §8).
- Never disable TLS verification; never use `--force` on someone's files; no new runtime dependencies; no network calls beyond R-080.
- Run `npm run lint` and `npm test` locally before pushing. Open one pull request per group; CI must pass on Linux, Windows and macOS. Don't merge; the coordinator reviews and merges.
- Stop and report (standard §11) when the same failure repeats 3 times, you flip between two approaches twice, or the work can't pass without changing a test, an acceptance item or a higher document.

## Groups and acceptance

### A · Blessing can be finished, and the card and board show what blocks it (track 1)

- **AB-A1 (F-43):** "Decide later" on a conflict leaves that conflict's section unblessed, and the session carries on: the other conflicts, then every section free of open items.
- **AB-A2 (F-44):** `bless` asks each open question (`- [ ] Q-n (section: …)`) in a section before that section, with *answer*, *not a blocker* and *skip section*. An answer is recorded the way a conflict's `resolution:` is. The docs say open questions block their section.
- **AB-A3 (F-46):** every bless session ends with a summary line, *"Blessed N of M sections"*, also when N is 0 (then also *"Nothing is in force yet"*), and the next step. The exit code is documented.
- **AB-A4 (F-45):** with a single owner, Enter accepts it. The "contradicts a drafted statement?" prompt lists the statement IDs of that section.
- **AB-A5 (F-48):** the blessing log records each section's own review time, not the time since the session started.
- **AB-A6 (F-49):** token budgets count the body agents read, not front matter. Blessing never pushes a file over budget by itself.
- **AB-A7 (F-50):** while the documents that would serve a blessed vision item are still unblessed drafts, `check` reports one grouped warning (*"N vision items wait for a blessed requirement; bless the PRD next"*), not one error per item. Getting started gives a blessing order.
- **AB-A8 (F-30):** the onboarding card shows *"Open questions (n)"* with each question, after the conflicts.
- **AB-A9 (F-29, F-34):** `onboard --card` says which files it changed and what to commit; its last line gives the next step for the actual state (uncommitted changes, no upstream branch, no pull request, or a pull request).
- **AB-A10 (F-32):** the card says *"N citations resolve (file and lines exist)"*, not *"checked against the code"*.
- **AB-A11 (F-37):** plain-text `board` groups sections by file and shows each section's open conflicts and questions. The branch the board read is named correctly.

### B · Agents get the right context and can find the skills (track 3)

- **AB-B1 (F-53):** `context --paths` returns blessed sections whose `applies_to` matches a path, with their text, ranked above sections that match only through `"**"`. Large `"**"` sections are indexed or summarized within the budget instead of filling it.
- **AB-B2 (F-38):** with `--include-drafts`, drafts are selected by `--paths`, `--ids` and `--query` and held to the budget like blessed text, marked as drafts, with their file path and text, in plain text and in MCP `tenet_context`. `--ids` returns the named statements.
- **AB-B3 (F-52):** `--paths` accepts comma-separated values and a repeated flag; the docs and help say so.
- **AB-B4 (F-21, F-12):** every shipped skill's front-matter `name` matches the name the README and `AGENTS.md` use. In a repository with no agent configuration, the README's drafting prompt works in Claude Code: init installs or points to the skills where Claude Code loads them and registers the MCP server, or asks first if the specification requires consent. init's plan names each host file it writes and why. The README prompt also names the skill file's path as a fallback.

### C · The test check works from day one, and locally (track 2)

- **AB-C1 (F-11, F-41):** with no test runner detected, init asks *"What command runs your tests? (blank to skip)"*; with `--yes`, it writes no test check and says how to add one. It never writes `npm test` without a `package.json`. Getting started has a "Configure your tests" section: `run`, `report`, `report_from`, `report_path`, the supported formats and one example per preset.
- **AB-C2 (F-54):** `tenet verify --local` runs the configured checks on the working tree, takes the base from the default branch's merge base, needs no CI event file and no network, and prints the proof card a pull request would get, marked as a local preview.
- **AB-C3 (F-55):** when the head changes a check's command, the card says the change takes effect after merge. Getting started says to set the test command in the setup pull request.
- **AB-C4 (F-36, F-42):** generated workflows run on `pull_request` and on `push` to the default branch only; no setup branch is written into them. `upgrade` brings existing workflows to the new form.
- **AB-C5 (F-58):** the `review-with-findings` skill has a step for when there is no proof card: review against `tenet context --ids <Implements>` and `verify --local`, and say that no card exists.

### D · Install, help, docs and polish (track 4)

- **AB-D1 (F-01):** README and getting started explain installing from the GitHub release tarball (download, check `SHA256SUMS`, `npm install --global ./<file>.tgz`), say dependencies still come from the configured registry or mirror, and say a mirror that hasn't synced returns 404. The offline note reads as the step after installing.
- **AB-D2 (F-04):** `--offline` help matches the docs: *"Work without the network: skip registry lookups, or refuse commands that need it."*
- **AB-D3 (F-10):** `init --offline` prints success first, then one accurate note (*"Recorded local package integrity (offline). Run `tenet upgrade` once you're online so CI can verify it."*). It no longer says the package isn't on the registry when the registry wasn't asked, and the note isn't repeated under *First findings*.
- **AB-D4 (F-06, wording only):** `TN-ENV-REGISTRY` gives a one-line cause; npm's full error appears only with `--verbose`.
- **AB-D5 (F-07):** no `DEP0190` deprecation warning on Windows.
- **AB-D6 (F-14, F-19):** *First findings* shows at most five findings, one per line, with the total count and a count per kind; the rest stay in the inventory file. "skipped N" is broken down by reason, naming `tenet.yaml` for excluded paths.
- **AB-D7 (F-15, F-40):** `tenet <command> --help` prints that command's own options. `onboard.exclude` is documented in getting started and commands, and onboarding prints a hint when many files sit in a folder whose name means archive.
- **AB-D8 (F-20):** `onboard` ends with the next step: the agent prompt from the README.
- **AB-D9 (F-13, F-35):** the pull-request template's example is commented out, with placeholder IDs and no internal references. Getting started shows the setup pull request's acceptance block.
- **AB-D10 (F-09, F-17):** init's plan says *create* or *edit* per file from the working tree. Path-scoped `check` prints human output unless `--json`.
- **AB-D11 (F-02, F-03):** `docs/README.md` is a user index. Per-answer `Source:` lines move to a footer.

### E · The path to the release, and privacy (track 3, after B)

- **AB-E1 (F-56):** a same-version `upgrade` changes nothing: the manifest keeps every init-managed path, and `remove` after `upgrade` removes the same set as before.
- **AB-E2 (F-47):** anchors store a hash and line range per citation, plus the blessed commit, and never the cited text. When a cited source changes, Tenet shows the old text from git history when it is available, and otherwise the changed range. `upgrade` rewrites existing anchor files without their text. The contract (`contracts.md`, ALG-03) changes in the same pull request, as a proposal.

### Independent scenarios

Written from this definition, before or apart from the builder, in `pkg/conformance/scenarios/` with a row in [INDEPENDENT.md](../../../pkg/conformance/INDEPENDENT.md):

- `s14-bless-decide-later-and-questions` (AB-A1–A3, A7) and `s15-context-paths-ranking` (AB-B1–B3): written by track 2.
- `s16-verify-local-preview` (AB-C1–C3): written by track 1 after group A.

## Deferred (L-0041)

F-39 (needs R-080 to change), F-51 and F-23 (changes to the standard; with an "adopt" onboarding mode, written up as a proposal), and polish for 0.1.2: F-05, F-16, F-18, F-22, F-24–F-28, F-31, F-33, F-57, and F-06's reordering.

## Done when

Every acceptance item above has tagged tests that pass on all three platforms, the three scenarios pass, the packed-tarball journey passes, and the release notes are written. Then the Owner decides on tagging `v0.1.1`.
