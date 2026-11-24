# Pack Smoke Test - 2026-11-24

## Environment

- Harness commit: `dd03350f45c3c99ae175b4134c569f1359bfb1cb`
- Branch: `r8/pack-smoke`
- Source: `Q:\Ved\Pers\tenet`
- Scratch: `C:\Users\vemishra\AppData\Local\Temp\tenet-pack-smoke-pfOItB`
- Tarball: `C:\Users\vemishra\AppData\Local\Temp\tenet-pack-smoke-pfOItB\pack\vedprakash-m-tenet-0.0.0.tgz`
- Tarball size: 1069716 bytes
- Tarball file count: 1073

## Build and pack

- git pull --ff-only: exit 0, 2.023s
- npm ci: exit 0, 32.470s
- npm run build: exit 0, 21.313s
- npm pack --json: exit 0, 28.424s
- npm install <tarball>: exit 1, 85.089s

### Registry install

- Status: FAILED
- npm error: npm error code ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE
- Fallback: registry install unavailable: smoke used local extraction

## pkg/conformance files grouped by suite

### alg-02

Count: 21

- `pkg/conformance/alg-02/README.md`
- `pkg/conformance/alg-02/n01-duplicate-slug/expected.json`
- `pkg/conformance/alg-02/n01-duplicate-slug/input.json`
- `pkg/conformance/alg-02/n02-ambiguous-rename/expected.json`
- `pkg/conformance/alg-02/n02-ambiguous-rename/input.json`
- `pkg/conformance/alg-02/n03-missing-front/expected.json`
- `pkg/conformance/alg-02/n03-missing-front/input.json`
- `pkg/conformance/alg-02/n04-invalid-origin/expected.json`
- `pkg/conformance/alg-02/n04-invalid-origin/input.json`
- `pkg/conformance/alg-02/p01-leading-preamble/expected.json`
- `pkg/conformance/alg-02/p01-leading-preamble/input.json`
- `pkg/conformance/alg-02/p02-four-backtick-fence/expected.json`
- `pkg/conformance/alg-02/p02-four-backtick-fence/input.json`
- `pkg/conformance/alg-02/p03-unicode-and-empty-slug/expected.json`
- `pkg/conformance/alg-02/p03-unicode-and-empty-slug/input.json`
- `pkg/conformance/alg-02/p04-normalized-bodies/expected.json`
- `pkg/conformance/alg-02/p04-normalized-bodies/input.json`
- `pkg/conformance/alg-02/p05-rename-digest/expected.json`
- `pkg/conformance/alg-02/p05-rename-digest/input.json`
- `pkg/conformance/alg-02/p06-requirement-prefix/expected.json`
- `pkg/conformance/alg-02/p06-requirement-prefix/input.json`

### alg-03

Count: 25

- `pkg/conformance/alg-03/README.md`
- `pkg/conformance/alg-03/n01-ambiguous-relocation/expected.json`
- `pkg/conformance/alg-03/n01-ambiguous-relocation/input.json`
- `pkg/conformance/alg-03/n02-missing-source/expected.json`
- `pkg/conformance/alg-03/n02-missing-source/input.json`
- `pkg/conformance/alg-03/n03-edited-intent/expected.json`
- `pkg/conformance/alg-03/n03-edited-intent/input.json`
- `pkg/conformance/alg-03/n04-unblessed-stale-metadata/expected.json`
- `pkg/conformance/alg-03/n04-unblessed-stale-metadata/input.json`
- `pkg/conformance/alg-03/n05-ambiguous-moved-anchor/expected.json`
- `pkg/conformance/alg-03/n05-ambiguous-moved-anchor/input.json`
- `pkg/conformance/alg-03/p01-path-anchor/expected.json`
- `pkg/conformance/alg-03/p01-path-anchor/input.json`
- `pkg/conformance/alg-03/p02-peer-test-anchor/expected.json`
- `pkg/conformance/alg-03/p02-peer-test-anchor/input.json`
- `pkg/conformance/alg-03/p03-doc-anchor/expected.json`
- `pkg/conformance/alg-03/p03-doc-anchor/input.json`
- `pkg/conformance/alg-03/p04-unique-relocation/expected.json`
- `pkg/conformance/alg-03/p04-unique-relocation/input.json`
- `pkg/conformance/alg-03/p05-clean-moved-anchor/expected.json`
- `pkg/conformance/alg-03/p05-clean-moved-anchor/input.json`
- `pkg/conformance/alg-03/p06-owner-precedence/expected.json`
- `pkg/conformance/alg-03/p06-owner-precedence/input.json`
- `pkg/conformance/alg-03/p07-owner-last-match/expected.json`
- `pkg/conformance/alg-03/p07-owner-last-match/input.json`

### alg-04

Count: 23

- `pkg/conformance/alg-04/README.md`
- `pkg/conformance/alg-04/n01-missing-file/expected.json`
- `pkg/conformance/alg-04/n01-missing-file/input.json`
- `pkg/conformance/alg-04/n02-backward-range/expected.json`
- `pkg/conformance/alg-04/n02-backward-range/input.json`
- `pkg/conformance/alg-04/n03-missing-heading/expected.json`
- `pkg/conformance/alg-04/n03-missing-heading/input.json`
- `pkg/conformance/alg-04/n04-reversed-test-segments/expected.json`
- `pkg/conformance/alg-04/n04-reversed-test-segments/input.json`
- `pkg/conformance/alg-04/n05-out-of-range/expected.json`
- `pkg/conformance/alg-04/n05-out-of-range/input.json`
- `pkg/conformance/alg-04/p01-single-line/expected.json`
- `pkg/conformance/alg-04/p01-single-line/input.json`
- `pkg/conformance/alg-04/p02-full-range/expected.json`
- `pkg/conformance/alg-04/p02-full-range/input.json`
- `pkg/conformance/alg-04/p03-doc-heading/expected.json`
- `pkg/conformance/alg-04/p03-doc-heading/input.json`
- `pkg/conformance/alg-04/p04-nested-test/expected.json`
- `pkg/conformance/alg-04/p04-nested-test/input.json`
- `pkg/conformance/alg-04/p05-python-test/expected.json`
- `pkg/conformance/alg-04/p05-python-test/input.json`
- `pkg/conformance/alg-04/p06-go-test/expected.json`
- `pkg/conformance/alg-04/p06-go-test/input.json`

### alg-08

Count: 1

- `pkg/conformance/alg-08/cases.json`

### alg-09

Count: 1

- `pkg/conformance/alg-09/cases.json`

### alg-10

Count: 33

- `pkg/conformance/alg-10/README.md`
- `pkg/conformance/alg-10/n01-no-blessed-material/expected.json`
- `pkg/conformance/alg-10/n01-no-blessed-material/input.json`
- `pkg/conformance/alg-10/n02-rejected-section/expected.json`
- `pkg/conformance/alg-10/n02-rejected-section/input.json`
- `pkg/conformance/alg-10/n03-broken-blessed-copy/expected.json`
- `pkg/conformance/alg-10/n03-broken-blessed-copy/input.json`
- `pkg/conformance/alg-10/n04-local-omitted/expected.json`
- `pkg/conformance/alg-10/n04-local-omitted/input.json`
- `pkg/conformance/alg-10/n05-over-budget-explicit-id/expected.json`
- `pkg/conformance/alg-10/n05-over-budget-explicit-id/input.json`
- `pkg/conformance/alg-10/n06-unknown-method/expected.json`
- `pkg/conformance/alg-10/n06-unknown-method/input.json`
- `pkg/conformance/alg-10/p01-path-admitted/expected.json`
- `pkg/conformance/alg-10/p01-path-admitted/input.json`
- `pkg/conformance/alg-10/p02-retry-once-source-changed/expected.json`
- `pkg/conformance/alg-10/p02-retry-once-source-changed/input.json`
- `pkg/conformance/alg-10/p03-id-and-path-deduplicate/expected.json`
- `pkg/conformance/alg-10/p03-id-and-path-deduplicate/input.json`
- `pkg/conformance/alg-10/p04-include-draft-with-blessing/expected.json`
- `pkg/conformance/alg-10/p04-include-draft-with-blessing/input.json`
- `pkg/conformance/alg-10/p05-no-inputs-global-and-index/expected.json`
- `pkg/conformance/alg-10/p05-no-inputs-global-and-index/input.json`
- `pkg/conformance/alg-10/p06-checked-policy-rule/expected.json`
- `pkg/conformance/alg-10/p06-checked-policy-rule/input.json`
- `pkg/conformance/alg-10/p07-mcp-session/expected.json`
- `pkg/conformance/alg-10/p07-mcp-session/input.json`
- `pkg/conformance/alg-10/p08-applies-to-prose/expected.json`
- `pkg/conformance/alg-10/p08-applies-to-prose/input.json`
- `pkg/conformance/alg-10/p09-global-beyond-reserve/expected.json`
- `pkg/conformance/alg-10/p09-global-beyond-reserve/input.json`
- `pkg/conformance/alg-10/p10-query-case-insensitive/expected.json`
- `pkg/conformance/alg-10/p10-query-case-insensitive/input.json`

### alg-11

Count: 27

- `pkg/conformance/alg-11/README.md`
- `pkg/conformance/alg-11/n01-no-commits-refused/expected.json`
- `pkg/conformance/alg-11/n01-no-commits-refused/input.json`
- `pkg/conformance/alg-11/n02-secrets-and-env-skipped/expected.json`
- `pkg/conformance/alg-11/n02-secrets-and-env-skipped/input.json`
- `pkg/conformance/alg-11/n03-generated-vendored-and-tests-excluded-from-size/expected.json`
- `pkg/conformance/alg-11/n03-generated-vendored-and-tests-excluded-from-size/input.json`
- `pkg/conformance/alg-11/n04-binary-oversize-and-onboard-exclude-skipped/expected.json`
- `pkg/conformance/alg-11/n04-binary-oversize-and-onboard-exclude-skipped/input.json`
- `pkg/conformance/alg-11/n05-uncommitted-worktree-source-ignored/expected.json`
- `pkg/conformance/alg-11/n05-uncommitted-worktree-source-ignored/input.json`
- `pkg/conformance/alg-11/p01-small-one-file-service/expected.json`
- `pkg/conformance/alg-11/p01-small-one-file-service/input.json`
- `pkg/conformance/alg-11/p02-four-codeowners-areas-separate/expected.json`
- `pkg/conformance/alg-11/p02-four-codeowners-areas-separate/input.json`
- `pkg/conformance/alg-11/p03-twenty-thousand-lines-separate/expected.json`
- `pkg/conformance/alg-11/p03-twenty-thousand-lines-separate/input.json`
- `pkg/conformance/alg-11/p04-merge-small-unit-into-neighbor/expected.json`
- `pkg/conformance/alg-11/p04-merge-small-unit-into-neighbor/input.json`
- `pkg/conformance/alg-11/p05-layout-override/expected.json`
- `pkg/conformance/alg-11/p05-layout-override/input.json`
- `pkg/conformance/alg-11/p06-cli-kind-and-instruction-files/expected.json`
- `pkg/conformance/alg-11/p06-cli-kind-and-instruction-files/input.json`
- `pkg/conformance/alg-11/p07-local-test-report-in-observations/expected.json`
- `pkg/conformance/alg-11/p07-local-test-report-in-observations/input.json`
- `pkg/conformance/alg-11/p08-first-findings-all-four-kinds/expected.json`
- `pkg/conformance/alg-11/p08-first-findings-all-four-kinds/input.json`

### alg-14

Count: 27

- `pkg/conformance/alg-14/README.md`
- `pkg/conformance/alg-14/n01-draft-implements/expected.json`
- `pkg/conformance/alg-14/n01-draft-implements/input.json`
- `pkg/conformance/alg-14/n02-outside-replacement/expected.json`
- `pkg/conformance/alg-14/n02-outside-replacement/input.json`
- `pkg/conformance/alg-14/n03-insertion-at-end/expected.json`
- `pkg/conformance/alg-14/n03-insertion-at-end/input.json`
- `pkg/conformance/alg-14/n04-same-owner-different-rule/expected.json`
- `pkg/conformance/alg-14/n04-same-owner-different-rule/input.json`
- `pkg/conformance/alg-14/n05-missing-implements/expected.json`
- `pkg/conformance/alg-14/n05-missing-implements/input.json`
- `pkg/conformance/alg-14/p01-implements-first/expected.json`
- `pkg/conformance/alg-14/p01-implements-first/input.json`
- `pkg/conformance/alg-14/p02-overlapping-replacement/expected.json`
- `pkg/conformance/alg-14/p02-overlapping-replacement/input.json`
- `pkg/conformance/alg-14/p03-interior-insertion/expected.json`
- `pkg/conformance/alg-14/p03-interior-insertion/input.json`
- `pkg/conformance/alg-14/p04-text-changed/expected.json`
- `pkg/conformance/alg-14/p04-text-changed/input.json`
- `pkg/conformance/alg-14/p05-same-folder/expected.json`
- `pkg/conformance/alg-14/p05-same-folder/input.json`
- `pkg/conformance/alg-14/p06-codeowners-priority/expected.json`
- `pkg/conformance/alg-14/p06-codeowners-priority/input.json`
- `pkg/conformance/alg-14/p07-same-area-cap/expected.json`
- `pkg/conformance/alg-14/p07-same-area-cap/input.json`
- `pkg/conformance/alg-14/p08-deleted-document/expected.json`
- `pkg/conformance/alg-14/p08-deleted-document/input.json`

### board

Count: 34

- `pkg/conformance/board/README.md`
- `pkg/conformance/board/n01-no-specifications/expected.json`
- `pkg/conformance/board/n01-no-specifications/expected.md`
- `pkg/conformance/board/n01-no-specifications/input.json`
- `pkg/conformance/board/n02-broken-citation/expected.json`
- `pkg/conformance/board/n02-broken-citation/expected.md`
- `pkg/conformance/board/n02-broken-citation/input.json`
- `pkg/conformance/board/n03-untested-requirement/expected.json`
- `pkg/conformance/board/n03-untested-requirement/expected.md`
- `pkg/conformance/board/n03-untested-requirement/input.json`
- `pkg/conformance/board/n04-over-budget/expected.json`
- `pkg/conformance/board/n04-over-budget/expected.md`
- `pkg/conformance/board/n04-over-budget/input.json`
- `pkg/conformance/board/p01-fresh-draft/expected.json`
- `pkg/conformance/board/p01-fresh-draft/expected.md`
- `pkg/conformance/board/p01-fresh-draft/input.json`
- `pkg/conformance/board/p02-half-blessed/expected.json`
- `pkg/conformance/board/p02-half-blessed/expected.md`
- `pkg/conformance/board/p02-half-blessed/input.json`
- `pkg/conformance/board/p03-sources-changed/expected.json`
- `pkg/conformance/board/p03-sources-changed/expected.md`
- `pkg/conformance/board/p03-sources-changed/input.json`
- `pkg/conformance/board/p04-clean-all/expected.json`
- `pkg/conformance/board/p04-clean-all/expected.md`
- `pkg/conformance/board/p04-clean-all/input.json`
- `pkg/conformance/board/p05-clean-default/expected.json`
- `pkg/conformance/board/p05-clean-default/expected.md`
- `pkg/conformance/board/p05-clean-default/input.json`
- `pkg/conformance/board/p06-edited-only/expected.json`
- `pkg/conformance/board/p06-edited-only/expected.md`
- `pkg/conformance/board/p06-edited-only/input.json`
- `pkg/conformance/board/p07-ux-part-2/expected.json`
- `pkg/conformance/board/p07-ux-part-2/expected.md`
- `pkg/conformance/board/p07-ux-part-2/input.json`

### card

Count: 43

- `pkg/conformance/card/README.md`
- `pkg/conformance/card/n01-no-acceptance-block/expected.json`
- `pkg/conformance/card/n01-no-acceptance-block/expected.md`
- `pkg/conformance/card/n01-no-acceptance-block/input.json`
- `pkg/conformance/card/n02-malformed-acceptance-block/expected.json`
- `pkg/conformance/card/n02-malformed-acceptance-block/expected.md`
- `pkg/conformance/card/n02-malformed-acceptance-block/input.json`
- `pkg/conformance/card/n03-report-missing-not-checked/expected.json`
- `pkg/conformance/card/n03-report-missing-not-checked/expected.md`
- `pkg/conformance/card/n03-report-missing-not-checked/input.json`
- `pkg/conformance/card/n04-nonzero-exit-after-passing-report/expected.json`
- `pkg/conformance/card/n04-nonzero-exit-after-passing-report/expected.md`
- `pkg/conformance/card/n04-nonzero-exit-after-passing-report/input.json`
- `pkg/conformance/card/n05-bundle-refused-and-records-not-kept/expected.json`
- `pkg/conformance/card/n05-bundle-refused-and-records-not-kept/expected.md`
- `pkg/conformance/card/n05-bundle-refused-and-records-not-kept/input.json`
- `pkg/conformance/card/n06-policy-load-failure-fallback/expected.json`
- `pkg/conformance/card/n06-policy-load-failure-fallback/expected.md`
- `pkg/conformance/card/n06-policy-load-failure-fallback/input.json`
- `pkg/conformance/card/p01-clean-pass-success/expected.json`
- `pkg/conformance/card/p01-clean-pass-success/expected.md`
- `pkg/conformance/card/p01-clean-pass-success/input.json`
- `pkg/conformance/card/p02-no-blessed-intent-badge/expected.json`
- `pkg/conformance/card/p02-no-blessed-intent-badge/expected.md`
- `pkg/conformance/card/p02-no-blessed-intent-badge/input.json`
- `pkg/conformance/card/p03-matrix-shards-and-retry-merge/expected.json`
- `pkg/conformance/card/p03-matrix-shards-and-retry-merge/expected.md`
- `pkg/conformance/card/p03-matrix-shards-and-retry-merge/input.json`
- `pkg/conformance/card/p04-blessings-changed-and-requirement-deltas/expected.json`
- `pkg/conformance/card/p04-blessings-changed-and-requirement-deltas/expected.md`
- `pkg/conformance/card/p04-blessings-changed-and-requirement-deltas/input.json`
- `pkg/conformance/card/p05-workflow-and-protected-surfaces-would-block/expected.json`
- `pkg/conformance/card/p05-workflow-and-protected-surfaces-would-block/expected.md`
- `pkg/conformance/card/p05-workflow-and-protected-surfaces-would-block/input.json`
- `pkg/conformance/card/p06-test-weakening-would-block/expected.json`
- `pkg/conformance/card/p06-test-weakening-would-block/expected.md`
- `pkg/conformance/card/p06-test-weakening-would-block/input.json`
- `pkg/conformance/card/p07-only-skipped-cases/expected.json`
- `pkg/conformance/card/p07-only-skipped-cases/expected.md`
- `pkg/conformance/card/p07-only-skipped-cases/input.json`
- `pkg/conformance/card/p08-coverage-not-confirmed/expected.json`
- `pkg/conformance/card/p08-coverage-not-confirmed/expected.md`
- `pkg/conformance/card/p08-coverage-not-confirmed/input.json`

### check

Count: 37

- `pkg/conformance/check/README.md`
- `pkg/conformance/check/n01-missing-citation-file/expected.json`
- `pkg/conformance/check/n01-missing-citation-file/input.json`
- `pkg/conformance/check/n02-citation-out-of-range/expected.json`
- `pkg/conformance/check/n02-citation-out-of-range/input.json`
- `pkg/conformance/check/n03-missing-citation-heading/expected.json`
- `pkg/conformance/check/n03-missing-citation-heading/input.json`
- `pkg/conformance/check/n04-missing-citation-test/expected.json`
- `pkg/conformance/check/n04-missing-citation-test/input.json`
- `pkg/conformance/check/n05-changed-blessed-copy/expected.json`
- `pkg/conformance/check/n05-changed-blessed-copy/input.json`
- `pkg/conformance/check/n06-missing-blessed-copy/expected.json`
- `pkg/conformance/check/n06-missing-blessed-copy/input.json`
- `pkg/conformance/check/n07-two-blessed-ids/expected.json`
- `pkg/conformance/check/n07-two-blessed-ids/input.json`
- `pkg/conformance/check/n08-uncovered-vision/expected.json`
- `pkg/conformance/check/n08-uncovered-vision/input.json`
- `pkg/conformance/check/n09-ci-budget-crossing/expected.json`
- `pkg/conformance/check/n09-ci-budget-crossing/input.json`
- `pkg/conformance/check/n10-kit-edited/expected.json`
- `pkg/conformance/check/n10-kit-edited/input.json`
- `pkg/conformance/check/n11-lock-version-mismatch/expected.json`
- `pkg/conformance/check/n11-lock-version-mismatch/input.json`
- `pkg/conformance/check/n12-local-budget-warning/expected.json`
- `pkg/conformance/check/n12-local-budget-warning/input.json`
- `pkg/conformance/check/p01-covered-vision/expected.json`
- `pkg/conformance/check/p01-covered-vision/input.json`
- `pkg/conformance/check/p02-path-citation/expected.json`
- `pkg/conformance/check/p02-path-citation/input.json`
- `pkg/conformance/check/p03-doc-and-test-citations/expected.json`
- `pkg/conformance/check/p03-doc-and-test-citations/input.json`
- `pkg/conformance/check/p04-valid-blessed-copy/expected.json`
- `pkg/conformance/check/p04-valid-blessed-copy/input.json`
- `pkg/conformance/check/p05-unique-across-documents/expected.json`
- `pkg/conformance/check/p05-unique-across-documents/input.json`
- `pkg/conformance/check/p06-matching-lock-and-kit/expected.json`
- `pkg/conformance/check/p06-matching-lock-and-kit/input.json`

### decisions

Count: 31

- `pkg/conformance/decisions/README.md`
- `pkg/conformance/decisions/n01-unlisted-actor-rejected/expected.json`
- `pkg/conformance/decisions/n01-unlisted-actor-rejected/input.json`
- `pkg/conformance/decisions/n02-stale-eval-after-description-edit/expected.json`
- `pkg/conformance/decisions/n02-stale-eval-after-description-edit/input.json`
- `pkg/conformance/decisions/n03-late-reply-past-expiry/expected.json`
- `pkg/conformance/decisions/n03-late-reply-past-expiry/input.json`
- `pkg/conformance/decisions/n04-ambiguous-two-pending-requests/expected.json`
- `pkg/conformance/decisions/n04-ambiguous-two-pending-requests/input.json`
- `pkg/conformance/decisions/n05-concurrent-competing-picks/expected.json`
- `pkg/conformance/decisions/n05-concurrent-competing-picks/input.json`
- `pkg/conformance/decisions/n06-revoked-key-and-verify-self-approve/expected.json`
- `pkg/conformance/decisions/n06-revoked-key-and-verify-self-approve/input.json`
- `pkg/conformance/decisions/p01-make-and-render-request/expected.json`
- `pkg/conformance/decisions/p01-make-and-render-request/input.json`
- `pkg/conformance/decisions/p02-native-approve-binds-commit/expected.json`
- `pkg/conformance/decisions/p02-native-approve-binds-commit/input.json`
- `pkg/conformance/decisions/p03-reply-approve-and-pick/expected.json`
- `pkg/conformance/decisions/p03-reply-approve-and-pick/input.json`
- `pkg/conformance/decisions/p04-self-accepted-below-verify/expected.json`
- `pkg/conformance/decisions/p04-self-accepted-below-verify/input.json`
- `pkg/conformance/decisions/p05-redelivery-and-compatible-duplicates/expected.json`
- `pkg/conformance/decisions/p05-redelivery-and-compatible-duplicates/input.json`
- `pkg/conformance/decisions/p06-reply-bless-exact-section/expected.json`
- `pkg/conformance/decisions/p06-reply-bless-exact-section/input.json`
- `pkg/conformance/decisions/p07-reply-not-useful-finding/expected.json`
- `pkg/conformance/decisions/p07-reply-not-useful-finding/input.json`
- `pkg/conformance/decisions/p08-withdrawn-observation-kept-visible/expected.json`
- `pkg/conformance/decisions/p08-withdrawn-observation-kept-visible/input.json`
- `pkg/conformance/decisions/p09-waiver-by-non-author/expected.json`
- `pkg/conformance/decisions/p09-waiver-by-non-author/input.json`

### evaluator-trial

Count: 2

- `pkg/conformance/evaluator-trial/expected.json`
- `pkg/conformance/evaluator-trial/history.yaml`

### events

Count: 31

- `pkg/conformance/events/README.md`
- `pkg/conformance/events/n01-duplicate-id-distinct-content/expected.json`
- `pkg/conformance/events/n01-duplicate-id-distinct-content/input.json`
- `pkg/conformance/events/n02-missing-predecessor-and-orphan-chain/expected.json`
- `pkg/conformance/events/n02-missing-predecessor-and-orphan-chain/input.json`
- `pkg/conformance/events/n03-cycle-and-cross-work-edge/expected.json`
- `pkg/conformance/events/n03-cycle-and-cross-work-edge/input.json`
- `pkg/conformance/events/n04-no-creation-and-competing-creations/expected.json`
- `pkg/conformance/events/n04-no-creation-and-competing-creations/input.json`
- `pkg/conformance/events/n05-stale-forge-and-incomplete-resolve/expected.json`
- `pkg/conformance/events/n05-stale-forge-and-incomplete-resolve/input.json`
- `pkg/conformance/events/n06-unsupported-legacy-version/expected.json`
- `pkg/conformance/events/n06-unsupported-legacy-version/input.json`
- `pkg/conformance/events/p01-subject-exclusions-and-byte-sort/expected.json`
- `pkg/conformance/events/p01-subject-exclusions-and-byte-sort/input.json`
- `pkg/conformance/events/p02-reduce-linear-and-merge-disjoint/expected.json`
- `pkg/conformance/events/p02-reduce-linear-and-merge-disjoint/input.json`
- `pkg/conformance/events/p03-reduce-permutation-and-idempotent-dup/expected.json`
- `pkg/conformance/events/p03-reduce-permutation-and-idempotent-dup/input.json`
- `pkg/conformance/events/p04-reduce-conflict-and-resolve/expected.json`
- `pkg/conformance/events/p04-reduce-conflict-and-resolve/input.json`
- `pkg/conformance/events/p05-reduce-resolve-then-reopen/expected.json`
- `pkg/conformance/events/p05-reduce-resolve-then-reopen/input.json`
- `pkg/conformance/events/p06-forge-observations-ready-draft-merged-closed/expected.json`
- `pkg/conformance/events/p06-forge-observations-ready-draft-merged-closed/input.json`
- `pkg/conformance/events/p07-tentative-move-and-advisory-leases/expected.json`
- `pkg/conformance/events/p07-tentative-move-and-advisory-leases/input.json`
- `pkg/conformance/events/p08-alpha0-records-read-compat/expected.json`
- `pkg/conformance/events/p08-alpha0-records-read-compat/input.json`
- `pkg/conformance/events/p09-alias-collision-and-unusual-paths/expected.json`
- `pkg/conformance/events/p09-alias-collision-and-unusual-paths/input.json`

### full-board

Count: 27

- `pkg/conformance/full-board/README.md`
- `pkg/conformance/full-board/n01-no-external-fetch-without-flag/expected.json`
- `pkg/conformance/full-board/n01-no-external-fetch-without-flag/input.json`
- `pkg/conformance/full-board/n02-missing-cost-reported-unavailable/expected.json`
- `pkg/conformance/full-board/n02-missing-cost-reported-unavailable/input.json`
- `pkg/conformance/full-board/n03-conflict-heads-visible/expected.json`
- `pkg/conformance/full-board/n03-conflict-heads-visible/input.json`
- `pkg/conformance/full-board/n04-stale-trust-observation-downgraded/expected.json`
- `pkg/conformance/full-board/n04-stale-trust-observation-downgraded/input.json`
- `pkg/conformance/full-board/n05-changed-ref-or-tampered-event/expected.json`
- `pkg/conformance/full-board/n05-changed-ref-or-tampered-event/input.json`
- `pkg/conformance/full-board/p01-empty-repository-and-change-set/expected.json`
- `pkg/conformance/full-board/p01-empty-repository-and-change-set/input.json`
- `pkg/conformance/full-board/p02-tentative-move-and-justified-station/expected.json`
- `pkg/conformance/full-board/p02-tentative-move-and-justified-station/input.json`
- `pkg/conformance/full-board/p03-active-items-modes-next-actions-cost/expected.json`
- `pkg/conformance/full-board/p03-active-items-modes-next-actions-cost/input.json`
- `pkg/conformance/full-board/p04-since-delta-filter/expected.json`
- `pkg/conformance/full-board/p04-since-delta-filter/input.json`
- `pkg/conformance/full-board/p05-alpha0-legacy-records-read/expected.json`
- `pkg/conformance/full-board/p05-alpha0-legacy-records-read/input.json`
- `pkg/conformance/full-board/p06-friction-and-self-accepted/expected.json`
- `pkg/conformance/full-board/p06-friction-and-self-accepted/input.json`
- `pkg/conformance/full-board/p07-single-file-html-self-contained/expected.json`
- `pkg/conformance/full-board/p07-single-file-html-self-contained/input.json`
- `pkg/conformance/full-board/p08-untracked-generated-views-and-open/expected.json`
- `pkg/conformance/full-board/p08-untracked-generated-views-and-open/input.json`

### gate

Count: 33

- `pkg/conformance/gate/README.md`
- `pkg/conformance/gate/n01-alg07-row3-unknown-applicability/expected.json`
- `pkg/conformance/gate/n01-alg07-row3-unknown-applicability/input.json`
- `pkg/conformance/gate/n02-alg07-row4-incompatible-policy/expected.json`
- `pkg/conformance/gate/n02-alg07-row4-incompatible-policy/input.json`
- `pkg/conformance/gate/n03-alg06-loosening-refused/expected.json`
- `pkg/conformance/gate/n03-alg06-loosening-refused/input.json`
- `pkg/conformance/gate/n04-expiry-boundary-at-deadline/expected.json`
- `pkg/conformance/gate/n04-expiry-boundary-at-deadline/input.json`
- `pkg/conformance/gate/n05-approval-for-evidence-claim/expected.json`
- `pkg/conformance/gate/n05-approval-for-evidence-claim/input.json`
- `pkg/conformance/gate/n06-self-waiver-and-unapproved-promotion/expected.json`
- `pkg/conformance/gate/n06-self-waiver-and-unapproved-promotion/input.json`
- `pkg/conformance/gate/p01-alg07-row9-advance/expected.json`
- `pkg/conformance/gate/p01-alg07-row9-advance/input.json`
- `pkg/conformance/gate/p02-alg07-row1-frozen/expected.json`
- `pkg/conformance/gate/p02-alg07-row1-frozen/input.json`
- `pkg/conformance/gate/p03-alg07-row2-conflict/expected.json`
- `pkg/conformance/gate/p03-alg07-row2-conflict/input.json`
- `pkg/conformance/gate/p04-alg07-row5-stop-threshold/expected.json`
- `pkg/conformance/gate/p04-alg07-row5-stop-threshold/input.json`
- `pkg/conformance/gate/p05-alg07-row6-and-7-human-gates/expected.json`
- `pkg/conformance/gate/p05-alg07-row6-and-7-human-gates/input.json`
- `pkg/conformance/gate/p06-mixed-advisory-and-enforced/expected.json`
- `pkg/conformance/gate/p06-mixed-advisory-and-enforced/input.json`
- `pkg/conformance/gate/p07-monotonicity-adding-enforced-fail/expected.json`
- `pkg/conformance/gate/p07-monotonicity-adding-enforced-fail/input.json`
- `pkg/conformance/gate/p08-alg06-policy-merge-tightening/expected.json`
- `pkg/conformance/gate/p08-alg06-policy-merge-tightening/input.json`
- `pkg/conformance/gate/p09-valid-waiver-and-ci10-enforced-fail/expected.json`
- `pkg/conformance/gate/p09-valid-waiver-and-ci10-enforced-fail/input.json`
- `pkg/conformance/gate/p10-level-and-rules-promotion/expected.json`
- `pkg/conformance/gate/p10-level-and-rules-promotion/input.json`

### INDEPENDENT.md

Count: 1

- `pkg/conformance/INDEPENDENT.md`

### install

Count: 176

- `pkg/conformance/install/.gitattributes`
- `pkg/conformance/install/README.md`
- `pkg/conformance/install/environment.json`
- `pkg/conformance/install/n01-git-executable-missing/args.json`
- `pkg/conformance/install/n01-git-executable-missing/before/README.md`
- `pkg/conformance/install/n02-not-a-git-repository/args.json`
- `pkg/conformance/install/n02-not-a-git-repository/before/README.md`
- `pkg/conformance/install/n02-not-a-git-repository/expected/01-init/result.json`
- `pkg/conformance/install/n03-remove-recorded-parent-path/args.json`
- `pkg/conformance/install/n03-remove-recorded-parent-path/before/.tenet/manifest.json`
- `pkg/conformance/install/n03-remove-recorded-parent-path/before/README.md`
- `pkg/conformance/install/n03-remove-recorded-parent-path/before/tenet.yaml`
- `pkg/conformance/install/n03-remove-recorded-parent-path/expected/01-remove/result.json`
- `pkg/conformance/install/n04-init-symlink-outside/args.json`
- `pkg/conformance/install/n04-init-symlink-outside/before/package-lock.json`
- `pkg/conformance/install/n04-init-symlink-outside/before/package.json`
- `pkg/conformance/install/n04-init-symlink-outside/before/src/retry.ts`
- `pkg/conformance/install/n04-init-symlink-outside/before/test/retry.test.ts`
- `pkg/conformance/install/n04-init-symlink-outside/expected/01-init/result.json`
- `pkg/conformance/install/n05-conflicting-created-workflow/args.json`
- `pkg/conformance/install/n05-conflicting-created-workflow/before/.github/workflows/tenet.yml`
- `pkg/conformance/install/n05-conflicting-created-workflow/before/package-lock.json`
- `pkg/conformance/install/n05-conflicting-created-workflow/before/package.json`
- `pkg/conformance/install/n05-conflicting-created-workflow/before/src/retry.ts`
- `pkg/conformance/install/n05-conflicting-created-workflow/before/test/retry.test.ts`
- `pkg/conformance/install/n05-conflicting-created-workflow/expected/01-init/result.json`
- `pkg/conformance/install/n06-interrupted-plan-drift/args.json`
- `pkg/conformance/install/n06-interrupted-plan-drift/before/AGENTS.md`
- `pkg/conformance/install/n06-interrupted-plan-drift/before/package-lock.json`
- `pkg/conformance/install/n06-interrupted-plan-drift/before/package.json`
- `pkg/conformance/install/n06-interrupted-plan-drift/before/src/retry.ts`
- `pkg/conformance/install/n06-interrupted-plan-drift/before/test/retry.test.ts`
- `pkg/conformance/install/n07-doctor-missing-lock/args.json`
- `pkg/conformance/install/n07-doctor-missing-lock/before/README.md`
- `pkg/conformance/install/n07-doctor-missing-lock/before/tenet.yaml`
- `pkg/conformance/install/n07-doctor-missing-lock/expected/01-doctor/tree/README.md`
- `pkg/conformance/install/n07-doctor-missing-lock/expected/01-doctor/tree/tenet.yaml`
- `pkg/conformance/install/n08-preflight-declined/args.json`
- `pkg/conformance/install/n08-preflight-declined/before/AGENTS.md`
- `pkg/conformance/install/n08-preflight-declined/before/package-lock.json`
- `pkg/conformance/install/n08-preflight-declined/before/package.json`
- `pkg/conformance/install/n08-preflight-declined/before/src/retry.ts`
- `pkg/conformance/install/n08-preflight-declined/before/test/retry.test.ts`
- `pkg/conformance/install/n08-preflight-declined/expected/01-init/tree/AGENTS.md`
- `pkg/conformance/install/n08-preflight-declined/expected/01-init/tree/package-lock.json`
- `pkg/conformance/install/n08-preflight-declined/expected/01-init/tree/package.json`
- `pkg/conformance/install/n08-preflight-declined/expected/01-init/tree/src/retry.ts`
- `pkg/conformance/install/n08-preflight-declined/expected/01-init/tree/test/retry.test.ts`
- `pkg/conformance/install/p01-empty/args.json`
- `pkg/conformance/install/p01-empty/before/.gitkeep`
- `pkg/conformance/install/p02-node-vitest/args.json`
- `pkg/conformance/install/p02-node-vitest/before/.nvmrc`
- `pkg/conformance/install/p02-node-vitest/before/package-lock.json`
- `pkg/conformance/install/p02-node-vitest/before/package.json`
- `pkg/conformance/install/p02-node-vitest/before/src/retry.ts`
- `pkg/conformance/install/p02-node-vitest/before/test/retry.test.ts`
- `pkg/conformance/install/p03-node-existing-ci/args.json`
- `pkg/conformance/install/p03-node-existing-ci/before/.github/workflows/ci.yml`
- `pkg/conformance/install/p03-node-existing-ci/before/package-lock.json`
- `pkg/conformance/install/p03-node-existing-ci/before/package.json`
- `pkg/conformance/install/p03-node-existing-ci/before/src/retry.ts`
- `pkg/conformance/install/p03-node-existing-ci/before/test/retry.test.ts`
- `pkg/conformance/install/p04-node-matrix/args.json`
- `pkg/conformance/install/p04-node-matrix/before/.github/workflows/ci.yml`
- `pkg/conformance/install/p04-node-matrix/before/package-lock.json`
- `pkg/conformance/install/p04-node-matrix/before/package.json`
- `pkg/conformance/install/p04-node-matrix/before/src/retry.ts`
- `pkg/conformance/install/p04-node-matrix/before/test/retry.test.ts`
- `pkg/conformance/install/p05-python-pytest/args.json`
- `pkg/conformance/install/p05-python-pytest/before/.python-version`
- `pkg/conformance/install/p05-python-pytest/before/requirements.txt`
- `pkg/conformance/install/p05-python-pytest/before/tests/test_retry.py`
- `pkg/conformance/install/p06-go/args.json`
- `pkg/conformance/install/p06-go/before/go.mod`
- `pkg/conformance/install/p06-go/before/retry_test.go`
- `pkg/conformance/install/p07-existing-agents-md/args.json`
- `pkg/conformance/install/p07-existing-agents-md/before/AGENTS.md`
- `pkg/conformance/install/p07-existing-agents-md/before/package-lock.json`
- `pkg/conformance/install/p07-existing-agents-md/before/package.json`
- `pkg/conformance/install/p07-existing-agents-md/before/src/retry.ts`
- `pkg/conformance/install/p07-existing-agents-md/before/test/retry.test.ts`
- `pkg/conformance/install/p08-existing-mcp/args.json`
- `pkg/conformance/install/p08-existing-mcp/before/.mcp.json`
- `pkg/conformance/install/p08-existing-mcp/before/CLAUDE.md`
- `pkg/conformance/install/p08-existing-mcp/before/package-lock.json`
- `pkg/conformance/install/p08-existing-mcp/before/package.json`
- `pkg/conformance/install/p08-existing-mcp/before/src/retry.ts`
- `pkg/conformance/install/p08-existing-mcp/before/test/retry.test.ts`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/args.json`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/before/.gitattributes`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/before/.github/pull_request_template.md`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/before/.mcp.json`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/before/AGENTS.md`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/before/CLAUDE.md`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/before/package-lock.json`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/before/package.json`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/before/src/retry.ts`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/before/tenet/intent.md`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/before/test/retry.test.ts`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/expected/04-remove/tree/.gitattributes`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/expected/04-remove/tree/.github/pull_request_template.md`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/expected/04-remove/tree/.mcp.json`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/expected/04-remove/tree/AGENTS.md`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/expected/04-remove/tree/CLAUDE.md`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/expected/04-remove/tree/package-lock.json`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/expected/04-remove/tree/package.json`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/expected/04-remove/tree/src/retry.ts`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/expected/04-remove/tree/tenet/intent.md`
- `pkg/conformance/install/p09-init-repeat-upgrade-remove/expected/04-remove/tree/test/retry.test.ts`
- `pkg/conformance/install/p10-remove-keeps-user-edits/args.json`
- `pkg/conformance/install/p10-remove-keeps-user-edits/before/.mcp.json`
- `pkg/conformance/install/p10-remove-keeps-user-edits/before/CLAUDE.md`
- `pkg/conformance/install/p10-remove-keeps-user-edits/before/package-lock.json`
- `pkg/conformance/install/p10-remove-keeps-user-edits/before/package.json`
- `pkg/conformance/install/p10-remove-keeps-user-edits/before/src/retry.ts`
- `pkg/conformance/install/p10-remove-keeps-user-edits/before/tenet/intent.md`
- `pkg/conformance/install/p10-remove-keeps-user-edits/before/test/retry.test.ts`
- `pkg/conformance/install/p10-remove-keeps-user-edits/expected/02-remove/tree/.mcp.json`
- `pkg/conformance/install/p10-remove-keeps-user-edits/expected/02-remove/tree/CLAUDE.md`
- `pkg/conformance/install/p10-remove-keeps-user-edits/expected/02-remove/tree/package-lock.json`
- `pkg/conformance/install/p10-remove-keeps-user-edits/expected/02-remove/tree/package.json`
- `pkg/conformance/install/p10-remove-keeps-user-edits/expected/02-remove/tree/src/retry.ts`
- `pkg/conformance/install/p10-remove-keeps-user-edits/expected/02-remove/tree/tenet.yaml`
- `pkg/conformance/install/p10-remove-keeps-user-edits/expected/02-remove/tree/tenet/intent.md`
- `pkg/conformance/install/p10-remove-keeps-user-edits/expected/02-remove/tree/test/retry.test.ts`
- `pkg/conformance/install/p11-interrupted-install-resumes/args.json`
- `pkg/conformance/install/p11-interrupted-install-resumes/before/.mcp.json`
- `pkg/conformance/install/p11-interrupted-install-resumes/before/CLAUDE.md`
- `pkg/conformance/install/p11-interrupted-install-resumes/before/package-lock.json`
- `pkg/conformance/install/p11-interrupted-install-resumes/before/package.json`
- `pkg/conformance/install/p11-interrupted-install-resumes/before/src/retry.ts`
- `pkg/conformance/install/p11-interrupted-install-resumes/before/test/retry.test.ts`
- `pkg/conformance/install/p12-windows-local-host/args.json`
- `pkg/conformance/install/p12-windows-local-host/before/.vscode/mcp.json`
- `pkg/conformance/install/p12-windows-local-host/before/CLAUDE.md`
- `pkg/conformance/install/p12-windows-local-host/before/package-lock.json`
- `pkg/conformance/install/p12-windows-local-host/before/package.json`
- `pkg/conformance/install/p12-windows-local-host/before/src/retry.ts`
- `pkg/conformance/install/p12-windows-local-host/before/test/retry.test.ts`
- `pkg/conformance/install/p13-existing-ci-with-services/args.json`
- `pkg/conformance/install/p13-existing-ci-with-services/before/.github/workflows/ci.yml`
- `pkg/conformance/install/p13-existing-ci-with-services/before/package-lock.json`
- `pkg/conformance/install/p13-existing-ci-with-services/before/package.json`
- `pkg/conformance/install/p13-existing-ci-with-services/before/src/retry.ts`
- `pkg/conformance/install/p13-existing-ci-with-services/before/test/retry.test.ts`
- `pkg/conformance/install/p14-reusable-workflow/args.json`
- `pkg/conformance/install/p14-reusable-workflow/before/.github/workflows/ci.yml`
- `pkg/conformance/install/p14-reusable-workflow/before/.github/workflows/reusable.yml`
- `pkg/conformance/install/p14-reusable-workflow/before/package-lock.json`
- `pkg/conformance/install/p14-reusable-workflow/before/package.json`
- `pkg/conformance/install/p14-reusable-workflow/before/src/retry.ts`
- `pkg/conformance/install/p14-reusable-workflow/before/test/retry.test.ts`
- `pkg/conformance/install/p15-non-github-forge/args.json`
- `pkg/conformance/install/p15-non-github-forge/before/package-lock.json`
- `pkg/conformance/install/p15-non-github-forge/before/package.json`
- `pkg/conformance/install/p15-non-github-forge/before/src/retry.ts`
- `pkg/conformance/install/p15-non-github-forge/before/test/retry.test.ts`
- `pkg/conformance/install/p16-vendor-fresh-clone/args.json`
- `pkg/conformance/install/p16-vendor-fresh-clone/before/package-lock.json`
- `pkg/conformance/install/p16-vendor-fresh-clone/before/package.json`
- `pkg/conformance/install/p16-vendor-fresh-clone/before/src/retry.ts`
- `pkg/conformance/install/p16-vendor-fresh-clone/before/test/retry.test.ts`
- `pkg/conformance/install/p17-upgrade-pins-and-policy/args.json`
- `pkg/conformance/install/p17-upgrade-pins-and-policy/before/.cursor/mcp.json`
- `pkg/conformance/install/p17-upgrade-pins-and-policy/before/.mcp.json`
- `pkg/conformance/install/p17-upgrade-pins-and-policy/before/CLAUDE.md`
- `pkg/conformance/install/p17-upgrade-pins-and-policy/before/package-lock.json`
- `pkg/conformance/install/p17-upgrade-pins-and-policy/before/package.json`
- `pkg/conformance/install/p17-upgrade-pins-and-policy/before/src/retry.ts`
- `pkg/conformance/install/p17-upgrade-pins-and-policy/before/test/retry.test.ts`
- `pkg/conformance/install/p18-accepted-reporter-edit/args.json`
- `pkg/conformance/install/p18-accepted-reporter-edit/before/.github/workflows/ci.yml`
- `pkg/conformance/install/p18-accepted-reporter-edit/before/package-lock.json`
- `pkg/conformance/install/p18-accepted-reporter-edit/before/package.json`
- `pkg/conformance/install/p18-accepted-reporter-edit/before/src/retry.ts`
- `pkg/conformance/install/p18-accepted-reporter-edit/before/test/retry.test.ts`

### kernel-schemas

Count: 33

- `pkg/conformance/kernel-schemas/README.md`
- `pkg/conformance/kernel-schemas/n01-unknown-key-rejected/expected.json`
- `pkg/conformance/kernel-schemas/n01-unknown-key-rejected/input.json`
- `pkg/conformance/kernel-schemas/n02-incomplete-claim-rejected/expected.json`
- `pkg/conformance/kernel-schemas/n02-incomplete-claim-rejected/input.json`
- `pkg/conformance/kernel-schemas/n03-bad-timestamp-and-short-hash/expected.json`
- `pkg/conformance/kernel-schemas/n03-bad-timestamp-and-short-hash/input.json`
- `pkg/conformance/kernel-schemas/n04-incomplete-review-payload/expected.json`
- `pkg/conformance/kernel-schemas/n04-incomplete-review-payload/input.json`
- `pkg/conformance/kernel-schemas/n05-loop-invalid-route-and-step/expected.json`
- `pkg/conformance/kernel-schemas/n05-loop-invalid-route-and-step/input.yaml`
- `pkg/conformance/kernel-schemas/n06-migrate-malformed-legacy-packet/expected.json`
- `pkg/conformance/kernel-schemas/n06-migrate-malformed-legacy-packet/input.json`
- `pkg/conformance/kernel-schemas/p01-minimal-seven-primitives/expected.json`
- `pkg/conformance/kernel-schemas/p01-minimal-seven-primitives/input.json`
- `pkg/conformance/kernel-schemas/p02-full-records-and-evidence-payloads/expected.json`
- `pkg/conformance/kernel-schemas/p02-full-records-and-evidence-payloads/input.json`
- `pkg/conformance/kernel-schemas/p03-agents-md-define-loop/expected.json`
- `pkg/conformance/kernel-schemas/p03-agents-md-define-loop/input.yaml`
- `pkg/conformance/kernel-schemas/p04-agents-md-build-loop/expected.json`
- `pkg/conformance/kernel-schemas/p04-agents-md-build-loop/input.yaml`
- `pkg/conformance/kernel-schemas/p05-fix-loop-assignment-result-criteria/expected.json`
- `pkg/conformance/kernel-schemas/p05-fix-loop-assignment-result-criteria/input.json`
- `pkg/conformance/kernel-schemas/p06-reserved-evidence-kinds/expected.json`
- `pkg/conformance/kernel-schemas/p06-reserved-evidence-kinds/input.json`
- `pkg/conformance/kernel-schemas/p07-migrate-legacy-packet/expected.json`
- `pkg/conformance/kernel-schemas/p07-migrate-legacy-packet/input.json`
- `pkg/conformance/kernel-schemas/p08-migrate-idempotent-repeat/expected.json`
- `pkg/conformance/kernel-schemas/p08-migrate-idempotent-repeat/input.json`
- `pkg/conformance/kernel-schemas/p09-migrate-duplicate-history/expected.json`
- `pkg/conformance/kernel-schemas/p09-migrate-duplicate-history/input.json`
- `pkg/conformance/kernel-schemas/p10-extension-keys/expected.json`
- `pkg/conformance/kernel-schemas/p10-extension-keys/input.json`

### red-team

Count: 2

- `pkg/conformance/red-team/catalog.yaml`
- `pkg/conformance/red-team/crosscheck.md`

### reference

Count: 8

- `pkg/conformance/reference/irreversible-migration/case.yaml`
- `pkg/conformance/reference/irreversible-migration/expected.json`
- `pkg/conformance/reference/library-unobservable-installs/case.yaml`
- `pkg/conformance/reference/library-unobservable-installs/expected.json`
- `pkg/conformance/reference/ml-without-code-change/case.yaml`
- `pkg/conformance/reference/ml-without-code-change/expected.json`
- `pkg/conformance/reference/regional-rollback/case.yaml`
- `pkg/conformance/reference/regional-rollback/expected.json`

### replay-trust

Count: 31

- `pkg/conformance/replay-trust/README.md`
- `pkg/conformance/replay-trust/n01-unjustified-move-fails-replay/expected.json`
- `pkg/conformance/replay-trust/n01-unjustified-move-fails-replay/input.json`
- `pkg/conformance/replay-trust/n02-evidence-expiry-boundary/expected.json`
- `pkg/conformance/replay-trust/n02-evidence-expiry-boundary/input.json`
- `pkg/conformance/replay-trust/n03-stale-trust-older-than-7d/expected.json`
- `pkg/conformance/replay-trust/n03-stale-trust-older-than-7d/input.json`
- `pkg/conformance/replay-trust/n04-verify-unavailable-control-never-neutral/expected.json`
- `pkg/conformance/replay-trust/n04-verify-unavailable-control-never-neutral/input.json`
- `pkg/conformance/replay-trust/n05-store-loss-results-not-kept/expected.json`
- `pkg/conformance/replay-trust/n05-store-loss-results-not-kept/input.json`
- `pkg/conformance/replay-trust/n06-shared-decision-account-without-t4/expected.json`
- `pkg/conformance/replay-trust/n06-shared-decision-account-without-t4/input.json`
- `pkg/conformance/replay-trust/p01-replay-historical-justified-transition/expected.json`
- `pkg/conformance/replay-trust/p01-replay-historical-justified-transition/input.json`
- `pkg/conformance/replay-trust/p02-tentative-before-and-at-deadline/expected.json`
- `pkg/conformance/replay-trust/p02-tentative-before-and-at-deadline/input.json`
- `pkg/conformance/replay-trust/p03-computed-close-endpoint/expected.json`
- `pkg/conformance/replay-trust/p03-computed-close-endpoint/input.json`
- `pkg/conformance/replay-trust/p04-observe-trust-t1-to-t4-fresh/expected.json`
- `pkg/conformance/replay-trust/p04-observe-trust-t1-to-t4-fresh/input.json`
- `pkg/conformance/replay-trust/p05-ci10-verify-pass-enforced/expected.json`
- `pkg/conformance/replay-trust/p05-ci10-verify-pass-enforced/input.json`
- `pkg/conformance/replay-trust/p06-explicit-override-labelled/expected.json`
- `pkg/conformance/replay-trust/p06-explicit-override-labelled/input.json`
- `pkg/conformance/replay-trust/p07-merge-group-candidate-observed/expected.json`
- `pkg/conformance/replay-trust/p07-merge-group-candidate-observed/input.json`
- `pkg/conformance/replay-trust/p08-private-repo-status-unavailable/expected.json`
- `pkg/conformance/replay-trust/p08-private-repo-status-unavailable/input.json`
- `pkg/conformance/replay-trust/p09-late-evidence-supports-later-eval-only/expected.json`
- `pkg/conformance/replay-trust/p09-late-evidence-supports-later-eval-only/input.json`

### scenarios

Count: 177

- `pkg/conformance/scenarios/README.md`
- `pkg/conformance/scenarios/s01-tagged-test-never-ran/before/kit/TENET.md`
- `pkg/conformance/scenarios/s01-tagged-test-never-ran/before/src/retry.ts`
- `pkg/conformance/scenarios/s01-tagged-test-never-ran/before/tenet.lock`
- `pkg/conformance/scenarios/s01-tagged-test-never-ran/before/tenet.yaml`
- `pkg/conformance/scenarios/s01-tagged-test-never-ran/before/tenet/blessed/tenet__intent.md/requirements.md`
- `pkg/conformance/scenarios/s01-tagged-test-never-ran/before/tenet/blessed/tenet__intent.md/requirements.md.anchors.json`
- `pkg/conformance/scenarios/s01-tagged-test-never-ran/before/tenet/intent.md`
- `pkg/conformance/scenarios/s01-tagged-test-never-ran/before/test/retry.test.ts`
- `pkg/conformance/scenarios/s01-tagged-test-never-ran/expected/04-card.md`
- `pkg/conformance/scenarios/s01-tagged-test-never-ran/expected/04-verify.json`
- `pkg/conformance/scenarios/s01-tagged-test-never-ran/steps.json`
- `pkg/conformance/scenarios/s02-implements-changed-same-commit/before/kit/TENET.md`
- `pkg/conformance/scenarios/s02-implements-changed-same-commit/before/src/retry.ts`
- `pkg/conformance/scenarios/s02-implements-changed-same-commit/before/tenet.lock`
- `pkg/conformance/scenarios/s02-implements-changed-same-commit/before/tenet.yaml`
- `pkg/conformance/scenarios/s02-implements-changed-same-commit/before/tenet/blessed/tenet__intent.md/requirements.md`
- `pkg/conformance/scenarios/s02-implements-changed-same-commit/before/tenet/blessed/tenet__intent.md/requirements.md.anchors.json`
- `pkg/conformance/scenarios/s02-implements-changed-same-commit/before/tenet/intent.md`
- `pkg/conformance/scenarios/s02-implements-changed-same-commit/before/test/retry.test.ts`
- `pkg/conformance/scenarios/s02-implements-changed-same-commit/expected/04-card.md`
- `pkg/conformance/scenarios/s02-implements-changed-same-commit/expected/04-verify.json`
- `pkg/conformance/scenarios/s02-implements-changed-same-commit/expected/05-card.md`
- `pkg/conformance/scenarios/s02-implements-changed-same-commit/expected/05-verify.json`
- `pkg/conformance/scenarios/s02-implements-changed-same-commit/steps.json`
- `pkg/conformance/scenarios/s03-advisory-and-enforced-failure/before/kit/TENET.md`
- `pkg/conformance/scenarios/s03-advisory-and-enforced-failure/before/tenet.lock`
- `pkg/conformance/scenarios/s03-advisory-and-enforced-failure/before/tenet.yaml`
- `pkg/conformance/scenarios/s03-advisory-and-enforced-failure/before/tenet/intent.md`
- `pkg/conformance/scenarios/s03-advisory-and-enforced-failure/expected/01-gate-fixture.json`
- `pkg/conformance/scenarios/s03-advisory-and-enforced-failure/expected/02-check.json`
- `pkg/conformance/scenarios/s03-advisory-and-enforced-failure/steps.json`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/before/kit/TENET.md`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/before/src/retry.ts`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/before/tenet.lock`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/before/tenet.yaml`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/before/tenet/blessed/tenet__specs__prd.md/requirements.md`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/before/tenet/blessed/tenet__specs__prd.md/requirements.md.anchors.json`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/before/tenet/blessed/tenet__vision.md/vision.md`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/before/tenet/blessed/tenet__vision.md/vision.md.anchors.json`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/before/tenet/specs/plan.md`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/before/tenet/specs/prd.md`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/before/tenet/specs/tech-spec.md`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/before/tenet/specs/ux-spec.md`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/before/tenet/vision.md`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/expected/02-board.json`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/expected/03-context.json`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/expected/04-mcp.json`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/expected/05-bless.json`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/expected/06-context-sdk.json`
- `pkg/conformance/scenarios/s04-reject-edit-to-blessed-section/steps.json`
- `pkg/conformance/scenarios/s05-global-rule-budget-pressure/before/kit/TENET.md`
- `pkg/conformance/scenarios/s05-global-rule-budget-pressure/before/src/checkout/pay.ts`
- `pkg/conformance/scenarios/s05-global-rule-budget-pressure/before/tenet.lock`
- `pkg/conformance/scenarios/s05-global-rule-budget-pressure/before/tenet.yaml`
- `pkg/conformance/scenarios/s05-global-rule-budget-pressure/before/tenet/blessed/tenet__specs__prd.md/requirements.md`
- `pkg/conformance/scenarios/s05-global-rule-budget-pressure/before/tenet/blessed/tenet__specs__prd.md/requirements.md.anchors.json`
- `pkg/conformance/scenarios/s05-global-rule-budget-pressure/before/tenet/blessed/tenet__vision.md/vision.md`
- `pkg/conformance/scenarios/s05-global-rule-budget-pressure/before/tenet/blessed/tenet__vision.md/vision.md.anchors.json`
- `pkg/conformance/scenarios/s05-global-rule-budget-pressure/before/tenet/specs/plan.md`
- `pkg/conformance/scenarios/s05-global-rule-budget-pressure/before/tenet/specs/prd.md`
- `pkg/conformance/scenarios/s05-global-rule-budget-pressure/before/tenet/specs/tech-spec.md`
- `pkg/conformance/scenarios/s05-global-rule-budget-pressure/before/tenet/specs/ux-spec.md`
- `pkg/conformance/scenarios/s05-global-rule-budget-pressure/before/tenet/vision.md`
- `pkg/conformance/scenarios/s05-global-rule-budget-pressure/expected/01-context-tight.json`
- `pkg/conformance/scenarios/s05-global-rule-budget-pressure/expected/02-mcp.json`
- `pkg/conformance/scenarios/s05-global-rule-budget-pressure/expected/03-context-explicit.json`
- `pkg/conformance/scenarios/s05-global-rule-budget-pressure/expected/04-context-zero.json`
- `pkg/conformance/scenarios/s05-global-rule-budget-pressure/steps.json`
- `pkg/conformance/scenarios/s06-change-to-shared-helper/before/CODEOWNERS`
- `pkg/conformance/scenarios/s06-change-to-shared-helper/before/kit/TENET.md`
- `pkg/conformance/scenarios/s06-change-to-shared-helper/before/src/api/handler.ts`
- `pkg/conformance/scenarios/s06-change-to-shared-helper/before/src/billing/charge.ts`
- `pkg/conformance/scenarios/s06-change-to-shared-helper/before/src/shared/http.ts`
- `pkg/conformance/scenarios/s06-change-to-shared-helper/before/tenet.lock`
- `pkg/conformance/scenarios/s06-change-to-shared-helper/before/tenet.yaml`
- `pkg/conformance/scenarios/s06-change-to-shared-helper/before/tenet/blessed/tenet__intent.md/requirements.md`
- `pkg/conformance/scenarios/s06-change-to-shared-helper/before/tenet/blessed/tenet__intent.md/requirements.md.anchors.json`
- `pkg/conformance/scenarios/s06-change-to-shared-helper/before/tenet/intent.md`
- `pkg/conformance/scenarios/s06-change-to-shared-helper/expected/01-onboard-initial.json`
- `pkg/conformance/scenarios/s06-change-to-shared-helper/expected/05-onboard-refresh.json`
- `pkg/conformance/scenarios/s06-change-to-shared-helper/expected/06-card.md`
- `pkg/conformance/scenarios/s06-change-to-shared-helper/expected/06-verify.json`
- `pkg/conformance/scenarios/s06-change-to-shared-helper/steps.json`
- `pkg/conformance/scenarios/s07-install-interrupted-part-way/before/.mcp.json`
- `pkg/conformance/scenarios/s07-install-interrupted-part-way/before/AGENTS.md`
- `pkg/conformance/scenarios/s07-install-interrupted-part-way/before/package.json`
- `pkg/conformance/scenarios/s07-install-interrupted-part-way/before/src/index.ts`
- `pkg/conformance/scenarios/s07-install-interrupted-part-way/before/test/index.test.ts`
- `pkg/conformance/scenarios/s07-install-interrupted-part-way/expected/01-interrupted-init.json`
- `pkg/conformance/scenarios/s07-install-interrupted-part-way/expected/02-init-resume.json`
- `pkg/conformance/scenarios/s07-install-interrupted-part-way/expected/03-doctor.json`
- `pkg/conformance/scenarios/s07-install-interrupted-part-way/expected/04-remove.json`
- `pkg/conformance/scenarios/s07-install-interrupted-part-way/steps.json`
- `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/before/kit/TENET.md`
- `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/before/src/retry.ts`
- `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/before/tenet.lock`
- `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/before/tenet.yaml`
- `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/before/tenet/blessed/tenet__specs__prd.md/requirements.md`
- `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/before/tenet/blessed/tenet__specs__prd.md/requirements.md.anchors.json`
- `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/before/tenet/blessed/tenet__vision.md/vision.md`
- `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/before/tenet/blessed/tenet__vision.md/vision.md.anchors.json`
- `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/before/tenet/specs/plan.md`
- `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/before/tenet/specs/prd.md`
- `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/before/tenet/specs/tech-spec.md`
- `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/before/tenet/specs/ux-spec.md`
- `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/before/tenet/vision.md`
- `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/expected/02-context-clean.json`
- `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/expected/04-context-drift.json`
- `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/expected/05-bless.json`
- `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/expected/05-log-entry.json`
- `pkg/conformance/scenarios/s08-blessing-fresh-clone-squash-merge/steps.json`
- `pkg/conformance/scenarios/s09-renamed-heading/before/kit/TENET.md`
- `pkg/conformance/scenarios/s09-renamed-heading/before/src/retry.ts`
- `pkg/conformance/scenarios/s09-renamed-heading/before/tenet.lock`
- `pkg/conformance/scenarios/s09-renamed-heading/before/tenet.yaml`
- `pkg/conformance/scenarios/s09-renamed-heading/before/tenet/blessed/tenet__specs__prd.md/checkout-retries.md`
- `pkg/conformance/scenarios/s09-renamed-heading/before/tenet/blessed/tenet__specs__prd.md/checkout-retries.md.anchors.json`
- `pkg/conformance/scenarios/s09-renamed-heading/before/tenet/blessed/tenet__vision.md/vision.md`
- `pkg/conformance/scenarios/s09-renamed-heading/before/tenet/blessed/tenet__vision.md/vision.md.anchors.json`
- `pkg/conformance/scenarios/s09-renamed-heading/before/tenet/specs/plan.md`
- `pkg/conformance/scenarios/s09-renamed-heading/before/tenet/specs/prd.md`
- `pkg/conformance/scenarios/s09-renamed-heading/before/tenet/specs/tech-spec.md`
- `pkg/conformance/scenarios/s09-renamed-heading/before/tenet/specs/ux-spec.md`
- `pkg/conformance/scenarios/s09-renamed-heading/before/tenet/vision.md`
- `pkg/conformance/scenarios/s09-renamed-heading/before/test/retry.test.ts`
- `pkg/conformance/scenarios/s09-renamed-heading/expected/02-fix.json`
- `pkg/conformance/scenarios/s09-renamed-heading/expected/03-check.json`
- `pkg/conformance/scenarios/s09-renamed-heading/expected/04-board.json`
- `pkg/conformance/scenarios/s09-renamed-heading/expected/05-context.json`
- `pkg/conformance/scenarios/s09-renamed-heading/steps.json`
- `pkg/conformance/scenarios/s10-pr-closed-without-merging/before/kit/TENET.md`
- `pkg/conformance/scenarios/s10-pr-closed-without-merging/before/src/retry.ts`
- `pkg/conformance/scenarios/s10-pr-closed-without-merging/before/tenet.lock`
- `pkg/conformance/scenarios/s10-pr-closed-without-merging/before/tenet.yaml`
- `pkg/conformance/scenarios/s10-pr-closed-without-merging/before/tenet/blessed/tenet__intent.md/requirements.md`
- `pkg/conformance/scenarios/s10-pr-closed-without-merging/before/tenet/blessed/tenet__intent.md/requirements.md.anchors.json`
- `pkg/conformance/scenarios/s10-pr-closed-without-merging/before/tenet/intent.md`
- `pkg/conformance/scenarios/s10-pr-closed-without-merging/expected/04-card.md`
- `pkg/conformance/scenarios/s10-pr-closed-without-merging/expected/04-verify.json`
- `pkg/conformance/scenarios/s10-pr-closed-without-merging/expected/05-verify-closed.json`
- `pkg/conformance/scenarios/s10-pr-closed-without-merging/steps.json`
- `pkg/conformance/scenarios/s11-readme-walkthrough/before/README.md`
- `pkg/conformance/scenarios/s11-readme-walkthrough/before/package.json`
- `pkg/conformance/scenarios/s11-readme-walkthrough/before/src/retry.ts`
- `pkg/conformance/scenarios/s11-readme-walkthrough/before/test/retry.test.ts`
- `pkg/conformance/scenarios/s11-readme-walkthrough/expected/01-init.json`
- `pkg/conformance/scenarios/s11-readme-walkthrough/expected/02-onboard-inventory.json`
- `pkg/conformance/scenarios/s11-readme-walkthrough/expected/06-card.md`
- `pkg/conformance/scenarios/s11-readme-walkthrough/expected/06-onboard-card.json`
- `pkg/conformance/scenarios/s11-readme-walkthrough/expected/07-bless.json`
- `pkg/conformance/scenarios/s11-readme-walkthrough/expected/08-remove.json`
- `pkg/conformance/scenarios/s11-readme-walkthrough/steps.json`
- `pkg/conformance/scenarios/s12-ux-walkthrough-existing/before/.claude/settings.json`
- `pkg/conformance/scenarios/s12-ux-walkthrough-existing/before/.github/workflows/ci.yml`
- `pkg/conformance/scenarios/s12-ux-walkthrough-existing/before/CODEOWNERS`
- `pkg/conformance/scenarios/s12-ux-walkthrough-existing/before/README.md`
- `pkg/conformance/scenarios/s12-ux-walkthrough-existing/before/docs/adr/0001-retries.md`
- `pkg/conformance/scenarios/s12-ux-walkthrough-existing/before/docs/adr/0002-timeouts.md`
- `pkg/conformance/scenarios/s12-ux-walkthrough-existing/before/docs/architecture.md`
- `pkg/conformance/scenarios/s12-ux-walkthrough-existing/before/package.json`
- `pkg/conformance/scenarios/s12-ux-walkthrough-existing/before/src/retry.ts`
- `pkg/conformance/scenarios/s12-ux-walkthrough-existing/before/test/checkout.retry.test.ts`
- `pkg/conformance/scenarios/s12-ux-walkthrough-existing/expected/01-init.json`
- `pkg/conformance/scenarios/s12-ux-walkthrough-existing/expected/02-onboard-inventory.json`
- `pkg/conformance/scenarios/s12-ux-walkthrough-existing/expected/06-card.md`
- `pkg/conformance/scenarios/s12-ux-walkthrough-existing/expected/06-onboard-card.json`
- `pkg/conformance/scenarios/s12-ux-walkthrough-existing/expected/07-bless.json`
- `pkg/conformance/scenarios/s12-ux-walkthrough-existing/expected/08-board.json`
- `pkg/conformance/scenarios/s12-ux-walkthrough-existing/steps.json`
- `pkg/conformance/scenarios/s13-ux-walkthrough-new/before/.gitkeep`
- `pkg/conformance/scenarios/s13-ux-walkthrough-new/expected/01-init.json`
- `pkg/conformance/scenarios/s13-ux-walkthrough-new/expected/04-onboard-inventory.json`
- `pkg/conformance/scenarios/s13-ux-walkthrough-new/expected/05-card.md`
- `pkg/conformance/scenarios/s13-ux-walkthrough-new/expected/05-onboard-card.json`
- `pkg/conformance/scenarios/s13-ux-walkthrough-new/expected/06-bless.json`
- `pkg/conformance/scenarios/s13-ux-walkthrough-new/steps.json`

### signed-evidence

Count: 31

- `pkg/conformance/signed-evidence/README.md`
- `pkg/conformance/signed-evidence/n01-tampered-receipt-rejected/expected.json`
- `pkg/conformance/signed-evidence/n01-tampered-receipt-rejected/input.json`
- `pkg/conformance/signed-evidence/n02-missing-signing-key-verify-fails/expected.json`
- `pkg/conformance/signed-evidence/n02-missing-signing-key-verify-fails/input.json`
- `pkg/conformance/signed-evidence/n03-wrong-run-and-dirty-sealed-subject/expected.json`
- `pkg/conformance/signed-evidence/n03-wrong-run-and-dirty-sealed-subject/input.json`
- `pkg/conformance/signed-evidence/n04-partial-matrix-shards-refused/expected.json`
- `pkg/conformance/signed-evidence/n04-partial-matrix-shards-refused/input.json`
- `pkg/conformance/signed-evidence/n05-superseded-candidate-stale/expected.json`
- `pkg/conformance/signed-evidence/n05-superseded-candidate-stale/input.json`
- `pkg/conformance/signed-evidence/n06-distinct-challenge-reuse-and-ordinary-key/expected.json`
- `pkg/conformance/signed-evidence/n06-distinct-challenge-reuse-and-ordinary-key/input.json`
- `pkg/conformance/signed-evidence/p01-ed25519-sign-and-verify/expected.json`
- `pkg/conformance/signed-evidence/p01-ed25519-sign-and-verify/input.json`
- `pkg/conformance/signed-evidence/p02-person-present-canonical-payload/expected.json`
- `pkg/conformance/signed-evidence/p02-person-present-canonical-payload/input.json`
- `pkg/conformance/signed-evidence/p03-person-present-redelivery-idempotent/expected.json`
- `pkg/conformance/signed-evidence/p03-person-present-redelivery-idempotent/input.json`
- `pkg/conformance/signed-evidence/p04-sealed-job-subject-unchanged/expected.json`
- `pkg/conformance/signed-evidence/p04-sealed-job-subject-unchanged/input.json`
- `pkg/conformance/signed-evidence/p05-immutable-store-and-retry/expected.json`
- `pkg/conformance/signed-evidence/p05-immutable-store-and-retry/input.json`
- `pkg/conformance/signed-evidence/p06-exact-merge-candidate-verified/expected.json`
- `pkg/conformance/signed-evidence/p06-exact-merge-candidate-verified/input.json`
- `pkg/conformance/signed-evidence/p07-fork-pull-request-verified/expected.json`
- `pkg/conformance/signed-evidence/p07-fork-pull-request-verified/input.json`
- `pkg/conformance/signed-evidence/p08-presence-unavailable-reported/expected.json`
- `pkg/conformance/signed-evidence/p08-presence-unavailable-reported/input.json`
- `pkg/conformance/signed-evidence/p09-signing-backend-selection/expected.json`
- `pkg/conformance/signed-evidence/p09-signing-backend-selection/input.json`

## Command results

| Command | Exit | ok | Seconds |
|---|---:|---:|---:|
| npx tenet --version | 0 | n/a | 36.000 |
| npx tenet --help | 0 | n/a | 27.845 |
| npx tenet onboard --inventory-only --json | 0 | true | 36.126 |
| npx tenet check --json | 3 | false | 16.869 |
| npx tenet board --json | 3 | false | 14.663 |
| npx tenet context --query test --budget-tokens 2000 --json | 3 | false | 10.846 |
| npx tenet doctor --json | 3 | false | 15.212 |

### npx tenet --version

```text
0.0.0
```

### npx tenet --help

```text
Tenet

Usage: tenet [global options] <command> [options]

Global options:
  --cwd <path>    Run in another repository
  --json          Write one JSON envelope to stdout
  --quiet         Suppress successful human output
  --verbose       Show additional human output
  --offline       Refuse commands that use the network
  --version       Print the installed version
  --help, -h      Print this help

Commands:
  bless              Read and bless specification sections in your terminal.
  board              Show specification state and spec debt
  check              Check specification structure and integrity
  context            Select blessed specification context
  doctor             Check the Tenet installation and required tools
  fix                Repair mechanical specification problems
  init               Install Tenet in the current repository
  mcp                Serve the Tenet MCP tools over stdio
  onboard            Inspect your project and prepare a specification drafting assignment.
  remove             Remove Tenet-owned installation files
  split              Move a specification section into a part
  upgrade            Upgrade Tenet-owned files to the installed version
  verify             Run checks, collect a bundle, or record CI proof.
```

### npx tenet onboard --inventory-only --json

```text
{"ok":true,"command":"onboard","version":"0.0.0","result":{"preflight":{"revision":"26acb2b235415be76ae6971d40450a88792524bd","read_count":21,"skipped_count":1,"dirty_warning":false},"inventory":{"schema_version":1,"revision":"26acb2b235415be76ae6971d40450a88792524bd","sources":{"files":[{"path":".github/workflows/ci.yml","kind":"ci","sha256":"6c69fbab039ddbec1edfccc74fbe315dd3232455dddffe2f75baedbcb231c7e1","lines":10},{"path":".gitignore","kind":"config","sha256":"a8db166167d30d2c36fa95cc3163e77a4bc33205ede3b81a368750f25ded3879","lines":2},{"path":"CLAUDE.md","kind":"instructions","sha256":"87cfd2810189846eac73967baef51c3080c60ed2165d31800a4996c22f093f13","lines":5},{"path":"CODEOWNERS","kind":"config","sha256":"a72902895617c54ba070dae6db021761a6cb431c0055c6951d22456270b77946","lines":3},{"path":"Dockerfile","kind":"config","sha256":"8687c32eb0d902cd2f6f61fc267606abb7cbe752314ee615398138f6f7847a15","lines":5},{"path":"README.md","kind":"doc","sha256":"1d825dbad0da76f1ec1d2bb59101f0dcff240a4a7c12d7e9eeb3171fab87266f","lines":12},{"path":"docs/adr/0001-idempotency-ttl.md","kind":"adr","sha256":"2220a53be50f9994a4c457dbe1a82f2e8b721120f2c241f1d7f7c764014400a3","lines":7},{"path":"docs/architecture.md","kind":"doc","sha256":"4e36c2ea3b67a55a81fa7256461809e6489742ac5aa3c9805baf2536f15ff3ce","lines":7},{"path":"docs/roadmap.md","kind":"doc","sha256":"18e408f24c39dcbc0d719c5f5d8d6eefe9192fc11bc0468634600e340f9a6035","lines":3},{"path":"package.json","kind":"manifest","sha256":"0bda4ed6cb89d14ad0d4913fbbd163c8b4636a035ce5c283cdafa05f03687a7b","lines":13},{"path":"src/config/flags.js","kind":"source","sha256":"88c10dca73dd7ea2267801aebf6d63dd241861136acabfef5a848717ab257238","lines":3},{"path":"src/config/limits.js","kind":"source","sha256":"963c57a02e9f00ded7e2a7104b1143acfb2d74e1775974a5b40d8e28eb1941b7","lines":3},{"path":"src/payments/idempotency.js","kind":"source","sha256":"8b41a0a1252e09f22e4d6dd982b38f9cce30746299be2e9a3bce39b645045b92","lines":14},{"path":"src/payments/retry.js","kind":"source","sha256":"fdab176e6eaa7bff6099ce1dda5179902ff2dc50240134de9b75cb0c878acba8","lines":11},{"path":"src/routes/health.js","kind":"source","sha256":"6a8e39446cfaf1c3397e83fd238fa418d358c598d796b34e75fa558248b992ce","lines":3},{"path":"src/security/hmac.js","kind":"source","sha256":"334179432ed83e1b54f47cc95e8fc6f67b43b5deb90de1ac6e9cf0f7f55818f4","lines":9},{"path":"src/security/redact.js","kind":"source","sha256":"577570bdc0de5b2b10fc8496ddefbc665c5ed37bb201a4f9a715eabfad17be1b","lines":6},{"path":"src/server.js","kind":"source","sha256":"6a1e537c37adcf5e97f6b111e239a25a12d42572d7e6f111433d644a8ec92938","lines":19},{"path":"test/redact.test.js","kind":"test","sha256":"4e8cf4be7cff37c2fd114feee0eaf64b4c00ea6cc2ecb7465047e6c9c3356a09","lines":9},{"path":"test/retry.test.js","kind":"test","sha256":"235119703c2748ffb12c77781915f595cd35288e047004ef042cace12d032b8a","lines":14},{"path":"test/webhook.test.js","kind":"test","sha256":"1b7d60f8f1ae334589af0c16885c1fab9e6de6f62994667ea78dc50d6e04ce08","lines":14}],"skipped":[{"path":".env.example","reason":"env"}]},"modules":[{"id":"root","roots":["."],"languages":["javascript"]}],"tests":[{"path":"test/redact.test.js","runner":"node:test","cases":1},{"path":"test/retry.test.js","runner":"node:test","cases":1},{"path":"test/webhook.test.js","runner":"node:test","cases":2}],"docs":[{"path":"README.md","title":"LedgerGate","sections":["behavior","run"],"last_changed":"2026-11-24T20:17:45Z"},{"path":"docs/adr/0001-idempotency-ttl.md","title":"ADR-0001: Idempotency Key Enforcement and TTL","sections":["decision"],"last_changed":"2026-11-24T20:17:45Z"},{"path":"docs/architecture.md","title":"Architecture","sections":["async-reconciliation","security"],"last_changed":"2026-11-24T20:17:45Z"},{"path":"docs/roadmap.md","title":"Roadmap","sections":[],"last_changed":"2026-11-24T20:17:45Z"}],"owners":[{"pattern":"/src/payments/","owners":["@payments-team"]},{"pattern":"/src/security/","owners":["@sec-team"]},{"pattern":"*","owners":["@ved"]}],"ci":[{"path":".github/workflows/ci.yml","commands":["node --test"]}],"size":{"source_lines":68,"areas":3},"layout":"one-file","units":[{"id":"root","paths":["."],"views":["vision","requirements","design","experience","plan"]}],"findings":[],"observations":{"reports":[]}},"findings":[],"assignment":{"schema_version":1,"inventory":".tenet/onboard/inventory.json","skill":"draft-specs","project_kind":"service","views":["vision","requirements","design","experience","plan"],"layout":"one-file","units":[{"id":"root","paths":["."],"views":["vision","requirements","design","experience","plan"]}],"question_limit":10,"output":{"paths":["tenet/intent.md"]},"rules":["no intent from code alone","every observed or documented statement cites","never resolve a conflict","never bless"]}},"errors":[]}
```

### npx tenet check --json

```text
{"ok":false,"command":"tenet","version":"0.0.0","result":null,"errors":[{"code":"TN-POLICY-MISSING","severity":"error","rule":null,"file":"tenet.yaml","line":null,"message":"Policy file tenet.yaml was not found.","fix":"Run `tenet init` to create tenet.yaml."}]}
```

### npx tenet board --json

```text
{"ok":false,"command":"tenet","version":"0.0.0","result":null,"errors":[{"code":"TN-POLICY-MISSING","severity":"error","rule":null,"file":"tenet.yaml","line":null,"message":"Policy file tenet.yaml was not found.","fix":"Run `tenet init` to create tenet.yaml."}]}
```

### npx tenet context --query test --budget-tokens 2000 --json

```text
{"ok":false,"command":"tenet","version":"0.0.0","result":null,"errors":[{"code":"TN-POLICY-MISSING","severity":"error","rule":null,"file":"tenet.yaml","line":null,"message":"Policy file tenet.yaml was not found.","fix":"Run `tenet init` to create tenet.yaml."}]}
```

### npx tenet doctor --json

```text
{"ok":false,"command":"doctor","version":"0.0.0","result":{"checks":[{"name":"node","ok":true,"detail":"Node.js 24.22.1"},{"name":"git","ok":true,"detail":"Git 2.56.1.windows.1"},{"name":"ssh","ok":false,"detail":"OpenSSH OpenSSH_for_Windows_9.5p2, LibreSSL 3.8.2"},{"name":"gh","ok":true,"detail":"gh CLI 2.105.0"},{"name":"lock","ok":false,"detail":"Policy file tenet.yaml was not found."},{"name":"workflows","ok":true,"detail":"No workflows configured (ci_mode none)"}]},"errors":[{"code":"TN-POLICY-MISSING","severity":"error","rule":null,"file":"tenet.yaml","line":null,"message":"Policy file tenet.yaml was not found.","fix":"Run `tenet init` to create tenet.yaml."}]}
```

## Problems

- registry install unavailable: smoke used local extraction

