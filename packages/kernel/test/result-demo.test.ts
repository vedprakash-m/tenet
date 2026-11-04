// Result demo path, first slice (result-demo-path.md §10 to §12, RD-1 and RD-2): a strict bounded `finish --demo` proposal,
// a structured `data.demo`, command and example references that are source-checked and never executed, and a declared
// applicability limit. Screenshots, capture and receipt metadata are not part of this slice (RD-3, RD-4, RD-5).
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { basisHashOf } from "../src/core/basis-build.ts";
import { DEMO_READ_BYTES, DemoProposal, buildDemo } from "../src/core/demo.ts";
import type { DemoContext } from "../src/core/demo.ts";
import type { BasisElement } from "../src/core/schemas.ts";
import { FinishInput } from "../src/core/schemas.ts";
import type { ProjectReadResult } from "../src/ports/types.ts";
import { FsProject } from "../src/adapters/project-fs.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { createPorts } from "../src/wire.ts";
import { cleanup, tmp, write } from "./helpers.ts";
import { BASIS, finishFixture, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const root = (): string => { const r = tmp("tenet-demo-"); roots.push(r); return r; };

const HASH = "a".repeat(64);
const EX1 = "EX-001-abc.1";
const EX2 = "EX-001-abc.2";
const REQ = "REQ-001-abc";
const el = (id: string, kind: BasisElement["kind"], text: string): BasisElement =>
  ({ id, origin: "request", kind, text, verifiedBy: [], ...(kind === "example" ? { test: "distinguishing" as const } : {}) });
const ELEMENTS = [el(REQ, "requirement", "greet by name"), el(EX1, "example", "greet('Ada') is 'Hello, Ada!'"), el(EX2, "example", "greet('') is 'Hello!'")];
const OUTCOME = "greeting works";

const contextFor = (elements: readonly BasisElement[] = ELEMENTS, over: Partial<DemoContext> = {}): DemoContext => ({
  basis: { hash: basisHashOf(OUTCOME, undefined, elements), elementIds: elements.map((e) => e.id) },
  outcome: OUTCOME, elements, packageManager: "npm", moduleRoot: ".", ...over,
});
const proposal = (over: Record<string, unknown> = {}): DemoProposal =>
  DemoProposal.parse({
    surface: "use", basisHash: contextFor().basis!.hash, commands: [],
    steps: [{ exampleId: EX1, instruction: "run the greeting" }, { exampleId: EX2, instruction: "run it with no name" }],
    screenshots: [], ...over,
  });
const reader = (dir: string) => { const p = new FsProject(dir); return (path: string, max: number): ProjectReadResult => p.readBounded(path, max); };
const files = (dir: string, entries: Record<string, string>) => { for (const [p, c] of Object.entries(entries)) write(dir, p, c); };
const pkg = (scripts: Record<string, unknown>) => JSON.stringify({ name: "x", scripts });
const fence = (lines: string[], lang = "sh") => ["# Run", "", "```" + lang, "# cwd: .", ...lines, "```", ""].join("\n");
const docSource = (line: number, command: string, path = "README.md") => ({ kind: "documentation" as const, path, line, command });
const scriptSource = (script: string, path = "package.json") => ({ kind: "package-script" as const, path, script });
const limits = (d: ReturnType<typeof buildDemo>) => (d?.unavailable ?? []).map((u) => `${u.part}:${u.reason}${u.ref ? `:${u.ref}` : ""}`);

describe("demo proposal is strict and bounded (RD-1)", () => {
  const ok = { surface: "use", basisHash: HASH, commands: [], steps: [{ exampleId: EX1, instruction: "go" }], screenshots: [] };
  const rejects = (over: Record<string, unknown>, why: string) => assert.equal(DemoProposal.safeParse({ ...ok, ...over }).success, false, why);

  it("accepts a minimal proposal and leaves a finish call without a demo valid", () => {
    assert.equal(DemoProposal.safeParse(ok).success, true);
    assert.equal(FinishInput.safeParse({ h: "W1.1.abcd" }).success, true);
    assert.equal(FinishInput.safeParse({ h: "W1.1.abcd", demo: ok }).success, true);
  });

  it("rejects unknown keys at every level", () => {
    rejects({ extra: 1 }, "top level");
    rejects({ steps: [{ exampleId: EX1, instruction: "go", extra: 1 }] }, "step");
    rejects({ commands: [{ kind: "package-script", path: "package.json", script: "dev", extra: 1 }] }, "command source");
    rejects({ screenshots: [{ receiptId: "r1", exampleId: EX1, attachmentId: "a1", extra: 1 }] }, "screenshot");
  });

  it("rejects over-bound input instead of truncating it", () => {
    const src = (n: number) => ({ kind: "package-script", path: "package.json", script: `s${n}` });
    rejects({ commands: [0, 1, 2, 3, 4].map(src) }, "five commands");
    const steps = (n: number) => Array.from({ length: n }, (_, i) => ({ exampleId: `EX-001-abc.${i + 1}`, instruction: "go" }));
    rejects({ steps: steps(61) }, "61 steps");
    rejects({ steps: [{ exampleId: EX1, instruction: "x".repeat(501) }] }, "long instruction");
    rejects({ commands: [docSource(1, "x".repeat(501))] }, "long command");
    rejects({ commands: [scriptSource("s".repeat(101))] }, "long script name");
    rejects({ commands: [scriptSource("dev", `${"a/".repeat(100)}package.json`)] }, "long path");
    const shots = Array.from({ length: 6 }, (_, i) => ({ receiptId: "r1", exampleId: EX1, attachmentId: `a${i}` }));
    rejects({ surface: "ui", screenshots: shots }, "six screenshots");
    // 60 steps of 400 two-byte characters is within every field bound (800 bytes each) but over the 32 KiB proposal bound.
    rejects({ steps: Array.from({ length: 60 }, (_, i) => ({ exampleId: `EX-001-abc.${i + 1}`, instruction: "é".repeat(400) })) }, "32 KiB counted in bytes");
  });

  it("rejects NUL, terminal control sequences and invalid UTF-8 text", () => {
    rejects({ steps: [{ exampleId: EX1, instruction: "a\0b" }] }, "NUL");
    rejects({ steps: [{ exampleId: EX1, instruction: "a\u001b[31mb" }] }, "escape sequence");
    rejects({ steps: [{ exampleId: EX1, instruction: "two\nlines" }] }, "newline");
    rejects({ steps: [{ exampleId: EX1, instruction: "lone \ud800 surrogate" }] }, "lone surrogate");
    rejects({ steps: [{ exampleId: EX1, instruction: "   " }] }, "blank instruction");
  });

  it("rejects absolute, parent-traversing and non-relative paths", () => {
    for (const path of ["/etc/passwd", "../package.json", "a/../package.json", "a\\b", "C:/x/package.json", "./package.json", "a//b", ""])
      rejects({ commands: [scriptSource("dev", path)] }, path);
  });

  it("rejects duplicate references and malformed identifiers", () => {
    rejects({ commands: [scriptSource("dev"), scriptSource("dev")] }, "duplicate script");
    rejects({ commands: [docSource(3, "npm run dev"), docSource(3, "npm run dev")] }, "duplicate documentation line");
    rejects({ steps: [{ exampleId: EX1, instruction: "a" }, { exampleId: EX1, instruction: "b" }] }, "duplicate example");
    rejects({ surface: "ui", screenshots: [{ receiptId: "r1", exampleId: EX1, attachmentId: "a1" }, { receiptId: "r1", exampleId: EX1, attachmentId: "a1" }] }, "duplicate attachment");
    rejects({ basisHash: "xyz" }, "hash shape");
    rejects({ steps: [{ exampleId: "not an id", instruction: "go" }] }, "example id shape");
    rejects({ commands: [docSource(0, "npm run dev")] }, "line zero");
    rejects({ commands: [docSource(1.5, "npm run dev")] }, "fractional line");
    rejects({ surface: "ui", screenshots: [{ receiptId: "r1", exampleId: EX2, attachmentId: "a1" }] }, "screenshot for an example with no step");
  });

  it("requires an internal proposal to carry no commands, steps or screenshots", () => {
    assert.equal(DemoProposal.safeParse({ surface: "internal", basisHash: HASH, commands: [], steps: [], screenshots: [] }).success, true);
    rejects({ surface: "internal" }, "internal with a step");
  });

  it("returns a typed invalid-input refusal before any state is read or written", async () => {
    const dir = root();
    const ports = createPorts(dir, { PATH: process.env.PATH, HOME: process.env.HOME });
    const r = await runVerb(ports, VERBS, "finish", { h: "W1.1.abcd", demo: { ...ok, extra: true } });
    assert.equal(r.exit, 1);
    assert.equal(r.reasons[0]!.code, "invalid-input");
    assert.match(r.reasons[0]!.message, /demo/);
    assert.equal(ports.store.exists(), false, "a refusal creates no store");
  });
});

describe("run commands are source-checked and never executed (DP-T01)", () => {
  it("derives npm and pnpm commands from package scripts, in order, with the module directory", () => {
    const dir = root();
    files(dir, { "package.json": pkg({ dev: "node server.js", "dev:web": "vite" }), "app/package.json": pkg({ dev: "node ." }) });
    const sources = [scriptSource("dev"), scriptSource("dev:web")];
    const npm = buildDemo(proposal({ commands: sources }), contextFor(), reader(dir))!;
    assert.deepEqual(npm.run.map((r) => [r.instruction, r.cwd, r.verification]), [["npm run dev", ".", "source-checked-not-executed"], ["npm run dev:web", ".", "source-checked-not-executed"]]);
    assert.deepEqual(npm.run.map((r) => r.source), sources);
    const pnpm = buildDemo(proposal({ commands: [scriptSource("dev")] }), contextFor(ELEMENTS, { packageManager: "pnpm" }), reader(dir))!;
    assert.equal(pnpm.run[0]!.instruction, "pnpm run dev");
    const nested = buildDemo(proposal({ commands: [scriptSource("dev", "app/package.json")] }), contextFor(ELEMENTS, { moduleRoot: "app" }), reader(dir))!;
    assert.deepEqual(nested.run.map((r) => [r.instruction, r.cwd]), [["npm run dev", "app"]]);
  });

  it("refuses an unsupported or ambiguous manager, a script that is not an own string, and a package outside the module root", () => {
    const dir = root();
    files(dir, { "package.json": pkg({ dev: "x", broken: 3 }), "sub/package.json": pkg({ dev: "x" }) });
    const run = (sources: unknown[], over: Partial<DemoContext> = {}) => buildDemo(proposal({ commands: sources }), contextFor(ELEMENTS, over), reader(dir))!;
    for (const packageManager of ["yarn", "unknown"] as const)
      assert.deepEqual(limits(run([scriptSource("dev")], { packageManager })).filter((l) => l.startsWith("run")), ["run:unsupported:package.json"]);
    assert.ok(limits(run([scriptSource("constructor")])).includes("run:source-unavailable:package.json"), "an inherited property is not a script");
    assert.ok(limits(run([scriptSource("missing")])).includes("run:source-unavailable:package.json"));
    assert.ok(limits(run([scriptSource("broken")])).includes("run:source-unavailable:package.json"), "a non-string script");
    assert.ok(limits(run([scriptSource("dev", "sub/package.json")])).includes("run:unsupported:sub/package.json"));
    assert.ok(limits(run([scriptSource("-x")])).includes("run:unsupported:package.json"), "a script name outside the allowed shape");
    assert.equal(run([scriptSource("missing"), scriptSource("dev")]).run.length, 1, "one unavailable command does not drop another");
  });

  it("accepts a documented command only from an exact line inside a closed shell fence that declares the root directory", () => {
    const dir = root();
    files(dir, { "README.md": fence(["npm run dev", "npm run dev:web"], "bash"), "docs/run.md": fence(["npm start"], "shell") });
    const d = buildDemo(proposal({ commands: [docSource(5, "npm run dev"), docSource(6, "npm run dev:web"), docSource(5, "npm start", "docs/run.md")] }), contextFor(), reader(dir))!;
    assert.deepEqual(d.run.map((r) => [r.instruction, r.cwd]), [["npm run dev", "."], ["npm run dev:web", "."], ["npm start", "."]]);
    assert.deepEqual(d.run[0]!.source, docSource(5, "npm run dev"));
    assert.deepEqual(d.unavailable.filter((u) => u.part === "run"), []);
  });

  it("refuses documentation that lacks the directory marker, is not a closed shell fence, or does not match the line exactly", () => {
    const dir = root();
    files(dir, {
      "README.md": [
        "```sh", "npm run a", "```", // 1-3: no marker
        "```sh", "", "# cwd: .", "npm run b", "```", // 4-8: marker after a blank line is still the first nonempty line
        "```sh", "cd app", "# cwd: .", "npm run c", "```", // 9-13: marker not first
        "```sh", "# cwd: app", "npm run d", "```", // 14-17: nested directory
        "```js", "# cwd: .", "npm run e", "```", // 18-21: not a shell fence
        "```sh", "# cwd: .", "npm run f", // 22-24: never closed
      ].join("\n"),
    });
    const at = (line: number, command: string) => limits(buildDemo(proposal({ commands: [docSource(line, command)] }), contextFor(), reader(dir)))
      .filter((l) => l.startsWith("run"));
    assert.deepEqual(at(2, "npm run a"), ["run:source-unavailable:README.md"]);
    assert.deepEqual(at(7, "npm run b"), []);
    assert.deepEqual(at(12, "npm run c"), ["run:source-unavailable:README.md"]);
    assert.deepEqual(at(16, "npm run d"), ["run:source-unavailable:README.md"]);
    assert.deepEqual(at(20, "npm run e"), ["run:source-unavailable:README.md"]);
    assert.deepEqual(at(24, "npm run f"), ["run:source-unavailable:README.md"]);
    assert.deepEqual(at(7, "npm run"), ["run:source-unavailable:README.md"], "a prefix is not the line");
    assert.deepEqual(at(7, "npm run b "), ["run:source-unavailable:README.md"], "no trimming");
    assert.deepEqual(at(99, "npm run b"), ["run:source-unavailable:README.md"], "a line past the end");
    assert.deepEqual(at(6, "# cwd: ."), ["run:source-unavailable:README.md"], "the marker is not a command");
    assert.deepEqual(at(1, "```sh"), ["run:source-unavailable:README.md"], "a fence line is not a command");
  });

  it("allows only README.md and Markdown files under docs/", () => {
    const dir = root();
    files(dir, { "NOTES.md": fence(["npm run dev"]), "docs/run.txt": fence(["npm run dev"]), "src/docs/run.md": fence(["npm run dev"]) });
    for (const path of ["NOTES.md", "docs/run.txt", "src/docs/run.md", "package.json"])
      assert.deepEqual(limits(buildDemo(proposal({ commands: [docSource(5, "npm run dev", path)] }), contextFor(), reader(dir))).filter((l) => l.startsWith("run")), [`run:unsupported:${path}`]);
  });

  it("reports each source the bounded reader refuses as unavailable, reading each at most 64 KiB", () => {
    const dir = root();
    files(dir, { "README.md": fence(["npm run dev"]), "package.json": "x".repeat(DEMO_READ_BYTES + 1), "docs/bad.md": "" });
    writeFileSync(join(dir, "docs/bad.md"), Buffer.from([0xff, 0xfe, 0x41]));
    const calls: Array<[string, number]> = [];
    const read = (path: string, max: number) => { calls.push([path, max]); return reader(dir)(path, max); };
    const d = buildDemo(proposal({ commands: [scriptSource("dev"), docSource(5, "npm run dev", "docs/bad.md"), docSource(5, "npm run dev", "docs/missing.md"), docSource(5, "npm run dev")] }), contextFor(), read)!;
    assert.deepEqual(limits(d).filter((l) => l.startsWith("run")), ["run:source-unavailable:package.json", "run:source-unavailable:docs/bad.md", "run:source-unavailable:docs/missing.md"]);
    assert.deepEqual(d.run.map((r) => r.instruction), ["npm run dev"]);
    assert.ok(calls.length === 4 && calls.every(([, max]) => max === 64 * 1024), JSON.stringify(calls));
    for (const cause of ["excluded", "linked", "outside", "not-regular", "moved", "unreadable"] as const) {
      const refused = buildDemo(proposal({ commands: [docSource(5, "npm run dev")] }), contextFor(), () => ({ status: "unavailable", cause }))!;
      assert.deepEqual(refused.run, [], cause);
      assert.deepEqual(limits(refused).filter((l) => l.startsWith("run")), ["run:source-unavailable:README.md"], cause);
    }
  });

  it("refuses a symbolic link as a source", { skip: process.platform === "win32" && "O_NOFOLLOW is unavailable on win32" }, () => {
    const dir = root();
    files(dir, { "real.md": fence(["npm run dev"]) });
    symlinkSync(join(dir, "real.md"), join(dir, "README.md"));
    assert.deepEqual(buildDemo(proposal({ commands: [docSource(5, "npm run dev")] }), contextFor(), reader(dir))!.run, []);
  });

  it("withholds a command that redaction would change instead of showing a damaged copy", () => {
    const dir = root();
    const secret = "curl -H 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789' http://localhost:3000";
    files(dir, { "README.md": fence([secret, "npm run dev"]) });
    const d = buildDemo(proposal({ commands: [docSource(5, secret), docSource(6, "npm run dev")] }), contextFor(), reader(dir))!;
    assert.deepEqual(d.run.map((r) => r.instruction), ["npm run dev"]);
    assert.ok(limits(d).includes("run:sensitive-content:README.md"));
    assert.ok(!JSON.stringify(d).includes("abcdefghijklmnop"));
  });

  it("never substitutes a test command when no run command is supplied or usable", () => {
    const dir = root();
    files(dir, { "package.json": pkg({ test: "vitest run", dev: "node ." }) });
    const d = buildDemo(proposal(), contextFor(), reader(dir))!;
    assert.deepEqual(d.run, []);
    assert.ok(limits(d).includes("run:not-supplied"));
  });
});

describe("examples resolve against the pinned basis (DP-T02)", () => {
  it("names each accepted example with its confirmed text, then the supplied guidance", () => {
    const d = buildDemo(proposal(), contextFor(), reader(root()))!;
    assert.deepEqual(d.steps.map((s) => s.exampleId), [EX1, EX2]);
    assert.ok(d.steps[0]!.text.includes("greet('Ada') is 'Hello, Ada!'"));
    assert.ok(d.steps[0]!.text.includes("run the greeting"));
    assert.ok(d.steps[0]!.text.indexOf("Hello, Ada") < d.steps[0]!.text.indexOf("run the greeting"), "confirmed text first, guidance after");
    assert.deepEqual(d.unavailable.filter((u) => u.part === "example"), []);
  });

  it("makes a bound example with no step an explicit limit, never a complete demo", () => {
    const d = buildDemo(proposal({ steps: [{ exampleId: EX1, instruction: "go" }] }), contextFor(), reader(root()))!;
    assert.deepEqual(d.steps.map((s) => s.exampleId), [EX1]);
    assert.ok(limits(d).includes(`example:not-supplied:${EX2}`));
  });

  it("refuses a step for an unknown, deleted or non-example id and keeps the others", () => {
    const d = buildDemo(proposal({ steps: [{ exampleId: EX1, instruction: "go" }, { exampleId: "EX-009-zzz.1", instruction: "go" }] }), contextFor(), reader(root()))!;
    assert.deepEqual(d.steps.map((s) => s.exampleId), [EX1]);
    assert.ok(limits(d).includes("example:example-unavailable:EX-009-zzz.1"));
    const odd = [...ELEMENTS, el("EX-001-abc.3", "constraint", "not an example")];
    const kind = buildDemo(proposal({ basisHash: contextFor(odd).basis!.hash, steps: [{ exampleId: "EX-001-abc.3", instruction: "go" }] }), contextFor(odd), reader(root()))!;
    assert.ok(limits(kind).includes("example:example-unavailable:EX-001-abc.3"), "only an example element can be demonstrated");
  });

  it("treats a changed or deleted bound element as a stale basis, even when the supplied hash matches", () => {
    const pinned = contextFor();
    const changed = ELEMENTS.map((e) => (e.id === EX1 ? { ...e, text: "greet('Ada') is 'Hi, Ada!'" } : e));
    const sameHash = { ...contextFor(changed), basis: pinned.basis };
    const d = buildDemo(proposal(), sameHash, reader(root()))!;
    assert.deepEqual(d.steps, []);
    assert.ok(limits(d).includes("example:stale-basis"));
    assert.ok(!JSON.stringify(d).includes("Hi, Ada"), "newer same-id text is never substituted");
    const deleted = { ...pinned, elements: ELEMENTS.filter((e) => e.id !== EX2) };
    assert.ok(limits(buildDemo(proposal(), deleted, reader(root()))).includes("example:stale-basis"));
  });

  it("treats a supplied hash that differs from the contract's as a stale basis", () => {
    const d = buildDemo(proposal({ basisHash: HASH }), contextFor(), reader(root()))!;
    assert.deepEqual(d.steps, []);
    assert.deepEqual(limits(d).filter((l) => l.startsWith("example")), ["example:stale-basis"]);
  });

  it("is not affected by a later change to how an element was verified", () => {
    const verified = ELEMENTS.map((e) => ({ ...e, verifiedBy: [{ method: "obligation" as const, ref: "OB-1" }] }));
    assert.equal(buildDemo(proposal(), contextFor(verified, { basis: contextFor().basis }), reader(root()))!.steps.length, 2);
  });

  it("reports every step as unavailable when the contract has no basis", () => {
    const d = buildDemo(proposal(), { ...contextFor(), basis: undefined }, reader(root()))!;
    assert.deepEqual(d.steps, []);
    assert.deepEqual(limits(d).filter((l) => l.startsWith("example")), [`example:example-unavailable:${EX1}`, `example:example-unavailable:${EX2}`]);
  });

  it("withholds a step whose text or guidance holds a likely secret", () => {
    const d = buildDemo(proposal({ steps: [{ exampleId: EX1, instruction: "use password=hunter2hunter2 to sign in" }, { exampleId: EX2, instruction: "go" }] }), contextFor(), reader(root()))!;
    assert.deepEqual(d.steps.map((s) => s.exampleId), [EX2]);
    assert.ok(limits(d).includes(`example:sensitive-content:${EX1}`));
  });
});

describe("applicability is a coordinator declaration the kernel cannot certify (DP-T07, RD-2)", () => {
  it("states the applicability limit for a ui or use declaration, whatever else is supplied", () => {
    for (const surface of ["ui", "use"] as const) {
      const d = buildDemo(proposal({ surface }), contextFor(), reader(root()))!;
      assert.equal(d.surface, surface);
      assert.ok(limits(d).includes("applicability:applicability-unverified"), surface);
    }
  });

  it("adds no demo block for an internal declaration", () => {
    const internal = DemoProposal.parse({ surface: "internal", basisHash: HASH, commands: [], steps: [], screenshots: [] });
    assert.equal(buildDemo(internal, contextFor(), reader(root())), undefined);
  });

  it("states a missing run command, and for ui a missing screenshot, as unavailable rather than guessing", () => {
    const ui = buildDemo(proposal({ surface: "ui" }), contextFor(), reader(root()))!;
    assert.ok(limits(ui).includes("run:not-supplied"));
    assert.ok(limits(ui).includes("screenshot:not-supplied"));
    assert.deepEqual(ui.screenshots, []);
    const use = buildDemo(proposal({ surface: "use" }), contextFor(), reader(root()))!;
    assert.ok(!limits(use).some((l) => l.startsWith("screenshot")), "a use declaration does not require screenshots");
  });

  it("refuses to reference a screenshot, because no capture or receipt-bound artifact exists in this slice", () => {
    const d = buildDemo(proposal({ surface: "ui", screenshots: [{ receiptId: "r1", exampleId: EX1, attachmentId: "tenet-demo:EX-001-abc.1" }] }), contextFor(), reader(root()))!;
    assert.deepEqual(d.screenshots, []);
    assert.ok(limits(d).includes("screenshot:unsupported:tenet-demo:EX-001-abc.1"));
  });
});

// The end-to-end checks drive the real finish verb. The kernel refuses mutating verbs on win32, so they run on POSIX CI.
const POSIX = { skip: process.platform === "win32" && "mutating verbs are refused on win32" };
describe("finish returns the demo without changing the verdict (E1, E3, E5)", () => {
  const fresh = async (): Promise<{ p: Project; h: string }> => {
    const p = project({
      "package.json": JSON.stringify({ name: "fx", type: "module", private: true, scripts: { dev: "node src/greet.ts", test: "vitest run" } }),
      "README.md": fence(["npm run dev"]),
    });
    roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    await p.call("check", { h, touched: ["src/greet.ts"] });
    await p.call("decide", { h, kind: "decline", target: "tests", quote: "skip the tests" });
    return { p, h };
  };
  const stateOf = (p: Project) => { const st = p.ports().store.read()!.state; const w = Object.values(st.work)[0]!; return { w, elements: st.project.intent.elements.filter((e) => w.basis!.elementIds.includes(e.id)) }; };
  const verdictOf = (r: { data?: unknown }) => { const { endpoint, label, level, checks, acceptance, scope, stopReason } = r.data as Record<string, unknown>; return { endpoint, label, level, checks, acceptance, scope, stopReason }; };

  it("E1: exposes the documented command and a step naming the confirmed example", POSIX, async () => {
    const { p, h } = await fresh();
    const { w, elements } = stateOf(p);
    const example = elements.find((e) => e.kind === "example")!;
    const demo = { surface: "use", basisHash: w.basis!.hash, commands: [docSource(5, "npm run dev"), scriptSource("dev")], steps: [{ exampleId: example.id, instruction: "run the greeting" }], screenshots: [] };
    const f = await finishFixture(p, { h, noCommit: true, demo });
    assert.equal(f.exit, 0, JSON.stringify(f));
    const out = (f.data as any).demo;
    assert.deepEqual(out.run.map((r: any) => r.instruction), ["npm run dev", "npm run dev"]);
    assert.ok(out.run.every((r: any) => r.verification === "source-checked-not-executed"));
    assert.ok(out.steps[0].text.includes(example.text));
    assert.deepEqual(out.unavailable.map((u: any) => u.reason), ["applicability-unverified"]);
    const again = await finishFixture(p, { h, noCommit: true, demo });
    assert.deepEqual((again.data as any).demo, out, "an already finished contract rebuilds the same demo");
  });

  it("changes nothing about the verdict, checks or acceptance", POSIX, async () => {
    const withDemo = await fresh(), without = await fresh();
    const { w } = stateOf(withDemo.p);
    const a = await finishFixture(withDemo.p, { h: withDemo.h, noCommit: true, demo: { surface: "ui", basisHash: w.basis!.hash, commands: [scriptSource("dev")], steps: [], screenshots: [] } });
    const b = await finishFixture(without.p, { h: without.h, noCommit: true });
    assert.deepEqual(verdictOf(a), verdictOf(b));
    assert.equal((b.data as any).demo, undefined, "no proposal, no invented demo");
  });

  it("E3: a missing run command is stated as unavailable", POSIX, async () => {
    const { p, h } = await fresh();
    const f = await finishFixture(p, { h, noCommit: true, demo: { surface: "ui", basisHash: stateOf(p).w.basis!.hash, commands: [], steps: [], screenshots: [] } });
    const parts = (f.data as any).demo.unavailable.map((u: any) => `${u.part}:${u.reason}`);
    assert.ok(parts.includes("run:not-supplied") && parts.includes("screenshot:not-supplied"), parts.join());
  });

  it("E5: an internal declaration adds no demo block", POSIX, async () => {
    const { p, h } = await fresh();
    const f = await finishFixture(p, { h, noCommit: true, demo: { surface: "internal", basisHash: stateOf(p).w.basis!.hash, commands: [], steps: [], screenshots: [] } });
    assert.equal(f.exit, 0);
    assert.equal((f.data as any).demo, undefined);
  });

  it("a malformed proposal refuses before the contract finishes", POSIX, async () => {
    const { p, h } = await fresh();
    const f = await finishFixture(p, { h, noCommit: true, demo: { surface: "use", basisHash: "nope", commands: [], steps: [], screenshots: [] } });
    assert.equal(f.exit, 1);
    assert.equal(stateOf(p).w.state === "finished", false);
  });
});
