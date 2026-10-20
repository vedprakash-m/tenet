// Process identity: pid plus start time, so a recycled pid is never mistaken for the holder (TS §7.3).
import { execFileSync } from "node:child_process";

export function procStart(pid: number): string | null {
  if (!Number.isSafeInteger(pid) || pid < 1) return null;
  try {
    const out = execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return out || null;
  } catch {
    return null;
  }
}

export function isAlive(pid: number, start: string): boolean {
  if (!Number.isSafeInteger(pid) || pid < 1 || !start) return true; // unknown is never proof of death
  const observed = procStart(pid);
  if (observed !== null) return observed === start;
  try { process.kill(pid, 0); return true; }
  catch (e) { return (e as NodeJS.ErrnoException).code !== "ESRCH"; }
}
