import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { runCopilot } from "../../../tools/host/copilot-cli.ts";
import { projectScratch } from "../../../tools/test-scratch.ts";

const roots: string[] = [];
after(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })));
const fixture = () => { const root = projectScratch("host-launch-"); roots.push(root); return root; };

describe("offline host-runner launch failures", () => {
  it("rejects a missing executable explicitly instead of writing an ambiguous observation", async () => {
    const root = fixture();
    await assert.rejects(runCopilot({
      id: "missing", prompt: "synthetic", cwd: root, timeoutMs: 20_000,
    }, { bin: join(root, "does-not-exist"), outDir: root }), { code: "ENOENT" });
    assert.equal(existsSync(join(root, "missing", "observation.json")), false);
    assert.equal(existsSync(join(root, "missing", "transcript.jsonl")), false);
  });

  it("clears the deadline after a rejected launch so the controller can exit promptly", () => {
    const root = fixture();
    const modulePath = new URL("../../../tools/host/copilot-cli.ts", import.meta.url).href;
    const source = `
      import { runCopilot } from ${JSON.stringify(modulePath)};
      try {
        await runCopilot({ id: "missing", prompt: "synthetic", cwd: ${JSON.stringify(root)}, timeoutMs: 20000 },
          { bin: ${JSON.stringify(join(root, "does-not-exist"))}, outDir: ${JSON.stringify(root)} });
        process.exitCode = 3;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        console.log("launch-rejected");
      }
    `;
    const result = spawnSync(process.execPath, [
      ...(Number(process.versions.node.split(".")[0]) < 24 ? ["--experimental-strip-types"] : []),
      "--input-type=module", "-e", source,
    ], { encoding: "utf8", timeout: 5000, env: { ...process.env, NODE_DISABLE_COMPILE_CACHE: "1" } });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /launch-rejected/);
  });

  it("retains a real nonzero process exit as an observation rather than confusing it with launch failure", async () => {
    const root = fixture();
    const observation = await runCopilot({
      id: "exited", prompt: "synthetic", cwd: root, timeoutMs: 20_000,
    }, { bin: process.execPath, outDir: root });
    // Node rejects the Copilot-only arguments: this starts a real offline process, never a model or host session.
    assert.equal(typeof observation.exit, "number");
    assert.notEqual(observation.exit, 0);
    assert.equal(observation.signal, null);
    assert.equal(observation.timedOut, false);
    assert.equal(observation.stopped, false);
    assert.match(readFileSync(observation.transcript, "utf8"), /bad option|unknown option/i);
    assert.deepEqual(JSON.parse(readFileSync(join(root, "exited", "observation.json"), "utf8")), observation);
  });
});
