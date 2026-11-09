import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, watch, writeFileSync } from "node:fs";
import type { FSWatcher } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, sep } from "node:path";
import { it } from "node:test";
import assert from "node:assert/strict";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { cleanup, tmp } from "./helpers.ts";
import { GREET_IMPL, project, waitFor } from "./support/fixture.ts";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForQuiet(events: unknown[]): Promise<void> {
  let count = events.length, last = Date.now();
  const deadline = last + 10000;
  while (Date.now() < deadline) {
    await delay(100);
    if (events.length !== count) { count = events.length; last = Date.now(); }
    if (Date.now() - last >= 1000) return;
  }
  throw new Error("filesystem watcher did not become quiet after calibration");
}

async function calibrateWatcher(root: string): Promise<void> {
  const nested = join(root, "nested");
  mkdirSync(nested, { recursive: true });
  const events: { kind: string; path: string; elapsedMs: number }[] = [];
  let watchError: Error | undefined;
  const started = performance.now();
  const watcher = watch(root, { recursive: true }, (kind, path) => {
    if (path) events.push({ kind, path: path.toString(), elapsedMs: performance.now() - started });
  });
  watcher.on("error", (error) => { watchError = error; });
  const canary = join(nested, "watch-canary.tmp");
  try {
    writeFileSync(canary, "temporary\n");
    await waitFor(() => {
      if (watchError) throw watchError;
      return events.some((event) => event.path.endsWith("watch-canary.tmp"));
    }, 5000, "nested watch canary");
    if (watchError) throw watchError;
  } finally {
    if (!events.some((event) => event.path.endsWith("watch-canary.tmp"))) {
      console.error("nested watcher calibration failed", JSON.stringify({
        platform: process.platform, node: process.version, elapsedMs: performance.now() - started,
        canaryPresent: existsSync(canary), watchError: watchError === undefined ? null : String(watchError),
        eventCount: events.length, events: events.slice(0, 100),
      }));
    }
    rmSync(canary, { force: true });
    watcher.close();
  }
  assert.equal(existsSync(canary), false);
}

function snapshot(root: string): string[] {
  const entries: string[] = [];
  function visit(dir: string): void {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const rel = relative(root, path).split(sep).join("/");
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) entries.push(`link ${rel} ${readlinkSync(path)}`);
      else if (stat.isDirectory()) {
        entries.push(`dir ${rel} ${stat.mode}`);
        visit(path);
      } else if (stat.isFile()) {
        const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
        entries.push(`file ${rel} ${stat.mode} ${digest}`);
      } else throw new Error(`unexpected project entry: ${rel}`);
    }
  }
  visit(root);
  return entries;
}

const INSPECT_CONFIG = new Set(["core.fsmonitor=false", "diff.external=", "core.quotePath=false", "color.ui=never"]);
const FIXED_COMMANDS = [
  ["--version"],
  ["config", "--null", "--get-regexp", "^filter\\."],
  ["config", "core.hooksPath"],
  ["diff", "--cached", "--name-only", "--diff-filter=U"],
  ["ls-files", "-s", "-z"],
  ["ls-files", "--others", "--exclude-standard", "-z"],
  ["ls-files", "-v", "-z"],
  ["remote"],
  ["rev-parse", "--show-toplevel"],
  ["rev-parse", "--verify", "-q", "HEAD"],
  ["rev-parse", "--absolute-git-dir"],
  ["rev-parse", "--is-shallow-repository"],
  ["rev-parse", "--path-format=absolute", "--git-common-dir"],
  ["rev-parse", "--show-object-format"],
  ["status", "--porcelain=v2", "-z", "--untracked-files=all", "--", "."],
  ["symbolic-ref", "-q", "--short", "HEAD"],
  ["var", "GIT_COMMITTER_IDENT"],
];
const same = (a: string[], b: string[]) => a.length === b.length && a.every((value, i) => value === b[i]);
const objectId = (value: string | undefined) => /^[0-9a-f]{40}$/.test(value ?? "");

function readOnlyGit(argv: string[]): boolean {
  if (!/^git(?:\.exe)?$/i.test(basename(argv[0] ?? ""))) return false;
  const args = argv.slice(1);
  for (;;) {
    if (args[0] === "--no-pager" || args[0] === "--no-replace-objects") args.shift();
    else if (args[0] === "-c" && INSPECT_CONFIG.has(args[1] ?? "")) args.splice(0, 2);
    else break;
  }
  if (FIXED_COMMANDS.some((command) => same(args, command))) return true;
  if (same(args.slice(0, 4), ["ls-tree", "-r", "-z", "--name-only"])) {
    return objectId(args[4]) && args[5] === "--" && args.slice(6).every((path) => path.startsWith(":(literal)"));
  }
  if (same(args.slice(0, 6), ["diff", "--no-ext-diff", "--no-textconv", "--no-color", "-U0", "--no-renames"])) {
    return objectId(args[6]) && args[7] === "--" && args.length === 9 && args[8]!.startsWith(":(literal)");
  }
  return false;
}

interface TraceEntry { event: string; argv?: string[] }

function trace(path: string): TraceEntry[] {
  return readFileSync(path, "utf8").trim().split("\n").map((line) => JSON.parse(line) as TraceEntry);
}

it("observes stateless review without project activity or traced mutating commands [CON-09]", async () => {
  const p = project({ ".gitignore": "node_modules\nignored.txt\n" });
  const traceDir = tmp("tenet-review-trace-");
  const oldTrace = process.env.GIT_TRACE2_EVENT;
  const tempKeys = ["TMPDIR", "TMP", "TEMP"] as const;
  const oldTemp = tempKeys.map((key) => process.env[key]);
  let watcher: FSWatcher | undefined;
  try {
    const nonce = randomUUID();
    p.write("src/greet.ts", `${GREET_IMPL}// @ts-ignore\n`);
    p.write("staged.txt", "staged\n");
    p.git("add", "staged.txt");
    p.write(`untracked-${nonce}.txt`, "untracked\n");
    p.write("ignored.txt", "original\n");

    const privateTemp = join(traceDir, "temp");
    mkdirSync(privateTemp);
    for (const key of tempKeys) process.env[key] = privateTemp;
    assert.equal(tmpdir(), privateTemp, "review artifacts must use the private test directory");

    process.env.GIT_TRACE2_EVENT = join(traceDir, "control.json");
    p.git("config", "tenet-test.sentinel", "present");
    const control = trace(process.env.GIT_TRACE2_EVENT).find((entry) => entry.event === "start");
    assert.ok(control?.argv && !readOnlyGit(control.argv), "the traced config write must not pass the allowlist");
    p.git("config", "--unset", "tenet-test.sentinel");

    const before = snapshot(p.root);
    p.write("ignored.txt", "changed\n");
    assert.notDeepEqual(snapshot(p.root), before, "the snapshot must detect content changes without a renamed file");
    p.write("ignored.txt", "original\n");
    assert.deepEqual(snapshot(p.root), before);

    // Let notifications from fixture setup and hashing settle before watching the review.
    await delay(3000);
    await calibrateWatcher(join(traceDir, "watch-control"));
    const events: { kind: string; path: string | null }[] = [];
    let watchError: Error | undefined;
    watcher = watch(p.root, { recursive: true }, (kind, path) => events.push({ kind, path: path?.toString() ?? null }));
    watcher.on("error", (error) => { watchError = error; });
    await waitForQuiet(events);
    if (watchError) throw watchError;
    events.length = 0;

    const tracePath = join(traceDir, "review.json");
    process.env.GIT_TRACE2_EVENT = tracePath;
    const ports = p.ports();
    let runnerCalls = 0;
    ports.runner.run = async () => { runnerCalls++; throw new Error("review attempted to run a command"); };
    const result = await runVerb(ports, VERBS, "review", {});
    await delay(1000);
    if (watchError) throw watchError;
    assert.deepEqual([...events], [], "the watcher reported project activity during review");

    const canaryName = `watch-canary-${nonce}.tmp`;
    const canary = join(p.root, "src", canaryName);
    writeFileSync(canary, "temporary\n");
    try {
      await waitFor(() => {
        if (watchError) throw watchError;
        return events.some((event) => event.path?.endsWith(canaryName));
      }, 5000, "project watch canary");
    } finally {
      if (!events.some((event) => event.path?.endsWith(canaryName))) {
        console.error("project watcher calibration failed", JSON.stringify({
          platform: process.platform, node: process.version, canaryPresent: existsSync(canary),
          watchError: watchError === undefined ? null : String(watchError),
          eventCount: events.length, events: events.slice(0, 100),
        }));
      }
      rmSync(canary, { force: true });
    }
    watcher.close();
    watcher = undefined;

    assert.equal(result.exit, 0, JSON.stringify(result));
    const data = result.data as { manifest: string; hash: string };
    const expectedArtifact = join(tmpdir(), "tenet-unbound", "review", `${data.hash}.json`);
    assert.equal(data.manifest, expectedArtifact);
    const manifest = readFileSync(expectedArtifact, "utf8");
    assert.match(manifest, /@ts-ignore/);
    assert.ok(manifest.includes(nonce));
    assert.equal(watchError, undefined);
    assert.deepEqual(snapshot(p.root), before, "project entries, bytes, modes or symlink targets changed");
    assert.equal(runnerCalls, 0);

    const entries = trace(tracePath);
    const starts = entries.filter((entry) => entry.event === "start");
    assert.ok(starts.length > 0, "Git trace must record actual starts");
    for (const entry of starts) assert.ok(entry.argv && readOnlyGit(entry.argv), JSON.stringify(entry.argv));
    assert.equal(entries.filter((entry) => entry.event === "child_start").length, 0, "Git spawned a child command");
  } finally {
    watcher?.close();
    if (oldTrace === undefined) delete process.env.GIT_TRACE2_EVENT;
    else process.env.GIT_TRACE2_EVENT = oldTrace;
    for (const [i, key] of tempKeys.entries()) {
      if (oldTemp[i] === undefined) delete process.env[key];
      else process.env[key] = oldTemp[i];
    }
    cleanup(p.root);
    cleanup(traceDir);
  }
});
