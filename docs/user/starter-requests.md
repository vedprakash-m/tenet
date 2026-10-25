<!-- DRAFT. Each request is a plain-words example, not a recorded transcript. None has been run through a qualified tuple. -->
# Three starter requests

Open Copilot Chat in agent mode, in the project folder, and send one of these. Tenet says the assistance level and the lane (how careful it will be) it chose, then asks only what it cannot decide itself.

## 1. A new app

```text
/tenet build a small API for tracking reminders, with sign-in
```

Use an empty folder or a new Git repository. Tenet offers its starter (a small TypeScript API with Fastify, SQLite, sessions, migrations and tests already in place), asks how to initialize Git, shows the plan for the first piece, then writes tests first. The install step downloads packages and a prebuilt SQLite binary, so it needs the network and says so first. The starter is a base for work, not a finished product: `docs/hardening.md` in the starter lists what it does not cover yet.

## 2. A bug fix

```text
/tenet fix: saving a reminder with an empty title returns a server error, and it should say the title is required
```

Tenet writes a test that fails for this reason first, changes the code until it passes, runs the project's checks, and has a fresh reviewer read the change. The report says which outcome was reached. Use a branch or a clean working tree if you can; if you have uncommitted work, Tenet leaves it alone and says which files are yours.

## 3. A review

```text
/tenet-review review my uncommitted changes
```

This is read-only. It changes nothing in your project, runs no scripts and no checks, and reports findings with a severity each. Its review file is written to the system temp folder. Only uncommitted changes compared with `HEAD` can be reviewed today; for another scope Tenet says so.

## Then

- `/tenet status` says where things stand and starts nothing.
- `/tenet why` explains the last decision or outcome.
- `/tenet help` says what Tenet can do in this project.
- To change how it talks to you: "be brief", "explain more", "only interrupt for decisions". These last for the current task unless you say "always".
