import { test } from "node:test";
import assert from "node:assert/strict";
import { runJobs } from "./src/jobs.mjs";
test("successful jobs retain their input order", async () => assert.deepEqual(await runJobs([async()=>1,async()=>2]),[1,2]));
