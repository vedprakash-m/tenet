# Getting started with Tenet

Source: [UX Parts 0–1](../tenet/specs/ux-spec.md#part-0-get-tenet), [command contract §8](../tenet/specs/tech-spec/contracts.md#8-commands).

**Draft for 0.1.0-alpha.0**

## Install

Source: [UX Part 0](../tenet/specs/ux-spec.md#part-0-get-tenet), [technical specification §1](../tenet/specs/tech-spec.md#1-architecture).

Use Node 22 or later and Git 2.40 or later. Pull-request cards use a GitHub repository with Actions enabled. Tenet uses your existing coding agent for drafting.

For a global install, run:

~~~sh
npm install --global @vedprakash-m/tenet@0.1.0-alpha.0
~~~

In a Node project you can install Tenet as a development dependency:

~~~sh
npm install --save-dev @vedprakash-m/tenet@0.1.0-alpha.0
npx tenet init
~~~

If a global install fails on permissions, use `npx -y @vedprakash-m/tenet@0.1.0-alpha.0` wherever the steps below use `tenet`. Run `tenet doctor` to see the installed version and whether its files match.

## Use Tenet in an existing repository

Source: [UX Part 1A](../tenet/specs/ux-spec.md#1a-an-existing-repository), [onboarding §1](../tenet/specs/tech-spec/onboarding.md#1-onboarding-and-blessing-r-223).

1. Open a terminal in the repository and run `tenet init`. Read the preflight list of files and review the first findings. Setup starts in `observe`.
2. Ask your agent to run `tenet onboard` and follow the `draft-specs` skill. Answer its questions about the project's intent. The agent drafts the specifications and opens one pull request named **Set up Tenet**. Use `tenet onboard --inventory-only` for an inventory before drafting through your agent and its model provider.
3. Review the onboarding card. If needed, check out the setup pull request. The UX example uses `gh pr checkout 12` for pull request 12. Run `tenet bless` in your terminal. Resolve conflicts and review each section. Commit and push the blessing changes, then merge the setup pull request. The example terminal command is `git add tenet/ && git commit -m "Bless specifications" && git push`.
4. Ask your agent for a change you already needed. Its pull request lists its acceptance items and the requirements it implements. Read the proof card and review and merge through the forge. CI proof cards begin after you merge setup.

For agent-led setup, the [UX install prompt](../tenet/specs/ux-spec.md#part-0-get-tenet) uses `tenet init --yes` and `tenet onboard`. To try proof cards before drafting, merge setup alone. The card reports `intent not yet blessed`. Return to `tenet onboard` when ready.

## Start a new project

Source: [UX Part 1B](../tenet/specs/ux-spec.md#1b-a-new-project), [onboarding §1](../tenet/specs/tech-spec/onboarding.md#1-onboarding-and-blessing-r-223).

1. Create the repository and run `tenet init`. Answer what you are building and choose a project kind. Tenet writes the starter `tenet/intent.md`.
2. Commit the starting files to the main branch. If you created the repository from the [starter template](https://github.com/vedprakash-m/tenet-starter), clone it and start at step 3.
3. Ask your agent to run `tenet onboard` and draft the specifications. Answer the questions, review the pull request and run `tenet bless`. Review and merge the setup.
4. Ask your agent to build the first slice. In the UX example, the change includes a proposed test command in `tenet.yaml`. Review the card's `proposed check · approve tenet.yaml to pin` line and the policy change before approving and merging.

## Check the project's specification state

Source: [UX Part 2](../tenet/specs/ux-spec.md#part-2-the-daily-loop), [command contract §8](../tenet/specs/tech-spec/contracts.md#8-commands).

Run `tenet board` to see sections waiting for a blessing, edits, changed sources and specification debt. Add `--all` to include clean blessed sections. The full pull-request board arrives in alpha.1.
