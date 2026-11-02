export default async function acceptance({ probe }) {
  const checks = [];
  {
    const result = probe("import assert from \"node:assert/strict\"; import * as api from \"./src/clone.mjs\";\nconst source={created:new Date(1234),optional:undefined,list:[undefined,0,false,null,\"\"]};\nconst actual=api.cloneRecord(source); assert.ok(actual.created instanceof Date); assert.equal(actual.created.getTime(),1234); assert.equal(Object.hasOwn(actual,\"optional\"),true); assert.deepEqual(actual.list,source.list);\nconsole.log(JSON.stringify(true));");
    const pass = result.ok && result.value === true;
    checks.push({ id: "typed-fields", pass, detail: pass ? "Dates, undefined own keys and falsy primitives survive cloning" : result.error || "independent assertions failed" });
  }
  {
    const result = probe("import assert from \"node:assert/strict\"; import * as api from \"./src/clone.mjs\";\nconst shared={n:1}; const source={a:shared,b:shared,list:[{n:2}]}; const result=api.cloneRecord(source); result.a.n=9; result.list[0].n=8; assert.equal(source.a.n,1); assert.equal(source.list[0].n,2);\nconst date=new Date(7); const copied=api.cloneRecord(date); if (copied instanceof Date) { copied.setTime(8); assert.equal(date.getTime(),7); }\nconsole.log(JSON.stringify(true));");
    const pass = result.ok && result.value === true;
    checks.push({ id: "copy-isolation", pass, detail: pass ? "copies do not alias source objects and repeated references are not cycles" : result.error || "independent assertions failed" });
  }
  {
    const result = probe("import assert from \"node:assert/strict\"; import * as api from \"./src/clone.mjs\";\nfor (const value of [new Map([[\"x\",1]]),new Set([1])]) assert.throws(()=>api.cloneRecord(value),TypeError);\nconst cycle={}; cycle.self=cycle; assert.throws(()=>api.cloneRecord(cycle),TypeError);\nconsole.log(JSON.stringify(true));");
    const pass = result.ok && result.value === true;
    checks.push({ id: "unsupported-and-cycles", pass, detail: pass ? "unsupported containers and cyclic input are refused" : result.error || "independent assertions failed" });
  }
  return checks;
}
