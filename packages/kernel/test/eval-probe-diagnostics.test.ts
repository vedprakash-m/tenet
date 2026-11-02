import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, it } from "node:test";
import { pathToFileURL } from "node:url";
import { cleanup, tmp } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const grader = pathToFileURL(resolve(import.meta.dirname, "../../../eval/golden/lib/grade.mjs")).href;
function root() { const dir = tmp("tenet probe fixture "); roots.push(dir); return dir; }
function probe(workdir: string, source: string) {
  const script = `import { probe } from ${JSON.stringify(grader)}; console.log(JSON.stringify(probe(${JSON.stringify(workdir)}, ${JSON.stringify(source)})));`;
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" }));
}

it("grader probe diagnostics replace raw fixture paths while retaining the failure and unrelated text", () => {
  const dir = root();
  const source = `console.error(${JSON.stringify(`TypeError: cannot read ${dir}/data.json; input /other-origin/data.json`)}); process.exit(1);`;
  assert.deepEqual(probe(dir, source), {
    ok: false, value: null, error: "TypeError: cannot read <workdir>/data.json; input /other-origin/data.json",
  });
});

it("real module failures normalize encoded file URLs to identical diagnostics across fixture roots", () => {
  const errors = [];
  for (let index = 0; index < 2; index++) {
    const dir = root();
    writeFileSync(join(dir, "broken.mjs"), 'throw new TypeError("synthetic fixture failure");\n');
    const result = probe(dir, 'import "./broken.mjs";');
    assert.equal(result.ok, false);
    assert.equal(result.value, null);
    assert.equal(result.error.includes(dir), false);
    assert.equal(result.error.includes(pathToFileURL(dir).href), false);
    assert.equal(result.error, "<workdir>/broken.mjs:1");
    errors.push(result.error);
  }
  assert.equal(errors[0], errors[1]);
});

it("probe result semantics and empty-output fallback are unchanged", () => {
  const dir = root();
  assert.deepEqual(probe(dir, 'console.log(JSON.stringify({ complete: true }));'), { ok: true, value: { complete: true }, error: "" });
  assert.deepEqual(probe(dir, 'console.log("false"); process.exit(1);'), { ok: false, value: false, error: "" });
  assert.deepEqual(probe(dir, 'process.exit(1);'), { ok: false, value: null, error: "no output" });
});
