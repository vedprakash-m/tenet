export default async function acceptance({ probe }) {
  const checks = [];
  {
    const result = probe("import assert from \"node:assert/strict\"; import * as api from \"./src/ledger.mjs\";\nfor (const [opening,entries,want] of [[1000,[{type:\"debit\",cents:250}],750],[10,[{type:\"credit\",cents:3},{type:\"debit\",cents:5}],8],[90,[],90]]) assert.equal(api.balance(opening,entries),want);\nconst entries=Object.freeze([Object.freeze({type:\"credit\",cents:7}),Object.freeze({type:\"debit\",cents:2})]); assert.equal(api.balance(0,entries),5);\nconsole.log(JSON.stringify(true));");
    const pass = result.ok && result.value === true;
    checks.push({ id: "signed-postings", pass, detail: pass ? "credits and debits have opposite effects without mutating postings" : result.error || "independent assertions failed" });
  }
  {
    const result = probe("import assert from \"node:assert/strict\"; import * as api from \"./src/ledger.mjs\";\nassert.equal(api.balance(0,[{type:\"debit\",cents:7}]),-7);\nassert.equal(api.balance(-30,[{type:\"credit\",cents:10}]),-20);\nassert.equal(api.balance(-1,[]),-1);\nconsole.log(JSON.stringify(true));");
    const pass = result.ok && result.value === true;
    checks.push({ id: "negative-balances", pass, detail: pass ? "overdrafts and negative openings remain signed" : result.error || "independent assertions failed" });
  }
  return checks;
}
