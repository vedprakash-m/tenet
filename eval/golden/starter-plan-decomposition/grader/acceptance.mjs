export default async function acceptance({ probe, state }) {
  const checks = [];
  const run = (id, source, pred, detail) => {
    const r = probe(source);
    const pass = r.ok && pred(r.value);
    checks.push({ id, pass, detail: pass ? detail : r.ok ? JSON.stringify(r.value) : r.error });
  };

  run("parse", `
    import { parseOrders } from "./src/parse.mjs";
    const text = 'customer,amount\\r\\n"Smith, J",10.50\\r\\n"say ""hi""",2\\r\\n\\r\\nann,1\\r\\n\\r\\n';
    console.log(JSON.stringify(parseOrders(text).map((r) => [r.line, r.cells])));`,
    (v) => JSON.stringify(v) === JSON.stringify([[2, ["Smith, J", "10.50"]], [3, ['say "hi"', "2"]], [5, ["ann", "1"]]]),
    "quoted commas, doubled quotes, CRLF and blank lines handled");

  run("validate", `
    import { validateRows } from "./src/validate.mjs";
    const r = validateRows([
      { line: 2, cells: ["a", "12.345"] }, { line: 3, cells: ["b", "-1"] }, { line: 4, cells: ["", "1"] },
      { line: 5, cells: ["c", "1", "x"] }, { line: 6, cells: ["d", "7"] }, { line: 7, cells: ["e", "abc"] },
    ]);
    console.log(JSON.stringify({ errors: r.errors.map((e) => e.line), valid: r.valid.map((v) => [v.customer, v.cents]) }));`,
    (v) => JSON.stringify(v) === JSON.stringify({ errors: [2, 3, 4, 5, 7], valid: [["d", 700]] }),
    "bad amounts, empty customers and wrong column counts reported by line");

  run("summarize", `
    import { summarize } from "./src/summarize.mjs";
    const r = summarize([{ customer: "b", cents: 10 }, { customer: "a", cents: 20 }, { customer: "b", cents: 20 }]);
    console.log(JSON.stringify(r));`,
    (v) => JSON.stringify(v) === JSON.stringify([{ customer: "a", totalCents: 20 }, { customer: "b", totalCents: 30 }]),
    "totals are integer cents, sorted by customer");

  const plan = state?.project?.intent?.plan ?? [];
  const ids = new Set(plan.map((p) => p.id));
  const acyclic = (() => {
    const seen = new Set(), stack = new Set();
    const visit = (id) => {
      if (stack.has(id)) return false;
      if (seen.has(id)) return true;
      seen.add(id); stack.add(id);
      const ok = (plan.find((p) => p.id === id)?.dependsOn ?? []).every(visit);
      stack.delete(id);
      return ok;
    };
    return plan.every((p) => visit(p.id));
  })();
  const problems = [];
  if (plan.length < 3) problems.push(`${plan.length} plan items, need at least 3`);
  if (!plan.every((p) => p.state === "done")) problems.push("a plan item is not done");
  if (!plan.every((p) => p.check.trim() !== "")) problems.push("a plan item has no check");
  if (!plan.every((p) => p.dependsOn.every((d) => ids.has(d)))) problems.push("a dependency names no plan item");
  if (!acyclic) problems.push("dependencies form a cycle");
  checks.push({ id: "plan-decomposed", pass: problems.length === 0, detail: problems.length ? problems.join("; ") : `${plan.length} finished plan items with checks and acyclic dependencies` });
  return checks;
}
