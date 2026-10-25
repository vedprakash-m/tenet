export default async function acceptance({ probe }) {
  const r = probe(`import { totalCents } from "./src/price.mjs";
    const cases = [
      [[{ cents: 1000, qty: 2 }], 10, 1800], [[{ cents: 1999, qty: 3 }], 10, 5397], [[{ cents: 5, qty: 1 }], 10, 5],
      [[{ cents: 15, qty: 1 }], 10, 14], [[{ cents: 1000, qty: 1 }], 0, 1000], [[{ cents: 1000, qty: 1 }], 100, 0], [[], 10, 0],
    ];
    console.log(JSON.stringify(cases.map(([l, d, want]) => [totalCents(l, d), want])));`);
  const bad = r.ok ? r.value.filter(([got, want]) => got !== want) : [];
  const pass = r.ok && bad.length === 0;
  return [{ id: "discount-percent", pass, detail: pass ? "percentage discounts, rounding and edges are right" : r.ok ? `wrong: ${JSON.stringify(bad)}` : r.error }];
}
