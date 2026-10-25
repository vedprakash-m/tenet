import { execFileSync, spawn, spawnSync } from "node:child_process";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { lstatSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ProcessRunner } from "../src/adapters/runner.ts";
import { procStart } from "../src/adapters/proc.ts";
import { systemClock } from "../src/adapters/system.ts";
import { cleanup, tmp } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

describe("recovery process ownership", () => {
  it("refuses a FIFO process record without waiting for a writer [CON-03, NFR-04]", () => {
    const root = tmp(); roots.push(root);
    const path = join(root, "run.json"); execFileSync("mkfifo", [path]);
    const child = spawnSync(process.execPath, [join(import.meta.dirname, "fixtures/race-project-read.ts"), root, "short", "process"],
      { encoding: "utf8", timeout: 10000 });
    assert.equal(child.error, undefined, child.error?.message); assert.equal(child.signal, null, child.stderr);
    assert.equal(child.status, 0, child.stderr); assert.deepEqual(JSON.parse(child.stdout), { value: "unknown" });
    assert.equal(lstatSync(path).isFIFO(), true);
  });
  it("accepts stable short reads of a prepared sentinel without inventing an orphan [CON-03]", () => {
    const root = tmp(); roots.push(root);
    const path = join(root, "run.json"); writeFileSync(path, '{"prepared":true}');
    const result = JSON.parse(execFileSync(process.execPath,
      [join(import.meta.dirname, "fixtures/race-project-read.ts"), root, "short", "process"], { encoding: "utf8" }));
    assert.deepEqual(result, { value: "gone" }); assert.equal(readFileSync(path, "utf8"), '{"prepared":true}');
  });
  for (const mode of ["short", "overwrite-json", "invalid-utf8", "unicode"]) {
    it(`admits process ownership only from stable valid bytes (${mode}) [CON-03, NFR-04]`, async () => {
      const root = tmp(); roots.push(root);
      const child = spawn(process.execPath, ["-e", "console.log('ready'); setInterval(() => {}, 1000)"], { detached: true, stdio: ["ignore", "pipe", "ignore"] });
      const closed = new Promise(resolve => child.on("close", resolve));
      await new Promise(resolve => child.stdout!.once("data", resolve));
      const pid = child.pid!, start = procStart(pid); assert.ok(start);
      const path = join(root, "run.json"), text = JSON.stringify({ pid, procStart: start, note: mode === "unicode" ? "\u00e9\u4e2d\ufffd" : "a" });
      const bytes = Buffer.from(text);
      if (mode === "invalid-utf8") bytes[bytes.indexOf('"note":"') + '"note":"'.length] = 0xff;
      writeFileSync(path, bytes);
      try {
        const result = JSON.parse(execFileSync(process.execPath,
          [join(import.meta.dirname, "fixtures/race-project-read.ts"), root, mode, "process"], { encoding: "utf8", timeout: 10000 }));
        const trusted = mode === "short" || mode === "unicode";
        assert.deepEqual(result, { value: trusted ? "stopped" : "unknown" });
        if (trusted) await closed;
        else process.kill(pid, 0);
        const expected = mode === "overwrite-json" ? Buffer.from(text.replace('"note":"a"', '"note":"b"')) : bytes;
        assert.deepEqual(readFileSync(path), expected);
      } finally { try { process.kill(-pid, "SIGKILL"); } catch {} await closed; }
    });
  }
  for (const kind of ["negative", "string", "missing-start", "linked", "null"]) it(`refuses a ${kind} process record without signalling the process [CON-03, NFR-04]`, async () => {
    const root = tmp(); roots.push(root);
    const child = spawn(process.execPath, ["-e", "console.log('ready'); setInterval(() => {}, 1000)"], { detached: true, stdio: ["ignore", "pipe", "ignore"] });
    const closed = new Promise(resolve => child.on("close", resolve));
    await new Promise(resolve => child.stdout!.once("data", resolve));
    const pid = child.pid!, start = procStart(pid); assert.ok(start);
    let exited = false; child.on("exit", () => { exited = true; });
    const rec = { pid: kind === "negative" ? -pid : kind === "string" ? String(pid) : pid, procStart: kind === "missing-start" ? null : start };
    const target = join(root, kind === "linked" ? "outside.json" : "run.json");
    writeFileSync(target, JSON.stringify(kind === "null" ? null : rec));
    if (kind === "linked") symlinkSync(target, join(root, "run.json"));
    try {
      const result = await new ProcessRunner(systemClock, {}).stopRun(root);
      await new Promise(resolve => setTimeout(resolve, 30));
      assert.equal(result, "unknown");
      assert.equal(exited, false, "untrusted record cannot authorize a signal");
    } finally { try { process.kill(-pid, "SIGKILL"); } catch { /* already gone */ } await closed; }
  });
});
