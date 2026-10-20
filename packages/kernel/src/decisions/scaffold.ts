// `decide scaffold`: write a starter recipe's platform layer into the project and install its pinned dependencies (TS §12.2).
// Two steps with different protocols: the file write is a non-repeatable effect (intent, act, result) that never overwrites;
// the install is an external job outside the lock. A failed install leaves the files in place, and the same call retries it.
import { basename } from "node:path";
import { z } from "zod";
import { KernelError } from "../core/errors.ts";
import { sha256 } from "../core/ids.ts";
import { reason } from "../core/reasons.ts";
import type { State, WorkContract } from "../core/schemas.ts";
import type { Recipe } from "../ports/types.ts";
import type { Job } from "../pipeline.ts";
import type { Ports, Tx } from "../ports/types.ts";
import { assistanceLevel } from "../core/risk.ts";
import { nx, readinessOf, withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";

const Request = z.object({
  recipe: z.string().default("ts-web-api"),
  name: z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,100}$/)
    .optional(),
  /** Decline the starter's protected-path defaults (auth, session, migrations). */
  protectDefaults: z.boolean().default(true),
});

const INSTALL_TIMEOUT_MS = 10 * 60_000;
const union = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])];
const projectName = (root: string) =>
  basename(root)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^[^a-z]+|-+$/g, "") || "app";

/** What the scaffold effect's intent records, so recovery can verify and finish it. */
export interface ScaffoldOp {
  work: string;
  recipe: { id: string; version: string };
  expected: Record<string, string>;
  protect: string[];
}

/** Applies the scaffold's consequences to the contract: its files are Tenet's, and the protected paths are in force. */
export const scaffolded = (
  w: WorkContract,
  expected: Readonly<Record<string, string>>,
  protect: readonly string[]
): WorkContract => ({
  ...w,
  vetted: { ...w.vetted, ...expected },
  touched: [
    ...w.touched,
    ...Object.keys(expected)
      .filter((p) => !w.touched.some((t) => t.path === p))
      .map((path) => ({ path })),
  ],
  scope: { ...w.scope, protected: union(w.scope.protected, protect) },
});

type Req = z.infer<typeof Request>;

/** The recipe with its files for this project: pinned lockfile verified, sentinel replaced, expected hashes and protected paths. */
function prepare(ports: Ports, req: Req) {
  const recipe = ports.recipes.load(req.recipe);
  if (!recipe) throw new KernelError("capability-missing", `no starter recipe called "${req.recipe}"`, { exit: 1 });
  const lock = recipe.files.find((f) => f.path === "package-lock.json");
  if (!lock || sha256(lock.content) !== recipe.lockfileSha256) {
    throw new KernelError("recipe-integrity-failed", "the lockfile is not the one the recipe pinned");
  }
  const name = req.name ?? projectName(ports.root);
  const files = recipe.files.map((f) => ({ ...f, content: f.content.replaceAll(recipe.sentinel, name) }));
  const expected = Object.fromEntries(files.map((f) => [f.path, sha256(f.content)]));
  return {
    recipe,
    name,
    files,
    paths: files.map((f) => f.path),
    expected,
    protect: req.protectDefaults ? recipe.protectedPaths : [],
  };
}

/** The non-repeatable file write (intent, act, result). A retry after a failed install finds the files exactly ours and skips it. */
function writeFiles(
  ports: Ports,
  tx: Tx,
  state: State,
  work: WorkContract,
  p: ReturnType<typeof prepare>
): { state: State; w: WorkContract } {
  const prior = state.project.recipe;
  const here = ports.project.hashes(p.paths);
  const ours = p.paths.every((path) => here[path] === p.expected[path]);
  if (prior && prior.installed) throw new KernelError("scaffold-target-not-empty", "this project was already scaffolded");
  if (prior && ours) return { state, w: work };
  const clash = p.paths.filter((path) => here[path] !== null);
  if (clash.length) throw new KernelError("scaffold-target-not-empty", clash.slice(0, 5).join(", "));
  const id = `s-${ports.rand.base32(6)}`;
  const op: ScaffoldOp = {
    work: work.id,
    recipe: { id: p.recipe.id, version: p.recipe.version },
    expected: p.expected,
    protect: p.protect,
  };
  tx.intent("scaffold", id, op);
  ports.project.writeNew(p.files); // exclusive create: a file that appeared meanwhile makes this throw, not overwrite
  tx.result("scaffold", id, { completed: true, files: p.paths.length });
  const recipe = { id: p.recipe.id, version: p.recipe.version, installed: false };
  return { state: { ...state, project: { ...state.project, recipe } }, w: scaffolded(work, p.expected, p.protect) };
}

async function install(ports: Ports, recipe: Recipe, runDir: string) {
  for (const argv of recipe.install) {
    const r = await ports.runner.run({ argv, cwd: ports.root, runDir, timeoutMs: INSTALL_TIMEOUT_MS });
    if (r.exit !== 0)
      return {
        failed: argv.join(" "),
        tail: (r.stderr || r.stdout).trim().split("\n").slice(-6).join("\n"),
        timedOut: r.timedOut,
      };
  }
  return { ok: true };
}

/** A failed install leaves the files in place; success records the recipe as installed and works the assistance level out again. */
async function installed(ports: Ports, st: State, work: WorkContract, p: ReturnType<typeof prepare>, result: unknown) {
  const cw = st.work[work.id]!;
  const done = { ...cw, session: { generation: cw.session.generation } };
  const r = result as { ok?: boolean; failed?: string; tail?: string; timedOut?: boolean; error?: string };
  if (!r.ok) {
    const why = r.error ?? `${r.timedOut ? "timed out: " : ""}${r.failed}\n${r.tail ?? ""}`;
    const again =
      "Fix the cause (network, proxy, disk), then run the same scaffold decision again; the files are kept and only the install repeats.";
    return {
      state: withWork(st, done),
      resp: { work: done.id, exit: 2 as const, reasons: [reason("install-failed", why)], next: [nx("reconcile", again, true)] },
    };
  }
  const level = assistanceLevel(readinessOf(ports, await ports.git.probe()), done.profile).level;
  const recipeRecord = { id: p.recipe.id, version: p.recipe.version, installed: true };
  return {
    state: withWork({ ...st, project: { ...st.project, recipe: recipeRecord } }, { ...done, level }),
    resp: {
      work: done.id,
      progress: { phase: "scaffolded", boundary: "milestone" as const },
      next: [nx("check", "Run the starter's own tests as the first check, then finish to commit the scaffold.", true)],
      data: { recipe: p.recipe.id, version: p.recipe.version, files: p.paths.length, protected: p.protect, name: p.name },
    },
  };
}

export const scaffold: Decision = {
  kind: "scaffold",
  async run({ ports, tx, state, work, input }) {
    const req = Request.parse(input.propose ?? {});
    if (!work.basis) throw new KernelError("continue-required", "record a basis with decide before scaffolding", { exit: 2 });
    if (work.session.inCall) throw new KernelError("work-busy", `a ${work.session.inCall.verb} is running`);
    const p = prepare(ports, req);
    const wrote = writeFiles(ports, tx, state, work, p);
    const runId = `${work.label}-i${ports.rand.base32(5)}`;
    const runDir = ports.store.tempDir(`run-${runId}`);
    const now = ports.clock.now();
    const inCall = { runId, ...ports.store.self(), verb: "scaffold", since: now, runDir };
    const w = { ...wrote.w, updatedAt: now, session: { ...wrote.w.session, inCall } };
    const job: Job = {
      id: runId,
      execute: () => install(ports, p.recipe, runDir),
      finalize: async (_tx, st, result) => installed(ports, st, work, p, result),
    };
    return { state: withWork(wrote.state, w), resp: { work: w.id, next: [] }, job };
  },
};
