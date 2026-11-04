// The result demo path (RES-05; result-demo-path.md §10 to §12). The coordinator proposes run commands and example steps;
// the kernel checks each reference against project files and the pinned basis, and never runs a command. Demo content is
// explanatory: it carries no verdict, receipt or acceptance, and what cannot be checked is listed as unavailable. Pure:
// the project files arrive through a reader function.
import { z } from "zod";
import { basisHashOf } from "./basis-build.ts";
import { redact } from "./redact.ts";
import type { BasisElement } from "./schemas.ts";
import type { ProjectReadResult } from "../ports/types.ts";

/** The most a documentation or manifest source may be: a trusted kernel limit, never taken from the input. */
export const DEMO_READ_BYTES = 64 * 1024;
const MAX_PROPOSAL_BYTES = 32 * 1024;

const UNSAFE = /[\u0000-\u001f\u007f-\u009f]/;
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
const Text = (max: number) => z.string().min(1).max(max)
  .refine((s) => !UNSAFE.test(s) && !LONE_SURROGATE.test(s), "must be one line of valid text without control characters");
const RelPath = Text(200).refine(
  (p) => !p.startsWith("/") && !p.includes("\\") && !/^[A-Za-z]:/.test(p) && p.split("/").every((s) => s !== "" && s !== "." && s !== ".."),
  "must be a repository-relative path without parent traversal",
);
const ExampleId = z.string().max(200).regex(/^EX-\d+-[a-z0-9]+\.\d+$/, "must be a confirmed example id");
const RefId = z.string().max(200).regex(/^[A-Za-z0-9][A-Za-z0-9:._-]*$/, "must be an identifier");

const CommandSource = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("package-script"), path: RelPath, script: Text(100) }),
  z.strictObject({ kind: z.literal("documentation"), path: RelPath, line: z.number().int().positive(), command: Text(500) }),
]);
export type CommandSource = z.infer<typeof CommandSource>;

const commandKey = (c: CommandSource): string => (c.kind === "package-script" ? `${c.path}#${c.script}` : `${c.path}:${c.line}`);
const duplicate = (keys: string[]): boolean => new Set(keys).size !== keys.length;

/** A strict, bounded proposal. Anything malformed is refused whole: a proposal is never cut down to a shorter, apparently complete demo. */
export const DemoProposal = z.strictObject({
  surface: z.enum(["ui", "use", "internal"]),
  basisHash: z.string().regex(/^[0-9a-f]{64}$/),
  commands: z.array(CommandSource).max(4),
  steps: z.array(z.strictObject({
    exampleId: ExampleId, instruction: Text(500).refine((s) => s.trim() !== "", "must not be blank"),
  })).max(60),
  screenshots: z.array(z.strictObject({ receiptId: RefId, exampleId: ExampleId, attachmentId: RefId })).max(5),
}).superRefine((p, ctx) => {
  const problem = (message: string) => ctx.addIssue({ code: "custom", message });
  if (Buffer.byteLength(JSON.stringify(p)) > MAX_PROPOSAL_BYTES) problem("a demo proposal is at most 32 KiB");
  if (duplicate(p.commands.map(commandKey))) problem("a command source is named twice");
  if (duplicate(p.steps.map((s) => s.exampleId))) problem("an example has two steps");
  if (duplicate(p.screenshots.map((s) => s.attachmentId))) problem("an attachment is selected twice");
  const stepped = new Set(p.steps.map((s) => s.exampleId));
  if (p.screenshots.some((s) => !stepped.has(s.exampleId))) problem("a screenshot must belong to an example that has a step");
  if (p.surface === "internal" && (p.commands.length || p.steps.length || p.screenshots.length))
    problem("an internal declaration carries no commands, steps or screenshots");
});
export type DemoProposal = z.infer<typeof DemoProposal>;

/** Demo-local values, not reason codes or endpoints (§10.2). */
export type UnavailableReason = "not-supplied" | "source-unavailable" | "stale-basis" | "example-unavailable" | "artifact-unavailable"
  | "unsupported" | "sensitive-content" | "applicability-unverified";
export interface Unavailable { part: "run" | "example" | "screenshot" | "applicability"; ref?: string; reason: UnavailableReason }
export interface Demo {
  surface: "ui" | "use";
  run: Array<{ instruction: string; cwd: string; source: CommandSource; verification: "source-checked-not-executed" }>;
  steps: Array<{ exampleId: string; text: string }>;
  screenshots: Array<{
    exampleId: string; receiptId: string; attachmentId: string; path: string; verification: "run-attached-presentation";
  }>;
  unavailable: Unavailable[];
}

export interface DemoContext {
  basis: { hash: string; elementIds: readonly string[]; design?: string } | undefined;
  outcome: string;
  /** The project's intent elements; the basis names the ones this contract is bound to. */
  elements: readonly BasisElement[];
  packageManager: "npm" | "pnpm" | "yarn" | "unknown";
  moduleRoot: string;
}
export type DemoReader = (path: string, maxBytes: number) => ProjectReadResult;

const SCRIPT = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,99}$/;
const DOCS = /^docs\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.md$/;
const SHELL = new Set(["sh", "bash", "shell"]);
const ROOT_MARKER = "# cwd: .";
type Resolved = { instruction: string; cwd: string } | { reason: UnavailableReason };

/** True when `lines[at]` is a command line inside a closed shell fence whose first nonempty line declares the repository root. */
function inRootShellFence(lines: readonly string[], at: number): boolean {
  let open = -1, lang = "";
  for (const [i, line] of lines.entries()) {
    if (open < 0) {
      if (line.startsWith("```")) { open = i; lang = line.slice(3).trim(); }
      continue;
    }
    if (!/^```\s*$/.test(line)) continue;
    if (at > open && at < i && SHELL.has(lang)) {
      const marker = open + 1 + lines.slice(open + 1, i).findIndex((l) => l.trim() !== "");
      return lines[marker] === ROOT_MARKER && at > marker;
    }
    open = -1;
  }
  return false;
}

function packageScript(s: Extract<CommandSource, { kind: "package-script" }>, c: DemoContext, get: DemoReader): Resolved {
  const manifest = `${c.moduleRoot === "." ? "" : `${c.moduleRoot}/`}package.json`;
  const manager = c.packageManager;
  if (s.path !== manifest || !SCRIPT.test(s.script) || (manager !== "npm" && manager !== "pnpm")) return { reason: "unsupported" };
  const read = get(s.path, DEMO_READ_BYTES);
  if (read.status !== "available") return { reason: "source-unavailable" };
  let scripts: unknown;
  try { scripts = (JSON.parse(read.text) as { scripts?: unknown } | null)?.scripts; } catch { return { reason: "source-unavailable" }; }
  const table = scripts && typeof scripts === "object" ? (scripts as Record<string, unknown>) : {};
  const own = Object.hasOwn(table, s.script) ? table[s.script] : undefined;
  return typeof own === "string" ? { instruction: `${manager} run ${s.script}`, cwd: c.moduleRoot } : { reason: "source-unavailable" };
}

function documented(s: Extract<CommandSource, { kind: "documentation" }>, get: DemoReader): Resolved {
  if (s.path !== "README.md" && !DOCS.test(s.path)) return { reason: "unsupported" };
  const read = get(s.path, DEMO_READ_BYTES);
  if (read.status !== "available") return { reason: "source-unavailable" };
  const lines = read.text.split(/\r?\n/);
  const command = s.command.trim() !== "" && !s.command.startsWith("#");
  const ok = command && lines[s.line - 1] === s.command && inRootShellFence(lines, s.line - 1);
  return ok ? { instruction: s.command, cwd: "." } : { reason: "source-unavailable" };
}

function runEntries(sources: readonly CommandSource[], c: DemoContext, get: DemoReader, out: Unavailable[]): Demo["run"] {
  const run: Demo["run"] = [];
  for (const source of sources) {
    const r = source.kind === "package-script" ? packageScript(source, c, get) : documented(source, get);
    if ("reason" in r) out.push({ part: "run", ref: source.path, reason: r.reason });
    else if (redact(r.instruction) !== r.instruction) out.push({ part: "run", ref: source.path, reason: "sensitive-content" });
    else run.push({ ...r, source, verification: "source-checked-not-executed" });
  }
  return run;
}

/** Examples resolve only from the basis the contract is bound to, and only while that basis still hashes to what it was pinned as. */
function exampleSteps(p: DemoProposal, c: DemoContext, out: Unavailable[]): Demo["steps"] {
  const unavailable = (ref: string, reason: UnavailableReason) => out.push({ part: "example", ref, reason });
  if (!c.basis) { for (const s of p.steps) unavailable(s.exampleId, "example-unavailable"); return []; }
  const bound = c.basis.elementIds.flatMap((id) => c.elements.find((e) => e.id === id) ?? []);
  const pinned = bound.length === c.basis.elementIds.length && basisHashOf(c.outcome, c.basis.design, bound) === c.basis.hash;
  if (p.basisHash !== c.basis.hash || !pinned) { out.push({ part: "example", reason: "stale-basis" }); return []; }
  const examples = new Map(bound.filter((e) => e.kind === "example").map((e) => [e.id, e]));
  const steps: Demo["steps"] = [];
  for (const s of p.steps) {
    const example = examples.get(s.exampleId);
    const text = example && `Example ${example.id}: ${example.text} Guidance from the coordinator, not a check result: ${s.instruction}`;
    if (text === undefined) unavailable(s.exampleId, "example-unavailable");
    else if (redact(text) !== text) unavailable(s.exampleId, "sensitive-content");
    else steps.push({ exampleId: s.exampleId, text });
  }
  const stepped = new Set(p.steps.map((s) => s.exampleId));
  for (const id of examples.keys()) if (!stepped.has(id)) unavailable(id, "not-supplied");
  return steps;
}

/**
 * The demo block for a proposal, or none for an internal declaration. Applicability is the coordinator's declaration: until a
 * change assessment exists (QLT-11) the kernel cannot certify it, and says so. No screenshot can be referenced yet (RD-3, RD-4).
 */
export function buildDemo(p: DemoProposal, c: DemoContext, read: DemoReader): Demo | undefined {
  if (p.surface === "internal") return undefined;
  const memo = new Map<string, ProjectReadResult>();
  const get: DemoReader = (path, max) => memo.get(path) ?? memo.set(path, read(path, max)).get(path)!;
  const out: Unavailable[] = [];
  const run = runEntries(p.commands, c, get, out);
  if (!p.commands.length) out.push({ part: "run", reason: "not-supplied" });
  const steps = exampleSteps(p, c, out);
  if (p.screenshots.length) for (const s of p.screenshots) out.push({ part: "screenshot", ref: s.attachmentId, reason: "unsupported" });
  else if (p.surface === "ui") out.push({ part: "screenshot", reason: "not-supplied" });
  out.push({ part: "applicability", reason: "applicability-unverified" });
  return { surface: p.surface, run, steps, screenshots: [], unavailable: out };
}
