# tenet-starter-app

A TypeScript web/API platform: a React/Vite sign-in and account shell over Fastify, SQLite, sessions, CSRF, password hashing, migrations, errors and logging. Application features are added one increment at a time.

```bash
npm ci --ignore-scripts --no-audit && npm rebuild better-sqlite3
npm run dev         # API at http://127.0.0.1:3000
npm run dev:web     # separate terminal: http://127.0.0.1:5173, proxying /api
```

The first API start creates synthetic development accounts and prints their random passwords to stderr; they are saved in the gitignored `.env.local`. Enter one in the browser. The UI keeps session credentials in the server's HttpOnly cookie, never local storage. Both servers bind to loopback. Set `PORT` identically for API and Vite when changing the API port; the web port remains 5173.

Startup and restore refuse an unreadable or malformed database owner record without removing it. Preserve the files and verify ownership before manual recovery; unknown ownership is not evidence that the holder is gone. Concurrent stale-owner replacement and release races remain unqualified.

New restores also refuse when SQLite reports a busy WAL checkpoint, before writing the restore marker or moving database files. Stop every database user before retrying. This detects a reader blocking that checkpoint; it does not prevent an external connection from opening after the check or qualify concurrent recovery.

A backup must be a separate file, not a symbolic or hard link to the live database or either sidecar. Restore checks resolved names and filesystem device/file identities before reading the backup. This is a point-in-time alias check, not protection against concurrent path replacement.

Migrations also back up an existing user-table schema with no recorded migrations before applying its first migration. A failed backup stops that migration. The copy preserves the original rows and empty history; it does not invent a history or make an unrecorded schema eligible for `restore`. Such a copy needs the originating code or an explicit data migration.

A new restore also refuses if any generated kept-aside destination already exists, before writing its marker or moving files. Preserve those earlier files and retry later. The preflight does not reserve paths against concurrent external creation; interrupted recovery retains its separate marker-based behavior.

Existing `.restoring`, `.restoring-wal`, `.restoring-shm` or `.restore-in-progress.tmp` entries also block a new restore. Preserve them for manual inspection rather than letting a new operation overwrite or delete them. This preflight does not change interrupted recovery or reserve paths against external creation.

An unreadable restore-marker entry, including a dangling link, remains an unfinished restore. Startup and new restores refuse; recovery reports the unreadable marker without acquiring ownership. If entry inspection itself fails, absence is not assumed. Preserve the files for manual inspection.

```bash
npm test                         # server and client unit/integration checks
npm run typecheck && npm run lint
npm run build                    # browser artifact in dist/web; not a deployment
npm run --silent openapi > openapi.json  # source-derived API contract; no listener or development DB
node node_modules/@playwright/test/cli.js install chromium
npm run e2e                      # source-bound browser/API journey on a dedicated test database
```

The unit/integration suite uses at most two Vitest workers so concurrent SQLite and child-process checks do not scale with the machine's CPU count. Test deadlines are unchanged. Run heavy builds separately when checking timing-sensitive behavior; passing a rerun does not discard an earlier failure.

The browser fixture starts the real source API and builds the current UI into a fresh owned directory, then serves that production UI with a same-origin Vite preview proxy in one process, seeds only its own synthetic test account, and uses `test-results/e2e.db` for a direct run. Tenet supplies its own run database, port and identity token instead. It never reads development passwords from `.env.local`. Build/cache output belongs to the test run; a previous workspace build is never reused. The fixture attempts cleanup on exit, but forced Windows teardown can leave generated output and a stale owner file. Passing journeys do not establish clean process/artifact teardown. ESLint excludes generated `test-results` and `playwright-report`, not application source. Browser tests include axe and keyboard assertions; results cover sign-in, account read/reload and sign-out, plus controlled failure states. They are not a complete WCAG or ASVS conformance claim. Follow `docs/a11y-checks.md` for manual screen-reader checks and record the outcome.

`journeys.json` describes the current platform journeys and their source files. Add domain journeys with the first feature. `docs/asvs.md` accounts for the complete pinned ASVS 5.0.0 Level 1 inventory, methods, gaps and scoped non-applicability; no full requirement is marked passed. Per-changed-journey kernel obligations, a workload, API compatibility enforcement and production delivery remain unfinished; see `docs/hardening.md`.

OpenAPI 3.1 is generated by `@fastify/swagger` from the same Zod route schemas used at runtime. The exporter builds the real routes against an ephemeral in-memory database, ignores ambient environment configuration and closes without listening; it never seeds development users or reads `.env.local`. Cookie/CSRF metadata describes the actual hooks; it does not enforce access control. Add request/response schemas and security metadata with each feature, then export again. Review the resulting diff; automatic breaking-change findings, trait-driven compatibility/semver enforcement and a served documentation UI are not implemented.

Admission uses the documented per-process/IP/user limits in `docs/hardening.md`. Authenticated reload/sign-out is independent of anonymous quota within the shared coarse bound. Browser tests intentionally exhaust a separate owned source server, preserving all other journey assertions and the actual limits. These local controls do not establish workload/RSS or release qualification.
