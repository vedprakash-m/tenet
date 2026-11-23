# CP-0006 verification

## Focused proof

`npm test -- test/policy`

- 6 tests passed
- 0 failed
- Regressions cover target-ref areas, exact owner precedence, lowered default document levels and unmatched configured areas
- Built the public TypeScript entry points before running the policy tests

## Lint

`npm run lint`

- 104 files checked
- 0 errors

## Full test

`npm test`

- 61 tests discovered
- 59 passed
- 2 pending schema tests skipped
- 0 failed

## Scope

Only `src/policy/`, `test/policy/` and this packet's `log.md` and evidence were written. No package or shared-core files were changed and no commit was created.

Review rerun: focused policy tests 6/6, lint 104 files clean, full tests 59 passed with 2 pending and 0 failed.

Second review rerun: focused policy tests 6/6, lint 104 files clean, full tests 59 passed with 2 pending and 0 failed.

Final review rerun: focused policy tests 6/6, lint 104 files clean, full tests 59 passed with 2 pending and 0 failed.
