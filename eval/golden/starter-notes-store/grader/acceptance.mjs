import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const header = (file) => `import { createStore } from "./src/notes.mjs"; const f = ${JSON.stringify(file)};`;

export default async function acceptance({ probe }) {
  const dir = mkdtempSync(join(tmpdir(), "golden-notes-"));
  const checks = [];

  const v = probe(`${header(join(dir, "v.json"))}
    const s = createStore(f);
    const refused = ["", "   ", "x".repeat(281), 5, null].map((t) => { try { s.add(t); return false; } catch { return true; } });
    let boundary = false; try { boundary = s.add("x".repeat(280)).text.length === 280; } catch {}
    console.log(JSON.stringify({ refused, boundary, count: s.list().length }));`);
  checks.push({ id: "validation", pass: v.ok && v.value.refused.every(Boolean) && v.value.boundary && v.value.count === 1, detail: v.ok ? JSON.stringify(v.value) : v.error });

  const p = join(dir, "p.json");
  const a = probe(`${header(p)} const s = createStore(f); s.add("first"); s.add("second"); console.log("{}");`);
  const b = probe(`${header(p)} const s = createStore(f); const before = s.list().map((n) => n.id + ":" + n.text); const added = s.add("third").id; console.log(JSON.stringify({ before, added }));`);
  const c = probe(`${header(p)} console.log(JSON.stringify(createStore(f).list().map((n) => n.id)));`);
  const persisted = a.ok && b.ok && c.ok && JSON.stringify(b.value.before) === JSON.stringify(["1:first", "2:second"]) && b.value.added === 3 && JSON.stringify(c.value) === "[1,2,3]";
  checks.push({ id: "persistence-across-processes", pass: persisted, detail: persisted ? "ids and text kept across three processes" : "notes or ids were not kept across processes" });

  const d = join(dir, "d.json");
  writeFileSync(d, "{not json");
  const r = probe(`${header(d)} let threw = false; try { createStore(f); } catch { threw = true; } console.log(JSON.stringify({ threw }));`);
  const kept = readFileSync(d, "utf8") === "{not json";
  checks.push({ id: "corrupt-file-kept", pass: r.ok && r.value.threw === true && kept, detail: kept ? (r.ok && r.value.threw ? "refused and left the file alone" : "opened a damaged file without refusing") : "overwrote the damaged file" });
  return checks;
}
