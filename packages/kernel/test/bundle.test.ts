import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ROOT = join(import.meta.dirname, "../../..");

describe("built payload-only rules [SEC-03, SEC-07]", () => {
  it("contains no runtime network client import beyond the admitted source boundary", () => {
    const bundle = join(ROOT, "plugin/kernel/tenet.mjs");
    assert.ok(statSync(bundle).size <= 900 * 1024);
    assert.doesNotMatch(readFileSync(bundle, "utf8"), /from ["']node:(?:http|https|http2|tls)["']|import\(["']node:(?:net|http|https)["']\)/);
  });
});
