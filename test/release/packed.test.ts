import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { constants, existsSync } from "node:fs";
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../../", import.meta.url));
const suites = ["alg-02","alg-03","alg-04","alg-08","alg-09","alg-10","alg-11","alg-14","board","card","check","install","scenarios"];
const dependencies = ["ajv", "ajv-formats", "commander", "fast-xml-parser", "picomatch", "yaml"];
const npm = [
  process.env.npm_execpath,
  path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
  path.resolve(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
].find((candidate) => candidate && existsSync(candidate));
assert.ok(npm, "Could not locate npm-cli.js");

function runNpm(args: string[], cwd: string, env = process.env): string {
  return execFileSync(process.execPath, [npm, ...args], { cwd, env, encoding: "utf8", windowsHide: true, timeout: 120_000 });
}

async function consumerEnv(scratch: string): Promise<NodeJS.ProcessEnv> {
  const home = path.join(scratch, "home");
  const temp = path.join(scratch, "tmp");
  const appData = path.join(home, "appdata");
  const config = path.join(home, "config");
  const [cache, registry] = ["cache", "registry"].map((key) => runNpm(["config", "get", key], project).trim());
  await Promise.all([appData, config, temp].map((folder) => mkdir(folder, { recursive: true })));
  const userconfig = path.join(home, "npmrc");
  const globalconfig = path.join(home, "global-npmrc");
  await Promise.all([writeFile(userconfig, ""), writeFile(globalconfig, "")]);
  const isolated: NodeJS.ProcessEnv = {
    HOME: home, USERPROFILE: home, APPDATA: appData, LOCALAPPDATA: appData, XDG_CONFIG_HOME: config,
    TMPDIR: temp, TEMP: temp, TMP: temp, npm_config_userconfig: userconfig, npm_config_globalconfig: globalconfig,
    npm_config_cache: cache, npm_config_registry: registry, GIT_CONFIG_GLOBAL: globalconfig, GIT_CONFIG_NOSYSTEM: "1",
  };
  if (process.platform === "win32") {
    const root = path.parse(home).root;
    isolated.HOMEDRIVE = root.slice(0, -1);
    isolated.HOMEPATH = home.slice(root.length - 1);
  }
  const keys = new Set([...Object.keys(isolated).map((key) => key.toLowerCase()), "homedrive", "homepath"]);
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !keys.has(key.toLowerCase()) && !/^git_|^npm_config_/i.test(key)));
  return { ...inherited, ...isolated };
}

function git(cwd: string, env: NodeJS.ProcessEnv, ...args: string[]) {
  return execFileSync("git", ["-c", "core.autocrlf=false", "-c", "core.safecrlf=false", ...args], {
    cwd, env, encoding: "utf8", windowsHide: true, timeout: 30_000,
  }).trim();
}

test("the alpha.0 npm tarball has the release layout and runs the installed CLI", { timeout: 180_000 }, async (t) => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "tenet-packed-"));
  t.after(() => rm(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  const reused = process.env.TENET_RELEASE_PACKED_DIR;
  const destination = reused ?? process.env.TENET_RELEASE_TARBALL_DIR ?? scratch;
  await mkdir(destination, { recursive: true });
  const manifest = JSON.parse(await readFile(path.join(project, "package.json"), "utf8"));
  assert.deepEqual(manifest.bin, { tenet: "dist/cli.js" });
  assert.deepEqual(manifest.exports, { ".": "./dist/sdk.js" });
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), dependencies);
  assert.deepEqual(manifest.files, ["dist", "kit", ...suites.map((suite) => `pkg/conformance/${suite}`)]);

  // npm test builds dist before starting Node's test runner.
  const packRecord = path.join(destination, "pack.json");
  const metadata = reused ? await readFile(packRecord, "utf8") :
    runNpm(["pack", "--json", "--ignore-scripts", "--pack-destination", destination], project);
  if (process.env.TENET_RELEASE_TARBALL_DIR && !reused) await writeFile(packRecord, metadata);
  const items = JSON.parse(metadata);
  assert.equal(items.length, 1);
  const [packed] = items;
  assert.equal(packed.name, manifest.name);
  assert.equal(packed.version, manifest.version);
  assert.equal(packed.id, `${manifest.name}@${manifest.version}`);
  const files: string[] = packed.files.map(({ path: filename }: { path: string }) => filename);
  assert.deepEqual([...new Set(files.map((file) => file.split("/")[0]))].sort(),
    ["LICENSE", "README.md", "dist", "kit", "package.json", "pkg"]);
  const shippedPkg = files.filter((file) => file.startsWith("pkg/"));
  assert.ok(shippedPkg.every((file) => file.startsWith("pkg/conformance/")));
  assert.deepEqual([...new Set(shippedPkg.map((file) => file.split("/")[2]))].sort(), suites);
  for (const forbidden of ["tenet/", "test/", "pkg/evals/", "src/", ".github/", "package-lock.json", "LICENSE-docs", "runner/"]) {
    assert.ok(files.every((file) => file !== forbidden && !file.startsWith(forbidden)), `Leaked ${forbidden}`);
  }
  for (const required of ["dist/cli.js", "dist/sdk.js", "dist/commands/index.js", "kit/TENET.md",
    ...["fs", "yaml", "git", "hash", "output", "clock"].map((name) => `dist/core/${name}.js`)]) {
    assert.ok(files.includes(required), `Missing ${required}`);
  }
  const tarball = path.join(destination, packed.filename);
  assert.equal(`sha512-${createHash("sha512").update(await readFile(tarball)).digest("base64")}`, packed.integrity);
  const consumer = path.join(scratch, "consumer");
  await mkdir(consumer);
  await writeFile(path.join(consumer, "package.json"), JSON.stringify({ name: "tenet-release-test", private: true }));
  const env = await consumerEnv(scratch);
  runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund", "--prefer-offline",
    "--fetch-retries=0", "--fetch-timeout=25000", tarball], consumer, env);
  const installed = path.join(consumer, "node_modules", ...manifest.name.split("/"));
  const installedManifest = JSON.parse(await readFile(path.join(installed, "package.json"), "utf8"));
  assert.equal(installedManifest.version, manifest.version);

  const input = JSON.parse(await readFile(path.join(installed, "pkg/conformance/check/p02-path-citation/input.json"), "utf8"));
  const cwd = path.join(consumer, "checkout");
  for (const [file, content] of Object.entries(input.repo.files as Record<string, string>)) {
    const target = path.join(cwd, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  git(cwd, env, "init", "--quiet");
  git(cwd, env, "config", "--local", "user.name", "Tenet Release Test");
  git(cwd, env, "config", "--local", "user.email", "release-test@example.invalid");
  git(cwd, env, "add", ".");
  git(cwd, env, "commit", "-qm", "Copy packed conformance fixture");
  const revision = git(cwd, env, "rev-parse", "HEAD");
  const installedBin = path.join(installed, manifest.bin.tenet);
  assert.match(await readFile(installedBin, "utf8"), /^#!\/usr\/bin\/env node\n/);
  const windows = process.platform === "win32";
  const shim = path.join(consumer, "node_modules", ".bin", windows ? "tenet.cmd" : "tenet");
  if (windows) await access(shim);
  else {
    assert.equal(await realpath(shim), await realpath(installedBin));
    await access(shim, constants.X_OK);
  }
  function tenet(...args: string[]): string {
    const options = { cwd, env, encoding: "utf8" as const, windowsHide: true, timeout: 30_000 };
    if (!windows) return execFileSync(shim, args, options);
    // cmd.exe runs the installed npm batch shim. The arguments below are fixed CLI flags.
    return execFileSync(process.env.ComSpec ?? "cmd.exe", [
      "/d", "/s", "/v:off", "/c", `""%TENET_PACKED_BIN%" ${args.join(" ")}"`,
    ], { ...options, env: { ...env, TENET_PACKED_BIN: shim }, windowsVerbatimArguments: true });
  }
  assert.equal(tenet("--version").trim(), manifest.version);
  for (const [command, ...args] of [["version", "--version"], ["help", "--help"],
    ["onboard", "onboard", "--inventory-only"], ["check", "check"], ["board", "board"]]) {
    const output = JSON.parse(tenet(...args, "--json"));
    assert.equal(output.command, command);
    assert.equal(output.ok, true, JSON.stringify(output.errors));
    assert.equal(output.version, manifest.version);
    if (command === "version") assert.equal(output.result.version, manifest.version);
    if (command === "help") assert.match(output.result.text, /onboard[\s\S]*check|check[\s\S]*onboard/);
    if (command === "onboard") {
      assert.equal(output.result.preflight.revision, revision);
      assert.ok(output.result.inventory.sources.files.some(({ path: file }: { path: string }) => file === "src/retry.ts"));
      const assignment = JSON.parse(await readFile(path.join(cwd, ".tenet/onboard/assignment.json"), "utf8"));
      assert.deepEqual(assignment, output.result.assignment);
    }
    if (command === "check") assert.deepEqual(output.result.summary, { errors: 0, warnings: 0, advises: 0 });
    if (command === "board") {
      assert.equal(output.result.read.main, revision);
      assert.ok(output.result.specs.some(({ path: file }: { path: string }) => file === "tenet/specs/prd.md"));
    }
  }

  const sdk = execFileSync(process.execPath, ["--input-type=module", "-e",
    `console.log(JSON.stringify(Object.keys(await import(${JSON.stringify(manifest.name)})).sort()))`],
  { cwd: consumer, env, encoding: "utf8", windowsHide: true, timeout: 30_000 });
  assert.deepEqual(JSON.parse(sdk), ["alias", "catFileBatch", "clockNow", "confine", "fail", "git", "jcs", "lastChangedMap",
    "readYaml", "registerCommand", "result", "run", "sha256", "ulid", "utcSeconds", "writeAtomic", "writeRefFiles"]);
});
