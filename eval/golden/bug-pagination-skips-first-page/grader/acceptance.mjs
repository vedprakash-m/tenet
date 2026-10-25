export default async function acceptance({ probe }) {
  const grid = `const sizes = [1, 2, 3, 4, 5, 6, 7]; const lengths = [0, 1, 4, 5, 6, 10, 11, 13];`;
  const checks = [];
  const run = (id, source, pred, detail) => {
    const r = probe(source);
    const pass = r.ok && pred(r.value);
    checks.push({ id, pass, detail: pass ? detail : r.ok ? JSON.stringify(r.value) : r.error });
  };

  run("pages-partition-items", `import { paginate } from "./src/paginate.mjs"; ${grid}
    const bad = [];
    for (const size of sizes) for (const n of lengths) {
      const items = Array.from({ length: n }, (_, i) => i + 1);
      const seen = [];
      for (let page = 1; page <= 30; page++) { const p = paginate(items, page, size); if (p.length === 0) break; seen.push(...p); }
      if (JSON.stringify(seen) !== JSON.stringify(items)) bad.push([size, n]);
    }
    console.log(JSON.stringify({ bad }));`,
    (v) => v.bad.length === 0, "every size and length is covered once, in order");

  run("page-count", `import { pageCount } from "./src/paginate.mjs"; ${grid}
    const bad = [];
    for (const size of sizes) for (const n of lengths) if (pageCount(n, size) !== Math.ceil(n / size)) bad.push([size, n, pageCount(n, size)]);
    console.log(JSON.stringify({ bad }));`,
    (v) => v.bad.length === 0, "a partial last page counts");

  run("beyond-end-and-size-kept", `import { paginate } from "./src/paginate.mjs";
    const refused = [0, -1, 1.5].map((s) => { try { paginate([1], 1, s); return false; } catch (e) { return e instanceof RangeError; } });
    console.log(JSON.stringify({ beyond: paginate([1, 2, 3], 99, 5), refused }));`,
    (v) => v.beyond.length === 0 && v.refused.every(Boolean), "past the end is empty; bad sizes still refused");
  return checks;
}
