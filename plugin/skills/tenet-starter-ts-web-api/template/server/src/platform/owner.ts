// The database owner file (TS §12.5): a WAL database cannot prove who has it open, so the server and the restore tool
// each take `<db>.owner` by exclusive create. A holder is identified by process ID and start time, so a reused ID is not mistaken for it.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

const HolderRecord = z.object({ pid: z.number().int().positive(), start: z.string() }).strict();
type Holder = z.infer<typeof HolderRecord>;

const startOf = (pid: number): string => {
  const r = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "";
};

function alive(h: Holder): boolean {
  try { process.kill(h.pid, 0); } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "ESRCH") return false;
    if (code !== "EPERM") throw e;
  }
  const now = startOf(h.pid);
  return h.start === "" || now === "" || now === h.start;
}

/** Takes the owner file, removing one whose holder is gone; throws while a live process holds it. Returns the release. */
export function takeOwner(dbPath: string): () => void {
  mkdirSync(dirname(dbPath), { recursive: true });
  const file = `${dbPath}.owner`;
  const me: Holder = { pid: process.pid, start: startOf(process.pid) };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(file, JSON.stringify(me), { flag: "wx", mode: 0o600 });
      return () => rmSync(file, { force: true });
    } catch (e) {
      if ((e as { code?: string }).code !== "EEXIST") throw e;
      let raw: unknown;
      try { raw = JSON.parse(readFileSync(file, "utf8")); }
      catch (cause) { throw new Error("database owner record is unreadable; preserve it and verify ownership before recovery", { cause }); }
      const holder = HolderRecord.safeParse(raw);
      if (!holder.success) throw new Error("database owner record is invalid; preserve it and verify ownership before recovery");
      if (alive(holder.data)) throw new Error("the database is in use; stop the app before restoring");
      rmSync(file, { force: true });
    }
  }
  throw new Error("the database is in use; stop the app before restoring");
}
