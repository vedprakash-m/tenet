// Process identity: pid plus start time, so a recycled pid is never mistaken for the holder (TS §7.3).
import { execFileSync } from "node:child_process";

export function procStart(pid: number): string | null {
  try {
    const out = execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return out || null;
  } catch {
    return null;
  }
}

export const isAlive = (pid: number, start: string): boolean => procStart(pid) === start;
