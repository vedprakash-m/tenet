import { PassThrough } from "node:stream";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, readStdin } from "../src/frontends/cli.ts";

describe("bounded command input [NFR-03]", () => {
  it("parses the equals form emitted by the plugin's examples", () => {
    assert.deepEqual(parseArgs(["decide", "--kind=basis", "--h=W1.1.abcd"]), { verb: "decide", input: { kind: "basis", h: "W1.1.abcd" } });
    assert.deepEqual(parseArgs(["check", "--h=W1.1.abcd", "--touched=src/a.ts,src/b.ts"]), { verb: "check", input: { h: "W1.1.abcd", touched: ["src/a.ts", "src/b.ts"] } });
  });
  it("refuses an oversized body", async () => {
    const input = new PassThrough();
    const result = readStdin(input, 10, { bytes: 32, deadlineMs: 50 });
    input.end(JSON.stringify({ text: "x".repeat(40) }));
    await assert.rejects(result, /exceeds/);
    assert.equal(input.listenerCount("data"), 0);
  });
  it("refuses a body whose sender never finishes", async () => {
    const input = new PassThrough();
    const result = readStdin(input, 10, { bytes: 32, deadlineMs: 30 });
    input.write('{"unfinished":');
    await assert.rejects(result, /deadline/);
    assert.equal(input.listenerCount("data"), 0);
    input.destroy();
  });
  it("accepts an ordinary complete object and treats an idle pipe as empty", async () => {
    const input = new PassThrough();
    const result = readStdin(input, 10, { bytes: 32, deadlineMs: 50 });
    input.end('{"ok":true}');
    assert.deepEqual(await result, { ok: true });
    const idle = new PassThrough();
    assert.deepEqual(await readStdin(idle, 10), {});
    idle.destroy();
  });
});
