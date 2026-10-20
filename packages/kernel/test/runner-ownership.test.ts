import { spawn } from "node:child_process";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ProcessRunner } from "../src/adapters/runner.ts";
import { procStart } from "../src/adapters/proc.ts";
import { systemClock } from "../src/adapters/system.ts";
import { cleanup, tmp } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

describe("recovery process ownership", () => {
  for (const kind of ["negative", "string", "missing-start", "linked"]) it(`refuses a ${kind} process record without signalling the process [CON-03, NFR-04]`, async () => {
    const root = tmp(); roots.push(root);
    const child = spawn(process.execPath, ["-e", "console.log('ready'); setInterval(() => {}, 1000)"], { detached: true, stdio: ["ignore", "pipe", "ignore"] });
    const closed = new Promise(resolve => child.on("close", resolve));
    await new Promise(resolve => child.stdout!.once("data", resolve));
    const pid = child.pid!, start = procStart(pid); assert.ok(start);
    let exited = false; child.on("exit", () => { exited = true; });
    const rec = { pid: kind === "negative" ? -pid : kind === "string" ? String(pid) : pid, procStart: kind === "missing-start" ? null : start };
    const target = join(root, kind === "linked" ? "outside.json" : "run.json");
    writeFileSync(target, JSON.stringify(rec));
    if (kind === "linked") symlinkSync(target, join(root, "run.json"));
    try {
      const result = await new ProcessRunner(systemClock, {}).stopRun(root);
      await new Promise(resolve => setTimeout(resolve, 30));
      assert.equal(result, "unknown");
      assert.equal(exited, false, "untrusted record cannot authorize a signal");
    } finally { try { process.kill(-pid, "SIGKILL"); } catch { /* already gone */ } await closed; }
  });
});
