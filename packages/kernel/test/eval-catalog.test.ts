import assert from "node:assert/strict";
import { after, it } from "node:test";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GOLDEN_DIR, validateAll, validateTask } from "../../../tools/eval-validate.ts";
import { cleanup, tmp } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
function oneTask() {
  const root = tmp("tenet-r1-catalog-"); roots.push(root);
  const id = "bug-pagination-skips-first-page", dir = join(root, id), marker = join(root, "executed");
  cpSync(join(GOLDEN_DIR, id), dir, { recursive: true });
  const manifestPath = join(dir, "task.json"), manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  writeFileSync(join(dir, "seed/sentinel.mjs"), `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'executed');\n`);
  manifest.check.command = ["node", "sentinel.mjs"];
  return { root, dir, marker, manifestPath, manifest };
}
it("an incomplete R1 catalog refuses before executing any project or grader", () => {
  const f = oneTask(); writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
  const result = validateAll({ dir: f.root, r1: true });
  assert.ok(result.errors.some(error => error.includes("R1 public")), JSON.stringify(result));
  assert.equal(existsSync(f.marker), false);
});
it("mutually exclusive catalog selections refuse before executing fixtures", () => {
  const f = oneTask(); writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
  const result = validateAll({ dir: f.root, alpha: true, r1: true });
  assert.match(result.errors.join("\n"), /Alpha or R1 public/);
  assert.equal(existsSync(f.marker), false);
});
it("staged human paths must be unique validated dirty inputs before execution", () => {
  for (const staged of [["../outside"], ["notes.txt", "notes.txt"], ["missing.txt"]]) {
    const f = oneTask(); f.manifest.setup = { dirty: [{ path: "notes.txt", content: "human note" }], staged };
    writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
    const result = validateTask(f.dir);
    assert.match(result.errors.join("\n"), /staged.*dirty|dirty.*staged/);
    assert.equal(existsSync(f.marker), false);
  }
});
it("task directory identity tolerates a trailing native directory separator", () => {
  const root = tmp("tenet-catalog-path-"); roots.push(root);
  const dir = join(root, "bug-pagination-skips-first-page");
  cpSync(join(GOLDEN_DIR, "bug-pagination-skips-first-page"), dir, { recursive: true });
  assert.deepEqual(validateTask(`${dir}/`).errors, []);
});
