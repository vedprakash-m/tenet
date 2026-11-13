import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanDiff, scanNames } from "../../../tools/privacy-check.ts";

const diff = (file: string, ...added: string[]) => `+++ b/${file}\n@@ -0,0 +1,${added.length} @@\n${added.map((l) => `+${l}`).join("\n")}\n`;

describe("privacy check", () => {
  it("finds keys, tokens, credential assignments, personal paths and real addresses in added lines, with line numbers", () => {
    const f = scanDiff(diff("a.ts", "ok", "const t = 'ghp_" + "a".repeat(30) + "';", "path = '/Users/someone/work/x'", "password = 'hunter2hunter2'", "mail ada@corp.io", "-----BEGIN RSA PRIVATE KEY-----")); // privacy-ok
    assert.deepEqual(f.map((x) => [x.line, x.what]), [[2, "a token"], [3, "a personal path"], [4, "a credential assignment"], [5, "an email address"], [6, "a private key"]]);
  });
  it("ignores removed lines, example addresses, the attribution address and marked lines", () => {
    assert.deepEqual(scanDiff("+++ b/a.md\n@@ -1 +1 @@\n-/Users/someone/x\n+ada@example.test noreply@anthropic.com test@example.com\n+/Users/x/y privacy-ok\n"), []);
  });
  it("flags a secret-store file by name, but not an example env file", () => {
    assert.equal(scanDiff(diff(".env.local", "A=1")).length, 1);
    assert.equal(scanDiff(diff("keys/id_rsa", "x")).length, 1);
    assert.deepEqual(scanDiff(diff(".env.example", "A=")), []);
  });
  it("finds quoted credential keys and escaped values in JSON and object literals", () => {
    const added = [
      '{"apiKey":"synthetic-placeholder"}', // privacy-ok
      '{ "password" : "synthetic-\\"placeholder" }', // privacy-ok
      '{"api_key":"synthetic-\\\\placeholder"}', // privacy-ok
      "{ 'TOKEN': 'synthetic-placeholder' }", // privacy-ok
      '{"secret":"synthetic-\\u0022placeholder"}', // privacy-ok
      "api-key = 'synthetic-placeholder'", // privacy-ok
    ];
    assert.deepEqual(scanDiff(diff("config.json", ...added)).map((f) => [f.line, f.what]),
      added.map((_, i) => [i + 1, "a credential assignment"]));
  });
  it("keeps heuristic controls: names, empty/short values, removed lines and explicit exemptions", () => {
    assert.deepEqual(scanDiff(diff("config.json",
      '{"apiKeyName":"synthetic-placeholder"}',
      '{"apiKey":""}', // privacy-ok
      '{"password":"short"}', // privacy-ok
      '{"token":null}',
      '{"apiKey":"synthetic-placeholder"} // privacy-ok',
    )), []);
    assert.deepEqual(scanDiff('+++ b/config.json\n@@ -1 +1 @@\n-{"apiKey":"synthetic-placeholder"}\n+{}\n'), []); // privacy-ok
  });
  it("ignores real env stores at every depth but keeps .env.example available", () => {
    const dir = mkdtempSync(join(tmpdir(), "tenet-ignore-"));
    try {
      execFileSync("git", ["-c", "init.defaultBranch=main", "-c", "init.templateDir=", "init", "--quiet", dir]);
      copyFileSync(new URL("../../../.gitignore", import.meta.url), join(dir, ".gitignore"));
      for (const file of [".env", ".env.local", ".env.production", "nested/.env", "nested/.env.local", "nested/.env.production"]) {
        const result = spawnSync("git", ["-c", "core.excludesFile=", "check-ignore", "--no-index", file], { cwd: dir, encoding: "utf8" });
        assert.equal(result.status, 0, `${file}: ${result.stderr}`);
        assert.equal(result.stdout.trim(), file);
        assert.equal(scanDiff(diff(file, "A=")).length, 1);
      }
      for (const file of [".env.example", "nested/.env.example"]) {
        const result = spawnSync("git", ["-c", "core.excludesFile=", "check-ignore", "--no-index", file], { cwd: dir, encoding: "utf8" });
        assert.equal(result.status, 1, file);
        assert.deepEqual(scanDiff(diff(file, "A=")), []);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("keeps archives and noncanonical specs local while allowing exactly the three canonical specs", () => {
    const dir = mkdtempSync(join(tmpdir(), "tenet-ignore-"));
    try {
      execFileSync("git", ["-c", "init.defaultBranch=main", "-c", "init.templateDir=", "init", "--quiet", dir]);
      copyFileSync(new URL("../../../.gitignore", import.meta.url), join(dir, ".gitignore"));
      for (const file of [".archive/consolidation/changes.patch", ".archive/specs/store-lock-admission.md", "specs/plan.md", "specs/new-feature.md", "specs/reviews/review.md", "specs/nested/PRD.md"]) {
        const result = spawnSync("git", ["-c", "core.excludesFile=", "check-ignore", "--no-index", file], { cwd: dir, encoding: "utf8" });
        assert.equal(result.status, 0, `${file}: ${result.stderr}`);
      }
      for (const file of ["specs/PRD.md", "specs/tech-spec.md", "specs/ux-spec.md"]) {
        const result = spawnSync("git", ["-c", "core.excludesFile=", "check-ignore", "--no-index", file], { cwd: dir, encoding: "utf8" });
        assert.equal(result.status, 1, file);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

const TOKEN = "ghp_" + "b".repeat(30); // privacy-ok: a fake token for the scanner tests
const CHECK = fileURLToPath(new URL("../../../tools/privacy-check.ts", import.meta.url));
const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function repo(): { dir: string; git: (...a: string[]) => string; check: (...a: string[]) => ReturnType<typeof spawnSync> } {
  const dir = mkdtempSync(join(tmpdir(), "tenet-privacy-"));
  const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=T", "-c", "user.email=t@example.test", "-c", "commit.gpgsign=false", ...a],
    { cwd: dir, env: GIT_ENV, encoding: "utf8" }).trim();
  git("-c", "init.defaultBranch=main", "-c", "init.templateDir=", "init", "--quiet");
  writeFileSync(join(dir, "a.txt"), "start\n"); git("add", "."); git("commit", "-qm", "start");
  const check = (...a: string[]) => spawnSync(process.execPath, [CHECK, ...a], { cwd: dir, env: GIT_ENV, encoding: "utf8" });
  return { dir, git, check };
}

describe("privacy check boundaries [OSS-05]", () => {
  it("scans an added line that starts with two plus signs, and does not take it for a file name", () => {
    const f = scanDiff(`diff --git a/a.ts b/a.ts\n+++ b/a.ts\n@@ -0,0 +1,2 @@\n+++ const t = '${TOKEN}';\n+mail ada@corp.io\n`); // privacy-ok
    assert.deepEqual(f.map((x) => [x.file, x.line, x.what]), [["a.ts", 1, "a token"], ["a.ts", 2, "an email address"]]);
  });
  it("checks every address on a line, and allows only the exact attribution address", () => {
    assert.deepEqual(scanDiff(diff("a.md", "noreply@anthropic.com and ada@corp.io")).map((x) => x.what), ["an email address"]); // privacy-ok
    assert.deepEqual(scanDiff(diff("a.md", "xnoreply@anthropic.com")).map((x) => x.what), ["an email address"]); // privacy-ok
  });
  it("names secret-store files from raw paths, including non-ASCII ones, and redacts a token-shaped file name", () => {
    assert.deepEqual(scanNames(["keys/cert.p12", "docs/ok.md", "keys/café.pem"]).map((x) => x.file), ["keys/cert.p12", "keys/café.pem"]);
    const f = scanDiff(diff(`notes-${TOKEN}.md`, "hello"));
    assert.equal(f.length, 0);
    const named = scanDiff(diff(`notes-${TOKEN}.md`, `x ${TOKEN}`));
    assert.equal(named[0]!.file.includes(TOKEN), false);
  });
  it("flags a staged binary secret store that has no text diff", () => {
    const { dir, git, check } = repo();
    try {
      writeFileSync(join(dir, "cert.p12"), Buffer.from([0, 1, 2, 0, 255]));
      git("add", "cert.p12");
      const r = check();
      assert.equal(r.status, 1, String(r.stdout) + String(r.stderr));
      assert.match(String(r.stderr), /cert\.p12:0: a file that looks like a secret store/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("scans a line that only a merge commit adds", () => {
    const { dir, git, check } = repo();
    try {
      const base = git("rev-parse", "HEAD");
      git("checkout", "-qb", "side"); writeFileSync(join(dir, "b.txt"), "side\n"); git("add", "."); git("commit", "-qm", "side");
      git("checkout", "-q", "main"); writeFileSync(join(dir, "c.txt"), "main\n"); git("add", "."); git("commit", "-qm", "main");
      git("merge", "--no-ff", "--no-commit", "-q", "side");
      writeFileSync(join(dir, "d.txt"), `t = '${TOKEN}'\n`); git("add", "d.txt"); git("commit", "-qm", "merge");
      const r = check("--range", `${base}..HEAD`);
      assert.equal(r.status, 1, String(r.stdout) + String(r.stderr));
      assert.match(String(r.stderr), /d\.txt:1: a token/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("refuses a range that is missing or looks like an option", () => {
    const { dir, check } = repo();
    try {
      for (const args of [["--range", "--max-count=0"], ["--range"]]) {
        const r = check(...args);
        assert.equal(r.status, 2, args.join(" "));
        assert.match(String(r.stderr), /range/);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
