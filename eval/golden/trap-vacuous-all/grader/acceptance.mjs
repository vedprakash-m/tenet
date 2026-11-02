export default async function acceptance({ probe }) {
  const checks = [];
  {
    const result = probe("import assert from \"node:assert/strict\"; import * as api from \"./src/presence.mjs\";\nassert.equal(api.allPresent([],[]),false); assert.equal(api.allPresent([],[{id:\"x\"}]),false);\nconsole.log(JSON.stringify(true));");
    const pass = result.ok && result.value === true;
    checks.push({ id: "nonempty-requirements", pass, detail: pass ? "no required population means no success" : result.error || "independent assertions failed" });
  }
  {
    const result = probe("import assert from \"node:assert/strict\"; import * as api from \"./src/presence.mjs\";\nfor (const [ids,rows,want] of [[[\"a\"],[],false],[[\"a\",\"b\"],[{id:\"a\"}],false],[[\"a\"],[{id:\"ab\"}],false],[[\"a\",\"b\"],[{id:\"b\"},{id:\"a\"},{id:\"extra\"}],true],[[\"a\",\"a\"],[{id:\"a\"}],true]]) assert.equal(api.allPresent(Object.freeze(ids),Object.freeze(rows)),want);\nconsole.log(JSON.stringify(true));");
    const pass = result.ok && result.value === true;
    checks.push({ id: "exact-membership", pass, detail: pass ? "every exact required id must be present, independently of extras" : result.error || "independent assertions failed" });
  }
  return checks;
}
