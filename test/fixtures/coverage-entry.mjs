import assert from "node:assert/strict";
import test from "node:test";
import { sha256 } from "../../dist/core/hash.js";

test("loads a source-mapped module for LCOV verification", () => {
	assert.equal(
		sha256("abc"),
		"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
	);
});
