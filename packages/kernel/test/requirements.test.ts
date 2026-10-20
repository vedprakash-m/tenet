// Requirements proved by their own test rather than as a side effect of another: boundaries, egress, roles, receipts.
import { existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { FsProject } from "../src/adapters/project-fs.ts";
import { parsePolicy } from "../src/core/policy.ts";
import { VERBS } from "../src/verbs/index.ts";
import { cleanup, tmp } from "./helpers.ts";
import { BASIS, GREET_TEST, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => { for (const r of roots) cleanup(r); });
const fresh = (files?: Record<string, string>): Project => { const p = project(files); roots.push(p.root); return p; };
const d = (r: { data?: unknown }) => r.data as Record<string, any>;
const ROOT = join(import.meta.dirname, "../../..");
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === "node_modules" ? [] : walk(join(dir, e.name))) : [join(dir, e.name)]));

describe("helpers stay inside the workspace [SEC-06]", () => {
  it("refuses a path that leaves the project, lexically or through a symlink, for every operation", () => {
    const root = tmp("tenet-proj-"), outside = tmp("tenet-out-");
    roots.push(root, outside);
    writeFileSync(join(outside, "secret.txt"), "outside\n");
    symlinkSync(outside, join(root, "link"));
    symlinkSync(join(outside, "secret.txt"), join(root, "INTENT.md"));
    symlinkSync(join(outside, "nowhere"), join(root, "dangling"));
    const p = new FsProject(root);
    for (const rel of ["../x", "link/new.txt", "INTENT.md", "dangling"]) {
      assert.throws(() => p.write(rel, "x"), /project|link|resolved/, rel);
      assert.throws(() => p.writeNew([{ path: rel, content: "x", mode: 0o644 }]), /project|link|resolved/, rel);
    }
    assert.equal(p.read("INTENT.md"), null, "a link that leads out reads as absent");
    assert.deepEqual(p.hashes(["INTENT.md", "link/secret.txt"]), { "INTENT.md": null, "link/secret.txt": null });
    assert.equal(readFileSync(join(outside, "secret.txt"), "utf8"), "outside\n");
    mkdirSync(join(root, "docs"));
    p.write("docs/ok.md", "fine\n");
    assert.equal(p.read("docs/ok.md"), "fine\n");
  });

  it("exposes no generic execution endpoint: no verb takes a command to run", () => {
    for (const [name, verb] of Object.entries(VERBS)) {
      const props = Object.keys((z.toJSONSchema(verb.schema, { io: "input" }) as { properties?: object }).properties ?? {});
      assert.deepEqual(props.filter((k) => /^(argv|command|cmd|exec|shell|script|run)$/i.test(k)), [], name);
    }
  });
});

describe("what ships makes no network connection and bundles no MCP [SEC-03, SEC-07]", () => {
  it("has no network client in the bundle or the source", () => {
    const bundle = join(ROOT, "plugin/kernel/tenet.mjs");
    const sources = walk(join(ROOT, "packages/kernel/src")).filter((f) => f.endsWith(".ts")).map((f) => readFileSync(f, "utf8"));
    const net = /from ["']node:(?:net|http|https|http2|dgram|tls|dns|inspector)["']|require\(["'](?:node:)?(?:net|http|https|dgram|tls|dns)["']\)|\bfetch\(|new WebSocket\(/;
    for (const s of sources) assert.doesNotMatch(s, net);
    if (existsSync(bundle)) assert.doesNotMatch(readFileSync(bundle, "utf8"), /from ["']node:(?:net|http|https|http2|dgram|tls)["']|import\(["']node:(?:net|http|https)["']\)/);
  });

  it("ships no MCP server or configuration in the plugin", () => {
    const files = walk(join(ROOT, "plugin")).map((f) => f.slice(ROOT.length + 1));
    assert.deepEqual(files.filter((f) => /mcp/i.test(f.split("/").pop()!) && !f.startsWith("plugin/kernel/")), []);
    const manifest = JSON.parse(readFileSync(join(ROOT, "plugin/plugin.json"), "utf8")) as Record<string, unknown>;
    assert.equal(Object.keys(manifest).some((k) => /mcp/i.test(k)), false);
  });
});

describe("tests, CI and hooks are never weakened to pass [SEC-10]", () => {
  it("never bypasses a hook or rewrites Git's hook configuration", () => {
    const src = readFileSync(join(ROOT, "packages/kernel/src/adapters/git-cli.ts"), "utf8");
    assert.doesNotMatch(src, /--no-verify|hooksPath=|"--no-gpg-sign"|commit\.gpgsign=false/); // reading core.hooksPath to inspect hooks is allowed
  });
});

describe("a shared file never grants authority [SEC-12]", () => {
  it("refuses grants, approvals and egress in tenet.policy.json: only restrictions and obligations are keys", () => {
    for (const key of ["grants", "allow", "approvals", "egress", "trusted_commands", "floors", "lane_floor"]) {
      const r = parsePolicy({ [key]: ["x"] });
      assert.equal(r.ok, false, key);
    }
  });
});

describe("roles are responsibility contracts, not model names [AGT-01]", () => {
  it("names no model in any agent, skill or command text", () => {
    const text = walk(join(ROOT, "plugin")).filter((f) => f.endsWith(".md")).map((f) => [f, readFileSync(f, "utf8")] as const);
    for (const [f, t] of text) assert.doesNotMatch(t.replace(/Never suggest switching model or effort\./g, ""), /\b(gpt-?\d|claude|sonnet|opus|haiku|gemini|o[134]-mini|llama)\b/i, f);
  });
});

describe("assistance level is stated before any implementation [INS-12]", () => {
  it("open reports the level, and says why when it is below L4", async () => {
    const p = fresh();
    const ok = await p.call("open", { profile: "feature", request: "x", scopePaths: ["src/greet.ts"] });
    assert.equal(d(ok).level, "L4");
    const q = fresh();
    cleanup(join(q.root, "node_modules")); // a symlink: removing it leaves no installed dependencies
    const low = await q.call("open", { profile: "feature", request: "x", scopePaths: ["src/greet.ts"] });
    assert.notEqual(d(low).level, "L4");
    assert.ok(low.reasons.some((r) => r.code === "capability-missing" && r.note), JSON.stringify(low.reasons));
  });
});

describe("a check result is an execution receipt, never a summary [EVD-12]", () => {
  it("records what ran, where, with what, for how long, and where the run came from", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "x", scopePaths: ["src/greet.ts"], lane: "standard" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    const rc = Object.values(p.ports().store.read()!.state.work)[0]!.receipts[0]!;
    assert.equal(rc.source, "kernel-run");
    assert.ok(rc.argv.length > 0 && rc.cwd && rc.durationMs >= 0 && rc.checkInputId && rc.candidate);
    assert.ok(rc.versions.tool && rc.versions.adapter);
    assert.ok(rc.provenance.runId && rc.provenance.startedAt);
  });
});

describe("a reported defect needs a reproduction before the fix [LRN-03]", () => {
  it("a bug fix whose test already passes on the baseline is not a reproduction, and cannot be checked-local", async () => {
    const p = fresh({ "src/greet.ts": "export const greet = (name: string): string => `Hello, ${name}!`;\n" });
    const h = (await p.call("open", { profile: "bug", request: "greet is wrong", scopePaths: ["src/greet.ts"], lane: "standard" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    const r = await p.call("check", { h, stage: "baseline" });
    assert.ok(r.reasons.some((x) => x.code === "no-distinguishing-red"), JSON.stringify(r.reasons));
    assert.equal(r.next[0]!.action, "test", "the next step is a test that fails for the reported defect");
  });
});

describe("existing behavior is characterized before it changes [TDD-04]", () => {
  const SRC = "export const add = (a: number, b: number): number => a + b;\nexport const sub = (a: number, b: number): number => 0;\n";
  const TEST = 'import { expect, it } from "vitest";\nimport { sub } from "./math.ts";\nit("subtracts", () => { expect(sub(5, 3)).toBe(2); });\n';
  const KEEP = 'import { expect, it } from "vitest";\nimport { add } from "./math.ts";\nit("still adds", () => { expect(add(2, 3)).toBe(5); });\n';
  const basis = { outcome: "sub works", scopePaths: ["src/math.ts"], elements: [
    { ref: "r", kind: "requirement", origin: "request", text: "sub(a, b) returns a - b" },
    { ref: "e1", kind: "example", origin: "request", of: "r", text: "sub(5, 3) is 2", testFile: "src/math.test.ts", test: "distinguishing", expect: "fail" },
    { ref: "e2", kind: "example", origin: "request", of: "r", text: "add(2, 3) is still 5", testFile: "src/add.test.ts", test: "preservation", expect: "pass" },
  ] };

  it("a preservation example passes on the baseline without being a red, and breaking it fails the candidate", async () => {
    const p = fresh({ "src/math.ts": SRC });
    const h = (await p.call("open", { profile: "feature", request: "add sub", scopePaths: ["src/math.ts"], lane: "standard" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: basis });
    p.write("src/math.test.ts", TEST);
    p.write("src/add.test.ts", KEEP); // each example names its own file: a receipt covers a file
    const base = await p.call("check", { h, stage: "baseline" });
    assert.ok(!base.reasons.some((x) => x.code === "no-distinguishing-red"), JSON.stringify(base.reasons));
    assert.equal(base.next[0]!.action, "implement");
    p.write("src/math.ts", "export const add = (a: number, b: number): number => a - b;\nexport const sub = (a: number, b: number): number => a - b;\n");
    const broke = await p.call("check", { h, stage: "candidate" });
    assert.ok(broke.reasons.some((x) => x.code === "evidence-failed"), "changing add breaks what was characterized");
  });
});
