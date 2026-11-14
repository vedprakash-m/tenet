// TS §15.2: a full disk is `disk-full` (exit 2), not an internal error.
import assert from "node:assert/strict";
import { it } from "node:test";
import { z } from "zod";
import { runVerb, type Verb } from "../src/pipeline.ts";
import type { Ports } from "../src/ports/types.ts";

const ports = {
  clock: { ms: () => 0, now: () => new Date(0).toISOString() },
  version: "0.0.0", platform: "linux", host: { capabilities: () => ({}) }, store: { exists: () => false },
} as never as Ports;
const throwing = (error: Error): Record<string, Verb> => ({
  probe: { name: "probe", schema: z.object({}), class: () => "stateless", run: () => { throw error; } },
});
const errno = (code: string) => Object.assign(new Error(`${code}: synthetic write failure`), { code });

it("a write that fails for lack of space is disk-full (exit 2); other failures stay internal errors", async () => {
  for (const code of ["ENOSPC", "EDQUOT"]) {
    const res = await runVerb(ports, throwing(errno(code)), "probe", {});
    assert.equal(res.exit, 2, code);
    assert.equal(res.reasons[0]?.code, "disk-full", code);
    assert.match(res.reasons[0]!.message, /next mutating call/);
  }
  const git = await runVerb(ports, throwing(new Error("git failed: fatal: write error: No space left on device")), "probe", {});
  assert.equal(git.reasons[0]?.code, "disk-full");
  const other = await runVerb(ports, throwing(errno("EIO")), "probe", {});
  assert.deepEqual([other.exit, other.reasons[0]?.code], [5, "internal-error"]);
});
