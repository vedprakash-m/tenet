# Architecture

UI → HTTP schemas → services (operations and invariants) → repositories (SQL) → database.

- `server/src/app.ts` builds the app from a config; `server/src/server.ts` is the only thing that listens.
- `server/src/platform/` is shared infrastructure behind small functions: config, db, migrations, backup and restore, auth, sessions, CSRF, errors, logging, health.
- `server/src/features/<f>/` is one vertical slice: its routes, services, repository, tests, and an `index.ts` that is its only public face.
- `shared/` holds the runtime API schemas used by both sides; it imports nothing from `server/` or `web/`.
- `server/test/e2e/` holds end-to-end specs run by Playwright against a real started server, on its own dedicated database (`PORT`, `DATABASE_URL`, `TENET_RUN_TOKEN` are provided by whatever started the check, Tenet or a plain `npm run e2e`); `playwright.config.ts`'s `webServer` starts and verifies it.

The boundaries are lint rules (`eslint.config.js`), each with a failing fixture in `server/test/boundaries.test.ts`. A file splits out when there is a reason (reusable validation, nontrivial domain logic, complex SQL, authorization, an independent change boundary), not by habit.
