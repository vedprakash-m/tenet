// Record maps keep every own key read from disk, including names that are also Object.prototype members.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { Lock, State } from "../src/core/schemas.ts";
import type { WorkContract } from "../src/core/schemas.ts";
import { currentTestHashes } from "../src/verbs/facts.ts";

const LOCK = '{"path":"src/a.test.ts","hash":"h","obligation":"O-1","anchor":{"provisional":"p"},' +
  '"supportInputs":{"__proto__":"blob-proto","constructor":"blob-ctor","helper.ts":"blob-helper"}}';

describe("own keys in parsed records", () => {
  it("[CON-03, EVD-08] keeps a support file named __proto__ in a parsed lock", () => {
    const lock = Lock.parse(JSON.parse(LOCK));
    assert.deepEqual(Object.keys(lock.supportInputs).sort(), ["__proto__", "constructor", "helper.ts"]);
    assert.equal(Object.getOwnPropertyDescriptor(lock.supportInputs, "__proto__")?.value, "blob-proto");
    assert.equal(Object.getPrototypeOf(lock.supportInputs), Object.prototype, "the key is data, not a prototype change");
    assert.deepEqual(JSON.parse(JSON.stringify(lock)), JSON.parse(LOCK), "a write after a read keeps the key");
  });

  it("still rejects a wrong value type under any key", () => {
    const bad = JSON.parse(LOCK.replace('"blob-proto"', "7"));
    assert.equal(Lock.safeParse(bad).success, false);
  });

  it("[EVD-08, AC-07] reports the current hash of baseline inputs named like prototype members", () => {
    const obligations = JSON.parse('[{"testFile":"a.test.ts","baselineInputs":{"__proto__":"old","constructor":"old"}}]');
    const entries = new Map([["a.test.ts", { blob: "t" }], ["__proto__", { blob: "new" }]]);
    const hashes = currentTestHashes(obligations as unknown as WorkContract["obligations"], entries);
    assert.deepEqual(Object.keys(hashes).sort(), ["__proto__", "a.test.ts", "constructor"]);
    assert.equal(hashes["__proto__"], "new", "a changed input stays visible to the verdict");
    assert.equal(hashes["constructor"], "", "a missing input is empty, not an inherited function");
  });

  it("keeps state records describable as JSON schema", () => {
    assert.doesNotThrow(() => z.toJSONSchema(State, { io: "input", unrepresentable: "any" }));
  });
});
