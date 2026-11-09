import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

export const MEMORY_LIMIT_BYTES = 400 * 1024 * 1024;

export function peakRssBytes(status: string): number {
  const value = /^VmHWM:\s+(\d+)\s+kB$/m.exec(status);
  if (!value || Number(value[1]) <= 0 || !Number.isSafeInteger(Number(value[1]) * 1024)) {
    throw new Error("starter peak RSS is unavailable or invalid");
  }
  return Number(value[1]) * 1024;
}

export function memoryPass(bytes: number): boolean {
  return Number.isSafeInteger(bytes) && bytes > 0 && bytes <= MEMORY_LIMIT_BYTES;
}

export async function measureStarter(root: string): Promise<{ peakRssBytes: number; limitBytes: number; requests: number; node: string; workload: string }> {
  if (process.platform !== "linux") throw new Error("starter peak RSS measurement requires Linux /proc");
  const child = spawn(process.execPath, ["--experimental-strip-types", "server/src/server.ts"], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"],
    env: {
      PATH: process.env.PATH, HOME: root, NODE_ENV: "production", PORT: "0", DATABASE_URL: ":memory:",
      COOKIE_SECRET: randomBytes(32).toString("hex"), LOG_LEVEL: "info",
    },
  });
  let log = "", error: Error | undefined;
  const collect = (chunk: Buffer) => { log = (log + chunk.toString()).slice(-65_536); };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
  child.on("error", e => { error = e; });
  const ended = new Promise<void>(resolve => child.once("close", () => resolve()));
  try {
    const deadline = Date.now() + 30_000;
    let address: string | undefined;
    while (!address && Date.now() < deadline) {
      if (error) throw error;
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(`starter exited before readiness: ${log}`);
      address = /Server listening at (http:\/\/127\.0\.0\.1:\d+)/.exec(log)?.[1];
      if (!address) await delay(25);
    }
    if (!address || !child.pid) throw new Error(`starter readiness timeout: ${log}`);
    const status = join("/proc", String(child.pid), "status");
    let peak = peakRssBytes(readFileSync(status, "utf8"));
    for (let i = 0; i < 100; i++) {
      const response = await fetch(`${address}/api/health`, { signal: AbortSignal.timeout(5_000) });
      if (!response.ok) throw new Error(`health request failed: ${response.status}`);
      const health: unknown = await response.json();
      if (!health || typeof health !== "object" || !("status" in health) || health.status !== "ok") {
        throw new Error("starter health response does not report status ok");
      }
      peak = Math.max(peak, peakRssBytes(readFileSync(status, "utf8")));
    }
    if (!memoryPass(peak)) throw new Error(`starter peak RSS ${peak} bytes exceeds ${MEMORY_LIMIT_BYTES}`);
    return { peakRssBytes: peak, limitBytes: MEMORY_LIMIT_BYTES, requests: 100, node: process.version, workload: "production startup and 100 health requests; not the reference workload" };
  } finally {
    child.kill("SIGTERM");
    const closed = await Promise.race([ended.then(() => true), delay(5_000).then(() => false)]);
    if (!closed) { child.kill("SIGKILL"); await ended; }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2];
  if (!root) throw new Error("usage: node tools/starter-memory.ts <installed scratch starter>");
  console.log(JSON.stringify(await measureStarter(resolve(root))));
}
