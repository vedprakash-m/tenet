import test from "node:test";
import assert from "node:assert/strict";
import { isExpired } from "./src/session.mjs";

test("a session is expired after its expiry instant", () => assert.equal(isExpired({ expiresAt: 100 }, 101), true));
test("a session is valid before its expiry instant", () => assert.equal(isExpired({ expiresAt: 100 }, 99), false));
test("a session has expired at its expiry instant", () => assert.equal(isExpired({ expiresAt: 100 }, 100), true));
