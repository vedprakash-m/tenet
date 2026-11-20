import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, describe, it } from "node:test";
import { ProcessRunner } from "../src/adapters/runner.ts";
import { systemClock } from "../src/adapters/system.ts";
import { cleanup, tmp } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

describe("bounded Runner stdin [SEC-06, P117]", () => {
  it("delivers exact bytes once and reports complete delivery", async () => {
    const root = tmp(); roots.push(root);
    const bytes = Buffer.from("patch-\u00e9\n".repeat(200_000));
    const result = await new ProcessRunner(systemClock, { PATH: process.env.PATH }).run({
      argv: [process.execPath, "-e", `
        const h=require('crypto').createHash('sha256'); let n=0;
        process.stdin.on('data', b => { n+=b.length; h.update(b); });
        process.stdin.on('end', () => process.stdout.write(JSON.stringify({n, h:h.digest('hex')})));
      `],
      cwd: root, runDir: root, timeoutMs: 10_000,
      stdin: { mode: "bound", bytes },
    });
    assert.equal(result.exit, 0, result.stderr);
    assert.equal(result.stdinDelivery, "delivered");
    assert.deepEqual(JSON.parse(result.stdout), {
      n: bytes.length,
      h: createHash("sha256").update(bytes).digest("hex"),
    });
  });

  it("marks a child that closes before delivery as incomplete", async () => {
    const root = tmp(); roots.push(root);
    const bytes = Buffer.alloc(50 * 1024 * 1024, 0x61);
    const result = await new ProcessRunner(systemClock, { PATH: process.env.PATH }).run({
      argv: [process.execPath, "-e", "process.exit(2)"],
      cwd: root, runDir: root, timeoutMs: 5_000,
      stdin: { mode: "bound", bytes },
    });
    assert.equal(result.exit, 2);
    assert.notEqual(result.stdinDelivery, "delivered");
  });

  it("refuses a bound over the blob ceiling before spawn", async () => {
    const root = tmp(); roots.push(root);
    const result = new ProcessRunner(systemClock, { PATH: process.env.PATH }).run({
      argv: [process.execPath, "-e", "require('fs').writeFileSync('spawned','bad')"],
      cwd: root, runDir: root, timeoutMs: 5_000,
      stdin: { mode: "bound", bytes: Buffer.alloc(50 * 1024 * 1024 + 1) },
    });
    await assert.rejects(result, /stdin.*50 MiB/i);
  });
});
