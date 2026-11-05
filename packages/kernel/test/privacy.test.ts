import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanDiff } from "../../../tools/privacy-check.ts";

const diff = (file: string, ...added: string[]) => `+++ b/${file}\n@@ -0,0 +1,${added.length} @@\n${added.map((l) => `+${l}`).join("\n")}\n`;

describe("privacy check", () => {
  it("finds keys, tokens, credential assignments, personal paths and real addresses in added lines, with line numbers", () => {
    const f = scanDiff(diff("a.ts", "ok", "const t = 'ghp_" + "a".repeat(30) + "';", "path = '/Users/someone/work/x'", "password = 'hunter2hunter2'", "mail ada@corp.io", "-----BEGIN RSA PRIVATE KEY-----")); // privacy-ok
    assert.deepEqual(f.map((x) => [x.line, x.what]), [[2, "a token"], [3, "a personal path"], [4, "a credential assignment"], [5, "an email address"], [6, "a private key"]]);
  });
  it("ignores removed lines, example addresses, the attribution address and marked lines", () => {
    assert.deepEqual(scanDiff("+++ b/a.md\n@@ -1 +1 @@\n-/Users/someone/x\n+ada@example.test noreply@anthropic.com test@example.com\n+/Users/x/y privacy-ok\n"), []);
  });
  it("flags a secret-store file by name, but not an example env file", () => {
    assert.equal(scanDiff(diff(".env.local", "A=1")).length, 1);
    assert.equal(scanDiff(diff("keys/id_rsa", "x")).length, 1);
    assert.deepEqual(scanDiff(diff(".env.example", "A=")), []);
  });
  it("finds quoted credential keys and escaped values in JSON and object literals", () => {
    const added = [
      '{"apiKey":"synthetic-placeholder"}', // privacy-ok
      '{ "password" : "synthetic-\\"placeholder" }', // privacy-ok
      '{"api_key":"synthetic-\\\\placeholder"}', // privacy-ok
      "{ 'TOKEN': 'synthetic-placeholder' }", // privacy-ok
      '{"secret":"synthetic-\\u0022placeholder"}', // privacy-ok
      "api-key = 'synthetic-placeholder'", // privacy-ok
    ];
    assert.deepEqual(scanDiff(diff("config.json", ...added)).map((f) => [f.line, f.what]),
      added.map((_, i) => [i + 1, "a credential assignment"]));
  });
  it("keeps heuristic controls: names, empty/short values, removed lines and explicit exemptions", () => {
    assert.deepEqual(scanDiff(diff("config.json",
      '{"apiKeyName":"synthetic-placeholder"}',
      '{"apiKey":""}', // privacy-ok
      '{"password":"short"}', // privacy-ok
      '{"token":null}',
      '{"apiKey":"synthetic-placeholder"} // privacy-ok',
    )), []);
    assert.deepEqual(scanDiff('+++ b/config.json\n@@ -1 +1 @@\n-{"apiKey":"synthetic-placeholder"}\n+{}\n'), []); // privacy-ok
  });
  it("ignores real env stores at every depth but keeps .env.example available", () => {
    const dir = mkdtempSync(join(tmpdir(), "tenet-ignore-"));
    try {
      execFileSync("git", ["-c", "init.defaultBranch=main", "-c", "init.templateDir=", "init", "--quiet", dir]);
      copyFileSync(new URL("../../../.gitignore", import.meta.url), join(dir, ".gitignore"));
      for (const file of [".env", ".env.local", ".env.production", "nested/.env", "nested/.env.local", "nested/.env.production"]) {
        const result = spawnSync("git", ["-c", "core.excludesFile=", "check-ignore", "--no-index", file], { cwd: dir, encoding: "utf8" });
        assert.equal(result.status, 0, `${file}: ${result.stderr}`);
        assert.equal(result.stdout.trim(), file);
        assert.equal(scanDiff(diff(file, "A=")).length, 1);
      }
      for (const file of [".env.example", "nested/.env.example"]) {
        const result = spawnSync("git", ["-c", "core.excludesFile=", "check-ignore", "--no-index", file], { cwd: dir, encoding: "utf8" });
        assert.equal(result.status, 1, file);
        assert.deepEqual(scanDiff(diff(file, "A=")), []);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
