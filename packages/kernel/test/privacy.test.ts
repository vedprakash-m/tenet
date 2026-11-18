import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanDiff, scanNames } from "../../../tools/privacy-check.ts";

const diff = (file: string, ...added: string[]) => `+++ b/${file}\n@@ -0,0 +1,${added.length} @@\n${added.map((l) => `+${l}`).join("\n")}\n`;
const GIT_ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("GIT_"))),
  GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0",
};

describe("privacy check", () => {
  it("finds keys, tokens, credential assignments, personal paths and non-allowlisted addresses in added lines, with line numbers", () => {
    const f = scanDiff(diff("a.ts", "ok", "const t = 'ghp_" + "a".repeat(30) + "';", "path = '/Users/someone/work/x'", "password = 'hunter2hunter2'", "mail ada@example.invalid", "-----BEGIN RSA PRIVATE KEY-----")); // privacy-ok
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
  it("flags .key files in text diffs and raw paths", () => {
    assert.deepEqual(scanDiff(diff("keys/private.key", "synthetic")).map((f) => [f.file, f.what]),
      [["keys/private.key", "a file that looks like a secret store"]]);
    assert.deepEqual(scanNames(["keys/private.key"]).map((f) => [f.file, f.what]),
      [["keys/private.key", "a file that looks like a secret store"]]);
  });
  it("recognizes secret-store filenames regardless of case", () => {
    const names = ["keys/private.KEY", "keys/private.Key", "keys/cert.PEM", "keys/cert.P12", "keys/.ENV.LOCAL", "keys/ID_RSA"];
    assert.deepEqual(scanNames(names).map((f) => f.file), names);
    for (const name of names) assert.equal(scanDiff(diff(name, "synthetic")).length, 1, name);
    assert.deepEqual(scanNames([".ENV.EXAMPLE"]), []);
    assert.deepEqual(scanDiff(diff(".ENV.EXAMPLE", "A=")), []);
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
      execFileSync("git", ["-c", "init.defaultBranch=main", "-c", "init.templateDir=", "init", "--quiet", dir], { env: GIT_ENV });
      copyFileSync(new URL("../../../.gitignore", import.meta.url), join(dir, ".gitignore"));
      for (const file of [".env", ".env.local", ".env.production", "nested/.env", "nested/.env.local", "nested/.env.production"]) {
        const result = spawnSync("git", ["-c", "core.excludesFile=", "check-ignore", "--no-index", file], { cwd: dir, env: GIT_ENV, encoding: "utf8" });
        assert.equal(result.status, 0, `${file}: ${result.stderr}`);
        assert.equal(result.stdout.trim(), file);
        assert.equal(scanDiff(diff(file, "A=")).length, 1);
      }
      for (const file of [".env.example", "nested/.env.example"]) {
        const result = spawnSync("git", ["-c", "core.excludesFile=", "check-ignore", "--no-index", file], { cwd: dir, env: GIT_ENV, encoding: "utf8" });
        assert.equal(result.status, 1, file);
        assert.deepEqual(scanDiff(diff(file, "A=")), []);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("keeps archives and noncanonical specs local while allowing exactly the three canonical specs", () => {
    const dir = mkdtempSync(join(tmpdir(), "tenet-ignore-"));
    try {
      execFileSync("git", ["-c", "init.defaultBranch=main", "-c", "init.templateDir=", "init", "--quiet", dir], { env: GIT_ENV });
      copyFileSync(new URL("../../../.gitignore", import.meta.url), join(dir, ".gitignore"));
      for (const file of [".archive/consolidation/changes.patch", ".archive/specs/store-lock-admission.md", "specs/plan.md", "specs/new-feature.md", "specs/reviews/review.md", "specs/nested/PRD.md"]) {
        const result = spawnSync("git", ["-c", "core.excludesFile=", "check-ignore", "--no-index", file], { cwd: dir, env: GIT_ENV, encoding: "utf8" });
        assert.equal(result.status, 0, `${file}: ${result.stderr}`);
      }
      for (const file of ["specs/PRD.md", "specs/tech-spec.md", "specs/ux-spec.md"]) {
        const result = spawnSync("git", ["-c", "core.excludesFile=", "check-ignore", "--no-index", file], { cwd: dir, env: GIT_ENV, encoding: "utf8" });
        assert.equal(result.status, 1, file);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

const TOKEN = "ghp_" + "b".repeat(30); // privacy-ok: a fake token for the scanner tests
const CHECK = fileURLToPath(new URL("../../../tools/privacy-check.ts", import.meta.url));
function repo(): { dir: string; git: (...a: string[]) => string; check: (...a: string[]) => ReturnType<typeof spawnSync> } {
  const dir = mkdtempSync(join(tmpdir(), "tenet-privacy-"));
  const env = { ...GIT_ENV, XDG_CONFIG_HOME: join(dir, ".config") };
  const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=T", "-c", "user.email=t@example.test", "-c", "commit.gpgsign=false", ...a],
    { cwd: dir, env, encoding: "utf8" }).trim();
  git("-c", "init.defaultBranch=main", "-c", "init.templateDir=", "init", "--quiet");
  writeFileSync(join(dir, "a.txt"), "start\n"); git("add", "."); git("commit", "-qm", "start");
  const check = (...a: string[]) => spawnSync(process.execPath, [CHECK, ...a], { cwd: dir, env, encoding: "utf8" });
  return { dir, git, check };
}

describe("privacy check boundaries [OSS-05]", () => {
  it("isolates scratch Git subprocesses from inherited Git environment", () => {
    const dir = mkdtempSync(join(tmpdir(), "tenet-privacy-env-"));
    try {
      const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("GIT_")));
      delete env.NODE_TEST_CONTEXT;
      const config = join(dir, "config");
      mkdirSync(join(config, "git"), { recursive: true });
      writeFileSync(join(config, "git", "ignore"), "*.key\n*.KEY\n");
      Object.assign(env, {
        XDG_CONFIG_HOME: config,
        GIT_DIR: join(dir, "foreign.git"), GIT_WORK_TREE: dir, GIT_INDEX_FILE: join(dir, "foreign-index"),
        GIT_TEMPLATE_DIR: join(dir, "missing-template"), GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_KEY_0: "user.name", GIT_CONFIG_VALUE_0: "unwanted",
        GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null", GIT_CONFIG_NOSYSTEM: "1",
      });
      const pattern = "ignores real env stores|keeps archives and noncanonical specs|flags a staged binary .key|flags a committed binary .key";
      const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", `--test-name-pattern=${pattern}`, fileURLToPath(import.meta.url)],
        { cwd: dir, env, encoding: "utf8" });
      const output = String(r.stdout) + String(r.stderr);
      assert.equal(r.status, 0, output);
      assert.match(output, /# pass 4\b/);
      assert.equal(existsSync(join(dir, "foreign.git")), false);
      assert.equal(existsSync(join(dir, "foreign-index")), false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("scans an added line that starts with two plus signs, and does not take it for a file name", () => {
    const f = scanDiff(`diff --git a/a.ts b/a.ts\n+++ b/a.ts\n@@ -0,0 +1,2 @@\n+++ const t = '${TOKEN}';\n+mail ada@example.invalid\n`); // privacy-ok
    assert.deepEqual(f.map((x) => [x.file, x.line, x.what]), [["a.ts", 1, "a token"], ["a.ts", 2, "an email address"]]);
  });
  it("checks every address on a line, and allows only the exact attribution address", () => {
    assert.deepEqual(scanDiff(diff("a.md", "noreply@anthropic.com and ada@example.invalid")).map((x) => x.what), ["an email address"]); // privacy-ok
    assert.deepEqual(scanDiff(diff("a.md", ["x", "noreply@anthropic.com"].join(""))).map((x) => x.what), ["an email address"]);
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
  it("flags a staged binary .key file that has no text diff", () => {
    const { dir, git, check } = repo();
    try {
      writeFileSync(join(dir, "private.KEY"), Buffer.from([0, 1, 2, 0, 255]));
      git("add", "private.KEY");
      const r = check();
      assert.equal(r.status, 1, String(r.stdout) + String(r.stderr));
      assert.match(String(r.stderr), /private\.KEY:0: a file that looks like a secret store/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("flags a committed binary .key file in an outgoing range", () => {
    const { dir, git, check } = repo();
    try {
      const base = git("rev-parse", "HEAD");
      writeFileSync(join(dir, "private.key"), Buffer.from([0, 1, 2, 0, 255]));
      git("add", "private.key"); git("commit", "-qm", "synthetic");
      const r = check("--range", `${base}..HEAD`);
      assert.equal(r.status, 1, String(r.stdout) + String(r.stderr));
      assert.match(String(r.stderr), /private\.key:0: a file that looks like a secret store/);
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
