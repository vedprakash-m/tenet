<!-- DRAFT for owner review. The reporting channel, repository URL and supported versions are placeholders. Sources: PRD sections 5.5 and 5.9.2, tech-spec section 11. -->
# Security policy

## Reporting a vulnerability

Do not open a public issue for a security problem.

Report it privately to: **PLACEHOLDER-SECURITY-CONTACT** (a private advisory form on PLACEHOLDER-REPOSITORY-URL, or a monitored address; the owner chooses one and fills it in before publication).

Include: what you found, the version or commit, the steps to reproduce, and what you think the impact is. Do not include real credentials or other people's data.

**What to expect (targets from the release policy, not a guarantee of a fix):**

- The security maintainer acknowledges a report within 3 days of receipt.
- A decision on fix, mitigation or withdrawal of the affected version follows within 7 days. A withdrawal or an advisory may come before a fix.
- Withdrawn versions are marked as unsupported.

Today one person holds every maintainer role, so these targets depend on one person's availability.

## Supported versions

PLACEHOLDER-SUPPORTED-VERSIONS. No release exists yet, so no version is supported. The intended policy (PRD Q-09) is: the latest minor release gets fixes; the previous minor gets security fixes for 3 months after a new minor ships.

## What Tenet protects, and what it does not

Tenet is a local tool. It gives the host's agent a small kernel that records what is true, and it limits what that agent can claim. It is not a sandbox.

**In scope for a report:**

- An over-eager or mistaken agent that gets Tenet to record something false: a forged approval, a relabelled outcome, a receipt that does not match what ran.
- Malicious or compromised repository content, retrieved documents, tool output and test reports, including a cloned repository that ships a pre-populated `.tenet/`, a loosened shared policy, or hostile report files.
- Dependencies and their install scripts, and Git hooks.
- Saved lessons used to carry instructions.
- Plugin updates and look-alike plugins.
- Tenet's own build, CI and release pipeline.
- Path traversal or symlink escape in the kernel, including a symlinked `.tenet/`.
- Secrets reaching model context, Git, logs or exports.

**Out of scope:**

- A malicious authorized operator (the person using Tenet).
- A compromised host application, operating system or model provider.
- Changes made outside work Tenet can observe.

## What to know before relying on Tenet

- **The audit trail is local and is not tamper-proof.** Anyone with write access to the project and the temp folder can alter it.
- **Autopilot.** Tenet cannot detect Copilot's Autopilot, which can answer native questions automatically. Under it, every decision record is unverifiable. Authority questions are asked in plain chat for this reason. See [docs/user/autopilot.md](docs/user/autopilot.md).
- **Several host controls are cooperative.** Tool restrictions for the reviewer, `.tenet/` exclusion from host indexing, and exclusions in agent file tools depend on the host honoring them or on the agent following instructions. Which of them the host enforces on VS Code is unobserved. Tenet's own kernel enforces its exclusions, but the host's agent can read what the host lets it read.
- **Approval mode and containment are recorded as unknown.** Tenet does not infer them.
- **The kernel runs the `node` found on your `PATH`.** Helper scripts are located by the plugin's install path, not by `PATH`, but the Node binary is not pinned. This is a documented residual risk.
- **Redaction is incomplete.** Tenet removes common token patterns from what it displays, logs or exports, and says detection is incomplete. If a real credential reaches model context, rotate it. Tenet can remove its own copies and not copies held elsewhere.
- **Checks run your project's code.** Tests, linters and servers run as local processes with a reduced environment, under limits on time and output. They are not isolated from your machine.
- **Nothing is qualified on a real host yet.** See [docs/user/qualified-tuple.md](docs/user/qualified-tuple.md).

## How the kernel limits itself (design, verified by local tests only)

The kernel validates all input with size and depth limits; uses no `eval`, `Function`, `vm`, worker threads or computed `import()`; opens no client sockets and runs no remote Git commands; resolves paths against the workspace, run directory and user directory, and refuses a symlinked `.tenet/`; runs no shell (argument arrays only), with process groups, timeouts and output limits; and runs only registered checks and fixed Git and package-manager commands, with no generic execution verb. The kernel never runs from the workspace, and it never calls billing or purchase interfaces. These are properties of the code under deterministic tests. They are not host-level guarantees.

## Release verification

PLACEHOLDER-RELEASE-VERIFICATION. The planned chain is: a protected default branch, pinned build inputs, a reproducible build compared by independent rebuild, a signed tag with a build-provenance attestation, and install steps that let you confirm the installed version and source (`/tenet help` shows them). None of these exist yet; the release has not been built or published. Until it is, a downloaded copy cannot be verified, and look-alike plugins are a real risk.

While there is one maintainer, a change to hooks, helpers, permissions, destinations or evaluators waits a public 72-hour review window on an open pull request, and release notes will say that no second maintainer reviewed it.
