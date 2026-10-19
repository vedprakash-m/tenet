---
name: tenet-build
description: Test-first implementation inside a Tenet contract: write the red, make it green, keep the change small, declare every edit.
---
# Build: test first, smallest change

Use when `next` says `test` or `implement`. Edit natively; the kernel judges.

## The loop
1. **Red.** Write the acceptance test(s) for the new examples exactly as recorded, in the test file named. Expected values come from the example, never from running the code. Run `tenet check --h <handle> --stage baseline`. It must fail on an assertion; a compile or import error, a skipped test or a passing test is not a red and the kernel says so. Fix the test, not the product code.
2. **Green.** Make the smallest in-scope change. Format with the project's formatter first. Iterate with `tenet check --h <handle> --targeted --touched <paths>`; finish an attempt with a full `tenet check --h <handle> --stage candidate --touched <paths>`.
3. **Then** follow `next`: review, or finish.
A behavior-preserving refactor uses preservation tests that already pass; there is no artificial red.

## Practice
- **Tests earn their place.** A test fails when the behavior breaks and keeps passing when only internals change. Where an absence check could pass vacuously, add a control that proves it detects presence.
- **Debug the shared premise.** After a failed attempt, before the next edit, write down the premise your attempts shared and test it with one observation that would differ if it were false. Suspect the test, fixture or environment before the system.
- **Fix where the fault starts.** A guard, retry, catch or clamp is a fix only when the state it handles is legitimate. Fix the same defect at its other sites in the change.
- **Report surprises; never improvise.** When a fact invalidates the plan, the sketch or the authority, stop and say: Expected, Found, Why it matters.
- **Flag, don't expand.** An improvement outside the scope is named "noticed, not changed". Remove what your own change made unused; leave other dead code and mention it.
- A shortcut (`@ts-ignore`, `as any`, a skipped or focused test, an empty catch, a mock) is avoided; if one is truly needed, say why and the kernel asks the user.
- A locked acceptance test never changes to make a failure pass; a changed example is a change of direction.
- Never edit `.tenet/`. Never run the project's tests outside `tenet check`.

## Dirty working trees
Your edits and the user's coexist. Never overwrite, format or revert a file you did not declare. If the kernel asks about the user's edits, relay its question; do not decide for them. Commit only through the kernel.
