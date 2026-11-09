<!-- Signing, attestation, branch protection and the release environment remain unobserved. Not a release approval. -->
# Release verification and release notes

This describes the approved chain of PRD section 5.9.2 implemented in `.github/workflows/release.yml`, the release notes mechanism (LFC-02), and the steps a user would follow to check an installed payload. Static tests and ordinary CI can establish individual code/build controls, not an end-to-end published release. Signing, attestation, repository settings and installed-host behavior remain unobserved until exercised.

## The chain, link by link

| Link (PRD 5.9.2) | Control in the candidate | Verified how | Status |
|---|---|---|---|
| Reviewed source | The `gate` job requires the tagged commit to be an ancestor of `origin/main`. Branch protection itself is a repository setting. | `git merge-base --is-ancestor` in the workflow. Published branch protection settings (owner action). | Workflow unobserved. Protection not set up or published. |
| Build inputs | Locked install (`npm ci --ignore-scripts --no-audit`), every action pinned to a full commit SHA. | `ci-security.test.ts` and `release-workflow.test.ts` read the YAML. | Static check passes locally; the run is unobserved. |
| Produced artifact | `npm run build`, `verify:payload`, `verify:reproducible`, then a deterministic pack (`tar --sort=name --mtime=@0`, `gzip -n`). | The workflow runs them. The double build compares two outputs from one source and toolchain on one runner. | Unobserved in CI. An independent rebuild (second party or environment) is not built. |
| Published artifact | Signed annotated tag (checked through GitHub's recorded verification) and a build-provenance attestation over the packed payload. | `gh attestation verify` in the `publish` job, before a draft release is created. | Unobserved. No signing identity exists (external request 4). |
| Installed artifact | The manual procedure below. `inspect doctor` does not yet verify the installed payload (TS section 18). | A user runs the steps. | Unobserved. |

Other controls the workflow relies on and does not create: mandatory two-factor authentication for maintainers, a protected `release` environment with required reviewers (release credentials stay in `publish` only), and the solo-maintainer review rule with its 72-hour public window. All are settings or practices outside the repository.

The PR template requires compatibility classification and disclosure of a solo-maintainer review. Release notes retain that disclosure: a public PR waits at least 72 hours, then the owner may merge; without a second maintainer the notes say no second-maintainer review occurred. `npm run verify:semver` checks strict SemVer and kernel/plugin equality; untrusted CI also refuses regression from the event base. These process controls do not infer whether a particular change deserves a major, minor or patch increment.

## What the workflow checks before it builds

The `gate` job fails the run if any of these is false: the commit is on `main`; the tag is annotated and GitHub reports its signature as verified; the `untrusted` workflow succeeded on the same commit; the tag equals `v` plus the `plugin/plugin.json` version; `docs/release/notes/<tag>.md` has a written statement in every section (`node tools/release-notes.ts --check`); and `node tools/release-audit.ts --milestone R1` passes. The last check fails today, by design: no due Must is qualified. The workflow therefore cannot produce a release until that changes. The `publish` job creates a draft release only; the owner publishes it by hand.

## Release notes (LFC-02)

**Location (assumption).** The specs do not say where release notes live. This candidate keeps them in the repository at `docs/release/notes/v<version>.md`, so the review window and the release use the same text, and the draft release takes them as its body. If the owner prefers the GitHub release page as the only location, the file can remain the source and only the final copy moves.

**Contents.** TS section 18 item 3 names five disclosures and a support matrix: changed permissions, destinations, executables, schemas, evaluated behavior, and the support matrix. PRD LFC-02 also names evaluators, which TS section 18 omits (logged in plan section 12.3). The draft has a section for each of those seven, a repository-facts section, and the solo-maintainer disclosure of PRD section 5.9.2 and ENG-11.

**Use.**

1. `node tools/release-notes.ts --write` creates `docs/release/notes/v<version>.md` from repository facts (it will not overwrite an existing file). Add `--base <ref>` to compare with a ref other than the newest `v*` tag. Without a base, every section says so.
2. For each section, the draft lists changed paths in the usual locations for that item. That is a pointer, not a classification: a change can matter without touching those paths, and a listed path may not change the item. Write a `Statement:` line yourself, including "No change." where that is true.
3. `node tools/release-notes.ts --check <file>` fails while any section is missing or its statement is empty or still `TODO(release-notes)`. It checks that a statement exists, not that it is correct. A reviewer still reads the notes against the diff.
4. The facts section copies R1 mapping from `tools/coverage.ts`, compares it with the plan dashboard figure, and lists unchecked boxes of plan sections 9.5 and 4.5 and the known-limits sentence of TS section 18. Re-check these by hand before release: they are only as current as the plan.

## Installed-payload verification (manual procedure)

Intended steps for a user who downloaded a release. None has been run against a published release.

1. Check the tag. In a clone, `git tag -v v<version>` against the maintainer's published signing key, or confirm GitHub shows the tag as verified. Compare the commit with the source you expect.
2. Check the downloaded file against its attestation: `gh attestation verify tenet-plugin-v<version>.tgz --repo <owner>/<repository>`. A pass says this repository's release workflow produced that file from a recorded commit. It does not say the source is safe.
3. Check the file hash: `sha256sum -c tenet-plugin-v<version>.tgz.sha256`.
4. Unpack into an empty folder and, inside it, run `sha256sum -c SHA256SUMS`. The file lists every payload file except itself. Any mismatch, or a file in the folder that `SHA256SUMS` does not list, means the payload is not the released one.
5. Compare `plugin.json` `version` with the tag, and send `/tenet help` in the host to see the version and source the running plugin reports (PRD section 5.9.2, installed artifact). What the host shows for a plugin copy under its own `agentPlugins/` folder is unobserved; rerun step 4 on that copy.

Not covered: verification by `inspect doctor` or at startup (not built), a check that the host runs the verified copy rather than an older snapshot (the preview route saw stale snapshots, `docs/user/install-and-remove.md`), and authenticity of the signing key itself.

## Before the first real release

- Observe every link above on a throwaway tag in a private repository, and record dated results (plan status `🔬` needs a real-host observation; CI is not the installed host).
- Confirm the pinned action versions and their input and permission requirements against each action's documentation at the pinned commit. The attestation action may need further token permissions; this was not checked.
- Provide the signing identity and the publisher name (external request 4), enable branch protection and create the `release` environment.
- Decide whether `inspect doctor` should verify the installed payload; that is a kernel change and needs capacity (plan section 13, size ceiling).
