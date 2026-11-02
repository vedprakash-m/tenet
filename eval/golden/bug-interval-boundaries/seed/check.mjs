import test from "node:test";
import assert from "node:assert/strict";
import * as api from "./src/interval.mjs";
test("excluded lower endpoint stays outside", () => assert.equal(api.inWindow(2, {min:2,max:7,minInclusive:false}), false));
