// The command-line front-end (TS §4.5): a transport for `runVerb`, holding no verdict, authority or budget logic.
// `tenet <verb> [positional] [--flag value] [--bool]`, an optional JSON object on stdin, a JSON response on stdout and
// the response's exit code as the process exit code.
import type { KernelResponse } from "../core/schemas.ts";
import { runVerb } from "../pipeline.ts";
import type { Verb } from "../pipeline.ts";
import type { Ports } from "../ports/types.ts";

/** The first bare word after the verb fills this field. */
const POSITIONAL: Record<string, string> = { open: "profile", decide: "kind", packet: "role", stop: "mode", inspect: "view", check: "stage" };
/** Verbs whose input can be large or structured take a JSON object on stdin; the rest never wait for it. */
const BODY_VERBS = new Set(["findings", "decide", "open"]);
const LISTS = new Set(["touched", "scaffold", "scopePaths", "protectedPaths", "signals"]);
const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

export function parseArgs(argv: readonly string[]): { verb: string; input: Record<string, unknown> } {
  const [verb = "", ...rest] = argv;
  const input: Record<string, unknown> = {};
  let positional = false;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (!a.startsWith("--")) {
      const field = POSITIONAL[verb];
      if (field && !positional) { input[field] = a; positional = true; continue; }
      throw new Error(`unexpected argument "${a}"`);
    }
    const eq = a.indexOf("=");
    const key = camel(a.slice(2, eq < 0 ? undefined : eq));
    const next = eq < 0 ? rest[i + 1] : a.slice(eq + 1);
    if (next === undefined || (eq < 0 && next.startsWith("--"))) { input[key] = true; continue; }
    if (eq < 0) i++;
    if (key === "answer") { // --answer <id>=<choice>, repeatable: one question, one answer
      const eq = next.indexOf("=");
      if (eq < 1) throw new Error(`--answer needs <id>=<choice>, got "${next}"`);
      input.answers = { ...(input.answers as object), [next.slice(0, eq)]: next.slice(eq + 1) };
      continue;
    }
    input[key] = LISTS.has(key) ? next.split(",").filter(Boolean) : /^[{[]/.test(next) ? JSON.parse(next) : next;
  }
  return { verb, input };
}

/** Reads a JSON object from stdin without hanging: a pipe that never delivers a byte is treated as empty. */
export async function readStdin(stream: NodeJS.ReadableStream & { isTTY?: boolean }, graceMs = 250, limits = { bytes: 1024 * 1024, deadlineMs: 5_000 }): Promise<Record<string, unknown>> {
  if (stream.isTTY) return {};
  const chunks: Buffer[] = [];
  const text = await new Promise<string>((resolve, reject) => {
    let size = 0;
    const finish = (error?: Error, empty = false) => {
      clearTimeout(idle); clearTimeout(deadline);
      stream.off("data", data); stream.off("end", end); stream.off("error", failed); stream.pause();
      if (error) reject(error); else resolve(empty ? "" : Buffer.concat(chunks).toString("utf8"));
    };
    const data = (c: Buffer) => {
      clearTimeout(idle);
      const chunk = Buffer.from(c); size += chunk.length;
      if (size > limits.bytes) { finish(new Error(`stdin exceeds ${limits.bytes} bytes`)); return; }
      chunks.push(chunk);
    };
    const end = () => finish();
    const failed = (e: Error) => finish(e);
    const idle = setTimeout(() => finish(undefined, true), graceMs);
    const deadline = setTimeout(() => finish(new Error("stdin body deadline exceeded")), limits.deadlineMs);
    stream.on("data", data); stream.on("end", end); stream.on("error", failed);
  });
  if (!text.trim()) return {};
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("stdin must hold one JSON object");
  return parsed as Record<string, unknown>;
}

/** A preload flag reaching the kernel by any launch path is refused: it would run code before the kernel does. */
export function preloadPresent(env: Record<string, string | undefined>, execArgv: readonly string[]): boolean {
  return /(^|\s)(--require|-r|--import|--loader|--experimental-loader)(\s|=|$)/.test(env.NODE_OPTIONS ?? "") ||
    execArgv.some((a) => /^(--require|-r|--import|--loader|--experimental-loader)(=|$)/.test(a));
}

const failure = (verb: string, exit: 1 | 4 | 5, code: string, message: string): KernelResponse =>
  ({ verb, exit, revision: 0, reasons: [{ code, message }], next: [], budget: { attempts: "0/0", rounds: "0/0", delegations: "0/0" } });

export async function main(argv: readonly string[], ports: Ports, verbs: Record<string, Verb>, stdin: NodeJS.ReadableStream & { isTTY?: boolean }, env: Record<string, string | undefined>, execArgv: readonly string[]): Promise<{ response: KernelResponse; code: number }> {
  let response: KernelResponse;
  const verb = argv[0] ?? "";
  if (preloadPresent(env, execArgv)) response = failure(verb, 4, "preload-present", "A preload flag reached the kernel; run it without --require, --import or --loader.");
  else if (!verb || verb === "--help" || verb === "-h") response = await runVerb(ports, verbs, "inspect", { view: "help" });
  else {
    try {
      const { verb: v, input } = parseArgs(argv);
      const body = BODY_VERBS.has(v) ? await readStdin(stdin) : {};
      response = await runVerb(ports, verbs, v, { ...body, ...input });
    } catch (e) {
      response = failure(verb, 1, "invalid-input", e instanceof Error ? e.message : String(e));
    }
  }
  return { response, code: response.exit };
}
