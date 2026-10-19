# tenet-starter-app

A small TypeScript API with the platform pieces already in place: sessions, CSRF, password hashing, migrations, errors, logging.

```bash
npm ci --ignore-scripts && npm rebuild better-sqlite3
npm test            # unit and integration tests (the server is exercised through app.inject)
npm run typecheck && npm run lint
npm run dev         # http://127.0.0.1:3000 ; development identities are printed on the first run
```

What it is not yet: see `docs/hardening.md`.
