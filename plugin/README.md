# Tenet plugin (M0 preview)

For requested diagnostics, use `diagnostics` and show the complete preview before
explicit `--save <relative.json> --preview-hash <hash>`. No automatic capture or
upload; see [diagnostics](../docs/diagnostics.md) for projection and redaction limits. plugin (M0 preview)

A governed, test-first engineering loop for GitHub Copilot in VS Code. A small local kernel (`kernel/tenet.mjs`) records what is true; the `tenet` agent does the work; a reviewer subagent reviews it.

**Status: preview; no host tuple is qualified.** On October 19–20, 2026, local plugin loading and multi-step work through `finish` were observed in VS Code on macOS. One observation used VS Code 1.143.0 with `@github/copilot` 1.0.100-1; the earlier VS Code 1.142.0 run did not record the Copilot extension version. Reviewer dispatch was observed, including refusal and retry of a partial result. Host enforcement of reviewer tool restrictions, context isolation, update and uninstall remain unobserved. Approval behavior was observed only as one terminal approval per session; the approval mode remains unknown. These partial observations do not establish an installed-and-working or qualified product. See the [qualified tuple record](../docs/user/qualified-tuple.md).

## What you need
- VS Code with GitHub Copilot Chat in agent mode, and the setting that enables agent plugins
- Node.js 22.12 or newer and Git (Tenet reuses your Node; it installs nothing)
- A TypeScript or JavaScript project with Vitest for full checking; other setups get a lower assistance level, stated up front
- Policy that allows agent mode, agent plugins, custom agents and subagents. If a policy blocks installation or one of these, Tenet does not work around it: read the host's message and ask whoever manages your Copilot settings to allow it (unobserved; see the root README)

## What it does and does not do
- Works on a branch of your repository and commits only the files it authored; your uncommitted work stays yours
- Runs only through the kernel, which keeps records in `.tenet/` (git-ignored; exclusion from host indexing is unobserved)
- Does not deploy, push or open pull requests; those arrive later and only on your request
- Hooks: none ship in this preview, so the kernel cannot observe edits you or the agent make outside its own calls; it detects them by comparison instead

## Use it
`/tenet <what you want>` builds, fixes, refactors, plans or investigates. `/tenet status`, `/tenet why` and `/tenet help` answer without starting work. `/tenet-review` reviews code without changing anything.

To remove it, uninstall the plugin and delete `.tenet/` in the projects where you used it.

## License

Tenet and its own starter-template code use the [MIT License](LICENSE). Third-party components retain their respective licenses; the built payload includes [NOTICE](NOTICE). License selection does not qualify this preview or authorize publication.
