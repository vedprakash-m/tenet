# Pre-publication source review

Complete and record these reviews against the exact publication ref. An unresolved finding blocks publication.

## Source tree review

Review tracked, untracked and ignored files in the release checkout for private material, credentials, personal paths and addresses. Use `git status --short --ignored` and `git ls-files --cached --others --exclude-standard` to establish the file population; inspect the content, not only the names. Confirm `.env*`, `.tenet/`, local captures and other secret stores are excluded and are not staged. `npm run privacy` checks staged added lines for likely leaks; it is a useful filter, not proof that the source tree is clean.

## Reachable history review

Enumerate every commit reachable from the exact publication ref, including merge commits and the root commit. Review the reachable commit content for private material independently of the current source tree and package contents. `node tools/privacy-check.ts --range <base>..<ref>` checks added lines in that range only; it is supplemental and does not replace review of all reachable history.

## Package inclusion review

Package inclusion review is separate from both source-tree and history review. Inspect the built payload against the approved inclusion list and run the repository's payload verification. A clean package does not establish that the source tree or reachable history contains no private material, and a clean source review does not establish that the package contains only approved files.

## Review record

Record the reviewer, publication ref, date, source-tree result, reachable-history result, package-inclusion result, findings and disposition. Do not publish while any finding is unresolved or any of the three reviews is incomplete.
