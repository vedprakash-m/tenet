# Hardening notes

What this project is **not**, yet. Every shortcut and every prototype adds to this list; nothing here is a surprise.

- **Development identities only.** The first run seeds `admin@example.test` and `member@example.test` with random passwords saved in `.env.local` (git-ignored). They exist for local use on your own machine. Do not run this on a shared machine.
- **Local binding only.** The API listens on `127.0.0.1`. Any other binding, and any TLS termination, is a consequential change to decide and record here first.
- **No TLS.** Cookies are not marked `Secure` outside production.
- **One node.** SQLite in WAL mode is a single-node envelope. Writes that protect an invariant use immediate transactions; a busy database is retried for a second and then answers 503.
- **No email.** There is no password reset by email and no verification.
- **Backups are manual.** `platform/backup.ts` makes and verifies a copy and migrations take one before changing a database that has data; there is no schedule. `npm run restore -- <backup>` puts a verified copy back (stop the app first); the replaced database is kept beside it, and a copy written by newer code is refused. Restore never touches anything but the database file: uploads and other external state are not covered.
- **Production secrets.** `COOKIE_SECRET` (32+ characters) is required in production and is never committed.
- **Deployment checklist.** Not written: this project does not deploy anything.
