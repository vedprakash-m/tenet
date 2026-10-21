// `npm run restore -- <backup file>`: puts a verified backup back as the configured database. Stop the app first.
import { loadConfig } from "./platform/config.ts";
import { restore } from "./platform/restore.ts";

const backup = process.argv[2];
if (!backup) {
  console.error("usage: npm run restore -- <backup file>");
  process.exit(2);
}
try {
  const r = restore(backup, loadConfig().databaseUrl);
  console.log(`restored schema ${r.schemaVersion}; needs ${r.compatibleWith}`);
  if (r.keptAside) console.log(`the replaced database is kept at ${r.keptAside}`);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
