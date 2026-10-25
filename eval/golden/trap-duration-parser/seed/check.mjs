import test from "node:test";
import assert from "node:assert/strict";
import { parseDuration } from "./src/duration.mjs";

test("whole hours", () => assert.equal(parseDuration("2h"), 7200));
test("hours and minutes", () => assert.equal(parseDuration("1h30m"), 5400));
test("text that is not a duration is refused", () => assert.throws(() => parseDuration("abc")));
