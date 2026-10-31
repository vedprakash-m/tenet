# Architecture

UI → HTTP schemas → services (operations and invariants) → repositories (SQL) → database.

- `server/src/app.ts` builds the app from a config; `server/src/server.ts` is the production API entry point; Vite serves the browser shell separately in development.
- `server/src/platform/` is shared infrastructure behind small functions: config, db, migrations, backup and restore, auth, sessions, CSRF, errors, logging, health.
- `server/src/features/<f>/` is one vertical slice: its routes, services, repository, tests, and an `index.ts` that is its only public face.
- `web/src/` holds the account UI; `lib/api.ts` handles same-origin requests and validates shared response schemas. Session state is read from the server; credentials are never cached in local storage.
- `shared/` holds the runtime API schemas used by both sides; it imports nothing from `server/` or `web/`.
- `server/test/e2e/` holds end-to-end specs run by Playwright against a real started server, on its own dedicated database (`PORT`, `DATABASE_URL`, `TENET_RUN_TOKEN` are provided by whatever started the check, Tenet or a plain `npm run e2e`); `playwright.config.ts`'s `webServer` runs `server/test/support/browser-server.ts`: the real source API on an OS-selected loopback port and a freshly built production UI on the allocated public loopback port, using Vite preview to proxy `/api`. Every invocation builds the current source into a new owned directory beside its dedicated database; it does not reuse workspace output. Its synthetic identity is test-only, and the health token passes through the proxy. Cache, reports and database belong to the check run.

The boundaries are lint rules (`eslint.config.js`), each with a failing fixture in `server/test/boundaries.test.ts`. A file splits out when there is a reason (reusable validation, nontrivial domain logic, complex SQL, authorization, an independent change boundary), not by habit.

`server/src/platform/openapi.ts` registers the document generator before routes. Shared Zod schemas supply validation, serialization and OpenAPI; route metadata describes cookie/CSRF needs, while actor/policy/CSRF hooks enforce them. `server/src/openapi.ts` exports JSON through an in-memory application without listening or reading ambient configuration. An added feature participates through its real route registrations. The version in the document is the application's version (`0.0.0` initially), separate from the recipe version. Compatibility comparison and trait-based findings remain pending.

Integration references: [Fastify Swagger route discovery](https://github.com/fastify/fastify-swagger#usage) and [Zod provider transforms](https://github.com/turkerdev/fastify-type-provider-zod#how-to-use-together-with-fastifyswagger).

Migration startup and restore share the same read-only checksum/prefix admission. New migration files must follow applied versions; inserting an earlier file is refused before backup or SQL application. Restore additionally checks foreign keys and refuses user tables with no recorded history. Validation runs before the initial move and again on the copied install, including recovery. The frozen schema-1 fixture in the loan golden task tests a populated prior application's actual upgrade, automatic backup, auth, restore and re-upgrade without building the old database through current migration/seed helpers.

- `platform/admission.ts` charges independent coarse/anonymous/user/password counters. It performs bounded read-only identity lookup, never populating `req.actor`; `app.ts` re-reads current session/user authority inside maintenance. `platform/rate-metadata.ts` seals the actual served rate metadata against grouping; its ready diagnostic is deliberately weaker than the request boundary. No actor/session data is cached between requests.
- The isolated admission browser case forks the same source fixture with its own database, run token and OS-selected loopback port, verifies that identity and cleans it up. The primary E2E server still uses Tenet's allocated port/token. A narrow IPC ready message supports owned test startup; no HTTP reset/admin endpoint or rate exemption is added.
