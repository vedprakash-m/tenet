import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, it } from "node:test";
import { cleanup } from "./helpers.ts";
import { callWithEnvelopeConsent, project, reviewResult } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

const original = `export function countLabel(count: number): string {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError("count must be a nonnegative integer");
  return count + " files";
}
`;
const corrected = original.replace('count + " files"', 'count + (count === 1 ? " file" : " files")');
const cli = `import { countLabel } from "./count.ts";
const args = process.argv.slice(2);
if (args.length !== 1 || !/^\\d+$/.test(args[0]!)) {
  process.stderr.write("usage: count <nonnegative integer>\\n");
  process.exitCode = 2;
} else {
  try { process.stdout.write(countLabel(Number(args[0])) + "\\n"); }
  catch (error) {
    if (!(error instanceof RangeError)) throw error;
    process.stderr.write("usage: count <nonnegative integer>\\n");
    process.exitCode = 2;
  }
}
`;
const support = `import { spawnSync } from "node:child_process";
import { join } from "node:path";
export function run(args: string[]) {
  return spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--experimental-strip-types", join(import.meta.dirname, "cli.ts"), ...args],
    { encoding: "utf8", timeout: 5000 });
}
`;
const preservation = `import { expect, it } from "vitest";
import { countLabel } from "./count.ts";
import { run } from "./cli-test-support.ts";
it("keeps plural/zero library output and explicit invalid-input refusal", () => {
  expect(countLabel(0)).toBe("0 files");
  expect(countLabel(2)).toBe("2 files");
  for (const n of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => countLabel(n)).toThrow(RangeError);
  for (const args of [[], ["bad"], ["-1"], ["1.5"], ["1", "2"], ["9007199254740992"]]) {
    const result = run(args);
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("usage: count <nonnegative integer>\\n");
  }
  const result = run(["2"]);
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.status).toBe(0);
  expect(result.stdout).toBe("2 files\\n");
  expect(result.stderr).toBe("");
});
`;
const distinguishing = `import { expect, it } from "vitest";
import { countLabel } from "./count.ts";
import { run } from "./cli-test-support.ts";
it("uses the singular through the exported library", () => {
  expect(countLabel(1)).toBe("1 file");
});
it("uses the singular through the real CLI process", () => {
  const result = run(["1"]);
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.status).toBe(0);
  expect(result.stdout).toBe("1 file\\n");
  expect(result.stderr).toBe("");
});
`;

it("characterizes and repairs a brownfield TypeScript CLI/library through the real loop without a web recipe [QLT-12]", { timeout: 120_000 }, async () => {
  const p = project({
    "package.json": JSON.stringify({ name: "count-fixture", type: "module", private: true, exports: "./src/count.ts", bin: { count: "./src/cli.ts" } }),
    "src/count.ts": original,
    "src/cli.ts": cli,
    "src/cli-test-support.ts": support,
    "src/count-preservation.test.ts": preservation,
  });
  roots.push(p.root);
  const rawCall = async (verb: string, input: Record<string, unknown>) => {
    const bundle = process.env.TENET_TEST_BUNDLE;
    if (!bundle) return p.rawCall(verb, input);
    const stdin = ["open", "decide", "findings"].includes(verb);
    const args = stdin ? [] : Object.entries(input).flatMap(([key, value]) => {
      const flag = `--${key.replace(/[A-Z]/g, character => `-${character.toLowerCase()}`)}`;
      return value === true ? [flag] : [flag, Array.isArray(value) ? value.join(",") : String(value)];
    });
    const result = spawnSync(process.execPath, [bundle, verb, ...args], {
      cwd: p.root, env: process.env, input: stdin ? JSON.stringify(input) : "", encoding: "utf8", timeout: 30_000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null, result.stderr);
    const response: Awaited<ReturnType<typeof p.rawCall>> = JSON.parse(result.stdout);
    assert.equal(result.status, response.exit, result.stderr);
    return response;
  };
  const call = (verb: string, input: Record<string, unknown>) => callWithEnvelopeConsent(rawCall, verb, input);
  const before = p.git("rev-parse", "HEAD");
  const opened = await call("open", { profile: "bug", request: "Use singular file for one; preserve plural output and CLI usage errors.", scopePaths: ["src/count.ts"], lane: "standard" });
  assert.equal(opened.exit, 0, JSON.stringify(opened));
  const h = opened.handle!;
  const basis = await call("decide", { h, kind: "basis", propose: {
    outcome: "The library and CLI use singular file for one without changing plural output or usage refusal.",
    scopePaths: ["src/count.ts"],
    elements: [
      { ref: "r", kind: "requirement", origin: "request", text: "One uses singular; keep plural output and invalid CLI input refusal." },
      { ref: "keep", kind: "example", origin: "request", of: "r", text: "Zero/two remain plural; invalid CLI input prints usage on stderr and exits2.", testFile: "src/count-preservation.test.ts", test: "preservation", expect: "pass", support: ["src/cli.ts", "src/cli-test-support.ts"] },
      { ref: "fix", kind: "example", origin: "request", of: "r", text: "Library countLabel(1) and the real CLI return 1 file.", testFile: "src/count-singular.test.ts", test: "distinguishing", expect: "fail", support: ["src/cli.ts", "src/cli-test-support.ts"] },
    ],
  } });
  assert.equal(basis.exit, 0, JSON.stringify(basis));
  p.write("src/count-singular.test.ts", distinguishing);
  const baseline = await call("check", { h, stage: "baseline" });
  assert.equal(baseline.exit, 0, JSON.stringify(baseline));
  assert.equal(baseline.next[0]?.action, "implement", JSON.stringify(baseline));
  const baselineReceipts = Object.values(p.ports().store.read()!.state.work)[0]!.receipts.filter(receipt => receipt.stage === "baseline");
  assert.deepEqual(baselineReceipts.map(receipt => [receipt.status, receipt.counts?.executed, receipt.counts?.failed]).sort(),
    [["fail", 2, 2], ["pass", 1, 0]], "both library and process fail assertions while characterization passes");
  assert.ok(baselineReceipts.flatMap(receipt => receipt.failures ?? []).every(failure => failure.kind === "assertion"));
  p.write("src/count.ts", corrected);
  const candidate = await call("check", { h, stage: "candidate", touched: ["src/count.ts", "src/count-singular.test.ts"] });
  assert.equal(candidate.exit, 0, JSON.stringify(candidate));
  assert.equal(candidate.next[0]?.action, "review", JSON.stringify(candidate));
  const candidateReceipts = Object.values(p.ports().store.read()!.state.work)[0]!.receipts.filter(receipt => receipt.stage === "candidate");
  assert.equal(candidateReceipts.length, 3);
  assert.ok(candidateReceipts.every(receipt => receipt.status === "pass"));
  assert.deepEqual(candidateReceipts.map(receipt => receipt.counts?.executed).sort(), [1, 2, 3], "per-example and full-suite receipts retain distinct populations");
  assert.ok(candidateReceipts.every(receipt => receipt.counts?.failed === 0 && receipt.counts.skipped === 0 && receipt.counts.focused === 0));
  assert.equal(new Set(candidateReceipts.map(receipt => receipt.provenance.runId)).size, 1, "all receipts share one actual three-case execution");
  const data = candidate.data as Record<string, unknown>;
  const reviewed = await call("findings", { h, result: reviewResult(data) });
  assert.equal(reviewed.exit, 0, JSON.stringify(reviewed));
  const finished = await call("finish", { h, noCommit: true });
  assert.equal(finished.exit, 0, JSON.stringify(finished));
  assert.equal((finished.data as Record<string, unknown>).endpoint, "checked-local", JSON.stringify(finished));
  assert.equal(p.git("rev-parse", "HEAD"), before, "the loop must honor noCommit");
  assert.equal(readFileSync(join(p.root, "src/cli.ts"), "utf8"), cli);
  assert.equal(readFileSync(join(p.root, "src/count-preservation.test.ts"), "utf8"), preservation);
  assert.equal(p.git("diff", "--name-only"), "src/count.ts", "pre-existing source, metadata and characterization remain intact");
  const actual = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--experimental-strip-types", join(p.root, "src/cli.ts"), "1"], { cwd: p.root, encoding: "utf8", timeout: 5000 });
  assert.equal(actual.error, undefined);
  assert.equal(actual.status, 0, actual.stderr);
  assert.equal(actual.stdout, "1 file\n");
});
