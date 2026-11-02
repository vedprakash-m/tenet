export default async function acceptance({ probe }) {
  const checks = [];
  {
    const result = probe("import assert from \"node:assert/strict\"; import * as api from \"./src/run-result.mjs\";\nfor (const exit of [0,1]) assert.equal(api.evaluateRun({exit,tests:[]}),\"inconclusive\");\nconsole.log(JSON.stringify(true));");
    const pass = result.ok && result.value === true;
    checks.push({ id: "empty-population", pass, detail: pass ? "an empty run proves no test behavior" : result.error || "independent assertions failed" });
  }
  {
    const result = probe("import assert from \"node:assert/strict\"; import * as api from \"./src/run-result.mjs\";\nfor (const [input,want] of [[{exit:0,tests:[{status:\"passed\"}]},\"pass\"],[{exit:1,tests:[{status:\"failed\"},{status:\"passed\"}]},\"fail\"],[{exit:0,tests:[{status:\"failed\"}]},\"inconclusive\"],[{exit:1,tests:[{status:\"passed\"}]},\"inconclusive\"],[{exit:0,tests:[{status:\"skipped\"}]},\"inconclusive\"],[{exit:null,tests:[{status:\"passed\"}]},\"inconclusive\"],[{exit:0},\"inconclusive\"]]) assert.equal(api.evaluateRun(input),want);\nconsole.log(JSON.stringify(true));");
    const pass = result.ok && result.value === true;
    checks.push({ id: "report-honesty", pass, detail: pass ? "exit, complete statuses and reported failures must agree" : result.error || "independent assertions failed" });
  }
  return checks;
}
