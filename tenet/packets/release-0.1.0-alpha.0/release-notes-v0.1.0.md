# Tenet 0.1.0

Tenet gives your coding agents specifications you approve and shows how pull requests line up with them. This release includes a local CLI and a kit you can add to existing or new Git repositories. You bring your own agent.

## Install and start

You need Node.js 22 or later and Git 2.40 or later. In a Git repository, run:

~~~sh
npm install --global @vedprakash-m/tenet
tenet init
tenet onboard
~~~

Review the setup plan before confirming. Give the drafting assignment to your agent, review its draft, then run `tenet bless` to approve sections. Use `tenet check` to find structural problems and `tenet board` to see what needs review. Agents can get the relevant approved text from `tenet context` or local MCP.

On GitHub, merge the setup workflows to get a proof card on subsequent pull requests. The card identifies the tested revision, relevant intent, tagged test results and missing evidence. Tenet also includes `doctor`, `upgrade` and `remove` for keeping the setup healthy or removing it.

## Limits in this release

- Pull-request proof cards need the GitHub Actions workflows installed by `tenet init`. The proof rules are advisory. Reviewers still decide whether the change and its tests prove the intended outcome.
- The CLI never calls a model. Your coding agent drafts the specifications using the installed skill, and you approve them in your terminal.
- npm installation needs registry access unless the package and its dependencies are already cached. An installed Tenet can run `init --offline` and `upgrade --offline` when the registry is blocked (`TN-ENV-REGISTRY`). This records local integrity. Use an online `tenet upgrade` once the package is reachable to pin the published artifact for GitHub Actions.
- Setup and local specification commands support Windows, macOS and Linux.

Read the [getting started guide](../../../docs/getting-started.md). Report problems in [GitHub Issues](https://github.com/vedprakash-m/tenet/issues) with your Tenet version, OS, command and exit code. Redact secrets and private repository content from any output you include.
