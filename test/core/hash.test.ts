import assert from "node:assert/strict";
import test from "node:test";
import { alias, jcs, sha256, ulid } from "../../dist/core/hash.js";

test("sha256 produces the standard lowercase digest", () => {
  assert.equal(
    sha256("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.equal(sha256("first\r\nsecond\r\n"), sha256("first\nsecond\n"));
  assert.notEqual(
    sha256(Buffer.from("first\r\nsecond\r\n", "utf8")),
    sha256(Buffer.from("first\nsecond\n", "utf8")),
  );
});

test("jcs matches RFC 8785 ordering, escaping and number vectors", () => {
  const vectors: Array<[unknown, string]> = [
    [{ z: 0, a: 1 }, '{"a":1,"z":0}'],
    [
      [Number("333333333.33333329"), 1e30, 4.5, 2e-3, 1e-27],
      "[333333333.3333333,1e+30,4.5,0.002,1e-27]",
    ],
    [{ "€": "Euro Sign", "\u000f": "control" }, '{"\\u000f":"control","€":"Euro Sign"}'],
    [{ value: "€$\u000f\nA'B\\\"/" }, '{"value":"€$\\u000f\\nA\'B\\\\\\"/"}'],
  ];
  for (const [input, expected] of vectors) assert.equal(jcs(input), expected);
  assert.throws(() => jcs({ value: undefined }), /does not allow/);
  assert.throws(() => jcs(Number.NaN), /non-finite/);
});

test("ULIDs are valid and monotonic within the same millisecond", () => {
  const first = ulid(new Date("2026-11-23T10:00:00.000Z"));
  const second = ulid(new Date("2026-11-23T10:00:00.000Z"));
  assert.match(first, /^[0-9A-HJKMNP-TV-Z]{26}$/);
  assert.equal(first.slice(0, 10), second.slice(0, 10));
  assert.ok(first < second);
});

test("alias is a six-character Crockford hash and extends on collision", () => {
  const first = alias("01ARZ3NDEKTSV4RRFFQ69G5FAV");
  assert.match(first, /^[0-9A-HJKMNP-TV-Z]{6}$/);
  assert.equal(alias("01ARZ3NDEKTSV4RRFFQ69G5FAV", new Set([first])).length, 7);
});
