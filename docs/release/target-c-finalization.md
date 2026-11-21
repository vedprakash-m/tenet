# Target C finalization gates

This is a readiness checklist, not release approval. No unchecked item may be
treated as complete by a source pass, local CI run or draft release.

## Source and candidate

- [ ] All intended source, plugin, test, documentation and evidence-ledger
  changes are recorded in `CHANGELOG.md` and `specs/re-plan.md`.
- [ ] `npm run ci` passes on the exact committed source.
- [ ] `npm run uat` passes against the bundle built from that source.
- [ ] `npm run privacy` and
  `node tools/privacy-check.ts --range <base>..<candidate>` produce reviewed
  results; neither result is proof of a clean history.
- [ ] The 181 Must ledger reconciles to the PRD with no integrity errors.
- [ ] Every R1 Should has an owner-approved pass or omission in
  `docs/audits/2026-11-21/should-dispositions.md`.
- [ ] A campaign manifest binds all claimed requirements to one qualification
  tuple and one artifact SHA-256.
- [ ] `node tools/release-audit.ts --milestone R1` passes; this does not
  approve omitted Shoulds, residual risk or release ownership.

## Host and human evidence

- [ ] Owner H1 and H2 records exist from the `tenet-spike` VS Code profile.
- [ ] The qualified host tuple records VS Code, Copilot extension, observed
  model, macOS/architecture, Node.js and Git versions.
- [ ] The owner dogfoods one real Tenet change through the installed plugin.
- [ ] Native-host acceptance campaigns are repeated on the qualified tuple and
  retain failures, cancellations and inconclusive runs.
- [ ] The starter ASVS, WCAG/VoiceOver, concurrency, restore and workload
  evidence is complete for the declared local journeys.
- [ ] The 8-12 participant qualification pilot, six formative sessions,
  consent, retention/withdrawal, calibration and value/experience reports are
  complete. No participant or result may be fabricated from source fixtures.

## Public review and repository settings

- [ ] The publication ref is held on a public PR for the required 72 hours.
- [ ] The PR records opening time, earliest merge time, reviewer availability,
  and any external review; automated review is disclosed as not a second
  maintainer.
- [ ] `main` branch protection requires the `untrusted`/`system-budgets`
  validation jobs and prevents an unreviewed direct release path. GitHub API
  observation on 2026-11-21: `main` is not protected and no ruleset is
  returned.
- [ ] Required-review, linear-history/rebase, signed-commit or signed-tag
  rules are recorded as actually configured; the source checkout does not
  prove any setting.
- [x] Private vulnerability reporting is enabled (GitHub API,
  2026-11-21). Secret scanning and push protection are also enabled.
- [ ] Dependabot security updates are enabled. GitHub API observation on
  2026-11-21: disabled; Dependabot alerts/status still require an explicit
  owner check.
- [ ] The protected `release` environment exists with required reviewers.
  GitHub API observation on 2026-11-21: no environment is returned.
- [ ] Maintainer multi-factor authentication and release-role ownership are
  confirmed by the repository owner.

## Publisher and release identity

- [x] Product name is final: "Tenet" (owner, 2026-11-21).
- [ ] Repository, publisher and signing identity are approved.
- [ ] The tag-signing identity exists, is controlled and has a documented
  revocation procedure. Never record a private key in the repository.
- [ ] The pinned release workflow actions and token permissions have been
  reviewed at their pinned commits.
- [ ] A throwaway signed tag has exercised the complete `release` workflow in
  an authorized private test repository or equivalent controlled route.
- [ ] The signed tag, provenance attestation, packed payload verification and
  draft-release creation all have dated observation records.

## Final release

- [ ] `docs/release/notes/v<version>.md` has a truthful written statement in
  every required section and is checked by `tools/release-notes.ts`.
- [ ] The source-tree, reachable-history and package-inclusion reviews are
  complete with no unresolved finding.
- [ ] The exact publication commit has successful main-branch CI.
- [ ] The product owner, release owner and security owner approve the exact
  candidate and disclose residual risks and non-applicability.
- [ ] Publication is an explicit owner action; no agent creates or pushes a
  tag, publishes a release, or claims support without that request.
