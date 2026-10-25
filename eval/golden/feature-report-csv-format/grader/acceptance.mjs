export default async function acceptance({ probe }) {
  const checks = [];
  const run = (id, source, pred, detail) => {
    const r = probe(source);
    const pass = r.ok && pred(r.value);
    checks.push({ id, pass, detail: pass ? detail : r.ok ? JSON.stringify(r.value) : r.error });
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  run("csv-basic", `import { renderReport } from "./src/report.mjs";
    console.log(JSON.stringify([renderReport([], "csv"), renderReport([{ name: "bolt", qty: 3 }], "csv")]));`,
    (v) => same(v, ["name,qty", "name,qty\nbolt,3"]), "header only for an empty report; one line per row");

  run("csv-quoting", `import { renderReport } from "./src/report.mjs";
    const rows = [{ name: "a,b", qty: 1 }, { name: 'say "hi"', qty: 2 }, { name: "two\\nlines", qty: 3 }];
    console.log(JSON.stringify(renderReport(rows, "csv")));`,
    (v) => v === 'name,qty\n"a,b",1\n"say ""hi""",2\n"two\nlines",3', "commas, quotes and line breaks quoted");

  run("text-unchanged", `import { renderReport } from "./src/report.mjs";
    let err = ""; try { renderReport([], "xml"); } catch (e) { err = e.message; }
    console.log(JSON.stringify([renderReport([]), renderReport([{ name: "a,b", qty: 1 }]), renderReport([{ name: "x", qty: 1 }, { name: "y", qty: 2 }], "text"), renderReport([{ name: "x", qty: 1 }]), err]));`,
    (v) => same(v, ["", "a,b: 1", "x: 1\ny: 2", "x: 1", "unknown format: xml"]), "text output and the unknown-format error are as before");
  return checks;
}
