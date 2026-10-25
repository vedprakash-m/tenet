// The database owner file (TS §12.5): a WAL database cannot prove who has it open, so the server and the restore tool
// each take `<db>.owner` by exclusive create. A holder is identified by process ID and start time, so a reused ID is not mistaken for it.
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

interface Holder { pid: number; start: string }

const startOf = (pid: number): string => {
  const r = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "";
};

function alive(h: Holder): boolean {
  try { process.kill(h.pid, 0); } catch (e) { if ((e as { code?: string }).code !== "EPERM") return false; }
  const now = startOf(h.pid);
  return now === "" || now === h.start;
}

/** Takes the owner file, removing one whose holder is gone; throws while a live process holds it. Returns the release. */
export function takeOwner(dbPath: string): () => void {
  const file = `${dbPath}.owner`;
  const me: Holder = { pid: process.pid, start: startOf(process.pid) };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(file, JSON.stringify(me), { flag: "wx", mode: 0o600 });
      return () => rmSync(file, { force: true });
    } catch (e) {
      if ((e as { code?: string }).code !== "EEXIST") throw e;
      let holder: Holder | undefined;
      try { holder = JSON.parse(readFileSync(file, "utf8")) as Holder; } catch { /* unreadable: treated as dead */ }
      if (holder && alive(holder)) throw new Error("the database is in use; stop the app before restoring");
      rmSync(file, { force: true });
    }
  }
  throw new Error("the database is in use; stop the app before restoring");
}
