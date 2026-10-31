---
name: tenet-starter-ts-web-api
description: "Scaffold and extend the TypeScript web/API starter (React, Vite, Fastify, SQLite, sessions, CSRF, migrations) for a new project, then grow it one feature at a time."
---
# Starter: TypeScript web/API

Use for a new project in an empty folder, and when extending a project that came from this starter. A project that already has code is never converted to the starter.

## Scaffold (its own contract)
1. `tenet open feature --request <text> --lane quick` in the empty folder. If there is no Git repository, the kernel asks; with the user's yes, repeat with `--init-git`.
2. Record a basis with one requirement ("the starter's platform tests pass") and one example, `test: preservation`, `expect: pass`, `testFile: server/test/platform.test.ts`. Nothing needs a red here: the platform is vetted, pinned content.
3. `tenet decide scaffold --h <handle>` writes the platform layer and installs the pinned lockfile (`npm ci --ignore-scripts --no-audit`, then `npm rebuild better-sqlite3`). Package auditing is a separate check; install output is not audit evidence. Add `{"propose": {"name": "<project>"}}` on stdin to name it, or `"protectDefaults": false` if the user declines the protected paths. Say in the kickoff that this writes files and needs the network.
   - Exit 2 `scaffold-target-not-empty`: a file the starter would write exists; name it and stop, never overwrite.
   - Exit 2 `install-failed`: the files are kept; fix the cause (network, proxy, disk) and run the same decision again, which repeats only the install.
4. Real browser checks also need Playwright's Chromium. If it is missing, disclose that `node node_modules/@playwright/test/cli.js install chromium` downloads a browser into the host cache and ask before running it; never install it silently or claim the browser journey passed. This host prerequisite is separate from the pinned npm install.
5. `tenet check --h <handle> --stage candidate`, then `tenet finish --h <handle>`. The scaffold is committed as the first checkpoint.
6. The first plan item is a new contract in the Standard lane. `features/<f>/` starts empty; that item's own build creates the first feature.

## What the platform gives you
Config, database (WAL, foreign keys, immediate write transactions), forward-only checksummed migrations with a verified backup, scrypt password hashing, sessions (256-bit IDs, signed HttpOnly SameSite=Lax cookie, rotation on sign-in, all sessions revoked on password change, idle and absolute expiry), CSRF bound to the session, problem-style errors without stacks, redacted logs with correlation IDs, helmet, rate limits, `/api/health`. Development identities are written to `.env.local` on the first run. A React/Vite account shell provides sign-in, a fresh account read/reload, sign-out, retained-input errors, loading/retry and keyboard focus. `npm run dev:web` serves it on loopback port 5173 and proxies `/api`; start the API separately with `npm run dev`. Browser tests use a dedicated database and synthetic test account, with axe and keyboard checks. `journeys.json` lists scope; record manual screen-reader observations in `docs/a11y-checks.md` before making a broader accessibility claim.

`npm run --silent openapi` exports the shared-schema API contract without listening or touching the development database. Add route request/response schemas and cookie/CSRF metadata with each feature; metadata is documentation; authorization stays in actor/policy checks. Review the export diff; automatic compatibility and trait-based findings remain pending.

## Protected paths
`server/src/platform/auth/*`, `server/src/platform/session/*` and `server/migrations/*` are proposed as protected in the kickoff. Changing them needs the user's say-so for that work.

## Adding a feature
- A feature is a folder under `server/src/features/<name>/` with its routes, service, repository, tests and an `index.ts` that is its only public face. Another feature imports only that `index.ts`.
- Only `platform/db` and `*.repository.ts` files import the database driver. `shared/` holds API schemas and imports nothing from `server/` or `web/`.
- Every list endpoint is paginated with `PageQuery`. A route checks the actor with `requireActor` and authorizes the object, not only the role; write a denial test as the wrong user.
- Schema changes are new numbered migrations, never edits to applied ones; test the migration against data written by the previous schema.
- Anything that is a shortcut, prototype or known gap goes into `docs/hardening.md` in the same change.
- Checks: `npm test`, `npm run typecheck`, `npm run lint`; the kernel runs the tests through `tenet check`.

## Not in this starter yet
Domain feature UI/journeys, per-changed-journey kernel obligations, manual accessibility evidence, a load workload, and API compatibility enforcement. Say so when the user asks for them; do not improvise a substitute.
