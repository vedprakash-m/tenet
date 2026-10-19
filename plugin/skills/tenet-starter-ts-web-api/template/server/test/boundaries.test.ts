// Each boundary rule has a fixture that breaks it, so a rule that stops firing is noticed (TS §12.3).
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

async function lint(filePath: string, code: string) {
  const eslint = new ESLint({ cwd: process.cwd() });
  const [res] = await eslint.lintText(code, { filePath });
  return res!.messages.filter((m) => m.ruleId === "no-restricted-imports").map((m) => m.message);
}

describe("architecture boundaries", () => {
  it("shared/ imports nothing from server/ or web/", async () => {
    expect(await lint("shared/x.ts", 'import { a } from "../server/src/app.ts"; export const b = a;')).toHaveLength(1);
    expect(await lint("shared/x.ts", 'import { z } from "zod"; export const b = z;')).toHaveLength(0);
  });
  it("web/ never imports server code, directly or through a relative path", async () => {
    expect(await lint("web/src/x.ts", 'import { a } from "../../server/src/app.ts"; export const b = a;')).toHaveLength(1);
  });
  it("only platform/db, the migration runner and repositories import the database driver", async () => {
    const code = 'import Database from "better-sqlite3"; export const d = Database;';
    expect(await lint("server/src/features/loans/service.ts", code)).toHaveLength(1);
    expect(await lint("server/src/platform/auth/passwords.ts", code)).toHaveLength(1);
    expect(await lint("server/src/platform/db.ts", code)).toHaveLength(0);
    expect(await lint("server/src/features/loans/loans.repository.ts", code)).toHaveLength(0);
  });
  it("a feature reaches another feature only through its index.ts", async () => {
    expect(await lint("server/src/features/loans/service.ts", 'import { x } from "../people/internal.ts"; export const y = x;')).toHaveLength(1);
    expect(await lint("server/src/features/loans/service.ts", 'import { x } from "../../features/people/internal.ts"; export const y = x;')).toHaveLength(1);
    expect(await lint("server/src/features/loans/service.ts", 'import { x } from "../people/index.ts"; export const y = x;')).toHaveLength(0);
    expect(await lint("server/src/features/loans/service.ts", 'import { x } from "./helpers.ts"; export const y = x;')).toHaveLength(0);
    expect(await lint("server/src/features/loans/service.ts", 'import { x } from "../../platform/db.ts"; export const y = x;')).toHaveLength(0);
  });
});
