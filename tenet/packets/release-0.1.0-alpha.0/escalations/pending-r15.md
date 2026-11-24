# CP-0059 packaging question

PRD D7 calls for release fixtures and scenarios from alpha.0, while tech spec §6.1 identifies the five rules that run in this release and §13 catalogs conformance across later releases. The documents do not enumerate the exact npm fixture allowlist.

**Proposed alpha.0 boundary.** Publish the algorithm, structure, context, onboarding, card, board, install, and end-to-end scenario suites assigned to alpha.0. Keep the install suite because CP-0010 is part of the alpha.0 release gate. Publish gate, event, decision, full-board, replay and trust, signed evidence, kernel, red-team, reference, and evaluator-trial suites when their respective release includes them. The shared independent index links to all stages, so it stays in the source repository. Host and migration directories currently contribute no files. Confirm the suite list and whether future releases should include a release-specific index.
