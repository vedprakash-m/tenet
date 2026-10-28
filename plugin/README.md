# Tenet plugin (M0 preview)

A governed, test-first engineering loop for GitHub Copilot in VS Code. A small local kernel (`kernel/tenet.mjs`) records what is true; the `tenet` agent does the work; a reviewer subagent reviews it.

**Status: preview; no host tuple is qualified.** On VS Code, plugin loading from a local plugin location, skill-relative kernel invocation from the host's snapshot copy, and reviewer dispatch have been observed. Context isolation and host enforcement of the reviewer's tool restrictions remain unobserved. Approval behavior was observed only as one terminal approval per session; the approval mode remains unknown. These partial observations do not establish an installed-and-working or qualified product.

## What you need
- VS Code with GitHub Copilot Chat in agent mode, and the setting that enables agent plugins
- Node.js 22.12 or newer and Git (Tenet reuses your Node; it installs nothing)
- A TypeScript or JavaScript project with Vitest for full checking; other setups get a lower assistance level, stated up front

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
