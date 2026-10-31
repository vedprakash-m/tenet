// Export from the real route registrations, with an ephemeral database and no listener or ambient config.
import { buildApp } from "./app.ts";
import { loadConfig } from "./platform/config.ts";

const app = await buildApp(loadConfig({ NODE_ENV: "test", DATABASE_URL: ":memory:", LOG_LEVEL: "silent" }));
try {
  await app.ready();
  process.stdout.write(`${JSON.stringify(app.swagger(), null, 2)}\n`);
} finally { await app.close(); }
