// Journal reduction (CON-08, specs/storage-retention.md v2): records older than the cutoff become monthly counts. Pure.
// Never removed: an intent without a result, a pair with any record newer than the cutoff, an accounting record at or above
// `protectFromRevision`, the newest KEEP_NEWEST records, anything unrecognized (then nothing is reduced). A clock that ran backwards
// cannot make records look old (nothing is older than now minus the window), and one that jumped forward spares the newest records.
export interface Month {
  calls: Record<string, number>; exits: Record<string, number>; intents: number; results: number; accounting: number;
}
export type Months = Record<string, Month>;

const DAY_MS = 86_400_000;
export const KEEP_NEWEST = 100;
const empty = (): Month => ({ calls: {}, exits: {}, intents: 0, results: 0, accounting: 0 });

export function reduceJournal(
  text: string, o: { nowMs: number; days: number; protectFromRevision: number },
): { text: string; removed: number; months: Months } | null {
  const end = text.lastIndexOf("\n") + 1;
  const complete = text.slice(0, end), tail = text.slice(end);
  const rows: Array<{ line: string; rec: Record<string, any>; ms: number }> = [];
  for (const line of complete.split("\n")) {
    if (!line) continue;
    let rec: Record<string, any>;
    try { rec = JSON.parse(line); } catch { return null; }
    const ms = Date.parse(String(rec.t));
    if (!["intent", "result", "call", "accounting"].includes(rec.kind) || Number.isNaN(ms)) return null;
    rows.push({ line, rec, ms });
  }
  const cutoff = o.nowMs - o.days * DAY_MS;
  const spared = new Set(rows.slice(-KEEP_NEWEST));
  const key = (r: Record<string, any>) => JSON.stringify([r.effect, r.id]);
  const done = new Set(rows.filter((r) => r.rec.kind === "result").map((r) => key(r.rec)));
  const pairKind = (k: string) => k === "intent" || k === "result";
  const recentPair = new Set(rows.filter((r) => (r.ms >= cutoff || spared.has(r)) && pairKind(r.rec.kind)).map((r) => key(r.rec)));
  const months: Months = {};
  let removed = 0;
  const kept = rows.filter((row) => {
    const { rec, ms } = row;
    if (spared.has(row)) return true;
    const m = String(rec.t).slice(0, 7);
    const drop = rec.kind === "call" ? ms < cutoff
      : rec.kind === "accounting" ? ms < cutoff && Number(rec.revision) < o.protectFromRevision
      : done.has(key(rec)) && !recentPair.has(key(rec));
    if (!drop) return true;
    const mo = (months[m] ??= empty());
    if (rec.kind === "call") {
      mo.calls[rec.verb] = (mo.calls[rec.verb] ?? 0) + 1;
      mo.exits[String(rec.exit)] = (mo.exits[String(rec.exit)] ?? 0) + 1;
    }
    else if (rec.kind === "intent") mo.intents++;
    else if (rec.kind === "result") mo.results++;
    else mo.accounting++;
    removed++;
    return false;
  });
  return { text: kept.map((r) => `${r.line}\n`).join("") + tail, removed, months };
}

/** Adds one set of monthly counts to another. */
export function addMonths(into: Months, more: Months): Months {
  const out: Months = JSON.parse(JSON.stringify(into));
  for (const [m, add] of Object.entries(more)) {
    const cur = (out[m] ??= empty());
    for (const [k, v] of Object.entries(add.calls)) cur.calls[k] = (cur.calls[k] ?? 0) + v;
    for (const [k, v] of Object.entries(add.exits)) cur.exits[k] = (cur.exits[k] ?? 0) + v;
    cur.intents += add.intents; cur.results += add.results; cur.accounting += add.accounting;
  }
  return out;
}
