export default async function acceptance({ probe }) {
  const checks = [];
  {
    const result = probe("import assert from \"node:assert/strict\"; import * as api from \"./src/path.mjs\";\nfor (const [input,want] of [[\"a/b/../c\",\"a/c\"],[\"a/./b//\",\"a/b\"],[\"a/..\",\"\"],[\"\",\"\"],[\".\",\"\"],[\"r\u00e9sum\u00e9/../..notes\",\"..notes\"],[\"a/b/../../z\",\"z\"]]) assert.equal(api.normalizeRelative(input),want);\nconsole.log(JSON.stringify(true));");
    const pass = result.ok && result.value === true;
    checks.push({ id: "normalization-grid", pass, detail: pass ? "normalization resolves parents, Unicode and literal dot-prefixed names" : result.error || "independent assertions failed" });
  }
  {
    const result = probe("import assert from \"node:assert/strict\"; import * as api from \"./src/path.mjs\";\nfor (const path of [\"../secret\",\"a/../../secret\",\"../../\",\"x/../../../y\"]) assert.throws(()=>api.normalizeRelative(path),RangeError);\nconsole.log(JSON.stringify(true));");
    const pass = result.ok && result.value === true;
    checks.push({ id: "escape-refusal", pass, detail: pass ? "normalization cannot escape its lexical root" : result.error || "independent assertions failed" });
  }
  {
    const result = probe("import assert from \"node:assert/strict\"; import * as api from \"./src/path.mjs\";\nfor (const path of [\"/etc/config\",\"C:folder\",\"a\\\\b\",\"a\\0b\",null,3]) assert.throws(()=>api.normalizeRelative(path),TypeError);\nconsole.log(JSON.stringify(true));");
    const pass = result.ok && result.value === true;
    checks.push({ id: "path-syntax", pass, detail: pass ? "absolute, alternate separator and invalid typed inputs remain refused" : result.error || "independent assertions failed" });
  }
  return checks;
}
