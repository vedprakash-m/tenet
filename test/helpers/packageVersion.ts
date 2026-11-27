import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as { version?: unknown };
assert.equal(typeof manifest.version, "string");
export const packageVersion = manifest.version as string;
