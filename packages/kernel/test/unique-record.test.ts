// Private records refuse duplicate keys at any depth; values and array items are never mistaken for keys.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { parseUniqueRecord } from "../src/adapters/private-record-fs.ts";
import { KernelError } from "../src/core/errors.ts";

const refused = (text: string) => assert.throws(() => parseUniqueRecord(text), /duplicate keys/, text);

describe("parseUniqueRecord", () => {
  it("[CON-03] refuses duplicate keys, including with whitespace before the colon and when nested", () => {
    refused('{"a":1,"a":2}');
    refused('{"a":1, "a" \n : 2}');
    refused('{"x":{"b":1,"b":2}}');
    refused('{"x":[{"c":1},{"c":2,"c":3}]}');
    refused('{"__proto__":1,"__proto__":2}');
  });

  it("accepts the same key in sibling objects and strings that look like keys", () => {
    assert.deepEqual(parseUniqueRecord('{"x":[{"c":1},{"c":2}]}'), { x: [{ c: 1 }, { c: 2 }] });
    assert.deepEqual(parseUniqueRecord('{"a":"a","b":["a","a"],"c":"q\\":"}'), { a: "a", b: ["a", "a"], c: 'q":' });
    assert.deepEqual(parseUniqueRecord('{"a" :"b:" , "b":1}'), { a: "b:", b: 1 });
    assert.deepEqual(parseUniqueRecord('{"a":"{[\\\\","b":"]}"}'), { a: "{[\\", b: "]}" });
  });

  it("[CON-03] compares keys after decoding escapes", () => {
    refused('{"ab":1,"a\\u0062":2}');
    refused('{"x":{"a\\"":1,"a\\"" :2}}');
    assert.deepEqual(parseUniqueRecord('{"a\\\\":1,"a":2}'), { "a\\": 1, a: 2 });
  });

  it("refuses a value nested deeper than 64 containers, and accepts one at 64", () => {
    const deep = (n: number, inner: string) => "[".repeat(n) + inner + "]".repeat(n);
    assert.ok(Array.isArray(parseUniqueRecord(deep(64, "1"))));
    assert.ok(Array.isArray(parseUniqueRecord(deep(65, ""))));
    assert.throws(() => parseUniqueRecord(deep(65, "1")), /depth bound/);
    assert.throws(() => parseUniqueRecord(deep(66, "")), /depth bound/);
    assert.throws(() => parseUniqueRecord(`{"a":${deep(63, '{"b":1}')}}`), /depth bound/); // "b" holds a value at depth 65
    assert.ok(parseUniqueRecord(`{"a":${deep(62, '{"b":1}')}}`));
  });

  it("finds keys after strings that hold escapes and quotes", () => {
    refused('{"a":"x\\\\","a":1}');
    assert.deepEqual(parseUniqueRecord('{"a":"\\\\"," b":"\\"a\\":"}'), { a: "\\", " b": '"a":' });
  });

  it("accepts every record without duplicates and refuses it once any object repeats a key", () => {
    const key = fc.oneof(fc.constantFrom("a", "b", "a:", '"', "\\", "__proto__", "1", "01"), fc.string({ maxLength: 4 }));
    const value = fc.letrec((tie) => ({
      v: fc.oneof({ depthSize: "small" }, fc.string({ maxLength: 4 }), fc.integer(), fc.boolean(), fc.constant(null),
        fc.array(tie("v"), { maxLength: 4 }), fc.dictionary(key, tie("v"), { maxKeys: 4 })),
    })).v;
    fc.assert(fc.property(fc.dictionary(key, value, { maxKeys: 5 }), fc.nat(), (record, pick) => {
      const text = JSON.stringify(record, null, pick % 3);
      assert.deepEqual(parseUniqueRecord(text), JSON.parse(text));
      const rest = text.slice(1).trimStart(), dupKey = `"k${pick}":0`;
      const doubled = `{${dupKey},${dupKey}${rest === "}" ? "" : ","}${rest}`;
      refused(doubled);
      refused(`[1,{"n":${doubled}}]`);
    }), { numRuns: 300 });
  });

  it("scans text with many colons inside strings in linear time", () => {
    const text = JSON.stringify({ a: Array.from({ length: 200_000 }, (_, i) => (i % 2 ? "x:y" : "z")) });
    const started = performance.now();
    assert.ok(parseUniqueRecord(text));
    assert.ok(performance.now() - started < 2_000);
  });

  it("reports a refused record without claiming an unknown grant field", () => {
    assert.throws(() => parseUniqueRecord('{"a":1,"a":2}'), (error: unknown) => {
      assert.ok(error instanceof KernelError);
      assert.equal(error.reasons[0]!.message, "A private record is unsupported or cannot be read safely: a private record has duplicate keys");
      return true;
    });
  });
});

