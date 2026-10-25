// `npm run restore -- <backup file>` puts a verified backup back as the configured database. Stop the app first.
// `npm run restore -- --finish` or `--rollback` settles a restore that was interrupted.
import { loadConfig } from "./platform/config.ts";
import { recoverRestore, restore } from "./platform/restore.ts";

const arg = process.argv[2];
if (!arg) {
  console.error("usage: npm run restore -- <backup file> | --finish | --rollback");
  process.exit(2);
}
try {
  const db = loadConfig().databaseUrl;
  if (arg === "--finish" || arg === "--rollback") {
    console.log(recoverRestore(db, arg === "--finish" ? "finish" : "rollback"));
  } else {
    const r = restore(arg, db);
    console.log(`restored schema ${r.schemaVersion}; needs ${r.compatibleWith}`);
    if (r.keptAside) console.log(`the replaced database is kept at ${r.keptAside}`);
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
