// The only entry point that listens: 127.0.0.1 only. Anything else is a consequential change (docs/hardening.md).
import { buildApp } from "./app.ts";
import { loadConfig } from "./platform/config.ts";
import { openDb } from "./platform/db.ts";
import { seedDevIdentities } from "./platform/dev-identities.ts";

const config = loadConfig();
const db = openDb(config.databaseUrl);
const app = await buildApp(config, { db });
if (config.env !== "production") {
  const made = await seedDevIdentities(db, ".env.local", Date.now());
  if (made && !config.runToken) {
    process.stderr.write(`\nDevelopment identities (local only, saved in .env.local):\n${made.map((u) => `  ${u.role}: ${u.email} / ${u.password}`).join("\n")}\n\n`);
  }
}
await app.listen({ host: config.host, port: config.port });
