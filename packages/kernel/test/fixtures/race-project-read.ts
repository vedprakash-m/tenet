import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { FsProject } from "../../src/adapters/project-fs.ts";
import { createStack } from "../../src/adapters/node-ts.ts";
import { FsStore } from "../../src/adapters/store-fs.ts";
import { systemClock, systemRandom } from "../../src/adapters/system.ts";
import { ProcessRunner } from "../../src/adapters/runner.ts";

const [root, mode, operation] = process.argv.slice(2) as [string, string, string];
const input = operation === "process" ? "run.json" : operation === "tool" ? "node_modules/vitest/package.json" : operation === "dependency" ? "node_modules/.package-lock.json" :
  ["state", "marker", "log"].includes(operation) ? `.tenet/${operation}` : operation === "report" ? "run/report.json" : "input";
const open = fs.openSync, close = fs.closeSync, stat = fs.fstatSync, read = fs.readSync;
let target = -1, changed = false;
fs.openSync = ((path, ...args) => {
  if (String(path) === join(root, input) && operation === "report" && mode.startsWith("replace-") && !changed) {
    changed = true;
    execFileSync(process.execPath, ["-e", `
      const fs = require('fs'), path = process.argv[1], mode = process.argv[2];
      fs.renameSync(path, path + '.original');
      if (mode === 'replace-fifo') require('child_process').execFileSync('mkfifo', [path]);
      if (mode === 'replace-directory') fs.mkdirSync(path);
      if (mode === 'replace-link') fs.symlinkSync(path + '.original', path);
    `, String(path), mode]);
  }
  const descriptor = open(path, ...args);
  if (String(path) === join(root, input)) target = descriptor;
  return descriptor;
}) as typeof fs.openSync;
fs.closeSync = ((descriptor) => { if (descriptor === target) target = -1; return close(descriptor); }) as typeof fs.closeSync;
fs.fstatSync = ((descriptor, ...args) => {
  const info = stat(descriptor, ...args);
  if (descriptor === target && !changed && mode !== "short") {
    changed = true;
    execFileSync(process.execPath, ["-e", `
      const fs = require('fs'), path = process.argv[1], mode = process.argv[2];
      if (mode === 'grow') fs.appendFileSync(path, 'new bytes');
      if (mode === 'oversized') fs.truncateSync(path, 21 * 1024 * 1024);
      if (mode === 'shrink') fs.truncateSync(path, 1);
      if (mode === 'overwrite') fs.writeFileSync(path, 'x'.repeat(fs.statSync(path).size));
      if (mode === 'overwrite-json') fs.writeFileSync(path, fs.readFileSync(path, 'utf8').replace('"note":"a"', '"note":"b"'));
      if (mode === 'metadata-only') fs.chmodSync(path, fs.statSync(path).mode & 0o777);
      if (mode === 'store-overwrite') {
        const text = fs.readFileSync(path, 'utf8');
        const changed = path.endsWith('/state') ? text.replace('"revision":1', '"revision":2') :
          path.endsWith('/marker') ? text.replace(/("nonce":")(.)/, (_, prefix, first) => prefix + (first === 'a' ? 'b' : 'a')) :
          text.replace('"note":"a"', '"note":"b"');
        if (text === changed) throw new Error('mutation did not change the target');
        fs.writeFileSync(path, changed);
      }
    `, join(root, input), mode]);
  }
  return info;
}) as typeof fs.fstatSync;
fs.readSync = ((descriptor, buffer, offset, length, position) =>
  read(descriptor, buffer, offset, mode === "short" && descriptor === target ? Math.min(length, 3) : length, position)) as typeof fs.readSync;
syncBuiltinESMExports();
try {
  if (operation === "report") {
    const runDir = join(root, "run"), report = join(root, input);
    const result = await new ProcessRunner(systemClock, {}).run({ argv: [process.execPath, "-e",
      "require('fs').writeFileSync(process.argv[1], '{\"ok\":true,\"note\":\"a\"}')", report], cwd: root, runDir, report, timeoutMs: 5000 });
    process.stdout.write(JSON.stringify({ value: result.report, exit: result.exit }));
  } else if (operation === "process") {
    const value = await new ProcessRunner(systemClock, {}).stopRun(root);
    process.stdout.write(JSON.stringify({ value }));
  } else if (operation === "artifact") {
    const store = new FsStore(root, systemClock, systemRandom);
    const value = store.writeArtifact(store.tempDir("run-artifact-write"), "packet.json", "replacement");
    process.stdout.write(JSON.stringify({ value }));
  } else if (["state", "marker", "log"].includes(operation)) {
    const store = new FsStore(root, systemClock, systemRandom);
    const value = operation === "log" ? store.readLog().length : store.read()?.state.revision;
    process.stdout.write(JSON.stringify({ value }));
  } else if (operation === "tool" || operation === "dependency") {
    const stack = createStack();
    const value = operation === "tool" ? stack.detect(root).runnerVersion : stack.fingerprint(root).dependencies;
    process.stdout.write(JSON.stringify({ value }));
  } else {
    const project = new FsProject(root);
    const value = operation === "hash" ? project.hashes(["input"]).input : project.read("input");
    process.stdout.write(JSON.stringify({ value: operation === "hash" ? value : value?.length }));
  }
} catch (error) {
  const failure = error as { reasons?: Array<{ code: string }>; message: string };
  process.stdout.write(JSON.stringify({ code: failure.reasons?.[0]?.code, message: failure.message }));
}