import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ProcessRunner } from "../src/adapters/runner.ts";
import { systemClock } from "../src/adapters/system.ts";
import { cleanup, tmp } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = () => { const root = tmp(); roots.push(root); return root; };
const runner = () => new ProcessRunner(systemClock, { PATH: process.env.PATH });

describe("run-bound report admission [EVD-05]", () => {
  for (const kind of ["fifo", "directory", "link"]) {
    it(`refuses a report replaced by a ${kind} before open without blocking or rewriting it [EVD-05, SEC-06]`, () => {
      const root = fresh();
      const child = spawnSync(process.execPath, [join(import.meta.dirname, "fixtures/race-project-read.ts"), root, `replace-${kind}`, "report"],
        { encoding: "utf8", timeout: 10000 });
      assert.equal(child.error, undefined, `${kind}: ${child.error?.message}`);
      assert.equal(child.signal, null, child.stderr);
      assert.equal(child.status, 0, child.stderr);
      assert.deepEqual(JSON.parse(child.stdout), { value: null, exit: 0 });
      const report = join(root, "run/report.json"), info = lstatSync(report);
      assert.equal(kind === "fifo" ? info.isFIFO() : kind === "directory" ? info.isDirectory() : info.isSymbolicLink(), true);
      assert.equal(readFileSync(`${report}.original`, "utf8"), '{"ok":true,"note":"a"}');
    });
  }
  for (const invalid of [[0xff], [0xc3, 0x28], [0xed, 0xa0, 0x80]]) {
    it(`refuses malformed UTF-8 report bytes ${invalid.join("-")} without replacement decoding [EVD-01, EVD-05]`, async () => {
      const root = fresh(), runDir = join(root, "run"), report = join(runDir, "report.json");
      const result = await runner().run({ argv: [process.execPath, "-e", `require('fs').writeFileSync(process.argv[1], Buffer.concat([
        Buffer.from('{"ok":true,"note":"'), Buffer.from(${JSON.stringify(invalid)}), Buffer.from('"}')]))`, report],
        cwd: root, runDir, report, timeoutMs: 5000 });
      assert.equal(result.exit, 0);
      assert.equal(result.report, null);
      assert.ok(readFileSync(report).includes(Buffer.from(invalid)));
    });
  }
  for (const mode of ["grow", "oversized", "shrink", "overwrite-json", "short"]) {
    it(`${mode === "short" ? "accepts stable short reads of" : `refuses ${mode} mutations to`} run reports [EVD-01, EVD-05]`, () => {
      const root = fresh();
      const result = JSON.parse(execFileSync(process.execPath, [join(import.meta.dirname, "fixtures/race-project-read.ts"), root, mode, "report"], { encoding: "utf8" }));
      assert.equal(result.exit, 0, JSON.stringify(result));
      assert.equal(result.value, mode === "short" ? '{"ok":true,"note":"a"}' : null, JSON.stringify(result));
      const content = readFileSync(join(root, "run/report.json"));
      if (mode === "grow") assert.ok(content.toString().endsWith("new bytes"));
      if (mode === "oversized") assert.equal(content.length, 21 * 1024 * 1024);
      if (mode === "shrink") assert.equal(content.length, 1);
      if (mode === "overwrite-json") assert.equal(content.toString(), '{"ok":true,"note":"b"}');
    });
  }
  it("preserves valid Unicode and literal replacement characters in report bytes [EVD-05]", async () => {
    const root = fresh(), runDir = join(root, "run"), report = join(runDir, "report.json");
    const text = JSON.stringify({ note: "\u00e9\u4e2d\ud83d\ude80\ufffd" });
    const result = await runner().run({ argv: [process.execPath, "-e", "require('fs').writeFileSync(process.argv[1], process.argv[2])", report, text],
      cwd: root, runDir, report, timeoutMs: 5000 });
    assert.equal(result.exit, 0);
    assert.equal(result.report, text);
  });
  for (const stream of ["stdout", "stderr"] as const) for (const char of ["é", "€"]) it(`bounds ${stream} ${char} by bytes and marks truncation explicitly`, async () => {
    const root = fresh(), runDir = join(root, "run");
    const r = await runner().run({ argv: [process.execPath, "-e", `process.${stream}.write('${char}'.repeat(6*1024*1024))`], cwd: root, runDir, timeoutMs: 5000 });
    assert.equal(r.exit, 0);
    assert.equal(r.outputTruncated, true);
    assert.ok(Buffer.byteLength(r[stream]) <= 10 * 1024 * 1024);
  });
  it("refuses a linked process record before spawn and preserves its target [SEC-06]", async () => {
    const root = fresh(), runDir = join(root, "run"), outside = join(root, "outside");
    mkdirSync(runDir); writeFileSync(outside, "preserve me"); symlinkSync(outside, join(runDir, "run.json"));
    await assert.rejects(runner().run({ argv: [process.execPath, "-e", "require('fs').writeFileSync('unexpected-spawn', 'bad')"], cwd: root, runDir, timeoutMs: 5000 }));
    assert.equal(readFileSync(outside, "utf8"), "preserve me");
    assert.equal(existsSync(join(root, "unexpected-spawn")), false);
  });
  it("stops the child if recording its process identity fails [NFR-04]", async () => {
    const root = fresh(), runDir = join(root, "run"); mkdirSync(join(runDir, "run.json"), { recursive: true });
    const result = runner().run({ argv: [process.execPath, "-e", "setTimeout(() => require('fs').writeFileSync('orphan-wrote', 'bad'), 250)"], cwd: root, runDir, timeoutMs: 5000 });
    await result.catch(() => undefined);
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.equal(existsSync(join(root, "orphan-wrote")), false);
  });
  it("refuses stale, symlinked, outside and oversized reports", async () => {
    for (const kind of ["stale", "link", "outside", "oversized"]) {
      const root = fresh(), runDir = join(root, "run"); mkdirSync(runDir);
      const report = join(kind === "outside" ? root : runDir, "report.json");
      if (kind === "link") { writeFileSync(join(root, "private"), "outside contents"); symlinkSync(join(root, "private"), report); }
      else { writeFileSync(report, kind === "oversized" ? "x".repeat(10 * 1024 * 1024 + 1) : "{}"); if (kind === "stale") utimesSync(report, 1, 1); }
      const result = await runner().run({ argv: [process.execPath, "-e", ""], cwd: root, runDir, report, timeoutMs: 5000 });
      assert.equal(result.exit, 0);
      assert.equal(result.report, null, kind);
    }
  });
  it("reads a fresh regular report written by the run inside its directory", async () => {
    const root = fresh(), runDir = join(root, "run"), report = join(runDir, "report.json");
    const result = await runner().run({ argv: [process.execPath, "-e", "require('fs').writeFileSync(process.argv[1], '{}')", report], cwd: root, runDir, report, timeoutMs: 5000 });
    assert.equal(result.exit, 0);
    assert.equal(result.report, "{}");
  });
});
