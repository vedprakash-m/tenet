export default async function acceptance({ probe }) {
  const checks = [];
  {
    const result = probe("import assert from \"node:assert/strict\"; import * as api from \"./src/interval.mjs\";\nfor (const [min,max] of [[-5,2],[0,0],[3,9]]) for (const inclusive of [false,true]) {\n  assert.equal(api.inWindow(min,{min,max,minInclusive:inclusive}),inclusive);\n  assert.equal(api.inWindow(min-1,{min,max,minInclusive:inclusive}),false);\n}\nconsole.log(JSON.stringify(true));");
    const pass = result.ok && result.value === true;
    checks.push({ id: "lower-endpoint", pass, detail: pass ? "lower endpoint flags and values below the interval are respected" : result.error || "independent assertions failed" });
  }
  {
    const result = probe("import assert from \"node:assert/strict\"; import * as api from \"./src/interval.mjs\";\nfor (const [min,max] of [[-5,2],[0,0],[3,9]]) for (const inclusive of [false,true]) {\n  assert.equal(api.inWindow(max,{min,max,maxInclusive:inclusive}),inclusive);\n  assert.equal(api.inWindow(max+1,{min,max,maxInclusive:inclusive}),false);\n}\nconsole.log(JSON.stringify(true));");
    const pass = result.ok && result.value === true;
    checks.push({ id: "upper-endpoint", pass, detail: pass ? "upper endpoint flags and values above the interval are respected" : result.error || "independent assertions failed" });
  }
  {
    const result = probe("import assert from \"node:assert/strict\"; import * as api from \"./src/interval.mjs\";\nfor (const value of [NaN,Infinity,-Infinity]) assert.throws(()=>api.inWindow(value,{min:0,max:2}),RangeError);\nassert.throws(()=>api.inWindow(1,{min:2,max:0}),RangeError);\nfor (const lo of [false,true]) for (const hi of [false,true]) assert.equal(api.inWindow(0,{min:0,max:0,minInclusive:lo,maxInclusive:hi}),lo&&hi);\nconsole.log(JSON.stringify(true));");
    const pass = result.ok && result.value === true;
    checks.push({ id: "interval-validation", pass, detail: pass ? "finite bounds and degenerate intervals retain their contract" : result.error || "independent assertions failed" });
  }
  return checks;
}
