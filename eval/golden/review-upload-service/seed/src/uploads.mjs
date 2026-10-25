import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "uploads";

// Returns the stored text for a file name the client chose.
export function readUpload(name) {
  return readFileSync(join(ROOT, name), "utf8");
}
