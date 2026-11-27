# CP-0054 remaining check findings

The unscoped `node dist/cli.js check --json` reports **141 findings**, compared with **211** before this packet. The scoped check of all nine prepared files reports 0. A dash in the line column means the checker reported the whole file.

## Scope defect (93)

These paths enter the report through the whole-repository ladder. See [scope-r10.md](scope-r10.md).


### `kit/templates/design.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| 22 | TN-CITE-FILE | advise | Cited file src/checkout/retry.ts was not found. |

### `kit/templates/escalation.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| — | TN-SCHEMA | error | File kit/templates/escalation.md failed spec-front-matter schema validation at /tenet/doc. |

### `kit/templates/intent.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| 23 | TN-SPEC-DUP-ID | error | Duplicate specification ID V-1. |
| 23 | TN-SPEC-DUP-ID | error | Duplicate specification ID V-1. |
| 23 | TN-SPEC-REQ-META | error | Requirement metadata is malformed: check closing braces, allowed keys, and origin. |
| 31 | TN-CITE-FILE | advise | Cited file src/checkout/retry.ts was not found. |

### `kit/templates/plan.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| 28 | TN-CITE-FILE | advise | Cited file docs/roadmap.md was not found. |

### `kit/templates/requirements.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| 22 | TN-CITE-FILE | advise | Cited file src/checkout/retry.ts was not found. |
| 22 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |
| 22 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |
| 23 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-2. |
| 23 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-2. |
| 27 | TN-CITE-FILE | advise | Cited file docs/payments.md was not found. |
| 27 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-3. |
| 27 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-3. |

### `kit/templates/vision.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| 33 | TN-SPEC-REQ-META | error | Requirement metadata is malformed: check closing braces, allowed keys, and origin. |
| 39 | TN-SPEC-REQ-META | error | Requirement metadata is malformed: check closing braces, allowed keys, and origin. |
| 45 | TN-SPEC-REQ-META | error | Requirement metadata is malformed: check closing braces, allowed keys, and origin. |
| 51 | TN-SPEC-REQ-META | error | Requirement metadata is malformed: check closing braces, allowed keys, and origin. |
| 57 | TN-SPEC-REQ-META | error | Requirement metadata is malformed: check closing braces, allowed keys, and origin. |
| 65 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 66 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 67 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 68 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 69 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |

### `pkg/conformance/scenarios/s01-tagged-test-never-ran/before/tenet/intent.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| — | TN-SCHEMA | error | File pkg/conformance/scenarios/s01-tagged-test-never-ran/before/tenet/intent.md failed spec-front-matter schema validation at /sections/requirements/flags. |
| 6 | TN-SPEC-BLESSED-COPY | error | Blessed copy for section requirements is missing or changed on disk. |
| 7 | TN-CITE-FILE | advise | Cited file src/retry.ts was not found. |
| 7 | TN-CITE-FILE | advise | Cited file test/retry.test.ts was not found. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |

### `pkg/conformance/scenarios/s02-implements-changed-same-commit/before/tenet/intent.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| — | TN-SCHEMA | error | File pkg/conformance/scenarios/s02-implements-changed-same-commit/before/tenet/intent.md failed spec-front-matter schema validation at /sections/requirements/flags. |
| 6 | TN-SPEC-BLESSED-COPY | error | Blessed copy for section requirements is missing or changed on disk. |
| 7 | TN-CITE-FILE | advise | Cited file src/retry.ts was not found. |
| 7 | TN-CITE-FILE | advise | Cited file test/retry.test.ts was not found. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |
| 8 | TN-CITE-FILE | advise | Cited file src/retry.ts was not found. |
| 8 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-2. |
| 8 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-2. |
| 8 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-2. |

### `pkg/conformance/scenarios/s03-advisory-and-enforced-failure/before/tenet/intent.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |

### `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/before/tenet/specs/prd.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| — | TN-SCHEMA | error | File pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/before/tenet/specs/prd.md failed spec-front-matter schema validation at /sections/requirements/flags. |
| 6 | TN-SPEC-BLESSED-COPY | error | Blessed copy for section requirements is missing or changed on disk. |
| 7 | TN-CITE-FILE | advise | Cited file src/retry.ts was not found. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |

### `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/before/tenet/vision.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| 6 | TN-SPEC-BLESSED-COPY | error | Blessed copy for section vision is missing or changed on disk. |

### `pkg/conformance/scenarios/s05-global-rule-budget-pressure/before/tenet/specs/prd.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| — | TN-SCHEMA | error | File pkg/conformance/scenarios/s05-global-rule-budget-pressure/before/tenet/specs/prd.md failed spec-front-matter schema validation at /sections/requirements/flags. |
| 6 | TN-SPEC-BLESSED-COPY | error | Blessed copy for section requirements is missing or changed on disk. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |
| 8 | TN-CITE-FILE | advise | Cited file src/checkout/pay.ts was not found. |
| 8 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-2. |
| 8 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-2. |
| 9 | TN-CITE-FILE | advise | Cited file src/checkout/pay.ts was not found. |
| 9 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-3. |
| 9 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-3. |

### `pkg/conformance/scenarios/s05-global-rule-budget-pressure/before/tenet/vision.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| 6 | TN-SPEC-BLESSED-COPY | error | Blessed copy for section vision is missing or changed on disk. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID V-1. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID V-1. |

### `pkg/conformance/scenarios/s06-change-to-shared-helper/before/tenet/intent.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| — | TN-SCHEMA | error | File pkg/conformance/scenarios/s06-change-to-shared-helper/before/tenet/intent.md failed spec-front-matter schema validation at /sections/requirements/flags. |
| 6 | TN-SPEC-BLESSED-COPY | error | Blessed copy for section requirements is missing or changed on disk. |
| 7 | TN-CITE-FILE | advise | Cited file src/shared/http.ts was not found. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |
| 8 | TN-CITE-FILE | advise | Cited file src/billing/charge.ts was not found. |
| 8 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-2. |
| 8 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-2. |

### `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/before/tenet/specs/prd.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| — | TN-SCHEMA | error | File pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/before/tenet/specs/prd.md failed spec-front-matter schema validation at /sections/requirements/flags. |
| 6 | TN-SPEC-BLESSED-COPY | error | Blessed copy for section requirements is missing or changed on disk. |
| 7 | TN-CITE-FILE | advise | Cited file src/retry.ts was not found. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |

### `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/before/tenet/vision.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| 6 | TN-SPEC-BLESSED-COPY | error | Blessed copy for section vision is missing or changed on disk. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID V-1. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID V-1. |

### `pkg/conformance/scenarios/s09-renamed-heading/before/tenet/specs/prd.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| — | TN-SCHEMA | error | File pkg/conformance/scenarios/s09-renamed-heading/before/tenet/specs/prd.md failed spec-front-matter schema validation at /sections/checkout-retries/flags. |
| 6 | TN-SPEC-BLESSED-COPY | error | Blessed copy for section checkout-retries is missing or changed on disk. |
| 7 | TN-CITE-FILE | advise | Cited file test/retry.test.ts was not found. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |

### `pkg/conformance/scenarios/s09-renamed-heading/before/tenet/vision.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| 6 | TN-SPEC-BLESSED-COPY | error | Blessed copy for section vision is missing or changed on disk. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID V-1. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID V-1. |

### `pkg/conformance/scenarios/s10-pr-closed-without-merging/before/tenet/intent.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| — | TN-SCHEMA | error | File pkg/conformance/scenarios/s10-pr-closed-without-merging/before/tenet/intent.md failed spec-front-matter schema validation at /sections/requirements/flags. |
| 6 | TN-SPEC-BLESSED-COPY | error | Blessed copy for section requirements is missing or changed on disk. |
| 7 | TN-CITE-FILE | advise | Cited file src/retry.ts was not found. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |
| 7 | TN-SPEC-DUP-ID | error | Duplicate specification ID R-1. |

### `tenet/packets/CP-0058-medium-model-trial/escalations/E-0002.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| — | TN-SCHEMA | error | File tenet/packets/CP-0058-medium-model-trial/escalations/E-0002.md failed spec-front-matter schema validation at /tenet/doc. |

## Other tracks’ files (0)

The current run reports no finding for the parallel tracks’ `contracts.md`, `algorithms.md`, `onboarding.md`, `ci.md`, `messages.md`, `evidence.md`, or `plan/*.md`. Recheck these paths after those tracks merge and become active documents.


## Vision (48)

The Owner can review and apply [vision.patch](vision.patch). The candidate passed the isolated check. Blessing is CP-0057.


### `tenet/vision.md`

| Line | Code | Severity | Message |
|---:|---|---|---|
| — | TN-SPEC-NO-FRONT | error | Specification file has no valid YAML front matter. |
| 21 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 22 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 23 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 24 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 25 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 26 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 27 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 28 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 29 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 35 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 36 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 37 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 38 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 39 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 40 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 41 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 42 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 43 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 44 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 45 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 57 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 58 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 59 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 60 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 61 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 69 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 70 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 71 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 72 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 73 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 74 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 75 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 76 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 77 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 78 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 79 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 80 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 86 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 87 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 88 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 89 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 90 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 91 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 92 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 93 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 94 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |
| 95 | TN-SPEC-MISSING-ID | error | Specification line needs an ID. |

## Anything else (0)

None.
