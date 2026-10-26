import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { lintArch } from "../../../tools/lint-arch.ts";
import { lintPayload } from "../../../tools/lint-skills.ts";
import { parsePrd, report } from "../../../tools/coverage.ts";
import { projectScratch } from "../../../tools/test-scratch.ts";

const ROOT = join(import.meta.dirname, "../../..");
const roots: string[] = [];
const scratch = () => {
  const root = projectScratch("tooling fixture-");
  roots.push(root);
  return root;
};
after(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })));

const source = (files: Record<string, string>) => {
  const root = scratch();
  for (const [name, text] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, text);
  }
  return root;
};

describe("lint-arch native paths", () => {
  it("keeps live scratch files out of checkout-wide Git-status checks", () => {
    const root = source({ "fixture.ts": "export const value = 1;" });
    const result = spawnSync("git", ["status", "--porcelain", "--untracked-files=all", "--", root], {
      cwd: ROOT, encoding: "utf8",
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
  });

  it("allows adapter I/O and dynamic imports, composition-root I/O, and the designated endpoint and counter owners", () => {
    const root = source({
      "adapters/nested/io.ts": 'import fs from "node:fs";\nconst mod = import("./local.ts");',
      "wire.ts": 'import fs from "node:fs";\nimport adapter from "./adapters/nested/io.ts";',
      "main.ts": 'import process from "node:process";',
      "core/verdict.ts": 'const endpoint = "checked-local";',
      "core/budget.ts": "const next = { attempts: work.attempts + 1 };",
    });

    assert.deepEqual(lintArch(root), { problems: [], files: 5 });
  });
});

describe("build native process invocation", () => {
  const fixture = (main = "export const answer = 42;") => {
    const root = source({
      "package.json": '{"type":"module"}',
      "tsconfig.json": JSON.stringify({
        compilerOptions: { strict: true, noEmit: true, target: "ES2023", module: "NodeNext", types: [] },
        include: ["packages/kernel/src/**/*.ts"],
      }),
      "LICENSE": "fixture license\n",
      "NOTICE": "fixture notice\n",
      "tools/payload-files.json": JSON.stringify([
        "LICENSE", "NOTICE", "kernel/tenet.mjs", "schemas/review-result.schema.json", "schemas/tenet.policy.schema.json",
      ]),
      "packages/kernel/src/main.ts": main,
      "packages/kernel/src/core/policy.ts": 'import { z } from "zod";\nexport const Policy = z.object({ allow: z.boolean() });',
      "packages/kernel/src/core/schemas.ts": 'import { z } from "zod";\nexport const ReviewResult = z.object({ result: z.string() });',
    });
    copyFileSync(join(ROOT, "tools/build.ts"), join(root, "tools/build.ts"));
    copyFileSync(join(ROOT, "tools/payload.ts"), join(root, "tools/payload.ts"));
    symlinkSync(join(ROOT, "node_modules"), join(root, "node_modules"), "junction");
    return root;
  };
  const run = (root: string) => {
    const result = spawnSync(process.execPath, [join(root, "tools/build.ts")], {
      cwd: ROOT, encoding: "utf8", timeout: 60_000,
      env: { ...process.env, NODE_DISABLE_COMPILE_CACHE: "1" },
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    return { status: result.status, output: result.stdout + result.stderr };
  };

  it("typechecks and builds from a path with spaces without a shell, independently of the caller's cwd", () => {
    const root = fixture();
    const result = run(root);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /build: plugin\/kernel\/tenet.mjs .* \(budget 800 KB\)/);
    const bundle = join(root, "plugin/kernel/tenet.mjs");
    assert.ok(statSync(bundle).size <= 800 * 1024);
    const bundled = spawnSync(process.execPath, [bundle], {
      encoding: "utf8", env: { ...process.env, NODE_DISABLE_COMPILE_CACHE: "1" },
    });
    assert.ifError(bundled.error);
    assert.equal(bundled.status, 0, bundled.stderr);
    for (const name of ["LICENSE", "NOTICE"]) {
      assert.equal(readFileSync(join(root, "plugin", name), "utf8"), readFileSync(join(root, name), "utf8"));
    }
    for (const name of ["review-result", "tenet.policy"]) {
      assert.equal(JSON.parse(readFileSync(join(root, `plugin/schemas/${name}.schema.json`), "utf8")).type, "object");
    }
    const sums = readFileSync(join(root, "plugin/SHA256SUMS"), "utf8");
    assert.equal(sums.trimEnd().split("\n").length, 5);
    assert.match(sums, /^[a-f0-9]{64}  LICENSE\n/);
    assert.match(result.output, /build: 5 payload files recorded in SHA256SUMS/);
    const verify = () => spawnSync(process.execPath, [join(root, "tools/payload.ts")], {
      cwd: ROOT, encoding: "utf8", env: { ...process.env, NODE_DISABLE_COMPILE_CACHE: "1" },
    });
    const valid = verify();
    assert.ifError(valid.error);
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /checksum manifest matches complete inclusion list/);
    writeFileSync(join(root, "plugin/NOTICE"), "changed after build\n");
    const changed = verify();
    assert.ifError(changed.error);
    assert.equal(changed.status, 1);
    assert.match(changed.stderr, /payload checksum mismatch/);
  });

  it("produces identical complete checksums from independent fixture builds", () => {
    const first = fixture(), second = fixture();
    for (const root of [first, second]) {
      const result = run(root);
      assert.equal(result.status, 0, result.output);
    }
    assert.equal(readFileSync(join(first, "plugin/SHA256SUMS"), "utf8"),
      readFileSync(join(second, "plugin/SHA256SUMS"), "utf8"));
  });

  it("rejects a real type error before writing build outputs", () => {
    const root = fixture('export const answer: number = "wrong";');
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /TS2322/);
    assert.equal(existsSync(join(root, "plugin")), false);
  });

  it("still rejects a bundle over the unchanged size budget", () => {
    const root = fixture(`export const payload = ${JSON.stringify("x".repeat(801 * 1024))};`);
    mkdirSync(join(root, "plugin"));
    writeFileSync(join(root, "plugin/SHA256SUMS"), "stale\n");
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /build: bundle exceeds its size budget/);
    assert.ok(statSync(join(root, "plugin/kernel/tenet.mjs")).size > 800 * 1024);
    assert.equal(existsSync(join(root, "plugin/SHA256SUMS")), false);
  });

  it("invalidates stale checksums before a compiler failure", () => {
    const root = fixture('export const answer: number = "wrong";');
    mkdirSync(join(root, "plugin"));
    writeFileSync(join(root, "plugin/SHA256SUMS"), "stale\n");
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /TS2322/);
    assert.equal(existsSync(join(root, "plugin/SHA256SUMS")), false);
  });

  it("refuses unlisted payload files without leaving a stale checksum manifest", () => {
    const root = fixture();
    mkdirSync(join(root, "plugin"));
    writeFileSync(join(root, "plugin/unlisted.txt"), "unexpected\n");
    writeFileSync(join(root, "plugin/SHA256SUMS"), "stale\n");
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /unexpected payload file: unlisted.txt/);
    assert.equal(existsSync(join(root, "plugin/SHA256SUMS")), false);
    assert.equal(readFileSync(join(root, "plugin/unlisted.txt"), "utf8"), "unexpected\n");
  });
});

describe("lint-arch native path violations", () => {
  it("enforces every directory-scoped rule and reports canonical paths and line numbers", () => {
    const root = source({
      "core/nested/rules.ts": [
        'import fs from "node:fs";',
        'import adapter from "../../adapters/io.ts";',
        'import { Port } from "../ports/types.ts";',
        'const host = "copilot";',
        'const endpoint = "checked-local";',
        "const next = { attempts: work.attempts + 1 };",
        'const mod = import("./local.ts");',
      ].join("\n"),
      "verbs/nested/host.ts": 'const host = "vscode";',
      "decisions/nested/host.ts": 'const host = "copilot";',
      "frontends/nested/ui.ts": "verdict(work);",
      "adapters/git-cli.ts": 'const command = "push";',
    });

    assert.deepEqual(lintArch(root).problems, [
      "adapters/git-cli.ts:1: remote Git operations are not part of M0",
      "core/nested/rules.ts:1: node:fs: I/O belongs in adapters/ behind a port",
      "core/nested/rules.ts:1: core/ may import only zod and node:crypto, not node:fs",
      "core/nested/rules.ts:2: core/ may import only core/ and ports types, not ../../adapters/io.ts",
      "core/nested/rules.ts:2: only the composition root imports adapters",
      "core/nested/rules.ts:3: core/ imports ports as types only",
      "core/nested/rules.ts:4: names a host: read a capability from the descriptor instead (ENG-02)",
      "core/nested/rules.ts:5: only core/verdict.ts produces an endpoint",
      "core/nested/rules.ts:6: only core/budget.ts changes a counter",
      "core/nested/rules.ts:7: dynamic import() outside adapters",
      "decisions/nested/host.ts:1: names a host: read a capability from the descriptor instead (ENG-02)",
      "frontends/nested/ui.ts:1: front-ends hold no verdict, authority or budget logic",
      "verbs/nested/host.ts:1: names a host: read a capability from the descriptor instead (ENG-02)",
    ]);
  });
});

describe("tooling newline portability", () => {
  it("keeps LF and CRLF coverage inventories identical while rejecting malformed requirement rows", () => {
    const prd = [
      "| TST-01 | Mapped requirement | Must | M0 | AC-01 |",
      "| TST-02 | Host requirement | Must | M0 | AC-02 |",
      "| TST-03 | Unmapped requirement | Must | M0 | AC-01 |",
      "| TST-04 | Optional requirement | Should | R1 | AC-01 |",
      "",
    ].join("\n");
    const root = source({
      "specs/PRD.md": prd,
      "specs/tech-spec.md": "| AC-01 | T1 | Local |\n| AC-02 | T3 | Host |\n",
      "packages/kernel/test/example.test.ts": 'it("mapped [TST-01]", () => {});\n',
      "packages/kernel/src/verbs/example.ts": "",
      "packages/kernel/src/decisions/example.ts": "",
    });
    const lf = report(root, "R1");
    assert.deepEqual(lf.integrityErrors, []);
    assert.deepEqual(lf.covered, [{ id: "TST-01", tests: 1 }]);
    assert.deepEqual(lf.hostOnly.map(r => r.id), ["TST-02"]);
    assert.deepEqual(lf.unmapped.map(r => r.id), ["TST-03"]);
    assert.equal(parsePrd(prd).length, 4);
    for (const newline of ["\n", "\r\n"]) {
      const text = prd.replace(/\n/g, newline);
      writeFileSync(join(root, "specs/PRD.md"), text);
      writeFileSync(join(root, "specs/tech-spec.md"), `| AC-01 | T1 | Local |${newline}| AC-02 | T3 | Host |${newline}`);
      assert.deepEqual(parsePrd(text), parsePrd(prd));
      assert.deepEqual(report(root, "R1"), lf);
      writeFileSync(join(root, "specs/PRD.md"), `${text}| TST-05 | Invalid milestone | Must | Unknown | AC-01 |${newline}`);
      const malformed = report(root, "R1");
      assert.deepEqual(malformed.integrityErrors, ["malformed PRD requirement row: | TST-05 | Invalid milestone | Must | Unknown | AC-01 |"]);
      assert.deepEqual(malformed.covered, lf.covered);
      assert.equal(malformed.evidence.length, lf.evidence.length);
      writeFileSync(join(root, "packages/kernel/src/verbs/example.ts"), `${"x".repeat(340)}${newline}`);
      assert.deepEqual(report(root, "R1").tooLong, []);
      writeFileSync(join(root, "packages/kernel/src/verbs/example.ts"), `${"x".repeat(341)}${newline}`);
      assert.ok(report(root, "R1").tooLong.some(item => item.file.includes("example.ts")));
      writeFileSync(join(root, "packages/kernel/src/verbs/example.ts"), "");
    }
  });

  it("lints identical LF and CRLF payloads and preserves budgets, YAML validation and resource checks", () => {
    const root = scratch();
    const docs: Record<string, string> = {};
    const copyDocs = (dir: string, rel = "") => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (["kernel", "schemas", "template"].includes(entry.name)) continue;
        const name = join(rel, entry.name);
        if (entry.isDirectory()) copyDocs(join(dir, entry.name), name);
        else if (entry.name.endsWith(".md")) docs[name] = readFileSync(join(dir, entry.name), "utf8").replace(/\r\n/g, "\n");
      }
    };
    copyDocs(join(ROOT, "plugin"));
    const writeDocs = (newline: string) => {
      for (const [name, text] of Object.entries(docs)) {
        const path = join(root, name);
        mkdirSync(join(path, ".."), { recursive: true });
        writeFileSync(path, text.replace(/\n/g, newline));
      }
    };
    let lfProblems: string[] | undefined;
    for (const newline of ["\n", "\r\n"]) {
      writeDocs(newline);
      assert.deepEqual(lintPayload(root), []);
      const skill = join(root, "skills/tenet-build/SKILL.md");
      const text = readFileSync(skill, "utf8").replace(/\r\n/g, "\n")
        .replace(/^description: ".*"$/m, "description: Invalid: YAML").replace(/\n/g, newline);
      writeFileSync(skill, `${text}${newline}${"word ".repeat(17_000)}${newline}See resources/missing.md.${newline}`);
      const problems = lintPayload(root);
      assert.ok(problems.some(p => /skills\/tenet-build\/SKILL.md: front matter is not valid YAML/.test(p)), problems.join("\n"));
      assert.ok(problems.some(p => /skills\/tenet-build\/SKILL.md: body is \d+ tokens, budget 4000/.test(p)), problems.join("\n"));
      assert.ok(problems.some(p => /resource resources\/missing.md does not exist/.test(p)), problems.join("\n"));
      if (lfProblems) assert.deepEqual(problems, lfProblems);
      else lfProblems = problems;
    }
  });
});
