import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
});
