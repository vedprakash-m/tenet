// The public Alpha golden tasks (eval/golden, PRD §6.4.1, plan §7.5/RC6), validated offline.
// This proves the fixtures and their external graders: seeded failures fail, clean controls pass, traps are caught,
// grading is repeatable and needs no network or model. It does not run an agent, so it says nothing about how the loop
// behaves on these tasks, and it is not the live evaluation tier (PRD §6.4.3). No PRD requirement is tagged on purpose:
// ENG-04 needs the live and release tiers, QLT-01 needs the starter journeys run by the real loop, ENG-10 needs the CI
// security tiers; none of those is shown here.
import { cpSync, existsSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, tmp } from "./helpers.ts";
import { ALPHA_MIX, CATEGORIES, GOLDEN_DIR, validateAll, validateTask } from "../../../tools/eval-validate.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

const tasks = readdirSync(GOLDEN_DIR).filter((f) => f !== "lib" && statSync(join(GOLDEN_DIR, f)).isDirectory()).sort();

/** A copy of one task in a scratch folder, to break on purpose. It uses no shared grader helper, so it stands alone there. */
function copyTask(id: string): string {
  const root = tmp("tenet-eval-mut-"); roots.push(root);
  const dir = join(root, id);
  cpSync(join(GOLDEN_DIR, id), dir, { recursive: true });
  return dir;
}

describe("golden tasks: the Alpha set", () => {
  it("has the PRD §6.4.1 Alpha category mix, ten tasks in all", () => {
    assert.equal(tasks.length, 10);
    const categories = tasks.map((t) => JSON.parse(readFileSync(join(GOLDEN_DIR, t, "task.json"), "utf8")).category as string);
    const counts = Object.fromEntries(CATEGORIES.map((c) => [c, categories.filter((x) => x === c).length]));
    assert.deepEqual(counts, ALPHA_MIX);
  });

  it("every task folder has the hidden grader outside the seed, and a README documents the format", () => {
    assert.ok(existsSync(join(GOLDEN_DIR, "README.md")));
    for (const t of tasks) {
      assert.ok(existsSync(join(GOLDEN_DIR, t, "grader", "acceptance.mjs")), `${t}: grader`);
      assert.ok(!readdirSync(join(GOLDEN_DIR, t, "seed"), { recursive: true }).some((f) => String(f).includes("grader")), `${t}: seed holds grader material`);
    }
  });
});

describe("golden tasks: each task validates offline", { timeout: 300_000 }, () => {
  for (const t of tasks) {
    it(`${t}: schema, seed fails and clean passes its check, every control grades as declared, grading repeats, no network or model`, () => {
      const r = validateTask(join(GOLDEN_DIR, t));
      assert.deepEqual(r.errors, []);
    });
  }

  it("the whole set passes the Alpha validation the CLI runs", () => {
    const r = validateAll({ alpha: true });
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.tasks.flatMap((x) => x.errors), []);
  });
});

describe("golden task validation catches broken tasks", { timeout: 300_000 }, () => {
  const id = "bug-pagination-skips-first-page";
  const errorsOf = (dir: string) => validateTask(dir).errors.join("\n");

  it("a clean control that does not pass is reported", () => {
    const dir = copyTask(id);
    writeFileSync(join(dir, "solution", "src", "paginate.mjs"), `${readFileSync(join(dir, "seed", "src", "paginate.mjs"), "utf8")}// unchanged logic\n`);
    assert.match(errorsOf(dir), /clean: .*(project check fails|failing checks)/);
  });

  it("a protected file whose hash no longer matches the seed is reported", () => {
    const dir = copyTask(id);
    writeFileSync(join(dir, "seed", "check.mjs"), `${readFileSync(join(dir, "seed", "check.mjs"), "utf8")}\n// changed\n`);
    assert.match(errorsOf(dir), /protected hash for check\.mjs does not match the seed/);
  });

  for (const location of ["seed", "solution", "controls/visible-only-fix", "grader"]) {
    it(`a forbidden task file in ${location} prevents project and grader execution`, () => {
      const dir = copyTask(id);
      const projectSentinel = join(dirname(dir), "project-executed");
      const graderSentinel = join(dirname(dir), "grader-executed");
      writeFileSync(join(dir, "seed", "sentinel.mjs"), `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(projectSentinel)}, "executed");\n`);
      writeFileSync(join(dir, "grader", "acceptance.mjs"), `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(graderSentinel)}, "executed"); export default async function acceptance() { return []; }\n`);
      writeFileSync(join(dir, location, "forbidden.txt"), "fetch( is an inert forbidden-pattern marker\n");
      const manifestPath = join(dir, "task.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.check.command = ["node", "sentinel.mjs"];
      writeFileSync(manifestPath, JSON.stringify(manifest));
      const errors = errorsOf(dir);
      assert.equal(existsSync(projectSentinel), false, "project check must not execute");
      assert.equal(existsSync(graderSentinel), false, "grader must not execute");
      assert.match(errors, /offline, with no model/);
    });
  }

  for (const path of ["", ".", "..", "../outside", "nested/../../outside", "/absolute", "C:/outside", "C:outside", "\\\\server\\share", "..\\outside", "nested\\..\\outside", "nested/../outside", "nested/./outside", "nested//outside", "nested/", "nul\u0000path"]) {
    it(`unsafe dirty path ${JSON.stringify(path)} is rejected before execution`, () => {
      const dir = copyTask(id);
      const sentinel = join(dirname(dir), "executed");
      writeFileSync(join(dir, "seed", "sentinel.mjs"), `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(sentinel)}, "executed");\n`);
      const manifestPath = join(dir, "task.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.check.command = ["node", "sentinel.mjs"];
      manifest.setup.dirty = [{ path, content: "dirty" }];
      writeFileSync(manifestPath, JSON.stringify(manifest));
      const errors = errorsOf(dir);
      assert.equal(existsSync(sentinel), false, "invalid paths must prevent execution");
      assert.match(errors, /dirty.*path|path.*relative/i);
    });
  }

  it("a dirty path beneath a seed file returns validation errors without execution", () => {
    const dir = copyTask(id);
    const projectSentinel = join(dirname(dir), "project-executed");
    const graderSentinel = join(dirname(dir), "grader-executed");
    writeFileSync(join(dir, "seed", "sentinel.mjs"), `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(projectSentinel)}, "executed");\n`);
    writeFileSync(join(dir, "grader", "acceptance.mjs"), `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(graderSentinel)}, "executed"); export default async function acceptance() { return []; }\n`);
    const manifestPath = join(dir, "task.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.check.command = ["node", "sentinel.mjs"];
    manifest.setup.dirty = [{ path: "src/paginate.mjs/child.txt", content: "dirty" }];
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const report = validateAll({ dir: dirname(dir) });
    assert.equal(report.tasks.length, 1);
    assert.match(report.tasks[0]!.errors.join("\n"), /dirty.*path.*directory/i);
    assert.equal(existsSync(projectSentinel), false, "project check must not execute");
    assert.equal(existsSync(graderSentinel), false, "grader must not execute");
  });

  it("dirty traversal is rejected without changing an outside file", () => {
    const dir = copyTask(id);
    const outside = join(dirname(dir), "outside.txt");
    writeFileSync(outside, "preserve");
    const manifestPath = join(dir, "task.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.setup.dirty = [{ path: `../../${relative(dirname(dirname(dir)), outside)}`, content: "overwritten" }];
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const errors = errorsOf(dir);
    assert.equal(readFileSync(outside, "utf8"), "preserve");
    assert.match(errors, /dirty.*path|path.*relative/i);
  });

  it("a dirty path naming a seed directory is rejected", () => {
    const dir = copyTask(id);
    const manifestPath = join(dir, "task.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.setup.dirty = [{ path: "src", content: "dirty" }];
    writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.match(errorsOf(dir), /dirty.*path.*regular file/i);
  });

  for (const leaf of [false, true]) {
    it(`dirty paths refuse a copied seed symlink at the ${leaf ? "file" : "parent"} without an outside write`, () => {
      const dir = copyTask(id);
      const outside = join(dirname(dir), "outside.txt");
      writeFileSync(outside, "preserve");
      symlinkSync(leaf ? outside : dirname(dir), join(dir, "seed", "linked"));
      const manifestPath = join(dir, "task.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.setup.dirty = [{ path: leaf ? "linked" : "linked/outside.txt", content: "overwritten" }];
      writeFileSync(manifestPath, JSON.stringify(manifest));
      const errors = errorsOf(dir);
      assert.equal(readFileSync(outside, "utf8"), "preserve");
      assert.match(errors, /dirty.*symlink/i);
    });
  }

  for (const path of ["notes/nested/local.txt", "src/paginate.mjs"]) {
    it(`valid dirty path ${path} preserves the declared control outcomes`, () => {
      const dir = copyTask(id);
      const manifestPath = join(dir, "task.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const content = path === "src/paginate.mjs" ? readFileSync(join(dir, "seed", path), "utf8") : "human edit";
      manifest.setup.dirty = [{ path, content }];
      manifest.controls.find((control: { name: string }) => control.name === "clean").commit = ["src/paginate.mjs"];
      writeFileSync(manifestPath, JSON.stringify(manifest));
      assert.deepEqual(validateTask(dir).errors, []);
    });
  }

  it("a grader that gives a different answer each time is reported", () => {
    const dir = copyTask(id);
    writeFileSync(join(dir, "grader", "acceptance.mjs"), 'export default async function acceptance() { return [{ id: "pages-partition-items", pass: false, detail: String(Math.random()) }]; }\n');
    assert.match(errorsOf(dir), /grading twice gave different results/);
  });

  it("a grader that passes everything is reported, because the seeded failure must fail it", () => {
    const dir = copyTask(id);
    writeFileSync(join(dir, "grader", "acceptance.mjs"), 'export default async function acceptance() { return [{ id: "pages-partition-items", pass: true }, { id: "page-count", pass: true }]; }\n');
    assert.match(errorsOf(dir), /seed: failing checks/);
  });
});
