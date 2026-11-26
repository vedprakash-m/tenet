# Track 4 · MAI Code 2 Flash · Group D: install, help, docs and polish

Read [common.md](common.md) first. Worktree `Q:\Ved\Pers\tenet-track4`. Your branch there is 51 commits behind: start fresh with `git fetch origin && git switch -c cp-0066/d-polish origin/main`.

**Safety:** never disable TLS verification (no `strict-ssl`, `NODE_TLS_REJECT_UNAUTHORIZED` or similar), in code, CI or your own shell. If the network blocks something, report it.

## Specifications to read

`tenet/specs/ux-spec.md` (help, init, onboarding output, §8 plain words), and `tenet/specs/tech-spec/onboarding.md` §2 (install) and §1 (inventory output).

## Code and docs to start from

`README.md`, `docs/*.md`, `src/cli.ts` (help), `src/core/messages.ts` (words for codes), `src/install/integrity.ts` (`TN-ENV-REGISTRY`, local-integrity warning, `spawn` with `shell`), `src/commands/init.ts` and `src/install/preflight.ts` (plan lines), `src/onboard/inventory.ts` and `src/commands/onboard.ts` (inventory output), `src/commands/check.ts`, `kit/` pull-request template.

## What was observed (synthetic), and what to do

1. **AB-D1 (F-01):** behind a corporate mirror, `npm install --global @vedprakash-m/tenet` and `npx` both fail: the mirror returns 404 for a package it hasn't synced. The README's offline advice needs Tenet installed first, so it's circular. The release tarball works but no page mentions it. Add "Install from the release tarball" to the README and getting started:
   - `gh release download` or a browser download;
   - check `SHA256SUMS`;
   - `npm install --global ./vedprakash-m-tenet-<version>.tgz`;
   - dependencies still come from the configured registry or mirror.

   Then put the `--offline` note after it. Add a line: if no checks appear on your pull request, check that GitHub Actions can run on the account (F-39's docs note).
2. **AB-D2 (F-04):** `--offline` help says "Refuse commands that use the network". Make it "Work without the network: skip registry lookups, or refuse commands that need it".
3. **AB-D3 (F-10):** `init --offline` succeeds, but it opens with "Warning: …@0.1.0 is not on the registry …", which is wrong (the registry wasn't asked), and repeats it under *First findings*. A user read the success as a failure. Print success first, then one accurate note (see definition). Tell *offline, not checked* apart from *not on the registry*.
4. **AB-D4 (F-06, wording only):** `TN-ENV-REGISTRY` pastes npm's whole error, with its debug-log path, inside parentheses. Give a one-line cause; show the full error only with `--verbose`.
5. **AB-D5 (F-07):** Node 24 on Windows prints `[DEP0190] DeprecationWarning: Passing args to a child process with shell option true` in the middle of init's output, from `spawn(npm.cmd, args, {shell: true})`. Remove the cause safely; keep Windows working, with a test on the Windows CI runner.
6. **AB-D6 (F-14, F-19):** *First findings* joins all findings (one run had 1,225) into a single line of about 83,000 characters. Show at most five, one per line, with the total and a count per kind; point to the inventory file. Break "skipped 38" down by reason, naming `tenet.yaml` when paths were excluded. Leave detection rules as they are.
7. **AB-D7 (F-15, F-40):** `tenet onboard --help`, `bless --help` and `remove --help` print the global help. Give every command its own help: its options and one line on what it does. Document `onboard: {exclude: [...]}` in getting started and commands. Print a hint when more than about 10 inventoried files sit under a folder named like `archive`, `.archive` or `old`.
8. **AB-D8 (F-20):** `onboard` ends with "Drafting assignment: …" and no next step. End with the README's agent prompt. Track 3 may rename the skill to `tenet-draft-specs`, so read the name from the shipped skill, not a literal.
9. **AB-D9 (F-13, F-35):** the pull-request template has a live `Implements: R-1` / `- [AB-1] …` block, so an unedited pull request claims R-1, and its example names an internal file (`contracts.md §2`). Put the example in a comment with placeholder IDs and no internal references. In getting started, show the setup pull request's acceptance block (`Implements: none`, setup checks, no tagged tests expected yet).
10. **AB-D10 (F-09, F-17):**
    - init's plan says "Will edit: .gitattributes, .github/pull_request_template.md" when neither exists. Decide *create* or *edit* per file from the working tree.
    - `tenet check tenet.yaml`, without `--json`, prints raw JSON. Use the human renderer.
11. **AB-D11 (F-02, F-03):** `docs/README.md` reads like an internal plan ("Written from M1 (CP-0013) …"). Make it a short user index. In `docs/faq.md` and `docs/concepts.md`, move the per-answer `Source: [UX Part 1A](../tenet/specs/…)` lines to a footer.

## Notes

- Track 2 also edits `src/install/` (runner detection, config, workflows). Keep to output text, help and docs there, and rebase on `main` before pushing.
- Existing cases under `pkg/conformance/install/` and the scenario goldens may pin today's text. If a golden changes only because your wording changed, list each one in the pull request body, with the old and new text, for the coordinator to approve. Never edit an independent case yourself.
- This group is many small changes: commit one per AB item, so each is easy to review.
