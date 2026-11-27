# Frequently asked questions

## Do I need a Tenet account or server?

Tenet runs as a command, CI workflow and files in your repository. Pull-request cards use the GitHub Actions workflows set up by `tenet init`.

## Does Tenet draft my specifications?

Tenet prepares an inventory and instructions. Your coding agent drafts the specifications and asks you about unresolved intent.

## Can I see what Tenet reads before drafting?

Yes. Use `tenet onboard --inventory-only` to prepare the inventory before sending source material to your agent through the drafting workflow.

## Can I try cards before blessing a specification?

Yes. Merge setup and skip drafting for now. The card reports that intent has yet to be blessed. Run `tenet onboard` when you want to begin.

## Does merging the setup pull request bless the draft?

Blessing needs an explicit human choice. Use `tenet bless` in your terminal. You can leave individual sections for later.

## What happens when someone edits a blessed specification?

The edit becomes a proposal. The last blessed text stays in force until a replacement is blessed. The board shows the edit or changed source.

## Does a passing test settle whether the change is right?

A pass tells you which tagged tests ran successfully on the named commit. Use the item text and results to decide whether the tests cover the intended change.

## Why does the card say “coverage not confirmed”?

Tagged results passed, but Tenet could not match them to every tagged test for the item. Read the result details to see what is available.

## Will Tenet block a pull request?

Setup starts in `observe`. The card reports findings and what a rule would have blocked. Rule enforcement starts in later releases.

## Where can I see which sections are waiting for me?

Run `tenet board`. It lists sections awaiting blessing, edited sections, changed sources and specification debt.

## What if the package and the lock disagree?

Run `tenet upgrade` after installing the intended package version. Review the regenerated setup before committing the changes.

## How do I remove Tenet?

Run `tenet remove` to remove managed setup and generated files. Your specifications and records stay. Tenet also keeps `.tenet/onboard/interview.json` because it contains the Owner's answers, and reports it as kept. Read the output for every removed path, every kept item and the reminder about branch rules.

## Which steps use the network?

npm needs the registry to install uncached packages. An installed Tenet normally checks the registry for package integrity during `init` and `upgrade`. If your network blocks that lookup or you get `TN-ENV-REGISTRY`, rerun with `--offline`. That records local integrity. When the registry is reachable, run an online `tenet upgrade` to pin the package for GitHub Actions.

Inventory, blessing, the board and command-line context work locally. Your coding agent may use its own model provider, and pull-request proof cards use GitHub.

## Sources

- [UX specification](../tenet/specs/ux-spec.md)
- [PRD](../tenet/specs/prd.md)
- [Onboarding specification](../tenet/specs/tech-spec/onboarding.md)
- [CI specification](../tenet/specs/tech-spec/ci.md)
