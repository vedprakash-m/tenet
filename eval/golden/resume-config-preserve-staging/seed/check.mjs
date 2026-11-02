import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "./src/config.mjs";
test("applies overrides", () => assert.equal(loadConfig({port:80},{port:8080}).port,8080));
