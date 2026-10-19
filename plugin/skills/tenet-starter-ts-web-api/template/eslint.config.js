// Boundaries are lint rules, not conventions (TS §12.3). Each rule has a fixture that breaks it in server/test/boundaries.test.ts.
import tseslint from "typescript-eslint";

const restrict = (patterns) => ({ "no-restricted-imports": ["error", { patterns }] });
const DRIVER = { name: "better-sqlite3", message: "only platform/db and repositories import the database driver" };

export default tseslint.config(
  { ignores: ["node_modules", "data", "dist"] },
  ...tseslint.configs.recommended,
  { rules: { complexity: ["error", 12] } },
  // shared/ is runtime schemas only: it imports nothing from the server or the web app.
  { files: ["shared/**/*.ts"], rules: restrict([{ group: ["**/server/**", "**/web/**"], message: "shared/ must not import server or web code" }]) },
  // The browser never imports server code.
  { files: ["web/**/*.{ts,tsx}"], rules: restrict([{ group: ["**/server/**"], message: "web/ must not import server code" }]) },
  // Only platform/db, the migration runner, backup and repositories touch the database driver.
  {
    files: ["server/src/**/*.ts"], ignores: ["server/src/platform/db.ts", "server/src/platform/migrate.ts", "server/src/platform/backup.ts", "server/src/**/*.repository.ts"],
    rules: { "no-restricted-imports": ["error", { paths: [DRIVER] }] },
  },
  // A feature reaches another feature only through its index.ts (and, like all code here, never the driver directly).
  {
    files: ["server/src/features/**/*.ts"], ignores: ["server/src/**/*.repository.ts"],
    rules: { "no-restricted-imports": ["error", { paths: [DRIVER], patterns: [
      { group: ["**/features/*/*", "!**/features/*/index.ts"], message: "import another feature only through its index.ts" },
      { group: ["../*/*", "!../../**", "!../*/index.ts"], message: "import another feature only through its index.ts" },
    ] }] },
  },
);
