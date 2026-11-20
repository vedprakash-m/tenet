import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encodeDigestKey, parseDigestKey } from "../src/core/digest-key.ts";

const synthetic = () => encodeDigestKey(new Uint8Array(16).fill(1), new Uint8Array(32).fill(2));

describe("P87 binary digest-key record", () => {
  it("round-trips an independent ID and a checked 84-byte synthetic record [SEC-11]", () => {
    const record = synthetic();
    assert.equal(record.byteLength, 84);
    const parsed = parseDigestKey(record);
    assert.ok(parsed);
    assert.match(parsed.id, /^[0-9a-f]{32}$/);
    assert.equal(parsed.key.byteLength, 32);
    assert.equal(parsed.id, Buffer.alloc(16, 1).toString("hex"));
    record.fill(0);
    assert.equal(parsed.key.every(byte => byte === 2), true, "parsing must not alias mutable input bytes");
  });

  it("refuses damage to every byte and every truncation without disclosing record data [SEC-11]", () => {
    const record = synthetic();
    for (let byte = 0; byte < record.length; byte++) {
      const damaged = record.slice();
      damaged[byte] = damaged[byte]! ^ 1;
      assert.equal(parseDigestKey(damaged), null, `damaged position ${byte}`);
      assert.equal(parseDigestKey(record.slice(0, byte)), null, `truncated length ${byte}`);
    }
    assert.equal(parseDigestKey(Buffer.concat([record, Buffer.alloc(1)])), null);
    assert.equal(parseDigestKey(Buffer.from(record.toString())), null);
  });

  it("rejects wrong entropy lengths and does not derive the key ID from the key [SEC-11]", () => {
    assert.throws(() => encodeDigestKey(new Uint8Array(15), new Uint8Array(32)));
    assert.throws(() => encodeDigestKey(new Uint8Array(16), new Uint8Array(31)));
    const first = parseDigestKey(synthetic())!;
    const second = parseDigestKey(encodeDigestKey(new Uint8Array(16).fill(3), new Uint8Array(32).fill(2)))!;
    assert.notEqual(first.id, second.id);
    assert.equal(first.key.every((byte, index) => byte === second.key[index]), true);
  });
});
