# Frequently asked questions

Source: [UX specification](../tenet/specs/ux-spec.md), [PRD §1](../tenet/specs/prd.md#1-scope-and-positioning).

## Do I need a Tenet account or server?

Source: [UX Part 0](../tenet/specs/ux-spec.md#part-0-get-tenet).

Tenet runs as a command, CI workflow and files in your repository. Pull-request cards use the GitHub Actions workflows set up by `tenet init`.

## Does Tenet draft my specifications?

Source: [UX Part 1A](../tenet/specs/ux-spec.md#1a-an-existing-repository).

Tenet prepares an inventory and instructions. Your coding agent drafts the specifications and asks you about unresolved intent.

## Can I see what Tenet reads before drafting?

Source: [onboarding §1](../tenet/specs/tech-spec/onboarding.md#1-onboarding-and-blessing-r-223).

Yes. Use `tenet onboard --inventory-only` to prepare the inventory before sending source material to your agent through the drafting workflow.

## Can I try cards before blessing a specification?

Source: [UX Part 1A](../tenet/specs/ux-spec.md#1a-an-existing-repository).

Yes. Merge setup and skip drafting for now. The card reports that intent has yet to be blessed. Run `tenet onboard` when you want to begin.

## Does merging the setup pull request bless the draft?

Source: [PRD R-223](../tenet/specs/prd.md#40-the-spec-process), [UX Part 1A](../tenet/specs/ux-spec.md#1a-an-existing-repository).

Blessing needs an explicit human choice. Use `tenet bless` in your terminal. You can leave individual sections for later.

## What happens when someone edits a blessed specification?

Source: [UX Parts 1A and 2](../tenet/specs/ux-spec.md#1a-an-existing-repository).

The edit becomes a proposal. The last blessed text stays in force until a replacement is blessed. The board shows the edit or changed source.

## Does a passing test settle whether the change is right?

Source: [UX Part 2](../tenet/specs/ux-spec.md#part-2-the-daily-loop), [PRD §1](../tenet/specs/prd.md#1-scope-and-positioning).

A pass tells you which tagged tests ran successfully on the named commit. Use the item text and results to decide whether the tests cover the intended change.

## Why does the card say “coverage not confirmed”?

Source: [UX Part 2](../tenet/specs/ux-spec.md#part-2-the-daily-loop).

Tagged results passed, but Tenet could not match them to every tagged test for the item. Read the result details to see what is available.

## Will Tenet block a pull request?

Source: [UX Parts 1 and 3](../tenet/specs/ux-spec.md#part-3-when-you-want-more), [CI §10](../tenet/specs/tech-spec/ci.md#10-outcomes).

Setup starts in `observe`. The card reports findings and what a rule would have blocked. Rule enforcement starts in later releases.

## Where can I see which sections are waiting for me?

Source: [UX Part 2](../tenet/specs/ux-spec.md#part-2-the-daily-loop).

Run `tenet board`. It lists sections awaiting blessing, edited sections, changed sources and specification debt.

## What if the package and the lock disagree?

Source: [UX Part 4](../tenet/specs/ux-spec.md#part-4-keeping-tenet-current), [onboarding §2](../tenet/specs/tech-spec/onboarding.md#2-install-and-upgrade).

Run `tenet upgrade` after installing the intended package version. Review the regenerated setup before committing the changes.

## How do I remove Tenet?

Source: [UX Part 4](../tenet/specs/ux-spec.md#part-4-keeping-tenet-current), [onboarding §2](../tenet/specs/tech-spec/onboarding.md#2-install-and-upgrade).

Run `tenet remove` to remove managed setup. Your specifications and records stay. Read the output for any files or settings Tenet kept and any reminder about branch rules.

## Which steps use the network?

npm needs the registry to install uncached packages. An installed Tenet normally checks the registry for package integrity during `init` and `upgrade`. If your network blocks that lookup or you get `TN-ENV-REGISTRY`, rerun with `--offline`. That records local integrity. When the registry is reachable, run an online `tenet upgrade` to pin the package for GitHub Actions.

Inventory, blessing, the board and command-line context work locally. Your coding agent may use its own model provider, and pull-request proof cards use GitHub.
