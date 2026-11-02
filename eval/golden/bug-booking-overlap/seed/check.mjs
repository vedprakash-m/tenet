import test from "node:test";
import assert from "node:assert/strict";
import * as api from "./src/booking.mjs";
test("enclosing an existing booking conflicts", () => assert.equal(api.canBook([{start:10,end:20,room:"A"}],5,25,"A"),false));
