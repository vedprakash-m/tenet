// A throwaway Git project wired to the real kernel, so tests drive the same pipeline the CLI does.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import type { KernelResponse } from "../../src/core/schemas.ts";
import { handleOf, runVerb } from "../../src/pipeline.ts";
import { configurePolicy } from "../../src/verbs/reconcile.ts";
import { VERBS } from "../../src/verbs/index.ts";
import { createPorts } from "../../src/wire.ts";
import { git, initRepo, tmp, write } from "../helpers.ts";

const REPO_NODE_MODULES = join(import.meta.dirname, "../../../../node_modules");
const cliEnv = () => ({
  PATH: process.env.PATH, HOME: process.env.HOME, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1",
  ...(process.platform === "darwin" ? { __CF_USER_TEXT_ENCODING: "test" } : {}),
});

export function project(files: Record<string, string> = {}, options: { autoConsentEnvelope?: boolean } = {}) {
  const root = tmp("tenet-fx-");
  initRepo(root);
  write(root, "package.json", '{"name":"fx","type":"module","private":true}\n');
  write(root, "tsconfig.json", '{"compilerOptions":{"strict":true,"module":"NodeNext","target":"ES2023"}}\n');
  write(root, ".gitignore", "node_modules\n");
  write(root, "src/greet.ts", "export const greet = (_name: string): string => '';\n");
  for (const [p, c] of Object.entries(files)) write(root, p, c);
  symlinkSync(REPO_NODE_MODULES, join(root, "node_modules"));
  git(root, "add", "-A");
  git(root, "commit", "-qm", "initial");
  const ports = () => createPorts(root, { PATH: process.env.PATH, HOME: process.env.HOME });
  const rawCall = (verb: string, input: Record<string, unknown> = {}): Promise<KernelResponse> => runVerb(ports(), VERBS, verb, input);
  const call = (verb: string, input: Record<string, unknown> = {}): Promise<KernelResponse> =>
    options.autoConsentEnvelope === false ? rawCall(verb, input) : callWithEnvelopeConsent(rawCall, verb, input);
  return { root, call, rawCall, ports, git: (...a: string[]) => git(root, ...a), write: (rel: string, c: string) => write(root, rel, c) };
}

export async function callWithEnvelopeConsent(
  rawCall: (verb: string, input: Record<string, unknown>) => Promise<KernelResponse>,
  verb: string,
  input: Record<string, unknown>,
): Promise<KernelResponse> {
  const response = await rawCall(verb, input);
  if (!response.questions?.some((question) => question.id === "envelope-consent") || typeof input.h !== "string") return response;
  const approval = await rawCall("decide", {
    h: input.h, kind: "envelope-consent", answers: { "envelope-consent": "allow-envelope" },
  });
  return approval.exit === 0 ? rawCall(verb, input) : approval;
}

export type Project = ReturnType<typeof project>;

export async function preconsentEnvelope(p: Project, h: string, input: Record<string, unknown>): Promise<void> {
  const ports = createPorts(p.root, cliEnv());
  const call = (verb: string, body: Record<string, unknown>) => runVerb(ports, VERBS, verb, body);
  const response = await call("check", { ...input, h });
  if (!response.questions?.some((question) => question.id === "envelope-consent")) {
    throw new Error(`expected pre-spawn envelope question: ${JSON.stringify(response)}`);
  }
  const approval = await call("decide", {
    h, kind: "envelope-consent", answers: { "envelope-consent": "allow-envelope" },
  });
  if (approval.exit !== 0) throw new Error(`envelope approval failed: ${JSON.stringify(approval)}`);
}

export const GREET_TEST = `import { expect, it } from "vitest";
import { greet } from "./greet.ts";
it("greets by name", () => { expect(greet("Ada")).toBe("Hello, Ada!"); });
`;
export const GREET_IMPL = "export const greet = (name: string): string => `Hello, ${name}!`;\n";

export const BASIS = {
  outcome: "greet(name) returns a friendly greeting",
  scopePaths: ["src/greet.ts"],
  elements: [
    { ref: "r1", kind: "requirement", origin: "request", text: "greet(name) returns 'Hello, <name>!'" },
    { ref: "e1", kind: "example", origin: "request", of: "r1", text: "greet('Ada') is 'Hello, Ada!'", testFile: "src/greet.test.ts", test: "distinguishing", expect: "fail" },
  ],
};

export const reviewResult = (data: Record<string, any>, over: Record<string, unknown> = {}) => ({
  kind: "review", manifest: data.review.hash, reservation: data.review.reservation, attempt: data.review.attempt, mode: data.review.mode,
  status: "completed", dispatchMode: data.review.dispatchMode ?? "subagent-fresh", axes: { behavior: "pass", structure: "pass" },
  coverage: { inspected: data.review.files ?? ["src/greet.ts", "src/greet.test.ts"], uncovered: [], crossCutting: "no other callers", sampled: [] },
  attention: [], findings: [], basisGaps: [], ...over,
});

/** A synthetic coordinator step for existing workflow fixtures: report the current offered same-session pass.
 * Product tests that prove the missing-pass refusal call the kernel directly (focused-review.test.ts). */
export async function focusFixture(p: Project, h: string): Promise<KernelResponse | undefined> {
  const ports = p.ports(), state = ports.store.read()?.state;
  const w = state && Object.values(state.work).find(w => handleOf(state, w) === h);
  const rv = w?.focusedReview;
  if (!state || !w || !rv || state.pending.length || w.state === "finished") return;
  configurePolicy(ports, state);
  if ((await ports.git.inventory([])).digest !== rv.candidate) return;
  return p.call("findings", { h, result: reviewResult({ review: { hash: rv.manifestHash, reservation: rv.id, attempt: rv.attempt, mode: rv.mode, files: rv.requiredPaths ?? Object.keys(rv.files), dispatchMode: "same-session" } }) });
}

export async function finishFixture(p: Project, input: Record<string, unknown>): Promise<KernelResponse> {
  if (typeof input.h === "string") await focusFixture(p, input.h);
  return p.call("finish", input);
}

const MAIN = join(import.meta.dirname, "../../src/main.ts");
export interface Cli { code: number | null; signal: NodeJS.Signals | null; stdout: string; json?: KernelResponse }

/** Runs the real command-line entry in its own process, as an agent would. */
export function cli(root: string, args: string[], stdin?: string): { child: ReturnType<typeof spawn>; done: Promise<Cli> } {
  const child = spawn(process.execPath, [MAIN, ...args], { cwd: root, stdio: ["pipe", "pipe", "inherit"], env: cliEnv() });
  let stdout = "";
  child.stdout!.on("data", (c: Buffer) => { stdout += c.toString(); });
  child.stdin!.end(stdin ?? "");
  const done = new Promise<Cli>((resolve) => child.on("exit", (code, signal) => {
    let json: KernelResponse | undefined;
    try { json = JSON.parse(stdout.trim().split("\n").at(-1) ?? ""); } catch { /* killed before output */ }
    resolve({ code, signal, stdout, ...(json ? { json } : {}) });
  }));
  return { child, done };
}

export const runCli = (root: string, args: string[], stdin?: string) => cli(root, args, stdin).done;

export async function waitFor<T>(fn: () => T | undefined | false, ms = 20000, what = "condition"): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

export const isAlive = (pid: number): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };

/** The run directory of the check currently recorded in the state document, once its process has started. */
export function runningCheck(p: Project): { runDir: string; pid: number } | undefined {
  const st = p.ports().store.read()?.state;
  const c = Object.values(st?.work ?? {}).map((w) => w.session.inCall).find(Boolean);
  if (!c?.runDir || !existsSync(join(c.runDir, "run.json"))) return undefined;
  const record = JSON.parse(readFileSync(join(c.runDir, "run.json"), "utf8"));
  return typeof record.pid === "number" && record.procStart ? { runDir: c.runDir, pid: record.pid } : undefined;
}

export const listFiles = (root: string): string[] => readdirSync(root).sort();
export const SLOW_TEST = `import { expect, it } from "vitest";
it("slow", async () => { await new Promise((r) => setTimeout(r, 90000)); expect(1).toBe(1); }, 120000);
`;

// ---------------------------------------------------------------- a small fake starter recipe (no network)
import { createHash } from "node:crypto";
import { FsRecipes } from "../../src/adapters/recipes-fs.ts";
import type { Ports, Recipe, Recipes } from "../../src/ports/types.ts";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const FAKE_LOCK = '{ "name": "tenet-starter-app", "lockfileVersion": 3 }\n';
export const FAKE_TEST = 'import { expect, it } from "vitest";\nit("the starter works", () => { expect(2 + 2).toBe(4); });\n';

/** Installing is a command too: this one links the repository's own node_modules, or fails while `.fail-install` exists. */
const INSTALL = ["node", "-e", `const fs=require('fs');if(fs.existsSync('.fail-install')){console.error('network is down');process.exit(3)}fs.symlinkSync(${JSON.stringify(REPO_NODE_MODULES)},'node_modules')`];

export const fakeRecipe = (over: Partial<Recipe> = {}): Recipe => ({
  id: "ts-web-api", version: "9.9.9", sentinel: "tenet-starter-app", lockfileSha256: sha(FAKE_LOCK), protectedPaths: ["server/migrations/*", "server/src/platform/auth/*"], install: [INSTALL],
  files: [
    { path: "package.json", content: '{"name":"tenet-starter-app","type":"module","private":true}\n', mode: 0o644 },
    { path: "package-lock.json", content: FAKE_LOCK, mode: 0o644 },
    { path: "tsconfig.json", content: '{"compilerOptions":{"strict":true}}\n', mode: 0o644 },
    { path: ".gitignore", content: "node_modules\n.fail-install\n", mode: 0o644 },
    { path: "README.md", content: "# tenet-starter-app\n", mode: 0o644 },
    { path: "server/test/starter.test.ts", content: FAKE_TEST, mode: 0o644 },
  ], ...over,
});

const realPlugin = new FsRecipes(join(import.meta.dirname, "../../../../plugin"));
export const fakeRecipes = (recipe: Recipe = fakeRecipe()): Recipes => ({ load: (id) => (id === recipe.id ? recipe : null), text: (rel) => realPlugin.text(rel) });

/** Ports for a folder, with the recipe source replaced. */
export const portsWith = (root: string, recipes: Recipes): Ports => ({ ...createPorts(root, { PATH: process.env.PATH, HOME: process.env.HOME }), recipes });
export const callWith = (root: string, recipes: Recipes) => (verb: string, input: Record<string, unknown> = {}): Promise<KernelResponse> => runVerb(portsWith(root, recipes), VERBS, verb, input);
