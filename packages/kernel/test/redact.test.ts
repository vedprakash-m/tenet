// Likely secrets are redacted from what Tenet displays and records (SEC-11, AC-11). The fake credentials are assembled at
// run time so no source line looks like a real one.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { redact, redactDeep } from "../src/core/redact.ts";
import { cleanup } from "./helpers.ts";
import { BASIS, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => { for (const r of roots) cleanup(r); });
const fake = {
  github: `ghp_${"a1B2".repeat(9)}`, aws: `AKIA${"Q7".repeat(8)}`, openai: `sk-${"z9Y8".repeat(8)}`, slack: `xoxb-${"1234567890"}-${"abcdefghij"}`,
  jwt: `eyJ${"a".repeat(12)}.${"b".repeat(12)}.${"c".repeat(12)}`,
  pem: ["-----BEGIN RSA PRIVATE KEY-----", "MIIEow", "abc", "-----END RSA PRIVATE KEY-----"].join("\n"), // privacy-ok: a fake key for the redaction test
};

describe("redaction [SEC-11]", () => {
  it("replaces each kind of likely secret and keeps the rest of the line", () => {
    for (const [kind, secret] of Object.entries(fake)) {
      const out = redact(`failed with ${secret} in the header`);
      assert.doesNotMatch(out, new RegExp(secret.slice(8, 20).replace(/[^\w]/g, "")), kind);
      assert.match(out, /\[redacted/, kind);
      assert.match(out, /failed with/, kind);
    }
  });
  it("redacts credential assignments and credentials inside URLs, but not their names", () => {
    assert.equal(redact("DB_PASSWORD=hunter2hunter2 and api_key: abcd1234efgh"), "DB_PASSWORD=[redacted] and api_key: [redacted]");
    assert.equal(redact("connect to https://admin:s3cr3tpass@db.internal/app"), "connect to https://admin:[redacted]@db.internal/app"); // privacy-ok: a fake URL credential
    assert.equal(redact("Authorization: Bearer " + "x".repeat(30)), "Authorization: Bearer [redacted]");
  });
  it("leaves ordinary text, hashes and identifiers alone", () => {
    for (const s of ["no token needed here", "password: required", "sha256 " + "ab12".repeat(16), "task-abcdefghijklmnopqrstuvwxyz", "commit 9d9c018 on tenet/w-0001-export-greet", "PLN-001-k7q and DEC-002-abc"]) assert.equal(redact(s), s);
  });
  it("is idempotent and works through objects and arrays", () => {
    const v = { a: [`token=${"k9".repeat(8)}`, { b: fake.github }], n: 3 };
    const once = redactDeep(v);
    assert.deepEqual(redactDeep(once), once);
    assert.equal(JSON.stringify(once).includes(fake.github), false);
    assert.equal(once.n, 3);
  });
});

describe("what a check prints never reaches the response or the record unredacted [SEC-11]", () => {
  it("redacts a secret a failing test prints, in the response and in the stored receipt", async () => {
    const p: Project = project();
    roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "x", scopePaths: ["src/greet.ts"], lane: "standard" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    const token = fake.github;
    p.write("src/greet.test.ts", `import { expect, it } from "vitest";\nimport { greet } from "./greet.ts";\nit("greets", () => { expect(greet("Ada")).toBe("Hello, Ada! " + ["ghp_", "${"a1B2".repeat(9)}"].join("")); });\n`);
    const r = await p.call("check", { h, stage: "baseline" });
    const stored = JSON.stringify(p.ports().store.read()!.state);
    assert.equal(JSON.stringify(r).includes(token), false, "the response");
    assert.equal(stored.includes(token), false, "the record");
    assert.match(JSON.stringify(Object.values(p.ports().store.read()!.state.work)[0]!.receipts), /redacted|AssertionError/);
  });
  it("redacts the user's own words when they paste one into a grant", async () => {
    const p: Project = project();
    roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "x", scopePaths: ["src/greet.ts"], protectedPaths: ["db/**"] })).handle!;
    const g = await p.call("decide", { h, kind: "grant", target: "protected-path", quote: `yes, my key is ${fake.openai}`, propose: { paths: ["db/001.sql"] } });
    assert.equal(g.exit, 0, JSON.stringify(g));
    assert.equal(JSON.stringify(p.ports().store.read()!.state).includes(fake.openai), false);
  });
});
