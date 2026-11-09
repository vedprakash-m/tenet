// Private records refuse duplicate keys at any depth; values and array items are never mistaken for keys.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseUniqueRecord } from "../src/adapters/private-record-fs.ts";

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
  });
});
