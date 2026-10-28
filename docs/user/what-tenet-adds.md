<!-- DRAFT. Written from specs/ux-spec.md and the current plugin text. Status words follow specs/plan.md. -->
# What Tenet adds

Tenet is a plugin for GitHub Copilot in VS Code. It does not replace the editor, the chat or the model. It adds a loop around a request, and a small local program that records what is true about the work.

## You learn one command

`/tenet <what you want>`. Everything else is words after it.

| You say | Tenet does | Writes to your project |
|---|---|---|
| A task: "add…", "fix…", "plan…", "prototype…" | Starts or continues work and picks how careful to be from your words | Only when the work needs it |
| "review …" (or `/tenet-review`) | A read-only review of your uncommitted changes | Nothing |
| "status", "why …", "help", or `/tenet` alone | Answers and stops | Nothing |
| "setup", "feedback" | Shows a preview first | Only after you agree |

Asking never starts work. "Don't change anything" and "just explain" do not create `.tenet/`.

## What happens to a task

1. **Intent.** Tenet restates the request, asks only what it cannot decide, and writes down examples and rules (the acceptance basis). It asks you to confirm or correct Tenet-added examples, assumptions or design commitments when the kernel returns `basis-confirm`; it does not require confirmation when there are no such additions.
2. **A failing test first.** Tests are written before the code, and a changed test is a visible event, not a quiet edit.
3. **Checks through the kernel.** Your tests, types and lint run through the kernel. Each result is a receipt tied to the exact files it ran against. A later edit makes the receipt stale.
4. **A reviewer subagent.** It reads the change and reports findings with a severity and a disposition. Reviewer dispatch has been observed on VS Code; actual context isolation and host enforcement of tool restrictions remain unobserved.
5. **One stated outcome.** The report says which of a fixed set of outcomes was reached and what stopped a stronger one:

| Outcome | Meaning |
|---|---|
| `checked-local` | The required checks and review passed for this candidate, on your machine. It is not owner acceptance and not production readiness. |
| `implemented-unverified` | The change exists but a required check or confirmation is missing. |
| `prototype` | Built to explore. Promoting it later requires a fresh review. |
| `findings-only` | A review or investigation; nothing was built. |
| `blocked` | Something Tenet cannot decide or do stopped the work. |

## What the kernel decides and what the agents do

The kernel writes the binding facts: the outcome, the receipts, the counters and who owns what. Agents explain and do the work; they cannot relabel those facts. Records live in `.tenet/` in your project, which is git-ignored. Whether the host excludes `.tenet/` from indexing is unobserved. Tenet and its agents do not edit `.tenet/` by hand.

## What Tenet does with your Git repository

Tenet works on a branch and commits only the files it wrote, with a `Tenet-Work` trailer. Your uncommitted edits stay yours. It does not push, deploy or open pull requests on its own.

## What it can check

Tenet states its assistance level once, at the start of a task, in words. Full checking needs a TypeScript or JavaScript project with Vitest. Other setups get a lower level, for example "I can make this change; this setup isn't one I can fully check", or review only. Without Node.js 22.12 or newer, only an advisory review is possible.

## What it does not do

- It does not run as a service, deploy, or send your project anywhere except through the host's normal model traffic.
- It does not install machine prerequisites such as Node.js.
- It does not turn a missing or failed check into a passing one, and "ask less" is never permission.
- It cannot undo database or other external effects; Git gives source checkpoints and an undo path only.

## What is proven today

Little. See [The qualified tuple, as it stands](qualified-tuple.md).
