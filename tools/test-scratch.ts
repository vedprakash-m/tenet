import { mkdirSync, mkdtempSync, realpathSync } from "node:fs";
import { join } from "node:path";

export function projectScratch(prefix: string): string {
  const parent = join(import.meta.dirname, "../.host-runs/test-fixtures");
  mkdirSync(parent, { recursive: true });
  return mkdtempSync(join(realpathSync(parent), prefix));
}
