# Getting started with Tenet

Use Node.js 22 or later and Git 2.40 or later. Set your Git name and email before making commits. Pull-request proof cards need a GitHub repository with Actions enabled.

## Install

~~~sh
npm install --global @vedprakash-m/tenet
tenet --version
~~~

For a project-local install use `npm install --save-dev @vedprakash-m/tenet` and use `npx tenet` in the examples. If you want to run without either install, use `npx -y @vedprakash-m/tenet` in place of `tenet`.

npm and npx need registry access to fetch uncached packages. With Tenet already installed, `init` and `upgrade` normally get package integrity from npm. If Tenet reports `TN-ENV-REGISTRY` or you know the registry is blocked, use `tenet init --offline` or `tenet upgrade --offline`. These commands record local package integrity. The flag belongs to Tenet and works after the tool and its dependencies are installed. You can run `tenet doctor` to check the lock and available tools.

### Install from a release tarball

A mirror that has not synced Tenet can return 404 for both `npm install --global @vedprakash-m/tenet` and `npx`. Download a release tarball and its `SHA256SUMS` file from GitHub:

~~~sh
gh release download <version> --pattern "vedprakash-m-tenet-<version>.tgz"
gh release download <version> --pattern "SHA256SUMS"
sha256sum -c SHA256SUMS
npm install --global ./vedprakash-m-tenet-<version>.tgz
~~~

On Windows PowerShell, verify the same tarball with:

~~~powershell
$file = "vedprakash-m-tenet-<version>.tgz"; $expected = (Get-Content SHA256SUMS | Where-Object { $_ -match "  $([regex]::Escape($file))$" }).Split()[0]; if ((Get-FileHash $file -Algorithm SHA256).Hash -ne $expected) { throw "Checksum mismatch" }
~~~

You can use the release page in a browser instead of `gh release download`. npm dependencies in the tarball still come from your configured registry or mirror.

After the global install works, use the offline step:

~~~sh
tenet init --offline
~~~

Run `tenet upgrade` once online so CI can verify the package. If no checks appear on a pull request, check that GitHub Actions can run on the account.

## Use Tenet in an existing repository

Open a terminal at the root of a Git repository with at least one commit. If you finished the README quick start, continue at [Use Tenet on the next change](#use-tenet-on-the-next-change).

~~~sh
tenet init
tenet onboard --inventory-only
~~~

Read the setup plan and answer the prompts before confirming. If no test runner is detected, Tenet asks `What command runs your tests? (blank to skip)` (with `--yes`, no test check is written). Tenet may ask about adding a report to existing CI or changing local agent settings. Use the local settings option only if you want to authorize those writes. The inventory and assignment are written to `.tenet/onboard/`. Read the inventory before giving source material to your agent.

Onboarding skips `.archive/`, `archive/` and `old/` folders at any depth and lists them as `archive` in the inventory. Its output tells you how to add a negated pattern to `onboard.exclude` when you want those folders included.

## Configure your tests

Set or fix your test command in `tenet.yaml` during the setup pull request. CI always loads `checks` from the target (base) branch so an unmerged pull request cannot weaken what tests run; if a later pull request changes a check's `run` command, the proof card notes that the change takes effect after merge. Use `tenet verify --local` to run working-tree checks and preview the proof card locally before merging.

Each entry under `checks` (typically `checks.test`) uses:

| Field | Required | Meaning |
|---|---|---|
| `run` | yes | Shell command that executes the suite from the repository root |
| `report` | yes | Report parser format: `junit`, `ctrf`, `go-test-json`, `jest-json`, or `none` |
| `report_from` | no | Where Tenet reads the report: `file` (default) or `stdout` |
| `report_path` | no | File path for the report (defaults to `.tenet/reports/<name>.xml` or `.json`) |
| `setup` | no | Commands run before `run` (for example `npm ci` or `pip install -r requirements.txt`) |

One example per built-in preset:

```yaml
# Vitest (junit)
checks:
  test:
    setup: ["npm ci"]
    run: "npx vitest run --reporter=default --reporter=junit --outputFile.junit=.tenet/reports/test.xml"
    report: junit
    report_from: file
    report_path: .tenet/reports/test.xml
```

```yaml
# Jest (jest-json)
checks:
  test:
    setup: ["npm ci"]
    run: "npx jest --ci --json --outputFile=.tenet/reports/test.json"
    report: jest-json
    report_from: file
    report_path: .tenet/reports/test.json
```

```yaml
# Node test runner (`node:test`, junit)
checks:
  test:
    setup: ["npm ci"]
    run: "node --test --test-reporter=spec --test-reporter-destination=stdout --test-reporter=junit --test-reporter-destination=.tenet/reports/test.xml"
    report: junit
    report_from: file
    report_path: .tenet/reports/test.xml
```

```yaml
# Pytest (junit)
checks:
  test:
    setup: ["pip install -r requirements.txt"]
    run: "python -m pytest --junitxml=.tenet/reports/test.xml"
    report: junit
    report_from: file
    report_path: .tenet/reports/test.xml
```

```yaml
# Go (go-test-json)
checks:
  test:
    setup: ["go mod download"]
    run: "go test -json ./..."
    report: go-test-json
    report_from: stdout
```

```yaml
# CTRF (ctrf)
checks:
  test:
    setup: ["npm ci"]
    run: "npm test"
    report: ctrf
    report_from: file
    report_path: .tenet/reports/test.json
```

Use `report: none` when a check exits 0 or non-zero without producing a machine-readable report.

To keep folders out of onboarding inventory, add an `onboard.exclude` list to `tenet.yaml`:

~~~yaml
onboard:
  exclude:
    - "archive/**"
    - "vendor/**"
~~~

## Start a new project

Run these commands inside an empty project folder. If you already created the Git repository, continue with `tenet init`.

~~~sh
git init -b main
tenet init
git add -A
git commit -m "Set up Tenet"
~~~

During init, answer what the project is for and choose a project kind. Tenet creates a draft in `tenet/intent.md` using the purpose you provide, and leaves undecided sections for you and your agent to fill in. Make the first commit before running onboarding. If you want GitHub Actions for this project, create the GitHub repository and set its remote before running init.

## Draft and review

On GitHub, do this work on a branch so you can open a setup pull request. You can also do it locally and review the files in your working tree.

1. Ask your coding agent to run `tenet onboard`, open `.tenet/onboard/assignment.json` and follow the installed `tenet-draft-specs` skill. Tell it to ask you about unclear intent and cite the sources it uses. Your agent or its provider may receive project content.
2. Read the drafts and commit the setup and draft files. Run `tenet onboard --card` to check that citations resolve and print the onboarding summary. Commit the files it lists. If you have opened a setup pull request, rerun with `--pr <number>` and paste the card into its description.
3. Run `tenet bless` in your terminal. Review the vision first, then bless the requirements in the PRD or the Requirements section of `tenet/intent.md`. Link each vision item to a requirement or include it in a section called `Not yet in scope` and bless that section. Review design, experience and plan after the requirements. Open conflicts and questions block only the sections they apply to. Answer a question, mark it as not a blocker, or skip its section and come back later. Run `tenet check` and `tenet board` to see structural issues and what still needs review. Commit the blessing changes. On GitHub, push your changes and merge the setup pull request after review.

For the setup pull request, keep the acceptance block independent of any implementation:

~~~markdown
## Acceptance
Implements: none
- [ ] Setup checks run
- [ ] No tagged tests are expected yet
~~~

For a small repository the assignment can select `tenet/intent.md`. For a larger repository it can select separate documents. Follow the paths in the assignment.

## Use Tenet on the next change

Ask your agent to run `tenet context` with the paths or requirement IDs involved. A compatible agent can get the same context through the local MCP server. The default MCP entries generated by init may use npx to launch Tenet. Configure your host to launch an installed `tenet mcp` if registry access is unavailable.

On GitHub, merge setup before opening the next pull request. Ask your agent to include acceptance items and tag the tests that show them. Review the advisory proof card when the configured workflows complete. Check which commit was tested, which requirements it touches, and what evidence was missing. Repository branch protection remains under your control.

## Maintain the setup

Use `tenet doctor` to diagnose tools, the lock and workflows. After installing a new package version, run `tenet upgrade` from your repository and review the changes. Use `tenet remove` to remove managed setup and generated working state while keeping your specifications and records.
